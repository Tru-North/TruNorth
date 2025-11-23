# backend/app/models/user.py
from sqlalchemy import Column, Integer, String, DateTime, func, Boolean
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.models.chat_history import ChatHistory
from app.models.user_recommendation import UserCareerRecommendation, UserRecommendationAction

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
    role = Column(String(50), nullable=False, server_default="user")  # "user" or "admin"
    is_career_unlock_confirmed = Column(Boolean, default=False)   
    admin_password_hash = Column(String(255), nullable=True)  # Admin-only password login (optional for normal users)
    admin_password_salt = Column(String(255), nullable=True)
    chat_history = relationship(
        "ChatHistory", 
        back_populates="user", 
        cascade="all, delete-orphan"
    )
    feedbacks = relationship(
        "MessageFeedback", 
        back_populates="user", 
        cascade="all, delete-orphan"
    )
    career_recommendations = relationship(
        "UserCareerRecommendation",
        back_populates="user",
        cascade="all, delete-orphan"
    )
    recommendation_actions = relationship(
        "UserRecommendationAction",
        back_populates="user",
        cascade="all, delete-orphan"
    )