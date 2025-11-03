"""
User Service - Helper functions
"""

from typing import Optional
from sqlalchemy.orm import Session
from app.models.user import User

def get_user_by_firebase_uid(db: Session, firebase_uid: str) -> Optional[User]:
    """Get user by Firebase UID"""
    if not firebase_uid:
        return None
    return db.query(User).filter(User.firebase_uid == firebase_uid).first()
