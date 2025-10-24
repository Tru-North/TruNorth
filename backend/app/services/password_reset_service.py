# app/services/password_reset_service.py
from app.utils.auth_utils import generate_code, create_reset_entry, verify_code, hash_password
from app.utils.email_utils import send_reset_code
from app.models.user import get_connection
from app.utils.firebase_util import auth  # Firebase Admin

# ✅ Step 1: send code to user's email
async def initiate_reset(email: str):
    code = generate_code()
    create_reset_entry(email, code)
    await send_reset_code(email, code)
    # we never reveal whether the email exists (security best practice)
    return {"message": "If this email exists, a verification code has been sent."}


# ✅ Step 2: verify that the user-entered code matches
def check_code(email: str, code: str):
    return {"valid": verify_code(email, code)}


# ✅ Step 3: reset the password if code is valid
def reset_password(email: str, code: str, new_password: str):
    # 1. verify code
    if not verify_code(email, code):
        return {"success": False, "detail": "Invalid or expired code"}

    # 2. find the Firebase UID for this user
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT id, firebase_uid FROM users WHERE Email = %s;", (email,))
    user_row = cur.fetchone()

    if not user_row:
        cur.close()
        conn.close()
        # still return success (avoid revealing user existence)
        return {"success": True, "message": "Password reset successful."}

    user_id, firebase_uid = user_row

    # 3. update password in Firebase (source of truth for login)
    try:
        auth.update_user(firebase_uid, password=new_password)
    except Exception as e:
        cur.close()
        conn.close()
        return {"success": False, "detail": f"Failed to update password in Firebase: {e}"}

    # 4. update local DB password (store hashed)
    cur.execute("UPDATE users SET Password = %s WHERE id = %s;", (hash_password(new_password), user_id))
    conn.commit()
    cur.close()
    conn.close()

    return {"success": True, "message": "Password updated successfully."}
