#!/bin/bash

# ========================================================
# Combined Server Management Script (Linux)
# Unifies start_server.sh and stop_server.sh
# Usage: ./server.sh start [-f/--force]
#        ./server.sh stop [-f/--force] [-v/--verbose]
# ========================================================

ACTION=$1
FORCE=0
VERBOSE=0

# Shift past the action
shift

# Parse remaining arguments
while [[ "$#" -gt 0 ]]; do
    case $1 in
        -f|--force) FORCE=1 ;;
        -v|--verbose) VERBOSE=1 ;;
        *) echo "Unknown parameter passed: $1"; exit 1 ;;
    esac
    shift
done

# Validate action
if [[ "$ACTION" != "start" && "$ACTION" != "stop" ]]; then
    echo "Action must be one of: start, stop"
    exit 1
fi

if [[ "$VERBOSE" -eq 1 && "$ACTION" != "stop" ]]; then
    echo "The '-v/--verbose' parameter is only valid when Action is 'stop'."
    exit 1
fi

# Define common paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
MAIN_PATH="$SCRIPT_DIR/main.py"
PID_PATH="$SCRIPT_DIR/app.pid"
PORT=5000

# ================================
# Common Functions
# ================================

test_environment() {
    if ! command -v /home/koolsg/.local/bin/uv &> /dev/null; then
        echo "Error: 'uv' is not installed at /home/koolsg/.local/bin/uv. Please install it first."
        exit 1
    fi
    if [[ "$ACTION" == "start" && ! -f "$MAIN_PATH" ]]; then
        echo "Error: Application file not found at $MAIN_PATH"
        exit 1
    fi
}

# ================================
# Start Server Functions
# ================================

test_existing_server() {
    # Check if port is in use
    if command -v ss >/dev/null 2>&1; then
        LISTENING=$(ss -tulnp | grep ":$PORT " | grep "LISTEN")
    elif command -v lsof >/dev/null 2>&1; then
        LISTENING=$(lsof -i :$PORT -sTCP:LISTEN -t)
    else
        LISTENING=$(netstat -anp | grep ":$PORT " | grep "LISTEN")
    fi

    if [[ -n "$LISTENING" ]]; then
        echo "Error: Port $PORT is already in use."
        exit 1
    fi

    # Check PID file
    if [[ -f "$PID_PATH" ]]; then
        EXISTING_PID=$(cat "$PID_PATH")
        if kill -0 "$EXISTING_PID" 2>/dev/null; then
            if [[ "$FORCE" -eq 0 ]]; then
                echo "Error: Server already running (PID: $EXISTING_PID)"
                exit 1
            fi
            echo "Force restart: terminating existing server..."
            kill -9 "$EXISTING_PID" 2>/dev/null
        fi
        rm -f "$PID_PATH"
    fi
}

start_server_process() {
    echo "Starting server via uv..."
    cd "$SCRIPT_DIR" || exit 1
    nohup /home/koolsg/.local/bin/uv run python main.py > translation_server.log 2>&1 &
    PROCESS_ID=$!

    sleep 2

    if ! kill -0 "$PROCESS_ID" 2>/dev/null; then
        echo "Error: Server failed to start. Check translation_server.log in backend directory."
        exit 1
    fi

    echo "$PROCESS_ID" > "$PID_PATH"
    echo "Server started successfully (PID: $PROCESS_ID)"
}

# ================================
# Stop Server Functions
# ================================

stop_all_processes() {
    local main_pid=$1

    if [[ "$VERBOSE" -eq 1 ]]; then
        echo "Shutting down server process PID: $main_pid"
    fi

    # Attempt to gracefully stop
    if [[ "$FORCE" -eq 0 ]]; then
        kill "$main_pid" 2>/dev/null
        sleep 1
        if ! kill -0 "$main_pid" 2>/dev/null; then
            echo "[OK] Main process stopped gracefully: $main_pid"
            return 0
        fi
    fi

    # Force kill if needed
    kill -9 "$main_pid" 2>/dev/null
    echo "[OK] Main process force-stopped: $main_pid"
    
    # In Linux, if uvicorn spawns workers, they might need to be explicitly killed.
    # Uvicorn usually cleans up its own workers on SIGTERM, but SIGKILL might leave orphans.
    # Searching for orphaned python processes running uvicorn on standard port as fallback:
    pkill -f "uvicorn.*--port $PORT" 2>/dev/null
    
    return 0
}

# ================================
# Main Execution
# ================================

if [[ "$ACTION" == "start" ]]; then
    echo "Translation Server Startup"
    echo "========================================"
    test_environment
    echo "Environment check passed"
    test_existing_server
    echo "Server availability check passed"
    start_server_process
    echo "========================================"
    echo "Ready! Use './server.sh stop' to stop."

elif [[ "$ACTION" == "stop" ]]; then
    echo "Translation Server Shutdown"
    echo "========================================"
    if [[ "$VERBOSE" -eq 1 ]]; then
        echo "Script Directory: $SCRIPT_DIR"
        echo "PID File Path: $PID_PATH"
    fi

    test_environment
    echo "[OK] Environment check passed"

    if [[ ! -f "$PID_PATH" ]]; then
        echo "========================================"
        echo "No valid PID file found. Server may not be running."
        exit 0
    fi

    PID=$(cat "$PID_PATH")
    if ! kill -0 "$PID" 2>/dev/null; then
        echo "========================================"
        echo "Server was not running or already stopped."
        rm -f "$PID_PATH"
        exit 0
    fi

    echo "[OK] Server status check passed"
    echo ""

    stop_all_processes "$PID"
    rm -f "$PID_PATH"

    echo ""
    echo "========================================"
    echo "SUCCESS: Server stopped successfully."
fi
