# GROUNDSHIFT Frontend Startup Script (PowerShell)
$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location "$repoRoot\frontend"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "Starting GROUNDSHIFT React + Vite Dashboard on port 5173..." -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

npm run dev -- --host 127.0.0.1 --port 5173

