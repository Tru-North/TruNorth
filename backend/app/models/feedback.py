"""
User Feedback Model
Stores like/dislike feedback for AI Coach responses
"""

from datetime import datetime
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Text, Index, func
from sqlalchemy.orm import relationship
from app.core.database import Base

class MessageFeedback(Base):
    """
    Stores user feedback (like/dislike) for specific AI coach messages
    Used to personalize future responses for each user
    """
    __tablename__ = "message_feedback"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    session_id = Column(String(128), nullable=False)
    message_id = Column(Integer, ForeignKey("chat_history.id", ondelete="CASCADE"), nullable=False)
    
    # Feedback type: 'like' or 'dislike'
    feedback_type = Column(String(20), nullable=False)
    
    # Store the actual message content for analysis
    user_question = Column(Text, nullable=True)
    assistant_response = Column(Text, nullable=True)
    
    # Timestamp
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    
    # Relationships
    user = relationship("User", back_populates="feedbacks")
    chat_message = relationship("ChatHistory", back_populates="feedback")
    
    # Indexes for fast queries
    __table_args__ = (
        Index('ix_feedback_user_type', 'user_id', 'feedback_type'),
        Index('ix_feedback_session', 'session_id'),
    )
    
    def __repr__(self):
        return f"<MessageFeedback(user_id={self.user_id}, type={self.feedback_type})>"
