# backend/app/models/final_data.py
from datetime import datetime
from sqlalchemy import Column, Integer, ForeignKey, DateTime
from sqlalchemy.dialects.postgresql import JSONB
from app.core.database import Base


class UserFinalData(Base):
    """
    Stores the complete final JSON for each user
    after questionnaire completion.
    """
    __tablename__ = "user_final_data"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    final_json = Column(JSONB, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, nullable=False)