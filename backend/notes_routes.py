import os
import re
import logging
import asyncio
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

router = APIRouter()
logger = logging.getLogger(__name__)

NOTES_DIR = os.getenv("NOTES_DIR", "/home/koolsg/Documents/Obsidian Vault/My_Notebook")

if not os.path.exists(NOTES_DIR):
    os.makedirs(NOTES_DIR)

# === 색상 팔레트 정의 ===
VALID_COLORS = {None, "coral", "peach", "sand", "sage", "fog", "storm", "lavender"}

# =====================================================================
# Frontmatter 파서/직렬화 (외부 YAML 라이브러리 없이 직접 구현)
# =====================================================================

def parse_frontmatter(raw: str) -> tuple[dict, str]:
    """마크다운 파일에서 YAML frontmatter를 분리합니다.

    Returns:
        (metadata_dict, body_str)
    """
    defaults = {"pinned": False, "color": None, "tags": [], "archived": False}

    if not raw.startswith("---"):
        return defaults.copy(), raw

    end_match = re.search(r"\n---\s*\n", raw[3:])
    if not end_match:
        return defaults.copy(), raw

    yaml_block = raw[3 : 3 + end_match.start()]
    body = raw[3 + end_match.end() :]

    meta = defaults.copy()
    for line in yaml_block.strip().splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue

        if ":" not in line:
            continue
        key, _, value = line.partition(":")
        key = key.strip()
        value = value.strip()

        if key == "pinned":
            meta["pinned"] = value.lower() == "true"
        elif key == "archived":
            meta["archived"] = value.lower() == "true"
        elif key == "color":
            val = value.strip("\"'") or None
            meta["color"] = val if val in VALID_COLORS else None
        elif key == "tags":
            # 인라인 형식: tags: [a, b, c]
            if value.startswith("["):
                inner = value.strip("[]")
                meta["tags"] = [t.strip().strip("\"'") for t in inner.split(",") if t.strip()]
            # 여러 줄 형식은 간단히 무시 (인라인만 지원)

    return meta, body


def serialize_frontmatter(meta: dict, body: str) -> str:
    """메타데이터와 본문을 YAML frontmatter가 포함된 문자열로 합칩니다."""
    lines = ["---"]

    lines.append(f"pinned: {'true' if meta.get('pinned') else 'false'}")

    color = meta.get("color")
    lines.append(f"color: {color if color else ''}")

    tags = meta.get("tags", [])
    if tags:
        tag_str = ", ".join(tags)
        lines.append(f"tags: [{tag_str}]")
    else:
        lines.append("tags: []")

    lines.append(f"archived: {'true' if meta.get('archived') else 'false'}")

    lines.append("---")
    lines.append("")

    return "\n".join(lines) + body


# =====================================================================
# Pydantic 모델
# =====================================================================

class NoteSummary(BaseModel):
    title: str
    snippet: str
    updated_at: str
    pinned: bool = False
    color: Optional[str] = None
    tags: list[str] = []
    archived: bool = False

class NoteDetail(BaseModel):
    title: str
    content: str
    updated_at: str
    pinned: bool = False
    color: Optional[str] = None
    tags: list[str] = []
    archived: bool = False

class NoteCreate(BaseModel):
    title: str
    content: str
    pinned: bool = False
    color: Optional[str] = None
    tags: list[str] = []
    archived: bool = False

class MetaUpdate(BaseModel):
    pinned: Optional[bool] = None
    color: Optional[str] = None
    tags: Optional[list[str]] = None
    archived: Optional[bool] = None


# =====================================================================
# 유틸리티
# =====================================================================

def get_safe_path(title: str) -> tuple[str, str]:
    """Path Traversal 방지 및 파일 시스템 호환성을 위한 안전한 경로 생성"""
    safe_title = "".join(c for c in title if c not in r'\/:*?"<>|').strip()
    if not safe_title:
        safe_title = "Untitled"

    base_dir = os.path.abspath(NOTES_DIR)
    target_path = os.path.abspath(os.path.join(base_dir, f"{safe_title}.md"))

    if not target_path.startswith(base_dir):
        raise ValueError("Invalid path detected")

    return target_path, safe_title


