# fix-path-env.ps1

param(
  [switch]$User    = $true,   # met à jour PATH Utilisateur
  [switch]$Machine = $false   # met à jour PATH Machine (admin requis)
)

function Normalize-Paths([string[]]$parts) {
  $set = New-Object 'System.Collections.Generic.HashSet[string]' ([System.StringComparer]::OrdinalIgnoreCase)
  $out = New-Object System.Collections.Generic.List[string]
  foreach($p in $parts) {
    if ($null -eq $p) { continue }
    $x = $p.Trim().Trim('"').TrimEnd('\')
    if ([string]::IsNullOrWhiteSpace($x)) { continue }
    # filtre basique: doit ressembler à "C:\..."
    if ($x.Length -lt 3 -or ($x -notmatch '^[A-Za-z]:\\')) { continue }
    if ($set.Add($x)) { [void]$out.Add($x) }
  }
  return ,$out.ToArray()
}

# Dossiers Windows essentiels
$essential = @(
  'C:\Windows\System32',
  'C:\Windows',
  'C:\Windows\System32\Wbem',
  'C:\Windows\System32\WindowsPowerShell\v1.0',
  'C:\Windows\System32\OpenSSH'
)

# Détecter binaires utiles (si présents)
$bins = @()

# Ghostscript: gswin64c.exe
$gsExe = Get-ChildItem 'C:\Program Files\gs' -Recurse -Filter gswin64c.exe -ErrorAction SilentlyContinue |
         Sort-Object LastWriteTime -Desc | Select-Object -First 1 -ExpandProperty FullName
if ($gsExe) { $bins += (Split-Path $gsExe) }

# qpdf: qpdf.exe
$qpdfExe = Get-ChildItem 'C:\Program Files' -Recurse -Filter qpdf.exe -ErrorAction SilentlyContinue |
           Select-Object -First 1 -ExpandProperty FullName
if ($qpdfExe) { $bins += (Split-Path $qpdfExe) }

# Tesseract
if (Test-Path 'C:\Program Files\Tesseract-OCR\tesseract.exe') {
  $bins += 'C:\Program Files\Tesseract-OCR'
}

$additions = ($essential + $bins) | Select-Object -Unique

# Sauvegardes
$stamp     = Get-Date -Format 'yyyyMMdd-HHmmss'
$bkUser    = Join-Path $PSScriptRoot ("PATH-User-{0}.txt" -f $stamp)
$bkMachine = Join-Path $PSScriptRoot ("PATH-Machine-{0}.txt" -f $stamp)

$oldUser    = [Environment]::GetEnvironmentVariable('Path','User');    if ($null -eq $oldUser)    { $oldUser = '' }
$oldMachine = [Environment]::GetEnvironmentVariable('Path','Machine'); if ($null -eq $oldMachine) { $oldMachine = '' }

[IO.File]::WriteAllText($bkUser,    $oldUser)
[IO.File]::WriteAllText($bkMachine, $oldMachine)

# Mise à jour PATH Utilisateur
if ($User) {
  $userParts = @()
  if ($oldUser) { $userParts = $oldUser.Split(';',[System.StringSplitOptions]::RemoveEmptyEntries) }
  $newUser = Normalize-Paths($userParts + $additions)
  [Environment]::SetEnvironmentVariable('Path', ($newUser -join ';'), 'User')
}

# Mise à jour PATH Machine (admin requis)
if ($Machine) {
  $principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
  if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Error 'L’option -Machine nécessite PowerShell lancé en administrateur.'
    exit 1
  }
  $machParts = @()
  if ($oldMachine) { $machParts = $oldMachine.Split(';',[System.StringSplitOptions]::RemoveEmptyEntries) }
  $newMachine = Normalize-Paths($machParts + $additions)
  [Environment]::SetEnvironmentVariable('Path', ($newMachine -join ';'), 'Machine')
}

# Mettre à jour la session courante
$cur = $env:Path; if ($null -eq $cur) { $cur = '' }
$curParts = @()
if ($cur) { $curParts = $cur.Split(';',[System.StringSplitOptions]::RemoveEmptyEntries) }
$env:Path = (Normalize-Paths($curParts + $additions) -join ';')

# Vérifications
$gsCmd   = Get-Command gswin64c  -ErrorAction SilentlyContinue
$qpdfCmd = Get-Command qpdf      -ErrorAction SilentlyContinue
$tessCmd = Get-Command tesseract -ErrorAction SilentlyContinue

"Ghostscript : {0}" -f ($(if ($gsCmd)   { $gsCmd.Path } else { '<absent>' }))
"qpdf        : {0}" -f ($(if ($qpdfCmd) { $qpdfCmd.Path } else { '<absent>' }))
"Tesseract   : {0}" -f ($(if ($tessCmd) { $tessCmd.Path } else { '<absent>' }))
"PATH User   : sauvegarde → $bkUser"
"PATH Machine: sauvegarde → $bkMachine"
"Session PATH mise à jour."
