# app/utils/auth_utils.py
import secrets
from datetime import datetime, timedelta, timezone
from passlib.context import CryptContext
from app.models.user import get_connection  # your existing psycopg2 helper

# bcrypt hashing context
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def generate_code() -> str:
    """Return a 6-digit reset code like '428193'."""
    return str(secrets.randbelow(1_000_000)).zfill(6)

def hash_password(password: str) -> str:
    """Return bcrypt-hashed password (truncate if >72 bytes)."""
    # bcrypt only supports up to 72 bytes — truncate long inputs safely
    if len(password.encode("utf-8")) > 72:
        password = password[:72]
    return pwd_context.hash(password)

def verify_password(plain: str, hashed: str) -> bool:
    """Check a plaintext password against a bcrypt hash."""
    return pwd_context.verify(plain, hashed)

def create_reset_entry(email: str, code: str, ttl_minutes: int = 10):
    """Insert or update a reset code for this email."""
    expires = datetime.now(timezone.utc) + timedelta(minutes=ttl_minutes)
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO password_resets (email, code, expires_at)
        VALUES (%s, %s, %s)
        ON CONFLICT (email) DO UPDATE
        SET code = EXCLUDED.code,
            expires_at = EXCLUDED.expires_at;
    """, (email, code, expires))
    conn.commit()
    cur.close()
    conn.close()

def verify_code(email: str, code: str) -> bool:
    """Return True if code matches and not expired."""
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT code, expires_at FROM password_resets WHERE email=%s;", (email,))
    row = cur.fetchone()
    cur.close()
    conn.close()
    if not row:
        return False
    saved_code, expires_at = row
    return saved_code == code and expires_at > datetime.now(timezone.utc)
