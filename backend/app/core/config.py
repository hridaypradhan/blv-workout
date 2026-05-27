"""Configuration settings for the FitA11y backend."""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Environment-backed application settings for external services and URLs."""

    GEMINI_API_KEY: str = ""
    DATABASE_URL: str = ""
    YOUTUBE_API_KEY: str = ""
    FRONTEND_URL: str = "http://localhost:3000"

    # F1.1: Directory for downloaded video/audio imports
    IMPORT_DIR: str = "storage/imports"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


settings = Settings()
