@echo off
echo ========================================================
echo   Starting GeoSync SIH26013 Demonstration Suite
echo ========================================================

cd /d "%~dp0"

:: 1. Start Docker containers (PostGIS + Redis) if Docker is running
echo [1/3] Starting Docker database services (PostGIS 16 + Redis)...
docker compose up -d
if %ERRORLEVEL% NEQ 0 (
    echo [WARNING] Docker engine is not running or failed to start.
    echo GeoSync will automatically use offline SQLite database (geosync_offline.db).
)

:: 2. Seed database and start FastAPI Backend
echo [2/3] Starting GeoSync Backend on http://localhost:8000 ...
start "GeoSync Backend (Port 8000)" cmd /k "cd /d "%~dp0backend" && ..\venv\Scripts\python.exe seed.py && ..\venv\Scripts\python.exe -m uvicorn main:app --reload --host 127.0.0.1 --port 8000"

:: 3. Start Next.js Frontend
echo [3/3] Starting GeoSync Frontend on http://localhost:3000 ...
start "GeoSync Frontend (Port 3000)" cmd /k "cd /d "%~dp0frontend" && npm run dev"

echo Waiting 5 seconds for services to initialize...
timeout /t 5 /nobreak >nul

:: 4. Launch Default Browser to Landing Page
start http://localhost:3000
echo ========================================================
echo   GeoSync is live at http://localhost:3000
echo   FastAPI Swagger Docs: http://localhost:8000/docs
echo ========================================================
pause
