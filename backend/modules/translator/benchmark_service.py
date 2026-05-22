import asyncio
import json
import logging
import os
from datetime import datetime

logger = logging.getLogger(__name__)

# ----------------------------------------------------------------
# 저장 경로: 바이너리 재빌드·교체·확장 제거 시에도 데이터가 유지됩니다.
# XDG 표준 사용자 데이터 디렉터리에 저장합니다.
# ----------------------------------------------------------------
_DATA_DIR = os.getenv(
    "BENCHMARK_DIR",
    os.path.join(os.path.expanduser("~"), ".local", "share", "local-service"),
)
BENCHMARK_FILE = os.path.join(_DATA_DIR, "benchmark_records.json")
MAX_RECORDS = 1000


def _ensure_dir() -> None:
    """데이터 디렉터리가 없으면 생성합니다."""
    os.makedirs(_DATA_DIR, exist_ok=True)


def _load_records_sync() -> list[dict]:
    """JSON 파일에서 기록 배열을 읽어 반환합니다 (동기)."""
    _ensure_dir()
    if not os.path.exists(BENCHMARK_FILE):
        return []
    try:
        with open(BENCHMARK_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
        return data if isinstance(data, list) else []
    except (json.JSONDecodeError, OSError) as e:
        logger.warning("벤치마크 파일 읽기 실패 (빈 목록 반환): %s", e)
        return []


def _save_records_sync(records: list[dict]) -> None:
    """기록 배열을 JSON 파일에 씁니다 (동기)."""
    _ensure_dir()
    with open(BENCHMARK_FILE, "w", encoding="utf-8") as f:
        json.dump(records, f, ensure_ascii=False, indent=2)


async def load_records() -> list[dict]:
    """저장된 벤치마크 기록 전체를 반환합니다 (최신순)."""
    return await asyncio.to_thread(_load_records_sync)


async def save_record(record: dict) -> None:
    """
    벤치마크 기록 1건을 추가합니다.
    - 저장 실패는 로그만 남기고 조용히 무시합니다 (번역 응답에 영향 없음).
    - MAX_RECORDS 초과 시 가장 오래된 기록부터 삭제합니다.
    """
    def _do() -> None:
        records = _load_records_sync()

        # 자동 증가 id
        next_id = (records[-1]["id"] + 1) if records else 1
        entry = {
            "id": next_id,
            "timestamp": datetime.now().strftime("%Y-%m-%dT%H:%M:%S"),
            **record,
        }
        records.append(entry)

        # 최대 개수 유지 (오래된 것부터 제거)
        if len(records) > MAX_RECORDS:
            records = records[-MAX_RECORDS:]

        _save_records_sync(records)

    try:
        await asyncio.to_thread(_do)
    except Exception as e:
        logger.warning("벤치마크 저장 실패 (무시됨): %s", e)


async def clear_records() -> None:
    """전체 벤치마크 기록을 삭제합니다."""
    await asyncio.to_thread(_save_records_sync, [])
