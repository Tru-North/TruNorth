from datetime import datetime
from typing import Optional, Dict, Any
from pydantic import BaseModel


# ---------------------- CHAT RESPONSE ----------------------

class ChatResponseCreate(BaseModel):
    user_id: int
    chat_id: str
    response: Dict[str, Any]


# ---------------------- QUESTIONNAIRE RESPONSE ----------------------

class QuestionnaireResponseCreate(BaseModel):
    user_id: int
    category: str
    question_id: str
    answer: Dict[str, Any]  # can handle multiple-choice or text


# ---------------------- USER PROGRESS ----------------------

class UserProgressUpdate(BaseModel):
    user_id: int
    current_tab: Optional[int] = None
    is_completed: Optional[bool] = False


# ---------------------- SUBMIT RESPONSE ----------------------

class QuestionnaireSubmitResponse(BaseModel):
    message: str
    completion_time: datetime
