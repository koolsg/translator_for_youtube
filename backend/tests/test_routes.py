from fastapi.testclient import TestClient


def test_health_check(client: TestClient):
    """헬스 체크 엔드포인트가 정상적으로 200 OK를 반환하는지 테스트합니다."""
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_get_models_gemini(client: TestClient, monkeypatch):
    """/models 엔드포인트에서 gemini 제공자를 제대로 처리하는지 (Mocking 적용) 테스트합니다."""
    # 번역 서비스의 모델 목록 반환 로직 모의
    from services import TranslationService

    monkeypatch.setattr(
        TranslationService,
        "get_available_models",
        lambda self, provider: ["gemini-mock-1", "gemini-mock-2"],
    )

    response = client.get("/models?provider=gemini")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) == 2
    assert "gemini-mock-1" in data


def test_translate_endpoint(client: TestClient, mock_translation_service):
    """/translate 엔드포인트가 올바른 요청에 대해 200 OK와 번역 결과를 반환하는지 테스트합니다."""
    payload = {
        "text": "Hello world",
        "model": "gemini-1.5-flash",
        "target_language": "ko",
    }

    response = client.post("/translate", json=payload)

    assert response.status_code == 200
    assert "translated_text" in response.json()
    assert response.json()["translated_text"] == "이것은 돌아온 모의 번역 텍스트입니다."
    mock_translation_service.assert_called_once()


def test_get_transcript(client: TestClient, mock_youtube_api):
    """ "/get_transcript 엔드포인트에 대한 유닛 테스트 (수동/자동 자막 추출)"""
    # mock_youtube_api fixture가 routes 내부의 로직을 가로챔
    response = client.get(
        "/get_transcript?video_id=TEST_VIDEO_123&preserve_timestamps=false"
    )

    assert response.status_code == 200
    data = response.json()
    assert "transcript" in data
    assert "첫 번째 가짜 자막 두 번째 가짜 자막" in data["transcript"]
    assert data["language_code"] == "ko"
    assert data["is_generated"] is False
