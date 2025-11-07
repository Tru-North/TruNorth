from typing import Optional
from datetime import datetime
from pydantic import BaseModel, EmailStr

# ---------------------- CREATE & UPDATE ----------------------

class UserCreate(BaseModel):
    firstname: str
    lastname: str
    email: EmailStr
    password: str


class UserUpdate(BaseModel):
    firstname: Optional[str] = None
    lastname: Optional[str] = None
    password: Optional[str] = None


# ---------------------- RESPONSE MODEL ----------------------

class UserResponse(BaseModel):
    id: int
    firebase_uid: str
    firstname: str
    lastname: str
    email: str
    created_at: datetime
    last_login: Optional[datetime] = None

    class Config:
        from_attributes = True  # ✅ replaces orm_mode in Pydantic v2


# ---------------------- PASSWORD RESET ----------------------

class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class VerifyCodeRequest(BaseModel):
    email: EmailStr
    code: str


class ResetPasswordRequest(BaseModel):
    email: EmailStr
    code: str
    new_password: str
