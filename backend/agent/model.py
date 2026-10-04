from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv
from langchain_google_genai import ChatGoogleGenerativeAI

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_MODEL = "gemini-3.8-flash"


def get_chat_model() -> ChatGoogleGenerativeAI:
    """Create the configured Gemini chat model without printing or logging its key."""
    load_dotenv(PROJECT_ROOT / ".env")
    api_key = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY") or os.getenv("API_KEY")
    if not api_key:
        raise RuntimeError(
            "Gemini API key is missing. Add GOOGLE_API_KEY, GEMINI_API_KEY, or API_KEY to the local .env file."
        )

    return ChatGoogleGenerativeAI(
        model=os.getenv("DRYRUN_MODEL", DEFAULT_MODEL),
        api_key=api_key,
        temperature=0,
    )

