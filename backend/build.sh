#!/bin/bash
echo "Building Linux Binary with all dependencies..."
# routes.py 등 로컬 모듈과 .env 파일을 포함하여 빌드
uv run pyinstaller --onefile \
    --name local-service \
    --paths . \
    --add-data ".env:." \
    --add-data "../frontend/notes:notes" \
    --collect-all google.genai \
    --collect-all core \
    --collect-all modules \
    --hidden-import uvicorn.logging \
    --hidden-import uvicorn.loops \
    --hidden-import uvicorn.loops.auto \
    --hidden-import uvicorn.protocols \
    --hidden-import uvicorn.protocols.http \
    --hidden-import uvicorn.protocols.http.auto \
    --hidden-import uvicorn.lifespan \
    --hidden-import uvicorn.lifespan.on \
    main.py
echo "Build Complete: dist/local-service"
