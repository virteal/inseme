$metaDir = "c:\tweesic\survey\meta_esbuild_analysis"

# Ensure meta directory exists
if (-not (Test-Path $metaDir)) {
    New-Item -ItemType Directory -Path $metaDir | Out-Null
}

$edgeFunctionsDir = "c:\tweesic\survey\src\netlify\edge-functions"
$edgeFunctions = Get-ChildItem -Path $edgeFunctionsDir -Filter "*.js" -Recurse

$errorsFound = $false

foreach ($file in $edgeFunctions) {
    $filePath = $file.FullName
    $fileName = $file.Name
    $outputFile = Join-Path $metaDir "$($fileName).esbuild.json"

    Write-Host "Analyzing $fileName..."
    try {
        npx esbuild $filePath `
            --bundle `
            --format=esm `
            --platform=node `
            --external:dotenv `
            --external:postgres `
            --metafile=$outputFile `
            --allow-overwrite `
            --log-level=warning `
            --outfile="$metaDir\$($fileName).bundle.js" # Dummy output to satisfy esbuild

        if ($LASTEXITCODE -ne 0) {
            Write-Error "esbuild failed for $fileName. Check $outputFile for details."
            $errorsFound = $true
        } else {
            Write-Host "Successfully analyzed $fileName."
        }
    } catch {
        Write-Error ("An error occurred during esbuild for {0}: {1}" -f $fileName, $errorMessage)
        $errorsFound = $true
    }
}

if ($errorsFound) {
    Write-Error "One or more edge functions failed esbuild analysis."
    exit 1
} else {
    Write-Host "All edge functions analyzed successfully with esbuild."
    exit 0
}
