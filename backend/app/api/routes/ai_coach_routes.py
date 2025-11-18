"""
AI Career Coach Routes
Handles all AI coach endpoints with chat history integration
"""

import uuid
import json
import io
from typing import Optional
from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect, UploadFile, File, Form, Request, Query, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.config import settings
from app.services.ai.ai_coach_service import AICoachService
from app.services.ai.chat_history_service import get_session_messages
from app.services.ai.chat_history_service import get_user_sessions_with_preview
from app.services.ai.chat_history_service import get_user_stats
from app.services.ai.chat_history_service import get_user_sessions
from app.models.user import User
from app.services.ai.feedback_service import (
    save_feedback,
    get_user_feedback_patterns,
    delete_feedback,
    get_feedback_stats
)

router = APIRouter(
    prefix="/ai-coach",
    tags=["AI Career Coach"]
)

# Pydantic Models
class AskRequest(BaseModel):
    question: str

class TTSRequest(BaseModel):
    text: str
    voice: Optional[str] = None
    format: Optional[str] = "wav"

# Initialize service (singleton)
ai_coach_service = AICoachService()

# WebSocket Connection Manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []
    
    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
    
    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
    
    async def send_personal_message(self, message: str, websocket: WebSocket):
        await websocket.send_text(message)

manager = ConnectionManager()

# Helper to get current user from firebase_uid header
def get_current_user(
    request: Request,
    db: Session = Depends(get_db)
) -> Optional[User]:
    """Extract user from x-firebase-uid header"""
    firebase_uid = request.headers.get("x-firebase-uid")
    if not firebase_uid:
        return None
    
    # Query user from database
    user = db.query(User).filter(User.firebase_uid == firebase_uid).first()
    return user

# ==================== ROUTES ====================

@router.get("/")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "online",
        "service": "AI Career Coach",
        "version": "1.0.0"
    }

@router.post("/ask")
async def ask_question(
    request: Request,
    payload: AskRequest,
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user)
):
    """
    Ask a question to the AI Career Coach with chat history
    
    Headers:
    - x-firebase-uid: Firebase UID for user authentication (optional)
    - x-session-id: Session ID to continue conversation (optional)
    
    Body:
    - question: User's question
    
    Returns:
    - answer: AI coach response
    - session_id: Session identifier for conversation continuity
    """
        # Get Firebase UID from middleware (automatically set)
    firebase_uid = request.state.firebase_uid
    session_id = request.headers.get("x-session-id") or str(uuid.uuid4())
    
    # Get user if Firebase UID exists
    user = None
    if firebase_uid:
        user = db.query(User).filter(User.firebase_uid == firebase_uid).first()
    
    try:
        result = await ai_coach_service.ask(
            question=payload.question,
            user=user,
            session_id=session_id,
            db=db
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/feedback")
async def submit_feedback(
    feedback_type: str = Query(..., regex="^(like|dislike)$"),
    message_content: str = Query(...),  # Use message content as identifier
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user)
):
    """
    Submit feedback (like/dislike) for a specific message
    
    Query params:
    - feedback_type: 'like' or 'dislike'
    - message_content: First 50 chars of the message (for matching)
    """
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    try:
        from app.models.feedback import MessageFeedback
        from app.models.chat_history import ChatHistory
        
        # Find the message by content
        chat_message = db.query(ChatHistory).filter(
            ChatHistory.user_id == user.id,
            ChatHistory.message.ilike(f"{message_content}%")
        ).order_by(ChatHistory.id.desc()).first()
        
        if not chat_message:
            raise HTTPException(status_code=404, detail="Message not found")
        
        # Check if feedback already exists
        existing_feedback = db.query(MessageFeedback).filter(
            MessageFeedback.user_id == user.id,
            MessageFeedback.message_id == chat_message.id
        ).first()
        
        if existing_feedback:
            # Update existing feedback
            existing_feedback.feedback_type = feedback_type
            db.commit()
            db.refresh(existing_feedback)
            return {
                "message": f"Feedback updated to '{feedback_type}'",
                "feedback_id": existing_feedback.id
            }
        
        # Create new feedback
        from datetime import datetime
        from sqlalchemy import func
        
        feedback = MessageFeedback(
            user_id=user.id,
            session_id="default",  # Store default or from header if available
            message_id=chat_message.id,
            feedback_type=feedback_type,
            user_question=None,
            assistant_response=chat_message.message
        )
        
        db.add(feedback)
        db.commit()
        db.refresh(feedback)
        
        print(f"✅ Feedback saved: user_id={user.id}, message_id={chat_message.id}, type={feedback_type}")
        
        return {
            "message": f"Feedback '{feedback_type}' saved successfully",
            "feedback_id": feedback.id,
            "message_id": chat_message.id
        }
    
    except Exception as e:
        print(f"❌ Feedback error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/sessions")
