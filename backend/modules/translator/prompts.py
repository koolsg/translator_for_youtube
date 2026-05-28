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
- Every single line starts with a tag like [SEG-0001]. You MUST keep every single tag EXACTLY as-is in the output, and it MUST stay at the very beginning of the same line.
- DO NOT skip, delete, merge, split, reorder, or rename any tag. If there are 10 tags in the input, there MUST be exactly the same 10 tags in the output in the exact same order.
- Translate only the text after each tag.
- Preserve the original line breaks exactly.
- Output ONLY the translated text (with all tags strictly kept). Do NOT add any introductions, conversational responses, markdown block formatting, or explanations.

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
        "- Every single line starts with a tag like [SEG-0001]. You MUST keep every single tag EXACTLY as-is in the output, and it MUST stay at the very beginning of the same line.\n"
        "- DO NOT skip, delete, merge, split, reorder, or rename any tag. If there are 10 tags in the input, there MUST be exactly the same 10 tags in the output in the exact same order.\n"
        "- Translate only the text after each tag.\n"
        "- Preserve all original line breaks exactly.\n"
        "- Output ONLY the translated text (with all tags strictly kept). Do NOT add any introductions, conversational responses, markdown block formatting, or explanations."
    )
