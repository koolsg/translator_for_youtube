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
    logger = logging.getLogger(__name__)
    logger.info("Starting translation server...")
    logger.info(f"Server running on http://{DEFAULT_HOST}:{DEFAULT_PORT}")
    uvicorn.run(app, host=DEFAULT_HOST, port=DEFAULT_PORT)
