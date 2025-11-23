from fastapi import Depends, HTTPException, Header
from sqlalchemy.orm import Session

from app.utils.admin_jwt import verify_admin_jwt
from app.core.database import get_db
from app.models.user import User


async def get_current_admin(
    authorization: str = Header(None),
    db: Session = Depends(get_db)
):
    """
    Verifies admin JWT token (not Firebase).
    Ensures user has is_admin=True.
    """
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing Authorization header")

    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid Authorization format")

    token = authorization.split(" ")[1]
    admin_id = verify_admin_jwt(token)

    if not admin_id:
        raise HTTPException(status_code=401, detail="Invalid or expired admin token")

    admin = db.query(User).filter(
        User.id == admin_id,
        User.role == "admin"
    ).first()

    if not admin:
        raise HTTPException(status_code=403, detail="Admin access required")

    return admin
