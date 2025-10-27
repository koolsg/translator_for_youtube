"""
Custom exception classes for the Translation API Server.

These exceptions provide specific error categorization and improved error handling
throughout the application with detailed context and user-friendly messages.
"""

import time
from typing import Optional, Dict, Any


class TranslationAPIError(Exception):
    """Base exception class for all translation API errors.

    Provides a standardized way to handle and report errors with additional context.
    """

    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None) -> None:
        super().__init__(message)
        self.message = message
        self.details = details or {}
        self.timestamp = time.time()

    def to_dict(self) -> Dict[str, Any]:
        """예외 정보를 딕셔너리로 변환하여 JSON 응답에 사용합니다."""
        return {
            'error': self.__class__.__name__,
            'message': self.message,
            'timestamp': self.timestamp,
            'details': self.details
        }


class ConfigurationError(TranslationAPIError):
    """Raised when there's an issue with application configuration."""

    def __init__(self, message: str, config_key: Optional[str] = None, details: Optional[Dict[str, Any]] = None) -> None:
        super().__init__(message, details)
        self.config_key = config_key


class APIKeyError(ConfigurationError):
    """Raised when API key configuration is invalid or missing."""

    def __init__(self, message: str, provider: Optional[str] = None, details: Optional[Dict[str, Any]] = None) -> None:
        super().__init__(message, config_key='api_key', details=details)
        self.provider = provider


class NetworkError(TranslationAPIError):
    """Raised when network-related errors occur."""

    def __init__(self, message: str, url: Optional[str] = None, status_code: Optional[int] = None, details: Optional[Dict[str, Any]] = None) -> None:
        super().__init__(message, details)
        self.url = url
        self.status_code = status_code


class APIError(TranslationAPIError):
    """Raised when external API calls fail."""

    def __init__(self, message: str, provider: str, model: Optional[str] = None, details: Optional[Dict[str, Any]] = None) -> None:
        super().__init__(message, details)
        self.provider = provider
        self.model = model


class TranslationError(TranslationAPIError):
    """Raised when there's an error during text translation."""

    def __init__(self, message: str, model: Optional[str] = None, target_language: Optional[str] = None, details: Optional[Dict[str, Any]] = None) -> None:
        super().__init__(message, details)
        self.model = model
        self.target_language = target_language


class ValidationError(TranslationAPIError):
    """Raised when input validation fails."""

    def __init__(self, message: str, field: Optional[str] = None, value: Optional[str] = None, details: Optional[Dict[str, Any]] = None) -> None:
        super().__init__(message, details)
        self.field = field
        self.value = value


class RateLimitError(APIError):
    """Raised when API rate limits are exceeded."""

    def __init__(self, message: str, provider: str, retry_after: Optional[int] = None, details: Optional[Dict[str, Any]] = None) -> None:
        super().__init__(message, provider, details=details)
        self.retry_after = retry_after


class ServiceUnavailableError(TranslationAPIError):
    """Raised when external services are temporarily unavailable."""

    def __init__(self, message: str, service: str, details: Optional[Dict[str, Any]] = None) -> None:
        super().__init__(message, details)
        self.service = service
