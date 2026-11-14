"""Thin Gemini wrapper. The key stays on the server (spec §4)."""

from __future__ import annotations

from functools import lru_cache
from typing import Protocol, TypeVar

from pydantic import BaseModel

from marrow.settings import get_settings

#: Used when GEMINI_MODEL is not set. Cheap and fast; answers here are short.
DEFAULT_MODEL = "gemini-3.5-flash-lite"

T = TypeVar("T", bound=BaseModel)


class JsonLLM(Protocol):
    model: str

    def generate(self, *, system: str, prompt: str, schema: type[T]) -> T: ...


class GeminiLLM:
    def __init__(self, api_key: str, model: str) -> None:
        from google import genai  # imported lazily so the API starts without it in use

        self._client = genai.Client(api_key=api_key)
        self.model = model

    def generate(self, *, system: str, prompt: str, schema: type[T]) -> T:
        from google.genai import types

        response = self._client.models.generate_content(
            model=self.model,
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=system,
                response_mime_type="application/json",
                response_schema=schema,
                temperature=0.2,
            ),
        )
        parsed = response.parsed
        if isinstance(parsed, schema):
            return parsed
        return schema.model_validate_json(response.text or "")


@lru_cache
def get_llm() -> JsonLLM | None:
    """None when no key is configured; the AI routes then answer 503."""
    settings = get_settings()
    if not settings.gemini_api_key:
        return None
    return GeminiLLM(settings.gemini_api_key, settings.gemini_model or DEFAULT_MODEL)
