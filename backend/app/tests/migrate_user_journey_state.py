# NOTE:
# This script was used once on 2025-18-11 to migrate legacy users into
# the new user_journey_state table.
# It is now disabled to prevent accidental re-execution.

# # backend/app/tests/migrate_user_journey_state.py

# from datetime import datetime
# from sqlalchemy.orm import Session

# from app.core.database import SessionLocal
# from app.models.user import User
# from app.models.questionnaire import ChatResponse, UserProgress
# from app.models.user_journey_state import UserJourneyState
# # Force SQLAlchemy to register all models before using relationships
# from app.models import (
#     user,
#     chat_history,
#     questionnaire,
#     user_journey_state,
#     user_recommendation,
#     final_data,
#     feedback,
#     career_profile,
# )

# # ---------------------------------------------------------
# # SAFE HELPERS WITH LOGGING
# # ---------------------------------------------------------

# def infer_chat_intro_done(db: Session, user_id: int) -> bool:
#     responses = (
#         db.query(ChatResponse)
#         .filter(ChatResponse.user_id == user_id)
#         .all()
#     )

#     print(f"    🔍 Chat Responses found: {len(responses)}")

#     for r in responses:
#         text = str(r.response)
#         if r.chat_id == "chat_5":
#             print("    ✅ Chat intro detected: chat_5 found")
#             return True
#         if "Yes, ready!" in text:
#             print("    ✅ Chat intro detected: 'Yes, ready!' found")
#             return True
#         if "Maybe later" in text:
#             print("    ✅ Chat intro detected: 'Maybe later' found")
#             return True

#     print("    ❌ Chat intro NOT completed")
#     return False


# def infer_questionnaire_completed(db: Session, user_id: int) -> bool:
#     progress = (
#         db.query(UserProgress)
#         .filter(
#             UserProgress.user_id == user_id,
#             UserProgress.is_completed.is_(True),
#         )
#         .first()
#     )

#     if progress:
#         print("    ✅ Questionnaire Completed = True (via UserProgress)")
#         return True

#     print("    ❌ Questionnaire NOT completed")
#     return False


# def compute_journey_values(db: Session, user: User) -> dict:
#     print("----------------------------------------------------------")
#     print(f"🔵 MIGRATING USER {user.id} ({user.email})")
#     print("----------------------------------------------------------")

#     # 1. Chat intro
#     chat_intro_done = infer_chat_intro_done(db, user.id)

#     # 2. Questionnaire
#     questionnaire_completed = infer_questionnaire_completed(db, user.id)

#     # 3. Discovery
#     discovery_completed = chat_intro_done and questionnaire_completed
#     print(f"    🔹 Discovery Completed = {discovery_completed}")

#     # 4. Career unlock from old users table
#     is_unlock = bool(user.is_career_unlock_confirmed)
#     print(f"    🔹 Legacy Career Unlock = {is_unlock}")

#     # 5. Coach completed
#     coach_completed = is_unlock
#     print(f"    🔹 Coach Completed = {coach_completed}")

#     # 6. Other stages (cannot infer)
#     matches_completed = False
#     action_completed = False
#     launch_completed = False

#     # 7. Compute current stage
#     if launch_completed:
#         current_stage = "launch"
#     elif action_completed:
#         current_stage = "action"
#     elif matches_completed or is_unlock:
#         current_stage = "matches"
#     elif discovery_completed:
#         current_stage = "coaching"
#     else:
#         current_stage = "discovery"

#     print(f"    🔹 Current Stage = {current_stage}")

#     # 8. Compute progress
#     progress = 0
#     if discovery_completed: progress += 20
#     if coach_completed: progress += 20
#     if is_unlock: progress += 20  # matches stage
#     # action + launch left false intentionally

#     print(f"    🔹 Progress Percent = {progress}%")

#     return {
#         "chat_intro_done": chat_intro_done,
#         "questionnaire_completed": questionnaire_completed,
#         "discovery_completed": discovery_completed,
#         "coach_completed": coach_completed,
#         "matches_completed": matches_completed,
#         "action_completed": action_completed,
#         "launch_completed": launch_completed,
#         "is_career_unlock_confirmed": is_unlock,
#         "current_stage": current_stage,
#         "progress_percent": progress,
#     }


# # ---------------------------------------------------------
# # MAIN MIGRATION FUNCTION
# # ---------------------------------------------------------

# def migrate_user_journey_state():
#     db: Session = SessionLocal()
#     created = 0
#     skipped = 0
#     errors = 0

#     try:
#         users = db.query(User).all()
#         print(f"🔵 Found {len(users)} total users")
#         print("==========================================================")

#         for user in users:
#             try:
#                 existing = (
#                     db.query(UserJourneyState)
#                     .filter(UserJourneyState.user_id == user.id)
#                     .first()
#                 )

#                 if existing:
#                     print(f"⏩ SKIPPED USER {user.id}: Journey row already exists")
#                     skipped += 1
#                     print("----------------------------------------------------------\n")
#                     continue

#                 # Calculate all fields safely
#                 values = compute_journey_values(db, user)

#                 # Create new journey row
#                 new_state = UserJourneyState(
#                     user_id=user.id,
#                     chat_intro_done=values["chat_intro_done"],
#                     questionnaire_completed=values["questionnaire_completed"],
#                     discovery_completed=values["discovery_completed"],
#                     coach_completed=values["coach_completed"],
#                     matches_completed=values["matches_completed"],
#                     action_completed=values["action_completed"],
#                     launch_completed=values["launch_completed"],
#                     is_career_unlock_confirmed=values["is_career_unlock_confirmed"],
#                     current_stage=values["current_stage"],
#                     progress_percent=values["progress_percent"],
#                     updated_at=datetime.utcnow(),
#                 )

#                 db.add(new_state)
#                 created += 1

#                 print(f"✅ INSERTED JOURNEY ROW for user {user.id}")
#                 print("----------------------------------------------------------\n")

#             except Exception as e:
#                 errors += 1
#                 print(f"❌ ERROR for user {user.id}: {e}")
#                 print("----------------------------------------------------------\n")

#         db.commit()

#         print("==========================================================")
#         print("🎉 MIGRATION COMPLETE")
#         print("==========================================================")
#         print(f"🟢 Created: {created}")
#         print(f"⏩ Skipped (already had journey state): {skipped}")
#         print(f"⚠️ Errors: {errors}")

#     finally:
#         db.close()


# if __name__ == "__main__":
#     migrate_user_journey_state()
