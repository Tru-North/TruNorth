"""
Chat History Model for PostgreSQL
"""

from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Index
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.core.database import Base

class ChatHistory(Base):
    __tablename__ = "chat_history"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    session_id = Column(String(128), nullable=False)
    role = Column(String(20), nullable=False)  # 'user' or 'assistant'
    message = Column(Text, nullable=False)
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    feedback = relationship("MessageFeedback", back_populates="chat_message", uselist=False, cascade="all, delete-orphan")
    # Relationship (add this to User model too)
    user = relationship("User", back_populates="chat_history")
    
    # Indexes for performance
    __table_args__ = (
        Index('ix_chat_history_user_session', 'user_id', 'session_id'),
        Index('ix_chat_history_timestamp', 'timestamp'),
    )
    
    def __repr__(self):
        return f"<ChatHistory(user_id={self.user_id}, session={self.session_id}, role={self.role})>"
