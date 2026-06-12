"""Shared exception classes for AI service providers."""

class AIProviderError(Exception):
    """Base exception for all AI provider operations."""
    pass


class AIProviderAPIError(AIProviderError):
    """Raised when the AI model provider API call fails."""
    pass


class AIProviderResponseParseError(AIProviderError):
    """Raised when parsing the AI provider response payload (e.g. JSON parsing) fails."""
    pass


class AIProviderSchemaConversionError(AIProviderError):
    """Raised when converting provider-specific structures into canonical formats fails."""
    pass
