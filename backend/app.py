from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from contextlib import asynccontextmanager
from typing import Any
from uuid import uuid4

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field

from backend.agent.mcp_client import connected_mcp_tools
from backend.agent.model import get_chat_model
from backend.agent.policy import canonical_run_id, workspace_for_run
from backend.agent.workflow import build_workflow

# Demo storage: run plans survive API requests, but only until this process stops.
RUNS: dict[str, dict[str, Any]] = {}
RUN_LOCKS: dict[str, asyncio.Lock] = {}


@asynccontextmanager
async def lifespan(_: FastAPI):
    """Start the API without opening MCP sessions until an endpoint needs them."""
    yield


app = FastAPI(title="Dryrun API", version="0.2.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"] ,
)


class AnalyzeRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    repo_url: str = Field(min_length=1, max_length=500)
    user_request: str = Field(
        default="Determine the minimum safe steps to install and run this repository.",
        min_length=1,
        max_length=2000,
    )
    run_id: str | None = None
    workspace_name: str = Field(default="", max_length=80)
    preferred_port: int = Field(default=8000, ge=1024, le=65535)
    environment_mode: str = Field(default="development", pattern=r"^(development|test|production)$")


class ApprovalRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    approved: bool
    action_ids: list[str] = Field(default_factory=list, max_length=20)
    # Values are provided by the user at approval time; never return or log these.
    secrets: dict[str, str] = Field(default_factory=dict)


def _tool_payload(value: Any) -> dict[str, Any]:
    """Unwrap common LangChain MCP tool response formats."""
    if isinstance(value, tuple) and len(value) == 2:
        value = value[1]
    structured = getattr(value, "structured_content", None)
    if isinstance(structured, dict):
        return structured
    if isinstance(value, dict):
        return value
    content = getattr(value, "content", value)
    if isinstance(content, list):
        for block in content:
            text = block.get("text") if isinstance(block, dict) else getattr(block, "text", None)
            if text:
                import json
                try:
                    parsed = json.loads(text)
                    if isinstance(parsed, dict):
                        return parsed
                except (TypeError, ValueError):
                    continue
    return {"ok": False, "error": str(value)}


@app.get("/")
@app.get("/health")
async def health() -> dict[str, str]:
    """Simple liveness check for the API process."""
    return {"status": "ok", "service": "dryrun"}


@app.post("/runs", status_code=201)
async def analyze_repository(request: AnalyzeRequest) -> dict[str, Any]:
    """Inspect a public GitHub repository in Docker and generate a proposed plan."""
    run_id = request.run_id or str(uuid4())
    try:
        run_id = canonical_run_id(run_id)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    if run_id in RUNS:
        raise HTTPException(status_code=409, detail="That run_id already exists.")

    initial_state = {
        "run_id": run_id,
        "repo_url": request.repo_url,
        "user_request": request.user_request,
        "workspace_name": request.workspace_name.strip(),
        "preferred_port": request.preferred_port,
        "environment_mode": request.environment_mode,
        "status": "pending",
        "error": None,
    }
    try:
        async with connected_mcp_tools() as tools:
            graph = build_workflow(tools=tools, planner_model=get_chat_model())
            result = await graph.ainvoke(initial_state)
            # The workflow leaves successful sandboxes alive; clean them after planning.
            sandbox_id = result.get("sandbox_id")
            if sandbox_id:
                destroy_tool = next((tool for tool in tools if tool.name == "destroy_sandbox"), None)
                if destroy_tool:
                    cleanup = _tool_payload(await destroy_tool.ainvoke({"sandbox_id": sandbox_id}))
                    result["sandbox_cleanup"] = cleanup
                    if not cleanup.get("ok", True) and not cleanup.get("status") == "destroyed":
                        result["cleanup_warning"] = cleanup.get("error", "Sandbox cleanup was not confirmed.")
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Run could not be completed: {exc}") from exc

    plan = result.get("plan")
    if isinstance(plan, dict):
        for action in plan.get("host_actions", []):
            if action.get("kind") == "run_service":
                action["port"] = request.preferred_port

    # Persist only the run result needed by the later approval and lookup endpoints.
    response = {
        "run_id": run_id,
        "status": result.get("status", "failed"),
        "error": result.get("error"),
        "repo_url": result.get("repo_url", request.repo_url),
        "workspace_name": request.workspace_name.strip(),
        "preferred_port": request.preferred_port,
        "environment_mode": request.environment_mode,
        "workspace": str(workspace_for_run(run_id)),
        "workspace_ready": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "repository_facts": result.get("repository_facts"),
        "plan": result.get("plan"),
        "sandbox_cleanup": result.get("sandbox_cleanup"),
        "cleanup_warning": result.get("cleanup_warning"),
    }
    RUNS[run_id] = response
    RUN_LOCKS[run_id] = asyncio.Lock()
    return response


@app.get("/runs/{run_id}")
async def get_run(run_id: str) -> dict[str, Any]:
    """Fetch the saved status, repository evidence, and plan for a run."""
    try:
        run_id = canonical_run_id(run_id)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    run = RUNS.get(run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="Run not found; it may have expired after an API restart.")
    return run


