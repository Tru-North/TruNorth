import firebase_admin
from fastapi import APIRouter, Depends, HTTPException, Request, Security
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.models.user import User
from app.api.schemas.user import (
    UserCreate,
    UserResponse,
    UserUpdate,
    ForgotPasswordRequest,
    VerifyCodeRequest,
    ResetPasswordRequest,
)
from app.utils.firebase_util import auth, pyre_auth, verify_firebase_token
from app.services.password_reset_service import initiate_reset, check_code, reset_password
from app.services.user_service import get_user_by_firebase_uid, update_last_login

# ---------------------- SETUP ----------------------
router = APIRouter()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")


def get_db():
    """Dependency that provides a database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def firebase_token_dependency(token: str = Security(oauth2_scheme)):
    """Dependency to verify Firebase ID token."""
    decoded_token = verify_firebase_token(token)
    if not decoded_token:
        raise HTTPException(status_code=401, detail="Invalid or expired Firebase token")
    return decoded_token


# ---------------------- AUTH ----------------------

@router.post("/register", response_model=dict, tags=["Auth"])
def register(user: UserCreate, db: Session = Depends(get_db)):
    """
    Registers a new user:
    1. Creates user in Firebase Authentication.
    2. Stores user's profile in PostgreSQL.
    """
    try:
        user_fb = pyre_auth.create_user_with_email_and_password(user.email, user.password)
        fb_user_token = pyre_auth.refresh(user_fb["refreshToken"])
        fb_user_info = pyre_auth.get_account_info(fb_user_token["idToken"])
        firebase_uid = fb_user_info["users"][0]["localId"]
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Firebase registration failed: {str(e)}")

    try:
        new_user = User(
            firstname=user.firstname,
            lastname=user.lastname,
            email=user.email,
            password=user.password,
            firebase_uid=firebase_uid,
        )
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        return {"id": new_user.id, "firebase_uid": firebase_uid, "message": "Registration successful!"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@router.post("/register-google", tags=["Auth"])
async def register_google(request: Request, db: Session = Depends(get_db)):
    """
    Handles both Google Sign-Up and Login:
    1. Verifies Firebase ID token from Authorization header.
    2. If user exists -> logs them in (updates last_login).
    3. If user doesn’t exist -> registers new user (created_at auto, last_login set).
    Returns the same structure as /login for consistency.
    """
    try:
        # 🔹 Step 1: Extract and verify Firebase ID token
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Missing or invalid token")

        id_token = auth_header.split(" ")[1]
        decoded = verify_firebase_token(id_token)
        if not decoded:
            raise HTTPException(status_code=401, detail="Invalid Firebase token")

        firebase_uid = decoded.get("uid")
        email = decoded.get("email", "")
        name = decoded.get("name", "")
        firstname, lastname = (name.split(" ", 1) + [""])[:2] if name else ("", "")

        # 🔹 Step 2: Parse body data for fallback fields
        body = await request.json()
        firstname = body.get("firstname") or firstname
        lastname = body.get("lastname") or lastname
        email = body.get("email") or email
        firebase_uid = body.get("firebase_uid") or firebase_uid

        if not email:
            raise HTTPException(status_code=400, detail="Missing email in request")

        # 🔹 Step 3: Find or create user
        user = db.query(User).filter(User.firebase_uid == firebase_uid).first()
        if not user:
            user = db.query(User).filter(User.email == email).first()

        if user:
            # ✅ Existing user — ensure data is up-to-date
            updated = False
            if not user.firebase_uid:
                user.firebase_uid = firebase_uid
                updated = True
            if firstname and user.firstname != firstname:
                user.firstname = firstname
                updated = True
            if lastname and user.lastname != lastname:
                user.lastname = lastname
                updated = True
            if updated:
                db.commit()
                db.refresh(user)

            # 🕒 Update last_login for returning Google user
            update_last_login(db, user)
            status = "existing_user"
        else:
            # 🆕 New user — create record
            user = User(
                firstname=firstname,
                lastname=lastname,
                email=email,
                password="",  # no password for Google auth
                firebase_uid=firebase_uid,
            )
            db.add(user)
            db.commit()
            db.refresh(user)

            # 🕒 Also set last_login for new Google user
            update_last_login(db, user)
            status = "new_user"

        # 🔹 Step 4: Return same structure as /login
        return {
            "status": status,
            "access_token": id_token,
            "token_type": "bearer",
            "user": {
                "id": user.id,
                "firstname": user.firstname,
                "lastname": user.lastname,
                "email": user.email,
                "firebase_uid": user.firebase_uid,
                "created_at": user.created_at,
                "last_login": user.last_login,
            },
        }

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error registering Google user: {str(e)}")

@router.post("/login", tags=["Auth"])
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """
    Authenticates user via Firebase Auth using OAuth2PasswordRequestForm.
    Returns Firebase ID token as OAuth2 access token.
    """
    email = form_data.username
    password = form_data.password
    try:
        # 🔹 Step 1: Authenticate via Firebase
        firebase_user = pyre_auth.sign_in_with_email_and_password(email, password)
        id_token = firebase_user["idToken"]
        firebase_uid = firebase_user["localId"]

        # 🔹 Step 2: Lookup corresponding DB user using firebase_uid
        user = db.query(User).filter(User.firebase_uid == firebase_uid).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found in database.")

        # 🕒 Step 3: Update last login timestamp
        update_last_login(db, user)

        # 🔹 Step 4: Return combined token + DB user info
        return {
            "access_token": id_token,
            "token_type": "bearer",
            "user": {
                "id": user.id,
                "firstname": user.firstname,
                "lastname": user.lastname,
                "email": user.email,
                "firebase_uid": user.firebase_uid,
                "created_at": user.created_at,
                "last_login": user.last_login,
            },
        }

    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid email or password: {str(e)}")

@router.post("/logout", tags=["Auth"])
def logout(user=Depends(firebase_token_dependency)):
    """Logs out a user by revoking Firebase refresh tokens."""
    try:
        uid = user["uid"]
        auth.revoke_refresh_tokens(uid)
        return {"message": "Logout successful. Client tokens will be invalidated."}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Logout failed: {str(e)}")


# ---------------------- USERS ----------------------

@router.get("/users/{user_id}", response_model=UserResponse, tags=["Users"])
def get_user(user_id: int, user=Depends(firebase_token_dependency), db: Session = Depends(get_db)):
    """Retrieve a single user by ID."""
    db_user = db.query(User).filter(User.id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")

    return {
        "id": db_user.id,
        "firebase_uid": db_user.firebase_uid,
        "firstname": db_user.firstname,
        "lastname": db_user.lastname,
        "email": db_user.email,
        "created_at": getattr(db_user, "created_at", None),
        "last_login": getattr(db_user, "last_login", None),
        "is_career_unlock_confirmed": db_user.is_career_unlock_confirmed,
    }


@router.get("/users", response_model=list[UserResponse], tags=["Users"])
def get_all_users(user=Depends(firebase_token_dependency), db: Session = Depends(get_db)):
    """Retrieve all users."""
    users = db.query(User).all()
    return [
        {
            "id": u.id,
            "firebase_uid": u.firebase_uid,
            "firstname": u.firstname,
            "lastname": u.lastname,
            "email": u.email,
        }
        for u in users
    ]


@router.put("/users/{user_id}", response_model=dict, tags=["Users"])
def update_user(user_id: int, update: UserUpdate, user=Depends(firebase_token_dependency), db: Session = Depends(get_db)):
    """
    Updates user profile:
    - Only the authenticated user can update their own data.
    - Partial updates allowed.
    """
    firebase_uid = user["uid"]
    db_user = db.query(User).filter(User.id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    if db_user.firebase_uid != firebase_uid:
        raise HTTPException(status_code=403, detail="Not authorized to update this user")

    # Update fields
    db_user.firstname = update.firstname or db_user.firstname
    db_user.lastname = update.lastname or db_user.lastname
    if update.password:
        db_user.password = update.password

    # Update Firebase user
    try:
        update_args = {"display_name": f"{db_user.firstname} {db_user.lastname}"}
        if update.password:
            update_args["password"] = update.password
        auth.update_user(firebase_uid, **update_args)
    except firebase_admin._auth_utils.UserNotFoundError:
        raise HTTPException(status_code=404, detail="Firebase user not found")

    db.commit()
    db.refresh(db_user)
    return {"message": "User updated successfully"}


@router.delete("/users/{user_id}", response_model=dict, tags=["Users"])
def delete_user(user_id: int, user=Depends(firebase_token_dependency), db: Session = Depends(get_db)):
    """Deletes a user from Firebase and PostgreSQL."""
    db_user = db.query(User).filter(User.id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")

    if db_user.firebase_uid != user["uid"]:
        raise HTTPException(status_code=403, detail="Not authorized to delete this user")

    try:
        auth.delete_user(db_user.firebase_uid)
        db.delete(db_user)
        db.commit()
        return {"message": "User deleted successfully"}
    except firebase_admin._auth_utils.UserNotFoundError:
        raise HTTPException(status_code=404, detail="Firebase user not found")
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error deleting user: {str(e)}")


# ---------------------- PASSWORD RESET ----------------------

@router.post("/forgot-password", tags=["Auth"])
async def forgot_password(request: ForgotPasswordRequest):
    """Step 1: Sends a 6-digit code to the user's email (if it exists)."""
    return await initiate_reset(request.email)


