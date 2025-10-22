##################################
######  All Pydantic models ######
##################################


from typing import Optional

from pydantic import BaseModel, EmailStr


class UserCreate(BaseModel):
    FirstName: str
    LastName: str
    Email: EmailStr
    Password: str

class UserUpdate(BaseModel):
    FirstName: Optional[str] = None
    LastName: Optional[str] = None
    Password: Optional[str] = None  

class UserResponse(BaseModel):
    id: int
    firebase_uid: str
    FirstName: str
    LastName: str
    Email: str
