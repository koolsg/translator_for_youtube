# 🔤 YouTube Translator

[![Python](https://img.shields.io/badge/Python-3.9+-blue.svg)](https://www.python.org/downloads/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-green.svg)](https://fastapi.tiangolo.com/)
[![Chrome](https://img.shields.io/badge/Chrome-Extension-orange.svg)](https://developer.chrome.com/docs/extensions/)
[![Firefox](https://img.shields.io/badge/Firefox-Addon-red.svg)](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions)
[![Windows](https://img.shields.io/badge/OS-Windows-0078D6.svg)](https://www.microsoft.com/windows)
[![Linux](https://img.shields.io/badge/OS-Linux-FCC624.svg?logo=linux&logoColor=black)](https://www.kernel.org/)

YouTube 동영상의 자막을 AI로 풀번역/요약하는 브라우저 확장 프로그램(Chrome & Firefox)입니다. OpenAI GPT와 Google Gemini를 지원하며, 세그먼트 태깅·스크롤 동기화·네트워크/할당량 진단까지 포함해 **Windows와 Linux 모두**에서 단일 실행 파일 또는 로컬 서버로 사용할 수 있습니다.

![alt text](image-2.png)
![alt text](image.png)

> [!IMPORTANT]
> **🚨 크롬 확장 프로그램 단독 자막 추출 불가 안내**
> 최근 YouTube의 보안 정책 강화로 인해 백엔드 서버가 반드시 필요합니다. 이 프로젝트는 로컬 서버를 통해 이 문제를 해결합니다.

## ✨ 주요 기능

- 🎬 **YouTube 자막 자동 추출**: 백엔드에서 보안 정책을 우회하여 자막을 가져옵니다.
- 🔄 **실시간 번역**: OpenAI, Google Gemini API 연동.
- 🔔 **데스크톱 알림**: 번역 완료 시 시스템 알림 지원 (Windows & Linux).
- 📦 **단일 실행 파일 지원**: 파이썬 설치 없이도 실행 가능한 바이너리 빌드 지원.
- 🛡️ **안정적인 서비스**: 리눅스 `systemd` 자동 재시작 및 무한 루프 방지 안전장치 적용.

## 📁 프로젝트 구조

```
translator_for_youtube/
├── backend/                          # FastAPI 백엔드 서버
│   ├── main.py                       # 서버 엔트리 포인트
│   ├── server.sh / server.ps1        # [Linux/Win] uv run 기반 스마트 실행 스크립트
│   ├── build.sh / build.ps1          # [Linux/Win] 단일 실행 파일 빌드 스크립트
│   ├── local-service.service         # [Linux] systemd 유닛 파일 (안전장치 포함)
│   ├── pyproject.toml                # uv 기반 의존성 및 빌드 설정
│   └── ...
├── frontend/                         # 브라우저 확장 프로그램 (Chrome/Firefox)
└── ...
```

## 🚀 빠른 시작 (개발용)

### 1. 환경 설정
`uv` 패키지 매니저가 설치되어 있어야 합니다.
```bash
# API 키 설정
cp backend/.env.example backend/.env
```

### 2. 패키지 설치 및 실행
가상환경 경로를 직접 관리할 필요 없이 `uv`가 자동으로 처리합니다.
```bash
# Linux
./backend/server.sh start

# Windows (PowerShell)
.\backend\server.ps1 start
```

## 📦 실행 파일 빌드 (배포용)

파이썬이 설치되지 않은 환경에서 사용하거나, 경로 설정 없이 깔끔하게 사용하고 싶을 때 바이너리로 빌드할 수 있습니다.

### 🐧 Linux 바이너리 빌드
```bash
cd backend
./build.sh
# 결과물: backend/dist/translation_server
```

### 🪟 Windows 바이너리 빌드
```powershell
cd backend
.\build.ps1
# 결과물: backend/dist/translation_server_win.exe
```

## 🐧 Linux 자동 시작 설정 (systemd)

리눅스 부팅 시 서버가 자동으로 실행되도록 설정할 수 있습니다.

1. **설치**: `cd backend && ./register_startup.sh install`
2. **특징**:
   - `uv`의 절대 경로를 사용하여 환경 변수와 무관하게 동작합니다.
   - **안전장치**: 5분 내 5회 이상 실패 시 자동으로 재시작을 중단하여 시스템 락업을 방지합니다. (`StartLimitBurst=5`)

## 📖 사용법 (브라우저 등록)

- **Chrome**: `chrome://extensions` -> 개발자 모드 -> `frontend/chrome_extension` 폴더 선택.
- **Firefox**: `about:debugging` -> 이 Firefox -> 임시 부가 기능 로드 -> `frontend/firefox_extension/manifest.json` 선택.

## 🐛 문제 해결

- **서버 무한 재시작**: 가상환경 경로가 꼬였을 경우 `rm -rf .venv` 후 다시 실행하세요.
- **Linux Suspend 이슈**: 구형 스크립트 사용 시 절전 모드 복귀 실패 현상이 있을 수 있습니다. 최신 `server.sh`는 `uv run`을 사용하여 이 문제를 해결했습니다.

---
**문의사항은 GitHub Issues를 통해 알려주세요! 🚀**
