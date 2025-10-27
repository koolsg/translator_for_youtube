"""Core services for the Translation API Server."""

import json
import logging
import os
import random
import sys
from typing import Dict, List, Optional, Any, cast

from exceptions import APIKeyError

# AI 서비스 임포트 (상단에서 선언하여 보안 및 성능 개선)
try:
    import google.generativeai as genai
    _HAS_GENAI = True
except ImportError:
    _HAS_GENAI = False
    genai = None

try:
    from openai import OpenAI
    _HAS_OPENAI = True
except ImportError:
    _HAS_OPENAI = False
    OpenAI = None

# === 상수 정의 ===
# 재시도 관련 설정
MAX_RETRIES = 3
INITIAL_RETRY_DELAY = 1.0  # 초
MAX_RETRY_DELAY = 60.0  # 초
BACKOFF_FACTOR = 2.0

# 타임아웃 설정
API_TIMEOUT = 30.0  # 초
MODEL_LIST_TIMEOUT = 10.0  # 초

# 서버 설정
DEFAULT_HOST = '127.0.0.1'
DEFAULT_PORT = 5000
MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16MB

# AI 서비스 설정
DEFAULT_PROVIDER = 'gemini'
MAX_PRESETS = 5  # 프리셋으로 저장할 최대 모델 개수

# UI 설정
MAX_DISPLAY_LANGUAGES = 10  # UI에 표시할 최대 언어 수

