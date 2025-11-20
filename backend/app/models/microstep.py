from sqlalchemy import Column, Integer, ForeignKey, String, DateTime, JSON
from datetime import datetime
from app.core.database import Base

class Microstep(Base):
    __tablename__ = "microsteps"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)  
    firebase_uid = Column(String, nullable=False, index=True)
    career_id = Column(Integer, nullable=False)
    career_title = Column(String, nullable=True)  #  career name 
    
    # complete microsteps data 
    data = Column(JSON, nullable=False)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
