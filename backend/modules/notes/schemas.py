from pydantic import BaseModel
from typing import Optional, List

class NoteSummary(BaseModel):
    title: str
    snippet: str
    updated_at: str
    pinned: bool = False
    color: Optional[str] = None
    tags: List[str] = []
    archived: bool = False

class NoteDetail(BaseModel):
    title: str
    content: str
    updated_at: str
    pinned: bool = False
    color: Optional[str] = None
    tags: List[str] = []
    archived: bool = False

class NoteCreate(BaseModel):
    title: str
    content: str
    pinned: bool = False
    color: Optional[str] = None
    tags: List[str] = []
    archived: bool = False

class MetaUpdate(BaseModel):
    pinned: Optional[bool] = None
    color: Optional[str] = None
    tags: Optional[List[str]] = None
    archived: Optional[bool] = None

class TagRenameRequest(BaseModel):
    old_tag: str
    new_tag: str

class TagDeleteRequest(BaseModel):
    tag: str

