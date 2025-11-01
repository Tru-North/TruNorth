# backend/app/schemas/final_data_schemas.py
from datetime import datetime
from typing import Any, Dict
from pydantic import BaseModel


class UserFinalDataOut(BaseModel):
    """
    Schema for returning a user's final JSON data.
    """
    user_id: int
    final_json: Dict[str, Any]
    updated_at: datetime

    class Config:
        from_attributes = True  # ✅ Pydantic v2 equivalent of orm_mode
