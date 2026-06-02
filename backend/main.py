import sys
import os
import logging
import uvicorn
from dotenv import load_dotenv

# --- 환경변수 및 로깅 초기 설정을 가장 먼저 수행합니다 ---
if getattr(sys, 'frozen', False):
    base_path = os.path.dirname(sys.executable)
else:
    base_path = os.path.dirname(os.path.abspath(__file__))

load_dotenv(dotenv_path=os.path.join(base_path, '.env'))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from modules.translator.router import router as translator_router
from modules.notes.router import router as notes_router
from core.logger import setup_logging
from core.validators import validate_environment

# 환경변수 검증
validate_environment()

# 로깅 초기화
setup_logging(debug=True)

# ================================================================
# Sub-application 1: 번역기 API
# 크롬 확장 / 유튜브 페이지에서 호출 → 전체 출처 개방(*)
# ================================================================
translator_app = FastAPI(
    title="Translation API",
    description="YouTube translator API using OpenAI and Gemini models.",
    version="1.0.0",
)
translator_app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
translator_app.include_router(translator_router)

# ================================================================
# Sub-application 2: 노트 API
# 로컬 프론트엔드에서만 호출 → 출처 격리
# ================================================================
notes_app = FastAPI(
    title="Notes API",
    description="Personal notes management API.",
    version="1.0.0",
)
notes_app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5000",
        "http://127.0.0.1:5000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
notes_app.include_router(notes_router)

# ================================================================
# 루트 앱: Sub-application 마운트
# ================================================================
app = FastAPI(title="Local Service")

# 번역기: /api/translator/*
app.mount("/api/translator", translator_app)

# 노트: /api/notes/* (notes_router 경로가 /로 시작하므로 여기서 prefix 부여)
app.mount("/api/notes", notes_app)

# Static files: 노트 프론트엔드 서빙
if getattr(sys, 'frozen', False):
    frontend_path = os.path.join(sys._MEIPASS, "notes")
else:
    frontend_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "frontend", "notes")

if os.path.exists(frontend_path):
    app.mount("/notes", StaticFiles(directory=frontend_path, html=True), name="notes")


# --- 서버 실행 ---

if __name__ == "__main__":
    from core.constants import DEFAULT_HOST, DEFAULT_PORT
    import psutil

    logger = logging.getLogger(__name__)

    logger.info("=" * 60)
    logger.info("LOCAL SERVICE STARTING...")
    logger.info(f"Host: {DEFAULT_HOST}")
    logger.info(f"Port: {DEFAULT_PORT}")
    logger.info(f"URL: http://{DEFAULT_HOST}:{DEFAULT_PORT}")
    logger.info("API Endpoints:")
    logger.info("  [번역기] GET  /api/translator/models")
    logger.info("  [번역기] POST /api/translator/translate")
    logger.info("  [번역기] POST /api/translator/translate_stream")
    logger.info("  [번역기] GET  /api/translator/get_transcript")
    logger.info("  [노트]   GET  /api/notes/")
    logger.info("  [노트]   GET  /api/notes/search")
    logger.info("  [노트]   POST /api/notes/")
    logger.info("=" * 60)

    try:
        uvicorn.run(app, host=DEFAULT_HOST, port=DEFAULT_PORT, reload=False)
    except Exception as e:
        logger.error(f"서버 시작 실패: {e}")
        raise
