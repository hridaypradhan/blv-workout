"""Configuration settings for the FitA11y backend."""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Environment-backed application settings for external services and URLs."""

    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-3.5-flash"
    AI_PROVIDER: str = "prototype"
    AI_DIAGNOSTICS_ENABLED: bool = False
    YOUTUBE_API_KEY: str = ""
    FRONTEND_URL: str = "http://localhost:3000"

    # Transient directory for analysis-only artifacts (audio extracts for
    # Whisper/Gemini processing). These are NOT used for playback — the
    # user watches the original YouTube video via the embedded IFrame player.
    TRANSIENT_ANALYSIS_DIR: str = "storage/transient_analysis"

    # Local JSON-backed persistence settings for the prototype
    PROTOTYPE_PERSISTENCE_ENABLED: bool = True
    PROTOTYPE_DATA_DIR: str = ".prototype_data"

    # Storage Architecture Configuration
    STORAGE_PROVIDER: str = "local_json"
    AWS_PROFILE: str = ""
    AWS_REGION: str = "us-east-2"
    DYNAMODB_USERS_TABLE: str = "FitA11y-dev-Users"
    DYNAMODB_JOBS_TABLE: str = "FitA11y-dev-Jobs"
    DYNAMODB_SESSIONS_TABLE: str = "FitA11y-dev-Sessions"
    DYNAMODB_SESSION_EVENTS_TABLE: str = "FitA11y-dev-SessionEvents"
    ARTIFACTS_BUCKET: str = "fita11y-dev-artifacts-905418181041"

    # bHaptics configuration
    BHAPTICS_ENABLED: bool = False
    BHAPTICS_APP_ID: str = ""
    BHAPTICS_API_KEY: str = ""
    BHAPTICS_PROVIDER: str = "auto"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


settings = Settings()

