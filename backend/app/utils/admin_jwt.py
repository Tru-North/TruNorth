import jwt
from datetime import datetime, timedelta

SECRET_KEY = "ADMIN_SECRET_KEY_CHANGE_THIS"
ALGO = "HS256"
EXP_MINUTES = 30

def create_admin_jwt(admin_id: int):
    expiry = datetime.utcnow() + timedelta(minutes=EXP_MINUTES)
    token = jwt.encode({"admin_id": admin_id, "exp": expiry}, SECRET_KEY, algorithm=ALGO)
    return token

def verify_admin_jwt(token: str):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGO])
        return payload.get("admin_id")
    except:
        return None
