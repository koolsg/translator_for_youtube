#!/bin/bash

# =================================================================
# Translator for YouTube - Stable Deployment Script
# 이 스크립트는 개발 폴더의 파일을 브라우저 로드용 고정 경로로 복사합니다.
# =================================================================

# 1. 설정
DEST_DIR="$HOME/.local/share/browser-extensions/translator_for_youtube"
SCRIPT_DIR=$(dirname "$(readlink -f "$0")")
SOURCE_DIR="$SCRIPT_DIR/chrome_extension"

echo "📦 확장 프로그램 배포를 시작합니다..."
echo "📂 소스: $SOURCE_DIR"
echo "📂 대상: $DEST_DIR"

# 2. 대상 디렉토리 생성 및 정리
echo "🧹 대상 폴더 정리 중..."
mkdir -p "$DEST_DIR"
# 안전한 삭제를 위해 DEST_DIR이 비어있지 않은지 확인 후 정리
if [ -d "$DEST_DIR" ]; then
    rm -rf "${DEST_DIR:?}"/*
fi

# 3. 필수 파일 목록 (chrome_extension 기준)
FILES=(
    "manifest.json"
    "background.js"
    "content.js"
    "translator_ui.html"
    "translator_ui.js"
    "icon.svg"
    "pen.svg"
)

# 4. 파일 복사
echo "🚚 파일 복사 중..."
for FILE in "${FILES[@]}"; do
    if [ -f "$SOURCE_DIR/$FILE" ]; then
        cp "$SOURCE_DIR/$FILE" "$DEST_DIR/"
        echo "  ✅ $FILE 복사 완료"
    else
        echo "  ❌ $FILE 파일을 찾을 수 없습니다!"
    fi
done

# 5. 추가 리소스 폴더가 있다면 복사 (현재는 파일만 존재)
# if [ -d "$SOURCE_DIR/assets" ]; then
#     cp -r "$SOURCE_DIR/assets" "$DEST_DIR/"
#     echo "  ✅ assets 폴더 복사 완료"
# fi

echo ""
echo "✨ 배포가 완료되었습니다!"
echo "💡 브라우저(chrome://extensions)에서 다음 경로를 '압축해제된 확장 프로그램'으로 로드하거나 새로고침 해주세요:"
echo "👉 $DEST_DIR"
