"""Application configuration loaded from environment variables."""
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file="../.env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Postgres
    database_url: str = "postgresql+psycopg://communityshield:devpassword@localhost:5432/communityshield_dev"

    # App
    environment: str = "development"
    log_level: str = "INFO"
    secret_key: str = "change-me-in-prod"
    backend_host: str = "0.0.0.0"
    backend_port: int = 8000
    cors_origins: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]


@lru_cache
def get_settings() -> Settings:
    return Settings()
