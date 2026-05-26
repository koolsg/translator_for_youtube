import logging
import re
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api._errors import NoTranscriptFound, TranscriptsDisabled

from core.exceptions import RateLimitError
from core.config import ConfigManager
from core.constants import DEFAULT_PROVIDER
from modules.translator.schemas import TranslationRequest, TranslationResponse
from modules.translator.service import TranslationService
from modules.translator import benchmark_service

router = APIRouter()
config_manager = ConfigManager()
translation_service = TranslationService(config_manager)


class BenchmarkRecord(BaseModel):
    model: str
    provider: str
    source_lang: str          # 원문 언어 코드 (예: "en", "ja", "unknown")
    target_lang: str          # 번역 대상 언어 코드 (예: "ko")
    char_count: int           # 원문 글자 수
    elapsed_ms: int           # 소요 시간 (밀리초)
    mode: str                 # "normal" | "stream"


@router.get("/health")
def health():
    return {"status": "ok"}

@router.get("/models", response_model=List[str])
def get_models(provider: str = Query(DEFAULT_PROVIDER, enum=["gemini", "openai"])):
    try:
        return translation_service.get_available_models(provider)
    except Exception as e:
        logging.getLogger(__name__).error(f"모델 목록 조회 실패: {e}")
        raise HTTPException(status_code=500, detail="모델 목록을 가져올 수 없습니다")

@router.post("/translate", response_model=TranslationResponse)
async def translate_text(request: TranslationRequest):
    try:
        logging.getLogger(__name__).info(f"번역 요청: {request.model} 모델로 {request.target_language} 언어로")
        translated_text = await translation_service.translate(request.text, request.model, request.target_language)
        try:
            translation_service.save_preset_model(request.model)
        except Exception as e:
            logging.getLogger(__name__).warning(f"프리셋 저장 실패 (무시됨): {e}")

        return TranslationResponse(translated_text=translated_text)
    except RateLimitError as e:
        error_msg = str(e)
        logging.getLogger(__name__).warning(f"할당량 초과: {error_msg}")
        detail = {
            "message": error_msg,
            "retry_after_seconds": getattr(e, "retry_after", None),
            "provider": getattr(e, "provider", None),
        }
        raise HTTPException(status_code=429, detail=detail)
    except ValueError as e:
        error_msg = str(e)
        logging.getLogger(__name__).warning(f"유효성 검사 오류: {error_msg}")
        raise HTTPException(status_code=400, detail=error_msg)
    except Exception as e:
        error_msg = str(e)
        logging.getLogger(__name__).error(f"번역 처리 중 오류: {error_msg}")
        raise HTTPException(status_code=500, detail=error_msg)

@router.post("/translate_stream")
async def translate_stream(request: TranslationRequest):
    try:
        logging.getLogger(__name__).info(f"스트리밍 번역 요청: {request.model} 모델로 {request.target_language} 언어로")
        original_stream = translation_service.translate_stream(request.text, request.model, request.target_language)

        return StreamingResponse(original_stream, media_type="text/plain")

    except RateLimitError as e:
        error_msg = str(e)
        logging.getLogger(__name__).warning(f"스트리밍 할당량 초과: {error_msg}")
        detail = {
            "message": error_msg,
            "retry_after_seconds": getattr(e, "retry_after", None),
            "provider": getattr(e, "provider", None),
        }
        raise HTTPException(status_code=429, detail=detail)
    except ValueError as e:
        error_msg = str(e)
        logging.getLogger(__name__).warning(f"스트리밍 유효성 검사 오류: {error_msg}")
        raise HTTPException(status_code=400, detail=error_msg)
    except Exception as e:
        error_msg = str(e)
        logging.getLogger(__name__).error(f"스트리밍 번역 처리 중 오류: {error_msg}")
        raise HTTPException(status_code=500, detail=error_msg)


# ================================================================
# 벤치마크 엔드포인트
# ================================================================

@router.post("/benchmark", status_code=201)
async def add_benchmark(record: BenchmarkRecord):
    """번역 완료 시 크롬 확장에서 호출하여 벤치마크 기록 1건을 저장합니다."""
    await benchmark_service.save_record(record.model_dump())
    return {"status": "ok"}


@router.get("/benchmark")
async def get_benchmark():
    """저장된 벤치마크 기록 전체를 최신순으로 반환합니다."""
    records = await benchmark_service.load_records()
    return {"records": list(reversed(records))}


@router.delete("/benchmark")
async def clear_benchmark():
    """전체 벤치마크 기록을 삭제합니다."""
    await benchmark_service.clear_records()
    return {"status": "ok"}