# --- 언어 지원 상수 정의 ---
SUPPORTED_LANGUAGES = {
    'ko': '한국어',
    'en': '영어',
    'ja': '일본어',
    'zh': '중국어',
    'es': '스페인어',
    'fr': '프랑스어',
    'de': '독일어',
    'ru': '러시아어',
    'pt': '포르투갈어',
    'it': '이탈리아어',
    'ar': '아랍어',
    'hi': '힌디어',
    'th': '태국어',
    'vi': '베트남어',
    'nl': '네덜란드어',
    'sv': '스웨덴어',
    'da': '덴마크어',
    'no': '노르웨이어',
    'fi': '핀란드어',
    'pl': '폴란드어',
    'tr': '터키어',
    'cs': '체코어',
    'hu': '헝가리어',
    'el': '그리스어',
    'he': '히브리어',
    'id': '인도네시아어',
    'ms': '말레이어',
    'tl': '타갈로그어',
    'uk': '우크라이나어',
    'bg': '불가리아어',
    'hr': '크로아티아어',
    'sk': '슬로바키아어',
    'sl': '슬로베니아어',
    'et': '에스토니아어',
    'lv': '라트비아어',
    'lt': '리투아니아어',
    'mt': '몰타어',
    'ga': '아일랜드어',
    'cy': '웨일스어',
    'is': '아이슬란드어',
    'sq': '알바니아어',
    'mk': '마케도니아어',
    'sr': '세르비아어',
    'bs': '보스니아어',
    'me': '몬테네그로어',
    'sw': '스와힐리어',
    'am': '암하라어',
    'ne': '네팔어',
    'si': '싱할라어',
    'ta': '타밀어',
    'te': '텔루구어',
    'kn': '칸나다어',
    'ml': '말라얄람어',
    'or': '오리야어',
    'pa': '펀자브어',
    'gu': '구자라트어',
    'bn': '벵골어',
    'ur': '우르두어',
    'fa': '페르시아어',
    'ps': '파슈토어',
    'ku': '쿠르드어',
    'ka': '조지아어',
    'hy': '아르메니아어',
    'az': '아제르바이잔어',
    'kk': '카자흐어',
    'uz': '우즈베크어',
    'tk': '투르크멘어',
    'ky': '키르기스어',
    'tg': '타지크어',
    'mn': '몽골어',
    'km': '크메르어',
    'lo': '라오어',
    'my': '미얀마어',
    'jv': '자바어',
    'su': '순다어',
    'ceb': '세부아노어',
    'ilo': '일로카노어',
    'haw': '하와이어',
    'mi': '마오리어',
    'sm': '사모아어',
    'to': '통가어',
    'fj': '피지어',
    'ty': '타히티어',
    'mg': '말라가시어',
    'sn': '쇼나어',
    'st': '소토어',
    'tn': '츠와나어',
    'xh': '코사어',
    'zu': '줄루어',
    'af': '아프리칸스어',
    'la': '라틴어',
    'eo': '에스페란토어',
    'ia': '인터링구아어',
    'vo': '볼라퓌크어',
    'jw': '자바어',
    'fy': '프리지아어',
    'gd': '스코틀랜드 게일어',
    'gv': '맨크스어',
    'kw': '콘월어',
    'co': '코르시카어',
    'fur': '프리울리어',
    'lij': '리구리아어',
    'lmo': '롬바르드어',
    'nap': '나폴리어',
    'pms': '피에몬테어',
    'rm': '로만슈어',
    'sc': '사르데냐어',
    'scn': '시칠리아어',
    'vec': '베네토어',
    'wa': '왈롱어',
    'wuu': '우어',
    'yue': '광둥어',
    'hak': '하카어',
    'nan': '민난어',
    'cdo': '민둥어',
    'cjy': '진어',
    'cmn': '관화',
    'hsn': '샹어',
    'gan': '간어',
    'za': '좡어',
    'ii': '이족어',
    'bo': '티베트어',
    'dz': '종카어',
    'ug': '위구르어',
    'yi': '이디시어',
    'yo': '요루바어',
    'ig': '이그보어',
    'ha': '하우사어',
    'om': '오로모어',
    'so': '소말리어',
    'rw': '르완다어',
    'rn': '룬디어',
    'lg': '루간다어',
    'ln': '링갈라어',
    'kg': '콩고어',
    'lua': '루바어',
    'tpi': '토크피신어',
    'tok': '토키포나어',
    'ht': '아이티어',
    'pap': '파피아멘토어',
    'ay': '아이마라어',
    'gn': '과라니어',
    'qu': '케추아어',
    'nv': '나바호어',
    'chr': '체로키어',
    'oj': '오지브와어',
    'cr': '크리어',
    'iu': '이누이트어',
    'ojb': '오지브와어',
    'oji': '오지브와어',
    'ojs': '오지브와어',
    'ojw': '오지브와어',
    'otw': '오타와어',
    'crg': '미시프어',
    'crc': '론카리요어',
    'crj': '크리어',
    'crk': '크리어',
    'crl': '크리어',
    'crm': '크리어',
    'crr': '크리어',
    'crs': '크리어',
    'csw': '크리어',
    'cwd': '크리어',
    'cwe': '크리어',
    'cwg': '크리어',
    'cwk': '크리어',
    'cwkm': '크리어',
    'cwm': '크리어',
    'cwn': '크리어',
    'cwo': '크리어',
    'cwp': '크리어',
    'cwq': '크리어',
    'cwr': '크리어',
    'cws': '크리어',
    'cwt': '크리어',
    'cwu': '크리어',
    'cwv': '크리어',
    'cww': '크리어',
    'cwx': '크리어',
    'cwy': '크리어'
}

# --- 로깅 설정 ---
def setup_logging(debug: bool = False) -> None:
    """애플리케이션의 로깅을 설정합니다."""
    log_level = logging.DEBUG if debug else logging.INFO
    log_format = '%(asctime)s - %(name)s - %(levelname)s - %(message)s'

    # 루트 로거 설정
    logging.basicConfig(
        level=log_level,
        format=log_format,
        handlers=[
            logging.StreamHandler(sys.stdout), # 콘솔 출력
            logging.FileHandler('translation_server.log', encoding='utf-8') # 파일 출력
        ]
    )

    # 특정 라이브러리의 로그 레벨을 조정하여 불필요한 로그를 줄입니다.
    logging.getLogger('uvicorn').setLevel(logging.INFO)
    logging.getLogger('werkzeug').setLevel(logging.WARNING)

    logger = logging.getLogger(__name__)
    logger.info("로깅 설정이 완료되었습니다.")


# --- 유틸리티 함수 ---

