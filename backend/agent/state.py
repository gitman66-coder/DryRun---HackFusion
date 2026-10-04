from __future__ import annotations

from typing import Any, Literal, TypedDict

RunStatus = Literal[
    "pending",
    "analyzing",
    "planned",
    "awaiting_approval",
    "approved",
    "executing",
    "completed",
    "rejected",
    "failed",
]

ActionKind = Literal[
    "create_venv",
    "pip_install",
    "npm_install",
    "write_file",
    "run_service",
    "write_secret",
    "system_package",
]


class RunState(TypedDict, total=False):
    """Shared data passed from one LangGraph node to the next for a single run."""

    run_id: str
    sandbox_id: str
    repo_url: str
    user_request: str
    status: RunStatus
    repository_facts: dict[str, Any]
    plan: dict[str, Any]
    approval: Literal["approved", "rejected"] | None
    results: list[dict[str, Any]]
    error: str | None