@app.post("/runs/{run_id}/approval")
async def approve_plan(run_id: str, request: ApprovalRequest) -> dict[str, Any]:
    """Reject a plan or run every selected, typed host action after explicit approval."""
    try:
        run_id = canonical_run_id(run_id)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    run = RUNS.get(run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="Run not found; analyze it first.")

    lock = RUN_LOCKS.setdefault(run_id, asyncio.Lock())
    async with lock:
        if run.get("status") != "planned":
            raise HTTPException(status_code=409, detail=f"Run must be in planned state; current state is {run.get('status')}.")
        plan = run.get("plan") or {}
        actions = plan.get("host_actions", [])
        if not request.approved:
            run["status"] = "rejected"
            run["approval"] = "rejected"
            return {"run_id": run_id, "status": "rejected", "message": "Plan rejected; no host actions were run."}

        required_ids = {action["action_id"] for action in actions}
        chosen_ids = request.action_ids
        if len(chosen_ids) != len(set(chosen_ids)) or set(chosen_ids) != required_ids:
            raise HTTPException(
                status_code=422,
                detail={"message": "Approval must explicitly include each planned host action exactly once.", "required_action_ids": sorted(required_ids)},
            )
        needed_secret_keys = {a["secret_key"] for a in actions if a.get("kind") == "write_secret"}
        if set(request.secrets) != needed_secret_keys:
            raise HTTPException(
                status_code=422,
                detail={"message": "Provide exactly the secret values requested by the approved plan.", "required_secret_keys": sorted(needed_secret_keys)},
            )

        run["status"] = "executing"
        run["approval"] = "approved"
        results: list[dict[str, Any]] = []
        try:
            async with connected_mcp_tools() as tools:
                tool_map = {tool.name: tool for tool in tools}
                create_workspace = tool_map.get("create_run_workspace")
                if create_workspace is None:
                    raise RuntimeError("Host MCP tool create_run_workspace is unavailable.")
                workspace_result = _tool_payload(await create_workspace.ainvoke({"run_id": run_id, "approved": True}))
                if not workspace_result.get("ok"):
                    raise RuntimeError(workspace_result.get("error") or workspace_result.get("reason") or "Could not create run workspace.")

                clone_tool = tool_map.get("clone_repository_to_workspace")
                if clone_tool is None:
                    raise RuntimeError("Host MCP tool clone_repository_to_workspace is unavailable.")
                clone_result = _tool_payload(await clone_tool.ainvoke({"run_id": run_id, "repo_url": run["repo_url"], "approved": True}))
                if not clone_result.get("ok"):
                    raise RuntimeError(clone_result.get("error") or clone_result.get("stderr") or "Could not clone repository into the approved workspace.")
                run["repository_workspace"] = clone_result.get("path")
                run["workspace"] = workspace_result.get("workspace")
                run["workspace_ready"] = True

                tool_names = {
                    "create_venv": "create_python_venv",
                    "pip_install": "install_python_packages",
                    "npm_install": "install_npm_packages",
                    "write_file": "write_workspace_file",
                    "write_secret": "write_secret",
                    "run_service": "start_project_service",
                }
                # Keep dependency-sensitive operations in a stable order even if the model does not.
                action_priority = {"create_venv": 0, "pip_install": 1, "npm_install": 1, "write_file": 2, "write_secret": 3, "run_service": 4, "system_package": 5}
                ordered_actions = sorted(actions, key=lambda action: action_priority.get(action["kind"], 99))
                for action in ordered_actions:
                    kind = action["kind"]
                    if kind == "system_package":
                        results.append({"action_id": action["action_id"], "ok": True, "manual_required": True, "message": "Install this operating-system package manually; Dryrun never performs system package installs."})
                        continue
                    tool_name = tool_names.get(kind)
                    tool = tool_map.get(tool_name or "")
                    if tool is None:
                        results.append({"action_id": action["action_id"], "ok": False, "error": f"No host tool supports {kind}."})
                        continue
                    arguments: dict[str, Any] = {"run_id": run_id, "approved": True}
                    if kind in {"pip_install", "npm_install"}:
                        arguments["packages"] = action["packages"]
                    elif kind == "write_file":
                        arguments.update(relative_path=action["relative_path"], content=action["file_content"])
                    elif kind == "write_secret":
                        arguments.update(key=action["secret_key"], value=request.secrets[action["secret_key"]])
                    elif kind == "run_service":
                        arguments.update(relative_script=action["service_script"], port=action["port"])
                    result = _tool_payload(await tool.ainvoke(arguments))
                    # Do not return user-provided secret values in action results.
                    results.append({"action_id": action["action_id"], **result})
        except Exception as exc:
            run["status"] = "failed"
            run["error"] = f"Approved action execution failed: {exc}"
            run["action_results"] = results
            raise HTTPException(status_code=500, detail=run["error"]) from exc

        run["action_results"] = results
        run["workspace"] = workspace_result.get("workspace", run.get("workspace"))
        run["workspace_ready"] = True
        run["status"] = "completed" if all(item.get("ok", False) for item in results) else "failed"
        if run["status"] == "failed":
            run["error"] = "One or more approved host actions did not succeed. Review action_results."
        return {"run_id": run_id, "status": run["status"], "workspace": run.get("workspace"), "action_results": results, "error": run.get("error")}
