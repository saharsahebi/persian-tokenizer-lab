[CmdletBinding()]
param([string]$PythonPath)

$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$BackendDirectory = Join-Path $ProjectRoot 'backend'
$FrontendDirectory = Join-Path $ProjectRoot 'frontend'
$EnvironmentPython = Join-Path $BackendDirectory '.venv/Scripts/python.exe'

function Invoke-Checked {
    param([string]$Executable, [string[]]$Arguments)
    & $Executable @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Command failed with exit code ${LASTEXITCODE}: $Executable"
    }
}

function Test-ProjectPython {
    param([string]$Executable, [string[]]$PrefixArguments = @())
    try {
        & $Executable @PrefixArguments -c 'import sys; raise SystemExit(0 if (3,12) <= sys.version_info[:2] < (3,14) else 1)' 2>$null
        return $LASTEXITCODE -eq 0
    } catch { return $false }
}

function Find-ProjectPython {
    if ($PythonPath) {
        if (-not (Test-Path -LiteralPath $PythonPath -PathType Leaf)) {
            throw "Python executable not found: $PythonPath"
        }
        if (-not (Test-ProjectPython -Executable $PythonPath)) {
            throw 'This project requires Python 3.12 or 3.13.'
        }
        return @{ Executable = $PythonPath; Prefix = @() }
    }

    $Launcher = Get-Command 'py.exe' -ErrorAction SilentlyContinue
    if ($Launcher) {
        foreach ($Version in @('-3.12', '-3.13')) {
            if (Test-ProjectPython -Executable $Launcher.Source -PrefixArguments @($Version)) {
                return @{ Executable = $Launcher.Source; Prefix = @($Version) }
            }
        }
    }

    foreach ($Name in @('python.exe', 'python3.exe')) {
        $Candidate = Get-Command $Name -ErrorAction SilentlyContinue
        if ($Candidate -and $Candidate.Source -notlike '*WindowsApps*' -and (Test-ProjectPython -Executable $Candidate.Source)) {
            return @{ Executable = $Candidate.Source; Prefix = @() }
        }
    }

    throw 'Python 3.12 or 3.13 was not found. Install Python from python.org, or pass -PythonPath C:/path/to/python.exe.'
}

$Npm = Get-Command 'npm.cmd' -ErrorAction SilentlyContinue
if (-not $Npm) { throw 'npm was not found. Install a supported Node.js LTS release first.' }

if (-not (Test-Path -LiteralPath $EnvironmentPython -PathType Leaf)) {
    $Python = Find-ProjectPython
    Write-Host 'Creating the project-local Python environment...'
    Invoke-Checked -Executable $Python.Executable -Arguments ($Python.Prefix + @('-m', 'venv', (Join-Path $BackendDirectory '.venv')))
}

Push-Location $BackendDirectory
try {
    Write-Host 'Installing the backend and test dependencies...'
    Invoke-Checked -Executable $EnvironmentPython -Arguments @('-m', 'pip', 'install', '-c', 'requirements-dev.lock.txt', '-e', '.[dev]')
} finally { Pop-Location }

Push-Location $FrontendDirectory
try {
    Write-Host 'Installing frontend dependencies from package-lock.json...'
    Invoke-Checked -Executable $Npm.Source -Arguments @('ci')
} finally { Pop-Location }

Write-Host 'Setup complete. Run npm start from the project folder, or double-click Start-TokenNama.cmd.'
