# TruNorth (Phase 1)
Monorepo with React+Vite (frontend) and FastAPI (backend).
- Frontend dev: npm run dev (Vite)
- Backend dev: uvicorn app.main:app --reload
Health checks:
- Frontend: landing page "TruNorth is Live!"
- Backend: GET /api/health -> {"status":"ok"}