async def get_user_sessions(
    request: Request,
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user)
):
    """Get all chat sessions for the logged-in user with preview"""
    
    # If no authenticated user, return empty sessions
    if not user:
        return {"user_id": None, "sessions": []}
    
    try:
        sessions = get_user_sessions_with_preview(db, user.id)
        return {"user_id": user.id, "sessions": sessions}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stats")
async def get_user_stats(
    request: Request,
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user)
):
    """Get usage statistics for the user"""
    
    # If no authenticated user, return empty stats
    if not user:
        return {
            "user_id": None,
            "stats": {
                "total_sessions": 0,
                "total_messages": 0,
                "user_questions": 0,
                "ai_responses": 0
            }
        }
    
    try:

        stats = get_user_stats(db, user.id)
        return {"user_id": user.id, "stats": stats}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@router.post("/ask/voice")
async def ask_voice(
    request: Request,
    payload: AskRequest,
    voice: Optional[str] = None,
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user)
):
    """
    Ask a question and get voice response (returns audio WAV file)
    
    Headers:
    - x-firebase-uid: Firebase UID for user authentication (optional)
    - x-session-id: Session ID to continue conversation (optional)
    """
    session_id = request.headers.get("x-session-id") or str(uuid.uuid4())
    
    try:
        audio_bytes, answer_text = await ai_coach_service.ask_voice(
            question=payload.question,
            user=user,
            session_id=session_id,
            db=db,
            voice=voice
        )
        
        return StreamingResponse(
            io.BytesIO(audio_bytes),
            media_type="audio/wav",
            headers={
                "Content-Disposition": 'inline; filename="ai_coach_response.wav"',
                "X-Session-ID": session_id,
                "X-Answer-Length": str(len(answer_text))
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/ask/voice")
async def ask_voice_get(
    request: Request,
    question: str,
    voice: Optional[str] = None,
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user)
):
    """GET wrapper for voice endpoint (browser-friendly testing)"""
    return await ask_voice(request, AskRequest(question=question), voice, db, user)

@router.post("/voice/tts")
async def text_to_speech(req: TTSRequest):
    """Convert text to speech (returns audio WAV file)"""
    try:
        audio_bytes = await ai_coach_service.text_to_speech(
            text=req.text,
            voice=req.voice
        )
        
        return StreamingResponse(
            io.BytesIO(audio_bytes),
            media_type="audio/wav",
            headers={"Content-Disposition": 'inline; filename="tts_output.wav"'}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"TTS error: {str(e)}")

@router.get("/voice/tts")
async def text_to_speech_get(text: str, voice: Optional[str] = None):
    """GET wrapper for TTS endpoint"""
    return await text_to_speech(TTSRequest(text=text, voice=voice))

@router.post("/voice/stt")
async def speech_to_text(audio: UploadFile = File(...)):
    """Convert speech to text (upload audio file, get transcription)"""
    try:
        audio_bytes = await audio.read()
        text = await ai_coach_service.speech_to_text(audio_bytes, audio.content_type)
        
        return {"text": text, "filename": audio.filename}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"STT error: {str(e)}")

