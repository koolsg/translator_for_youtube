"""
Pydantic data models for the Translation API Server.

These models define the request/response structure for the API endpoints
and provide automatic validation and serialization.
"""

from pydantic import BaseModel


class TranslationRequest(BaseModel):
    """번역 요청 데이터 구조를 정의합니다."""
    text: str  # 번역할 원본 텍스트
    model: str  # 사용할 AI 모델 (예: 'gemini-pro', 'gpt-3.5-turbo')
    target_language: str  # 목표 언어 코드 (예: 'ko', 'en', 'ja')
    show_notification: bool = False  # 번역 완료 후 Windows 알림 표시 여부


class TranslationResponse(BaseModel):
    """번역 응답 데이터 구조를 정의합니다."""
    translated_text: str  # 번역된 텍스트
