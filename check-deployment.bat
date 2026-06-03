@echo off
REM Azure Cloud Deployment Checklist for Windows
REM Run this script to verify everything is ready for deployment

setlocal enabledelayedexpansion

echo.
echo 🚀 Meltimedia Cloud Deployment Checklist
echo =========================================
echo.

REM Check Node.js
echo ✓ Checking Node.js...
where node >nul 2>&1
if errorlevel 1 (
    echo   ✗ Node.js not found! Install from https://nodejs.org/
) else (
    for /f "tokens=*" %%i in ('node --version') do set node_version=%%i
    echo   Node.js: !node_version!
)
echo.

REM Check npm
echo ✓ Checking npm...
where npm >nul 2>&1
if errorlevel 1 (
    echo   ✗ npm not found!
) else (
    for /f "tokens=*" %%i in ('npm --version') do set npm_version=%%i
    echo   npm: !npm_version!
)
echo.

REM Check files
echo ✓ Checking required files...
setlocal enabledelayedexpansion
for %%f in (
    "bakend\server.js"
    "frontend\app.js"
    "frontend\index.html"
    "bakend\package.json"
    "frontend\package.json"
    "uploadToCloud.js"
    ".env.example"
    "infra\main.bicep"
    "CLOUD_DEPLOYMENT.md"
    "QUICK_START_CLOUD.md"
) do (
    if exist %%f (
        echo   ✓ %%f
    ) else (
        echo   ✗ %%f MISSING
    )
)
echo.

REM Check assets
echo ✓ Checking multimedia files...
if exist "bakend\assets" (
    setlocal enabledelayedexpansion
    set "video_count=0"
    set "audio_count=0"
    set "transcript_count=0"
    
    for /r "bakend\assets\videos" %%f in (*) do set /a "video_count+=1"
    for /r "bakend\assets\audio" %%f in (*) do set /a "audio_count+=1"
    for /r "bakend\assets\transcripts" %%f in (*) do set /a "transcript_count+=1"
    
    echo   Videos: !video_count! files
    echo   Audio: !audio_count! files
    echo   Transcripts: !transcript_count! files
) else (
    echo   ✗ bakend\assets directory not found!
)
echo.

REM Check backend dependencies
echo ✓ Checking backend dependencies...
if exist "bakend\node_modules" (
    echo   ✓ Node modules installed
    findstr "@azure/storage-blob" bakend\package.json >nul 2>&1
    if errorlevel 0 (
        echo   ✓ @azure/storage-blob available
    ) else (
        echo   ⚠ @azure/storage-blob not in dependencies (optional, only needed for upload script)
    )
) else (
    echo   ⚠ Node modules not installed (run: cd bakend ^&^& npm install)
)
echo.

REM Check Azure CLI
echo ✓ Checking Azure CLI...
where az >nul 2>&1
if errorlevel 1 (
    echo   ⚠ Azure CLI not installed
    echo     Install: https://learn.microsoft.com/cli/azure/install-azure-cli
    echo     Or skip and use Azure Portal instead
) else (
    echo   ✓ Azure CLI installed
)
echo.

REM Check .env file
echo ✓ Checking configuration...
if exist ".env" (
    echo   ✓ .env file exists
    for /f "tokens=2 delims==" %%a in ('findstr "USE_CLOUD_STORAGE" .env') do (
        echo     USE_CLOUD_STORAGE=%%a
    )
) else (
    echo   ⚠ .env not configured yet (use .env.example as template)
)
echo.

REM Summary
echo =========================================
echo 📋 Deployment Checklist Summary
echo =========================================
echo.
echo Ready to Deploy? Follow these steps:
echo.
echo 1. Install dependencies (if needed):
echo    cd bakend ^&^& npm install ^&^& cd ..
echo.
echo 2. Create Azure Storage Account:
echo    - Use Azure Portal: https://portal.azure.com
echo    - Or Azure CLI: az group create --name meltimedia-rg --location eastus
echo.
echo 3. Configure .env file:
echo    copy .env.example .env
echo    # Edit .env with your storage account details
echo.
echo 4. Upload files to cloud:
echo    npm install @azure/storage-blob
echo    node uploadToCloud.js ACCOUNT_NAME ACCOUNT_KEY
echo.
echo 5. Start backend:
echo    node bakend\server.js
echo.
echo 6. Test in browser:
echo    http://localhost:3000
echo.
echo ✅ For detailed instructions, see:
echo    - QUICK_START_CLOUD.md (fastest way to get started)
echo    - CLOUD_DEPLOYMENT.md (comprehensive guide)
echo    - CLOUD_SETUP_COMPLETE.md (what was completed)
echo.

pause
