import logging
import asyncio
from typing import Any
from core.config import ConfigManager
from core.exceptions import APIKeyError
from modules.translator.prompts import build_openai_system_prompt
from modules.translator.utils import calculate_retry_delay, is_retryable_error
from core.constants import MAX_RETRIES

try:
    from openai import OpenAI, AsyncOpenAI
    _HAS_OPENAI = True
except ImportError:
    _HAS_OPENAI = False
    OpenAI = None
    AsyncOpenAI = None

class OpenAITranslator:
    def __init__(self, config_manager: ConfigManager) -> None:
        self.config_manager = config_manager
        self.logger = logging.getLogger(__name__)
        self._sync_client: Any = None
        self._async_client: Any = None

    def _get_sync_client(self, api_key: str) -> Any:
        if self._sync_client is None:
            self._sync_client = OpenAI(api_key=api_key)
        return self._sync_client

    def _get_async_client(self, api_key: str) -> Any:
        if self._async_client is None:
            self._async_client = AsyncOpenAI(api_key=api_key)
        return self._async_client

    def validate_api_key(self) -> str:
        config = self.config_manager.get_config()
        api_key = config.get("openai", {}).get("api_key")
        if not api_key:
            raise APIKeyError("OpenAI API 키가 설정되지 않았습니다.")
        return api_key

    async def translate(self, text: str, model_name: str, target_language: str) -> str:
        if not _HAS_OPENAI or OpenAI is None:
            raise RuntimeError("openai 패키지가 설치되어 있지 않습니다.")
        api_key = self.validate_api_key()

        for attempt in range(MAX_RETRIES):
            try:
                client = self._get_sync_client(api_key)
                response = client.chat.completions.create(
                    model=model_name,
                    messages=[
                        {"role": "system", "content": build_openai_system_prompt(target_language)},
                        {"role": "user", "content": text},
                    ],
                )
                content = response.choices[0].message.content
                return content if content is not None else ""
            except Exception as e:
                if attempt < MAX_RETRIES - 1:
                    if is_retryable_error(e):
                        delay = calculate_retry_delay(attempt)
                        self.logger.warning(f"OpenAI 번역 시도 {attempt + 1} 실패: {e}. {delay}초 후 재시도합니다.")
                        await asyncio.sleep(delay)
                        continue
                    else:
                        raise
                self.logger.error(f"OpenAI 번역 최종 실패: {e}")
                raise
        raise RuntimeError("OpenAI 번역이 완료되지 않았습니다.")

    async def translate_stream(self, text: str, model_name: str, target_language: str):
        if not _HAS_OPENAI or OpenAI is None:
            raise RuntimeError("openai 패키지가 설치되어 있지 않습니다.")
        api_key = self.validate_api_key()
        if AsyncOpenAI is None:
            raise RuntimeError("AsyncOpenAI가 초기화되지 않았습니다.")
        client = self._get_async_client(api_key)

        response_stream = await client.chat.completions.create(
            model=model_name,
            messages=[
                {"role": "system", "content": build_openai_system_prompt(target_language)},
                {"role": "user", "content": text},
            ],
            stream=True,
        )

        async for chunk in response_stream:
            content = chunk.choices[0].delta.content
            if content is not None:
                yield content
