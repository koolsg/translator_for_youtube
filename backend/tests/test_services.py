import pytest
import os
from unittest.mock import MagicMock

# 백엔드 모듈 접근을 위해 sys.path 추가
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from services import TranslationService, ConfigManager, OpenAITranslator
from exceptions import APIKeyError


def test_translation_service_initialization():
    """ConfigManager와 TranslationService 인스턴스 초기화가 정상적으로 되는지 테스트"""
    config_manager = ConfigManager()
    service = TranslationService(config_manager)
    assert service.config_manager is not None


def test_get_available_models_returns_empty_for_unknown():
    """알 수 없는 provider를 호출할 경우 빈 리스트 또는 프리셋 모음만 반환하는지 테스트"""
    config_manager = ConfigManager()
    service = TranslationService(config_manager)
    models = service.get_available_models("unknown_provider")
    assert isinstance(models, list)


def test_validate_api_key_missing_openai():
    """OpenAI API 키가 설정되지 않은 경우 예외(APIKeyError)가 발생하는지 테스트"""
    config_manager = ConfigManager()
    # 환경변수를 무시하도록 config_manager 설정을 모킹
    config_manager.get_config = MagicMock(return_value={})
    translator = OpenAITranslator(config_manager)

    with pytest.raises(APIKeyError) as exc:
        translator.validate_api_key()
    assert "OpenAI API 키가 설정되지 않았습니다" in str(exc.value)
