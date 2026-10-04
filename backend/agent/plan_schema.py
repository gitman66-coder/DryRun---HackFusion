from __future__ import annotations

import re
from pathlib import PurePosixPath
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from backend.agent.state import ActionKind


# Keep this wire schema to a portable JSON Schema subset. The stricter
# Pydantic models below validate the returned data locally after generation.
PLAN_OUTPUT_SCHEMA = {
    "title": "DryrunProjectPlan",
    "description": "Evidence-based, approval-gated repository setup plan for Dryrun.",
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
        "host_actions": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "action_id": {"type": "string"},
                    "kind": {
                        "type": "string",
                        "enum": ["create_venv", "pip_install", "npm_install", "write_file", "run_service", "write_secret", "system_package"],
                    },
                    "description": {"type": "string"},
                    "packages": {"type": "array", "items": {"type": "string"}},
                    "relative_path": {"type": "string"},
                    "file_content": {"type": "string"},
                    "service_script": {
                        "type": "string",
                        "description": "Path to an existing Python script inside repo/, such as repo/server.py. Never put a launch command here.",
                    },
                    "port": {"type": "integer"},
                    "secret_key": {"type": "string"},
                },
                "required": ["action_id", "kind", "description"],
                "additionalProperties": False,
            },
        },
    },
    "required": ["summary", "detected_stack", "rehearsal_steps", "host_actions"],
    "additionalProperties": False,
}

class RehearsalStep(BaseModel):
    """A command that may run only inside the disposable Docker rehearsal sandbox."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    description: str = Field(min_length=1, max_length=300)
    command: str = Field(min_length=1, max_length=2000)
    timeout_seconds: int = Field(default=120, ge=1, le=600)


class HostAction(BaseModel):
    """A typed host change; never contains a free-form shell command or secret value."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    action_id: str = Field(pattern=r"^[a-zA-Z0-9_-]{1,40}$")
    kind: ActionKind
    description: str = Field(min_length=1, max_length=300)
    packages: list[str] = Field(default_factory=list, max_length=30)
    relative_path: str | None = Field(default=None, max_length=300)
    file_content: str | None = Field(default=None, max_length=262144)
    service_script: str | None = Field(default=None, max_length=300)
    port: int | None = Field(default=None, ge=1024, le=65535)
    secret_key: str | None = Field(default=None, pattern=r"^[A-Za-z_][A-Za-z0-9_]*$")
    requires_approval: bool = True

    @field_validator("packages")
    @classmethod
    def package_specs_must_be_plain_names(cls, packages: list[str]) -> list[str]:
        for package in packages:
            if (
                not package
                or package.startswith("-")
                or "://" in package
                or any(char.isspace() for char in package)
            ):
                raise ValueError("packages must be plain package names, not URLs or command options")
        return packages

    @field_validator("relative_path", "service_script")
    @classmethod
    def paths_must_be_relative(cls, path: str | None) -> str | None:
        if path is None:
            return None
        normalized = path.replace("\\", "/")
        pure = PurePosixPath(normalized)
        if (
            not normalized
            or "\x00" in normalized
            or ":" in normalized
            or pure.is_absolute()
            or ".." in pure.parts
            or pure == PurePosixPath(".")
        ):
            raise ValueError("path must stay inside the run workspace")
        return normalized

    @field_validator("file_content")
    @classmethod
    def file_content_byte_limit(cls, content: str | None) -> str | None:
        if content is not None and len(content.encode("utf-8")) > 256 * 1024:
            raise ValueError("file_content must not exceed 256 KB when encoded as UTF-8")
        return content

    @model_validator(mode="after")
    def validate_action_arguments(self) -> "HostAction":
        if not self.requires_approval:
            raise ValueError("host actions always require user approval")
        if self.kind in {"pip_install", "npm_install", "system_package"} and not self.packages:
            raise ValueError(f"{self.kind} requires at least one package")
        if self.kind == "write_file" and (self.relative_path is None or self.file_content is None):
            raise ValueError("write_file requires relative_path and file_content")
        if self.kind == "run_service" and (self.service_script is None or self.port is None):
            raise ValueError("run_service requires service_script and port")
        if self.kind == "write_secret" and self.secret_key is None:
            raise ValueError("write_secret requires secret_key; the secret value is collected separately")
        if self.kind == "create_venv" and any(
            (self.packages, self.relative_path, self.file_content, self.service_script, self.port, self.secret_key)
        ):
            raise ValueError("create_venv does not accept extra arguments")
        return self


class ProjectPlan(BaseModel):
    """Structured investigation result and proposed rehearsal/host actions."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    summary: str = Field(min_length=1, max_length=1000)
    detected_stack: list[str] = Field(default_factory=list, max_length=20)
    rehearsal_steps: list[RehearsalStep] = Field(default_factory=list, max_length=20)
    host_actions: list[HostAction] = Field(default_factory=list, max_length=20)
