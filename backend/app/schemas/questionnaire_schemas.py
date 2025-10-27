from datetime import datetime
from typing import Any, Optional
from pydantic import BaseModel


# ---------- Chatbot Schema ----------
class ChatResponseCreate(BaseModel):
    user_id: int                  # ✅ now Integer (matches users.id FK)
    chat_id: str
    response: Any


# ---------- Questionnaire Schema ----------
class QuestionnaireResponseCreate(BaseModel):
    user_id: int                  # ✅ Integer type
    category: str
    question_id: str
    answer: Any


# ---------- Progress Schema ----------
class UserProgressUpdate(BaseModel):
    user_id: int                  # ✅ Integer type
    current_tab: Optional[int] = 1
    is_completed: Optional[bool] = False


# ---------- Response Schema ----------
class QuestionnaireSubmitResponse(BaseModel):
    message: str
    completion_time: datetime


# ---------- For returning progress ----------
class UserProgressOut(BaseModel):
    user_id: int
    current_tab: int
    is_completed: bool
    saved_at: datetime

    class Config:
        from_attributes = True  # ✅ Pydantic v2 syntax replacing `orm_mode`
