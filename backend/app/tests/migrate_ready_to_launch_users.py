# # backend/app/tests/migrate_ready_to_launch_users.py

# # backend/app/tests/migrate_ready_to_launch_users.py

# # FORCE SQLAlchemy to load all models before queries
# from app.models import (
#     user,
#     chat_history,
#     questionnaire,
#     user_recommendation,
#     user_journey_state,
#     career_profile,
#     microstep,
#     feedback,
# )

# from sqlalchemy.orm import Session
# from app.core.database import SessionLocal
# from app.models.microstep import Microstep
# from app.models.user import User
# from app.api.schemas.journey_schemas import JourneyStateUpdate
# from app.services.journey_service import apply_journey_update


# def migrate_ready_to_launch_users():
#     db: Session = SessionLocal()

#     print("==========================================================")
#     print("🔧 MIGRATION: Users with is_ready_to_launch → Launch Stage")
#     print("==========================================================")

#     updated = 0
#     skipped = 0
#     errors = 0

#     try:
#         users = db.query(User).all()
#         print(f"🔍 Found {len(users)} total users")
#         print("----------------------------------------------------------")

#         for user in users:
#             try:
#                 # Check microsteps
#                 ready_rows = db.query(Microstep).filter(
#                     Microstep.user_id == user.id,
#                     Microstep.is_ready_to_launch == True
#                 ).all()

#                 if not ready_rows:
#                     print(f"⏭ Skipping user {user.id}: No ready_to_launch microsteps")
#                     skipped += 1
#                     continue

#                 print(f"🟣 User {user.id} has {len(ready_rows)} ready-to-launch careers")

#                 # Update journey state
#                 updated_state = apply_journey_update(
#                     db,
#                     JourneyStateUpdate(
#                         user_id=user.id,
#                         action_completed=True
#                     )
#                 )

#                 updated += 1

#                 print(f"✅ Updated journey: user {user.id} → stage={updated_state.current_stage}")
#                 print("----------------------------------------------------------")

#             except Exception as e:
#                 errors += 1
#                 print(f"❌ ERROR for user {user.id}: {e}")
#                 print("----------------------------------------------------------")

#         print("==========================================================")
#         print("🎉 MIGRATION COMPLETE")
#         print("==========================================================")
#         print(f"🟢 Updated: {updated}")
#         print(f"⏩ Skipped: {skipped}")
#         print(f"⚠️ Errors: {errors}")

#     finally:
#         db.close()


# if __name__ == "__main__":
#     migrate_ready_to_launch_users()
