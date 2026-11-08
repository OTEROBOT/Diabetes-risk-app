# Diabetes Risk Prediction App - Development Mode Launcher
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "   Diabetes Risk Prediction App (Development Mode)" -ForegroundColor Green
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host ""

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

$BackendPaths = @(
    (Join-Path $ScriptDir "Diabetes risk app\diabetes-app\backend\app.py"),
    (Join-Path $ScriptDir "diabetes-app\backend\app.py"),
    (Join-Path $ScriptDir "backend\app.py")
)

$BackendDir = $null
foreach ($p in $BackendPaths) {
    if (Test-Path $p) {
        $BackendDir = Split-Path -Parent $p
        break
    }
}

$FrontendDir = Join-Path (Split-Path -Parent $BackendDir) "frontend"

if (-not (Test-Path $BackendDir) -or -not (Test-Path $FrontendDir)) {
    Write-Host "[ERROR] Could not find backend or frontend directory." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

$PyCmd = "python"
if (Get-Command "py" -ErrorAction SilentlyContinue) {
    $null = py -3.10 --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        $PyCmd = "py -3.10"
    }
}

Write-Host "[1/3] Backend:  $BackendDir" -ForegroundColor Yellow
Write-Host "[2/3] Frontend: $FrontendDir" -ForegroundColor Yellow
Write-Host "[3/3] Starting Backend (5000) and Frontend (5173)..." -ForegroundColor Green
Write-Host ""
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "  * Admin Account: admin / admin1234" -ForegroundColor White
Write-Host "  * Frontend UI: http://localhost:5173" -ForegroundColor Cyan
Write-Host "  * Backend API: http://127.0.0.1:5000" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host ""

Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$BackendDir'; Write-Host 'Starting Backend API on :5000...'; $PyCmd app.py"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$FrontendDir'; Write-Host 'Starting Vite Frontend on :5173...'; npm run dev"

Start-Sleep -Seconds 2
Start-Process "http://localhost:5173"