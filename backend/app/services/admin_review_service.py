from typing import List, Optional, Iterable

from sqlalchemy import asc, desc, func, or_
from sqlalchemy.orm import Session

from app.models.user import User
from app.models.chat_history import ChatHistory
from app.models.admin_review import AdminUserReview
from app.models.admin_action_log import AdminActionLog


# ---------- User List Helpers ----------

def list_users_for_admin(
    db: Session,
    *,
    search: Optional[str] = None,
    sort_by: str = "created_at",  # "created_at" | "last_login" | "name"
    sort_dir: str = "desc",       # "asc" | "desc"
    page: int = 1, 
    page_size: int = 10
) -> List[User]:
    """
    Returns a list of users for the admin dashboard user list.

    - search matches firstname/lastname/email and, if numeric, exact user_id
    - sort_by: created_at | last_login | name
    """
    q = db.query(User)

    if search:
        pattern = f"%{search}%"
        conditions = [
            User.firstname.ilike(pattern),
            User.lastname.ilike(pattern),
            User.email.ilike(pattern),
        ]
        if search.isdigit():
            # Allow direct ID search
            conditions.append(User.id == int(search))
        q = q.filter(or_(*conditions))

    if sort_by == "last_login":
        order_col = User.last_login
    elif sort_by == "name":
        order_col = User.firstname
    else:
        order_col = User.created_at

    if sort_dir == "asc":
        q = q.order_by(asc(order_col))
    else:
        q = q.order_by(desc(order_col))

    #return q.all()
    # ---- PAGINATION ----
    page = page or 1
    page_size = page_size or 10
    offset = (page - 1) * page_size

    total = q.count()
    items = q.offset(offset).limit(page_size).all()

    return {
        "items": items,
        "total": total
    }


# ---------- Session & Chat Transcript ----------

def list_user_sessions(db: Session, user_id: int) -> Iterable:
    """
    Returns aggregated session info for a given user:
    - session_id
    - first_message (min timestamp)
    - last_message (max timestamp)
    - message_count
    """
    rows = (
        db.query(
            ChatHistory.session_id,
            func.min(ChatHistory.timestamp).label("first_message"),
            func.max(ChatHistory.timestamp).label("last_message"),
            func.count().label("message_count"),
        )
        .filter(ChatHistory.user_id == user_id)
        .group_by(ChatHistory.session_id)
        .order_by(desc("last_message"))
        .all()
    )
    return rows


def get_session_messages(db: Session, user_id: int, session_id: str) -> List[ChatHistory]:
    """
    Returns full ordered chat transcript for (user, session).
    """
    return (
        db.query(ChatHistory)
        .filter(
            ChatHistory.user_id == user_id,
            ChatHistory.session_id == session_id,
        )
        .order_by(ChatHistory.timestamp.asc())
        .all()
    )


# ---------- Session Review Helpers ----------

def get_or_create_user_review(
    db: Session,
    *,
    user_id: int,
    admin_id: int,
) -> AdminUserReview:
    """
    Fetches existing review or creates a blank one for the user.
    """
    review = (
        db.query(AdminUserReview)
        .filter(
            AdminUserReview.user_id == user_id,
        )
        .first()
    )

    if not review:
        review = AdminUserReview(
            user_id=user_id,
            admin_id=admin_id,
        )
        db.add(review)
        db.flush()  # so review.id is populated
    return review


# ---------- Audit Logging ----------

def log_admin_action(
    db: Session,
    admin_id: int,
    user_id: int,
    action_type: str,
    session_id: Optional[str] = None,
    field_name: Optional[str] = None,
    old_value: Optional[str] = None,
    new_value: Optional[str] = None,
    action_metadata: Optional[dict] = None,
) -> None:
    """
    Writes a single immutable admin action record.
    """
    log = AdminActionLog(
        admin_id=admin_id,
        user_id=user_id,
        session_id=session_id,
        action_type=action_type,
        field_name=field_name,
        old_value=old_value,
        new_value=new_value,
        action_metadata=action_metadata,
    )
    db.add(log)
    # Commit is controlled by caller (route)


def get_single_user(db: Session, user_id: int):
    return db.query(User).filter(User.id == user_id).first()
