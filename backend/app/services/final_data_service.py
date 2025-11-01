# backend/app/services/final_data_service.py
from datetime import datetime, timezone
from typing import Any, Dict, List
from sqlalchemy.orm import Session

from app.models.questionnaire import ChatResponse, QuestionnaireResponse, UserProgress
from app.utils.data_loaders import load_questions, load_chat_script

from app.models.final_data import UserFinalData
from sqlalchemy import select, insert

def build_user_final_json(db: Session, user_id: int) -> Dict[str, Any]:
    """
    Builds the complete final JSON for a user by combining:
    - Chat responses
    - Questionnaire responses
    - Progress information
    """
    # 1️⃣ Load lookup data
    q_lookup = load_questions()      # question_id → {question_text, type, scale, category}
    c_lookup = load_chat_script()    # chat_id → {question_text}

    # 2️⃣ Fetch user progress (latest)
    progress_entry: UserProgress | None = (
        db.query(UserProgress)
        .filter(UserProgress.user_id == user_id)
        .order_by(UserProgress.saved_at.desc())
        .first()
    )

    is_completed = progress_entry.is_completed if progress_entry else False
    current_tab = progress_entry.current_tab if progress_entry else 0

    # 3️⃣ Compute progress
    total_tabs = len({v["category"] for v in q_lookup.values()})
    progress = {
        "completed_tabs": total_tabs if is_completed else current_tab,
        "total_tabs": total_tabs,
        "percentage": 100 if is_completed else round((current_tab / total_tabs) * 100, 2) if total_tabs else 0,
    }

    # 4️⃣ Fetch chat responses
    chat_rows: List[ChatResponse] = (
        db.query(ChatResponse)
        .filter(ChatResponse.user_id == user_id)
        .order_by(ChatResponse.id.asc())
        .all()
    )

    intro_chat = []
    for r in chat_rows:
        chat_meta = c_lookup.get(r.chat_id, {})
        intro_chat.append({
            "chat_id": r.chat_id,
            "question_text": chat_meta.get("question_text", ""),
            "response": r.response,
        })

    # 5️⃣ Fetch questionnaire responses
    qn_rows: List[QuestionnaireResponse] = (
        db.query(QuestionnaireResponse)
        .filter(QuestionnaireResponse.user_id == user_id)
        .order_by(QuestionnaireResponse.id.asc())
        .all()
    )

    questionnaire_responses = []
    for r in qn_rows:
        meta = q_lookup.get(r.question_id, {})
        entry = {
            "category": meta.get("category", r.category),
            "question_id": r.question_id,
            "question_text": meta.get("question_text", ""),
            "type": meta.get("type", ""),
            "answer": r.answer,
        }
        if meta.get("scale"):
            entry["scale"] = meta["scale"]
        questionnaire_responses.append(entry)

    # 6️⃣ Assemble final JSON
    final_json: Dict[str, Any] = {
        "user_id": user_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "intro_chat": intro_chat,
        "questionnaire_responses": questionnaire_responses,
        "progress": progress,
    }

    return final_json

def can_create_for_user(db: Session, user_id: int) -> bool:
    """
    Checks if the user is eligible for creation (is_completed = TRUE).
    """
    progress = (
        db.query(UserProgress)
        .filter(UserProgress.user_id == user_id)
        .order_by(UserProgress.saved_at.desc())
        .first()
    )
    return bool(progress and progress.is_completed)


def save_user_final_data(db: Session, user_id: int) -> Dict[str, Any]:
    """
    Creates or updates the user's final JSON in user_final_data.
    - Inserts first time only if is_completed = TRUE.
    - Updates on every later call.
    """
    from datetime import datetime, timezone

    payload = build_user_final_json(db, user_id)

    existing = (
        db.query(UserFinalData)
        .filter(UserFinalData.user_id == user_id)
        .first()
    )

    if existing:
        # ✅ Update existing record
        existing.final_json = payload
        existing.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(existing)
        return {"action": "updated", "data": payload}

    # ✅ Insert only if user completed questionnaire
    if can_create_for_user(db, user_id):
        new_row = UserFinalData(
            user_id=user_id,
            final_json=payload,
            updated_at=datetime.now(timezone.utc),
        )
        db.add(new_row)
        db.commit()
        db.refresh(new_row)
        return {"action": "created", "data": payload}

    # ❌ Skip insert if not completed
    return {"action": "skipped", "reason": "user not completed", "data": payload}
