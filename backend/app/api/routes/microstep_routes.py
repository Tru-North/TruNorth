from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from typing import Optional
from app.models.user import User
from app.models.microstep import Microstep
from app.core.database import get_db
from app.services.ai.ai_coach_service import AICoachService
from app.models.career_profile import CareerProfile
from sqlalchemy import text
from datetime import datetime, timezone
from pydantic import BaseModel

ai_coach_service = AICoachService()
router = APIRouter(prefix="/microsteps", tags=["microsteps"])

def get_current_user(
    x_firebase_uid: Optional[str] = Header(None),
    db: Session = Depends(get_db)
) -> Optional[User]:
    """Extract user from x-firebase-uid header"""
    if not x_firebase_uid:
        return None
    return db.query(User).filter(User.firebase_uid == x_firebase_uid).first()


# Generate/Replace Microstep
@router.post("/generate/{career_id}", summary="Generate microsteps for a career (replaces existing)")
async def generate_and_save_microsteps(
    career_id: int,
    x_firebase_uid: str = Header(..., description="Firebase UID for authentication"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Generate and save microsteps for a career.
    - Deletes any existing microsteps for this user
    - Creates new microsteps with progress tracking
    """
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    profile = db.query(CareerProfile).filter(CareerProfile.id == career_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Career not found")
    
    return await ai_coach_service.ask_microsteps_and_save(
        user=user, db=db, career_id=career_id, job_profile=profile.title
    )


@router.get("/", summary="Get all microsteps for current user")
def get_user_microsteps(
    x_firebase_uid: str = Header(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all microsteps for the authenticated user"""
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    microsteps = db.query(Microstep).filter_by(user_id=user.id).order_by(Microstep.created_at.desc()).all()
    
    return {
        "microsteps": [
            {
                "id": m.id,
                "career_id": m.career_id,
                "career_title": m.career_title,
                "data": m.data,
                "created_at": m.created_at.isoformat(),
                "updated_at": m.updated_at.isoformat() if m.updated_at else None
            }
            for m in microsteps
        ],
        "total": len(microsteps)
    }

@router.get("/career/{career_id}", summary="Get microstep for specific career")
def get_microstep_by_career(
    career_id: int,
    x_firebase_uid: str = Header(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get microstep for a specific career"""
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    microstep = db.query(Microstep).filter_by(
        user_id=user.id,
        career_id=career_id
    ).first()
    
    if not microstep:
        raise HTTPException(status_code=404, detail=f"No microstep found for career_id={career_id}")
    
    return {
        "id": microstep.id,
        "career_id": microstep.career_id,
        "career_title": microstep.career_title,
        "data": microstep.data,
        "created_at": microstep.created_at.isoformat(),
        "updated_at": microstep.updated_at.isoformat() if microstep.updated_at else None
    }

@router.get("/{microstep_id}", summary="Get specific microstep by ID")
def get_microstep_by_id(
    microstep_id: int,
    x_firebase_uid: str = Header(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific microstep by ID"""
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    microstep = db.query(Microstep).filter_by(
        id=microstep_id,
        user_id=user.id
    ).first()
    
    if not microstep:
        raise HTTPException(status_code=404, detail="Microstep not found")
    
    return {
        "id": microstep.id,
        "career_id": microstep.career_id,
        "career_title": microstep.career_title,
        "data": microstep.data,
        "created_at": microstep.created_at.isoformat(),
        "updated_at": microstep.updated_at.isoformat() if microstep.updated_at else None
    }



@router.patch("/{microstep_id}/progress", summary="Update progress for a microstep")
def update_progress(
    microstep_id: int,
    step_index: int,
    ministep_index: Optional[int] = None,
    status: str = "completed",
    x_firebase_uid: str = Header(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update progress for a step or ministep.
    - microstep_id: ID of the microstep
    - step_index: Index of the main step
    - ministep_index: (Optional) Index of the ministep within the step
    - status: "incomplete", "in_progress", or "completed"
    """
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    # Validate status
    valid_statuses = ["incomplete", "in_progress", "completed"]
    if status not in valid_statuses:
        raise HTTPException(
            status_code=400, 
            detail=f"Invalid status. Must be one of: {', '.join(valid_statuses)}"
        )
    
    # Get the specific microstep
    microstep = db.query(Microstep).filter_by(
        id=microstep_id,
        user_id=user.id
    ).first()
    
    if not microstep:
        raise HTTPException(status_code=404, detail="Microstep not found")
    
    # Make a copy
    data = dict(microstep.data)
    steps = data.get("steps", [])
    
    if step_index >= len(steps):
        raise HTTPException(status_code=400, detail="Invalid step_index")
    
    # Update ministep if specified
    if ministep_index is not None:
        ministeps = steps[step_index].get("ministeps", [])
        if ministep_index >= len(ministeps):
            raise HTTPException(status_code=400, detail="Invalid ministep_index")
        
        ministeps[ministep_index]["status"] = status
        print(f"✅ Updated ministep {ministep_index} in step {step_index} to status={status}")
    else:
        # Update main step
        steps[step_index]["status"] = status
        print(f"✅ Updated step {step_index} to status={status}")
        
        # If step is marked as "completed", mark all ministeps as "completed"
        if status == "completed":
            ministeps = steps[step_index].get("ministeps", [])
            for ministep in ministeps:
                ministep["status"] = "completed"
            print(f"✅ Auto-completed all {len(ministeps)} ministeps in step {step_index}")
    
    # Force SQLAlchemy to detect change
    microstep.data = data
    from sqlalchemy.orm.attributes import flag_modified
    flag_modified(microstep, "data")
    
    db.commit()
    db.refresh(microstep)
    
    return {
        "message": "Progress updated successfully",
        "microstep_id": microstep_id,
        "step_index": step_index,
        "ministep_index": ministep_index,
        "status": status,
        "data": microstep.data
    }



@router.delete("/{microstep_id}", summary="Delete a specific microstep")
def delete_microstep(
    microstep_id: int,
    x_firebase_uid: str = Header(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a specific microstep"""
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    microstep = db.query(Microstep).filter_by(
        id=microstep_id,
        user_id=user.id
    ).first()
    
    if not microstep:
        raise HTTPException(status_code=404, detail="Microstep not found")
    
    db.delete(microstep)
    db.commit()
    
    return {"message": "Microstep deleted successfully", "deleted_id": microstep_id}



@router.post("/{microstep_id}/summary/{step_index}", summary="Generate step summary")
async def generate_step_summary(
    microstep_id: int,
    step_index: int,
    reflection: Optional[str] = None,
    x_firebase_uid: str = Header(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Generate an AI summary for a specific microstep"""
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    microstep = db.query(Microstep).filter_by(
        id=microstep_id,
        user_id=user.id
    ).first()
    
    if not microstep:
        raise HTTPException(status_code=404, detail="Microstep not found")
    
    steps = microstep.data.get("steps", [])
    if step_index >= len(steps):
        raise HTTPException(status_code=400, detail="Invalid step_index")
    
    step = steps[step_index]
    
    # Generate summary using AI Coach Service
    summary = await ai_coach_service.generate_microstep_summary(
        step=step,
        reflection=reflection,
        career_title=microstep.career_title
    )
    
    return {
        "microstep_id": microstep_id,
        "step_index": step_index,
        "step_title": step.get("title"),
        "summary": summary
    }




# Pydantic schema for reflection
class ReflectionChatRequest(BaseModel):
    message: str

# ==========================================
# REFLECTION CHAT ENDPOINTS
# ==========================================

@router.post("/{microstep_id}/reflection-chat/{step_index}", summary="Chat with AI coach about a step")
async def send_reflection_message(
    microstep_id: int,
    step_index: int,
    request: ReflectionChatRequest,
    x_firebase_uid: str = Header(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Send a message to the AI coach about a specific microstep.
    The coach provides personalized guidance based on the step context.
    """
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    # Get the microstep
    microstep = db.query(Microstep).filter_by(
        id=microstep_id,
        user_id=user.id
    ).first()
    
    if not microstep:
        raise HTTPException(status_code=404, detail="Microstep not found")
    
    # Get steps data
    data = dict(microstep.data)
    steps = data.get("steps", [])
    
    if step_index >= len(steps):
        raise HTTPException(status_code=400, detail="Invalid step_index")
    
    step = steps[step_index]
    
    # Initialize chat history if not exists
    if "reflection_chat" not in step:
        step["reflection_chat"] = []
    
    # Add user message to chat history
    user_message = {
        "role": "user",
        "message": request.message,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    step["reflection_chat"].append(user_message)
    
    # Generate AI response using context
    ai_response = await ai_coach_service.generate_reflection_response(
        step=step,
        user_message=request.message,
        career_title=microstep.career_title,
        chat_history=step["reflection_chat"]
    )
    
    assistant_message = {
        "role": "assistant",
        "message": ai_response,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    step["reflection_chat"].append(assistant_message)
    
    # Save changes
    microstep.data = data
    from sqlalchemy.orm.attributes import flag_modified
    flag_modified(microstep, "data")
    
    db.commit()
    db.refresh(microstep)
    
    print(f"💬 Reflection chat: User sent message for step {step_index}")
    
    return {
        "microstep_id": microstep_id,
        "step_index": step_index,
        "step_title": step.get("title"),
        "user_message": user_message,
        "assistant_response": assistant_message,
        "chat_length": len(step["reflection_chat"])
    }


@router.get("/{microstep_id}/reflection-chat/{step_index}", summary="Get reflection chat history")
def get_reflection_chat(
    microstep_id: int,
    step_index: int,
    x_firebase_uid: str = Header(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get the complete reflection chat history for a specific step"""
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    microstep = db.query(Microstep).filter_by(
        id=microstep_id,
        user_id=user.id
    ).first()
    
    if not microstep:
        raise HTTPException(status_code=404, detail="Microstep not found")
    
    steps = microstep.data.get("steps", [])
    
    if step_index >= len(steps):
        raise HTTPException(status_code=400, detail="Invalid step_index")
    
    step = steps[step_index]
    chat_history = step.get("reflection_chat", [])
    
    return {
        "microstep_id": microstep_id,
        "step_index": step_index,
        "step_title": step.get("title"),
        "step_status": step.get("status"),
        "difficulty_level": step.get("difficulty_level"),
        "estimated_time": step.get("estimated_time"),
        "chat": chat_history,
        "message_count": len(chat_history)
    }


@router.delete("/{microstep_id}/reflection-chat/{step_index}", summary="Clear reflection chat")
def clear_reflection_chat(
    microstep_id: int,
    step_index: int,
    x_firebase_uid: str = Header(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Clear all reflection chat messages for a step"""
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    microstep = db.query(Microstep).filter_by(
        id=microstep_id,
        user_id=user.id
    ).first()
    
    if not microstep:
        raise HTTPException(status_code=404, detail="Microstep not found")
    
    data = dict(microstep.data)
    steps = data.get("steps", [])
    
    if step_index >= len(steps):
        raise HTTPException(status_code=400, detail="Invalid step_index")
    
    step = steps[step_index]
    message_count = len(step.get("reflection_chat", []))
    step["reflection_chat"] = []
    
    # Save changes
    microstep.data = data
    from sqlalchemy.orm.attributes import flag_modified
    flag_modified(microstep, "data")
    
    db.commit()
    
    return {
        "message": f"Cleared {message_count} messages from reflection chat",
        "microstep_id": microstep_id,
        "step_index": step_index
    }


@router.get("/{microstep_id}/reflection-chats", summary="Get all reflection chats overview")
def get_all_reflection_chats(
    microstep_id: int,
    x_firebase_uid: str = Header(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get overview of all reflection chats in a microstep"""
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    microstep = db.query(Microstep).filter_by(
        id=microstep_id,
        user_id=user.id
    ).first()
    
    if not microstep:
        raise HTTPException(status_code=404, detail="Microstep not found")
    
    steps = microstep.data.get("steps", [])
    
    chats_overview = []
    for step in steps:
        chat = step.get("reflection_chat", [])
        if chat:
            # Get last message
            last_message = chat[-1] if chat else None
            
            chats_overview.append({
                "step_index": step.get("step_index"),
                "step_title": step.get("title"),
                "step_status": step.get("status"),
                "message_count": len(chat),
                "last_message": {
                    "role": last_message["role"],
                    "message": last_message["message"][:100] + "..." if len(last_message["message"]) > 100 else last_message["message"],
                    "timestamp": last_message["timestamp"]
                } if last_message else None
            })
    
    return {
        "microstep_id": microstep_id,
        "career_title": microstep.career_title,
        "active_chats": chats_overview,
        "total_chats": len(chats_overview)
    }
