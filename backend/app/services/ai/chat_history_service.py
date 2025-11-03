"""
Chat History Service
CRUD operations for chat history
"""

from typing import List, Dict
from sqlalchemy.orm import Session
from sqlalchemy import desc, func

from app.models.chat_history import ChatHistory


def save_message(
    db: Session,
    user_id: int,
    session_id: str,
    role: str,
    message: str
) -> ChatHistory:
    """Save a chat message to database"""
    try:
        chat_msg = ChatHistory(
            user_id=user_id,
            session_id=session_id,
            role=role,
            message=message
        )
        db.add(chat_msg)
        db.commit()
        db.refresh(chat_msg)
        return chat_msg
    except Exception as e:
        db.rollback()
        raise e


def get_recent_messages(
    db: Session,
    user_id: int,
    session_id: str,
    limit: int = 8
) -> List[ChatHistory]:
    """Get recent messages for a session (oldest first)"""
    messages = db.query(ChatHistory).filter(
        ChatHistory.user_id == user_id,
        ChatHistory.session_id == session_id
    ).order_by(desc(ChatHistory.timestamp)).limit(limit).all()
    
    return list(reversed(messages))  # Return oldest first


def get_session_messages(
    db: Session,
    user_id: int,
    session_id: str
) -> List[ChatHistory]:
    """Get all messages for a session"""
    return db.query(ChatHistory).filter(
        ChatHistory.user_id == user_id,
        ChatHistory.session_id == session_id
    ).order_by(ChatHistory.timestamp).all()


def delete_session(
    db: Session,
    user_id: int,
    session_id: str
):
    """Delete all messages for a session"""
    db.query(ChatHistory).filter(
        ChatHistory.user_id == user_id,
        ChatHistory.session_id == session_id
    ).delete()
    db.commit()


def get_user_sessions(
    db: Session,
    user_id: int
) -> List[str]:
    """Get all unique session IDs for a user"""
    result = db.query(ChatHistory.session_id).filter(
        ChatHistory.user_id == user_id
    ).distinct().all()
    
    return [row[0] for row in result]


def get_user_sessions_with_preview(
    db: Session,
    user_id: int
) -> List[Dict]:
    """
    Get all sessions for a user with preview of last message and metadata
    
    Returns list of dicts:
    [
        {
            "session_id": "407f04da-53cd-4c22-89bd-2128da1762c6",
            "last_message": "What was my name again?",
            "last_timestamp": "2025-10-31T21:30:00.123456+00:00",
            "message_count": 10,
            "created_at": "2025-10-31T21:15:00.123456+00:00"
        }
    ]
    """
    try:
        # Get all sessions for the user with their metadata
        sessions_data = db.query(
            ChatHistory.session_id,
            func.count(ChatHistory.id).label('message_count'),
            func.min(ChatHistory.timestamp).label('created_at'),
            func.max(ChatHistory.timestamp).label('last_timestamp')
        ).filter(
            ChatHistory.user_id == user_id
        ).group_by(ChatHistory.session_id).all()
        
        result = []
        
        for session_data in sessions_data:
            session_id = session_data.session_id
            message_count = session_data.message_count
            created_at = session_data.created_at
            last_timestamp = session_data.last_timestamp
            
            # Get the last message in this session
            last_msg = db.query(ChatHistory).filter(
                ChatHistory.user_id == user_id,
                ChatHistory.session_id == session_id
            ).order_by(desc(ChatHistory.timestamp)).first()
            
            last_message_text = last_msg.message if last_msg else ""
            # Truncate if too long
            if len(last_message_text) > 100:
                last_message_text = last_message_text[:100] + "..."
            
            result.append({
                "session_id": session_id,
                "last_message": last_message_text,
                "last_timestamp": last_timestamp.isoformat() if last_timestamp else None,
                "created_at": created_at.isoformat() if created_at else None,
                "message_count": message_count
            })
        
        # Sort by last timestamp (newest first)
        result.sort(
            key=lambda x: x['last_timestamp'] or '',
            reverse=True
        )
        
        return result
    
    except Exception as e:
        print(f"Error getting user sessions with preview: {e}")
        return []


