@echo off
echo ========================================================
echo Starting PlanToBOQ Full Stack (Backend + Frontend)
echo ========================================================

start "PlanToBOQ Backend API" cmd /k "cd /d %~dp0backend && .venv\Scripts\activate.bat && python -m uvicorn app.main:app --reload --port 8000"
start "PlanToBOQ Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo Both servers have been launched in separate terminal windows:
echo - Backend API:  http://localhost:8000 (Docs: http://localhost:8000/docs)
echo - Frontend App: http://localhost:5173
echo.
