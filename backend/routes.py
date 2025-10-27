"""
API routes for the Translation API Server.

This module defines the FastAPI routes for translation endpoints,
separated from the main application setup for better organization.
"""

import logging
import re
from typing import List

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse
from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api._errors import NoTranscriptFound, TranscriptsDisabled

from models import TranslationRequest, TranslationResponse
from notification_service import NotificationService
from services import DEFAULT_PROVIDER, TranslationService, ConfigManager

# Create router instance
router = APIRouter()

# Initialize services
config_manager = ConfigManager()
translation_service = TranslationService(config_manager)


@router.get("/models", response_model=List[str])
def get_models(provider: str = Query(DEFAULT_PROVIDER, enum=['gemini', 'openai'])):
    """지정된 AI 제공업체의 사용 가능한 모델 목록을 반환합니다.

    Args:
        provider: AI 제공업체 ('gemini' 또는 'openai')

    Returns:
        list[str]: 사용 가능한 모델 이름 목록
    """
    try:
        # 서비스 레이어에서 모델 목록을 가져옵니다.
        return translation_service.get_available_models(provider)
    except Exception as e:
        # 에러 발생 시 로그를 남기고 HTTP 500 오류를 반환합니다.
        logging.getLogger(__name__).error(f"모델 목록 조회 실패: {e}")
        raise HTTPException(status_code=500, detail="모델 목록을 가져올 수 없습니다")


@router.post("/translate", response_model=TranslationResponse)
def translate_text(request: TranslationRequest):
    """입력된 텍스트를 지정된 AI 모델을 사용하여 목표 언어로 번역합니다.

    Args:
        request: 번역 요청 데이터 (텍스트, 모델, 목표 언어 등)

    Returns:
        TranslationResponse: 번역된 텍스트를 포함한 응답
    """
    try:
        # 요청 정보를 로깅하여 추적합니다.
        logging.getLogger(__name__).info(f"번역 요청: {request.model} 모델로 {request.target_language} 언어로")

        # 번역 서비스를 통해 실제 번역 작업을 수행합니다.
        translated_text = translation_service.translate(
            request.text,
            request.model,
            request.target_language
        )

        # 성공한 모델을 프리셋에 저장하여 다음 번역에서 우선 표시되도록 합니다.
        try:
            translation_service.save_preset_model(request.model)
        except Exception as e:
            # 프리셋 저장 실패는 번역 성공에 영향을 주지 않으므로 경고만 로깅합니다.
            logging.getLogger(__name__).warning(f"프리셋 저장 실패 (무시됨): {e}")

        # 번역 완료 알림 표시: 새 NotificationService 사용
        if request.show_notification:
            NotificationService.send_translation_complete()

        # 번역된 결과를 클라이언트에게 반환합니다.
        return TranslationResponse(translated_text=translated_text)

    except ValueError as e:
        # 유효성 검사 오류 (잘못된 API 키, 지원하지 않는 언어 등)는 400 오류로 반환
        error_msg = str(e)
        logging.getLogger(__name__).warning(f"유효성 검사 오류: {error_msg}")
        raise HTTPException(status_code=400, detail=error_msg)
    except Exception as e:
        # 기타 예기치 않은 오류는 500 오류로 반환
        error_msg = str(e)
        logging.getLogger(__name__).error(f"번역 처리 중 오류: {error_msg}")
        raise HTTPException(status_code=500, detail=error_msg)

@router.post("/translate_stream")
async def translate_stream(request: TranslationRequest):
    """입력된 텍스트를 스트리밍 방식으로 번역합니다."""
    try:
        logging.getLogger(__name__).info(f"스트리밍 번역 요청: {request.model} 모델로 {request.target_language} 언어로")
        
        original_stream = translation_service.translate_stream(
            request.text,
            request.model,
            request.target_language
        )

        async def notification_wrapper():
            """스트림 완료 후 알림을 보내기 위한 래퍼 제너레이터"""
            try:
                async for chunk in original_stream:
                    yield chunk
            finally:
                if request.show_notification:
                    logging.getLogger(__name__).info("스트리밍 번역 완료, 알림을 전송합니다.")
                    NotificationService.send_translation_complete()

        return StreamingResponse(notification_wrapper(), media_type="text/plain")

    except ValueError as e:
        error_msg = str(e)
        logging.getLogger(__name__).warning(f"스트리밍 유효성 검사 오류: {error_msg}")
        raise HTTPException(status_code=400, detail=error_msg)
    except Exception as e:
        error_msg = str(e)
        logging.getLogger(__name__).error(f"스트리밍 번역 처리 중 오류: {error_msg}")
        raise HTTPException(status_code=500, detail=error_msg)


