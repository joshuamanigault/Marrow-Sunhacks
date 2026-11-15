from functools import lru_cache
from pathlib import Path

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# backend/ → repo root → data/prepared
_DEFAULT_ASSETS = Path(__file__).resolve().parents[3] / "data" / "prepared"


class Settings(BaseSettings):
    """Server-side configuration. Blank optional credentials are fine at startup."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    host: str = "127.0.0.1"
    port: int = 8000
    cors_origins: list[str] = Field(
        default_factory=lambda: ["http://127.0.0.1:5173", "http://localhost:5173"]
    )

    assets_dir: Path = Field(default_factory=lambda: _DEFAULT_ASSETS)
    upload_bucket: str | None = None
    upload_worker: bool = False

    database_url: str | None = None
    gemini_api_key: str | None = None
    gemini_model: str | None = None

    @field_validator("assets_dir", mode="before")
    @classmethod
    def _expand_assets_dir(cls, value: object) -> Path:
        if value is None or value == "":
            return _DEFAULT_ASSETS
        return Path(str(value)).expanduser().resolve()


@lru_cache
def get_settings() -> Settings:
    return Settings()
