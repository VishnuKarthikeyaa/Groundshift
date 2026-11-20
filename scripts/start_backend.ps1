# GROUNDSHIFT Backend Startup Script (PowerShell)
$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

$pythonExe = "C:\Users\jeyak\miniforge3\envs\groundshift\python.exe"
$env:PYTHONPATH = $repoRoot

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "Starting GROUNDSHIFT FastAPI Backend Server on port 8000..." -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

& $pythonExe -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload

