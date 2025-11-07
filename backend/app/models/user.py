# backend/app/models/user.py
from sqlalchemy import Column, Integer, String, DateTime, func
from sqlalchemy.orm import relationship
from app.core.database import Base

class User(Base):
    __tablename__ = "users"  # ✅ Matches existing table name in PostgreSQL

    id = Column(Integer, primary_key=True, index=True)
    firstname = Column(String(255))
    lastname = Column(String(255))
    email = Column(String(255), unique=True)
    password = Column(String(255))
    firebase_uid = Column(String(128), unique=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    last_login = Column(DateTime(timezone=True), nullable=True)
    chat_history = relationship("ChatHistory", back_populates="user", cascade="all, delete-orphan")
    feedbacks = relationship("MessageFeedback", back_populates="user", cascade="all, delete-orphan")
