import logging
import random
from typing import List
from core.config import ConfigManager
from core.constants import MAX_PRESETS
from modules.translator.providers.gemini import GeminiTranslator, _HAS_GENAI, genai
from modules.translator.providers.openai import OpenAITranslator, _HAS_OPENAI, OpenAI

class TranslationService:
    def __init__(self, config_manager: ConfigManager) -> None:
        self.config_manager = config_manager
        self.gemini_translator = GeminiTranslator(config_manager)
        self.openai_translator = OpenAITranslator(config_manager)
        self.logger = logging.getLogger(__name__)

    async def translate(self, text: str, model_name: str, target_language: str) -> str:
        if "gemini" in model_name:
            return await self.gemini_translator.translate(text, model_name, target_language)
        elif "gpt" in model_name:
            return await self.openai_translator.translate(text, model_name, target_language)
        else:
            raise ValueError(f"지원하지 않는 모델입니다: {model_name}")

    async def translate_stream(self, text: str, model_name: str, target_language: str):
        if "gemini" in model_name:
            async for chunk in self.gemini_translator.translate_stream(text, model_name, target_language):
                yield chunk
        elif "gpt" in model_name:
            async for chunk in self.openai_translator.translate_stream(text, model_name, target_language):
                yield chunk
        else:
            raise ValueError(f"지원하지 않는 모델입니다: {model_name}")

    def get_available_models(self, provider: str) -> List[str]:
        config = self.config_manager.get_config()
        available_models = []

        presets = config.get("presets", {}).get("models", [])
        provider_filter = "gemini" if provider == "gemini" else "gpt"
        provider_presets = [model for model in presets if provider_filter in model]
        available_models.extend(provider_presets)

        if provider == "gemini":
            available_models.extend(self._get_gemini_models())
        elif provider == "openai":
            available_models.extend(self._get_openai_models())

        seen = set()
        unique_models = []
        for model in available_models:
            if model not in seen:
                seen.add(model)
                unique_models.append(model)

        return unique_models

    def _get_gemini_models(self) -> List[str]:
        if not _HAS_GENAI or genai is None:
            self.logger.error("Google Generative AI 라이브러리가 설치되지 않았습니다.")
            config = self.config_manager.get_config()
            return config.get("gemini", {}).get("available_models", [])

        try:
            api_keys = self.gemini_translator.validate_api_keys()
            models = []
            client = genai.Client(api_key=random.choice(api_keys))
            for model_info in client.models.list():
                if "generateContent" in (model_info.supported_actions or []):
                    if model_info.name:
                        models.append(model_info.name)
            return models
        except Exception as e:
            self.logger.error(f"Gemini 모델 목록을 가져오는 데 실패했습니다: {e}")
            config = self.config_manager.get_config()
            return config.get("gemini", {}).get("available_models", [])

    def _get_openai_models(self) -> List[str]:
        if not _HAS_OPENAI:
            self.logger.error("OpenAI 라이브러리가 설치되지 않았습니다.")
            config = self.config_manager.get_config()
            return config.get("openai", {}).get("available_models", [])

        try:
            if not _HAS_OPENAI or OpenAI is None:
                raise RuntimeError("openai 패키지가 설치되어 있지 않습니다.")
            api_key = self.openai_translator.validate_api_key()

            placeholder_values = [
                "your_openai_api_key_here",
                "YOUR_OPENAI_API_KEY_HERE",
                "sk-...your_openai_api_key_here",
                "your_api_key_here",
            ]

            if api_key in placeholder_values:
                raise ValueError("OpenAI API 키가 플레이스홀더 값으로 설정되어 있습니다.")

            if not api_key.startswith("sk-"):
                raise ValueError("OpenAI API 키 형식이 올바르지 않습니다.")

            client = OpenAI(api_key=api_key)
            account_info = client.models.list()
            return [model.id for model in account_info.data]
        except Exception as e:
            self.logger.error(f"OpenAI 모델 목록을 가져오는 데 실패했습니다: {e}")
            config = self.config_manager.get_config()
            return config.get("openai", {}).get("available_models", [])

    def save_preset_model(self, model_name: str) -> None:
        config = self.config_manager.get_config()
        if "presets" not in config:
            config["presets"] = {"models": [], "targets": []}

        presets = config["presets"]["models"]
        if model_name not in presets:
            presets.insert(0, model_name)
            if len(presets) > MAX_PRESETS:
                presets[:] = presets[:MAX_PRESETS]
            self.config_manager.save_config(config)
            self.logger.info(f"모델 '{model_name}'이(가) 프리셋에 저장되었습니다.")
