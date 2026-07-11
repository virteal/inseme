# Run a command in a conda env without loading the PowerShell profile hook.
# Used by npm scripts (e.g. packages/models model:pull).
param(
    [Parameter(Mandatory)][string]$EnvName,
    [Parameter(ValueFromRemainingArguments = $true)][string[]]$Command
)

$ErrorActionPreference = 'Stop'
if (-not $Command -or $Command.Count -eq 0) {
    throw 'conda-run.ps1: command required'
}

$condaExe = $env:CONDA_EXE
if (-not $condaExe) { $condaExe = Join-Path $env:USERPROFILE 'miniconda3\Scripts\conda.exe' }
if (-not (Test-Path $condaExe)) { throw "conda.exe not found: $condaExe" }

& $condaExe run -n $EnvName --no-capture-output @Command
exit $LASTEXITCODE