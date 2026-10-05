from __future__ import annotations

from uuid import UUID


def canonical_run_id(run_id: str) -> str:
    """Accept only UUID run IDs; callers cannot select a filesystem path."""
    try:
        return str(UUID(run_id))
    except (ValueError, TypeError, AttributeError) as exc:
        raise ValueError("run_id must be a valid UUID.") from exc
