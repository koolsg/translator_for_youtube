# 🔤 YouTube Translator & Notes Project

## 프로젝트 개요
이 프로젝트는 YouTube 동영상의 자막을 추출하여 AI(Gemini, OpenAI)로 번역하고, 번역된 내용을 메모로 관리할 수 있는 로컬 서비스입니다.
- **Backend:** FastAPI (Python)를 기반으로 번역 API와 노트 API를 제공합니다.
- **Frontend:** 
  - Chrome 및 Firefox 확장 프로그램: 유튜브 페이지에서 자막을 추출하고 번역 요청을 보냅니다.
  - Notes Web UI: 번역된 내용이나 개인 메모를 관리할 수 있는 웹 인터페이스입니다.
- **Infrastructure:** `uv` 패키지 매니저를 사용하며, Linux 환경에서 `systemd`를 통한 자동 시작 및 PyInstaller를 통한 바이너리 빌드를 지원합니다.

## 프로젝트 구조
- `backend/`: FastAPI 서버 소스 코드
  - `core/`: 설정, 상수, 예외 처리 등 공통 모듈
  - `modules/`: 
    - `translator/`: 자막 추출 및 AI 번역 기능
    - `notes/`: 메모 CRUD 및 검색 기능
  - `main.py`: 서비스 엔트리 포인트 (Sub-apps 마운트 및 정적 파일 서빙)
- `frontend/`:
  - `chrome_extension/`: 크롬 브라우저용 확장 프로그램
  - `firefox_extension/`: 파이어폭스 브라우저용 확장 프로그램
  - `notes/`: 메모 관리용 Vanilla JS/CSS 웹 UI

## 빌드 및 실행 가이드

### 백엔드 실행
- **개발 모드 (uv 사용):**
  ```bash
  cd backend
  ./server.sh start
  ```
- **바이너리 빌드 (PyInstaller):**
  ```bash
  cd backend
  bash build.sh
  ```
- **서비스 등록 (Linux systemd):**
  ```bash
  cd backend
  bash register_startup.sh install
  ```

### 프론트엔드 배포
- **확장 프로그램 배포:**
  ```bash
  cd frontend
  bash deploy.sh
  ```
  이후 브라우저에서 `~/.local/share/browser-extensions/translator_for_youtube` 경로를 '압축해제된 확장 프로그램'으로 로드합니다.

## 개발 규칙 및 컨벤션
- **API 설계:** 모든 API 엔드포인트는 `/api/` 프리픽스를 가집니다. (예: `/api/translator`, `/api/notes`)
- **의존성 관리:** `uv`를 사용하여 `pyproject.toml` 및 `uv.lock` 파일을 관리합니다. 새로운 패키지 추가 시 `uv add`, 제거 시 `uv remove`를 사용하세요.
- **알림 기능:** 알림은 백엔드가 아닌 **프론트엔드(브라우저 확장)**에서 담당합니다. 번역 완료 시 브라우저의 `chrome.notifications` 또는 `browser.notifications` API를 사용합니다.
- **정적 파일 서빙:** `backend/main.py`에서 `/notes` 경로로 노트 UI(`frontend/notes/index.html`)를 서빙합니다.
- **에러 핸들링:** FastAPI의 `HTTPException`을 사용하여 명확한 상태 코드와 메시지를 반환하며, 클라이언트에서 이를 적절히 처리합니다.

## 주요 파일 설명
- `backend/main.py`: 서버 초기화, 미들웨어 설정, 라우터 마운트 담당.
- `backend/modules/translator/router.py`: 번역 및 스트리밍 번역 로직 포함.
- `backend/modules/notes/router.py`: 메모 CRUD API 정의.
- `frontend/notes/index.html`: 단일 파일로 구성된 메모 앱 UI (Vanilla JS).
- `frontend/chrome_extension/translator_ui.js`: 확장 프로그램의 핵심 로직 및 백엔드 통신 담당.
