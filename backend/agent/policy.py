from __future__ import annotations

from pathlib import Path, PurePosixPath
from uuid import UUID

WORKSPACE_ROOT = Path.home() / "dryrun-workspaces"

RISK_BY_ACTION = {
    "create_venv": "low",
    "pip_install": "low",
    "npm_install": "low",
    "write_file": "low",
    "run_service": "medium",
    "write_secret": "medium",
    "system_package": "high",
}
MANUAL_ONLY_ACTIONS = {"system_package"}


def canonical_run_id(run_id: str) -> str:
    """Accept only UUID run IDs so caller input cannot choose a filesystem path."""
    try:
        return str(UUID(run_id))
    except (ValueError, TypeError, AttributeError) as exc:
        raise ValueError("run_id must be a valid UUID.") from exc


def workspace_for_run(run_id: str) -> Path:
    """Return one run directory under the fixed Dryrun workspace root."""
    safe_id = canonical_run_id(run_id)
    root = WORKSPACE_ROOT.resolve()
    workspace = (root / safe_id).resolve()
    if workspace.parent != root:
        raise ValueError("Run workspace escaped the configured workspace root.")
    return workspace


def resolve_workspace_path(run_id: str, relative_path: str) -> Path:
    """Resolve a user path while rejecting absolute paths and traversal outside the run directory."""
    workspace = workspace_for_run(run_id)
    normalized = relative_path.replace("\\", "/")
    candidate = PurePosixPath(normalized)
    if (
        not normalized
        or "\x00" in normalized
        or ":" in normalized
        or candidate.is_absolute()
        or candidate == PurePosixPath(".")
        or ".." in candidate.parts
    ):
        raise ValueError("path must be a non-empty relative path inside the run workspace.")

    target = (workspace / Path(*candidate.parts)).resolve()
    if target == workspace or workspace not in target.parents:
        raise ValueError("path resolves outside the run workspace.")
    return target


def policy_decision(action_kind: str, run_id: str, approved: bool) -> dict[str, object]:
    """Apply the code-based host action policy; high-risk system installs stay manual."""
    risk = RISK_BY_ACTION.get(action_kind)
    if risk is None:
        return {
            "allowed": False,
            "risk": "high",
            "reason": f"Unrecognized action kind: {action_kind}",
        }

    try:
        workspace = workspace_for_run(run_id)
    except ValueError as exc:
        return {"allowed": False, "risk": risk, "reason": str(exc)}

    if action_kind in MANUAL_ONLY_ACTIONS:
        return {
            "allowed": False,
            "risk": risk,
            "manual_step_required": True,
            "reason": "Operating-system package installs are never run automatically.",
        }

    if approved is not True:
        return {
            "allowed": False,
            "risk": risk,
            "approval_required": True,
            "reason": "Host action is blocked until the user approves the verified plan.",
        }

    return {
        "allowed": True,
        "risk": risk,
        "workspace": str(workspace),
        "reason": "Action is recognized, contained to this run workspace, and approved.",
    }
