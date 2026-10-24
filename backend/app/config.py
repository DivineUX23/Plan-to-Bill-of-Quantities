"""Application settings, loaded from environment variables (and an optional .env file)."""

from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "PlanToBOQ API"
    environment: str = "development"

    # Database. Render supplies `postgres://...`; we normalise it for SQLAlchemy + psycopg3.
    database_url: str = "sqlite:///./plantoboq.db"

    # Comma-separated list of allowed origins, e.g. "https://plantoboq.vercel.app,http://localhost:5173"
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    # Optional regex for preview and production deployments, e.g. any Vercel domain
    cors_origin_regex: str | None = r"^https:\/\/.*\.vercel\.app$"

    max_upload_mb: int = 40
    # Longest side (px) of rendered sheet images. Keeps canvases light in the browser.
    render_max_px: int = 4200
    render_max_dpi: int = 200

    # Optional AI vision detection (off by default).
    ai_vision_enabled: bool = False
    ai_vision_provider: str = "gemini"  # "gemini" | "openai"
    gemini_api_key: str | None = None
    gemini_model: str = "gemini-2.5-flash"
    openai_api_key: str | None = None
    openai_model: str = "gpt-4o"

    @field_validator("database_url")
    @classmethod
    def _normalise_db_url(cls, v: str) -> str:
        if v.startswith("postgres://"):
            v = "postgresql+psycopg://" + v[len("postgres://") :]
        elif v.startswith("postgresql://"):
            v = "postgresql+psycopg://" + v[len("postgresql://") :]
        return v

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
