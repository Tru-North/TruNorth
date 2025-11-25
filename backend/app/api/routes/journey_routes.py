from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.schemas.journey_schemas import JourneyStateOut, JourneyStateUpdate
from app.services.journey_service import (
    get_or_create_journey_state,
    apply_journey_update
)

router = APIRouter(prefix="/journey", tags=["Journey State"])


@router.get("/state/{user_id}", response_model=JourneyStateOut)
def get_journey_state(user_id: int, db: Session = Depends(get_db)):
    state = get_or_create_journey_state(db, user_id)
    if not state:
        raise HTTPException(status_code=404, detail="Journey state not found.")
    return state


@router.post("/state/update", response_model=JourneyStateOut)
def update_journey_state(payload: JourneyStateUpdate, db: Session = Depends(get_db)):
    state = apply_journey_update(db, payload)
    return state

# ==========================================================
# NEW ROUTE: Get all actionable careers (action_taken)
# ==========================================================
from app.api.schemas.journey_schemas import ActionableCareersOut
from app.services.journey_service import get_actionable_careers


@router.get("/actionable-careers/{user_id}", response_model=ActionableCareersOut)
def get_actionable_careers_route(user_id: int, db: Session = Depends(get_db)):
    """
    Returns { user_id, careers: [...] }
    Used for the Take Action popup on Journey Map.
    """
    careers = get_actionable_careers(db, user_id)
    return {
        "user_id": user_id,
        "careers": careers
    }
