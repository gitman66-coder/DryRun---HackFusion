from __future__ import annotations

from datetime import datetime, timezone
from contextlib import asynccontextmanager
from typing import Any
from uuid import uuid4

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field

from backend.agent.mcp_client import connected_mcp_tools
from backend.agent.model import get_chat_model
from backend.agent.run_id import canonical_run_id
from backend.agent.workflow import build_workflow

# Demo storage: run plans survive API requests, but only until this process stops.
RUNS: dict[str, dict[str, Any]] = {}


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
        default="Check documented setup steps in the disposable Docker sandbox.",
        min_length=1,
        max_length=2000,
    )
    run_id: str | None = None



def _exception_details(exc: BaseException) -> str:
    """Flatten ExceptionGroup errors so API responses reveal the failed MCP/model step."""
    if isinstance(exc, BaseExceptionGroup):
        return "; ".join(_exception_details(child) for child in exc.exceptions)
    message = str(exc).strip()
    return f"{type(exc).__name__}: {message}" if message else type(exc).__name__


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
    """Inspect repository evidence, run supported setup checks in Docker, and return a report."""
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
        "status": "pending",
        "error": None,
    }
    try:
        async with connected_mcp_tools(("sandbox",)) as tools:
            graph = build_workflow(tools=tools, planner_model=get_chat_model())
            result = await graph.ainvoke(initial_state)
            # The same disposable sandbox is used for inspection and verification, then destroyed.
            sandbox_id = result.get("sandbox_id")
            if sandbox_id:
                destroy_tool = next((tool for tool in tools if tool.name == "destroy_sandbox"), None)
                if destroy_tool:
                    try:
                        cleanup = _tool_payload(await destroy_tool.ainvoke({"sandbox_id": sandbox_id}))
                        result["sandbox_cleanup"] = cleanup
                        if cleanup.get("status") not in {"destroyed", "already removed"}:
                            result["cleanup_warning"] = cleanup.get("error", "Sandbox cleanup was not confirmed.")
                    except Exception as cleanup_error:
                        result["cleanup_warning"] = f"Could not confirm sandbox cleanup: {cleanup_error}"
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Run could not be completed: {_exception_details(exc)}") from exc

    # Persist the sandbox-only report for result lookup.
    response = {
        "run_id": run_id,
        "status": result.get("status", "failed"),
        "error": result.get("error"),
        "repo_url": result.get("repo_url", request.repo_url),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "repository_facts": result.get("repository_facts"),
        "plan": result.get("plan"),
        "rehearsal_results": result.get("rehearsal_results", []),
        "risk_assessment": result.get("risk_assessment"),
        "feasibility": result.get("feasibility"),
        "sandbox_cleanup": result.get("sandbox_cleanup"),
        "cleanup_warning": result.get("cleanup_warning"),
    }
    RUNS[run_id] = response
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
