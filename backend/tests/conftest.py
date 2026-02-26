import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock

import sys
import os

# 백엔드 루트 디렉토리를 sys.path에 추가하여 모듈을 임포트할 수 있게 합니다.
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from main import app
from services import TranslationService


@pytest.fixture
def client():
    """FastAPI TestClient fixture를 제공합니다."""
    return TestClient(app)


@pytest.fixture(autouse=True)
def mock_env_vars(monkeypatch):
    """모든 테스트에서 공통으로 사용할 가짜 환경변수를 설정합니다."""
    monkeypatch.setenv("OPENAI_API_KEY", "test_openai_key")
    monkeypatch.setenv("GEMINI_API_KEY", "test_gemini_key")


@pytest.fixture
def mock_translation_service():
    """TranslationService의 번역 메서드를 모의(Mock) 객체로 교체합니다."""
    with patch.object(TranslationService, "translate") as mock_translate:
        mock_translate.return_value = "이것은 돌아온 모의 번역 텍스트입니다."
        yield mock_translate


@pytest.fixture
def mock_youtube_api():
    """YouTubeTranscriptApi를 모의(Mock) 객체로 교체하여 실제 네트워크 호출을 방지합니다."""
    with patch("routes.YouTubeTranscriptApi") as MockApi:
        instance = MockApi.return_value

        # 가짜 자막 데이터 설정
        mock_transcript = MagicMock()
        mock_transcript.language = "Korean"
        mock_transcript.language_code = "ko"
        mock_transcript.is_generated = False
        mock_transcript.fetch.return_value = [
            MagicMock(text="첫 번째 가짜 자막", start=0.0, duration=2.0),
            MagicMock(text="두 번째 가짜 자막", start=2.0, duration=2.0),
        ]

        instance.list.return_value = [mock_transcript]
        yield instance
