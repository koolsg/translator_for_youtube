import logging

def setup_logging(debug: bool = False) -> None:
    """전역 로깅 환경을 설정합니다.

    Args:
        debug: True일 경우 DEBUG 레벨까지 로깅하며, False일 경우 INFO 레벨부터 로깅합니다.
    """
    level = logging.DEBUG if debug else logging.INFO
    logging.basicConfig(
        level=level,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        handlers=[
            logging.StreamHandler(),
            logging.FileHandler("translation_server.log", encoding="utf-8"),
        ],
    )
    logging.getLogger("services").info("로깅 설정이 완료되었습니다.")
