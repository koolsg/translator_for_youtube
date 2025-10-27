"""
Translation API Server

A FastAPI-based API server for text translation using OpenAI GPT and Google Gemini models.
"""

import logging
import uvicorn

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routes import router
from services import setup_logging
from validators import validate_environment

# 환경변수 로드: .env 파일에서 환경변수를 안전하게 불러옵니다.
load_dotenv()

# 환경변수 검증을 실행하여 서버 시작 전에 문제를 방지
validate_environment()

# 로깅 설정: 디버그 모드로 애플리케이션의 로깅을 초기화합니다.
setup_logging(debug=True)

# FastAPI 앱 생성: API의 기본 정보를 설정합니다.
app = FastAPI(
    title="Translation API",
    description="An API for translating text using OpenAI and Gemini models.",
    version="1.0.0",
)

# CORS 미들웨어 추가: 모든 출처에서의 요청을 허용하여 로컬 파일(index.html) 및 크롬 확장 프로그램과의 통신을 가능하게 합니다.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 모든 출처 허용
    allow_credentials=True,
    allow_methods=["*"], # 모든 HTTP 메소드 허용
    allow_headers=["*"], # 모든 HTTP 헤더 허용
)

# Register API routes
app.include_router(router)

# --- 서버 실행 ---

if __name__ == "__main__":
    # 이 스크립트가 직접 실행될 때 Uvicorn 서버를 시작합니다.
    from services import DEFAULT_HOST, DEFAULT_PORT

    # 서버 시작 로깅: 자세한 시작 정보 기록
    logger = logging.getLogger(__name__)
    import os
    import psutil

    logger.info("="*60)
    logger.info("🌟 TRANSLATION SERVER STARTING...")

    # 현재 Python 프로세스 정보 기록
    logger.info("🔍 Checking existing Python processes...")
    python_processes = []
    for proc in psutil.process_iter(['pid', 'name', 'cmdline']):
        try:
            if proc.info['name'] and 'python' in proc.info['name'].lower():
                cmdline = ' '.join(proc.info['cmdline']) if proc.info['cmdline'] else 'N/A'
                python_processes.append(f"PID:{proc.info['pid']} - {cmdline[:100]}...")
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            continue

    if python_processes:
        logger.info(f"📊 Found {len(python_processes)} Python processes:")
        for proc_info in python_processes:
            logger.info(f"   ▶ {proc_info}")
    else:
        logger.info("📊 No existing Python processes found")

    logger.info(f"📡 Host: {DEFAULT_HOST}")
    logger.info(f"🔌 Port: {DEFAULT_PORT}")
    logger.info(f"🌐 URL: http://{DEFAULT_HOST}:{DEFAULT_PORT}")
    logger.info(f"📁 Working Directory: {os.getcwd()}")
    logger.info(f"🐍 Python Path: {os.sys.path[0]}")
    logger.info("📋 API Endpoints:")
    logger.info(f"   - GET  /models")
    logger.info(f"   - POST /translate")
    logger.info(f"   - POST /translate_stream")
    logger.info(f"   - GET  /get_transcript")
    logger.info("="*60)
    logger.info("서버 초기화 및 uvicorn 시작...")

    try:
        uvicorn.run(app, host=DEFAULT_HOST, port=DEFAULT_PORT, reload=False)
    except Exception as e:
        logger.error(f"🚨 서버 시작 실패: {e}")
        raise
