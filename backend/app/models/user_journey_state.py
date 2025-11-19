from datetime import datetime
from sqlalchemy import Column, Integer, Boolean, String, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from app.core.database import Base


class UserJourneyState(Base):
    __tablename__ = "user_journey_state"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)

    # Stage flags
    chat_intro_done = Column(Boolean, default=False, nullable=False)
    questionnaire_completed = Column(Boolean, default=False, nullable=False)
    discovery_completed = Column(Boolean, default=False, nullable=False)
    coach_completed = Column(Boolean, default=False, nullable=False)
    matches_completed = Column(Boolean, default=False, nullable=False)
    action_completed = Column(Boolean, default=False, nullable=False)
    launch_completed = Column(Boolean, default=False, nullable=False)

    # Unlock flag
    is_career_unlock_confirmed = Column(Boolean, default=False, nullable=False)

    # Journey tracking
    current_stage = Column(String(32), default="discovery", nullable=False)
    progress_percent = Column(Integer, default=1, nullable=False)

    updated_at = Column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False
    )

    user = relationship("User", backref="journey_state", lazy="joined")
