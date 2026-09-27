"""OpenAPI documentation for the common error responses."""

from typing import Any

from pydantic import BaseModel


class ErrorDetail(BaseModel):
    code: str
    message: str
    fields: dict[str, str] | None = None


class ErrorResponse(BaseModel):
    error: ErrorDetail


def responses(*codes: int) -> dict[int | str, dict[str, Any]]:
    descriptions = {
        404: "Resource not found",
        409: "Conflict with the current state (duplicate name, blocked deletion, ...)",
        422: "Validation error",
    }
    return {code: {"model": ErrorResponse, "description": descriptions[code]} for code in codes}
