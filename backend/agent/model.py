from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv
from langchain_groq import ChatGroq

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_MODEL = "openai/gpt-oss-20b"


def get_chat_model() -> ChatGroq:
    """Create the configured Groq chat model without printing or logging its key."""
    load_dotenv(PROJECT_ROOT / ".env")
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise RuntimeError(
            "Groq API key is missing. Add GROQ_API_KEY to the local project-root .env file."
        )

    return ChatGroq(
        model=os.getenv("DRYRUN_MODEL", DEFAULT_MODEL),
        api_key=api_key,
        temperature=0,
        max_retries=2,
    )
