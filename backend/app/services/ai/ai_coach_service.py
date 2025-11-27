"""
AI Coach Service Layer
Business logic for AI career coach operations
"""

import uuid
import os
import json
import time
import re
import requests
from datetime import datetime, timezone

from typing import List, Optional, Tuple
from openai import AzureOpenAI
from pinecone import Pinecone, ServerlessSpec
from langchain_community.vectorstores import Pinecone as LangchainPinecone
from langchain.embeddings.base import Embeddings
from sqlalchemy.orm import Session
from fastapi import HTTPException
from typing import List, Optional, Tuple, TypedDict, Annotated, Sequence
from langgraph.graph import StateGraph, END
from app.core.config import settings
from app.models.user import User
from app.models.microstep import Microstep
from app.models.career_profile import CareerProfile
from app.services.ai.chat_history_service import delete_session
from app.services.ai.chat_history_service import get_recent_messages
from app.services.ai.chat_history_service import save_message
from app.services.ai.chat_history_service import get_session_messages
from app.services.ai.feedback_service import get_user_feedback_patterns
from app.services import recommendation_service
from app.services.user_service import get_unlock_status, set_unlock_status
from app.api.schemas.journey_schemas import JourneyStateUpdate
from app.services.journey_service import apply_journey_update
from app.models.user_recommendation import UserRecommendationAction
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage

class CoachState(TypedDict):
    """State for the career coach conversation - tracks conversation context"""
    messages: Annotated[Sequence[BaseMessage], "The conversation messages"]
    user_id: str
    session_id: str
    conversation_stage: str  # "discovery", "direction", "action"
    onboarding_completed: bool
    user_context: dict
    last_interaction: str
    pending_follow_up: bool
    question_count: int
    # NEW: field to store why the AI decided to change stages
    ai_reasoning: Optional[str] 

def evaluate_stage_autonomous(state: CoachState, llm_function) -> CoachState:
    """
    NEW: The Coach decides the stage autonomously based on conversation depth.
    Does not rely on fixed question counts.
    """
    messages = state.get("messages", [])
    current_stage = state.get("conversation_stage", "discovery")
    
    # Don't evaluate if too short
    if len(messages) < 4:
        return state

    history_sample = "\n".join([f"{type(m).__name__}: {m.content}" for m in messages[-6:]])

    prompt = f"""
    Act as a Supervisor for an AI Career Coach.
    Analyze the conversation history below.
    
    Current Stage: {current_stage}
    
    Definitions:
    - discovery: User is exploring, unsure, defining who they are.
    - direction: User has options and is choosing/filtering them.
    - action: User has a specific goal and is planning steps (resume, applying).

    Task: Should we stay in {current_stage} or move to the next one?
    
    Return ONLY a JSON string: {{"stage": "discovery|direction|action", "reason": "short reason"}}
    """
    
    try:
        # We pass the prompt to the LLM helper
        response = llm_function(prompt, history_sample)
        
        # clean json
        response = response.replace("```json", "").replace("```", "").strip()
        data = json.loads(response)
        
        new_stage = data.get("stage", current_stage)
        if new_stage != current_stage:
            state["ai_reasoning"] = f"Switched to {new_stage}: {data.get('reason')}"
        
        state["conversation_stage"] = new_stage
        
    except Exception as e:
        print(f"Stage eval failed: {e}")
        # Fallback: keep current stage
        
    return state

def save_langgraph_session(session_id: str, state: dict, session_log_path: str):
    sessions = {}
    if os.path.exists(session_log_path):
        with open(session_log_path, "r") as f:
            try:
                sessions = json.load(f)
            except:
                sessions = {}
    
    state_copy = state.copy()
    state_copy["messages"] = [
        {"type": type(m).__name__, "content": m.content}
        for m in state.get("messages", [])
    ]
    
    sessions[session_id] = state_copy
    with open(session_log_path, "w") as f:
        json.dump(sessions, f, indent=2)


def _save_langgraph_state(self, state: CoachState):
        try:
            save_langgraph_session(state["session_id"], state, self.langgraph_session_log)
        except Exception as e:
            print(f"Failed to save LangGraph state: {e}")

def initiate_conversation(state: CoachState) -> CoachState:
    """Coach initiates the conversation proactively."""
    opening = generate_first_message(state)
    
    state["messages"].append(AIMessage(content=opening))
    state["conversation_stage"] = "discovery"
    state["last_interaction"] = datetime.utcnow().isoformat()
    state["question_count"] = 1
    
    return state

def generate_first_message(state: CoachState) -> str:
    """
    Generate the first proactive message.
    """
    context = state.get("user_context", {})
    messages = state.get("messages", [])

    # If there are already messages, this is a "Welcome Back" scenario
    if len(messages) > 0:
        return "Welcome back! I've been thinking about our last conversation. Ready to pick up where we left off?"

    # Fresh Start Logic
    if context.get("completed_strengths") and context.get("completed_interests"):
        opening = (
            "Welcome back! You just completed your questionnaires, which gave me "
            "a good sense of your strengths and interests. To start, tell me—what "
            "are you hoping to get out of this journey: clarity, new direction, or something else?"
        )
    elif context.get("has_experience"):
        opening = (
            "Thanks for finishing the onboarding questions. I now have a clear picture "
            "of your background and goals. What feels most important to focus on first: "
            "exploring options, refining goals, or planning next steps?"
        )
    else:
        opening = (
            "You've completed your onboarding! Let's start by discussing what's been "
            "feeling unclear or stuck in your career right now."
        )
    
    return opening

def should_initiate(state: CoachState) -> str:
    """Decide if coach should initiate conversation."""
    messages = state.get("messages", [])
    
    # First interaction ever
    if len(messages) == 0:
        return "initiate"
    
    # Check if we should ask a follow-up (Proactive Loop)
    if state.get("pending_follow_up", False):
        return "follow_up"
    
    # User spoke first, respond normally
    return "respond"


class AzureFoundryEmbeddings:
    """Azure Foundry Embeddings Wrapper"""
    def __init__(self, api_key: str, endpoint: str, deployment_name: str):
        self.api_key = api_key
        self.endpoint = endpoint
        self.deployment_name = deployment_name
        self.headers = {
            "api-key": self.api_key,
            "Content-Type": "application/json"
        }
    
    def embed_texts(self, texts: List[str]):
        """Generate embeddings for multiple texts"""
        payload = {"input": texts}
        url = f"{self.endpoint}/openai/deployments/{self.deployment_name}/embeddings?api-version=2025-01-01-preview"
        response = requests.post(url, headers=self.headers, json=payload)
        response.raise_for_status()
        data = response.json()
        return [item["embedding"] for item in data["data"]]
    
    def embed_query(self, text: str):
        """Generate a single embedding"""
        return self.embed_texts([text])[0]