def calculate_retry_delay(attempt: int) -> float:
    """지수 백오프 알고리즘을 사용하여 재시도 지연 시간을 계산합니다.

    Args:
        attempt: 현재 시도 횟수 (0부터 시작)

    Returns:
        float: 대기할 시간 (초)
    """
    delay = INITIAL_RETRY_DELAY * (BACKOFF_FACTOR ** attempt)
    # 지연 시간이 최대값을 초과하지 않도록 제한
    return min(delay, MAX_RETRY_DELAY)


def is_retryable_error(error: Exception) -> bool:
    """주어진 예외가 재시도 가능한지 판단합니다.

    Args:
        error: 발생한 예외 객체

    Returns:
        bool: 재시도 가능 여부
    """
    from .exceptions import NetworkError, APIError, RateLimitError, ServiceUnavailableError

    # 재시도 가능한 예외 타입들
    retryable_types = (
        NetworkError,
        APIError,
        RateLimitError,
        ServiceUnavailableError,
        ConnectionError,
        TimeoutError,
        OSError  # 네트워크 관련 OS 에러
    )

    # 예외 타입 체크
    if isinstance(error, retryable_types):
        return True

    # 특정 에러 메시지 패턴 체크
    retryable_messages = [
        'timeout',
        'connection',
        'network',
        'temporary',
        'rate limit',
        'too many requests',
        'service unavailable',
        'internal server error',
        'bad gateway',
        'gateway timeout'
    ]

    error_msg = str(error).lower()
    return any(msg in error_msg for msg in retryable_messages)


def validate_language_code(language_code: str) -> bool:
    """지원되는 언어 코드인지 검증합니다.

    Args:
        language_code: 검증할 언어 코드

    Returns:
        bool: 지원 여부
    """
    return language_code in SUPPORTED_LANGUAGES


def get_language_name(language_code: str) -> str:
    """언어 코드를 해당 언어 이름으로 변환합니다.

    Args:
        language_code: 언어 코드

    Returns:
        str: 언어 이름 (지원하지 않는 경우 코드 자체 반환)
    """
    return SUPPORTED_LANGUAGES.get(language_code, language_code)


def get_popular_languages() -> List[str]:
    """인기 있는 언어 코드 목록을 반환합니다.

    Returns:
        List[str]: 인기 언어 코드 목록 (상위 10개)
    """
    # 사용 빈도가 높은 주요 언어들
    popular_codes = [
        'ko', 'en', 'ja', 'zh', 'es', 'fr', 'de', 'ru', 'pt', 'it'
    ]
    return popular_codes


def get_language_options_html() -> str:
    """웹 인터페이스에서 사용할 언어 옵션 HTML을 생성합니다.

    Returns:
        str: HTML 옵션 태그들
    """
    options = []
    popular_langs = get_popular_languages()

    for lang_code in popular_langs:
        lang_name = get_language_name(lang_code)
        selected = ' selected' if lang_code == 'ko' else ''
        options.append(f'            <option value="{lang_code}"{selected}>{lang_name}</option>')

    return '\n'.join(options)


# --- 핵심 서비스 클래스 ---

