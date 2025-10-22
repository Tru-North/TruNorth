######################################################################
###### Environment loading, database and Firebase configuration ######
######################################################################

import os
import sys
from dotenv import load_dotenv

load_dotenv()

# --- Debugging block (safe to remove later) ---
print("\n=== DEBUG: ENVIRONMENT VARIABLES LOADED ===", file=sys.stderr)
print("DB_HOST:", os.getenv("DB_HOST"), file=sys.stderr)
print("FIREBASE_PROJECT_ID:", os.getenv("FIREBASE_PROJECT_ID"), file=sys.stderr)

firebase_private_key = os.getenv("FIREBASE_PRIVATE_KEY")

if firebase_private_key is None:
    print("❌ FIREBASE_PRIVATE_KEY is missing or not loaded!", file=sys.stderr)
else:
    print(f"✅ FIREBASE_PRIVATE_KEY found, length = {len(firebase_private_key)} characters", file=sys.stderr)
# --- End debug block ---

DB_NAME = os.getenv("DB_NAME")
DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD")
DB_HOST = os.getenv("DB_HOST")
DB_PORT = os.getenv("DB_PORT")

firebase_config = {
    "apiKey": os.getenv("FIREBASE_API_KEY"),
    "authDomain": os.getenv("FIREBASE_AUTH_DOMAIN"),
    "projectId": os.getenv("FIREBASE_PROJECT_ID"),
    "storageBucket": os.getenv("FIREBASE_STORAGE_BUCKET"),
    "messagingSenderId": os.getenv("FIREBASE_MESSAGING_SENDER_ID"),
    "appId": os.getenv("FIREBASE_APP_ID"),
    "databaseURL": ""
}

FIREBASE_ADMIN_CRED = {
    "type": os.getenv("FIREBASE_TYPE"),
    "project_id": os.getenv("FIREBASE_PROJECT_ID"),
    "private_key_id": os.getenv("FIREBASE_PRIVATE_KEY_ID"),
    # ✅ safer replace (handles None too)
    "private_key": (firebase_private_key or "").replace('\\n', '\n'),
    "client_email": os.getenv("FIREBASE_CLIENT_EMAIL"),
    "client_id": os.getenv("FIREBASE_CLIENT_ID"),
    "auth_uri": os.getenv("FIREBASE_AUTH_URI"),
    "token_uri": os.getenv("FIREBASE_TOKEN_URI"),
    "auth_provider_x509_cert_url": os.getenv("FIREBASE_AUTH_PROVIDER_X509_CERT_URL"),
    "client_x509_cert_url": os.getenv("FIREBASE_CLIENT_X509_CERT_URL"),
    "universe_domain": os.getenv("FIREBASE_UNIVERSE_DOMAIN"),
}
