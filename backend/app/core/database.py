# backend/app/core/database.py
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.core.config import DB_HOST, DB_NAME, DB_PASSWORD, DB_PORT, DB_USER

# ✅ Construct PostgreSQL URL
DATABASE_URL = f"postgresql+psycopg2://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

# ✅ Create engine & session
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# ✅ Base class for all models
Base = declarative_base()


# ✅ Initialize DB (non-destructive)
def setup_database():
    """
    Ensures all ORM models are imported before metadata.create_all() runs,
    so all tables get created if missing. Non-destructive (doesn't drop anything).
    """
    from app.models import user, questionnaire, password_reset  # ✅ include all models
    Base.metadata.create_all(bind=engine)