class ConfigManager:
    """JSON 설정 파일을 관리하는 클래스 (읽기, 쓰기, 유효성 검사).

    환경변수를 우선적으로 사용하며, config.json을 fallback으로 활용합니다.
    """

    def __init__(self, config_path: str = 'config.json') -> None:
        self.config_path = config_path
        self._config: Optional[Dict[str, Any]] = None  # 로드된 설정을 캐싱하기 위한 변수
        self.logger = logging.getLogger(__name__)

    def load(self) -> Dict[str, Any]:
        """설정 파일을 로드하고 JSON으로 파싱합니다."""
        try:
            with open(self.config_path, 'r', encoding='utf-8') as f:
                config_text = f.read()

            # JSON 파일 내의 주석(#으로 시작)을 제거하여 파싱 용이하게 합니다.
            lines = []
            for line in config_text.split('\n'):
                if '#' in line:
                    line = line[:line.find('#')].rstrip()
                if line.strip():
                    lines.append(line)

            config_text_cleaned = '\n'.join(lines)
            config = json.loads(config_text_cleaned)

            # 설정 데이터가 올바른 딕셔너리 형태인지 검증합니다.
            if not isinstance(config, dict):
                raise ValueError("설정 파일은 반드시 JSON 객체(딕셔너리) 형태여야 합니다.")

            self._config = cast(Dict[str, Any], config)
            self.logger.info("설정 파일을 성공적으로 로드했습니다.")
            return self._config

        except FileNotFoundError:
            raise FileNotFoundError(f"설정 파일을 찾을 수 없습니다: {self.config_path}")
        except json.JSONDecodeError as e:
            raise ValueError(f"설정 파일의 JSON 형식이 잘못되었습니다: {e}")
        except Exception as e:
            raise RuntimeError(f"설정 파일을 로드하는 데 실패했습니다: {e}")

    def get_config(self) -> Dict[str, Any]:
        """환경변수를 우선적으로 사용하여 설정 정보를 가져옵니다.

        환경변수가 설정되어 있지 않으면 config.json 파일을 fallback으로 사용합니다.
        이 방식을 통해 보안과 유연성을 동시에 확보합니다.
        """
        # 환경변수에서 API 키를 우선적으로 확인합니다 (보안 우수)
        gemini_key = os.getenv('GEMINI_API_KEY')
        openai_key = os.getenv('OPENAI_API_KEY')

        # 환경변수가 하나라도 설정되어 있으면 config.json을 로드하지 않고 환경변수만 사용
        if gemini_key or openai_key:
            config_from_env = {
                'gemini': {
                    'api_keys': [gemini_key] if gemini_key else []
                },
                'openai': {
                    'api_key': openai_key or ''
                },
                'presets': {  # 최근 사용한 모델 정보를 저장하기 위한 프리셋
                    'models': [],
                    'targets': []
                }
            }
            self._config = config_from_env
            self.logger.debug("환경변수로부터 설정을 안전하게 로드했습니다.")
            return self._config

        # 환경변수가 없는 경우 기존 로직으로 config.json에서 로드 (하위 호환성 유지)
        return self.__get_config_from_file()

    def __get_config_from_file(self) -> Dict[str, Any]:
        """캐시된 설정 정보를 반환하거나 새로 로드합니다."""
        if self._config is None:  # 캐시에 없으면 파일에서 로드
            self._config = self.load()
        return self._config

    def save_config(self, config: Dict[str, Any]) -> None:
        """설정 정보를 JSON 파일로 저장합니다."""
        with open(self.config_path, 'w', encoding='utf-8') as f:
            json.dump(config, f, indent=2, ensure_ascii=False)


