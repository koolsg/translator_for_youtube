import re
import math
from typing import Optional, List
from core.constants import SUPPORTED_LANGUAGES, INITIAL_RETRY_DELAY, BACKOFF_FACTOR, MAX_RETRY_DELAY

try:
    from google import genai
    _HAS_GENAI = True
except ImportError:
    _HAS_GENAI = False
    genai = None

def _parse_retry_after_seconds(message: str) -> Optional[int]:
    retry_patterns = [
        r"retry in\s+(\d+(?:\.\d+)?)s",
        r"retry_delay[^\d]*(\d+)",
        r"retry-after[^\d]*(\d+)",
    ]
    lowered = message.lower()
    for pattern in retry_patterns:
        match = re.search(pattern, lowered)
        if match:
            try:
                seconds_str = match.group(1)
                seconds_value = float(seconds_str)
                return max(1, int(math.ceil(seconds_value)))
            except (ValueError, TypeError):
                continue
    return None

def _extract_retry_after_seconds(error: Exception) -> Optional[int]:
    if _HAS_GENAI and hasattr(genai, "errors") and isinstance(error, genai.errors.ClientError):
        pass
    return _parse_retry_after_seconds(str(error))

def _is_gemini_rate_limit_error(error: Exception) -> bool:
    if _HAS_GENAI and hasattr(genai, "errors") and isinstance(error, genai.errors.ClientError):
        if error.code == 429:
            return True
    message = str(error).lower()
    keywords = ("quota exceeded", "rate limit", "too many requests", "429", "resource exhausted")
    return any(keyword in message for keyword in keywords)

def _build_gemini_rate_limit_message(retry_after: Optional[int]) -> str:
    base_message = (
        "Gemini API 무료 사용량이 초과되어 번역을 진행할 수 없습니다. "
        "잠시 후 다시 시도하거나 Google AI Studio에서 요금제와 사용량을 확인해주세요."
    )
    if retry_after:
        return f"{base_message} (약 {retry_after}초 후 재시도 가능)"
    return base_message

def calculate_retry_delay(attempt: int) -> float:
    delay = INITIAL_RETRY_DELAY * (BACKOFF_FACTOR**attempt)
    return min(delay, MAX_RETRY_DELAY)

def is_retryable_error(error: Exception) -> bool:
    from core.exceptions import (
        NetworkError, APIError, RateLimitError, ServiceUnavailableError,
    )
    retryable_types = (
        NetworkError, APIError, RateLimitError, ServiceUnavailableError,
        ConnectionError, TimeoutError, OSError,
    )
    if isinstance(error, retryable_types):
        return True
    retryable_messages = [
        "timeout", "connection", "network", "temporary", "rate limit",
        "too many requests", "service unavailable", "internal server error",
        "bad gateway", "gateway timeout", "decode error", "parsing message", "rst_stream",
    ]
    error_msg = str(error).lower()
    return any(msg in error_msg for msg in retryable_messages)

def validate_language_code(language_code: str) -> bool:
    return language_code in SUPPORTED_LANGUAGES

def get_language_name(language_code: str) -> str:
    return SUPPORTED_LANGUAGES.get(language_code, language_code)

def get_popular_languages() -> List[str]:
    return ["ko", "en", "ja", "zh", "es", "fr", "de", "ru", "pt", "it"]

def get_language_options_html() -> str:
    options = []
    popular_langs = get_popular_languages()
    for lang_code in popular_langs:
        lang_name = get_language_name(lang_code)
        selected = " selected" if lang_code == "ko" else ""
        options.append(f'            <option value="{lang_code}"{selected}>{lang_name}</option>')
    return "\n".join(options)
