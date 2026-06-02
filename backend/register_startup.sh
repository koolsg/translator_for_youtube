#!/bin/bash
# ========================================================
# Linux 자동 시작 등록 스크립트 (Windows의 register_startup.ps1 역할)
#
# [설치]   ./register_startup.sh install
# [제거]   ./register_startup.sh uninstall
# [상태]   ./register_startup.sh status
# ========================================================

ACTION=${1:-install}
SERVICE_NAME="local-service"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
SERVICE_SRC="$SCRIPT_DIR/local-service.service"

# 사용자 systemd 디렉터리
SYSTEMD_USER_DIR="$HOME/.config/systemd/user"
SERVICE_DEST="$SYSTEMD_USER_DIR/$SERVICE_NAME.service"

# 서비스 파일의 WorkingDirectory를 실제 경로로 업데이트
update_service_paths() {
    sed -i \
        "s|WorkingDirectory=.*|WorkingDirectory=$SCRIPT_DIR|g; \
         s|Environment=VIRTUAL_ENV=.*|Environment=VIRTUAL_ENV=$SCRIPT_DIR/.venv|g; \
         s|ExecStart=.*|ExecStart=$SCRIPT_DIR/server.sh start|g; \
         s|ExecStop=.*|ExecStop=$SCRIPT_DIR/server.sh stop|g; \
         s|PIDFile=.*|PIDFile=$SCRIPT_DIR/app.pid|g" \
        "$SERVICE_DEST"
}

install_service() {
    echo "=== 서비스 설치 ==="

    # 서비스 파일 존재 확인
    if [[ ! -f "$SERVICE_SRC" ]]; then
        echo "Error: 서비스 파일을 찾을 수 없습니다: $SERVICE_SRC"
        exit 1
    fi

    # 경로 생성 및 서비스 파일 복사
    mkdir -p "$SYSTEMD_USER_DIR"
    cp "$SERVICE_SRC" "$SERVICE_DEST"
    update_service_paths

    # 부팅 시 자동 시작을 위한 lingering 활성화 (sudo 필요, 딱 한 번만)
    if loginctl show-user "$USER" 2>/dev/null | grep -q "Linger=no"; then
        echo ">> 부팅 시 자동 시작을 위해 lingering을 활성화합니다 (sudo 필요)..."
        sudo loginctl enable-linger "$USER"
    fi

    # systemd 데몬 재로드 및 서비스 활성화
    systemctl --user daemon-reload
    systemctl --user enable "$SERVICE_NAME"

    # 이미 서비스가 구동 중이면 새 빌드가 실행되도록 재시작하고, 꺼져있으면 새로 시작합니다.
    if systemctl --user is-active --quiet "$SERVICE_NAME"; then
        echo ">> 기존 서비스가 구동 중입니다. 최신 빌드로 재시작합니다..."
        systemctl --user restart "$SERVICE_NAME"
    else
        echo ">> 서비스를 시작합니다..."
        systemctl --user start "$SERVICE_NAME"
    fi

    echo ""
    echo "[OK] 설치 완료! '$SERVICE_NAME' 서비스가 등록되어 자동으로 시작됩니다."
    echo "     상태 확인: systemctl --user status $SERVICE_NAME"
}

uninstall_service() {
    echo "=== 서비스 제거 ==="

    systemctl --user stop "$SERVICE_NAME" 2>/dev/null
    systemctl --user disable "$SERVICE_NAME" 2>/dev/null
    rm -f "$SERVICE_DEST"
    systemctl --user daemon-reload

    echo "[OK] '$SERVICE_NAME' 서비스가 제거되었습니다."
}

status_service() {
    echo "=== 서비스 상태 ==="
    systemctl --user status "$SERVICE_NAME"
}

case "$ACTION" in
    install)   install_service ;;
    uninstall) uninstall_service ;;
    status)    status_service ;;
    *)
        echo "Usage: $0 [install|uninstall|status]"
        exit 1
        ;;
esac
