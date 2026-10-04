from __future__ import annotations

import os
import platform
import shutil
import socket
import subprocess
from pathlib import Path
from typing import Any

try:
    from mcp.server.mcpserver import MCPServer as FastMCP
except ImportError:
    from mcp.server.fastmcp import FastMCP

mcp = FastMCP("dryrun-system")


def _validate_port(port: int) -> None:
    if not 1 <= port <= 65535:
        raise ValueError("port must be between 1 and 65535.")


def _is_port_free(port: int) -> bool:
    """Check whether this host can bind the IPv4 loopback port right now."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        try:
            sock.bind(("127.0.0.1", port))
            return True
        except OSError:
            return False


def _node_version() -> str | None:
    node = shutil.which("node")
    if node is None:
        return None
    try:
        result = subprocess.run(
            [node, "--version"],
            capture_output=True,
            text=True,
            timeout=5,
            check=False,
        )
    except (OSError, subprocess.TimeoutExpired):
        return None
    if result.returncode != 0:
        return None
    return result.stdout.strip() or None


@mcp.tool()
def get_host_info() -> dict[str, Any]:
    """Return read-only facts about the host OS, Python, Node.js, CPU count, and free disk space."""
    try:
        free_disk_bytes = shutil.disk_usage(Path.home()).free
    except OSError:
        free_disk_bytes = None

    return {
        "os": platform.system(),
        "os_release": platform.release(),
        "architecture": platform.machine(),
        "python_version": platform.python_version(),
        "node_version": _node_version(),
        "cpu_count": os.cpu_count(),
        "free_disk_gb": round(free_disk_bytes / (1024**3), 2) if free_disk_bytes is not None else None,
    }


@mcp.tool()
def check_port(port: int) -> dict[str, Any]:
    """Report whether a TCP port can be bound on host loopback (127.0.0.1). This does not reserve it."""
    try:
        _validate_port(port)
        return {
            "port": port,
            "host": "127.0.0.1",
            "free": _is_port_free(port),
        }
    except ValueError as exc:
        return {"error": str(exc)}


@mcp.tool()
def suggest_free_port(preferred: int = 8000, max_checks: int = 50) -> dict[str, Any]:
    """Find an apparently free TCP port by checking preferred and nearby higher ports; it does not reserve the port."""
    try:
        _validate_port(preferred)
    except ValueError as exc:
        return {"error": str(exc)}
    if not 1 <= max_checks <= 200:
        return {"error": "max_checks must be between 1 and 200."}

    for offset in range(max_checks):
        candidate = preferred + offset
        if candidate > 65535:
            candidate = 1024 + (candidate - 65536)
        if _is_port_free(candidate):
            return {
                "preferred_port": preferred,
                "suggested_port": candidate,
                "checks_performed": offset + 1,
            }

    return {
        "preferred_port": preferred,
        "error": f"No free port found in {max_checks} checks.",
    }


if __name__ == "__main__":
    mcp.run()