class GeminiTranslator:
    """Google Gemini AI API를 사용하여 텍스트 번역을 수행하는 클래스.

    여러 API 키를 로테이션하여 안정적인 서비스를 제공합니다.
    """

    def __init__(self, config_manager: ConfigManager) -> None:
        self.config_manager = config_manager
        self.logger = logging.getLogger(__name__)

    def validate_api_keys(self) -> List[str]:
        """설정된 Gemini API 키들의 유효성을 검사하고 리스트로 반환합니다."""
        config = self.config_manager.get_config()
        api_keys = config.get('gemini', {}).get('api_keys', [])

        # API 키가 없거나 빈 값이 있으면 오류 발생
        if not api_keys or not all(api_keys):
            raise APIKeyError(
                "Gemini API 키가 설정되지 않았습니다. "
                ".env 파일에 GEMINI_API_KEY를 설정하거나, "
                ".env.example 파일을 참고하여 환경변수를 구성해주세요."
            )

        return api_keys

    def translate(self, text: str, model_name: str, target_language: str) -> str:
        """지정된 Gemini 모델을 사용하여 입력 텍스트를 목표 언어로 번역합니다.

        재시도 로직을 포함하여 안정적인 번역 서비스를 제공합니다.

        Args:
            text: 번역할 원본 텍스트
            model_name: 사용할 Gemini 모델 이름
            target_language: 목표 언어 코드

        Returns:
            번역된 텍스트

        Raises:
            Exception: 최대 재시도 횟수 초과 시
        """
        api_keys = self.validate_api_keys()
        selected_key = random.choice(api_keys)  # 부하 분산을 위해 무작위 키 선택

        # 재시도 로직을 통한 안정적인 API 호출
        for attempt in range(MAX_RETRIES):
            try:
                # Gemini API 초기화 및 설정
                genai.configure(api_key=selected_key)
                model = genai.GenerativeModel(model_name)

                # 번역 프롬프트 구성
                prompt = f"Translate the following text to {target_language}: \n\n{text}"
                response = model.generate_content(prompt)

                return response.text

            except Exception as e:
                # 마지막 시도가 아니면 재시도
                if attempt < MAX_RETRIES - 1:
                    if is_retryable_error(e):
                        delay = calculate_retry_delay(attempt)
                        self.logger.warning(
                            f"Gemini 번역 시도 {attempt + 1} 실패: {e}. "
                            f"{delay}초 후 재시도합니다."
                        )
                        import time
                        time.sleep(delay)
                        continue
                    else:
                        # 재시도 불가능한 에러는 즉시 발생
                        raise

                # 마지막 시도에서도 실패한 경우
                self.logger.error(f"Gemini 번역 최종 실패: {e}")
                raise

    async def translate_stream(self, text: str, model_name: str, target_language: str):
        """Gemini API를 사용하여 스트리밍 방식으로 텍스트를 번역합니다."""
        api_keys = self.validate_api_keys()
        selected_key = random.choice(api_keys)
        genai.configure(api_key=selected_key)
        model = genai.GenerativeModel(model_name)
        prompt = f"Translate the following text to {target_language}: \n\n{text}"
        
        response_stream = await model.generate_content_async(prompt, stream=True)
        
        async for chunk in response_stream:
            # Check for prompt_feedback to avoid yielding empty or non-text chunks
            if not chunk.prompt_feedback:
                yield chunk.text


class OpenAITranslator:
    """OpenAI GPT API를 사용하여 텍스트 번역을 수행하는 클래스."""

    def __init__(self, config_manager: ConfigManager) -> None:
        self.config_manager = config_manager

    def validate_api_key(self) -> str:
        """설정에서 OpenAI API 키를 가져와 유효성을 검사합니다.

        Returns:
            str: 유효한 API 키

        Raises:
            APIKeyError: API 키가 없는 경우
        """
        config = self.config_manager.get_config()
        api_key = config.get('openai', {}).get('api_key')

        if not api_key:
            raise APIKeyError(
                "OpenAI API 키가 설정되지 않았습니다. "
                ".env 파일에 OPENAI_API_KEY를 설정하거나, "
                ".env.example 파일을 참고하여 환경변수를 구성해주세요."
            )

        return api_key

    def translate(self, text: str, model_name: str, target_language: str) -> str:
        """지정된 OpenAI 모델을 사용하여 입력 텍스트를 목표 언어로 번역합니다.

        재시도 로직을 포함하여 안정적인 번역 서비스를 제공합니다.

        Args:
            text: 번역할 원본 텍스트
            model_name: 사용할 GPT 모델 이름
            target_language: 목표 언어 코드

        Returns:
            번역된 텍스트

        Raises:
            Exception: 최대 재시도 횟수 초과 시
        """
        api_key = self.validate_api_key()

        # 재시도 로직을 통한 안정적인 API 호출
        for attempt in range(MAX_RETRIES):
            try:
                client = OpenAI(api_key=api_key)

                # OpenAI Chat Completion API 호출
                response = client.chat.completions.create(
                    model=model_name,
                    messages=[
                        {"role": "system", "content": f"You are a translator. Translate the given text to {target_language}."},
                        {"role": "user", "content": text}
                    ]
                )

                # 응답에서 번역 텍스트 추출
                content = response.choices[0].message.content
                return content if content is not None else ""

            except Exception as e:
                # 마지막 시도가 아니면 재시도
                if attempt < MAX_RETRIES - 1:
                    if is_retryable_error(e):
                        delay = calculate_retry_delay(attempt)
                        logging.getLogger(__name__).warning(
                            f"OpenAI 번역 시도 {attempt + 1} 실패: {e}. "
                            f"{delay}초 후 재시도합니다."
                        )
                        import time
                        time.sleep(delay)
                        continue
                    else:
                        # 재시도 불가능한 에러는 즉시 발생
                        raise

                # 마지막 시도에서도 실패한 경우
                logging.getLogger(__name__).error(f"OpenAI 번역 최종 실패: {e}")
                raise

    async def translate_stream(self, text: str, model_name: str, target_language: str):
        """OpenAI API를 사용하여 스트리밍 방식으로 텍스트를 번역합니다."""
        api_key = self.validate_api_key()
        client = OpenAI(api_key=api_key)
        
        response_stream = await client.chat.completions.create(
            model=model_name,
            messages=[
                {"role": "system", "content": f"You are a translator. Translate the given text to {target_language}."},
                {"role": "user", "content": text}
            ],
            stream=True
        )
        
        async for chunk in response_stream:
            content = chunk.choices[0].delta.content
            if content is not None:
                yield content


