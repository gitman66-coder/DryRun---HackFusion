from __future__ import annotations

import base64
from pathlib import PurePosixPath
import shlex
import time
from typing import Any

import docker
from docker.errors import DockerException, NotFound

from mcp.server.fastmcp import FastMCP

mcp = FastMCP("dryrun-sandbox")
docker_client = docker.from_env()

# Only containers created by this running server process can be targeted.
_sandboxes: dict[str, Any] = {}
_MAX_COMMAND_TIMEOUT = 600
_OUTPUT_LIMIT = 4000
_MAX_FILE_BYTES = 256_000
_MAX_READ_BYTES = 64_000
_MAX_SERVICE_WAIT = 120


def _get_sandbox(sandbox_id: str) -> Any:
    container = _sandboxes.get(sandbox_id)
    if container is None:
        raise ValueError("Unknown sandbox_id. Create a sandbox first.")
    container.reload()
    if container.status != "running":
        raise ValueError(f"Sandbox is not running (status: {container.status}).")
    return container


def _decode_tail(value: bytes | None) -> str:
    if not value:
        return ""
    return value.decode(errors="replace")[-_OUTPUT_LIMIT:]


@mcp.tool()
def create_sandbox() -> dict[str, str]:
    """Create a disposable Docker sandbox from the dryrun-base image. No host folders are mounted."""
    try:
        container = docker_client.containers.run(
            image="dryrun-base",
            command=["sleep", "infinity"],
            detach=True,
            labels={"dryrun.managed": "true"},
            mem_limit="2g",
            nano_cpus=1_000_000_000,
            pids_limit=256,
            security_opt=["no-new-privileges:true"],
        )
        sandbox_id = container.short_id
        _sandboxes[sandbox_id] = container
        return {"sandbox_id": sandbox_id, "status": "running"}
    except DockerException as exc:
        return {"error": f"Could not create sandbox: {exc}"}


@mcp.tool()
def sandbox_shell(sandbox_id: str, command: str, timeout: int = 120) -> dict[str, Any]:
    """Run a shell command inside a managed sandbox; returns exit code and trimmed stdout/stderr."""
    if not 1 <= timeout <= _MAX_COMMAND_TIMEOUT:
        return {"error": f"timeout must be between 1 and {_MAX_COMMAND_TIMEOUT} seconds."}
    try:
        container = _get_sandbox(sandbox_id)
        result = container.exec_run(
            ["timeout", str(timeout), "bash", "-lc", command],
            demux=True,
        )
        stdout, stderr = result.output or (None, None)
        return {
            "exit_code": result.exit_code,
            "stdout": _decode_tail(stdout),
            "stderr": _decode_tail(stderr),
        }
    except (DockerException, ValueError) as exc:
        return {"error": str(exc)}


@mcp.tool()
def sandbox_write_file(sandbox_id: str, path: str, content: str) -> dict[str, Any]:
    """Write UTF-8 text to a relative path inside /workspace in a managed sandbox."""
    normalized_path = path.replace("\\", "/")
    relative = PurePosixPath(normalized_path)
    if (
        not normalized_path
        or "\x00" in normalized_path
        or relative.is_absolute()
        or relative == PurePosixPath(".")
        or ".." in relative.parts
    ):
        return {"error": "path must be a non-empty relative path inside /workspace."}

    payload = content.encode("utf-8")
    if len(payload) > _MAX_FILE_BYTES:
        return {"error": f"File exceeds the {_MAX_FILE_BYTES}-byte limit."}

    try:
        container = _get_sandbox(sandbox_id)
        encoded = base64.b64encode(payload).decode("ascii")
        writer_script = "\n".join(
            [
                "import base64, pathlib, sys",
                "root = pathlib.Path('/workspace').resolve()",
                "target = (root / sys.argv[1]).resolve()",
                "if target == root or root not in target.parents:",
                "    raise SystemExit('path must stay within /workspace')",
                "target.parent.mkdir(parents=True, exist_ok=True)",
                "target.write_bytes(base64.b64decode(sys.argv[2], validate=True))",
            ]
        )
        result = container.exec_run(
            ["python", "-c", writer_script, relative.as_posix(), encoded],
            demux=True,
            workdir="/workspace",
        )
        stdout, stderr = result.output or (None, None)
        if result.exit_code != 0:
            return {
                "error": _decode_tail(stderr) or "Could not write file.",
                "exit_code": result.exit_code,
            }
        return {
            "path": relative.as_posix(),
            "bytes_written": len(payload),
            "status": "written",
        }
    except (DockerException, ValueError) as exc:
        return {"error": str(exc)}


