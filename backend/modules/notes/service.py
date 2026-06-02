import os
import re
import asyncio

NOTES_DIR = os.getenv("NOTES_DIR", "/home/koolsg/Documents/Obsidian Vault/My_Memos")

if not os.path.exists(NOTES_DIR):
    os.makedirs(NOTES_DIR)

VALID_COLORS = {None, "coral", "peach", "sand", "sage", "fog", "storm", "lavender"}

_file_locks: dict[str, asyncio.Lock] = {}

def get_file_lock(path: str) -> asyncio.Lock:
    if path not in _file_locks:
        _file_locks[path] = asyncio.Lock()
    return _file_locks[path]

def parse_frontmatter(raw: str) -> tuple[dict, str]:
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
        key, val = line.split(":", 1)
        key = key.strip().lower()
        val = val.strip()
        if key == "pinned":
            meta["pinned"] = val.lower() == "true"
        elif key == "color":
            color_val = val.strip(' "\'')
            meta["color"] = color_val if color_val in VALID_COLORS else None
        elif key == "tags":
            if val.startswith("[") and val.endswith("]"):
                tags_str = val[1:-1]
                meta["tags"] = [t.strip().strip(' "\'') for t in tags_str.split(",") if t.strip()]
            else:
                meta["tags"] = [t.strip().strip(' "\'') for t in val.split(",") if t.strip()]
        elif key == "archived":
            meta["archived"] = val.lower() == "true"
    return meta, body

def serialize_frontmatter(meta: dict, body: str) -> str:
    lines = ["---"]
    lines.append(f"pinned: {str(meta.get('pinned', False)).lower()}")
    color = meta.get("color")
    if color and color in VALID_COLORS:
        lines.append(f'color: "{color}"')
    tags = meta.get("tags", [])
    if tags:
        tags_formatted = ", ".join(f'"{t}"' for t in tags)
        lines.append(f"tags: [{tags_formatted}]")
    lines.append(f"archived: {str(meta.get('archived', False)).lower()}")
    lines.append("---")
    lines.append("")
    return "\n".join(lines) + body

def get_safe_path(title: str) -> tuple[str, str]:
    safe_title = "".join(c for c in title if c not in r'\/:*?"<>|').strip()
    if not safe_title:
        safe_title = "Untitled"
    base_dir = os.path.abspath(NOTES_DIR)
    target_path = os.path.abspath(os.path.join(base_dir, f"{safe_title}.md"))
    if not target_path.startswith(base_dir):
        raise ValueError("Invalid path detected")
    return target_path, safe_title

def read_note_file(file_path: str) -> tuple[dict, str]:
    with open(file_path, "r", encoding="utf-8") as f:
        raw = f.read()
    return parse_frontmatter(raw)

def read_snippet(file_path: str, max_chars: int = 150) -> tuple[str, dict]:
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            raw = f.read(max_chars + 500)
        meta, body = parse_frontmatter(raw)
        snippet = body[:max_chars]
        if len(body) > max_chars:
            snippet += "..."
        return snippet, meta
    except Exception:
        return "", {"pinned": False, "color": None, "tags": [], "archived": False}
