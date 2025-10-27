import os
import json
from datetime import datetime
from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.models.questionnaire import ChatResponse, QuestionnaireResponse, UserProgress
from app.schemas.questionnaire_schemas import (
    ChatResponseCreate,
    QuestionnaireResponseCreate,
    UserProgressUpdate,
)
from sqlalchemy import func

# ---------- Utility: DB Session Context ----------
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ---------- 1️⃣ Load Questionnaire JSON ----------
def load_questionnaire():
    """
    Reads and returns questionnaire content from the backend's static JSON.
    """
    json_path = os.path.join("app", "data", "questions.json")
    if not os.path.exists(json_path):
        raise FileNotFoundError("questions.json not found in app/data/")
    
    with open(json_path, "r", encoding="utf-8") as f:
        return json.load(f)


# ---------- 2️⃣ Save Chatbot Response ----------
def save_chat_response(payload: ChatResponseCreate):
    db: Session = SessionLocal()
    try:
        existing = (
            db.query(ChatResponse)
            .filter(
                ChatResponse.user_id == payload.user_id,
                ChatResponse.chat_id == payload.chat_id,
            )
            .first()
        )

        if existing:
            existing.response = payload.response
            existing.timestamp = datetime.utcnow()
        else:
            new_entry = ChatResponse(
                user_id=payload.user_id,
                chat_id=payload.chat_id,
                response=payload.response,
            )
            db.add(new_entry)

        db.commit()
    except Exception as e:
        db.rollback()
        raise e
    finally:
        db.close()


# ---------- 3️⃣ Save Questionnaire Response ----------
def save_questionnaire_response(payload: QuestionnaireResponseCreate):
    db: Session = SessionLocal()
    try:
        # 🪵 Log what the backend received from the frontend
        print(f"📥 [SERVICE] Received questionnaire payload: {payload.dict()}")

        existing = (
            db.query(QuestionnaireResponse)
            .filter(
                QuestionnaireResponse.user_id == payload.user_id,
                QuestionnaireResponse.question_id == payload.question_id,
            )
            .first()
        )

        if existing:
            print(
                f"🗄️ [UPDATE] Updating existing response for user_id={payload.user_id}, question_id={payload.question_id}"
            )
            existing.answer = payload.answer
            existing.timestamp = datetime.utcnow()
        else:
            print(
                f"🆕 [INSERT] Creating new response for user_id={payload.user_id}, category={payload.category}, question_id={payload.question_id}"
            )
            new_entry = QuestionnaireResponse(
                user_id=payload.user_id,
                category=payload.category,
                question_id=payload.question_id,
                answer=payload.answer,
            )
            db.add(new_entry)

        db.commit()
        print(
            f"✅ [COMMIT SUCCESS] Saved response for user_id={payload.user_id}, question_id={payload.question_id}"
        )

        # 🧩 Automatically recheck and update user progress after each save
        try:
            from app.services.questionnaire_service import (
                get_saved_responses,
                load_questionnaire,
                update_user_progress,
            )

            # Load questionnaire + responses
            questionnaire_data = load_questionnaire()
            saved_responses = get_saved_responses(payload.user_id)

            answered_qids = {r["question_id"] for r in saved_responses}

            # ✅ Fix: correctly extract all required question IDs across ALL sections
            required_qids = set()
            data_root = questionnaire_data.get("data") or questionnaire_data
            sections = data_root.get("sections", [])

            for section in sections:
                if section.get("required", False):  # only sections explicitly marked required
                    questions = section.get("questions", [])
                    for q in questions:
                        qid = q.get("id")
                        if qid:
                            required_qids.add(qid)

            # ✅ Determine completion
            all_required_answered = (
                len(required_qids) > 0 and required_qids.issubset(answered_qids)
            )

            # ✅ Update DB progress
            update_user_progress(
                UserProgressUpdate(
                    user_id=payload.user_id,
                    current_tab=None,
                    is_completed=all_required_answered,
                )
            )

            print(
                f"🔄 [AUTO PROGRESS CHECK] user_id={payload.user_id}, "
                f"answered_required={len(answered_qids & required_qids)}/{len(required_qids)}, "
                f"is_completed={all_required_answered}"
            )

            if all_required_answered:
                print(
                    f"🎯 [ALL REQUIRED COMPLETED] User {payload.user_id} finished ALL required sections!"
                )

        except Exception as progress_err:
            print(f"⚠️ [PROGRESS SYNC WARNING] {progress_err}")

    except Exception as e:
        db.rollback()
        print(f"❌ [SERVICE ERROR] Failed to save questionnaire response: {e}")
        raise e
    finally:
        db.close()

# ---------- 4️⃣ Update User Progress ----------
def update_user_progress(payload: UserProgressUpdate):
    db: Session = SessionLocal()
    try:
        progress = (
            db.query(UserProgress)
            .filter(UserProgress.user_id == payload.user_id)
            .first()
        )

        if not progress:
            # 🆕 Create a new entry with explicit completion flag
            progress = UserProgress(
                user_id=payload.user_id,
                current_tab=payload.current_tab or 1,
                is_completed=bool(payload.is_completed) if payload.is_completed is not None else False,
            )
            db.add(progress)
        else:
            # ✅ Only move forward (don’t regress)
            if payload.current_tab is not None and (
                progress.current_tab is None or payload.current_tab > progress.current_tab
            ):
                progress.current_tab = payload.current_tab

            # ✅ Respect explicit completion flag
            if payload.is_completed is not None:
                progress.is_completed = payload.is_completed

            progress.saved_at = datetime.utcnow()

        db.commit()
        db.refresh(progress)
        print(
            f"✅ [PROGRESS SAVED] user_id={payload.user_id}, "
            f"tab={progress.current_tab}, completed={progress.is_completed}"
        )
        return progress

    except Exception as e:
        db.rollback()
        print(f"❌ [PROGRESS ERROR] {e}")
        raise e
    finally:
        db.close()

