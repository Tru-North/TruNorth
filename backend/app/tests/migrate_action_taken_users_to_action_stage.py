# from app.core.database import SessionLocal

# # --------------------------------------------------------------------
# # Force SQLAlchemy to register ALL models before querying anything
# # --------------------------------------------------------------------
# from app.models import (
#     user,
#     chat_history,
#     questionnaire,
#     user_recommendation,
#     user_journey_state,
#     final_data,
#     feedback,
#     career_profile,
# )

# from app.models.user_journey_state import UserJourneyState
# from app.models.user_recommendation import UserRecommendationAction


# def migrate_action_taken_users():
#     db = SessionLocal()

#     updated = 0
#     skipped = 0

#     print("===========================================================")
#     print("🔧 MIGRATION: Move users with action_taken → Action Stage")
#     print("===========================================================")

#     try:
#         all_states = db.query(UserJourneyState).all()

#         for state in all_states:
#             user_id = state.user_id

#             # Count action_taken rows for this user
#             action_count = (
#                 db.query(UserRecommendationAction)
#                 .filter(
#                     UserRecommendationAction.user_id == user_id,
#                     UserRecommendationAction.action == "action_taken",
#                 )
#                 .count()
#             )

#             # No action_taken? Skip
#             if action_count == 0:
#                 skipped += 1
#                 continue

#             # If already at action or beyond (launch), skip
#             if state.current_stage in ["action", "launch"]:
#                 skipped += 1
#                 continue

#             print("--------------------------------------------------------")
#             print(f"🔄 Updating user {user_id}")

#             print("Before:", {
#                 "current_stage": state.current_stage,
#                 "matches_completed": state.matches_completed,
#                 "action_completed": state.action_completed,
#                 "progress_percent": state.progress_percent,
#             })

#             # Apply correct updates
#             state.matches_completed = True
#             state.action_completed = False
#             state.current_stage = "action"
#             state.progress_percent = 60

#             db.add(state)
#             updated += 1

#             print("After:", {
#                 "current_stage": state.current_stage,
#                 "matches_completed": state.matches_completed,
#                 "action_completed": state.action_completed,
#                 "progress_percent": state.progress_percent,
#             })
#             print("--------------------------------------------------------")

#         db.commit()

#         print("===========================================================")
#         print(f"✅ MIGRATION COMPLETE: {updated} updated, {skipped} skipped")
#         print("===========================================================")

#     finally:
#         db.close()


# if __name__ == "__main__":
#     migrate_action_taken_users()
