from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, List

from sqlalchemy import Column, DateTime, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship

from app.core.database import Base


class CareerProfile(Base):
    __tablename__ = "career_profiles"
    __allow_unmapped__ = True

    id = Column(Integer, primary_key=True, index=True)
    soc_code = Column(String(32), nullable=True, unique=True, index=True)
    title = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=True)
    required_skills = Column(JSONB, nullable=True)
    preferred_skills = Column(JSONB, nullable=True)
    trajectory = Column(JSONB, nullable=True)
    salary_range = Column(JSONB, nullable=True)
    demand_indicator = Column(String(8), nullable=True)
    embedding = Column(JSONB, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )

    recommendations: List["UserCareerRecommendation"] = relationship(
        "UserCareerRecommendation",
        back_populates="career_profile",
        cascade="all, delete-orphan",
    )
    actions: List["UserRecommendationAction"] = relationship(
        "UserRecommendationAction",
        back_populates="career_profile",
        cascade="all, delete-orphan",
    )


if TYPE_CHECKING:  # pragma: no cover - imported only for type checking
    from app.models.user_recommendation import UserCareerRecommendation, UserRecommendationAction