# ---------- 5️⃣ Mark Questionnaire Complete ----------
def mark_questionnaire_complete(user_id: int):
    """
    Marks the user's questionnaire as completed once all *required* questions are answered.
    Optional questions can be skipped safely.
    """
    from app.services.questionnaire_service import load_questionnaire

    db: Session = SessionLocal()
    try:
        # 🔹 Load questionnaire & responses
        questionnaire = load_questionnaire()
        all_sections = questionnaire.get("sections", [])
        required_questions = {
            q["id"]
            for section in all_sections
            if section.get("required", False)
            for q in section.get("questions", [])
        }

        answered_qs = {
            r.question_id
            for r in db.query(QuestionnaireResponse)
            .filter(QuestionnaireResponse.user_id == user_id)
            .all()
        }

        # ✅ Only mark complete if required ones are answered
        all_required_done = required_questions.issubset(answered_qs)

        progress = (
            db.query(UserProgress)
            .filter(UserProgress.user_id == user_id)
            .first()
        )

        if not progress:
            progress = UserProgress(
                user_id=user_id,
                current_tab=len(all_sections),
                is_completed=all_required_done,
            )
            db.add(progress)
        else:
            progress.is_completed = all_required_done
            progress.saved_at = datetime.utcnow()

        db.commit()
        db.refresh(progress)

        # 🧠 Generate output JSON only when required questions are done
        if all_required_done:
            print(f"✅ [COMPLETION] User {user_id} finished all required sections.")
            return generate_output_json(user_id)
        else:
            print(f"ℹ️ [PARTIAL] User {user_id} still missing required answers.")
            return {"message": "Progress saved but required sections incomplete."}

    except Exception as e:
        db.rollback()
        print(f"❌ [COMPLETE ERROR] {e}")
        raise e
    finally:
        db.close()

# ---------- 6️⃣ Generate Output JSON ----------
def generate_output_json(user_id: int):
    db: Session = SessionLocal()
    try:
        chat_data = db.query(ChatResponse).filter(ChatResponse.user_id == user_id).all()
        questionnaire_data = (
            db.query(QuestionnaireResponse)
            .filter(QuestionnaireResponse.user_id == user_id)
            .all()
        )

        output = {
            "user_id": user_id,
            "version": "2025.10.24",
            "completed_at": datetime.utcnow().isoformat(),
            "chat_responses": [
                {
                    "chat_id": c.chat_id,
                    "response": c.response,
                    "timestamp": c.timestamp.isoformat(),
                }
                for c in chat_data
            ],
            "questionnaire_responses": [
                {
                    "category": q.category,
                    "question_id": q.question_id,
                    "answer": q.answer,
                    "timestamp": q.timestamp.isoformat(),
                }
                for q in questionnaire_data
            ],
            "metadata": {
                "source": "TruNorth",
                "generated_at": datetime.utcnow().isoformat(),
            },
        }

        # Ensure directory exists
        output_dir = os.path.join("app", "data", "outputs")
        os.makedirs(output_dir, exist_ok=True)

        # Save to JSON file
        output_path = os.path.join(output_dir, f"{user_id}_output.json")
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(output, f, indent=4)

        return output
    except Exception as e:
        raise e
    finally:
        db.close()


# ---------- 7️⃣ Get User Output JSON ----------
def get_user_output_json(user_id: int):
    output_path = os.path.join("app", "data", "outputs", f"{user_id}_output.json")
    if not os.path.exists(output_path):
        return None

    with open(output_path, "r", encoding="utf-8") as f:
        return json.load(f)

# ---------- 8️⃣ Get Saved Questionnaire Responses ----------
def get_saved_responses(user_id: int):
    """
    Fetches all previously saved questionnaire responses for a user.
    """
    db: Session = SessionLocal()
    try:
        responses = (
            db.query(QuestionnaireResponse)
            .filter(QuestionnaireResponse.user_id == user_id)
            .all()
        )
        return [
            {
                "category": r.category,
                "question_id": r.question_id,
                "answer": r.answer,
                "timestamp": r.timestamp.isoformat(),
            }
            for r in responses
        ]
    except Exception as e:
        raise e
    finally:
        db.close()

def get_user_answer_counts(user_id: int):
    """
    Returns a dict {category: count} for how many questions the user answered in each section.
    """
    db: Session = SessionLocal()
    try:
        rows = (
            db.query(QuestionnaireResponse.category, func.count(QuestionnaireResponse.id))
            .filter(QuestionnaireResponse.user_id == user_id)
            .group_by(QuestionnaireResponse.category)
            .all()
        )
        return {category: int(count) for category, count in rows}
    except Exception as e:
        raise e
    finally:
        db.close()

