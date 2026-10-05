from __future__ import annotations

import re

from pydantic import BaseModel, ConfigDict, Field, field_validator


# Keep this wire schema to a portable JSON Schema subset. The stricter
# Pydantic models below validate the returned data locally after generation.
PLAN_OUTPUT_SCHEMA = {
    "title": "DryrunProjectPlan",
    "description": "Evidence-based repository setup checks to run only in a disposable Docker sandbox.",
    "type": "object",
    "properties": {
        "summary": {"type": "string", "description": "Evidence-based plan summary."},
        "detected_stack": {"type": "array", "items": {"type": "string"}},
        "rehearsal_steps": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "description": {"type": "string"},
                    "command": {"type": "string", "description": "Command for the Docker sandbox only."},
                    "timeout_seconds": {"type": "integer"},
                },
                "required": ["description", "command"],
                "additionalProperties": False,
            },
        },
    },
    "required": ["summary", "detected_stack", "rehearsal_steps"],
    "additionalProperties": False,
}

class RehearsalStep(BaseModel):
    """A command that may run only inside the disposable Docker rehearsal sandbox."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    description: str = Field(min_length=1, max_length=300)
    command: str = Field(min_length=1, max_length=1200)
    timeout_seconds: int = Field(default=120, ge=1, le=180)

    @field_validator("command")
    @classmethod
    def reject_unsafe_command_patterns(cls, command: str) -> str:
        blocked = (
            r"\bsudo\b",
            r"\brm\s+-[^\n]*r[^\n]*f",
            r"\bmkfs(?:\.[a-z0-9]+)?\b",
            r"\bdd\s+if=",
            r"\bchmod\s+777\b",
            r"\b(?:apt|apt-get|apk|dnf|yum)\s+install\b",
            r"\b(?:curl|wget)\b[^\n|]*\|\s*(?:sudo\s+)?(?:ba)?sh\b",
        )
        if "\n" in command or any(re.search(pattern, command, re.IGNORECASE) for pattern in blocked):
            raise ValueError("Command contains a blocked pattern or multiple lines; revise the sandbox plan.")
        return command


class ProjectPlan(BaseModel):
    """Evidence-based plan made only of checks for the disposable sandbox."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    summary: str = Field(min_length=1, max_length=1000)
    detected_stack: list[str] = Field(default_factory=list, max_length=20)
    rehearsal_steps: list[RehearsalStep] = Field(default_factory=list, max_length=8)
