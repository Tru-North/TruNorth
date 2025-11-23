from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.models import APIKey, APIKeyIn, SecuritySchemeType
from fastapi.security import APIKeyHeader

# ✅ Import routers
from app.api.routes.user_routes import router as user_router
from app.api.routes.questionnaire_routes import router as questionnaire_router  
from app.api.routes.ai_coach_routes import router as ai_coach_router  # ✅ Add this
from app.core.database import setup_database
from app.api.routes import router as api_router
from app.api.routes.journey_routes import router as journey_router
from app.api.routes.microstep_routes import router as microstep_router
from app.api.routes.admin_routes import router as admin_router
from app.api.routes.admin_auth_routes import router as admin_auth_router

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

@app.middleware("http")
async def auto_firebase_uid_middleware(request: Request, call_next):
    """
    Automatically extracts and stores Firebase UID from request headers
    If x-firebase-uid is provided, it's stored in request.state for use in routes
    """
    firebase_uid = request.headers.get("x-firebase-uid")
    
    if firebase_uid:
        # Store in request state for access in routes
        request.state.firebase_uid = firebase_uid
    else:
        request.state.firebase_uid = None
    
    response = await call_next(request)
    return response

# Add JWT security scheme for Swagger UI
app.openapi_schema = None

from fastapi.openapi.utils import get_openapi

def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema
    openapi_schema = get_openapi(
        title=app.title,
        version=app.version,
        description=app.description,
        routes=app.routes,
    )
    openapi_schema["components"]["securitySchemes"] = {
        "BearerAuth": {
            "type": "http",
            "scheme": "bearer",
            "bearerFormat": "JWT"
        }
    }
    for path in openapi_schema["paths"].values():
        for method in path.values():
            method.setdefault("security", []).append({"BearerAuth": []})
    app.openapi_schema = openapi_schema
    return app.openapi_schema

app.openapi = custom_openapi

#  all routes
app.include_router(user_router)
app.include_router(questionnaire_router)  
app.include_router(ai_coach_router)  
app.include_router(api_router)
app.include_router(journey_router)
app.include_router(microstep_router)
app.include_router(admin_router)
app.include_router(admin_auth_router)

@app.on_event("startup")
def startup_event():
    setup_database()
