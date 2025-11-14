from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship

from app.core.database import Base


class UserCareerRecommendation(Base):
    __tablename__ = "user_career_recommendations"
    __allow_unmapped__ = True

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    career_profile_id = Column(Integer, ForeignKey("career_profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    fit_score = Column(Float, nullable=False)
    why_this_fits = Column(Text, nullable=False)
    salary_range = Column(JSONB, nullable=True)
    growth_trend = Column(String(8), nullable=True)
    top_skills = Column(JSONB, nullable=True)
    tips = Column(JSONB, nullable=True)
    coach_context = Column(Text, nullable=True)
    rank = Column(Integer, nullable=True)
    generated_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    user = relationship("User", back_populates="career_recommendations")
    career_profile = relationship("CareerProfile", back_populates="recommendations")


class UserRecommendationAction(Base):
    __tablename__ = "user_recommendation_actions"
    __allow_unmapped__ = True

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    career_profile_id = Column(Integer, ForeignKey("career_profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    action = Column(String(32), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="recommendation_actions")
    career_profile = relationship("CareerProfile", back_populates="actions")

    __table_args__ = (
        UniqueConstraint("user_id", "career_profile_id", name="uq_user_recommendation_action"),
    )


if TYPE_CHECKING:  # pragma: no cover
    from app.models.user import User
    from app.models.career_profile import CareerProfile
