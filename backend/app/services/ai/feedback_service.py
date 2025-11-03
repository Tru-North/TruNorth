"""
Feedback Service
Handles storage and retrieval of user feedback for AI learning
"""

from typing import Optional, List, Dict
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from datetime import datetime, timedelta

from app.models.feedback import MessageFeedback
from app.models.chat_history import ChatHistory

def save_feedback(
    db: Session,
    user_id: int,
    session_id: str,
    message_id: int,
    feedback_type: str,
    user_question: Optional[str] = None,
    assistant_response: Optional[str] = None
) -> MessageFeedback:
    """
    Save user feedback for a specific message
    
    Args:
        feedback_type: 'like' or 'dislike'
    """
    try:
        # Check if feedback already exists for this message
        existing = db.query(MessageFeedback).filter(
            MessageFeedback.user_id == user_id,
            MessageFeedback.message_id == message_id
        ).first()
        
        if existing:
            # Update existing feedback
            existing.feedback_type = feedback_type
            existing.created_at = datetime.utcnow()
            db.commit()
            db.refresh(existing)
            return existing
        
        # Create new feedback
        feedback = MessageFeedback(
            user_id=user_id,
            session_id=session_id,
            message_id=message_id,
            feedback_type=feedback_type,
            user_question=user_question,
            assistant_response=assistant_response
        )
        
        db.add(feedback)
        db.commit()
        db.refresh(feedback)
        return feedback
    
    except Exception as e:
        db.rollback()
        raise e


def get_user_feedback_patterns(db: Session, user_id: int, limit: int = 20) -> Dict:
    """
    Analyze user's feedback patterns to understand preferences
    Returns insights about what the user likes/dislikes
    """
    try:
        # Get recent feedback - FIXED QUERY
        recent_feedback = db.query(MessageFeedback).filter(
            MessageFeedback.user_id == user_id
        ).order_by(desc(MessageFeedback.created_at)).limit(limit).all()
        
        print(f"🔍 Feedback query result: found {len(recent_feedback)} feedback items for user {user_id}")
        
        if not recent_feedback or len(recent_feedback) == 0:
            print(f"⚠️  No feedback found for user {user_id}")
            return {
                "has_feedback": False,
                "liked_examples": [],
                "disliked_examples": [],
                "preference_summary": ""
            }
        
        # Separate likes and dislikes
        liked = [f for f in recent_feedback if f.feedback_type == 'like']
        disliked = [f for f in recent_feedback if f.feedback_type == 'dislike']
        
        print(f"✅ Found {len(liked)} likes and {len(disliked)} dislikes")
        
        # Extract examples
        liked_examples = [
            {
                "question": f.user_question or "N/A",
                "response": (f.assistant_response[:200] + "..." if f.assistant_response and len(f.assistant_response) > 200 else f.assistant_response) or "N/A"
            }
            for f in liked[:5]
        ]
        
        disliked_examples = [
            {
                "question": f.user_question or "N/A",
                "response": (f.assistant_response[:200] + "..." if f.assistant_response and len(f.assistant_response) > 200 else f.assistant_response) or "N/A"
            }
            for f in disliked[:5]
        ]
        
        # Generate preference summary
        like_count = len(liked)
        dislike_count = len(disliked)
        
        summary = f"User has provided {like_count} positive and {dislike_count} negative feedback instances. "
        
        if like_count > 0 or dislike_count > 0:
            if like_count > dislike_count * 2:
                summary += "User generally appreciates detailed, comprehensive responses. "
            elif dislike_count > like_count * 2:
                summary += "User prefers concise, direct responses. "
            else:
                summary += "User provides balanced feedback on different response styles. "
        
        result = {
            "has_feedback": True,
            "liked_examples": liked_examples,
            "disliked_examples": disliked_examples,
            "preference_summary": summary,
            "like_count": like_count,
            "dislike_count": dislike_count
        }
        
        print(f"✅ Feedback patterns: {result}")
        return result
    
    except Exception as e:
        print(f"❌ Error analyzing feedback patterns: {e}")
        import traceback
        traceback.print_exc()
        return {
            "has_feedback": False,
            "liked_examples": [],
            "disliked_examples": [],
            "preference_summary": ""
        }



def delete_feedback(db: Session, user_id: int, message_id: int):
    """Remove feedback for a specific message"""
    db.query(MessageFeedback).filter(
        MessageFeedback.user_id == user_id,
        MessageFeedback.message_id == message_id
    ).delete()
    db.commit()


def get_feedback_stats(db: Session, user_id: int) -> Dict:
    """Get overall feedback statistics for a user"""
    try:
        total = db.query(func.count(MessageFeedback.id)).filter(
            MessageFeedback.user_id == user_id
        ).scalar()
        
        likes = db.query(func.count(MessageFeedback.id)).filter(
            MessageFeedback.user_id == user_id,
            MessageFeedback.feedback_type == 'like'
        ).scalar()
        
        dislikes = db.query(func.count(MessageFeedback.id)).filter(
            MessageFeedback.user_id == user_id,
            MessageFeedback.feedback_type == 'dislike'
        ).scalar()
        
        return {
            "total_feedback": total,
            "likes": likes,
            "dislikes": dislikes,
            "satisfaction_rate": (likes / total * 100) if total > 0 else 0
        }
    
    except Exception as e:
        print(f"Error getting feedback stats: {e}")
        return {
            "total_feedback": 0,
            "likes": 0,
            "dislikes": 0,
            "satisfaction_rate": 0
        }
