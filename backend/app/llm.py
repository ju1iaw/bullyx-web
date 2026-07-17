from __future__ import annotations

import os
from typing import TypeVar

from pydantic import BaseModel


T = TypeVar("T", bound=BaseModel)


class LLMError(RuntimeError):
    pass


def provider_name() -> str:
    if not os.getenv("OPENAI_API_KEY", "").strip():
        return "deterministic-mock"
    return f"openai:{os.getenv('OPENAI_MODEL', 'gpt-5.6-luna')}"


def complete(
    prompt: str,
    response_model: type[T],
    mock_response: dict,
    *,
    schema_name: str = "bullyx_structured_output",
    operation: str = "Structured completion",
) -> T:
    """Return a validated structured completion from OpenAI or the offline mock."""

    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    if not api_key:
        return response_model.model_validate(mock_response)

    model = os.getenv("OPENAI_MODEL", "gpt-5.6-luna").strip()
    try:
        from openai import OpenAI

        response = OpenAI(api_key=api_key).responses.create(
            model=model,
            input=prompt,
            text={
                "format": {
                    "type": "json_schema",
                    "name": schema_name,
                    "strict": True,
                    "schema": response_model.model_json_schema(),
                }
            },
        )
        if not response.output_text:
            raise LLMError("The model returned no structured output.")
        return response_model.model_validate_json(response.output_text)
    except LLMError:
        raise
    except Exception as exc:  # SDK and transport exceptions stay behind this boundary.
        raise LLMError(f"{operation} failed through {model}: {exc}") from exc
