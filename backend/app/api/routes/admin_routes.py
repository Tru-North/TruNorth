import math
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.user import User
from app.models.admin_review import AdminUserReview
from app.models.final_data import UserFinalData  # used only for profile summary, read-only
from app.services import admin_review_service
from app.services.admin_ai_service import admin_ai_service
from app.services.ai_confidence_service import ai_confidence_service
from app.utils.admin_auth import get_current_admin
from app.api.schemas.admin_schemas import (
    AdminUserListItem,
    AdminUserListPage,
    SessionSummary,
    ChatMessage,
    SessionReviewPayload,
    SessionReviewResponse,
    ProfileSummary,
)

router = APIRouter(prefix="/admin", tags=["Admin"])


# ---------- User List View ----------

@router.get("/users", response_model=AdminUserListPage)
def admin_list_users(
    search: Optional[str] = None,
    sort_by: str = "created_at_desc",   # <-- now we accept combined values
    page: int = 1,
    page_size: int = 10,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """
    Returns a list of users for the Admin Dashboard user table.
    Supports frontend sort values:
    - created_at_desc
    - created_at_asc
    - last_login_desc
    - last_login_asc
    """

    # ------------------------------------------
    # 🔥 Decode frontend sort values
    # ------------------------------------------
    sort_field = "created_at"
    sort_dir = "desc"

    if sort_by == "created_at_desc":
        sort_field = "created_at"
        sort_dir = "desc"

    elif sort_by == "created_at_asc":
        sort_field = "created_at"
        sort_dir = "asc"

    elif sort_by == "last_login_desc":
        sort_field = "last_login"
        sort_dir = "desc"

    elif sort_by == "last_login_asc":
        sort_field = "last_login"
        sort_dir = "asc"

    # ------------------------------------------
    # Fetch sorted users
    # ------------------------------------------
    results = admin_review_service.list_users_for_admin(
        db,
        search=search,
        sort_by=sort_field,
        sort_dir=sort_dir,
        page=page,
        page_size=page_size,
    )
    total = results["total"]
    items = results["items"]
    total_pages = math.ceil(total / page_size)

    return {
        "items": items,
        "page": page,
        "page_size": page_size,
        "total": total,
        "total_pages": total_pages
    }
    #return users


@router.get("/users/{user_id}", response_model=AdminUserListItem)
def admin_get_user(user_id: int,
                   db: Session = Depends(get_db),
                   admin: User = Depends(get_current_admin)):
    user = admin_review_service.get_single_user(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


# ---------- User Sessions ----------

@router.get("/users/{user_id}/sessions", response_model=List[SessionSummary])
def admin_list_sessions(
    user_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """
    Returns all sessions for a user, grouped by session_id.
    """
    rows = admin_review_service.list_user_sessions(db, user_id=user_id)
    return [
        SessionSummary(
            session_id=row.session_id,
            first_message=row.first_message,
            last_message=row.last_message,
            message_count=row.message_count,
        )
        for row in rows
    ]


# ---------- Chat Transcript ----------

@router.get(
    "/users/{user_id}/sessions/{session_id}/messages",
    response_model=List[ChatMessage],
)
def admin_get_session_messages(
    user_id: int,
    session_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """
    Returns full chat transcript for a session.
    """
    messages = admin_review_service.get_session_messages(
        db,
        user_id=user_id,
        session_id=session_id,
    )
    return messages


# ---------- Session Review (GET) ----------

@router.get(
    "/users/{user_id}/review",
    response_model=SessionReviewResponse,
)
async def admin_get_review(
    user_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """
    Fetches existing review or returns a new blank record for this user.
    Preloads AI-generated summaries if not already present.
    """
    review = admin_review_service.get_or_create_user_review(
        db,
        user_id=user_id,
        admin_id=admin.id,
    )

    # Preload AI-generated summaries if empty
    ai_intent_summary = review.ai_intent_summary
    editable_output = review.editable_output

    if not ai_intent_summary:
        ai_intent_summary = await admin_ai_service.generate_ai_intent_summary(user_id, db)

    if not editable_output:
        editable_output = await admin_ai_service.generate_profile_summary(user_id, db)

    return SessionReviewResponse(
        id=review.id,
        ai_intent_summary=ai_intent_summary,
        editable_output=editable_output,
        tag=review.tag,
        tag_other_text=review.tag_other_text,
        comment=review.comment,
        nudge_ai=review.nudge_ai,
        message_to_user=review.message_to_user,
        updated_at=review.updated_at,
    )


# ---------- Session Review (POST / Save) ----------

@router.post(
    "/users/{user_id}/review",
    response_model=SessionReviewResponse,
)
def admin_update_review(
    user_id: int,
    payload: SessionReviewPayload,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """
    Updates review fields for a user and logs each change.

    Only fields provided in the payload are considered.
    """
    review = admin_review_service.get_or_create_user_review(
        db,
        user_id=user_id,
        admin_id=admin.id,
    )

    # Apply field-by-field updates with audit logging
    for field in (
        "ai_intent_summary",
        "editable_output",
        "tag",
        "tag_other_text",
        "comment",
        "nudge_ai",
        "message_to_user",
    ):
        new_val = getattr(payload, field)
        if new_val is not None:
            old_val = getattr(review, field)
            if new_val != old_val:
                setattr(review, field, new_val)
                admin_review_service.log_admin_action(
                    db,
                    admin_id=admin.id,
                    user_id=user_id,
                    action_type="update_review",
                    field_name=field,
                    old_value=old_val,
                    new_value=new_val,
                )

    db.commit()
    db.refresh(review)

    return SessionReviewResponse(
        id=review.id,
        ai_intent_summary=review.ai_intent_summary,
        editable_output=review.editable_output,
        tag=review.tag,
        tag_other_text=review.tag_other_text,
        comment=review.comment,
        nudge_ai=review.nudge_ai,
        message_to_user=review.message_to_user,
        updated_at=review.updated_at,
    )


# ---------- AI Intent Summary ----------

@router.get("/users/{user_id}/ai-intent-summary")
async def admin_ai_intent_summary(
    user_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """
    Generate AI Intent Summary: What the AI is currently doing for the user
    """
    summary = await admin_ai_service.generate_ai_intent_summary(user_id, db)
    return {"ai_intent_summary": summary}


# ---------- Profile Summary (Right Panel) ----------

@router.get("/users/{user_id}/profile-summary", response_model=ProfileSummary)
async def admin_profile_summary(
    user_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """
    Returns AI-generated profile summary for the user.
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Generate AI profile summary
    ai_profile_summary = await admin_ai_service.generate_profile_summary(user_id, db)

    name = f"{(user.firstname or '').strip()} {(user.lastname or '').strip()}".strip()
    if not name:
        name = user.email

    return ProfileSummary(
        name=name,
        email=user.email,
        background=None,  # Keep legacy fields for compatibility
        career_direction=None,
        context=ai_profile_summary,  # AI-generated summary goes here
    )


# ---------- Re-run Recommendations (No-op-safe wrapper) ----------

# @router.post("/users/{user_id}/sessions/{session_id}/rerun-recommendations")
# async def admin_rerun_recommendations(
#     user_id: int,
#     session_id: str,
#     db: Session = Depends(get_db),
#     admin: User = Depends(get_current_admin),
# ):
#     """
#     Admin trigger to re-run recommendations.

#     IMPORTANT:
#     - This endpoint does NOT modify or delete any existing data on its own.
#     - It simply logs the admin action.

#     If you want to hook this into your Phase 5C recommendation logic,
#     you can call your existing generate function here (e.g. from
#     app.services.recommendation_service) using stored questionnaire/final data.
#     """
#     # Only log the fact that it was triggered, to avoid touching existing Phase 5C logic.
#     admin_review_service.log_admin_action(
#         db,
#         admin_id=admin.id,
#         user_id=user_id,
#         session_id=session_id,
#         action_type="rerun_recommendations",
#         field_name=None,
#         old_value=None,
#         new_value=None,
#         action_metadata=None,
#     )
#     db.commit()
#     return {"status": "ok"}


# ----------------------------------------
# AI CONFIDENCE SCORE (Phase 6)
# ----------------------------------------

@router.get("/users/{user_id}/ai-confidence")
def admin_ai_confidence(
    user_id: int,
    db: Session = Depends(get_db),
    admin=Depends(get_current_admin)
):
    """
    Returns the full AI Confidence Score:
    - Overall % (0–100)
    - Milestones completed
    - Detailed milestone breakdown
    - Stores result into user_journey_state.ai_confidence_score
    - Safe & additive: does not affect other phases
    """
    return ai_confidence_service.compute_ai_confidence(db, user_id)
