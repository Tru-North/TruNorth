import secrets
from datetime import datetime, timedelta, timezone
from passlib.context import CryptContext
from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.models.password_reset import PasswordReset  # we'll create this model below

# bcrypt hashing context
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# ---------------- PASSWORD UTILS ----------------

def generate_code() -> str:
    """Return a 6-digit reset code like '428193'."""
    return str(secrets.randbelow(1_000_000)).zfill(6)


def hash_password(password: str) -> str:
    """Return bcrypt-hashed password (truncate if >72 bytes)."""
    if len(password.encode("utf-8")) > 72:
        password = password[:72]
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    """Check a plaintext password against a bcrypt hash."""
    return pwd_context.verify(plain, hashed)


# ---------------- PASSWORD RESET HANDLERS ----------------

def create_reset_entry(email: str, code: str, ttl_minutes: int = 10):
    """Insert or update a reset code for this email."""
    db: Session = SessionLocal()
    try:
        expires = datetime.now(timezone.utc) + timedelta(minutes=ttl_minutes)
        entry = db.query(PasswordReset).filter(PasswordReset.email == email).first()

        if entry:
            entry.code = code
            entry.expires_at = expires
        else:
            new_entry = PasswordReset(email=email, code=code, expires_at=expires)
            db.add(new_entry)

        db.commit()
    except Exception as e:
        db.rollback()
        raise e
    finally:
        db.close()


def verify_code(email: str, code: str) -> bool:
    """Return True if code matches and not expired."""
    db: Session = SessionLocal()
    try:
        entry = db.query(PasswordReset).filter(PasswordReset.email == email).first()
        if not entry:
            return False
        return entry.code == code and entry.expires_at > datetime.now(timezone.utc)
    finally:
        db.close()
