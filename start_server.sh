#!/bin/bash
# Wrapper to start the translation server

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
"$SCRIPT_DIR/backend/server.sh" start "$@"
