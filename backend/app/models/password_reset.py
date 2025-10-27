from sqlalchemy import Column, Integer, String, DateTime
from app.core.database import Base

class PasswordReset(Base):
    __tablename__ = "password_resets"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, nullable=False)
    code = Column(String(10), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
