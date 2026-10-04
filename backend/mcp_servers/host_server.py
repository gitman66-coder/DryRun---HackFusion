from __future__ import annotations

import os
import re
import shutil
import subprocess
import sys
import time
from pathlib import Path
from typing import Any

# Make the project root importable when MCP Inspector launches this file directly.
PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

try:
    from mcp.server.mcpserver import MCPServer as FastMCP
except ImportError:
    from mcp.server.fastmcp import FastMCP

from backend.agent.policy import (
    policy_decision,
    resolve_workspace_path,
    workspace_for_run,
)

mcp = FastMCP("dryrun-host")
MAX_TEXT_BYTES = 256 * 1024


def _blocked(decision: dict[str, Any]) -> dict[str, Any]:
    """Return a consistent response when policy does not approve an action."""
    return {"ok": False, **decision}


@mcp.tool()
def create_run_workspace(run_id: str, approved: bool = False) -> dict[str, Any]:
    """Create the isolated host folder for one run; requires explicit approval."""
    decision = policy_decision("write_file", run_id, approved)
    if not decision["allowed"]:
        return _blocked(decision)

    workspace = workspace_for_run(run_id)
    workspace.mkdir(parents=True, exist_ok=True)
    return {"ok": True, "run_id": run_id, "workspace": str(workspace)}


@mcp.tool()
def write_workspace_file(
    run_id: str,
    relative_path: str,
    content: str,
    approved: bool = False,
) -> dict[str, Any]:
    """Write UTF-8 text inside the approved run workspace (maximum 256 KB)."""
    decision = policy_decision("write_file", run_id, approved)
    if not decision["allowed"]:
        return _blocked(decision)

    try:
        target = resolve_workspace_path(run_id, relative_path)
        content_bytes = content.encode("utf-8")
        if len(content_bytes) > MAX_TEXT_BYTES:
            return {"ok": False, "error": "content exceeds the 256 KB limit."}
        target.parent.mkdir(parents=True, exist_ok=True)
        # Re-resolve after making directories to catch a symlink path inside workspace.
        target = resolve_workspace_path(run_id, relative_path)
        target.write_bytes(content_bytes)
    except (OSError, ValueError) as exc:
        return {"ok": False, "error": str(exc)}

    return {"ok": True, "path": str(target), "bytes_written": len(content_bytes)}


