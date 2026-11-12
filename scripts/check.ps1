[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$BackendDirectory = Join-Path $ProjectRoot 'backend'
$EnvironmentPython = Join-Path $BackendDirectory '.venv/Scripts/python.exe'
if (-not (Test-Path -LiteralPath $EnvironmentPython -PathType Leaf)) {
    $EnvironmentPython = Join-Path $ProjectRoot '.runtime/python312/python.exe'
}
$Npm = Get-Command 'npm.cmd' -ErrorAction SilentlyContinue
if (-not $Npm -or -not (Test-Path -LiteralPath $EnvironmentPython -PathType Leaf)) {
    throw 'Project dependencies are missing. Run scripts/setup.ps1 first.'
}

Push-Location $BackendDirectory
try {
    & $EnvironmentPython -m pytest
    if ($LASTEXITCODE -ne 0) { throw 'Backend tests failed.' }
} finally { Pop-Location }

Push-Location (Join-Path $ProjectRoot 'frontend')
try {
    & $Npm.Source run build
    if ($LASTEXITCODE -ne 0) { throw 'Frontend type checking or production build failed.' }
} finally { Pop-Location }

Write-Host 'All project checks passed.'
