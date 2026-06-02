# 🔤 YouTube Translator & Notes Project

[![Python](https://img.shields.io/badge/Python-3.12+-blue.svg)](https://www.python.org/downloads/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-green.svg)](https://fastapi.tiangolo.com/)
[![Chrome](https://img.shields.io/badge/Chrome-Extension-orange.svg)](https://developer.chrome.com/docs/extensions/)
[![Firefox](https://img.shields.io/badge/Firefox-Addon-red.svg)](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions)
[![Linux](https://img.shields.io/badge/OS-Linux-FCC624.svg?logo=linux&logoColor=black)](https://www.kernel.org/)

YouTube 동영상의 자막을 AI(Gemini, OpenAI)로 번역 및 요약하고, 번역된 텍스트와 개인 메모를 로컬 마크다운 문서 파일로 안전하게 관리·보관할 수 있는 올인원 로컬 생산성 서비스입니다. 

Windows 및 Linux 환경 모두에서 단일 실행 파일 또는 로컬 개발 서버로 기동할 수 있으며, Obsidian Vault와 실시간 연동하여 강력한 노트 필기 및 번역 아카이빙 환경을 구축할 수 있습니다.

---

## 🎨 주요 화면 스크린샷

![alt text](image-2.png)
![alt text](image.png)

---

## ✨ 주요 프리미엄 기능

- 🎬 **YouTube 자막 자동 추출 및 우회**: YouTube 보안 정책 변경을 안전하게 우회하여 영상 속 자막을 정확하게 로컬로 가져옵니다.
- 🔄 **실시간 하이브리드 번역 (스트리밍)**: OpenAI GPT 및 Google Gemini API를 완벽 연동하여 실시간 스트리밍 및 일반 번역 모드를 자유롭게 교차 지원합니다.
- 📑 **Obsidian 연동 Nexus Notes 웹 UI 제공**: 
  - 작성·번역한 메모가 지정된 로컬 Obsidian 폴더(`~/Documents/Obsidian Vault/My_Memos`) 내부에 실제 마크다운(`.md`) 파일로 자동 안전 저장됩니다.
- 👁️ **마크다운 듀얼 모드 (뷰어 & 에디터) 지원**: 
  - 모달을 열면 Obsidian 스타일의 수려하고 가독성 높은 **마크다운 미리보기(Read Mode)**로 렌더링되어 표시됩니다.
  - 미리보기 영역을 클릭하거나 우측 하단의 **[편집]** 버튼을 누르면 즉시 1초 만에 원시 마크다운 텍스트를 수정할 수 있는 **에디터(Edit Mode)**로 스위칭 전환됩니다.
- 🔤 **프리미엄 네온 파비콘(Favicon) 적용**: 펜과 유성(Meteor)을 모티브로 한 세련된 다크모드 전용 네온 파비콘 탭 아이콘을 장착했습니다.
- 🔔 **데스크톱 및 TTS 음성 안내**: 번역 완료 시 시스템 알림음과 미려한 TTS 음성 안내(SpeechSynthesis)를 비동기 지원합니다.
- 🛡️ **지능적인 systemd 서비스 인스톨러**: 최신 릴리즈를 업데이트하여 재설치할 때 구버전 프로세스를 자동 감지 및 종료하고 새 빌드를 강제로 **자동 재시작(Restart)** 처리하여 무중단 설치를 지원합니다.
- 📦 **단일 실행 파일 패키징 고도화**: PyInstaller 컴파일 환경에서 실제 임시 경로가 아닌 바이너리가 실행되는 물리 디렉토리(`sys.executable`) 기준의 `.env` 환경 변수 파일을 안전하게 탐색하고 1순위로 최우선 반영합니다.

---

## 📁 프로젝트 구조

```
translator_for_youtube/
├── backend/                          # FastAPI 백엔드 서버 소스 코드
│   ├── main.py                       # 서버 통합 엔트리 포인트 (서브 앱 라우팅 및 웹 UI 서빙)
│   ├── server.sh / server.ps1        # [Linux/Win] uv run 기반의 스마트 제어 스크립트
│   ├── build.sh / build.ps1          # [Linux/Win] PyInstaller 단일 바이너리 컴파일 빌드 스크립트
│   ├── register_startup.sh           # [Linux] 지능형 systemd 서비스 자동 등록/재시작 스크립트
│   ├── core/                         # 공통 유틸리티, 로깅 설정, 상수, 검증자 모듈
│   └── modules/                      # translator 및 notes 관리 비즈니스 로직
├── frontend/                         # 프론트엔드 리소스 폴더
│   ├── chrome_extension/             # Chrome 브라우저 확장 프로그램 패키지
│   ├── firefox_extension/            # Firefox 브라우저 확장 프로그램 패키지
│   └── notes/                        # Vanilla JS, CSS 기반의 Obsidian 연동형 메모 웹 UI
└── memos/                            # 로컬 기본 메모 적재 백업 폴더
```

---

## 🚀 빠른 시작 (개발자 모드)

### 1. 환경 변수 설정
`backend` 경로에 `.env` 파일을 생성하고 사용하실 AI API 키 및 보관할 메모 디렉토리 경로를 명시합니다.

```bash
cd backend
cp .env.example .env
```

`.env` 파일 내용 구성 예시:
```ini
GEMINI_API_KEY="사용자의_Gemini_API_키"
OPENAI_API_KEY="사용자의_OpenAI_API_키"
NOTES_DIR="/home/koolsg/Documents/Obsidian Vault/My_Memos"  # 사용자 지정 Obsidian 메모 저장소 경로
API_PORT=5000
```

### 2. 패키지 가상환경 설치 및 실행
패키지 의존성 관리 및 실행은 최신 `uv` 도구가 자동으로 즉시 가상환경을 구축하여 대행합니다.

```bash
# Linux에서 로컬 서버 기동
./backend/server.sh start

# Windows (PowerShell)에서 로컬 서버 기동
.\backend\server.ps1 start
```

---

## 📦 단일 실행 파일 빌드 및 배포 (바이너리 모드)

파이썬 환경 및 의존성 패키지 설치가 되지 않은 PC 환경에서 편리하게 단일 실행 파일만 더블클릭하여 구동할 수 있도록 컴파일합니다.

### 🐧 Linux 환경 바이너리 컴파일
```bash
cd backend
bash build.sh
# 최종 단일 바이너리 생성 완료: backend/dist/local-service
```

### 🪟 Windows 환경 바이너리 컴파일
```powershell
cd backend
.\build.ps1
# 최종 단일 바이너리 생성 완료: backend/dist/local-service_win.exe
```

---

## 🐧 Linux 부팅 시 자동 시작 등록 및 배포 (systemd)

Linux 서버 환경이나 데스크탑 환경 부팅 시 백그라운드에 자동으로 기동되도록 systemd 유닛에 안전하게 등록합니다.

```bash
cd backend
# 1. 자동 시작 등록 및 서비스 시작 (기존 구동 중일 경우 최신 바이너리로 자동 강제 재기동)
./register_startup.sh install

# 2. 서비스 상태 확인
./register_startup.sh status

# 3. 자동 시작 서비스 안전 해제 및 제거
./register_startup.sh uninstall
```

> [!TIP]
> **🛡️ 시스템 안전장치 탑재 (`StartLimitBurst=5`)**
> - 바이너리 구동 과정에서 연쇄 오류 등으로 무한 재시작에 빠져 시스템 락업이 걸리지 않도록 5분 내 5회 이상 재기동 실패 시 자동으로 systemd 유닛 재부팅을 강제 중단하는 완벽한 인프라 안전장치가 함께 적용됩니다.

---

## 📖 사용법 및 연동 가이드

### 1. 브라우저 확장 프로그램 등록
- **Google Chrome**: 
  1. 주소창에 `chrome://extensions` 입력 후 접속하여 우측 상단의 **[개발자 모드]**를 활성화합니다.
  2. **[압축해제된 확장 프로그램을 로드]** 버튼을 클릭하여 `frontend/chrome_extension` 디렉토리를 선택합니다.
- **Mozilla Firefox**:
  1. 주소창에 `about:debugging` 입력 후 접속하여 **[이 Firefox]** 탭을 선택합니다.
  2. **[임시 부가 기능 로드]** 버튼을 클릭하여 `frontend/firefox_extension/manifest.json` 파일을 선택합니다.

### 2. Obsidian 연동 Nexus Notes 웹 UI 접속
로컬 서버가 정상 기동된 상태에서 아래 포트 주소로 접속하면, Obsidian 메모 보관 디렉토리에 마크다운 형식 파일로 실시간 읽기/쓰기가 연동되는 아름다운 넥서스 메모장을 만날 수 있습니다!

- **접속 URL:** `http://localhost:5000/notes/`

---

## 🐛 대표적인 트러블슈팅

- **서버가 포트 충돌 또는 무한 재시작될 경우:**
  - 가상환경 경로가 충돌할 수 있으니 `rm -rf backend/.venv`로 가상 폴더를 완전히 제거하신 후 `./server.sh start`로 다시 가동해 주시면 `uv`가 새롭게 환경을 정상 구축합니다.
- **컴파일된 바이너리가 환경 변수를 읽지 못할 경우:**
  - `dist/` 빌드 결과물 실행 폴더 안에 `.env` 파일을 복사해 나란히 배치해 두시면, 바이너리가 이를 1순위로 정확하게 우선 탐색하여 설정 변수들을 반영해 동작합니다.
