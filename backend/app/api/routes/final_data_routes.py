# app/api/routes/final_data_routes.py

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.services.final_data_service import save_user_final_data
from app.models.final_data import UserFinalData

router = APIRouter(prefix="/final-data", tags=["Final Data"])

# 🧠 1️⃣ Manually rebuild final JSON for a user
@router.post("/rebuild/{user_id}")
def rebuild_final_data(user_id: int, db: Session = Depends(get_db)):
    try:
        result = save_user_final_data(db, user_id)
        return {"message": "✅ Final data rebuilt successfully", "result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# 🪶 2️⃣ Fetch current stored final JSON
@router.get("/{user_id}")
def get_final_data(user_id: int, db: Session = Depends(get_db)):
    data = db.query(UserFinalData).filter(UserFinalData.user_id == user_id).first()
    if not data:
        raise HTTPException(status_code=404, detail="No final data found for this user")
    return {
        "user_id": user_id,
        "updated_at": data.updated_at,
        "final_json": data.final_json,
    }
