from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.models.user_journey_state import UserJourneyState
from app.models.user import User
from app.api.schemas.journey_schemas import JourneyStateUpdate


# ---------------------------------------------------------
# GET OR CREATE JOURNEY STATE
# ---------------------------------------------------------
def get_or_create_journey_state(db: Session, user_id: int):
    # Ensure user exists
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Fetch journey state
    state = (
        db.query(UserJourneyState)
        .filter(UserJourneyState.user_id == user_id)
        .first()
    )

    # If no row exists, create one
    if not state:
        state = UserJourneyState(user_id=user_id)
        db.add(state)
        db.commit()
        db.refresh(state)

    return state


# ---------------------------------------------------------
# APPLY JOURNEY STATE UPDATE (CORE LOGIC)
# ---------------------------------------------------------
def apply_journey_update(db: Session, payload: JourneyStateUpdate):
    state = get_or_create_journey_state(db, payload.user_id)

    # 1. APPLY INCOMING FIELDS
    # Only update fields explicitly sent
    for field, value in payload.model_dump(exclude_unset=True).items():
        if field == "user_id":
            continue
        setattr(state, field, value)

    # 2. APPLY PROGRESSION RULES
    _apply_progression_rules(state)

    # 3. SAVE CHANGES
    db.commit()
    db.refresh(state)
    return state


# ---------------------------------------------------------
# AUTOMATIC PROGRESSION RULES
# ---------------------------------------------------------
def _apply_progression_rules(state: UserJourneyState):
    """
    Backend-controlled progression logic.
    NEVER let the frontend set current_stage or progress.
    """

    # -----------------------------
    # DISCOVERY COMPLETION
    # -----------------------------
    if state.chat_intro_done and state.questionnaire_completed:
        state.discovery_completed = True
    else:
        state.discovery_completed = False

    # -----------------------------
    # COACH COMPLETION
    # -----------------------------
    if state.is_career_unlock_confirmed:
        state.coach_completed = True

    # -----------------------------
    # MATCHES COMPLETION
    # -----------------------------
    if state.matches_completed:
        state.coach_completed = True

    # -----------------------------
    # ACTION COMPLETION
    # -----------------------------
    if state.action_completed:
        state.matches_completed = True
        state.coach_completed = True

    # -----------------------------
    # LAUNCH COMPLETION
    # -----------------------------
    if state.launch_completed:
        state.action_completed = True
        state.matches_completed = True
        state.coach_completed = True

    # -----------------------------
    # DETERMINE CURRENT STAGE
    # -----------------------------
    if not state.discovery_completed:
        state.current_stage = "discovery"

    elif state.discovery_completed and not state.coach_completed:
        state.current_stage = "coaching"

    elif state.coach_completed and not state.matches_completed:
        state.current_stage = "matches"

    elif state.matches_completed and not state.action_completed:
        state.current_stage = "action"

    elif state.action_completed and not state.launch_completed:
        state.current_stage = "launch"

    else:
        state.current_stage = "completed"

    # -----------------------------
    # PROGRESS PERCENT BASED ON PAST STAGES
    # -----------------------------
    completed_stages = 0

    if state.discovery_completed:
        completed_stages += 1
    if state.coach_completed:
        completed_stages += 1
    if state.matches_completed:
        completed_stages += 1
    if state.action_completed:
        completed_stages += 1
    if state.launch_completed:
        completed_stages += 1

    state.progress_percent = completed_stages * 20


# ---------------------------------------------------------
# FETCH LIST OF CAREERS WHERE USER CLICKED "READY TO TAKE ACTION"
# ---------------------------------------------------------
from app.models.user_recommendation import UserRecommendationAction
from app.models.career_profile import CareerProfile
from app.api.schemas.journey_schemas import CareerActionItem


def get_actionable_careers(db: Session, user_id: int):
    """
    Returns all careers where action='action_taken'
    Used for Take Action popup.
    """

    # Ensure user exists
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Fetch action_taken rows
    actions = (
        db.query(UserRecommendationAction)
        .filter(
            UserRecommendationAction.user_id == user_id,
            UserRecommendationAction.action == "action_taken"
        )
        .all()
    )

    if not actions:
        return []  # no careers started yet

    career_ids = [a.career_profile_id for a in actions]

    # Fetch career profile titles
    careers = (
        db.query(CareerProfile)
        .filter(CareerProfile.id.in_(career_ids))
        .all()
    )

    # Convert to Pydantic DTOs
    result = [
        CareerActionItem(
            career_profile_id=c.id,
            title=c.title
        )
        for c in careers
    ]

    return result

# ---------------------------------------------------------
# FETCH LIST OF CAREERS WHERE USER COMPLETED MICROSTEPS
# (is_ready_to_launch = TRUE)
# ---------------------------------------------------------
from app.models.microstep import Microstep


def get_launchable_careers(db: Session, user_id: int):
    """
    Returns all careers from microsteps where is_ready_to_launch = TRUE.
    Used for Ready to Launch popup.
    """

    # Ensure user exists
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Fetch microsteps where user completed the steps
    ms_rows = (
        db.query(Microstep)
        .filter(
            Microstep.user_id == user_id,
            Microstep.is_ready_to_launch == True
        )
        .all()
    )

    if not ms_rows:
        return []

    # Convert to DTO
    result = [
        CareerActionItem(
            career_profile_id=m.career_id,   # matches your column name
            title=m.career_title             # use title directly
        )
        for m in ms_rows
    ]

    return result
