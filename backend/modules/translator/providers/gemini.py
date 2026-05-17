import logging
import random
import asyncio
from typing import Dict, Any, List, Optional
from core.config import ConfigManager
from core.exceptions import APIKeyError, RateLimitError
from modules.translator.prompts import build_translation_prompt
from modules.translator.utils import (
    _HAS_GENAI, genai, _is_gemini_rate_limit_error,
    _extract_retry_after_seconds, _build_gemini_rate_limit_message,
    calculate_retry_delay, is_retryable_error, get_language_name
)
from core.constants import MAX_RETRIES

class GeminiTranslator:
    def __init__(self, config_manager: ConfigManager) -> None:
        self.config_manager = config_manager
        self.logger = logging.getLogger(__name__)
        self._clients: Dict[str, Any] = {}

    def _get_client(self, api_key: str) -> Any:
        if api_key not in self._clients:
            self._clients[api_key] = genai.Client(api_key=api_key)
        return self._clients[api_key]

    def validate_api_keys(self) -> List[str]:
        config = self.config_manager.get_config()
        api_keys = config.get("gemini", {}).get("api_keys", [])
        if not api_keys or not all(api_keys):
            raise APIKeyError("Gemini API 키가 설정되지 않았습니다.")
        return api_keys

    async def translate(self, text: str, model_name: str, target_language: str) -> str:
        if not _HAS_GENAI or genai is None:
            raise RuntimeError("google-generativeai 패키지가 설치되어 있지 않습니다.")
        api_keys = self.validate_api_keys()
        selected_key = random.choice(api_keys)

        for attempt in range(MAX_RETRIES):
            try:
                client = self._get_client(selected_key)
                prompt = build_translation_prompt(text, get_language_name(target_language), target_language)
                response = client.models.generate_content(model=model_name, contents=prompt)
                text_content = response.text
                return text_content.strip() if text_content else ""
            except Exception as e:
                if _is_gemini_rate_limit_error(e):
                    retry_after_seconds = _extract_retry_after_seconds(e)
                    user_message = _build_gemini_rate_limit_message(retry_after_seconds)
                    self.logger.warning("Gemini 할당량 초과 감지: model=%s retry_after=%s error=%s", model_name, retry_after_seconds, e)
                    raise RateLimitError(user_message, provider="gemini", retry_after=retry_after_seconds, details={"retry_after_seconds": retry_after_seconds, "model": model_name, "original_error": str(e)}) from e
                
                if attempt < MAX_RETRIES - 1:
                    if is_retryable_error(e):
                        delay = calculate_retry_delay(attempt)
                        self.logger.warning(f"Gemini 번역 시도 {attempt + 1} 실패: {e}. {delay}초 후 재시도합니다.")
                        await asyncio.sleep(delay)
                        continue
                    else:
                        raise
                self.logger.error(f"Gemini 번역 최종 실패: {e}")
                raise
        raise RuntimeError("Gemini 번역이 완료되지 않았습니다.")

    async def translate_stream(self, text: str, model_name: str, target_language: str):
        api_keys = self.validate_api_keys()
        selected_key = random.choice(api_keys)
        if not _HAS_GENAI or genai is None:
            raise RuntimeError("google-generativeai 패키지가 설치되어 있지 않습니다.")

        client = self._get_client(selected_key)
        prompt = build_translation_prompt(text, get_language_name(target_language), target_language)

        for attempt in range(MAX_RETRIES):
            has_yielded_content = False
            try:
                response_stream = await client.aio.models.generate_content_stream(model=model_name, contents=prompt)
                async for chunk in response_stream:
                    try:
                        text_content = chunk.text
                        if text_content:
                            yield text_content
                            has_yielded_content = True
                    except (ValueError, AttributeError):
                        pass

                if has_yielded_content:
                    return
                
                if not has_yielded_content:
                    self.logger.warning(f"모델 {model_name}에서 빈 응답을 받았습니다.")
                    return

            except Exception as e:
                if has_yielded_content:
                    self.logger.error(f"Gemini 스트리밍 중단 (복구 불가): {e}")
                    raise

                if _is_gemini_rate_limit_error(e):
                    retry_after_seconds = _extract_retry_after_seconds(e)
                    user_message = _build_gemini_rate_limit_message(retry_after_seconds)
                    self.logger.warning("Gemini 스트리밍 할당량 초과 감지: model=%s retry_after=%s error=%s", model_name, retry_after_seconds, e)
                    raise RateLimitError(user_message, provider="gemini", retry_after=retry_after_seconds, details={"retry_after_seconds": retry_after_seconds, "model": model_name, "original_error": str(e)}) from e

                if attempt < MAX_RETRIES - 1:
                    if is_retryable_error(e):
                        delay = calculate_retry_delay(attempt)
                        self.logger.warning(f"Gemini 스트리밍 시도 {attempt + 1} 실패 (전송 전): {e}. {delay}초 후 재시도합니다.")
                        await asyncio.sleep(delay)
                        continue
                    else:
                        raise

                self.logger.error(f"Gemini 스트리밍 최종 실패: {e}")
                raise
