from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# ✅ Import your routers
from app.api.routes.user_routes import router as user_router
from app.api.routes.questionnaire_routes import router as questionnaire_router  # ← add this line

from app.core.database import setup_database

app = FastAPI(
    title="TruNorth",
    description="AI Powered Coaching & Guidance",
    version="1.0.0"
)

# ✅ Enable CORS so frontend (Vercel + local dev) can talk to backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://tru-north-kappa.vercel.app",  # deployed frontend
        "https://trunorth.onrender.com",       # ✅ backend domain (Render)
        "http://127.0.0.1:5173",               # local dev server
        "http://localhost:5173"                # alternate local dev URL
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ✅ Include all routes
app.include_router(user_router)
app.include_router(questionnaire_router)  # ← add this line

@app.on_event("startup")
def startup_event():
    setup_database()
