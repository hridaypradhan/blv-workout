import sys
from app.core.config import settings
from app.services.haptics.base import BaseHapticsProvider
from app.services.haptics.dry_run_provider import DryRunHapticsProvider

# Lazy loaded singleton provider
_provider_instance: BaseHapticsProvider | None = None


def get_haptics_provider() -> BaseHapticsProvider:
    """Gets the active haptic provider singleton based on configuration."""
    global _provider_instance
    if _provider_instance is not None:
        return _provider_instance

    enabled = settings.BHAPTICS_ENABLED
    app_id = settings.BHAPTICS_APP_ID
    api_key = settings.BHAPTICS_API_KEY
    provider_type = settings.BHAPTICS_PROVIDER  # auto | bhaptics | dry_run

    # If explicitly configured for dry_run
    if provider_type == "dry_run":
        _provider_instance = DryRunHapticsProvider(status="disabled")
        return _provider_instance

    # If enabled & configured, check system compat
    if provider_type in ("auto", "bhaptics"):
        if not enabled:
            _provider_instance = DryRunHapticsProvider(status="disabled")
            return _provider_instance
        if not app_id or not api_key:
            _provider_instance = DryRunHapticsProvider(status="not_configured")
            return _provider_instance

        from app.services.haptics.bhaptics_provider import BHapticsProvider
        _provider_instance = BHapticsProvider(app_id, api_key)

    # Fallback/default
    if _provider_instance is None:
        _provider_instance = DryRunHapticsProvider(status="disabled")

    return _provider_instance


def reset_haptics_provider():
    """Resets the singleton provider instance, useful on refresh config changes."""
    global _provider_instance
    _provider_instance = None
