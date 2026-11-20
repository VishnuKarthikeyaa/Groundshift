@echo off
cd /d "%~dp0\.."
set PYTHONPATH=%CD%
echo ==========================================================
echo Starting GROUNDSHIFT FastAPI Backend Server on port 8000...
echo ==========================================================
C:\Users\jeyak\miniforge3\envs\groundshift\python.exe -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
pause

