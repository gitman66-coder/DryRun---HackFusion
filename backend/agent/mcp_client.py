from __future__ import annotations

import asyncio
import os
import sys
from contextlib import AsyncExitStack, asynccontextmanager
from pathlib import Path
from typing import AsyncIterator

from langchain_core.tools import BaseTool
from langchain_mcp_adapters.client import MultiServerMCPClient
from langchain_mcp_adapters.tools import load_mcp_tools

PROJECT_ROOT = Path(__file__).resolve().parents[2]
SERVER_FILES = {
    "sandbox": PROJECT_ROOT / "backend" / "mcp_servers" / "sandbox_server.py",
    "system": PROJECT_ROOT / "backend" / "mcp_servers" / "system_server.py",
    "host": PROJECT_ROOT / "backend" / "mcp_servers" / "host_server.py",
}


def _server_connections() -> dict[str, dict[str, object]]:
    """Build stdio launch settings for all local MCP servers."""
    safe_env_names = {
        "PATH", "SYSTEMROOT", "SYSTEMDRIVE", "WINDIR", "COMSPEC", "PATHEXT",
        "TEMP", "TMP", "USERPROFILE", "APPDATA", "LOCALAPPDATA", "HOME", "LANG",
        "DOCKER_HOST", "DOCKER_CERT_PATH", "DOCKER_TLS_VERIFY",
    }
    child_env = {key: value for key, value in os.environ.items() if key.upper() in safe_env_names}
    existing_pythonpath = child_env.get("PYTHONPATH")
    child_env["PYTHONPATH"] = (
        str(PROJECT_ROOT)
        if not existing_pythonpath
        else str(PROJECT_ROOT) + os.pathsep + existing_pythonpath
    )

    return {
        name: {
            "transport": "stdio",
            "command": sys.executable,
            "args": [str(server_file)],
            "cwd": str(PROJECT_ROOT),
            "env": child_env,
        }
        for name, server_file in SERVER_FILES.items()
    }


@asynccontextmanager
async def connected_mcp_tools() -> AsyncIterator[list[BaseTool]]:
    """Connect to all MCP servers and keep their sessions alive while tools are used."""
    client = MultiServerMCPClient(_server_connections())
    async with AsyncExitStack() as stack:
        tools: list[BaseTool] = []
        for server_name in SERVER_FILES:
            session = await stack.enter_async_context(client.session(server_name))
            tools.extend(await load_mcp_tools(session))
        yield tools


async def main() -> None:
    """Smoke-check that each server starts and exposes its tools to LangChain."""
    async with connected_mcp_tools() as tools:
        print(f"Connected to {len(SERVER_FILES)} MCP servers; discovered {len(tools)} tools:")
        for tool in tools:
            print(f"- {tool.name}: {tool.description.splitlines()[0] if tool.description else ''}")


if __name__ == "__main__":
    asyncio.run(main())

