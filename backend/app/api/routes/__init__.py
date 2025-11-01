from fastapi import APIRouter
from app.api.routes import final_data_routes  # import our new route

router = APIRouter()

router.include_router(final_data_routes.router)
