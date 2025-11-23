from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.models.user import User
from app.utils.admin_password import verify_admin_password
from app.utils.admin_jwt import create_admin_jwt


def admin_login_service(email: str, password: str, db: Session):
    admin = (
        db.query(User)
        .filter(User.email == email)
        .filter(User.role == "admin")
        .first()
    )

    if not admin:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not admin.admin_password_hash or not admin.admin_password_salt:
        raise HTTPException(status_code=403, detail="Admin password not set")

    if not verify_admin_password(password, admin.admin_password_hash, admin.admin_password_salt):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    # Create short-lived admin token
    token = create_admin_jwt(admin_id=admin.id)

    return {
        "access_token": token,
        "admin_id": admin.id,
        "email": admin.email,
        "role": admin.role,
    }