class LangChainAzureEmbeddings(Embeddings):
    """LangChain compatible embeddings wrapper"""
    def __init__(self, base_embedder):
        self.base = base_embedder
    
    def embed_documents(self, texts):
        return self.base.embed_texts(texts)
    
    def embed_query(self, text):
        return self.base.embed_query(text)


class AICoachService:
    """AI Career Coach Service - Singleton pattern"""
    
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(AICoachService, cls).__new__(cls)
            cls._instance._initialized = False
        return cls._instance
    
    def __init__(self):
        """Initialize AI Coach Service"""
        self._initialized = True
        self._azure_client = None
        self._embeddings = None  # ✅ ADD THIS LINE
        self._vector_store = None  # ✅ ADD THIS LINE
        # Initialize Pinecone
        try:
            self.pc = Pinecone(api_key=settings.PINECONE_API_KEY)
            
            # Check if index exists
            if settings.PINECONE_INDEX_NAME not in self.pc.list_indexes().names():
                print(f"Creating new Pinecone index: {settings.PINECONE_INDEX_NAME}")
                self.pc.create_index(
                    name=settings.PINECONE_INDEX_NAME,
                    dimension=settings.PINECONE_DIMENSION, 
                    metric="cosine",
                    spec=ServerlessSpec(
                        cloud=settings.PINECONE_CLOUD,
                        region=settings.PINECONE_REGION
                    )
                )
                time.sleep(1)
            print("🚀 AICoachService initialized")
            print(f"✅ Connected to Pinecone index: {settings.PINECONE_INDEX_NAME}")
        except Exception as e:
            print(f"⚠️  Pinecone initialization error: {e}")
            self.pc = None

    def _get_azure_client(self) -> AzureOpenAI:
        """Get or initialize Azure OpenAI client"""
        if self._azure_client is None:
            if not settings.AZURE_FOUNDRY_API_KEY or not settings.AZURE_FOUNDRY_ENDPOINT:
                raise RuntimeError("Azure credentials not configured. Check your .env file.")
            
            self._azure_client = AzureOpenAI(
                api_version="2024-12-01-preview",
                azure_endpoint=settings.AZURE_FOUNDRY_ENDPOINT,
                api_key=settings.AZURE_FOUNDRY_API_KEY,
            )
            print("✅ Azure OpenAI client connected")
        return self._azure_client
    
    def _get_embeddings(self):
        """Get or initialize embeddings"""
        if self._embeddings is None:
            base_embeddings = AzureFoundryEmbeddings(
                api_key=settings.AZURE_FOUNDRY_API_KEY,
                endpoint=settings.AZURE_FOUNDRY_ENDPOINT,
                deployment_name=settings.AZURE_EMBEDDINGS_DEPLOYMENT,
            )
            self._embeddings = LangChainAzureEmbeddings(base_embeddings)
            print("✅ Embeddings initialized")
        return self._embeddings
    
    def _get_vector_store(self):
        """Get or initialize vector store"""
        if self._vector_store is None:
            if not settings.PINECONE_API_KEY:
                print("⚠️  Warning: Pinecone not configured. Vector search disabled.")
                return None
            
            try:
                embeddings = self._get_embeddings()
                
                # Initialize Pinecone
                pc = Pinecone(api_key=settings.PINECONE_API_KEY)
                existing_indexes = [i["name"] for i in pc.list_indexes()]
                
                if settings.INDEX_NAME not in existing_indexes:
                    # Create index if doesn't exist
                    print(f"📊 Creating Pinecone index: {settings.INDEX_NAME}")
                    sample_vec = embeddings.embed_query("hello world")
                    dimension = len(sample_vec)
                    pc.create_index(
                        name=settings.INDEX_NAME,
                        dimension=dimension,
                        metric="cosine",
                        spec=ServerlessSpec(cloud="aws", region="us-east-1")
                    )
                    time.sleep(8)
                
                self._vector_store = LangchainPinecone.from_existing_index(
                    index_name=settings.INDEX_NAME,
                    embedding=embeddings
                )
                print(f"✅ Vector store connected to index: {settings.INDEX_NAME}")
            except Exception as e:
                print(f"⚠️  Vector store initialization failed: {e}")
                self._vector_store = None
        
        return self._vector_store

    # -------------------------------------------------
    # UNLOCK INTENT DETECTION (PHASE C)
    # -------------------------------------------------
    def _detect_unlock_intent(self, text: str) -> str:
        """
        Detect user intent around career-match readiness.
        Returns: "yes", "no", "unclear" or "none"
        """
        if not text:
            return "none"

        t = text.strip().lower()

        # Single-word/short affirmations
        yes_keywords = {
            "yes", "yeah", "yep", "yup", "sure", "ok", "okay",
            "definitely", "absolutely", "of course", "let's do it",
            "lets do it", "let's go", "lets go", "i'm ready", "im ready",
            "ready", "sounds good", "let's start", "lets start"
        }

        no_keywords = {
            "no", "nope", "nah", "not yet", "not right now",
            "later", "maybe later", "i'm not ready", "im not ready",
            "dont want to", "don't want to", "not now"
        }

        unclear_keywords = {
            "maybe", "not sure", "i don't know", "idk", "i d k",
            "confused", "on the fence", "thinking", "let me think"
        }

        # Direct exact matches
        if t in yes_keywords:
            return "yes"
        if t in no_keywords:
            return "no"
        if t in unclear_keywords:
            return "unclear"

        # Regex patterns for more natural phrases
        if re.search(r"\bi('?m| am)\s+ready\b", t):
            return "yes"
        if re.search(r"\bready\s+to\s+(start|explore|go|move ahead|begin)\b", t):
            return "yes"
        if re.search(r"\b(show|see|explore|look at)\s+(my\s+)?(career|role|job)\s+(options|paths|matches)\b", t):
            return "yes"
        if re.search(r"\b(check|see|explore)\s+(possible\s+)?career\s+paths\b", t):
            return "yes"

        if re.search(r"\bnot\s+ready\b", t) or "i'm not sure" in t or "im not sure" in t:
            return "unclear"
        if "don't think so" in t or "dont think so" in t:
            return "no"

        return "none"
    
    def _build_chat_messages(
        self,
        user: Optional[User],
        db: Session,
        session_id: str,
        question: str,
        context: str = ""
    ) -> List[dict]:
        """
        Build messages with user profile, feedback patterns, history, and context
        """
        
        SYSTEM_PROMPT = """
        1. Identity
        You are an AI career coach named Ruby. 
        You are proactive, emotionally intelligent, guiding rather than reacting. 
        You take initiative, maintain momentum, and adjust depth and tone based on user context.

        2. Purpose
        Your core purpose:
        - Help users gain clarity about their career direction.
        - Help them choose meaningful paths aligned with their goals.
        - Help them take consistent action toward meaningful work.

        3. Role Hierarchy
        You operate in three roles and shift naturally based on context:

        3.1 Clarity Coach (Default)
        - Help users understand where they are and where they want to go.
        - Identify patterns and reframe uncertainty.
        - Build insight and self-awareness.

        3.2 Strategic Companion
        - Help users compare options and weigh trade-offs.
        - Align career paths with goals, strengths, and constraints.

        3.3 Motivational Navigator
        - Help users take small, achievable steps.
        - Support habit building and maintain accountability.

        You begin each relationship in Clarity Coach mode and transition roles as user readiness evolves.

        4. Tone
        Warm, curious, pragmatic, empowering, conversational, and concise.
        No fluff, filler, clichés, generic inspiration, or motivational platitudes.

        5. Style Guidelines
        - Clear, specific, plain language.
        - Short paragraphs.
        - Use numbered or bulleted lists where helpful.
        - Mirror the user's tone and emotional state.
        - Avoid jargon and slang.
        - Do not use emojis unless the user uses them first.

        6. Conversational Behavior
        - You lead the conversation, do not wait passively.
        - You start with orientation prompts: e.g.,
        “Let’s check in on where you are today.”
        “Would clarity, exploration, or action planning help most right now?”
        “Last time you were exploring X — should we continue or pivot?”
        - Ask one clear, emotionally intelligent question at a time.
        - Always advance clarity, insight, or action.

        7. Session Structure
        Each conversation follows:
        Clarify → Reflect → Recommend → Plan (or Close)

        At session end, provide:
        - A short summary of key points.
        - Up to three concrete next steps.
        - Optional follow-up or accountability check.

        8. Inquiry Depth Adaptation
        When information is limited, ask broad questions about experiences, values, and goals.
        As context increases, narrow into focus, options, and planning.
        Reference earlier details to demonstrate continuity (“You mentioned wanting more creativity…”).

        9. Journey Tracking
        You track the user’s current stage:
        - Discovery (learning about them)
        - Direction (shaping decisions)
        - Action (planning and accountability)

        You transition smoothly:
        “You’ve gathered insight — want to explore possible directions?”
        “You’ve chosen a direction — should we plan first next steps?”

        10. Coaching Behaviors
        - Ask open-ended questions.
        - Reflect insights in concise summaries.
        - Offer up to three options or decisions with clear trade-offs.
        - Recommend actions with rationale.
        - Follow up on progress and obstacles.
        - Notice emotional signals and adjust pace.
        - Provide resources when helpful.
        - Reinforce that the user holds agency over choices.

        11. Boundaries
        You do not provide legal, medical, or financial advice.
        Encourage consulting professionals when necessary.
        If user shows distress or risk, respond with empathy and refer to appropriate support.

        12. Data Use
        Use all known user information to personalize responses.
        If key information is missing, ask one clarifying question before proceeding.
        Repeat known information only for summarizing progress.

        13. Output Pattern by Intent
        Clarify: Ask one or two focused questions.
        Reflect: Summarize user input in 2–3 sentences.
        Recommend: Provide up to three options with brief explanation.
        Plan: Give a small action-step checklist with timeframes.
        Nudge: Offer concise progress check-ins based on past goals.

        14. Example Voice
        Warm validation:
        “It makes sense that this feels uncertain after such a shift.”
        Curiosity:
        “What parts of your past work felt energizing?”
        Pragmatic support:
        “Let’s identify one or two steps that move this forward.”
        Empowerment:
        “You decide your direction. I help turn it into a workable plan.”

        15. Role Switching Rules
        Return to Clarity Coach when confusion or emotional uncertainty is present.
        Switch to Strategic Companion for choosing or comparing options.
        Switch to Motivational Navigator when user is ready to act.

        16. Things That should be Done : 
        You must always lead the conversation 
        Always ask follow-up questions after your answer that relates to the mood,pattern,information and the state of the conversation in and coach style  . Do not skip it
        
        17. First Interaction / Post-Onboarding Behavior
        - When the user first starts a session after onboarding (or first-ever chat), lead the conversation without waiting for input.
        - Acknowledge what they have done:
        * Comment on completed questionnaires or steps taken.
        * Highlight what the AI knows so far about their strengths, interests, and work values.
        - Ask ONE clear, emotionally intelligent question to start the session:
        Example openings:
            - "Welcome back! You just completed your questionnaires, which gave me a good sense of your strengths and interests. To start, tell me—what are you hoping to get out of this journey: clarity, new direction, or something else?"
            - "Thanks for finishing the onboarding questions. I now have a clear picture of your background and goals. What feels most important to focus on first: exploring options, refining goals, or planning next steps?"
            - "You’ve completed your onboarding! Let’s start by discussing what’s been feeling unclear or stuck in your career right now."
        - Maintain coach style: warm, curious, pragmatic.
        - Continue normal session behavior after this opening (Clarify → Reflect → Recommend → Plan). 

        18. Conversational Style / User-Friendliness
        - Keep responses short and digestible; avoid long blocks of text.
        - Present one idea at a time to avoid overwhelming the user.
        - Use a warm, friendly, and encouraging tone, like a supportive coach.
        - Chunk advice into small, actionable points :
            * Give a quick insight or suggestion.
            * Follow with one clear follow-up question.
            * Only provide additional context if asked or needed.
        - Mirror the user’s tone and energy.
        - Avoid unnecessary repetition, jargon, or filler.
        - Example:
            User: "I feel lost about which career path to choose."
            Coach: 
                Answer: It’s normal to feel uncertain at this stage. Let’s focus on one step: identifying your strengths.
                Question: What activities or tasks make you feel energized and confident?

        19. Answer (Output) Style :
            - It must be short within 2-3 sentences
        """
        
        messages = [{"role": "system", "content": SYSTEM_PROMPT}]
        
        # ✅ INJECT USER FEEDBACK PREFERENCES
        if user:
            try:                
                feedback_patterns = get_user_feedback_patterns(db, user.id, limit=20)
                
                print(f"🧠 Feedback patterns for user {user.id}: {feedback_patterns}")
                
                if feedback_patterns["has_feedback"] and (feedback_patterns["like_count"] > 0 or feedback_patterns["dislike_count"] > 0):
                    feedback_context = f"""
        USER FEEDBACK HISTORY:focus 
        This user has provided feedback on your previous responses:
        - Likes: {feedback_patterns['like_count']}
        - Dislikes: {feedback_patterns['dislike_count']}
        - Preference: {feedback_patterns['preference_summary']}
        """
                    
                    if feedback_patterns['liked_examples']:
                        feedback_context += "\nResponses they LIKED:\n"
                        for example in feedback_patterns['liked_examples']:
                            if example['response'] != 'N/A':
                                feedback_context += f"- {example['response'][:150]}...\n"
                    
                    if feedback_patterns['disliked_examples']:
                        feedback_context += "\nResponses they DISLIKED:\n"
                        for example in feedback_patterns['disliked_examples']:
                            if example['response'] != 'N/A':
                                feedback_context += f"- {example['response'][:150]}...\n"
                    
                    feedback_context += "\n⚠️ USE THIS FEEDBACK TO PERSONALIZE YOUR RESPONSES FOR THIS USER."
                    
                    messages.append({
                        "role": "system",
                        "content": feedback_context
                    })
                    print(f"✅ Injected feedback context for user {user.id}")
                else:
                    print(f"ℹ️  No feedback data to inject for user {user.id}")
            
            except Exception as e:
                print(f"⚠️  Could not load feedback patterns: {e}")
                import traceback
                traceback.print_exc()
        
        # Load profile
        if user:
            try:
                from app.models.final_data import UserFinalData
                import json
                
                final_data = db.query(UserFinalData).filter(
                    UserFinalData.user_id == user.id
                ).first()
                
                if final_data and final_data.final_json:
                    profile_json = json.dumps(final_data.final_json, indent=2)
                    messages.append({
                        "role": "system",
                        "content": f"""USER PROFILE DATA:\n{profile_json}"""
                    })
            except Exception as e:
                print(f"⚠️  Could not load profile: {e}")

            try:
                favorite_cards = recommendation_service.get_favorite_recommendations(db, user.id, limit=3)
                latest_cards = recommendation_service.get_latest_recommendations(db, user.id, limit=3)

                favorite_ids = {card.get("id") for card in favorite_cards if card.get("id")}
                filtered_latest = [card for card in latest_cards if card.get("id") not in favorite_ids]

                rec_context_parts = []
                if favorite_cards:
                    fav_lines = []
                    for card in favorite_cards:
                        summary = card.get("why_this_fits") or ""
                        summary = summary[:180] + ("..." if len(summary) > 180 else "")
                        fit = card.get("fit_score")
                        fit_text = f"{fit:.1f}%" if isinstance(fit, (int, float)) else "--"
                        fav_lines.append(f"- {card.get('title')} (fit {fit_text}) :: {summary}")
                    rec_context_parts.append("USER FAVORITE ROLES:\n" + "\n".join(fav_lines))

                if filtered_latest:
                    latest_lines = []
                    for card in filtered_latest:
                        fit = card.get("fit_score")
                        fit_text = f"{fit:.1f}%" if isinstance(fit, (int, float)) else "--"
                        skills = card.get("top_skills") or []
                        skill_text = ", ".join(skills[:3]) if skills else "key strengths"
                        latest_lines.append(f"- {card.get('title')} (fit {fit_text}) :: key skills {skill_text}")
                    rec_context_parts.append("LATEST RECOMMENDATIONS SHOWN TO USER:\n" + "\n".join(latest_lines))

                if rec_context_parts:
                    messages.append({
                        "role": "system",
                        "content": "\n\n".join(rec_context_parts)
                    })
            except Exception as exc:
                print(f"⚠️  Could not load recommendation context: {exc}")
        
        # Add conversation history
        if user:
            try:
                recent = get_recent_messages(db, user.id, session_id, limit=8)
                for msg in recent:
                    messages.append({"role": msg.role, "content": msg.message})
            except ImportError:
                pass
        
        # Add vector store context
        if context:
            messages.append({
                "role": "system",
                "content": f"Context from knowledge base:\n{context}"
            })
        
        # Add current question
        messages.append({"role": "user", "content": question})
        
        return messages

    
    def _log_event(self, event: dict):
        """Log events to JSONL file"""
        try:
            event["timestamp"] = time.time()
            with open(self.log_file, "a", encoding="utf-8") as f:
                f.write(json.dumps(event, ensure_ascii=False) + "\n")
        except Exception as e:
            print(f"Warning: Failed to log event: {e}")
    
    async def ask(
        self,
        question: str,
        user: Optional[User],
        session_id: str,
        db: Session
    ) -> dict:
        """Process a question and return answer + unlock trigger flag"""
        
        # Save user message first (always in history)
        if user:
            try:
                save_message(db, user.id, session_id, "user", question)
            except ImportError:
                pass

        trigger_explore_unlock = False

        # ---------- Unlock intent handling before calling GPT ----------
        if user:
            try:
                is_unlocked = get_unlock_status(db, user.id)
            except Exception as e:
                print(f"⚠️ Could not read unlock status for user {user.id}: {e}")
                is_unlocked = False

            if not is_unlocked:
                intent = self._detect_unlock_intent(question)
                if intent in {"yes", "no", "unclear"}:
                    # User is responding with explicit readiness / non-readiness
                    if intent == "yes":
                        # Flip flag in DB
                        try:
                            set_unlock_status(db, user.id, True)
                            apply_journey_update(
                                db=db,
                                payload=JourneyStateUpdate(
                                    user_id=user.id,
                                    is_career_unlock_confirmed=True
                                )
                            )
                        except Exception as e:
                            print(f"⚠️ Could not set unlock status for user {user.id}: {e}")

                        trigger_explore_unlock = True
                        answer = (
                            "Love that. You've built a strong foundation with your insights so far. "
                            "Based on your skills and values, there are a few roles that could fit well for you. "
                            "I'll unlock your career matches so you can start exploring them now."
                        )
                        event_type = "unlock_yes"
                    elif intent == "no":
                        answer = (
                            "That's completely okay — we don't have to jump into career matches yet. "
                            "Tell me what still feels unclear or not ready, and we can explore that together at your pace."
                        )
                        event_type = "unlock_no"
                    else:  # unclear
                        answer = (
                            "It sounds like you're not fully sure yet, which is totally normal. "
                            "We can talk through what's making you hesitant about exploring your career matches. "
                            "What feels confusing or risky about taking that next step right now?"
                        )
                        event_type = "unlock_unclear"

                    # Save assistant message to history
                    try:
                        save_message(db, user.id, session_id, "assistant", answer)
                    except ImportError:
                        pass

                    self._log_event({
                        "type": event_type,
                        "question": question,
                        "answer": answer,
                        "session_id": session_id,
                        "user_id": user.id
                    })

                    return {
                        "answer": answer,
                        "session_id": session_id,
                        "trigger_explore_unlock": trigger_explore_unlock,
                    }
        
        # ---------- Normal GPT flow ----------
        # Retrieve context from vector store
        context = ""
        vector_store = self._get_vector_store()
        if vector_store:
            try:
                docs = vector_store.similarity_search(question, k=3)
                context = "\n\n".join([d.page_content for d in docs])
            except Exception as e:
                print(f"Vector search error: {e}")
        
        # Build messages with history
        messages = self._build_chat_messages(user, db, session_id, question, context)
        
        # Get response from Azure
        client = self._get_azure_client()
        response = client.chat.completions.create(
            model=settings.AZURE_CHAT_DEPLOYMENT,
            messages=messages,
            max_tokens=settings.MAX_TOKENS,
            temperature=settings.TEMPERATURE,
        )
        
        answer = response.choices[0].message.content.strip()
        
        # Save assistant message
        if user:
            try:
                save_message(db, user.id, session_id, "assistant", answer)
            except ImportError:
                pass
        
        self._log_event({
            "type": "ask",
            "question": question,
            "answer": answer,
            "session_id": session_id,
            "user_id": user.id if user else None
        })
        
        return {
            "answer": answer,
            "session_id": session_id,
            "trigger_explore_unlock": False
        }
    
    async def text_to_speech(self, text: str, voice: Optional[str] = None) -> bytes:
        """Convert text to speech"""
        client = self._get_azure_client()
        chosen_voice = voice or settings.AZURE_TTS_VOICE
        
        with client.audio.speech.with_streaming_response.create(
            model=settings.AZURE_TTS_DEPLOYMENT,
            voice=chosen_voice,
            input=text,
            response_format="wav",
        ) as resp:
            if resp.status_code != 200:
                raise RuntimeError(f"TTS failed with status {resp.status_code}")
            audio_bytes = resp.read()
            if not audio_bytes or len(audio_bytes) < 44:
                raise RuntimeError(f"Invalid audio: {len(audio_bytes)} bytes")
        
        return audio_bytes
    
    async def speech_to_text(self, audio_bytes: bytes, content_type: str) -> str:
        """Convert speech to text"""
        client = self._get_azure_client()
        
        transcript = client.audio.transcriptions.create(
            model="whisper",
            file=("audio.wav", audio_bytes, content_type or "audio/wav"),
            response_format="verbose_json"
        )
        
        text = transcript.get("text") if isinstance(transcript, dict) else getattr(transcript, "text", "")
        if not text:
            raise RuntimeError("No transcript returned from Whisper")
        
        return text
    
    async def ask_voice(
        self,
        question: str,
        user: Optional[User],
        session_id: str,
        db: Session,
        voice: Optional[str] = None
    ) -> Tuple[bytes, str]:
        """Ask question and return audio response"""
        
        # Get text answer (includes unlock logic)
        result = await self.ask(question, user, session_id, db)
        answer_text = result["answer"]
        
        # Convert to speech
        audio_bytes = await self.text_to_speech(answer_text, voice)
        
        self._log_event({
            "type": "ask_voice",
            "question": question,
            "answer": answer_text,
            "session_id": session_id,
            "voice": voice or settings.AZURE_TTS_VOICE,
            "audio_size": len(audio_bytes)
        })
        
        return audio_bytes, answer_text
    
    async def voice_to_voice(
        self,
        audio_bytes: bytes,
        audio_content_type: str,
        user: Optional[User],
        session_id: str,
        db: Session,
        voice: Optional[str] = None
    ) -> Tuple[bytes, str, str]:
        """Complete voice-to-voice pipeline"""
        
        # 1. Transcribe audio
        user_text = await self.speech_to_text(audio_bytes, audio_content_type)
        
        # 2. Get answer (includes unlock logic)
        result = await self.ask(user_text, user, session_id, db)
        answer_text = result["answer"]
        
        # 3. Convert to speech
        response_audio = await self.text_to_speech(answer_text, voice)
        
        self._log_event({
            "type": "voice_to_voice",
            "user_text": user_text,
            "answer_text": answer_text,
            "session_id": session_id,
            "voice": voice or settings.AZURE_TTS_VOICE
        })
        
        return response_audio, user_text, answer_text
    
    async def test_voices(self, sample_text: str) -> dict:
        """Test available TTS voices"""
        known_voices = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer', 
                       'coral', 'verse', 'ballad', 'ash', 'sage']
        working, failing = [], []
        
        client = self._get_azure_client()
        
        for voice_name in known_voices:
            try:
                with client.audio.speech.with_streaming_response.create(
                    model=settings.AZURE_TTS_DEPLOYMENT,
                    voice=voice_name,
                    input=sample_text,
                ) as resp:
                    if resp.status_code == 200:
                        data = resp.read()
                        if data and len(data) > 44:
                            working.append(voice_name)
                        else:
                            failing.append({"voice": voice_name, "reason": "empty audio"})
                    else:
                        failing.append({"voice": voice_name, "reason": f"HTTP {resp.status_code}"})
            except Exception as e:
                failing.append({"voice": voice_name, "reason": str(e)[:100]})
        
        return {
            "deployment": settings.AZURE_TTS_DEPLOYMENT,
            "working_voices": working,
            "failing_voices": failing
        }
    
    async def get_session_history(self, user_id: int, session_id: str, db: Session) -> List[dict]:
        """Get all messages for a session"""
        try:
            messages = get_session_messages(db, user_id, session_id)
            return [
                {
                    "role": msg.role,
                    "message": msg.message,
                    "timestamp": msg.timestamp.isoformat()
                }
                for msg in messages
            ]
        except ImportError:
            return []
    
    async def delete_session_history(self, user_id: int, session_id: str, db: Session):
        """Delete all messages for a session"""
        try:
            delete_session(db, user_id, session_id)
        except ImportError:
            pass

    async def _call_llm(self, messages: list) -> str:
        """Call Azure OpenAI LLM and return response text"""
        client = self._get_azure_client()
        try:
            response = client.chat.completions.create(
                model=settings.AZURE_CHAT_DEPLOYMENT,
                messages=messages,
                temperature=0.7,
                max_tokens=2000
            )
            content = response.choices[0].message.content
            if not content:
                raise ValueError("LLM returned empty response")
            return content.strip()
        except Exception as e:
            print(f"❌ LLM API error: {e}")
            raise

        

    async def ask_microsteps_and_save(
        self,
        user: User,
        db: Session,
        career_id: int,
        job_profile: str,
    ) -> dict:
        SYSTEM_PROMPT = f"""
        You are an expert career transition coach specializing in skill development and strategic learning pathways. Generate a personalized microsteps plan to help someone transition into: {job_profile}.

        **Context:** This is for a career change application. Users need actionable steps focused on building competencies, not on resume writing or job applications.

        **Requirements:**

        For each step:
        - "title": Short, action-oriented skill or knowledge goal (e.g., "Master Core Python Concepts").
        - "mini_description": One concise sentence explaining the skill or knowledge area.
        - "detailed_description": 2–3 sentences explaining WHY this step matters for the career transition, what competencies it builds, and how it connects to real-world job requirements.
        - "ministeps": (2–4 per step) Practical sub-actions with:
        - "title": Specific learning action (e.g., "Complete Python crash course").
        - "description": Clear guidance on how to accomplish it (resources, time commitment, or approach).

        **Focus Areas (prioritize these):**
        1. **Foundational Skills**: Core technical or domain-specific knowledge required for the role.
        2. **Hands-On Practice**: Real projects, exercises, or simulations to build practical experience.
        3. **Industry Knowledge**: Understanding workflows, tools, standards, and best practices in the field.
        4. **Community & Learning**: Joining communities, forums, or mentorship programs for ongoing growth.
        5. **Certification & Credibility**: Optional credentials or portfolios that demonstrate competence.

        **Avoid:**
        - Resume writing, job search strategies, interview prep, or networking for job opportunities.
        - Generic advice like "research the role" or "update LinkedIn profile."

        **CRITICAL OUTPUT RULES:**
        - Return ONLY valid JSON - NO markdown code blocks, NO explanatory text, NO ```
        - Start your response with [ and end with ]
        - Return exactly 8–10 microsteps
        - Each step should be completable within 1–7 days of focused effort
        - DO NOT include "step_index", "completed", or "ministep_index" in your output - these will be added automatically
        - Every ministep MUST have both "title" and "description" fields
        - Strictly generate excatly 2 ministeps for each microstep
        - Add difficulty level and time estimate for each microstep compulsory

        EXAMPLE OUTPUT (copy this exact structure):
        [
        {{
            "title": "Master Fundamental Concepts",
            "mini_description": "Build core knowledge in [specific skill/domain].",
            "detailed_description": "Understanding [concept] is essential because it forms the foundation of [job role]. This knowledge enables you to [specific benefit] and prepares you for more advanced topics.",
            "ministeps": [
            {{"title": "Complete introductory course", "description": "Take [specific course name] on Coursera or Udemy (approx. 10 hours)."}},
            {{"title": "Practice with guided exercises", "description": "Work through 5–10 beginner exercises on [platform/resource]."}}
            ]
        }}
        ]
        """
        messages = [{"role": "system", "content": SYSTEM_PROMPT}]
        
        try:
            json_out = await self._call_llm(messages)
            print(f"🔍 Raw LLM response (first 200 chars): {json_out[:200]}...")
            
        
            microsteps = json.loads(json_out)
            
            # Add progress tracking CONSISTENTLY to ALL steps and ministeps
            for i, step in enumerate(microsteps):
                step["step_index"] = i
                step["status"] = "incomplete"  
                
                if "ministeps" in step and isinstance(step["ministeps"], list):
                    for j, ministep in enumerate(step["ministeps"]):
                        ministep["ministep_index"] = j
                        ministep["status"] = "incomplete"                  
                        if "title" not in ministep or "description" not in ministep:
                            print(f"⚠️ Warning: Ministep missing title or description at step {i}, ministep {j}")
                else:                    
                    step["ministeps"] = []

            print(f"✅ Generated {len(microsteps)} microsteps with progress tracking")

            
        except json.JSONDecodeError as e:
            print(f"❌ JSON parsing error: {e}")
            print(f"❌ Raw response: {json_out}")
            raise HTTPException(status_code=500, detail=f"Failed to parse LLM response: {str(e)}")
        except Exception as e:
            print(f"❌ LLM call error: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to generate microsteps: {str(e)}")

        existing_microstep = db.query(Microstep).filter_by(
            user_id=user.id,
            career_id=career_id
        ).first()
        
        if existing_microstep:
                # Update existing microstep
                existing_microstep.data = {"steps": microsteps}
                existing_microstep.updated_at = datetime.now(timezone.utc)
                db.commit()
                db.refresh(existing_microstep)
                print(f"🔄 Updated existing microstep (ID: {existing_microstep.id}) for career_id={career_id}")
                
                microstep_response = {
                    "microstep_id": existing_microstep.id,
                    "career_id": career_id,
                    "career_title": job_profile,
                    "data": existing_microstep.data,
                    "created_at": existing_microstep.created_at,
                    "updated_at": existing_microstep.updated_at,
                    "is_new": False
                }
        else:
            # Create new microstep
            new_microstep = Microstep(
                user_id=user.id,
                firebase_uid=user.firebase_uid,
                career_id=career_id,
                career_title=job_profile,
                data={"steps": microsteps}
            )
            db.add(new_microstep)
            db.commit()
            db.refresh(new_microstep)
            print(f"✅ Created new microstep (ID: {new_microstep.id}) for career_id={career_id}")
            
            microstep_response = {
                "microstep_id": new_microstep.id,
                "career_id": career_id,
                "career_title": job_profile,
                "data": new_microstep.data,
                "created_at": new_microstep.created_at,
                "updated_at": new_microstep.updated_at,
                "is_new": True
            }
        

        
        try:
            # Check if action record exists
            action_record = db.query(UserRecommendationAction).filter_by(
                user_id=user.id,
                career_profile_id=career_id
            ).first()
            
            if action_record:
                # Update existing action
                if action_record.action != 'action_taken':
                    action_record.action = 'action_taken'
                    action_record.updated_at = datetime.now(timezone.utc)
                    db.commit()
                    print(f"✅ Updated action to 'action_taken' for career_id={career_id} (was: {action_record.action})")
                else:
                    print(f"ℹ️  Action already set to 'action_taken' for career_id={career_id}")
            else:
                # Create new action record
                new_action = UserRecommendationAction(
                    user_id=user.id,
                    career_profile_id=career_id,
                    action='action_taken',
                    created_at=datetime.now(timezone.utc),
                    updated_at=datetime.now(timezone.utc)
                )
                db.add(new_action)
                db.commit()
                print(f"✅ Created new action record with 'action_taken' for career_id={career_id}")

                # -------------------------------------------------------------
                # Journey Map Update → First “action_taken” triggers stage 4
                # -------------------------------------------------------------
                from app.services.journey_service import apply_journey_update
                from app.api.schemas.journey_schemas import JourneyStateUpdate

                apply_journey_update(
                    db,
                    JourneyStateUpdate(
                        user_id=user.id,
                        matches_completed=True
                    )
                )

                print(f"🎯 Journey state updated: matches_completed=True for user {user.id}")

        
        except Exception as e:
            print(f"⚠️ Warning: Could not update action for career_id={career_id}: {e}")
            db.rollback()
        
        return microstep_response

    async def generate_microstep_summary(
        self,
        step: dict,
        reflection: Optional[str],
        career_title: str
    ) -> str:
        """
        Generate a concise personalized summary for a completed microstep.
        """
        
        # Build context about the step
        step_title = step.get("title", "Unknown Step")
        step_desc = step.get("detailed_description", "")
        ministeps = step.get("ministeps", [])
        status = step.get("status", "incomplete")
        
        # Count completed ministeps
        completed_ministeps = [m for m in ministeps if m.get("status") == "completed"]
        total_ministeps = len(ministeps)
        completion_rate = len(completed_ministeps) / total_ministeps if total_ministeps > 0 else 0
        
        # Build prompt
        SUMMARY_PROMPT = f"""
    You are a supportive career transition coach. Generate a brief progress summary for a user working toward a career in {career_title}.

    **Step Details:**
    - Title: {step_title}
    - Description: {step_desc}
    - Status: {status}
    - Progress: {len(completed_ministeps)}/{total_ministeps} tasks completed

    **User's Reflection:**
    {reflection if reflection else "No reflection provided."}

    **Instructions:**
    Write a SHORT summary (3-4 sentences max) that:
    1. Acknowledges their specific progress
    2. Highlights one key takeaway or achievement
    3. Gives ONE actionable next step

    Be warm, specific, and encouraging. Keep it concise and scannable.

    Output plain text only (no markdown, no bullets).
    """
        
        messages = [{"role": "system", "content": SUMMARY_PROMPT}]
        
        try:
            summary = await self._call_llm(messages)
            return summary.strip()
        except Exception as e:
            print(f"❌ Failed to generate summary: {e}")
            return "Great progress on this step! Keep building your skills toward your career goal."


    async def generate_reflection_response(
        self,
        step: dict,
        user_message: str,
        career_title: str,
        chat_history: list
    ) -> str:
        """
        Generate AI coach response for reflection chat.
        Context-aware responses based on step details and progress.
        """
        
        # Extract step context
        step_title = step.get("title", "Unknown Step")
        step_description = step.get("detailed_description", "")
        difficulty = step.get("difficulty_level", "Intermediate")
        estimated_time = step.get("estimated_time", "N/A")
        status = step.get("status", "incomplete")
        ministeps = step.get("ministeps", [])
        
        # Count progress
        completed_ministeps = len([m for m in ministeps if m.get("status") == "completed"])
        total_ministeps = len(ministeps)
        
        # Build system prompt with context
        SYSTEM_PROMPT = f"""You are a supportive career transition coach helping someone learn {career_title}.

    **Current Step Context:**
    - Step: {step_title}
    - Description: {step_description}
    - Difficulty: {difficulty}
    - Estimated Time: {estimated_time}
    - Status: {status}
    - Progress: {completed_ministeps}/{total_ministeps} sub-tasks completed

    **Your Role:**
    - Provide personalized, actionable guidance specific to this learning step
    - Address specific questions about {step_title}
    - Offer encouragement and motivation
    - Suggest practical next steps or resources related to this topic
    - Help troubleshoot challenges they're facing
    - Keep responses concise (2-3 paragraphs max)
    - Be warm, empathetic, and specific to their situation

    **Guidelines:**
    - Reference the specific step "{step_title}" they're working on
    - Acknowledge their progress when applicable
    - Provide concrete, actionable advice
    - If they're stuck, break down the problem into smaller parts
    - Suggest specific resources, tutorials, or exercises
    - Stay focused on {career_title} career goals
    - Connect this step to their broader career journey

    Remember: This is a focused conversation about "{step_title}" - keep your advice relevant to this specific learning step. And keep the answers Strictly only within 250-400 characters.
    """
        
        # Build conversation history
        messages = [{"role": "system", "content": SYSTEM_PROMPT}]
        
        # Add last 10 messages from chat history (context window)
        recent_history = chat_history[-10:] if len(chat_history) > 10 else chat_history
        for msg in recent_history:
            if msg["role"] in ["user", "assistant"]:
                messages.append({
                    "role": msg["role"],
                    "content": msg["message"]
                })
        
        # Call LLM
        try:
            response = self._get_azure_client().chat.completions.create(
                model=settings.AZURE_CHAT_DEPLOYMENT,
                messages=messages,
                temperature=0.7,
                max_tokens=500
            )
            
            ai_response = response.choices[0].message.content.strip()
            print(f"✅ Generated reflection response ({len(ai_response)} chars)")
            return ai_response
            
        except Exception as e:
            print(f"❌ Error generating reflection response: {e}")
            return "I'm having trouble responding right now. Could you try asking your question again?"


    def load_langgraph_session(session_id: str, session_log_path: str) -> Optional[dict]:
        if not os.path.exists(session_log_path):
            return None
        
        with open(session_log_path, "r") as f:
            try:
                sessions = json.load(f)
            except:
                return None
        
        if session_id not in sessions:
            return None
        
        state = sessions[session_id]
        
        messages = []
        for msg in state.get("messages", []):
            if msg["type"] == "HumanMessage":
                messages.append(HumanMessage(content=msg["content"]))
            elif msg["type"] == "AIMessage":
                messages.append(AIMessage(content=msg["content"]))
        
        state["messages"] = messages
        return state



    def _get_langgraph_workflow(self):
        if self._langgraph_workflow is None:
            # Create LLM function wrapper
            def llm_function(prompt: str, history: str) -> str:
                client = self._get_azure_client()
                messages = [
                    {"role": "system", "content": "You are Ruby, a career coach."},
                    {"role": "user", "content": f"{history}\n\n{prompt}"}
                ]
                response = client.chat.completions.create(
                    model=settings.AZURE_CHAT_DEPLOYMENT,
                    messages=messages,
                    max_tokens=150,
                    temperature=0.7,
                )
                return response.choices[0].message.content.strip()
            
            # RAG wrapper
            def rag_function(query: str) -> str:
                vector_store = self._get_vector_store()
                if not vector_store: return ""
                try:
                    docs = vector_store.similarity_search(query, k=2)
                    return "\n".join([d.page_content for d in docs])
                except: return ""
            
            workflow = StateGraph(CoachState)
            
            # Nodes
            workflow.add_node("initiate", initiate_conversation)
            workflow.add_node(
                "respond",
                lambda state: self._respond_to_user_node(state, llm_function, rag_function)
            )
            workflow.add_node(
                "follow_up",
                lambda state: self._ask_follow_up_node(state, llm_function)
            )
            # MODIFIED: Using autonomous evaluation instead of 'update_stage'
            workflow.add_node(
                "update_stage", 
                lambda state: evaluate_stage_autonomous(state, llm_function)
            )
            
            # Edges
            workflow.set_conditional_entry_point(
                should_initiate,
                {
                    "initiate": "initiate",
                    "follow_up": "follow_up",
                    "respond": "respond"
                }
            )
            
            workflow.add_edge("initiate", END)
            workflow.add_edge("respond", "follow_up")
            workflow.add_edge("follow_up", "update_stage")
            workflow.add_edge("update_stage", END)
            
            self._langgraph_workflow = workflow.compile()
        
        return self._langgraph_workflow

    async def initiate_session(
            self,
            user: User,
            session_id: str,
            db: Session
        ) -> dict:
            """
            Proactively starts the conversation.
            Uses the 'initiate_conversation' node in the workflow.
            """
            try:
                langgraph_state = self._get_or_create_langgraph_state(user, session_id, db)
                
                # Check if new
                if len(langgraph_state.get("messages", [])) > 0:
                    # If not new, we can trigger a "Welcome Back" proactive message via logic
                    # For now, we assume the frontend handles this check, or we append a welcome back
                    pass
                
                workflow = self._get_langgraph_workflow()
                # Invoke with empty input or existing state triggers 'should_initiate' logic
                updated_state = workflow.invoke(langgraph_state)
                
                opening = ""
                for msg in reversed(updated_state.get("messages", [])):
                    if isinstance(msg, AIMessage):
                        opening = msg.content
                        break
                
                self._save_langgraph_state(updated_state)
                save_message(db, user.id, session_id, "assistant", opening)
                
                return {
                    "answer": opening,
                    "session_id": session_id,
                    "is_new": True,
                    "conversation_stage": updated_state.get("conversation_stage")
                }
                
            except Exception as e:
                print(f"Init error: {e}")
                fallback = "Welcome! I'm Ruby. Shall we get started?"
                save_message(db, user.id, session_id, "assistant", fallback)
                return {"answer": fallback, "session_id": session_id}
            






