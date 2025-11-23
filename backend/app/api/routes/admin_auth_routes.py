from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.services.admin_login_service import admin_login_service

router = APIRouter(prefix="/admin/auth", tags=["Admin Authentication"])

@router.post("/login")
def admin_login(payload: dict, db: Session = Depends(get_db)):
    """
    Dedicated secure admin login (email + password).
    Normal users cannot use this.
    Issues admin JWT for accessing /admin routes.
    """
    print("Login called")
    try:
        email = payload.get("email")
        password = payload.get("password")

        if not email or not password:
            raise HTTPException(status_code=400, detail="Email and password required")

        return admin_login_service(email=email, password=password, db=db)
    except Exception as e:
        print(f"Error in admin_login: {e}")
        import traceback
        traceback.print_exc()
        raise