@router.post("/voice/voice")
async def voice_to_voice(
    request: Request,
    audio: UploadFile = File(...),
    voice: Optional[str] = Form(None),
    firebase_uid: Optional[str] = Form(None),
    session_id: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    """
    Voice-to-Voice pipeline with chat history:
    1) Upload audio → Transcribe (STT)
    2) Process with AI coach (with chat history)
    3) Convert response to speech (TTS)
    4) Return audio response
    """
    user = None
    if firebase_uid:
        user = db.query(User).filter(User.firebase_uid == firebase_uid).first()
    
    session_id = session_id or str(uuid.uuid4())

    # ✅ Header-safe sanitizer
    def sanitize_header(value: str) -> str:
        """Ensure header values are ASCII-only and one-line."""
        if not value:
            return ""
        value = value.replace("\r", " ").replace("\n", " ")  # remove newlines
        value = value.encode("ascii", "ignore").decode("ascii")  # strip emojis/non-ASCII
        return value[:200]  # limit length

    try:
        audio_bytes = await audio.read()
        response_audio, user_text, answer_text = await ai_coach_service.voice_to_voice(
            audio_bytes=audio_bytes,
            audio_content_type=audio.content_type,
            user=user,
            session_id=session_id,
            db=db,
            voice=voice
        )

        return StreamingResponse(
            io.BytesIO(response_audio),
            media_type="audio/wav",
            headers={
                "Content-Disposition": 'inline; filename="voice_response.wav"',
                "X-Session-ID": sanitize_header(session_id),
                "X-User-Text": sanitize_header(user_text or ""),
                "X-Answer-Text": sanitize_header(answer_text or ""),
            },
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/voice/voices")
async def list_voices(sample_text: str = Query("This is a voice test.")):
    """Test available TTS voices and return which ones work"""
    try:
        result = await ai_coach_service.test_voices(sample_text)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.websocket("/ws/coach")
async def websocket_coach(websocket: WebSocket):
    """
    WebSocket endpoint for real-time chat with history
    
    Send JSON: {"message": "your question", "firebase_uid": "...", "session_id": "..."}
    Receive JSON: {"answer": "...", "session_id": "..."}
    """
    await manager.connect(websocket)
    await manager.send_personal_message(
        json.dumps({"status": "connected", "message": "AI Career Coach ready"}),
        websocket
    )
    
    db = next(get_db())
    
    try:
        while True:
            data_text = await websocket.receive_text()
            
            # Parse payload
            try:
                payload = json.loads(data_text)
                question = payload.get("message", "")
                firebase_uid = payload.get("firebase_uid")
                session_id = payload.get("session_id") or str(uuid.uuid4())
            except json.JSONDecodeError:
                question = data_text
                firebase_uid = None
                session_id = str(uuid.uuid4())
            
            # Get user
            user = None
            if firebase_uid:
                user = db.query(User).filter(User.firebase_uid == firebase_uid).first()
            
            # Process question
            try:
                result = await ai_coach_service.ask(
                    question=question,
                    user=user,
                    session_id=session_id,
                    db=db
                )
                
                # 🔥 PATCH: Convert backend flag → frontend flag
                if result.get("trigger_explore_unlock") is True:
                    result["unlock_prompt"] = True
                else:
                    result["unlock_prompt"] = False

                # Optional: remove backend-internal field
                # result.pop("trigger_explore_unlock", None)

                await manager.send_personal_message(
                    json.dumps(result),
                    websocket
                )

            except Exception as e:
                await manager.send_personal_message(
                    json.dumps({"error": str(e), "session_id": session_id}),
                    websocket
                )
    
    except WebSocketDisconnect:
        manager.disconnect(websocket)
        print("WebSocket disconnected")
    finally:
        db.close()

@router.get("/history/{session_id}")
async def get_session_history(
    session_id: str,
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user)
):
    """Get chat history for a specific session"""
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    try:
        history = await ai_coach_service.get_session_history(
            user_id=user.id,
            session_id=session_id,
            db=db
        )
        return {"session_id": session_id, "messages": history}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/history/{session_id}")
async def delete_session_history(
    session_id: str,
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user)
):
    """Delete chat history for a specific session"""
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    try:
        await ai_coach_service.delete_session_history(
            user_id=user.id,
            session_id=session_id,
            db=db
        )
        return {"message": "Session history deleted", "session_id": session_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/sessions")
async def get_user_sessions(
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user)
):
    """Get all session IDs for the current user"""
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    try:
        sessions = get_user_sessions(db, user.id)
        return {"user_id": user.id, "sessions": sessions}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
