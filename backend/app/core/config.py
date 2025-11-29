import os
from dotenv import load_dotenv
from pydantic_settings import BaseSettings

load_dotenv()

# def _env_bool(name: str, default: bool = False) -> bool:
#     value = os.getenv(name)
#     if value is None:
#         return default
#     return value.strip().lower() in {"1", "true", "yes", "on"}


DB_NAME = os.getenv("DB_NAME")
DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD")
DB_HOST = os.getenv("DB_HOST")
DB_PORT = os.getenv("DB_PORT")

FEATURE_ONET = os.getenv("FEATURE_ONET", "true").lower() == "true"
FEATURE_ADZUNA = os.getenv("FEATURE_ADZUNA", "true").lower() == "true"
# FEATURE_BLS = os.getenv("FEATURE_BLS", "true").lower() == "true"

ONET_USER = os.getenv("ONET_USER", "")
ONET_API_KEY = os.getenv("ONET_API_KEY", "")
# BLS_API_KEY = os.getenv("BLS_API_KEY", "")
ADZUNA_APP_ID = os.getenv("ADZUNA_APP_ID", "")
ADZUNA_APP_KEY = os.getenv("ADZUNA_APP_KEY", "")
ADZUNA_COUNTRY = os.getenv("ADZUNA_COUNTRY", "US")

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
    "private_key": os.getenv("FIREBASE_PRIVATE_KEY").replace('\\n', '\n'),
    "client_email": os.getenv("FIREBASE_CLIENT_EMAIL"),
    "client_id": os.getenv("FIREBASE_CLIENT_ID"),
    "auth_uri": os.getenv("FIREBASE_AUTH_URI"),
    "token_uri": os.getenv("FIREBASE_TOKEN_URI"),
    "auth_provider_x509_cert_url": os.getenv("FIREBASE_AUTH_PROVIDER_X509_CERT_URL"),
    "client_x509_cert_url": os.getenv("FIREBASE_CLIENT_X509_CERT_URL"),
    "universe_domain": os.getenv("FIREBASE_UNIVERSE_DOMAIN"),
}

# ✅ AI Coach Settings
class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
    
    # Azure AI Configuration
    AZURE_FOUNDRY_API_KEY: str = os.getenv("AZURE_FOUNDRY_API_KEY", "")
    AZURE_FOUNDRY_ENDPOINT: str = os.getenv("AZURE_FOUNDRY_ENDPOINT", "")
    AZURE_CHAT_DEPLOYMENT: str = os.getenv("AZURE_CHAT_DEPLOYMENT", "gpt-4o")
    AZURE_EMBEDDINGS_DEPLOYMENT: str = os.getenv("AZURE_EMBEDDINGS_DEPLOYMENT", "text-embedding-3-large")
    AZURE_TTS_DEPLOYMENT: str = os.getenv("AZURE_TTS_DEPLOYMENT", "gpt-4o-mini-tts")
    AZURE_TTS_VOICE: str = os.getenv("AZURE_TTS_VOICE", "alloy")
    
    # Pinecone Configuration
    PINECONE_API_KEY: str = os.getenv("PINECONE_API_KEY", "")
    INDEX_NAME: str = os.getenv("INDEX_NAME", "trunorth-index")
    PINECONE_INDEX_NAME: str = os.getenv("INDEX_NAME", "trunorth-index")
    
    # AI Model Configuration
    MAX_TOKENS: int = int(os.getenv("MAX_TOKENS", "1200"))
    TEMPERATURE: float = float(os.getenv("TEMPERATURE", "0.7"))
    
    # File Paths
    BASE_DIR: str = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    LOG_DIR: str = os.path.join(BASE_DIR, "app", "data", "outputs")
    CSV_PATH: str = os.path.join(BASE_DIR, "app", "data", "job_skills.csv")
    
    class Config:
        case_sensitive = True

settings = Settings()

# Ensure log directory exists
os.makedirs(settings.LOG_DIR, exist_ok=True)