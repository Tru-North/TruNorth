# """
# Migration Script:
# Mark launch_completed=True for users who already have progress_summary.
# """
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
# from app.core.database import SessionLocal
# from app.models.microstep import Microstep
# from app.models.user_journey_state import UserJourneyState
# from app.api.schemas.journey_schemas import JourneyStateUpdate
# from app.services.journey_service import apply_journey_update


# def migrate_launch_completed_users():
#     db = SessionLocal()
#     print("\n==========================================================")
#     print("🔧 MIGRATION: Progress Summary → Launch Completed Stage")
#     print("==========================================================\n")

#     try:
#         # 1️⃣ Get all microsteps with NON-NULL progress summaries
#         rows = (
#             db.query(Microstep)
#             .filter(Microstep.progress_summary.isnot(None))
#             .all()
#         )

#         if not rows:
#             print("⚠️ No microsteps found with progress_summary. Nothing to migrate.")
#             return

#         print(f"🔍 Found {len(rows)} microsteps with progress_summary.\n")

#         migrated_users = set()

#         for ms in rows:
#             uid = ms.user_id

#             if uid in migrated_users:
#                 continue  # Avoid duplicate updates for same user

#             # Fetch journey state row
#             journey = (
#                 db.query(UserJourneyState)
#                 .filter(UserJourneyState.user_id == uid)
#                 .first()
#             )

#             if not journey:
#                 print(f"❗ User {uid} has summary but no journey_state → creating new row")
            
#             # 2️⃣ Apply update
#             apply_journey_update(
#                 db,
#                 JourneyStateUpdate(
#                     user_id=uid,
#                     launch_completed=True
#                 )
#             )

#             migrated_users.add(uid)
#             print(f"✅ Migrated user {uid} → launch_completed=True")

#         print("\n🎉 Migration complete!")
#         print(f"Total users migrated: {len(migrated_users)}")

#     except Exception as e:
#         print(f"\n❌ ERROR during migration: {e}\n")

#     finally:
#         db.close()


# if __name__ == "__main__":
#     migrate_launch_completed_users()
