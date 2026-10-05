from __future__ import annotations

from typing import Any, Literal, TypedDict

RunStatus = Literal[
    "pending",
    "analyzing",
    "planned",
    "completed",
    "failed",
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
    rehearsal_results: list[dict[str, Any]]
    feasibility: dict[str, Any]
    risk_assessment: dict[str, Any]
    error: str | None


