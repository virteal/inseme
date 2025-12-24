# fix-ocr-path.ps1  (UTF-8, CRLF)

# Localiser les binaires
$bins = @()

$gsBin = Get-ChildItem "C:\Program Files\gs" -Recurse -Filter gswin64c.exe -EA SilentlyContinue |
         Sort-Object LastWriteTime -Desc | Select-Object -First 1 -ExpandProperty DirectoryName
if ($gsBin) { $bins += $gsBin }

$qpdfBin = Get-ChildItem "C:\Program Files" -Recurse -Filter qpdf.exe -EA SilentlyContinue |
           Select-Object -First 1 -ExpandProperty DirectoryName
if ($qpdfBin) { $bins += $qpdfBin }

$tessRoot = "C:\Program Files\Tesseract-OCR"
if (Test-Path (Join-Path $tessRoot 'tesseract.exe')) { $bins += $tessRoot }

$bins = $bins | Where-Object { $_ } | Select-Object -Unique

# Récupérer PATH utilisateur et session (tolérant au null)
$userPath = [Environment]::GetEnvironmentVariable('Path','User'); if (-not $userPath) { $userPath = '' }
$curPath  = $env:Path; if (-not $curPath) { $curPath = '' }

# Split robuste, sans -split
$userParts = $userPath.Split(';', [System.StringSplitOptions]::RemoveEmptyEntries)
$curParts  = $curPath.Split(';',  [System.StringSplitOptions]::RemoveEmptyEntries)

# Normalisation + déduplication insensible à la casse
function Normalize([string[]]$parts){
  $set = New-Object 'System.Collections.Generic.HashSet[string]' ([System.StringComparer]::OrdinalIgnoreCase)
  $out = New-Object System.Collections.Generic.List[string]
  foreach($p in $parts){
    if ([string]::IsNullOrWhiteSpace($p)) { continue }
    $n = $p.TrimEnd('\')
    if ($set.Add($n)) { [void]$out.Add($n) }
  }
  return ,$out.ToArray()
}

$userNew = Normalize($userParts + $bins)
$curNew  = Normalize($curParts  + $bins)

# Écrire PATH utilisateur et mettre à jour la session courante
[Environment]::SetEnvironmentVariable('Path', ($userNew -join ';'), 'User')
$env:Path = ($curNew -join ';')

# Vérification
$gsCmd   = Get-Command gswin64c  -EA SilentlyContinue
$qpdfCmd = Get-Command qpdf      -EA SilentlyContinue
$tessCmd = Get-Command tesseract -EA SilentlyContinue

"Ghostscript : {0}" -f ($(if ($gsCmd)   { $gsCmd.Path }   else { "<absent>" }))
"qpdf        : {0}" -f ($(if ($qpdfCmd) { $qpdfCmd.Path } else { "<absent>" }))
"Tesseract   : {0}" -f ($(if ($tessCmd) { $tessCmd.Path } else { "<absent>" }))
"PATH (User) mis à jour."
