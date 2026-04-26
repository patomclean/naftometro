$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$ClaudeSkillsDir = Join-Path $env:USERPROFILE ".claude\skills"

Write-Host "Naftometro Skill Toolkit - Setup" -ForegroundColor Cyan
Write-Host "===================================="  -ForegroundColor Cyan
Write-Host ""

try {
    $pyVersion = python --version 2>&1
    Write-Host "[OK] Python encontrado: $pyVersion" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Python no encontrado. Instalalo desde python.org" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Instalando dependencias (pyyaml)..."
$reqPath = Join-Path $ScriptDir "requirements.txt"
python -m pip install --user -q -r $reqPath
Write-Host "[OK] Dependencias instaladas" -ForegroundColor Green

Write-Host ""
$msg = "Instalando skills en " + $ClaudeSkillsDir
Write-Host $msg
New-Item -ItemType Directory -Force -Path $ClaudeSkillsDir | Out-Null

$skills = @("naftometro-conventions", "naftometro-ledger-rules", "naftometro-sql-migrations")

foreach ($skill in $skills) {
    $src = Join-Path $ScriptDir $skill
    $dst = Join-Path $ClaudeSkillsDir $skill
    if (Test-Path $dst) {
        Write-Host "  -> $skill ya existe, sobreescribiendo..."
        Remove-Item -Recurse -Force $dst
    }
    Copy-Item -Recurse $src $dst
    Write-Host "  [OK] $skill" -ForegroundColor Green
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "[OK] Instalacion completa" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""
$finalMsg = "Las skills estan en: " + $ClaudeSkillsDir
Write-Host $finalMsg
Write-Host ""
Write-Host "Reinicia Claude Code para detectar las skills."
