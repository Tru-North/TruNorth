# backend/app/models/user.py
from sqlalchemy import Column, Integer, String
from app.core.database import Base

class User(Base):
    __tablename__ = "users"  # ✅ Matches existing table name in PostgreSQL

    id = Column(Integer, primary_key=True, index=True)
    firstname = Column(String(255))
    lastname = Column(String(255))
    email = Column(String(255), unique=True)
    password = Column(String(255))
    firebase_uid = Column(String(128), unique=True)
