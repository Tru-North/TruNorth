"""
AI Coach Service Layer
Business logic for AI career coach operations
"""

import uuid
import os
import json
import time
from typing import List, Optional, Tuple
import requests
from openai import AzureOpenAI
from pinecone import Pinecone, ServerlessSpec
from langchain_community.vectorstores import Pinecone as LangchainPinecone
from langchain.embeddings.base import Embeddings
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.user import User
from app.services.ai.chat_history_service import delete_session
from app.services.ai.chat_history_service import get_recent_messages
from app.services.ai.chat_history_service import save_message
from app.services.ai.chat_history_service import save_message
from app.services.ai.chat_history_service import get_session_messages
from app.services.ai.feedback_service import get_user_feedback_patterns

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
        if self._initialized:
            return
        
        self._azure_client = None
        self._vector_store = None
        self._embeddings = None
        self.log_file = os.path.join(settings.LOG_DIR, "ai_coach_history.jsonl")
        self._initialized = True
        
        print("🚀 AICoachService initialized")
    
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
        
        SYSTEM_PROMPT = """You are an empathetic and supportive AI Career Coach.
    Your role is to guide clients through self-discovery, career exploration, and practical next steps.

    Your tone should be:
    - Friendly, warm, and human-like
    - Non-judgmental and encouraging
    - Conversational, not robotic
    - Focused on curiosity, reflection, and small actionable steps

    You learn from user feedback to improve your responses over time.You will give the user very short but imformative answers, unless the user asks for more details keep the default answer length upto max 200 tokens."""
        
        messages = [{"role": "system", "content": SYSTEM_PROMPT}]
        
        # ✅ INJECT USER FEEDBACK PREFERENCES
        if user:
            try:                
                feedback_patterns = get_user_feedback_patterns(db, user.id, limit=20)
                
                print(f"🧠 Feedback patterns for user {user.id}: {feedback_patterns}")
                
                if feedback_patterns["has_feedback"] and (feedback_patterns["like_count"] > 0 or feedback_patterns["dislike_count"] > 0):
                    feedback_context = f"""
        USER FEEDBACK HISTORY:
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
        """Process a question and return answer"""
        
        # Save user message
        if user:
            try:
                save_message(db, user.id, session_id, "user", question)
            except ImportError:
                pass
        
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
        
        return {"answer": answer, "session_id": session_id}
    
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
        
        # Get text answer
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
        
        # 2. Get answer
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
