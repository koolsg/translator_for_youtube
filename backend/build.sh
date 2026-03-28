#!/bin/bash
echo "Building Linux Binary..."
uv run pyinstaller --onefile --name translation_server main.py
echo "Build Complete: dist/translation_server"