@router.post("/verify-code", tags=["Auth"])
def verify_code(request: VerifyCodeRequest):
    """Step 2: Verifies the 6-digit code entered by the user."""
    result = check_code(request.email, request.code)
    if not result["valid"]:
        raise HTTPException(status_code=400, detail="Invalid or expired code")
    return {"message": "Code verified"}


@router.post("/reset-password", tags=["Auth"])
def reset_password_endpoint(request: ResetPasswordRequest):
    """Step 3: Resets the user's password if the code is valid."""
    result = reset_password(request.email, request.code, request.new_password)
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["detail"])
    return {"message": result["message"]}


# ---------------------- HEALTH ----------------------

@router.get("/", tags=["Health"])
def health_check():
    """Simple health check endpoint."""
    return {"status": "API is running", "message": "User Management API"}

# ---------------------- TEST: UNLOCK STATUS ----------------------

# from app.services.user_service import get_unlock_status, set_unlock_status

# @router.get("/test/unlock-status/{user_id}", tags=["Test"])
# def test_unlock_status(user_id: int, db: Session = Depends(get_db)):
#     """
#     Temporary test route to verify the unlock status logic works correctly.
#     DO NOT use in production.
#     """
#     before = get_unlock_status(db, user_id)
#     set_unlock_status(db, user_id, True)
#     after = get_unlock_status(db, user_id)

#     return {
#         "status_before": before,
#         "status_after": after
#     }

# @router.get("/users/{user_id}/unlock-status")
# def get_unlock_status_route(user_id: int, db: Session = Depends(get_db)):
#     user = db.query(User).filter(User.id == user_id).first()

#     if not user:
#         return {"success": False, "unlock": False}

#     return {
#         "success": True,
#         "unlock": bool(user.is_career_unlock_confirmed)
#     }
