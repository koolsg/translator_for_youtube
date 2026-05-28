import os
import logging
import asyncio
from datetime import datetime
from typing import List
from fastapi import APIRouter, HTTPException, Query

from modules.notes.schemas import NoteSummary, NoteDetail, NoteCreate, MetaUpdate, TagRenameRequest, TagDeleteRequest
from modules.notes.service import (
    NOTES_DIR,
    VALID_COLORS,
    get_file_lock,
    get_safe_path,
    read_note_file,
    read_snippet,
    parse_frontmatter,
    serialize_frontmatter,
)

router = APIRouter()
logger = logging.getLogger(__name__)

@router.get("/", response_model=List[NoteSummary])
async def list_notes(archived: bool = Query(False, description="보관된 메모만 표시")):
    def _get_notes():
        notes = []
        for filename in os.listdir(NOTES_DIR):
            if filename.endswith(".md"):
                file_path = os.path.join(NOTES_DIR, filename)
                title = os.path.splitext(filename)[0]
                snippet, meta = read_snippet(file_path)

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

        notes.sort(key=lambda x: (not x.pinned, x.updated_at), reverse=False)
        notes.sort(key=lambda x: x.pinned, reverse=True)
        pinned = sorted([n for n in notes if n.pinned], key=lambda x: x.updated_at, reverse=True)
        unpinned = sorted([n for n in notes if not n.pinned], key=lambda x: x.updated_at, reverse=True)
        return pinned + unpinned

    try:
        return await asyncio.to_thread(_get_notes)
    except Exception as e:
        logger.error(f"메모 목록 읽기 실패: {e}")
        raise HTTPException(status_code=500, detail="Failed to load notes")


@router.get("/search", response_model=List[NoteSummary])
async def search_notes(q: str = Query(..., min_length=1, description="검색어")):
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

        pinned = sorted([n for n in results if n.pinned], key=lambda x: x.updated_at, reverse=True)
        unpinned = sorted([n for n in results if not n.pinned], key=lambda x: x.updated_at, reverse=True)
        return pinned + unpinned

    try:
        return await asyncio.to_thread(_search)
    except Exception as e:
        logger.error(f"메모 검색 실패: {e}")
        raise HTTPException(status_code=500, detail="Failed to search notes")


@router.get("/{title}", response_model=NoteDetail)
async def get_note(title: str):
    try:
        file_path, safe_title = get_safe_path(title)
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="Note not found")

        def _read():
            meta, body = read_note_file(file_path)
            mtime = os.path.getmtime(file_path)
            updated_at = datetime.fromtimestamp(mtime).strftime("%Y-%m-%d %H:%M:%S")
            return NoteDetail(
                title=safe_title,
                content=body.strip(),
                updated_at=updated_at,
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


@router.post("/")
async def create_note(note: NoteCreate):
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

        async with get_file_lock(file_path):
            await asyncio.to_thread(_write)
        return {"status": "success", "title": safe_title}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"메모 생성 실패: {e}")
        raise HTTPException(status_code=500, detail="Failed to save note")


@router.put("/{title}")
async def update_note(title: str, note: NoteCreate):
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

        async with get_file_lock(old_path):
            await asyncio.to_thread(_update)
        return {"status": "success", "title": new_safe_title}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"메모 수정 실패: {e}")
        raise HTTPException(status_code=500, detail="Failed to update note")


@router.patch("/{title}/meta")
async def update_note_meta(title: str, meta_update: MetaUpdate):
    try:
        file_path, _ = get_safe_path(title)
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="Note not found")

        def _patch():
            meta, body = read_note_file(file_path)

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

        async with get_file_lock(file_path):
            updated_meta = await asyncio.to_thread(_patch)
        return {"status": "success", **updated_meta}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"메타데이터 수정 실패: {e}")
        raise HTTPException(status_code=500, detail="Failed to update metadata")


@router.delete("/{title}")
async def delete_note(title: str):
    try:
        file_path, _ = get_safe_path(title)
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="Note not found")

        def _delete():
            os.remove(file_path)

        async with get_file_lock(file_path):
            await asyncio.to_thread(_delete)
        return {"status": "success"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"메모 삭제 실패: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete note")


@router.post("/tags/rename")
async def rename_tag(req: TagRenameRequest):
    def _rename():
        renamed_count = 0
        for filename in os.listdir(NOTES_DIR):
            if not filename.endswith(".md"):
                continue
            file_path = os.path.join(NOTES_DIR, filename)
            try:
                meta, body = read_note_file(file_path)
                if "tags" in meta and req.old_tag in meta["tags"]:
                    meta["tags"] = [req.new_tag if t == req.old_tag else t for t in meta["tags"]]
                    unique_tags = []
                    for t in meta["tags"]:
                        if t not in unique_tags:
                            unique_tags.append(t)
                    meta["tags"] = unique_tags

                    content = serialize_frontmatter(meta, body)
                    with open(file_path, "w", encoding="utf-8") as f:
                        f.write(content)
                    renamed_count += 1
            except Exception as e:
                logger.error(f"Failed to rename tag in {filename}: {e}")
                continue
        return renamed_count

    try:
        count = await asyncio.to_thread(_rename)
        return {"status": "success", "renamed_count": count}
    except Exception as e:
        logger.error(f"전역 태그 이름 변경 실패: {e}")
        raise HTTPException(status_code=500, detail="Failed to rename tags globally")


@router.post("/tags/delete")
async def delete_tag(req: TagDeleteRequest):
    def _delete_tag():
        deleted_count = 0
        for filename in os.listdir(NOTES_DIR):
            if not filename.endswith(".md"):
                continue
            file_path = os.path.join(NOTES_DIR, filename)
            try:
                meta, body = read_note_file(file_path)
                if "tags" in meta and req.tag in meta["tags"]:
                    meta["tags"] = [t for t in meta["tags"] if t != req.tag]
                    content = serialize_frontmatter(meta, body)
                    with open(file_path, "w", encoding="utf-8") as f:
                        f.write(content)
                    deleted_count += 1
            except Exception as e:
                logger.error(f"Failed to delete tag in {filename}: {e}")
                continue
        return deleted_count

    try:
        count = await asyncio.to_thread(_delete_tag)
        return {"status": "success", "deleted_count": count}
    except Exception as e:
        logger.error(f"전역 태그 삭제 실패: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete tags globally")
