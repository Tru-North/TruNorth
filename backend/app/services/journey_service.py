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