@mcp.tool()
def sandbox_read_file(sandbox_id: str, path: str) -> dict[str, Any]:
    """Read a UTF-8 text file from a relative path inside /workspace (up to 64 KB)."""
    normalized_path = path.replace("\\", "/")
    relative = PurePosixPath(normalized_path)
    if (
        not normalized_path
        or "\x00" in normalized_path
        or relative.is_absolute()
        or relative == PurePosixPath(".")
        or ".." in relative.parts
    ):
        return {"error": "path must be a non-empty relative path inside /workspace."}

    try:
        container = _get_sandbox(sandbox_id)
        reader_script = "\n".join(
            [
                "import pathlib, sys",
                "root = pathlib.Path('/workspace').resolve()",
                "target = (root / sys.argv[1]).resolve()",
                "if target == root or root not in target.parents:",
                "    raise SystemExit('path must stay within /workspace')",
                "if not target.is_file():",
                "    raise SystemExit('file does not exist')",
                "data = target.read_bytes()",
                f"if len(data) > {_MAX_READ_BYTES}:",
                f"    raise SystemExit('file exceeds the {_MAX_READ_BYTES}-byte read limit')",
                "sys.stdout.buffer.write(data)",
            ]
        )
        result = container.exec_run(
            ["python", "-c", reader_script, relative.as_posix()],
            demux=True,
            workdir="/workspace",
        )
        stdout, stderr = result.output or (None, None)
        if result.exit_code != 0:
            return {"error": _decode_tail(stderr) or "Could not read file.", "exit_code": result.exit_code}
        content = (stdout or b"").decode("utf-8", errors="replace")[:_MAX_READ_BYTES]
        return {"path": relative.as_posix(), "content": content}
    except (DockerException, ValueError) as exc:
        return {"error": str(exc)}


@mcp.tool()
def sandbox_start_service(
    sandbox_id: str,
    command: str,
    port: int,
    timeout: int = 30,
) -> dict[str, Any]:
    """Start a background service in a sandbox and wait for its port inside that container."""
    if not 1 <= port <= 65535:
        return {"error": "port must be between 1 and 65535."}
    if not 1 <= timeout <= _MAX_SERVICE_WAIT:
        return {"error": f"timeout must be between 1 and {_MAX_SERVICE_WAIT} seconds."}

    try:
        container = _get_sandbox(sandbox_id)
        launch = (
            f"nohup bash -lc {shlex.quote(command)} "
            f">/tmp/dryrun-service-{port}.log 2>&1 </dev/null & echo $!"
        )
        launched = container.exec_run(
            ["bash", "-lc", launch],
            demux=True,
            workdir="/workspace",
        )
        launch_stdout, launch_stderr = launched.output or (None, None)
        if launched.exit_code != 0:
            return {"error": _decode_tail(launch_stderr) or "Could not start service."}
        pid = _decode_tail(launch_stdout).strip().splitlines()[-1:]
        if not pid:
            return {"error": "Service command did not return a process ID."}

        probe_script = "\n".join(
            [
                "import socket, sys",
                "sock = socket.socket()",
                "sock.settimeout(1)",
                "try:",
                "    sock.connect(('127.0.0.1', int(sys.argv[1])))",
                "except OSError:",
                "    sys.exit(1)",
                "finally:",
                "    sock.close()",
            ]
        )
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            probe = container.exec_run(
                ["python", "-c", probe_script, str(port)],
                demux=True,
                workdir="/workspace",
            )
            if probe.exit_code == 0:
                return {
                    "sandbox_id": sandbox_id,
                    "pid": pid[0],
                    "port": port,
                    "ready": True,
                    "address": f"127.0.0.1:{port} (inside sandbox)",
                }
            time.sleep(1)

        logs = container.exec_run(
            ["bash", "-lc", f"tail -c {_OUTPUT_LIMIT} /tmp/dryrun-service-{port}.log 2>/dev/null || true"],
            demux=True,
            workdir="/workspace",
        )
        log_out, log_err = logs.output or (None, None)
        return {
            "sandbox_id": sandbox_id,
            "pid": pid[0],
            "port": port,
            "ready": False,
            "logs": _decode_tail(log_out) or _decode_tail(log_err),
        }
    except (DockerException, ValueError) as exc:
        return {"error": str(exc)}


@mcp.tool()
def destroy_sandbox(sandbox_id: str) -> dict[str, str]:
    """Force-remove a sandbox created by this server and forget its ID."""
    container = _sandboxes.pop(sandbox_id, None)
    if container is None:
        return {"error": "Unknown sandbox_id. This server can only destroy its own sandboxes."}
    try:
        container.remove(force=True)
        return {"sandbox_id": sandbox_id, "status": "destroyed"}
    except NotFound:
        return {"sandbox_id": sandbox_id, "status": "already removed"}
    except DockerException as exc:
        # Keep it tracked so destroy_sandbox can be retried after a transient error.
        _sandboxes[sandbox_id] = container
        return {"error": f"Could not destroy sandbox: {exc}"}


if __name__ == "__main__":
    mcp.run()
