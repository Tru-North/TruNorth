from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel


class GenerateRecommendationsRequest(BaseModel):
    user_id: Optional[int] = None
    top_k: int = 5
    coach_context: Optional[str] = None


class CareerCard(BaseModel):
    id: int | None = None         # id may be None if not caching to DB
    soc_code: str | None = None   # NEW
    title: str
    fit_score: float
    salary_range: Optional[Dict[str, Any]] = None
    growth_trend: Optional[str] = None  # "↑" | "→" | "↓"
    industry_tag: Optional[str] = None  # Industry sector tag
    why_this_fits: str
    top_skills: List[str]
    tips: List[str]
    user_action: Optional[str] = None  # "favorite", "dismiss", or None


class GenerateRecommendationsResponse(BaseModel):
    items: List[CareerCard]


class FavoriteRequest(BaseModel):
    user_id: Optional[int] = None
    career_id: int


class DismissRequest(BaseModel):
    user_id: Optional[int] = None
    career_id: int


class RecommendationBatch(BaseModel):
    generated_at: datetime
    items: List[CareerCard]


class RecommendationHistoryResponse(BaseModel):
    batches: List[RecommendationBatch]


class CareerDetailCard(BaseModel):
    """Schema for GET /recommendations/explore/{career_id} with 4-bullet format"""
    id: int | None = None
    career_id: int | None = None
    soc_code: str | None = None
    title: str
    fit_score: float | None = None
    salary_range: Optional[Dict[str, Any]] = None
    growth_trend: Optional[str] = None
    industry_tag: Optional[str] = None
    user_action: Optional[str] = None
    bullets: List[str]  # 4 actionable bullet points
