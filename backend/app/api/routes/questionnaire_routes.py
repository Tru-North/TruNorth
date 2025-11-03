from fastapi import APIRouter, HTTPException
from datetime import datetime
from app.schemas.questionnaire_schemas import (
    ChatResponseCreate,
    QuestionnaireResponseCreate,
    UserProgressUpdate,
    QuestionnaireSubmitResponse,
)
from app.services.questionnaire_service import (
    load_questionnaire,
    save_chat_response,
    save_questionnaire_response,
    update_user_progress,
    mark_questionnaire_complete,
    generate_output_json,
    get_user_output_json,
    get_saved_responses,   # ✅ NEW import
    get_user_answer_counts,  # ✅ NEW import

)

router = APIRouter(prefix="/questionnaire", tags=["Questionnaire"])


# ---------- 1️⃣ Get Questionnaire JSON ----------
@router.get("/")
async def get_questionnaire():
    """
    Returns the complete questionnaire structure from `questions.json`.
    """
    try:
        data = load_questionnaire()
        return {"message": "Questionnaire loaded successfully", "data": data}
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load questionnaire: {e}")


# ---------- 2️⃣ Save Chatbot Response ----------
@router.post("/chat/save")
async def save_chat_response_route(payload: ChatResponseCreate):
    try:
        save_chat_response(payload)
        return {"message": "Chat response saved successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ---------- 3️⃣ Save Questionnaire Response ----------
@router.post("/save")
async def save_questionnaire_response_route(payload: QuestionnaireResponseCreate):
    try:
        save_questionnaire_response(payload)
        return {"message": "Answer saved successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ---------- 🆕 3B. Bulk Save Questionnaire Responses ----------
from typing import Dict, Any, List
from fastapi import Body

@router.post("/bulk-save")
async def bulk_save_questionnaire_responses(
    payload: Dict[str, List[Dict[str, Any]]] = Body(...)
):
    """
    Accepts a list of questionnaire responses and saves them in bulk.
    Example:
    {
        "responses": [
            {"user_id": 1, "category": "about_me", "question_id": "about_1", "answer": "Exploring"},
            {"user_id": 1, "category": "values", "question_id": "values_1", "answer": ["Trust", "Purpose"]}
        ]
    }
    """
    try:
        from app.services.questionnaire_service import save_bulk_questionnaire_responses
        save_bulk_questionnaire_responses(payload.get("responses", []))
        return {"message": "Bulk responses saved successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to bulk save responses: {e}")

# ---------- 4️⃣ Update Progress ----------
@router.post("/progress")
async def update_progress_route(payload: UserProgressUpdate):
    try:
        progress = update_user_progress(payload)
        return {
            "message": "Progress updated successfully",
            "current_tab": progress.current_tab,
            "is_completed": progress.is_completed,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ✅ ---------- NEW: 5️⃣ Get Saved Responses ----------
@router.get("/responses/{user_id}")
async def get_saved_responses_route(user_id: int):
    """
    Fetch all saved questionnaire responses for a user.
    Used by frontend to auto-fill previously answered questions.
    """
    from app.services.questionnaire_service import get_saved_responses

    try:
        data = get_saved_responses(user_id)
        return {"message": "Saved responses fetched successfully", "data": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch saved responses: {e}")


# ✅ ---------- NEW: 6️⃣ Get User Progress ----------
@router.get("/progress/{user_id}")
async def get_user_progress_route(user_id: int):
    from app.models.questionnaire import UserProgress
    from app.core.database import SessionLocal

    db = SessionLocal()
    try:
        progress = db.query(UserProgress).filter(UserProgress.user_id == user_id).first()

        if not progress:
            # Auto-create a default progress entry
            progress = UserProgress(user_id=user_id, current_tab=1, is_completed=False)
            db.add(progress)
            db.commit()
            db.refresh(progress)

        return {
            "message": "Progress fetched successfully",
            "user_id": user_id,
            "current_tab": progress.current_tab,
            "is_completed": progress.is_completed,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch progress: {e}")
    finally:
        db.close()

# ---------- 7️⃣ Submit Questionnaire ----------
@router.post("/submit", response_model=QuestionnaireSubmitResponse)
async def submit_questionnaire_route(payload: UserProgressUpdate):
    """
    Marks questionnaire as completed and generates output JSON.
    """
    try:
        output = mark_questionnaire_complete(payload.user_id)
        return QuestionnaireSubmitResponse(
            message="Questionnaire submitted successfully",
            completion_time=datetime.utcnow(),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to submit questionnaire: {e}")

# ---------- 8️⃣ Get User Output JSON ----------
@router.get("/output/{user_id}")
async def get_user_output_route(user_id: int):
    """
    Fetches user's generated questionnaire output (JSON).
    """
    try:
        data = get_user_output_json(user_id)
        if not data:
            raise HTTPException(status_code=404, detail="User output not found")
        return data
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch output: {e}")

# ✅ ---------- NEW: 9️⃣ Progress Summary ----------
@router.get("/progress-summary/{user_id}")
async def get_progress_summary_route(user_id: int):
    """
    Returns number of answered questions per category for the Journey page.
    """
    try:
        summary = get_user_answer_counts(user_id)
        return {"message": "Progress summary fetched successfully", "data": summary}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch progress summary: {e}")

# ---------- 🔟 Get Chat Script ----------
@router.get("/chat")
async def get_chat_script():
    """
    Returns the static chatbot intro flow from `chat_script.json`.
    """
    import os, json
    try:
        json_path = os.path.join("app", "data", "chat_script.json")
        if not os.path.exists(json_path):
            raise FileNotFoundError("chat_script.json not found in app/data/")
        with open(json_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return {"message": "Chat script loaded successfully", "data": data}
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load chat script: {e}")

# ✅ ---------- 1️⃣1️⃣ Get Chat Responses (for Journey Check) ----------
@router.get("/chat_responses/{user_id}")
async def get_chat_responses_route(user_id: int):
    """
    Fetch all chat responses for a user.
    Used by Journey screen to verify if Discovery (chat intro) is completed.
    """
    from app.core.database import SessionLocal
    from app.models.questionnaire import ChatResponse  # adjust if stored elsewhere

    db = SessionLocal()
    try:
        responses = (
            db.query(ChatResponse)
            .filter(ChatResponse.user_id == user_id)
            .order_by(ChatResponse.timestamp.asc())
            .all()
        )

        # Return a consistent format
        if not responses:
            return {"message": "No chat responses found", "data": []}

        result = [
            {
                "id": r.id,
                "user_id": r.user_id,
                "chat_id": r.chat_id,
                "response": r.response,
                "timestamp": r.timestamp.isoformat() if r.timestamp else None,
            }
            for r in responses
        ]

        return {"message": "Chat responses fetched successfully", "data": result}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch chat responses: {e}")
    finally:
        db.close()
