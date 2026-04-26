# ============================================================
# Repackage: valida y empaqueta una skill como .skill (Windows)
# ============================================================
# Uso: .\bin\repackage.ps1 <nombre-skill>
# ============================================================

param(
    [Parameter(Mandatory=$true)]
    [string]$SkillName
)

$ErrorActionPreference = "Stop"

$ScriptDir = (Get-Item (Split-Path -Parent $MyInvocation.MyCommand.Definition)).Parent.FullName
$SkillPath = Join-Path $ScriptDir $SkillName
$DistDir = Join-Path $ScriptDir "dist"

if (-not (Test-Path $SkillPath)) {
    Write-Host "❌ No existe la carpeta: $SkillPath" -ForegroundColor Red
    exit 1
}

New-Item -ItemType Directory -Force -Path $DistDir | Out-Null

Set-Location (Join-Path $ScriptDir "tools")

Write-Host "🔍 Validando $SkillName ..." -ForegroundColor Cyan
python -m scripts.quick_validate $SkillPath

Write-Host ""
Write-Host "📦 Empaquetando..." -ForegroundColor Cyan
python -m scripts.package_skill $SkillPath $DistDir

# Reinstalar en %USERPROFILE%\.claude\skills\
$ClaudeSkillsDir = "$env:USERPROFILE\.claude\skills"
if (Test-Path $ClaudeSkillsDir) {
    Write-Host ""
    Write-Host "📂 Re-instalando en $ClaudeSkillsDir ..." -ForegroundColor Cyan
    $dst = Join-Path $ClaudeSkillsDir $SkillName
    if (Test-Path $dst) { Remove-Item -Recurse -Force $dst }
    Copy-Item -Recurse $SkillPath $dst
    Write-Host "✅ Skill actualizada (reiniciá Claude Code)" -ForegroundColor Green
}

Write-Host ""
Write-Host "✅ Listo. .skill generado en $DistDir\$SkillName.skill" -ForegroundColor Green