class TranslationService:
    """다양한 번역 제공자를 총괄하는 메인 서비스 클래스.

    Gemini와 OpenAI API를 모두 지원하며, 자동으로 적절한 번역자를 선택합니다.
    """

    def __init__(self, config_manager: ConfigManager) -> None:
        self.config_manager = config_manager
        # 번역자 인스턴스들을 미리 생성하여 재사용
        self.gemini_translator = GeminiTranslator(config_manager)
        self.openai_translator = OpenAITranslator(config_manager)
        self.logger = logging.getLogger(__name__)

    def translate(self, text: str, model_name: str, target_language: str) -> str:
        """모델 이름에 따라 적절한 번역 제공자를 자동 선택하여 번역을 수행합니다.

        Args:
            text: 번역할 원본 텍스트
            model_name: 사용할 AI 모델 이름
            target_language: 목표 언어 코드

        Returns:
            번역된 텍스트

        Raises:
            ValueError: 지원하지 않는 모델인 경우
        """
        if 'gemini' in model_name:
            # Gemini 모델의 경우 Gemini 번역자 사용
            return self.gemini_translator.translate(text, model_name, target_language)
        elif 'gpt' in model_name:
            # GPT 모델의 경우 OpenAI 번역자 사용
            return self.openai_translator.translate(text, model_name, target_language)
        else:
            # 지원하지 않는 모델인 경우 오류 발생
            raise ValueError(f"지원하지 않는 모델입니다: {model_name}")

    async def translate_stream(self, text: str, model_name: str, target_language: str):
        """모델 이름에 따라 적절한 번역 제공자를 선택하여 스트리밍 번역을 수행합니다."""
        if 'gemini' in model_name:
            async for chunk in self.gemini_translator.translate_stream(text, model_name, target_language):
                yield chunk
        elif 'gpt' in model_name:
            async for chunk in self.openai_translator.translate_stream(text, model_name, target_language):
                yield chunk
        else:
            raise ValueError(f"지원하지 않는 모델입니다: {model_name}")

    def get_available_models(self, provider: str) -> List[str]:
        """지정된 제공업체의 사용 가능한 모델 목록을 가져옵니다.

        최근 사용한 모델들을 우선적으로 표시하여 사용자 편의성을 높입니다.

        Args:
            provider: 'gemini' 또는 'openai'

        Returns:
            중복 제거된 모델 이름 리스트
        """
        config = self.config_manager.get_config()
        available_models = []

        # 설정 파일의 프리셋 모델을 먼저 추가하여 사용자 경험 향상
        presets = config.get('presets', {}).get('models', [])
        provider_filter = 'gemini' if provider == 'gemini' else 'gpt'
        provider_presets = [model for model in presets if provider_filter in model]
        available_models.extend(provider_presets)

        # 각 API에서 동적으로 최신 모델 목록을 가져옵니다
        if provider == 'gemini':
            available_models.extend(self._get_gemini_models())
        elif provider == 'openai':
            available_models.extend(self._get_openai_models())

        # 중복된 모델 이름을 제거하면서 순서를 유지하여 깔끔한 목록 제공
        seen = set()
        unique_models = []
        for model in available_models:
            if model not in seen:
                seen.add(model)
                unique_models.append(model)

        return unique_models

    def _get_gemini_models(self) -> List[str]:
        """Gemini API에서 사용 가능한 모델 목록을 동적으로 가져옵니다.

        API 호출 실패 시 저장된 목록으로 fallback하여 안정성 확보.
        """
        if not _HAS_GENAI:
            self.logger.error("Google Generative AI 라이브러리가 설치되지 않았습니다.")
            config = self.config_manager.get_config()
            return config.get('gemini', {}).get('available_models', [])

        try:
            # 유효한 API 키 검증
            api_keys = self.gemini_translator.validate_api_keys()
            genai.configure(api_key=random.choice(api_keys))

            models = []
            # API에서 모델 목록을 가져와 텍스트 생성 가능한 모델만 필터링
            for model_info in genai.list_models():
                if 'generateContent' in model_info.supported_generation_methods:
                    models.append(model_info.name)
            return models

        except Exception as e:
            # API 호출 실패 시 로깅하고 저장된 목록으로 대체
            self.logger.error(f"Gemini 모델 목록을 가져오는 데 실패했습니다: {e}")
            config = self.config_manager.get_config()
            return config.get('gemini', {}).get('available_models', [])

    def _get_openai_models(self) -> List[str]:
        """OpenAI API에서 사용 가능한 GPT 모델 목록을 동적으로 가져옵니다.

        API 호출 실패 시 저장된 목록으로 fallback하여 서비스 연속성 유지.
        """
        if not _HAS_OPENAI:
            self.logger.error("OpenAI 라이브러리가 설치되지 않았습니다.")
            config = self.config_manager.get_config()
            return config.get('openai', {}).get('available_models', [])

        try:
            # API 키 유효성 검증 및 플레이스홀더 검사 강화
            api_key = self.openai_translator.validate_api_key()

            # 플레이스홀더 값 검증 강화
            placeholder_values = [
                'your_openai_api_key_here',
                'YOUR_OPENAI_API_KEY_HERE',
                'sk-...your_openai_api_key_here',
                'your_api_key_here'
            ]

            if api_key in placeholder_values:
                raise ValueError(
                    "OpenAI API 키가 플레이스홀더 값으로 설정되어 있습니다. "
                    "실제 API 키로 변경해주세요."
                )

            # API 키 형식 검증 (OpenAI 키는 'sk-'로 시작)
            if not api_key.startswith('sk-'):
                raise ValueError(
                    "OpenAI API 키 형식이 올바르지 않습니다. "
                    "'sk-'로 시작하는 유효한 키를 입력해주세요."
                )

            # OpenAI 클라이언트 생성 및 API 호출
            client = OpenAI(api_key=api_key)
            account_info = client.models.list()
            return [model.id for model in account_info.data]

        except Exception as e:
            # API 호출 실패 시 로깅하고 저장된 목록으로 대체
            self.logger.error(f"OpenAI 모델 목록을 가져오는 데 실패했습니다: {e}")
            config = self.config_manager.get_config()
            return config.get('openai', {}).get('available_models', [])

    def save_preset_model(self, model_name: str) -> None:
        """성공적으로 사용된 모델을 프리셋에 저장하여 다음 사용 시 우선 표시합니다.

        최대 개수 제한을 유지하여 프리셋이 무한히 증가하지 않도록 관리합니다.

        Args:
            model_name: 저장할 모델 이름
        """
        config = self.config_manager.get_config()

        # 프리셋 구조가 없는 경우 초기화
        if 'presets' not in config:
            config['presets'] = {'models': [], 'targets': []}

        presets = config['presets']['models']

        # 중복 방지를 위해 이미 존재하는지 확인
        if model_name not in presets:
            # 가장 최근 사용한 모델을 맨 앞에 추가하여 우선 표시
            presets.insert(0, model_name)
            # 최대 프리셋 개수를 초과하면 가장 오래된 모델을 자동 제거
            if len(presets) > MAX_PRESETS:
                presets[:] = presets[:MAX_PRESETS]

            # 변경사항을 설정 파일에 저장
            self.config_manager.save_config(config)
            self.logger.info(f"모델 '{model_name}'이(가) 프리셋에 저장되었습니다.")
