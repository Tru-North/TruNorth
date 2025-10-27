# backend/app/models/questionnaire.py
from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.core.database import Base


class UserProgress(Base):
    """
    Tracks where the user left off in the journey and completion status.
    """
    __tablename__ = "user_progress"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    current_tab = Column(Integer, default=1)
    is_completed = Column(Boolean, default=False)
    saved_at = Column(DateTime, default=datetime.utcnow)

    # Reverse relationships
    chat_responses = relationship("ChatResponse", back_populates="user_progress", cascade="all, delete-orphan")
    questionnaire_responses = relationship("QuestionnaireResponse", back_populates="user_progress", cascade="all, delete-orphan")


class ChatResponse(Base):
    """
    Stores predefined chatbot conversation messages
    before the questionnaire begins.
    """
    __tablename__ = "chat_responses"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    progress_id = Column(Integer, ForeignKey("user_progress.id", ondelete="CASCADE"), nullable=True)
    chat_id = Column(String, nullable=False)
    response = Column(JSON, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)

    user_progress = relationship("UserProgress", back_populates="chat_responses")


class QuestionnaireResponse(Base):
    """
    Stores each user's questionnaire responses per section/question.
    """
    __tablename__ = "questionnaire_responses"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    progress_id = Column(Integer, ForeignKey("user_progress.id", ondelete="CASCADE"), nullable=True)
    category = Column(String, nullable=False)
    question_id = Column(String, nullable=False)
    answer = Column(JSON, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)

    user_progress = relationship("UserProgress", back_populates="questionnaire_responses")
