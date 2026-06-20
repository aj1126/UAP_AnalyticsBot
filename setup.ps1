# PowerShell Automated Setup Script for UAP AnalyticsBot
# Checks for Node.js/npm and installs them using winget if missing.

$ErrorActionPreference = "Stop"

Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "🔍 Verifying Node.js and npm installation..." -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan

function Check-Command($cmd) {
    return $null -ne (Get-Command $cmd -ErrorAction SilentlyContinue)
}

# Try refreshing PATH in the session from registry first
function Update-SessionPath {
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
}

# Check if Node is already available
$nodeExists = Check-Command "node"
$npmExists = Check-Command "npm"

if (-not $nodeExists -or -not $npmExists) {
    # Check default installation directory before installing
    $defaultNodePath = "C:\Program Files\nodejs"
    if (Test-Path $defaultNodePath) {
        Write-Host "Found Node.js installed in standard directory '$defaultNodePath' but not in current PATH." -ForegroundColor Yellow
        Write-Host "Adding to current session PATH..." -ForegroundColor Yellow
        $env:Path += ";$defaultNodePath"
        $nodeExists = Check-Command "node"
        $npmExists = Check-Command "npm"
    }
}

if (-not $nodeExists -or -not $npmExists) {
    Write-Host "Node.js or npm is missing." -ForegroundColor Yellow
    Write-Host "Attempting to install Node.js (LTS) via winget..." -ForegroundColor Cyan
    
    # Check if winget is available
    if (-not (Check-Command "winget")) {
        Write-Host "Error: 'winget' (Windows Package Manager) is not available on this system." -ForegroundColor Red
        Write-Host "Please download and install Node.js manually from: https://nodejs.org/" -ForegroundColor Red
        Exit 1
    }
    
    try {
        # Run winget installation for NodeJS LTS
        Write-Host "Installing OpenJS.NodeJS using winget..." -ForegroundColor Cyan
        winget install --id OpenJS.NodeJS -e --source winget --accept-package-agreements --accept-source-agreements
        
        # Refresh paths
        Update-SessionPath
        
        # If still not in path, explicitly add standard path
        $defaultNodePath = "C:\Program Files\nodejs"
        if (Test-Path $defaultNodePath -and $env:Path -notlike "*$defaultNodePath*") {
            $env:Path += ";$defaultNodePath"
        }
        
        Write-Host "Node.js successfully installed." -ForegroundColor Green
    }
    catch {
        Write-Host "Failed to install Node.js automatically via winget: $_" -ForegroundColor Red
        Write-Host "Please install Node.js manually: https://nodejs.org/" -ForegroundColor Red
        Exit 1
    }
} else {
    Write-Host "✅ Node.js and npm are already installed." -ForegroundColor Green
    $nodeVersion = node -v
    $npmVersion = npm -v
    Write-Host "Node.js version: $nodeVersion" -ForegroundColor Gray
    Write-Host "npm version: $npmVersion" -ForegroundColor Gray
}

# Final verification check
if (Check-Command "npm") {
    Write-Host "📦 Installing project dependencies via 'npm install'..." -ForegroundColor Cyan
    npm install
    Write-Host "🎉 Setup completed successfully!" -ForegroundColor Green
} else {
    Write-Host "❌ Error: Could not locate npm even after setup. Please restart your terminal." -ForegroundColor Red
    Exit 1
}