################# Ready To Launch #################



    def calculate_completion_percentage(self, microstep: Microstep) -> float:
        """Calculate completion percentage for a microstep"""
        
        steps = microstep.data.get("steps", [])
        if not steps:
            return 0.0
        
        total_items = 0
        completed_items = 0
        
        for step in steps:
            # Count main step
            total_items += 1
            if step.get("status") == "completed":
                completed_items += 1
            
            # Count ministeps
            ministeps = step.get("ministeps", [])
            total_items += len(ministeps)
            completed_items += len([m for m in ministeps if m.get("status") == "completed"])
        
        percentage = (completed_items / total_items * 100) if total_items > 0 else 0.0
        return round(percentage, 2)


    async def check_ready_to_launch(self, microstep: Microstep, db: Session) -> dict:
        """
        Check if user is ready to launch (≥80% completion).
        Returns status and triggers launch if ready.
        """
        
        completion = self.calculate_completion_percentage(microstep)
        
        # Update completion percentage
        microstep.completion_percentage = completion
        db.commit()
        
        # Check if ready to launch
        if completion >= 99.99 and not microstep.is_ready_to_launch:
            # Mark as ready to launch
            microstep.is_ready_to_launch = True
            db.commit()
            
            print(f"🚀 User {microstep.user_id} ready to launch! Completion: {completion}%")

            from app.services.journey_service import apply_journey_update
            from app.api.schemas.journey_schemas import JourneyStateUpdate

            # Journey Trigger → Move user to Launch milestone
            apply_journey_update(
                db,
                JourneyStateUpdate(
                    user_id=microstep.user_id,
                    action_completed=True  # unlocks Action
                )
            )
            print(f"🚀 User {microstep.user_id} ready to launch! Completion: {completion}% is added to the Journey map")

            
            return {
                "ready_to_launch": True,
                "completion_percentage": completion,
                "message": "Congratulations! You've completed enough steps to launch your career transition.",
                "is_new_milestone": True
            }
        
        return {
            "ready_to_launch": microstep.is_ready_to_launch,
            "completion_percentage": completion,
            "message": f"Keep going! {completion}% complete.",
            "is_new_milestone": False
        }


    async def generate_progress_summary(
        self,
        microstep: Microstep,
        user: User
    ) -> str:
        """Generate AI summary of user's career journey"""
        
        steps = microstep.data.get("steps", [])
        completed_steps = [s for s in steps if s.get("status") == "completed"]
        
        # Build context
        completion = self.calculate_completion_percentage(microstep)
        
        SUMMARY_PROMPT = f"""You are a career coach reflecting on a user's journey. Generate a warm, personal summary of their progress.

    **Career Path:** {microstep.career_title}
    **Completion:** {completion}%
    **Steps Completed:** {len(completed_steps)}/{len(steps)}

    **Completed Steps:**
    {chr(10).join([f"- {s.get('title')}" for s in completed_steps[:5]])}

    Generate a 3-4 sentence summary that:
    - Acknowledges their journey and progress
    - Highlights key milestones they've achieved
    - Celebrates their readiness to launch
    - Encourages their next steps

    Keep it warm, personal, and motivating. Use their career path ({microstep.career_title}) as context.
    """
        
        messages = [{"role": "user", "content": SUMMARY_PROMPT}]
        
        try:
            response = self._get_azure_client().chat.completions.create(
                model=settings.AZURE_CHAT_DEPLOYMENT,
                messages=messages,
                temperature=0.7,
                max_tokens=200
            )
            
            summary = response.choices[0].message.content.strip()
            print(f"✅ Generated progress summary ({len(summary)} chars)")
            return summary
            
        except Exception as e:
            print(f"❌ Error generating summary: {e}")
            return f"You've made incredible progress on your journey to becoming a {microstep.career_title}. You've completed {len(completed_steps)} major learning steps and are ready to take the next step in your career transition!"
