#!/bin/bash

# Azure Cloud Deployment Checklist
# Run this script to verify everything is ready for deployment

echo "🚀 Meltimedia Cloud Deployment Checklist"
echo "========================================="
echo ""

# Check Node.js
echo "✓ Checking Node.js..."
if command -v node &> /dev/null; then
    node_version=$(node --version)
    echo "  Node.js: $node_version"
else
    echo "  ✗ Node.js not found! Install from https://nodejs.org/"
fi
echo ""

# Check npm
echo "✓ Checking npm..."
if command -v npm &> /dev/null; then
    npm_version=$(npm --version)
    echo "  npm: $npm_version"
else
    echo "  ✗ npm not found!"
fi
echo ""

# Check files
echo "✓ Checking required files..."
files=(
    "bakend/server.js"
    "frontend/app.js"
    "frontend/index.html"
    "bakend/package.json"
    "frontend/package.json"
    "uploadToCloud.js"
    ".env.example"
    "infra/main.bicep"
    "CLOUD_DEPLOYMENT.md"
    "QUICK_START_CLOUD.md"
)

for file in "${files[@]}"; do
    if [ -f "$file" ]; then
        echo "  ✓ $file"
    else
        echo "  ✗ $file MISSING"
    fi
done
echo ""

# Check assets
echo "✓ Checking multimedia files..."
if [ -d "bakend/assets" ]; then
    videos=$(find bakend/assets/videos -type f | wc -l)
    audio=$(find bakend/assets/audio -type f | wc -l)
    transcripts=$(find bakend/assets/transcripts -type f | wc -l)
    
    echo "  Videos: $videos files"
    echo "  Audio: $audio files"
    echo "  Transcripts: $transcripts files"
else
    echo "  ✗ bakend/assets directory not found!"
fi
echo ""

# Check backend dependencies
echo "✓ Checking backend dependencies..."
if [ -d "bakend/node_modules" ]; then
    echo "  ✓ Node modules installed"
    if grep -q "@azure/storage-blob" bakend/package.json 2>/dev/null; then
        echo "  ✓ @azure/storage-blob available"
    else
        echo "  ⚠ @azure/storage-blob not in dependencies (optional, only needed for upload script)"
    fi
else
    echo "  ⚠ Node modules not installed (run: cd bakend && npm install)"
fi
echo ""

# Check Azure CLI
echo "✓ Checking Azure CLI..."
if command -v az &> /dev/null; then
    az_version=$(az version --output json 2>/dev/null | grep -o '"core": "[^"]*' | cut -d'"' -f4)
    echo "  ✓ Azure CLI installed: $az_version"
    
    # Check if logged in
    current_user=$(az account show --query user.name -o tsv 2>/dev/null || echo "not-logged-in")
    if [ "$current_user" != "not-logged-in" ]; then
        echo "  ✓ Logged in as: $current_user"
    else
        echo "  ⚠ Not logged into Azure (run: az login)"
    fi
else
    echo "  ⚠ Azure CLI not installed"
    echo "    Install: https://learn.microsoft.com/cli/azure/install-azure-cli"
    echo "    Or skip and use Azure Portal instead"
fi
echo ""

# Check .env file
echo "✓ Checking configuration..."
if [ -f ".env" ]; then
    echo "  ✓ .env file exists"
    if grep -q "USE_CLOUD_STORAGE" .env; then
        cloud_storage=$(grep "USE_CLOUD_STORAGE" .env | cut -d'=' -f2)
        echo "    USE_CLOUD_STORAGE=$cloud_storage"
    fi
else
    echo "  ⚠ .env not configured yet (use .env.example as template)"
fi
echo ""

# Summary
echo "========================================="
echo "📋 Deployment Checklist Summary"
echo "========================================="
echo ""
echo "Ready to Deploy? Follow these steps:"
echo ""
echo "1. Install dependencies (if needed):"
echo "   cd bakend && npm install && cd .."
echo ""
echo "2. Create Azure Storage Account:"
echo "   - Use Azure Portal: https://portal.azure.com"
echo "   - Or Azure CLI: az group create --name meltimedia-rg --location eastus"
echo ""
echo "3. Configure .env file:"
echo "   cp .env.example .env"
echo "   # Edit .env with your storage account details"
echo ""
echo "4. Upload files to cloud:"
echo "   npm install @azure/storage-blob  # One-time setup"
echo "   node uploadToCloud.js ACCOUNT_NAME ACCOUNT_KEY"
echo ""
echo "5. Start backend:"
echo "   node bakend/server.js"
echo ""
echo "6. Test in browser:"
echo "   http://localhost:3000"
echo ""
echo "✅ For detailed instructions, see:"
echo "   - QUICK_START_CLOUD.md (fastest way to get started)"
echo "   - CLOUD_DEPLOYMENT.md (comprehensive guide)"
echo "   - CLOUD_SETUP_COMPLETE.md (what was completed)"
echo ""
