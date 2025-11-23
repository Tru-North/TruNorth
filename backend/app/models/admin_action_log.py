from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func

from app.core.database import Base


class AdminActionLog(Base):
    """
    Immutable audit log of all admin actions.

    Everything an admin edits or triggers is logged with:
    - admin_id
    - user_id
    - session_id (optional)
    - action_type (e.g. update_review, rerun_recommendations)
    - field_name (for field changes)
    - old_value / new_value
    - metadata: arbitrary JSON (optional)
    """
    __tablename__ = "admin_action_logs"

    id = Column(Integer, primary_key=True, index=True)

    admin_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    session_id = Column(String(128), nullable=True)

    action_type = Column(String(64), nullable=False)
    field_name = Column(String(64), nullable=True)

    old_value = Column(Text, nullable=True)
    new_value = Column(Text, nullable=True)

    action_metadata = Column(JSONB, nullable=True)

    timestamp = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
