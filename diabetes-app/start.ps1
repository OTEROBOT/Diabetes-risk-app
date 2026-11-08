# Diabetes Risk Prediction App Launcher
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "   Diabetes Risk Prediction App (ระบบทำนายโรคเบาหวาน)" -ForegroundColor Green
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

if (-not $BackendDir) {
    Write-Host "[ERROR] Could not find backend directory." -ForegroundColor Red
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

Write-Host "[1/3] Python:   $PyCmd" -ForegroundColor Yellow
Write-Host "[2/3] Backend:  $BackendDir" -ForegroundColor Yellow
Write-Host "[3/3] Web App:  http://127.0.0.1:5000" -ForegroundColor Green
Write-Host ""
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "  * Admin Account:" -ForegroundColor White
Write-Host "    Username: admin" -ForegroundColor White
Write-Host "    Password: admin1234" -ForegroundColor White
Write-Host ""
Write-Host "  * Opening browser automatically..." -ForegroundColor White
Write-Host "  * Press Ctrl + C in this window to stop the server." -ForegroundColor Gray
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host ""

Start-Process "http://127.0.0.1:5000"

Set-Location $BackendDir
if ($PyCmd -eq "py -3.10") {
    py -3.10 app.py
} else {
    python app.py
}