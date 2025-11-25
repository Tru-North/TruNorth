from sqlalchemy import Column, Integer, ForeignKey, String, DateTime, JSON, Float, Text, Boolean
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
    
    completion_percentage = Column(Float, default=0.0)
    is_ready_to_launch = Column(Boolean, default=False)
    launched_at = Column(DateTime, nullable=True)
    rating = Column(Integer, nullable=True)  # 1-5 stars
    review_text = Column(Text, nullable=True)
    progress_summary = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)



