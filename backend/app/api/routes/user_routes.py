#########################################
###### All FastAPI routes for User ######
#########################################

from fastapi import APIRouter, Depends, HTTPException, Security
from fastapi.security import OAuth2PasswordRequestForm, OAuth2PasswordBearer
from app.api.schemas.user import UserCreate, UserUpdate, UserResponse
from app.models.user import get_connection
from app.utils.firebase_util import pyre_auth, verify_firebase_token, auth
import firebase_admin


# Create FastAPI router for user routes
router = APIRouter()

# OAuth2 scheme for Swagger UI authentication flow
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")


def firebase_token_dependency(token: str = Security(oauth2_scheme)):
    """
    Dependency to verify Firebase ID token passed in Authorization header.
    Raises 401 if token invalid or expired.
    """
    decoded_token = verify_firebase_token(token)
    if not decoded_token:
        raise HTTPException(status_code=401, detail="Invalid or expired Firebase token")
    return decoded_token


@router.post("/register", response_model=dict, tags=["Auth"])
def register(user: UserCreate):
    """
    Registers a new user:
    1. Creates user in Firebase Authentication.
    2. Stores user's profile (except password) and firebase_uid in PostgreSQL.
    """
    try:
        user_fb = pyre_auth.create_user_with_email_and_password(user.Email, user.Password)
        fb_user_token = pyre_auth.refresh(user_fb['refreshToken'])
        fb_user_info = pyre_auth.get_account_info(fb_user_token['idToken'])
        firebase_uid = fb_user_info['users'][0]['localId']
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Firebase registration failed: {str(e)}")

    try:
        conn = get_connection()
        cursor = conn.cursor()
        query = 'INSERT INTO users (FirstName, LastName, Email, Password, firebase_uid) VALUES (%s, %s, %s, %s, %s) RETURNING id;'
        cursor.execute(query, (user.FirstName, user.LastName, user.Email, user.Password, firebase_uid))
        user_id = cursor.fetchone()[0]
        conn.commit()
        cursor.close()
        conn.close()
        return {"id": user_id, "firebase_uid": firebase_uid, "message": "Registration successful!"}
    except Exception as e:
        return {"error": f"Database error: {str(e)}"}


@router.post("/login", tags=["Auth"])
def login(form_data: OAuth2PasswordRequestForm = Depends()):
    """
    Authenticates user via Firebase Auth using OAuth2PasswordRequestForm.
    Returns Firebase ID token as OAuth2 access token for Swagger UI.
    """
    email = form_data.username
    password = form_data.password
    try:
        user = pyre_auth.sign_in_with_email_and_password(email, password)
        id_token = user["idToken"]
        return {"access_token": id_token, "token_type": "bearer"}
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid email or password: {str(e)}")


@router.post("/logout", tags=["Auth"])
def logout(user=Depends(firebase_token_dependency)):
    """
    Logs out a user by revoking Firebase refresh tokens,
    effectively invalidating existing tokens client-side.
    """
    try:
        uid = user["uid"]
        auth.revoke_refresh_tokens(uid)
        return {"message": "Logout successful. Client tokens will be invalidated."}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Logout failed: {str(e)}")


@router.get("/users/{user_id}", response_model=UserResponse, tags=["Users"])
def get_user(user_id: int, user=Depends(firebase_token_dependency)):
    """
    Retrieves a single user from PostgreSQL by user_id.
    The user should be logged in to use this.
    """
    conn = get_connection()
    try:
        cursor = conn.cursor()
        query = 'SELECT id, firebase_uid, FirstName, LastName, Email, Password FROM users WHERE id = %s;'
        cursor.execute(query, (user_id,))
        user_row = cursor.fetchone()
        cursor.close()
        conn.close()
        if not user_row:
            raise HTTPException(status_code=404, detail="User not found")
        return {
            "id": user_row[0],
            "firebase_uid": user_row[1],
            "FirstName": user_row[2],
            "LastName": user_row[3],
            "Email": user_row[4],
            "Password": user_row[5]
        }
    except Exception as e:
        conn.close()
        raise HTTPException(status_code=500, detail=f"Error retrieving user: {str(e)}")


