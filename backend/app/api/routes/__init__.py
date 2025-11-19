from fastapi import APIRouter
from app.api.routes import final_data_routes  # import our new route
from app.api.routes import recommendation_routes
from .journey_routes import router as journey_router

router = APIRouter()

router.include_router(final_data_routes.router)
router.include_router(recommendation_routes.router)
