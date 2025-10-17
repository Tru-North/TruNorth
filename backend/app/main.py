from typing import Dict

from fastapi import FastAPI

app = FastAPI()

@app.get("/api/health")
def health() -> Dict[str, str]:
    """Health-check endpoint."""
    return {"status": "ok"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
