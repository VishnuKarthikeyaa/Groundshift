@echo off
cd /d "%~dp0\..\frontend"
echo ==========================================================
echo Starting GROUNDSHIFT React + Vite Dashboard on port 5173...
echo ==========================================================
npm run dev -- --host 127.0.0.1 --port 5173
pause

