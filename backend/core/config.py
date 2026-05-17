import os
import json
import logging
from typing import Dict, Any, Optional

class ConfigManager:
    """JSON 설정 파일을 관리하는 클래스 (읽기, 쓰기, 유효성 검사).

    환경변수를 우선적으로 사용하며, config.json을 fallback으로 활용합니다.
    """

    def __init__(self, config_path: str = "config.json") -> None:
        self.config_path = config_path
        self._config: Optional[Dict[str, Any]] = None
        self.logger = logging.getLogger(__name__)

    def load(self) -> Dict[str, Any]:
        """설정 파일을 로드하고 JSON으로 파싱합니다."""
        try:
            with open(self.config_path, "r", encoding="utf-8") as f:
                config_text = f.read()

            lines = []
            for line in config_text.split("\n"):
                if "#" in line:
                    line = line[: line.find("#")].rstrip()
                if line.strip():
                    lines.append(line)

            config_text_cleaned = "\n".join(lines)
            config = json.loads(config_text_cleaned)

            if not isinstance(config, dict):
                raise ValueError("설정 파일은 반드시 JSON 객체(딕셔너리) 형태여야 합니다.")
            return config

        except FileNotFoundError:
            self.logger.warning(f"설정 파일을 찾을 수 없습니다: {self.config_path}")
            return {}
        except json.JSONDecodeError as e:
            self.logger.error(f"설정 파일 JSON 파싱 오류: {e}")
            raise
        except Exception as e:
            self.logger.error(f"설정 파일 로딩 중 예기치 않은 오류 발생: {e}")
            raise

    def get_config(self) -> Dict[str, Any]:
        """현재 설정 값을 반환하며, 캐시가 없을 경우 파일에서 로드합니다.

        환경변수(GEMINI_API_KEY, OPENAI_API_KEY)가 설정되어 있다면,
        config.json보다 우선하여 해당 값을 반환합니다.
        """
        if self._config is None:
            self._config = self.load()

        gemini_api_key = os.getenv("GEMINI_API_KEY")
        if gemini_api_key:
            if "gemini" not in self._config:
                self._config["gemini"] = {}
            if "api_keys" not in self._config["gemini"] or not self._config["gemini"]["api_keys"]:
                self._config["gemini"]["api_keys"] = [gemini_api_key]
            elif gemini_api_key not in self._config["gemini"]["api_keys"]:
                self._config["gemini"]["api_keys"].insert(0, gemini_api_key)

        openai_api_key = os.getenv("OPENAI_API_KEY")
        if openai_api_key:
            if "openai" not in self._config:
                self._config["openai"] = {}
            self._config["openai"]["api_key"] = openai_api_key

        return self._config
