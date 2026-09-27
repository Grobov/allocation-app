"""Application configuration loaded from environment variables (and an optional .env file)."""

from datetime import date, datetime
from functools import lru_cache
from pathlib import Path
from typing import Annotated
from zoneinfo import ZoneInfo

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=BACKEND_DIR / ".env", env_file_encoding="utf-8", extra="ignore"
    )

    database_url: str = Field(
        default=f"sqlite:///{BACKEND_DIR / 'qa_allocation.db'}",
        description="SQLAlchemy database URL (PostgreSQL recommended, SQLite supported).",
    )
    cors_origins: Annotated[list[str], NoDecode] = Field(
        default_factory=lambda: ["http://localhost:5173", "http://127.0.0.1:5173"],
        description="Comma-separated list of origins allowed to call the API from a browser.",
    )
    timezone: str | None = Field(
        default=None,
        description="IANA timezone used to determine 'today' for allocation status. "
        "Defaults to the server's local timezone.",
    )
    frontend_dist: Path | None = Field(
        default=None,
        description="Optional path to the built frontend; when set the API also serves the SPA.",
    )
    sql_echo: bool = False

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _split_origins(cls, value: object) -> object:
        # NoDecode keeps the raw env string; accept a comma-separated list.
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value

    def today(self) -> date:
        if self.timezone:
            return datetime.now(ZoneInfo(self.timezone)).date()
        return date.today()


@lru_cache
def get_settings() -> Settings:
    return Settings()
