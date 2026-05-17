"""번역 프롬프트 템플릿 모음.

모든 번역 프롬프트를 한 곳에서 관리하여 일관성을 유지합니다.
프롬프트 수정이 필요할 때 이 파일만 변경하면 됩니다.
"""


def build_translation_prompt(text: str, target_lang_name: str, target_language: str) -> str:
    """Gemini 모델용 번역 프롬프트를 생성합니다.

    Args:
        text: 번역할 원본 텍스트
        target_lang_name: 목표 언어 이름 (예: '한국어')
        target_language: 목표 언어 코드 (예: 'ko')

    Returns:
        완성된 프롬프트 문자열
    """
    return f"""Translate the following text to {target_lang_name} ({target_language}).

IMPORTANT INSTRUCTIONS:
- Some lines start with tags like [SEG-0001]. Keep every tag EXACTLY as-is in the output and leave it at the start of the same line. Do not translate, delete, move, or rename tags.
- Translate only the text after each tag.
- Preserve the original line breaks.
- Output ONLY the translated text (with tags kept). Do NOT add introductions or explanations.

Text to translate:
{text}"""


def build_openai_system_prompt(target_language: str) -> str:
    """OpenAI 모델용 시스템 프롬프트를 생성합니다.

    Args:
        target_language: 목표 언어 코드 (예: 'ko')

    Returns:
        완성된 시스템 프롬프트 문자열
    """
    return (
        "You are a translation assistant. "
        f"Translate all user text to {target_language}. "
        "IMPORTANT INSTRUCTIONS:\n"
        "- Some lines begin with tags like [SEG-0001]. Keep every tag EXACTLY as-is at the start of the same line. "
        "Do not translate, delete, move, or rename these tags.\n"
        "- Translate only the text after each tag.\n"
        "- Preserve all original line breaks.\n"
        "- Output ONLY the translated text (with the tags kept). Do NOT add introductions or explanations."
    )