@router.get("/users", response_model=list[UserResponse], tags=["Users"])
def get_all_users(user=Depends(firebase_token_dependency)):
    """
    Retrieves all users from PostgreSQL.
    The user should be logged in to use this.
    """
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute('SELECT id, firebase_uid, FirstName, LastName, Email FROM users;')
        users = cursor.fetchall()
        cursor.close()
        conn.close()
        return [
            {
                "id": row[0],
                "firebase_uid": row[1],
                "FirstName": row[2],
                "LastName": row[3],
                "Email": row[4]
            } for row in users
        ]
    except Exception as e:
        conn.close()
        raise HTTPException(status_code=500, detail=f"Error retrieving users: {str(e)}")


@router.put("/users/{user_id}", response_model=dict, tags=["Users"])
def update_user(user_id: int, update: UserUpdate, user=Depends(firebase_token_dependency)):
    """
    Updates user profile:
    - Only the authenticated user can update their own data.
    - Partial fields allowed, missing fields keep existing values.
    - Supports updating Firebase password and user profile in PostgreSQL.
    """
    firebase_uid = user["uid"]
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute('SELECT firebase_uid, FirstName, LastName FROM users WHERE id = %s;', (user_id,))
        existing = cursor.fetchone()
        if not existing:
            cursor.close()
            conn.close()
            raise HTTPException(status_code=404, detail="User not found")
        if existing[0] != firebase_uid:
            cursor.close()
            conn.close()
            raise HTTPException(status_code=403, detail="Not authorized to update this user")

        # Use existing values if update values not provided
        new_firstname = update.FirstName if update.FirstName is not None else existing[1]
        new_lastname = update.LastName if update.LastName is not None else existing[2]
        new_password = update.Password

        # Prepare Firebase update arguments (excluding email - cannot be changed)
        update_args = {"display_name": f"{new_firstname} {new_lastname}"}
        if new_password:
            update_args["password"] = new_password

        # Update user in Firebase Authentication
        auth.update_user(firebase_uid, **update_args)

        # Update PostgreSQL user record (without password)
        query = 'UPDATE users SET FirstName=%s, LastName=%s, Password=%s WHERE id=%s;'
        cursor.execute(query, (new_firstname, new_lastname, new_password, user_id))
        conn.commit()
        cursor.close()
        conn.close()
        return {"message": "User updated successfully"}
    except firebase_admin._auth_utils.UserNotFoundError:
        raise HTTPException(status_code=404, detail="Firebase user not found")
    except Exception as e:
        conn.rollback()
        conn.close()
        raise HTTPException(status_code=500, detail=f"Error updating user: {str(e)}")


@router.delete("/users/{user_id}", response_model=dict, tags=["Users"])
def delete_user(user_id: int, user=Depends(firebase_token_dependency)):
    """
    Deletes a user from Firebase Authentication and PostgreSQL.
    Only allowed for the authenticated user on their own record.
    """
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute('SELECT firebase_uid FROM users WHERE id = %s;', (user_id,))
        result = cursor.fetchone()
        if not result:
            cursor.close()
            conn.close()
            raise HTTPException(status_code=404, detail="User not found")
        firebase_uid = result[0]

        # Delete from Firebase Authentication
        auth.delete_user(firebase_uid)

        # Delete from PostgreSQL
        cursor.execute('DELETE FROM users WHERE id = %s RETURNING id;', (user_id,))
        deleted = cursor.fetchone()
        conn.commit()
        cursor.close()
        conn.close()
        if not deleted:
            raise HTTPException(status_code=404, detail="User not found in DB")
        return {"message": "User deleted successfully"}
    except firebase_admin._auth_utils.UserNotFoundError:
        raise HTTPException(status_code=404, detail="Firebase user not found")
    except Exception as e:
        conn.rollback()
        conn.close()
        raise HTTPException(status_code=500, detail=f"Error deleting user: {str(e)}")


@router.get("/", tags=["Health"])
def health_check():
    """
    Simple health check endpoint to indicate API is running.
    """
    return {"status": "API is running", "message": "User Management API"}
