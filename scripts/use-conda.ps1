# Load conda into the current PowerShell session (lazy — not run from profile).
# Usage:
#   . C:\tweesic\inseme\scripts\use-conda.ps1
#   . C:\tweesic\inseme\scripts\use-conda.ps1 -Env inseme
param(
    [string]$EnvName = ""
)

$ErrorActionPreference = 'Stop'

$candidates = @(
    $env:CONDA_EXE
    (Join-Path $env:USERPROFILE 'miniconda3\Scripts\conda.exe')
    (Join-Path $env:USERPROFILE 'anaconda3\Scripts\conda.exe')
    'C:\ProgramData\miniconda3\Scripts\conda.exe'
) | Where-Object { $_ }

$condaExe = $null
foreach ($candidate in $candidates) {
    if ($candidate -eq 'conda') {
        $resolved = Get-Command conda -ErrorAction SilentlyContinue
        if ($resolved) { $condaExe = $resolved.Source; break }
    } elseif (Test-Path $candidate) {
        $condaExe = $candidate
        break
    }
}

if (-not $condaExe) {
    throw 'conda.exe not found — install miniconda or set CONDA_EXE'
}

if (-not (Get-Command conda -ErrorAction SilentlyContinue)) {
    function global:conda {
        & $condaExe @args
    }
}

$hook = (& $condaExe 'shell.powershell' 'hook') | Out-String
if ($hook) {
    Invoke-Expression $hook
}

if ($EnvName) {
    conda activate $EnvName
    Write-Host "[use-conda] activated: $EnvName"
} else {
    Write-Host '[use-conda] shell hook loaded (use: conda activate inseme)'
}