def _read_note_file(file_path: str) -> tuple[dict, str]:
    """파일을 읽어 (metadata, body) 튜플을 반환합니다."""
    with open(file_path, "r", encoding="utf-8") as f:
        raw = f.read()
    return parse_frontmatter(raw)


def _read_snippet(file_path: str, max_chars: int = 150) -> tuple[str, dict]:
    """파일의 메타데이터와 본문 요약을 반환합니다."""
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            raw = f.read(max_chars + 500)  # frontmatter 길이 여유분 포함

        meta, body = parse_frontmatter(raw)
        snippet = body[:max_chars]
        if len(body) > max_chars:
            snippet += "..."
        return snippet, meta
    except Exception:
        return "", {"pinned": False, "color": None, "tags": [], "archived": False}


# =====================================================================
# API 엔드포인트
# =====================================================================

@router.get("/notes", response_model=List[NoteSummary])
async def list_notes(archived: bool = Query(False, description="보관된 메모만 표시")):
    """메모 목록을 조회합니다. pinned가 상단에 위치하고, archived 필터를 지원합니다."""
    def _get_notes():
        notes = []
        for filename in os.listdir(NOTES_DIR):
            if filename.endswith(".md"):
                file_path = os.path.join(NOTES_DIR, filename)
                title = os.path.splitext(filename)[0]
                snippet, meta = _read_snippet(file_path)

                # archived 필터
                if meta.get("archived", False) != archived:
                    continue

                mtime = os.path.getmtime(file_path)
                updated_at = datetime.fromtimestamp(mtime).strftime("%Y-%m-%d %H:%M:%S")

                notes.append(NoteSummary(
                    title=title, snippet=snippet, updated_at=updated_at,
                    pinned=meta.get("pinned", False),
                    color=meta.get("color"),
                    tags=meta.get("tags", []),
                    archived=meta.get("archived", False),
                ))

        # 정렬: pinned 우선, 그 안에서 최신순
        notes.sort(key=lambda x: (not x.pinned, x.updated_at), reverse=False)
        notes.sort(key=lambda x: x.pinned, reverse=True)
        # 최종: pinned 그룹 내 최신순, non-pinned 그룹 내 최신순
        pinned = sorted([n for n in notes if n.pinned], key=lambda x: x.updated_at, reverse=True)
        unpinned = sorted([n for n in notes if not n.pinned], key=lambda x: x.updated_at, reverse=True)
        return pinned + unpinned

    try:
        return await asyncio.to_thread(_get_notes)
    except Exception as e:
        logger.error(f"메모 목록 읽기 실패: {e}")
        raise HTTPException(status_code=500, detail="Failed to load notes")


@router.get("/notes/search", response_model=List[NoteSummary])
async def search_notes(q: str = Query(..., min_length=1, description="검색어")):
    """제목과 본문을 대상으로 전문 검색합니다."""
    def _search():
        query = q.lower()
        results = []
        for filename in os.listdir(NOTES_DIR):
            if not filename.endswith(".md"):
                continue
            file_path = os.path.join(NOTES_DIR, filename)
            title = os.path.splitext(filename)[0]

            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    raw = f.read()
                meta, body = parse_frontmatter(raw)
            except Exception:
                continue

            # 제목 또는 본문에서 검색어 매칭
            if query in title.lower() or query in body.lower():
                snippet = body[:150] + ("..." if len(body) > 150 else "")
                mtime = os.path.getmtime(file_path)
                updated_at = datetime.fromtimestamp(mtime).strftime("%Y-%m-%d %H:%M:%S")
                results.append(NoteSummary(
                    title=title, snippet=snippet, updated_at=updated_at,
                    pinned=meta.get("pinned", False),
                    color=meta.get("color"),
                    tags=meta.get("tags", []),
                    archived=meta.get("archived", False),
                ))

        results.sort(key=lambda x: x.updated_at, reverse=True)
        return results

    try:
        return await asyncio.to_thread(_search)
    except Exception as e:
        logger.error(f"메모 검색 실패: {e}")
        raise HTTPException(status_code=500, detail="Failed to search notes")


