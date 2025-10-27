"""
Environment validation utilities for the Translation API Server.

This module handles validation of environment variables and provides
user-friendly configuration guidance.
"""

import os


def validate_environment() -> None:
    """Validate required environment variables and provide user guidance.

    Checks for required API keys and provides clear error messages
    if configuration is missing or incomplete.

    Raises:
        SystemExit: When required configuration is missing
    """
    required_env_vars = {
        'GEMINI_API_KEY': 'Google Gemini AI API 키',
        'OPENAI_API_KEY': 'OpenAI API 키'
    }

    missing_vars: list[str] = []
    warnings: list[str] = []

    # Check each environment variable
    for env_var, _ in required_env_vars.items():
        value = os.getenv(env_var)
        if not value:
            missing_vars.append(env_var)
        elif value in ['your_gemini_api_key_here', 'your_openai_api_key_here']:
            warnings.append(f"{env_var}: 기본 플레이스홀더 값이 설정되어 있습니다.")

    # Handle missing variables
    if missing_vars:
        print("❌ 필수 환경변수가 설정되지 않았습니다:")
        print("📝 다음 파일에 설정을 추가해주세요:")
        print("   - .env")
        print("   - .env.example (템플릿 파일)")
        print()
        print("📋 설정 방법:")
        for var, desc in required_env_vars.items():
            if var in missing_vars:
                print(f"   {var}={desc}")
        print()
        print("💡 설정 후 다시 서버를 시작해주세요.")
        print("🔗 자세한 설정 가이드: .env.example 파일 참조")
        raise SystemExit(1)

    # Display warnings for placeholder values
    if warnings:
        print("⚠️ 경고: 일부 환경변수가 기본값으로 설정되어 있습니다:")
        for warning in warnings:
            print(f"   - {warning}")
        print()

    print("✅ 환경변수 검증 완료: 모든 필수 변수가 설정되어 있습니다.")