@router.get("/get_transcript")
def get_transcript(
    video_id: str,
    languages: str = "ko,en,ja,zh,es,fr,de",
    preserve_timestamps: bool = False,
    translate_to: str = None
):
    """YouTube 동영상의 자막을 추출하고 선택적으로 번역합니다.

    Args:
        video_id: YouTube 동영상 ID
        languages: 우선순위 순서로 검색할 언어 코드들 (콤마 구분, 기본: ko,en,ja,zh,es,fr,de)
        preserve_timestamps: 자막의 시간정보를 포함할지 여부
        translate_to: 번역할 대상 언어 코드 (선택사항)

    Returns:
        dict: 자막 텍스트, 메타데이터, 시간정보(옵션)를 포함한 응답 구조:
        {
            "transcript": 로그인 takami str,  # 전체 텍스트
            "snippets": [  # preserve_timestamps=True 시 포함
                {"text": str, "start": float, "duration": float}
            ],
            "language": str,  # 선택된 자막 언어 이름
            "language_code": str,  # 선택된 자막 언어 코드
            "is_generated": bool,  # 자동 생성된 자막인지 여부
            "translated": bool  # 번역되었는지 여부
        }
    """
    def clean_text(text: str) -> str:
        """자막 텍스트에서 불필요한 부분을 정제합니다."""
        # 1. 괄호와 그 안의 내용 제거 (예: [음악], (웃음))
        text = re.sub(r'\[.*?\]|\(.*?\)', '', text)
        # 2. 개행 문자를 공백으로 변환
        text = text.replace('\n', ' ')
        # 3. 여러 공백을 하나로 축소하고 양쪽 끝 공백 제거
        text = ' '.join(text.split())
        return text

    try:
        logger = logging.getLogger(__name__)
        logger.info(
            "자막 추출 요청: video_id=%s, preserve_timestamps=%s, translate_to=%s",
            video_id,
            preserve_timestamps,
            translate_to,
        )

        # 1. YouTubeTranscriptApi의 인스턴스를 생성합니다.
        api = YouTubeTranscriptApi()

        # 2. 사용 가능한 자막 목록을 가져옵니다.
        transcript_list = api.list(video_id)

        # 3. 수동 자막을 우선 선택하고, 없으면 자동 생성 자막을 사용합니다.
        manual_transcript = next(
            (candidate for candidate in transcript_list if not candidate.is_generated),
            None,
        )
        if manual_transcript:
            logger.info("수동 자막을 선택했습니다: %s", manual_transcript.language_code)
            transcript = manual_transcript
        else:
            generated_transcript = next(
                (candidate for candidate in transcript_list if candidate.is_generated),
                None,
            )
            if generated_transcript:
                logger.info("수동 자막이 없어 자동 생성 자막을 선택했습니다: %s", generated_transcript.language_code)
            transcript = generated_transcript

        if transcript is None:
            logger.warning("사용 가능한 자막이 없습니다: %s", video_id)
            raise NoTranscriptFound(f"No transcript found for requested YouTube ID: {video_id}")

        # 라이브러리가 번역된 자막을 제공하지 않으므로 translate_to는 무시합니다.
        if translate_to:
            logger.info(
                "translate_to 파라미터는 지원되지 않습니다. 원본 자막만 반환합니다: %s",
                translate_to,
            )

        transcript_data = transcript.fetch()

        merged_output = []
        current_text = ""
        current_start_time = ""
        minimum_length = 400  # 원하는 최대 길이 설정
        if preserve_timestamps:
            for snippet in transcript_data:
                text = clean_text(snippet.text)
                if not current_text:
                    if snippet.start <3600:
                        current_start_time = f'[{snippet.start//60:02.0f}:{snippet.start%60:02.0f}]'
                    else:
                        current_start_time = f'[{snippet.start//3600:02.0f}:{snippet.start%3600//60:02.0f}:{snippet.start%60:02.0f}]'

                current_text += (" " + text) if current_text else text

                if (re.search(r'[.?!]$', text) and len(current_text) >= minimum_length) or \
                   (len(current_text) > minimum_length * 2): # 20% 마진을 두어 안전성 확보
                    merged_output.append(f"{current_start_time} {current_text.strip()}")
                    current_text = ""
                    current_start_time = ""
            if current_text:
                merged_output.append(f"{current_start_time} {current_text.strip()}")
            full_transcript = "\n".join(merged_output)
        else:
            for snippet in transcript_data:
                text = clean_text(snippet.text)
                current_text += (" " + text) if current_text else text

                if (re.search(r'[.?!]$', text) and len(current_text) >= minimum_length) or \
                   (len(current_text) > minimum_length * 2): # 20% 마진을 두어 안전성 확보
                    merged_output.append(f"{current_text.strip()}")
                    current_text = ""
                    current_start_time = ""
            if current_text:
                merged_output.append(f"{current_text.strip()}")
            full_transcript = "\n".join(merged_output)

        response = {
            "transcript": full_transcript,
            "language": transcript.language,
            "language_code": transcript.language_code,
            "is_generated": transcript.is_generated,
            "translated": False,
        }
        return response


    except (NoTranscriptFound, TranscriptsDisabled) as e:
        logger.warning(f"자막을 찾을 수 없습니다: {video_id}, 이유: {e}")
        raise HTTPException(status_code=404, detail="이 동영상에서 사용 가능한 자막이 없습니다.")
    except Exception as e:
        logger.error(f"자막 추출 중 알 수 없는 오류: {e}")
        raise HTTPException(status_code=500, detail=f"자막을 가져오는 중 오류가 발생했습니다: {e}")
