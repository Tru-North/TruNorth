# backend/app/core/database.py
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from app.core.config import DB_HOST, DB_NAME, DB_PASSWORD, DB_PORT, DB_USER

from typing import Generator

# ✅ Construct PostgreSQL URL
DATABASE_URL = f"postgresql+psycopg2://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

# ✅ Create engine & session
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# ✅ Base class for all models
Base = declarative_base()

def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ✅ Initialize DB (non-destructive)
def setup_database():
    """
    Ensures all ORM models are imported before metadata.create_all() runs,
    so all tables get created if missing.
    """
    # ✅ Import every model module before creating metadata
    from app.models import user
    from app.models import questionnaire
    from app.models import password_reset
    from app.models import final_data
    from app.models.final_data import UserFinalData
    from app.models.chat_history import ChatHistory  # added chat_history model

    Base.metadata.create_all(bind=engine)