from datetime import datetime
from typing import Optional
from pydantic import BaseModel


# ------------------------------
# OUTBOUND SCHEMA (Frontend GET)
# ------------------------------
class JourneyStateOut(BaseModel):
    user_id: int

    chat_intro_done: bool
    questionnaire_completed: bool
    discovery_completed: bool
    coach_completed: bool
    matches_completed: bool
    action_completed: bool
    launch_completed: bool

    is_career_unlock_confirmed: bool

    current_stage: str
    progress_percent: int

    updated_at: datetime

    class Config:
        from_attributes = True  # for ORM → Pydantic
        

# ------------------------------
# INBOUND SCHEMA (Frontend POST)
# ------------------------------
class JourneyStateUpdate(BaseModel):
    user_id: int

    chat_intro_done: Optional[bool] = None
    questionnaire_completed: Optional[bool] = None
    coach_completed: Optional[bool] = None
    matches_completed: Optional[bool] = None
    action_completed: Optional[bool] = None
    launch_completed: Optional[bool] = None

    is_career_unlock_confirmed: Optional[bool] = None

    # Do NOT include current_stage or progress_percent here.
