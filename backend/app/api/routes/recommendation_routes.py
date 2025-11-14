"""
Recommendation Routes
====================
Endpoints for generating, retrieving, and managing career recommendations.

Action States:
- no_action: User has not interacted with the recommendation
- saved: User has saved/favorited the recommendation
- explore: User has viewed the career detail page
- dismiss: User has dismissed the recommendation
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.api.schemas.recommendation_schemas import (
    GenerateRecommendationsRequest,
    GenerateRecommendationsResponse,
    FavoriteRequest,
    DismissRequest,
    CareerCard,
    CareerDetailCard,
    RecommendationHistoryResponse,
)
from app.services import recommendation_service as svc
from app.core.database import get_db
from app.models.user import User

router = APIRouter(prefix="/recommendations", tags=["recommendations"])


# ============================================================================
# RECOMMENDATION GENERATION & RETRIEVAL
# ============================================================================

@router.post("/generate", response_model=GenerateRecommendationsResponse)
async def generate_recommendations(
    payload: GenerateRecommendationsRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Generate fresh career recommendations for a user.
    
    - Uses AI to match careers based on user profile and preferences
    - Excludes previously recommended, saved, explored, and dismissed careers
    - Returns top_k recommendations (default: 5)
    - Includes real-time Adzuna employment trends and salary data
    """
    firebase_uid = getattr(request.state, "firebase_uid", None)

    # Authenticate user
    user: Optional[User] = None
    if firebase_uid:
        user = db.query(User).filter(User.firebase_uid == firebase_uid).first()

    # Determine target user ID
    target_user_id: Optional[int] = None
    if payload.user_id is not None:
        target_user_id = payload.user_id
    elif user:
        target_user_id = user.id

    if target_user_id is None:
        raise HTTPException(status_code=400, detail="user_id required when not authenticated")

    # Verify authorization
    if user and user.id != target_user_id:
        raise HTTPException(status_code=403, detail="Not authorized for this user")

    try:
        items = await svc.generate(
            db=db,
            user_id=target_user_id,
            top_k=payload.top_k,
            coach_context=payload.coach_context,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    if not items:
        return {"items": []}
    return {"items": [CareerCard(**i) for i in items]}

@router.get("/latest", response_model=GenerateRecommendationsResponse)
def latest_recommendations(
    request: Request,
    user_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    firebase_uid = getattr(request.state, "firebase_uid", None)

    user: Optional[User] = None
    if firebase_uid:
        user = db.query(User).filter(User.firebase_uid == firebase_uid).first()

    target_user_id: Optional[int] = None
    if user_id is not None:
        target_user_id = user_id
    elif user:
        target_user_id = user.id

    if target_user_id is None:
        raise HTTPException(status_code=400, detail="user_id required when not authenticated")

    if user and user.id != target_user_id:
        raise HTTPException(status_code=403, detail="Not authorized for this user")

    items = svc.get_latest_recommendations(db, target_user_id)
    return {"items": [CareerCard(**item) for item in items]}


@router.get("/favorites", response_model=GenerateRecommendationsResponse)
def favorite_recommendations(
    request: Request,
    limit: int = 10,
    user_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    firebase_uid = getattr(request.state, "firebase_uid", None)

    user: Optional[User] = None
    if firebase_uid:
        user = db.query(User).filter(User.firebase_uid == firebase_uid).first()

    target_user_id: Optional[int] = None
    if user_id is not None:
        target_user_id = user_id
    elif user:
        target_user_id = user.id

    if target_user_id is None:
        raise HTTPException(status_code=400, detail="user_id required when not authenticated")

    if user and user.id != target_user_id:
        raise HTTPException(status_code=403, detail="Not authorized for this user")

    items = svc.get_favorite_recommendations(db, target_user_id, limit)
    return {"items": [CareerCard(**item) for item in items]}


@router.get("/history", response_model=GenerateRecommendationsResponse)
def recommendation_history(
    request: Request,
    user_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    """Get all recommendations with their action tags for the user."""
    firebase_uid = getattr(request.state, "firebase_uid", None)

    user: Optional[User] = None
    if firebase_uid:
        user = db.query(User).filter(User.firebase_uid == firebase_uid).first()

    target_user_id: Optional[int] = None
    if user_id is not None:
        target_user_id = user_id
    elif user:
        target_user_id = user.id

    if target_user_id is None:
        raise HTTPException(status_code=400, detail="user_id required when not authenticated")

    if user and user.id != target_user_id:
        raise HTTPException(status_code=403, detail="Not authorized for this user")

    all_recommendations = svc.get_all_recommendations_with_actions(db, target_user_id)
    return {"items": all_recommendations}


@router.get("/dismiss", response_model=GenerateRecommendationsResponse)
def list_dismissed(
    request: Request,
    user_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    firebase_uid = getattr(request.state, "firebase_uid", None)

    user: Optional[User] = None
    if firebase_uid:
        user = db.query(User).filter(User.firebase_uid == firebase_uid).first()

    target_user_id: Optional[int] = None
    if user_id is not None:
        target_user_id = user_id
    elif user:
        target_user_id = user.id

    if target_user_id is None:
        raise HTTPException(status_code=400, detail="user_id required when not authenticated")

    if user and user.id != target_user_id:
        raise HTTPException(status_code=403, detail="Not authorized for this user")

    items = svc.get_dismissed_recommendations(db, target_user_id)
    return {"items": [CareerCard(**item) for item in items]}


@router.post("/save")
def save_role(payload: FavoriteRequest, request: Request, db: Session = Depends(get_db)):
    firebase_uid = getattr(request.state, "firebase_uid", None)
    user: Optional[User] = None
    if firebase_uid:
        user = db.query(User).filter(User.firebase_uid == firebase_uid).first()

    target_user_id = payload.user_id or (user.id if user else None)
    if target_user_id is None:
        raise HTTPException(status_code=400, detail="user_id required when not authenticated")

    if user and user.id != target_user_id:
        raise HTTPException(status_code=403, detail="Not authorized for this user")

    try:
        svc.favorite(db, target_user_id, payload.career_id, "favorite")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return {"status": "ok"}


@router.post("/dismiss")
def dismiss(payload: DismissRequest, request: Request, db: Session = Depends(get_db)):
    firebase_uid = getattr(request.state, "firebase_uid", None)
    user: Optional[User] = None
    if firebase_uid:
        user = db.query(User).filter(User.firebase_uid == firebase_uid).first()

    target_user_id = payload.user_id or (user.id if user else None)
    if target_user_id is None:
        raise HTTPException(status_code=400, detail="user_id required when not authenticated")

    if user and user.id != target_user_id:
        raise HTTPException(status_code=403, detail="Not authorized for this user")

    try:
        svc.favorite(db, target_user_id, payload.career_id, "dismiss")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return {"status": "ok"}


@router.get("/explore/{career_id}", response_model=CareerDetailCard)
async def career_detail(
    career_id: int,
    request: Request,
    user_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    firebase_uid = getattr(request.state, "firebase_uid", None)
    user: Optional[User] = None
    if firebase_uid:
        user = db.query(User).filter(User.firebase_uid == firebase_uid).first()

    target_user_id: Optional[int] = None
    if user_id is not None:
        target_user_id = user_id
    elif user:
        target_user_id = user.id

    if user and target_user_id is not None and user.id != target_user_id:
        raise HTTPException(status_code=403, detail="Not authorized for this user")

    if target_user_id is None:
        raise HTTPException(status_code=400, detail="user_id required when not authenticated")

    # Track explore action for this career
    # try:
    #     svc.favorite(db, target_user_id, career_id, "explore")
    # except ValueError:
    #     pass  # Continue even if tracking fails

    try:
        card = await svc.get_career_detail(db, career_id, target_user_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))

    return CareerDetailCard(**card)
