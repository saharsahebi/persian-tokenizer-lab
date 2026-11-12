[CmdletBinding()]
param([switch]$NoBrowser)

$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$Node = Get-Command 'node.exe' -ErrorAction SilentlyContinue
if (-not $Node) { throw 'Node.js was not found. Install Node.js LTS and run scripts/setup.ps1.' }

Push-Location $ProjectRoot
try {
    $Arguments = @((Join-Path $PSScriptRoot 'dev.mjs'))
    if (-not $NoBrowser) { $Arguments += '--open' }
    & $Node.Source @Arguments
    if ($LASTEXITCODE -ne 0) { throw "TokenNama stopped with exit code $LASTEXITCODE." }
} finally { Pop-Location }
