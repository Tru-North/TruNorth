import firebase_admin
import pyrebase
from app.core.config import FIREBASE_ADMIN_CRED, firebase_config
from firebase_admin import auth, credentials

firebase = pyrebase.initialize_app(firebase_config)
pyre_auth = firebase.auth()

if not firebase_admin._apps:
    ## Admin creds
    cred = credentials.Certificate(FIREBASE_ADMIN_CRED)
    firebase_admin.initialize_app(cred)

def verify_firebase_token(token):
    try:
        decoded_token = auth.verify_id_token(token)
        return decoded_token
    except Exception:
        return None