@router.get("/notes/{title}", response_model=NoteDetail)
async def get_note(title: str):
    """특정 메모의 전체 내용을 가져옵니다."""
    try:
        file_path, safe_title = get_safe_path(title)
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="Note not found")

        def _read():
            meta, body = _read_note_file(file_path)
            mtime = os.path.getmtime(file_path)
            updated_at = datetime.fromtimestamp(mtime).strftime("%Y-%m-%d %H:%M:%S")
            return NoteDetail(
                title=safe_title, content=body, updated_at=updated_at,
                pinned=meta.get("pinned", False),
                color=meta.get("color"),
                tags=meta.get("tags", []),
                archived=meta.get("archived", False),
            )

        return await asyncio.to_thread(_read)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"메모 읽기 실패: {e}")
        raise HTTPException(status_code=500, detail="Failed to read note")


@router.post("/notes")
async def create_note(note: NoteCreate):
    """새로운 메모를 작성합니다 (메타데이터 포함)."""
    try:
        file_path, safe_title = get_safe_path(note.title)

        counter = 1
        original_title = safe_title
        while os.path.exists(file_path):
            safe_title = f"{original_title}_{counter}"
            file_path = os.path.join(NOTES_DIR, f"{safe_title}.md")
            counter += 1

        meta = {
            "pinned": note.pinned,
            "color": note.color if note.color in VALID_COLORS else None,
            "tags": note.tags,
            "archived": note.archived,
        }

        def _write():
            content = serialize_frontmatter(meta, note.content)
            with open(file_path, "w", encoding="utf-8") as f:
                f.write(content)

        await asyncio.to_thread(_write)
        return {"status": "success", "title": safe_title}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"메모 저장 실패: {e}")
        raise HTTPException(status_code=500, detail="Failed to save note")


@router.put("/notes/{title}")
async def update_note(title: str, note: NoteCreate):
    """기존 메모를 수정합니다 (본문 + 메타데이터)."""
    try:
        old_path, _ = get_safe_path(title)
        if not os.path.exists(old_path):
            raise HTTPException(status_code=404, detail="Note not found")

        new_path, new_safe_title = get_safe_path(note.title)

        if old_path != new_path and os.path.exists(new_path):
            raise HTTPException(status_code=400, detail="A note with that new title already exists")

        meta = {
            "pinned": note.pinned,
            "color": note.color if note.color in VALID_COLORS else None,
            "tags": note.tags,
            "archived": note.archived,
        }

        def _update():
            content = serialize_frontmatter(meta, note.content)
            with open(old_path, "w", encoding="utf-8") as f:
                f.write(content)
            if old_path != new_path:
                os.rename(old_path, new_path)

        await asyncio.to_thread(_update)
        return {"status": "success", "title": new_safe_title}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"메모 수정 실패: {e}")
        raise HTTPException(status_code=500, detail="Failed to update note")


@router.patch("/notes/{title}/meta")
async def update_note_meta(title: str, meta_update: MetaUpdate):
    """메모의 메타데이터만 빠르게 업데이트합니다 (본문 변경 없음)."""
    try:
        file_path, _ = get_safe_path(title)
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="Note not found")

        def _patch():
            meta, body = _read_note_file(file_path)

            if meta_update.pinned is not None:
                meta["pinned"] = meta_update.pinned
            if meta_update.color is not None:
                meta["color"] = meta_update.color if meta_update.color in VALID_COLORS else None
            if meta_update.tags is not None:
                meta["tags"] = meta_update.tags
            if meta_update.archived is not None:
                meta["archived"] = meta_update.archived

            content = serialize_frontmatter(meta, body)
            with open(file_path, "w", encoding="utf-8") as f:
                f.write(content)
            return meta

        updated_meta = await asyncio.to_thread(_patch)
        return {"status": "success", **updated_meta}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"메타데이터 업데이트 실패: {e}")
        raise HTTPException(status_code=500, detail="Failed to update metadata")


@router.delete("/notes/{title}")
async def delete_note(title: str):
    """메모를 삭제합니다."""
    try:
        file_path, _ = get_safe_path(title)
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="Note not found")

        def _delete():
            os.remove(file_path)

        await asyncio.to_thread(_delete)
        return {"status": "success"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"메모 삭제 실패: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete note")
