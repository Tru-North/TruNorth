from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Index
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class AdminUserReview(Base):
    """
    Stores per-user admin review metadata.

    - ai_intent_summary: what the AI is helping with (editable)
    - editable_output: admin-refined AI answer
    - tag: issue category from fixed dropdown
    - comment: free-form admin feedback
    - nudge_ai: guidance text for AI behavior
    - message_to_user: message text admin wants to send user
    """
    __tablename__ = "admin_user_reviews"

    id = Column(Integer, primary_key=True, index=True)

    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    admin_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    # Optional numeric confidence score (0–100)
    ai_confidence_score = Column(Integer, nullable=True)

    # Right panel fields
    ai_intent_summary = Column(Text, nullable=True)
    editable_output = Column(Text, nullable=True)
    tag = Column(
        String(64),
        nullable=True,
        doc="Off-Scope Response / Inaccurate Info / Hallucination / Repetitive / Tone Issue / Under-Responsive / Prompt Misunderstanding / Broken Flow / Needs Escalation / Others",
    )
    tag_other_text = Column(Text, nullable=True)
    comment = Column(Text, nullable=True)
    nudge_ai = Column(Text, nullable=True)
    message_to_user = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    user = relationship("User", foreign_keys=[user_id])
    admin = relationship("User", foreign_keys=[admin_id])

    __table_args__ = (
        Index("ix_admin_review_user", "user_id"),
    )
