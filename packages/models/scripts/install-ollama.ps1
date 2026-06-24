# Ollama Installation Script for Windows
# Run: powershell -ExecutionPolicy Bypass -File install-ollama.ps1

Write-Host "🦙 Ollama Installation for Windows" -ForegroundColor Cyan
Write-Host ""

# Check if Ollama is already installed
$ollamaPath = "$env:LOCALAPPDATA\Programs\Ollama\ollama.exe"
if (Test-Path $ollamaPath) {
    Write-Host "✅ Ollama is already installed at: $ollamaPath" -ForegroundColor Green
    try {
        $version = & $ollamaPath --version 2>$null
        Write-Host "   Version: $version" -ForegroundColor Green
    } catch {}
    exit 0
}

# Create temp directory
$tempDir = Join-Path $env:TEMP "ollama-install"
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null

# Download Ollama
$ollamaUrl = "https://ollama.com/download/Ollama%20Setup%20Latest.exe"
$installerPath = Join-Path $tempDir "Ollama-Setup.exe"

Write-Host "📥 Downloading Ollama installer..." -ForegroundColor Yellow
Write-Host "   Source: $ollamaUrl"
Write-Host "   Target: $installerPath"

try {
    Invoke-WebRequest -Uri $ollamaUrl -OutFile $installerPath -UseBasicParsing
    Write-Host "✅ Download complete" -ForegroundColor Green
}
catch {
    Write-Host "❌ Download failed: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please download manually from: https://ollama.com/download" -ForegroundColor Yellow
    exit 1
}

# Install Ollama
Write-Host ""
Write-Host "🚀 Installing Ollama..." -ForegroundColor Yellow
Write-Host "   Running installer (may require admin privileges)"
Write-Host ""

try {
    Start-Process -FilePath $installerPath -Wait
    Write-Host "✅ Installation complete" -ForegroundColor Green
}
catch {
    Write-Host "❌ Installation failed: $_" -ForegroundColor Red
    exit 1
}

# Cleanup
Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue

# Verify installation
Write-Host ""
Write-Host "🔍 Verifying installation..." -ForegroundColor Yellow

Start-Sleep -Seconds 2

if (Test-Path $ollamaPath) {
    Write-Host "✅ Ollama installed successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Cyan
    Write-Host "  1. Start Ollama server: ollama serve"
    Write-Host "  2. Pull embedding model: ollama pull qwen3-embedding-4b"
    Write-Host "  3. Test: ollama run qwen3-embedding-4b 'test'"
} else {
    Write-Host "⚠️  Ollama may not be in PATH yet. Restart your terminal and try again." -ForegroundColor Yellow
}
