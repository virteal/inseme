[CmdletBinding()]
param(
  [string]$WorkspaceRoot = (Split-Path -Parent $PSScriptRoot)
)

$ErrorActionPreference = "Stop"

if (-not ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
    [Security.Principal.WindowsBuiltInRole]::Administrator
  )) {
  throw "Run this script from an elevated PowerShell session."
}

$workspace = [IO.Path]::GetFullPath($WorkspaceRoot)
$pnpmRoot = Join-Path $workspace "node_modules\.pnpm"
if (-not (Test-Path -LiteralPath $pnpmRoot -PathType Container)) {
  throw "PNPM store directory not found: $pnpmRoot"
}

$candidates = @(
  Get-ChildItem -LiteralPath $pnpmRoot -Directory -Filter "openai@*" |
    ForEach-Object {
      $packageDirectory = Join-Path $_.FullName "node_modules\openai"
      if (Test-Path -LiteralPath (Join-Path $packageDirectory "index.js") -PathType Leaf) { $packageDirectory }
    }
)
if ($candidates.Count -eq 0) {
  throw "No installed OpenAI package was found. Refusing to change permissions."
}

$pnpmPrefix = $pnpmRoot.TrimEnd('\') + '\'
$principal = [Security.Principal.WindowsIdentity]::GetCurrent().Name
$takeownYes = if ((Get-Culture).TwoLetterISOLanguageName -eq "fr") { "O" } else { "Y" }
foreach ($candidate in $candidates) {
  $target = [IO.Path]::GetFullPath($candidate)
  if (-not $target.StartsWith($pnpmPrefix, [StringComparison]::OrdinalIgnoreCase)) {
    throw "Resolved target escapes the PNPM store: $target"
  }
  Write-Host "Repairing permissions only for: $target"
  & takeown.exe /F $target /R /D $takeownYes
  if ($LASTEXITCODE -ne 0) { throw "takeown failed with exit code $LASTEXITCODE" }
  & icacls.exe $target /inheritance:e /grant:r "${principal}:(OI)(CI)F" /T /C
  if ($LASTEXITCODE -ne 0) { throw "icacls failed with exit code $LASTEXITCODE" }
}

Push-Location (Join-Path $workspace "apps\platform")
try {
  node --input-type=module -e "import OpenAI from 'openai'; if (typeof OpenAI !== 'function') process.exit(1); console.log('OpenAI import verified.');"
  if ($LASTEXITCODE -ne 0) { throw "OpenAI import is still unavailable after permission repair." }
} finally {
  Pop-Location
}
