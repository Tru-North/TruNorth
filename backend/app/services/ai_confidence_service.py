from math import floor
from sqlalchemy.orm import Session
from typing import Optional, Dict, Any

from app.models.user_journey_state import UserJourneyState
from app.models.questionnaire import QuestionnaireResponse
from app.models.chat_history import ChatHistory
from app.models.user_recommendation import UserCareerRecommendation
from app.models.user_recommendation import UserRecommendationAction


class AIConfidenceService:

    # -----------------------------
    # 1. M1: Questionnaire Score
    # -----------------------------
    def compute_questionnaire_score(self, db: Session, user_id: int) -> int:
        # Required questions
        total_required = db.query(QuestionnaireResponse).filter(
            QuestionnaireResponse.user_id == user_id,
            # QuestionnaireResponse.required == True  <- Assuming 'required' is a field. If not, this needs adjustment.
        ).count()

        answered_required = db.query(QuestionnaireResponse).filter(
            QuestionnaireResponse.user_id == user_id,
            # QuestionnaireResponse.required == True,
            # QuestionnaireResponse.answer.isnot(None) <- Assuming 'answer' is a field.
        ).count()

        if total_required == 0:
            return 0

        completion_rate = answered_required / total_required
        completion_score = completion_rate * 12

        # Penalties
        inconsistent = 4
        vague = 3
        contradictory = 5

        penalties = 0
        # (Later you can detect inconsistencies here)
        consistency_score = max(0, 8 - penalties)

        return int(completion_score + consistency_score)

    # -----------------------------
    # 2. M2: AI Coach Interaction
    # -----------------------------
    def compute_coach_score(self, db: Session, user_id: int) -> int:
        messages = db.query(ChatHistory).filter(
            ChatHistory.user_id == user_id
        ).all()

        meaningful_turns = len([m for m in messages if m.role == "user" and len(m.message) > 20])
        detailed_answers = len([m for m in messages if m.role == "user" and len(m.message) > 80])

        base = 0
        if meaningful_turns >= 3:
            base += 12
        if detailed_answers >= 1:
            base += 8

        base += 5  # assume on-topic by default

        return max(0, min(base, 25))

    # -----------------------------
    # 3. M3: Recommendation Match
    # -----------------------------
    # def compute_recommendation_score(self, db: Session, user_id: int) -> int:
    #     recs = db.query(UserCareerRecommendation).filter(
    #         UserCareerRecommendation.user_id == user_id
    #     ).order_by(UserCareerRecommendation.rank.asc()).limit(3).all()

    #     if not recs:
    #         return 0

    #     # sims = [rec.similarity or 0 for rec in recs]
    #     sims = [rec.fit_score or 0 for rec in recs]
    #     avg_sim = sum(sims) / len(sims)
    #     return int(avg_sim * 25)

    def compute_recommendation_score(self, db: Session, user_id: int) -> int:
        recs = db.query(UserCareerRecommendation).filter(
            UserCareerRecommendation.user_id == user_id
        ).order_by(UserCareerRecommendation.rank.asc()).limit(3).all()

        if not recs:
            return 0

        sims = [rec.fit_score or 0 for rec in recs]
        avg = sum(sims) / len(sims)

        # --- NORMALIZATION LOGIC ---
        if avg <= 1:
            # case: model returned 0–1
            norm = avg * 25
        elif avg <= 25:
            # case: model returned 0–25
            norm = avg
        elif avg <= 100:
            # case: model returned 0–100
            norm = avg / 4
        else:
            # case: corrupted / old values
            norm = min(avg / 10, 25)

        return int(norm)


    # -----------------------------
    # 4. M4: Microsteps & Actions
    # -----------------------------
    def compute_action_score(self, db: Session, user_id: int) -> int:
        actions = db.query(UserRecommendationAction).filter(
            UserRecommendationAction.user_id == user_id
        ).all()

        score = 0
        if any(a.action == "action_taken" for a in actions):
            score += 10
        if any(a.action == "saved" for a in actions):
            score += 6

        dismiss_count = len([a for a in actions if a.action == "dismissed"])
        if dismiss_count < 3:
            score += 4

        return min(score, 20)

    # -----------------------------
    # 5. M5: Ready to Launch
    # -----------------------------
    def compute_ready_score(self, db: Session, user_id: int) -> int:
        # Stub logic, refine based on your pipeline
        microsteps_completed = 5      # placeholder
        microsteps_total = 6          # placeholder
        has_preferred_path = True     # placeholder
        coach_ready_flag = True       # placeholder

        score = 0
        if microsteps_total and microsteps_completed / microsteps_total >= 0.8:
            score += 5
        if has_preferred_path:
            score += 3
        if coach_ready_flag:
            score += 2

        return min(score, 10)

    # -----------------------------
    # 6. Final AI Confidence Calc
    # -----------------------------
    def compute_ai_confidence(self, db: Session, user_id: int) -> Dict[str, Any]:
        state = db.query(UserJourneyState).filter(
            UserJourneyState.user_id == user_id
        ).first()
        if state is None:
            return {
                "error": f"No UserJourneyState found for user_id={user_id}. Please ensure the user has started their journey."
            }
        # -----------------------------
        # Determine completed milestones
        # -----------------------------
        flags = {
            "questionnaire": bool(getattr(state, "questionnaire_completed", False)),
            "coach": bool(getattr(state, "coach_completed", False)),
            "recommendations": bool(getattr(state, "matches_completed", False)),
            "microsteps": bool(getattr(state, "action_completed", False)),
            "ready_to_launch": bool(getattr(state, "launch_completed", False)),
        }
        # -----------------------------
        # Compute scores
        # -----------------------------
        scores = {
            "questionnaire": self.compute_questionnaire_score(db, user_id) if flags["questionnaire"] else None,
            "coach": self.compute_coach_score(db, user_id) if flags["coach"] else None,
            "recommendations": self.compute_recommendation_score(db, user_id) if flags["recommendations"] else None,
            "microsteps": self.compute_action_score(db, user_id) if flags["microsteps"] else None,
            "ready_to_launch": self.compute_ready_score(db, user_id) if flags["ready_to_launch"] else None,
        }
        # Weights
        weights = {
            "questionnaire": 20,
            "coach": 25,
            "recommendations": 25,
            "microsteps": 20,
            "ready_to_launch": 10,
        }

        # -----------------------------
        # Actual & Possible Score
        # -----------------------------
        actual_score = sum(scores[m] for m in scores if scores[m] is not None)
        possible_score = sum(weights[m] for m in flags if flags[m])

        if possible_score == 0:
            final_score = 0
        else:
            final_score = floor((actual_score / possible_score) * 100)

        # -----------------------------
        # Save to DB
        # -----------------------------
        state.ai_confidence_score = final_score
        state.ai_confidence_breakdown = scores
        db.commit()

        # -----------------------------
        # Response
        # -----------------------------
        return {
            "user_id": user_id,
            "ai_confidence_score": final_score,
            "milestones_completed": [k for k, v in flags.items() if v],
            "breakdown": scores,
        }


ai_confidence_service = AIConfidenceService()
