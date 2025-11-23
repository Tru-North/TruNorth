"""
Admin AI Service
Handles AI-generated content for admin review functionality
"""

from typing import Optional
from sqlalchemy.orm import Session
from openai import AzureOpenAI

from app.core.config import settings
from app.models.user import User
from app.models.user_journey_state import UserJourneyState
from app.models.final_data import UserFinalData
from app.services.ai.chat_history_service import get_session_messages, get_user_sessions


class AdminAIService:
    def __init__(self):
        pass

    def _get_azure_client(self) -> AzureOpenAI:
        """Get Azure OpenAI client"""
        if not settings.AZURE_FOUNDRY_API_KEY or not settings.AZURE_FOUNDRY_ENDPOINT:
            raise RuntimeError("Azure Foundry credentials not configured. Please check AZURE_FOUNDRY_API_KEY and AZURE_FOUNDRY_ENDPOINT environment variables.")
        
        return AzureOpenAI(
            api_key=settings.AZURE_FOUNDRY_API_KEY,
            api_version="2024-12-01-preview",
            azure_endpoint=settings.AZURE_FOUNDRY_ENDPOINT,
        )

    async def generate_ai_intent_summary(self, user_id: int, db: Session) -> str:
        """
        Generate AI Intent Summary: What the AI is currently doing for the user
        """
        # Get user's journey state
        journey = db.query(UserJourneyState).filter(UserJourneyState.user_id == user_id).first()

        if not journey:
            return "AI is in the initial assessment phase, gathering user background and preferences."

        # Get recent chat history to understand current AI activities
        session_ids = get_user_sessions(db, user_id)
        current_activities = []
        for session_id in session_ids[-5:]:  # Last 5 sessions
            messages = get_session_messages(db, user_id, session_id)
            if messages:
                # Get last few assistant messages
                assistant_msgs = [m for m in messages[-10:] if m.role == 'assistant']
                if assistant_msgs:
                    current_activities.extend([msg.message[:200] for msg in assistant_msgs[-3:]])

        # Build milestones from journey state
        milestones = []
        if journey.chat_intro_done:
            milestones.append("chat_intro")
        if journey.questionnaire_completed:
            milestones.append("questionnaire")
        if journey.discovery_completed:
            milestones.append("discovery")
        if journey.coach_completed:
            milestones.append("coach")
        if journey.matches_completed:
            milestones.append("matches")
        if journey.action_completed:
            milestones.append("action")
        if journey.launch_completed:
            milestones.append("launch")

        # Build prompt for AI intent summary
        prompt = f"""
Based on the user's current journey state and recent AI interactions, summarize what the AI coach is currently doing for this user.

Journey Stage: {journey.current_stage}
Milestones Completed: {', '.join(milestones)}
Recent AI Activities: {' | '.join(current_activities[:5])}

Provide a concise summary (2-3 sentences) of the AI's current intent and activities for this user.
"""

        client = self._get_azure_client()
        try:
            response = client.chat.completions.create(
                model=settings.AZURE_CHAT_DEPLOYMENT,
                messages=[{"role": "user", "content": prompt}],
                max_tokens=200,
                temperature=0.3,
            )
            return response.choices[0].message.content.strip()
        except Exception as e:
            print(f"Error calling Azure OpenAI API: {e}")
            return f"Unable to generate AI intent summary at this time. Azure API error: {str(e)}"

    async def generate_profile_summary(self, user_id: int, db: Session) -> str:
        """
        Generate Profile Summary: AI summary of user's beginning state and current progress
        """
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            return "User profile not found."

        # Get initial/final data
        final_data = db.query(UserFinalData).filter(UserFinalData.user_id == user_id).first()

        # Get journey state
        journey = db.query(UserJourneyState).filter(UserJourneyState.user_id == user_id).first()

        initial_background = ""
        current_status = ""

        if final_data and final_data.final_json:
            final_json = final_data.final_json
            initial_background = final_json.get('background_summary', '')
            current_status = final_json.get('career_direction', '')

        # Build milestones from journey state
        milestones = []
        if journey:
            if journey.chat_intro_done:
                milestones.append("chat_intro")
            if journey.questionnaire_completed:
                milestones.append("questionnaire")
            if journey.discovery_completed:
                milestones.append("discovery")
            if journey.coach_completed:
                milestones.append("coach")
            if journey.matches_completed:
                milestones.append("matches")
            if journey.action_completed:
                milestones.append("action")
            if journey.launch_completed:
                milestones.append("launch")

        # Build prompt for profile summary
        prompt = f"""
Create a comprehensive profile summary for this user based on their journey data.

User Name: {user.firstname} {user.lastname}
Initial Background: {initial_background}
Current Career Direction: {current_status}
Journey Stage: {journey.current_stage if journey else 'Not started'}
Milestones Completed: {', '.join(milestones)}
Progress: {journey.progress_percent if journey else 0}%

Write a professional summary (3-4 sentences) describing:
1. What the user was like at the beginning of their journey
2. What they are currently working on/focused on
3. Their progress and current state

Make it suitable for an admin review context.
"""

        client = self._get_azure_client()
        try:
            response = client.chat.completions.create(
                model=settings.AZURE_CHAT_DEPLOYMENT,
                messages=[{"role": "user", "content": prompt}],
                max_tokens=300,
                temperature=0.3,
            )
            return response.choices[0].message.content.strip()
        except Exception as e:
            print(f"Error calling Azure OpenAI API for profile summary: {e}")
            return f"Unable to generate profile summary at this time. Azure API error: {str(e)}"


# Singleton instance
admin_ai_service = AdminAIService()