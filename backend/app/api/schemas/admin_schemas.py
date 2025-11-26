from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel


# ---------- User List ----------

class AdminUserListItem(BaseModel):
    id: int
    firstname: Optional[str] = None
    lastname: Optional[str] = None
    email: str
    created_at: Optional[datetime] = None
    last_login: Optional[datetime] = None

    class Config:
        from_attributes = True  # Pydantic v2 for ORM objects


# ---------- Sessions ----------

class SessionSummary(BaseModel):
    session_id: str
    first_message: datetime
    last_message: datetime
    message_count: int


# ---------- Chat Messages ----------

class ChatMessage(BaseModel):
    id: int
    user_id: int
    role: str
    message: str
    timestamp: datetime

    class Config:
        from_attributes = True


# ---------- Session Review Payload & Response ----------

class SessionReviewPayload(BaseModel):
    ai_intent_summary: Optional[str] = None
    editable_output: Optional[str] = None
    tag: Optional[str] = None
    tag_other_text: Optional[str] = None
    comment: Optional[str] = None
    nudge_ai: Optional[str] = None
    message_to_user: Optional[str] = None


class SessionReviewResponse(SessionReviewPayload):
    id: int
    updated_at: datetime

    class Config:
        from_attributes = True


# ---------- Profile Summary ----------

class ProfileSummary(BaseModel):
    name: str
    email: str
    background: Optional[str] = None
    career_direction: Optional[str] = None
    context: Optional[str] = None



class AdminUserListPage(BaseModel):
    items: List[AdminUserListItem]
    page: int
    page_size: int
    total: int
    total_pages: int