def get_session_summary(
    db: Session,
    user_id: int,
    session_id: str
) -> Dict:
    """
    Get summary information about a session
    
    Returns:
    {
        "session_id": "...",
        "message_count": 10,
        "created_at": "...",
        "last_updated": "...",
        "user_questions": 5,
        "ai_responses": 5
    }
    """
    try:
        session_msgs = db.query(ChatHistory).filter(
            ChatHistory.user_id == user_id,
            ChatHistory.session_id == session_id
        ).all()
        
        if not session_msgs:
            return None
        
        user_count = sum(1 for msg in session_msgs if msg.role == 'user')
        ai_count = sum(1 for msg in session_msgs if msg.role == 'assistant')
        
        return {
            "session_id": session_id,
            "message_count": len(session_msgs),
            "created_at": session_msgs[0].timestamp.isoformat(),
            "last_updated": session_msgs[-1].timestamp.isoformat(),
            "user_questions": user_count,
            "ai_responses": ai_count
        }
    
    except Exception as e:
        print(f"Error getting session summary: {e}")
        return None


def search_session_messages(
    db: Session,
    user_id: int,
    session_id: str,
    keyword: str
) -> List[ChatHistory]:
    """Search for messages containing a keyword in a specific session"""
    return db.query(ChatHistory).filter(
        ChatHistory.user_id == user_id,
        ChatHistory.session_id == session_id,
        ChatHistory.message.ilike(f"%{keyword}%")
    ).order_by(ChatHistory.timestamp).all()


def search_user_messages(
    db: Session,
    user_id: int,
    keyword: str
) -> List[ChatHistory]:
    """Search for messages containing a keyword across all sessions"""
    return db.query(ChatHistory).filter(
        ChatHistory.user_id == user_id,
        ChatHistory.message.ilike(f"%{keyword}%")
    ).order_by(desc(ChatHistory.timestamp)).all()


def get_messages_after_date(
    db: Session,
    user_id: int,
    session_id: str,
    after_timestamp: str
) -> List[ChatHistory]:
    """Get messages after a specific timestamp (ISO format)"""
    from datetime import datetime
    
    after_dt = datetime.fromisoformat(after_timestamp)
    
    return db.query(ChatHistory).filter(
        ChatHistory.user_id == user_id,
        ChatHistory.session_id == session_id,
        ChatHistory.timestamp >= after_dt
    ).order_by(ChatHistory.timestamp).all()


def export_session_messages(
    db: Session,
    user_id: int,
    session_id: str,
    format: str = "json"
) -> str:
    """
    Export session messages in different formats
    
    Formats: "json", "csv", "markdown"
    """
    import json
    import csv
    from io import StringIO
    
    messages = get_session_messages(db, user_id, session_id)
    
    if format == "json":
        return json.dumps([
            {
                "role": msg.role,
                "message": msg.message,
                "timestamp": msg.timestamp.isoformat()
            }
            for msg in messages
        ], indent=2)
    
    elif format == "csv":
        output = StringIO()
        writer = csv.writer(output)
        writer.writerow(["Timestamp", "Role", "Message"])
        
        for msg in messages:
            writer.writerow([
                msg.timestamp.isoformat(),
                msg.role,
                msg.message
            ])
        
        return output.getvalue()
    
    elif format == "markdown":
        md = f"# Session {session_id}\n\n"
        
        for msg in messages:
            role_display = "👤 You" if msg.role == "user" else "🤖 AI Coach"
            timestamp = msg.timestamp.strftime("%Y-%m-%d %H:%M:%S")
            md += f"**{role_display}** ({timestamp})\n{msg.message}\n\n"
        
        return md
    
    else:
        raise ValueError(f"Unsupported format: {format}")


def delete_old_sessions(
    db: Session,
    user_id: int,
    days: int = 30
):
    """Delete sessions older than specified days"""
    from datetime import datetime, timedelta
    
    cutoff_date = datetime.utcnow() - timedelta(days=days)
    
    db.query(ChatHistory).filter(
        ChatHistory.user_id == user_id,
        ChatHistory.timestamp < cutoff_date
    ).delete()
    db.commit()


def get_user_stats(
    db: Session,
    user_id: int
) -> Dict:
    """Get usage statistics for a user"""
    try:
        all_messages = db.query(ChatHistory).filter(
            ChatHistory.user_id == user_id
        ).all()
        
        if not all_messages:
            return {
                "total_sessions": 0,
                "total_messages": 0,
                "user_questions": 0,
                "ai_responses": 0,
                "first_chat": None,
                "last_chat": None
            }
        
        sessions = get_user_sessions(db, user_id)
        user_count = sum(1 for msg in all_messages if msg.role == 'user')
        ai_count = sum(1 for msg in all_messages if msg.role == 'assistant')
        
        return {
            "total_sessions": len(sessions),
            "total_messages": len(all_messages),
            "user_questions": user_count,
            "ai_responses": ai_count,
            "first_chat": min(msg.timestamp for msg in all_messages).isoformat(),
            "last_chat": max(msg.timestamp for msg in all_messages).isoformat()
        }
    
    except Exception as e:
        print(f"Error getting user stats: {e}")
        return None
