#####################
###### main.py ######
#####################

from app.api.routes.user_routes import router as user_router
from app.models.user import setup_database
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="TruNorth",
    description="AI Powered Coaching & Guidance",
    version="1.0.0"
)

# ✅ Enable CORS so frontend (Vite) can talk to backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5173",  # Vite dev server
        "http://localhost:5173"   # alternate local dev URL
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routes
app.include_router(user_router)

@app.on_event("startup")
def startup_event():
    setup_database()
