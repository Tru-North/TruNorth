"""
User Service - Helper functions
"""

from typing import Optional
from datetime import datetime
from sqlalchemy.orm import Session
from app.models.user import User

def get_user_by_firebase_uid(db: Session, firebase_uid: str) -> Optional[User]:
    """Get user by Firebase UID"""
    if not firebase_uid:
        return None
    return db.query(User).filter(User.firebase_uid == firebase_uid).first()


def update_last_login(db: Session, user: User) -> None:
    """Update user's last login timestamp"""
    if user:
        user.last_login = datetime.utcnow()
        db.add(user)
        db.commit()
        db.refresh(user)
