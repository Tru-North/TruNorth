from app.utils.auth_utils import generate_code, create_reset_entry, verify_code, hash_password
from app.utils.email_utils import send_reset_code
from app.utils.firebase_util import auth  # Firebase Admin
from app.core.database import SessionLocal
from app.models.user import User


# ✅ Step 1: Send code to user's email
async def initiate_reset(email: str):
    """
    Generates a code, stores it in password_resets, and emails it to the user.
    Does not reveal whether the email exists (security best practice).
    """
    code = generate_code()
    create_reset_entry(email, code)
    await send_reset_code(email, code)
    return {"message": "If this email exists, a verification code has been sent."}


# ✅ Step 2: Verify that the code matches
def check_code(email: str, code: str):
    """
    Validates the code against the password_resets table.
    """
    return {"valid": verify_code(email, code)}


# ✅ Step 3: Reset the password if code is valid
def reset_password(email: str, code: str, new_password: str):
    """
    Verifies the code, updates the user's password in Firebase, and updates the
    local hashed password in the users table.
    """
    # 1️⃣ Verify reset code
    if not verify_code(email, code):
        return {"success": False, "detail": "Invalid or expired code"}

    db = SessionLocal()
    try:
        # 2️⃣ Find the user by email
        user = db.query(User).filter(User.email == email).first()
        if not user:
            # Security best practice: don't reveal whether user exists
            return {"success": True, "message": "Password reset successful."}

        # 3️⃣ Update password in Firebase (source of truth)
        try:
            auth.update_user(user.firebase_uid, password=new_password)
        except Exception as e:
            return {"success": False, "detail": f"Failed to update password in Firebase: {e}"}

        # 4️⃣ Update local DB password (store hashed)
        user.password = hash_password(new_password)
        db.commit()

        return {"success": True, "message": "Password updated successfully."}

    except Exception as e:
        db.rollback()
        return {"success": False, "detail": str(e)}

    finally:
        db.close()