@mcp.tool()
def create_python_venv(run_id: str, approved: bool = False) -> dict[str, Any]:
    """Create a Python virtual environment inside the run workspace; requires approval."""
    decision = policy_decision("create_venv", run_id, approved)
    if not decision["allowed"]:
        return _blocked(decision)

    workspace = workspace_for_run(run_id)
    venv_path = workspace / ".venv"
    workspace.mkdir(parents=True, exist_ok=True)
    if venv_path.exists():
        return {"ok": True, "venv": str(venv_path), "already_exists": True}

    try:
        result = subprocess.run(
            [sys.executable, "-m", "venv", str(venv_path)],
            cwd=str(workspace),
            capture_output=True,
            text=True,
            timeout=180,
            check=False,
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        return {"ok": False, "error": str(exc)}

    if result.returncode != 0:
        return {
            "ok": False,
            "returncode": result.returncode,
            "stderr": result.stderr[-4000:],
        }

    return {"ok": True, "venv": str(venv_path), "python": sys.version.split()[0]}


_PACKAGE_SPEC = re.compile(
    r"^[A-Za-z0-9][A-Za-z0-9._-]*(?:\[[A-Za-z0-9_,.-]+\])?(?:\s*(?:===|==|~=|!=|<=|>=|<|>)\s*[A-Za-z0-9.*+!-]+)?$"
)


@mcp.tool()
def install_python_packages(
    run_id: str,
    packages: list[str],
    approved: bool = False,
) -> dict[str, Any]:
    """Install named Python packages into this run's venv after approval; package names may include version pins."""
    decision = policy_decision("pip_install", run_id, approved)
    if not decision["allowed"]:
        return _blocked(decision)
    if not packages or len(packages) > 30:
        return {"ok": False, "error": "Provide between 1 and 30 package specifications."}
    if any(not isinstance(item, str) or not _PACKAGE_SPEC.fullmatch(item.strip()) for item in packages):
        return {
            "ok": False,
            "error": "Use package names with optional version pins (for example fastapi==0.115.0); URLs and command options are not accepted.",
        }

    workspace = workspace_for_run(run_id)
    venv_path = workspace / ".venv"
    python = venv_path / ("Scripts/python.exe" if sys.platform == "win32" else "bin/python")
    if not python.is_file():
        return {"ok": False, "error": "No run virtual environment found. Create it first."}

    try:
        result = subprocess.run(
            [str(python), "-m", "pip", "install", "--disable-pip-version-check", "--no-input", *[p.strip() for p in packages]],
            cwd=str(workspace),
            capture_output=True,
            text=True,
            timeout=600,
            check=False,
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        return {"ok": False, "error": str(exc)}

    return {
        "ok": result.returncode == 0,
        "returncode": result.returncode,
        "packages": packages,
        "stdout": result.stdout[-4000:],
        "stderr": result.stderr[-4000:],
    }

_NPM_PACKAGE_SPEC = re.compile(
    r"^(?:@[A-Za-z0-9._-]+/)?[A-Za-z0-9._-]+(?:@[0-9][A-Za-z0-9.*+!-]*)?$"
)


@mcp.tool()
def install_npm_packages(
    run_id: str,
    packages: list[str],
    approved: bool = False,
) -> dict[str, Any]:
    """Install named npm packages in this run workspace after approval; optional exact versions are accepted."""
    decision = policy_decision("npm_install", run_id, approved)
    if not decision["allowed"]:
        return _blocked(decision)
    if not packages or len(packages) > 30:
        return {"ok": False, "error": "Provide between 1 and 30 package names."}
    if any(not isinstance(item, str) or not _NPM_PACKAGE_SPEC.fullmatch(item.strip()) for item in packages):
        return {
            "ok": False,
            "error": "Use npm package names with optional version pins (for example vite@6.0.1); URLs and command options are not accepted.",
        }

    npm = shutil.which("npm")
    if npm is None:
        return {"ok": False, "error": "npm was not found on the host PATH."}

    workspace = workspace_for_run(run_id)
    workspace.mkdir(parents=True, exist_ok=True)
    try:
        result = subprocess.run(
            [npm, "install", "--no-audit", "--no-fund", "--", *[p.strip() for p in packages]],
            cwd=str(workspace),
            capture_output=True,
            text=True,
            timeout=600,
            check=False,
            shell=(sys.platform == "win32" and npm.lower().endswith((".cmd", ".bat"))),
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        return {"ok": False, "error": str(exc)}

    return {
        "ok": result.returncode == 0,
        "returncode": result.returncode,
        "packages": packages,
        "stdout": result.stdout[-4000:],
        "stderr": result.stderr[-4000:],
    }

_SECRET_KEY = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")
_RUNNING_SERVICES: dict[tuple[str, int], subprocess.Popen[Any]] = {}


@mcp.tool()
def write_secret(
    run_id: str,
    key: str,
    value: str,
    approved: bool = False,
) -> dict[str, Any]:
    """Store one approved secret in the run workspace .env file; never return the secret value."""
    decision = policy_decision("write_secret", run_id, approved)
    if not decision["allowed"]:
        return _blocked(decision)
    if not _SECRET_KEY.fullmatch(key):
        return {"ok": False, "error": "Secret key must be a valid environment variable name."}
    if not isinstance(value, str) or len(value.encode("utf-8")) > 8192 or any(ch in value for ch in "\r\n\x00"):
        return {"ok": False, "error": "Secret must be single-line text no larger than 8 KB."}

    try:
        env_path = resolve_workspace_path(run_id, ".env")
        env_path.parent.mkdir(parents=True, exist_ok=True)
        old_text = env_path.read_text(encoding="utf-8") if env_path.is_file() else ""
        escaped = value.replace("\\", "\\\\").replace('"', '\\"')
        new_line = f'{key}="{escaped}"'
        lines = old_text.splitlines()
        replaced = False
        for index, line in enumerate(lines):
            if line.partition("=")[0].strip() == key:
                lines[index] = new_line
                replaced = True
                break
        if not replaced:
            lines.append(new_line)
        temp_path = resolve_workspace_path(run_id, ".env.tmp")
        temp_path.write_text("\n".join(lines).lstrip("\n") + "\n", encoding="utf-8")
        temp_path.replace(env_path)
    except (OSError, ValueError) as exc:
        return {"ok": False, "error": str(exc)}

    return {"ok": True, "key": key, "path": str(env_path), "value_written": True}


@mcp.tool()
def start_project_service(
    run_id: str,
    relative_script: str,
    port: int = 8000,
    approved: bool = False,
) -> dict[str, Any]:
    """Start an approved Python script from the run workspace on the host loopback; this executes project code outside Docker."""
    decision = policy_decision("run_service", run_id, approved)
    if not decision["allowed"]:
        return _blocked(decision)
    if not isinstance(port, int) or not 1024 <= port <= 65535:
        return {"ok": False, "error": "port must be between 1024 and 65535."}

    try:
        workspace = workspace_for_run(run_id)
        script = resolve_workspace_path(run_id, relative_script)
    except ValueError as exc:
        return {"ok": False, "error": str(exc)}
    if not script.is_file():
        return {"ok": False, "error": "The requested script does not exist in this run workspace."}

    python = workspace / ".venv" / ("Scripts/python.exe" if sys.platform == "win32" else "bin/python")
    if not python.is_file():
        python = Path(sys.executable)
    service_key = (str(workspace), port)
    previous = _RUNNING_SERVICES.get(service_key)
    if previous is not None and previous.poll() is None:
        return {"ok": False, "error": "A tracked service already uses this port in this run.", "pid": previous.pid}

    log_path = resolve_workspace_path(run_id, ".dryrun-service.log")
    safe_env_names = {"PATH", "SYSTEMROOT", "WINDIR", "TEMP", "TMP", "USERPROFILE", "APPDATA", "LOCALAPPDATA", "HOME", "LANG"}
    env = {key: value for key, value in os.environ.items() if key.upper() in safe_env_names}
    env.update({"HOST": "127.0.0.1", "PORT": str(port), "DRYRUN_PORT": str(port)})
    try:
        with log_path.open("ab") as log_file:
            process = subprocess.Popen(
                [str(python), "-u", str(script)],
                cwd=str(workspace),
                env=env,
                stdin=subprocess.DEVNULL,
                stdout=log_file,
                stderr=subprocess.STDOUT,
            )
        # Give an immediately failing script a moment to exit so the error is visible.
        time.sleep(0.4)
        if process.poll() is not None:
            output = log_path.read_text(encoding="utf-8", errors="replace")[-3000:]
            return {"ok": False, "returncode": process.returncode, "log": output}
    except OSError as exc:
        return {"ok": False, "error": str(exc)}

    _RUNNING_SERVICES[service_key] = process
    return {
        "ok": True,
        "pid": process.pid,
        "port": port,
        "host": "127.0.0.1",
        "log": str(log_path),
        "note": "Service runs on the host; stop it with stop_project_service when finished.",
    }


@mcp.tool()
def stop_project_service(
    run_id: str,
    port: int,
    approved: bool = False,
) -> dict[str, Any]:
    """Stop a service started and tracked by this host MCP server; requires approval."""
    decision = policy_decision("run_service", run_id, approved)
    if not decision["allowed"]:
        return _blocked(decision)
    try:
        workspace = str(workspace_for_run(run_id))
    except ValueError as exc:
        return {"ok": False, "error": str(exc)}

    process = _RUNNING_SERVICES.get((workspace, port))
    if process is None:
        return {"ok": False, "error": "No tracked service was found for this run and port."}
    if process.poll() is None:
        process.terminate()
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait(timeout=5)
    _RUNNING_SERVICES.pop((workspace, port), None)
    return {"ok": True, "port": port, "stopped": True}

if __name__ == "__main__":
    mcp.run()






