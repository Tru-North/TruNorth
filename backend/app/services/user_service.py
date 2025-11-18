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

def get_unlock_status(db: Session, user_id: int) -> bool:
    """Return True/False depending on whether the user has unlocked career paths."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return False
    return bool(user.is_career_unlock_confirmed)


def set_unlock_status(db: Session, user_id: int, value: bool = True) -> bool:
    """Set the user's career unlock status."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return False
    user.is_career_unlock_confirmed = value
    db.add(user)
    db.commit()
    return True