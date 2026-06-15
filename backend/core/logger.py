import logging
import os
import sys

def setup_logging(debug: bool = False) -> None:
    """전역 로깅 환경을 설정합니다.

    Args:
        debug: True일 경우 DEBUG 레벨까지 로깅하며, False일 경우 INFO 레벨부터 로깅합니다.
    """
    # 실행 모드에 따른 로그 디렉터리 동적 결정
    if getattr(sys, 'frozen', False):
        # PyInstaller 바이너리 실행 시: 실행 파일이 있는 디렉터리 (예: ~/bin)
        base_dir = os.path.dirname(sys.executable)
    else:
        # 개발 환경 소스 실행 시: backend 디렉터리 (core/logger.py는 backend/core/logger.py에 위치함)
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

    log_file = os.path.join(base_dir, "translation_server.log")
    level = logging.DEBUG if debug else logging.INFO
    
    logging.basicConfig(
        level=level,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        handlers=[
            logging.StreamHandler(),
            logging.FileHandler(log_file, encoding="utf-8"),
        ],
    )
    logging.getLogger("services").info(f"로깅 설정이 완료되었습니다. 로그 위치: {log_file}")