@router.get("/get_transcript")
def get_transcript(
    video_id: str,
    languages: str = "ko,en,ja,zh,es,fr,de",
    preserve_timestamps: bool = False,
    translate_to: Optional[str] = None,
) -> dict:
    def clean_text(text: str) -> str:
        text = re.sub(r"\[.*?\]|\(.*?\)", "", text)
        text = text.replace("\n", " ")
        text = " ".join(text.split())
        return text

    logger = logging.getLogger(__name__)

    try:
        logger.info(f"자막 추출 요청: video_id={video_id}, preserve_timestamps={preserve_timestamps}, translate_to={translate_to}")
        api = YouTubeTranscriptApi()
        transcript_list = api.list(video_id)

        manual_transcript = next((candidate for candidate in transcript_list if not candidate.is_generated), None)
        if manual_transcript:
            logger.info("수동 자막을 선택했습니다: %s", manual_transcript.language_code)
            transcript = manual_transcript
        else:
            generated_transcript = next((candidate for candidate in transcript_list if candidate.is_generated), None)
            if generated_transcript:
                logger.info("수동 자막이 없어 자동 생성 자막을 선택했습니다: %s", generated_transcript.language_code)
            transcript = generated_transcript

        if transcript is None:
            logger.warning("사용 가능한 자막이 없습니다: %s", video_id)
            requested_language_codes = languages.split(",") if languages else []
            raise NoTranscriptFound(video_id, requested_language_codes, transcript_list)

        if translate_to:
            logger.info("translate_to 파라미터는 지원되지 않습니다. 원본 자막만 반환합니다: %s", translate_to)

        transcript_data = transcript.fetch()

        sentence_end_re = re.compile(r"(?:[.!?]+[)\"”’\]]*(?=\s|$))|[。！？…‥]+[)\"”’\]]*")
        merged_output: list[str] = []
        current_text = ""
        current_start_time = ""
        minimum_length = 600
        max_length = minimum_length * 2

        def flush_point(buffer_text: str) -> int:
            length = len(buffer_text)
            if length >= minimum_length:
                matches = list(sentence_end_re.finditer(buffer_text))
                if matches:
                    return matches[-1].end()
            if length >= max_length:
                cutoff = max_length
                window_start = max(0, cutoff - 80)
                window = buffer_text[window_start:cutoff]
                last_space = window.rfind(" ")
                if last_space != -1:
                    return window_start + last_space
                return cutoff
            return -1

        if preserve_timestamps:
            for snippet in transcript_data:
                text = clean_text(snippet.text)
                if snippet.start < 3600:
                    snippet_ts = f"[{snippet.start // 60:02.0f}:{snippet.start % 60:02.0f}]"
                else:
                    snippet_ts = f"[{snippet.start // 3600:02.0f}:{snippet.start % 3600 // 60:02.0f}:{snippet.start % 60:02.0f}]"

                if not current_text:
                    current_start_time = snippet_ts

                current_text += (" " + text) if current_text else text
                split_at = flush_point(current_text)
                if split_at != -1:
                    merged_output.append(f"{current_start_time} {current_text[:split_at].strip()}")
                    remainder = current_text[split_at:].strip()
                    current_text = remainder
                    current_start_time = snippet_ts if remainder else ""

            if current_text:
                merged_output.append(f"{current_start_time} {current_text.strip()}")
            full_transcript = "\n".join(merged_output)
        else:
            for snippet in transcript_data:
                text = clean_text(snippet.text)
                current_text += (" " + text) if current_text else text

                split_at = flush_point(current_text)
                if split_at != -1:
                    merged_output.append(f"{current_text[:split_at].strip()}")
                    current_text = current_text[split_at:].strip()

            if current_text:
                merged_output.append(f"{current_text.strip()}")
            full_transcript = "\n".join(merged_output)

        return {
            "transcript": full_transcript,
            "language": transcript.language,
            "language_code": transcript.language_code,
            "is_generated": transcript.is_generated,
            "translated": False,
        }

    except (NoTranscriptFound, TranscriptsDisabled) as e:
        logger.warning(f"자막을 찾을 수 없습니다: {video_id}, 이유: {e}")
        raise HTTPException(status_code=404, detail="이 동영상에서 사용 가능한 자막이 없습니다.")
    except Exception as e:
        logger.error(f"자막 추출 중 알 수 없는 오류: {e}")
        raise HTTPException(status_code=500, detail=f"자막을 가져오는 중 오류가 발생했습니다: {e}")
