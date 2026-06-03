# 📚 Meltimedia Cloud Deployment Index

## 🎯 Your Goal
Store all existing files and new uploaded files to the cloud for access by all public users.

## ✅ What's Been Completed

### Backend Updates (Production Ready)
- ✅ `bakend/server.js` - Cloud storage integration with automatic fallback
- ✅ Environment variable configuration system
- ✅ Backward compatible with local storage
- ✅ No breaking changes to API

### Infrastructure as Code
- ✅ `infra/main.bicep` - Azure Bicep template
- ✅ Storage account configuration
- ✅ Public blob containers (videos, audio, transcripts)
- ✅ Security settings (TLS 1.2, blob access enabled)

### Automation & Scripting
- ✅ `uploadToCloud.js` - Batch file upload script
- ✅ Automatic content-type detection
- ✅ Progress reporting
- ✅ Error handling

### Documentation & Guides
- ✅ `CLOUD_READY.md` - Overview and features
- ✅ `QUICK_START_CLOUD.md` - 5-minute quick start
- ✅ `CLOUD_DEPLOYMENT.md` - Complete step-by-step guide
- ✅ `CLOUD_SETUP_COMPLETE.md` - What was completed
- ✅ `check-deployment.bat` - Windows verification script
- ✅ `check-deployment.sh` - Linux/Mac verification script

### Configuration Templates
- ✅ `.env.example` - Environment variable template

## 📋 Step-by-Step Deployment Guide

### Step 1: Verify Prerequisites (2 minutes)
```bash
# Windows
check-deployment.bat

# Linux/Mac
bash check-deployment.sh
```

This will check:
- ✓ Node.js installed
- ✓ npm installed
- ✓ All required files present
- ✓ Multimedia assets exist
- ✓ Azure CLI installed (optional)

### Step 2: Create Azure Resources (5-15 minutes)

**Option A: Using Azure Portal (Easiest for first-time)**
1. Go to https://portal.azure.com
2. Create Resource Group: `meltimedia-rg`
3. Create Storage Account with:
   - Name: `meltimediastorage[randomnumbers]`
   - Performance: Standard
   - Redundancy: Locally-redundant (LRS)
4. Create 3 containers with public blob access:
   - `videos`
   - `audio`
   - `transcripts`
5. Copy Storage account name and Key1

**Option B: Using Azure CLI (Fastest for experienced users)**
```bash
az group create --name meltimedia-rg --location eastus
az deployment group create \
  --name meltimedia-deployment \
  --resource-group meltimedia-rg \
  --template-file infra/main.bicep
```

### Step 3: Configure Backend (3 minutes)

```bash
# Copy template to actual config
cp .env.example .env

# Edit with your values
cat > .env << 'EOF'
USE_CLOUD_STORAGE=true
CLOUD_VIDEOS_URL=https://YOUR_ACCOUNT.blob.core.windows.net/videos/
CLOUD_AUDIO_URL=https://YOUR_ACCOUNT.blob.core.windows.net/audio/
CLOUD_TRANSCRIPTS_URL=https://YOUR_ACCOUNT.blob.core.windows.net/transcripts/
EOF
```

### Step 4: Upload Files (5-10 minutes)

```bash
# Install Azure SDK (one-time)
npm install @azure/storage-blob

# Upload all files
node uploadToCloud.js YOUR_ACCOUNT_NAME YOUR_STORAGE_KEY

# Example:
# node uploadToCloud.js meltimediastorage12345 "DefaultEndpointsProtocol=https;..."
```

Wait for completion. You should see:
```
✓ Uploaded: videos/part1.mp4
✓ Uploaded: audio/part1.mp3
✓ Uploaded: transcripts/part1.json
...
Upload complete!
```

### Step 5: Test Locally (2 minutes)

```bash
# Install backend dependencies if needed
cd bakend
npm install
cd ..

# Start backend
node bakend/server.js

# Open browser
http://localhost:3000
```

Test functionality:
- [ ] Videos load
- [ ] Audio plays
- [ ] Transcripts display
- [ ] Downloads work

### Step 6: Deploy to Azure (Optional - 10-20 minutes)

For global public access, deploy the backend to Azure:

```bash
# Deploy to Azure App Service
az webapp up --name meltimedia-app --resource-group meltimedia-rg --runtime "node|18"

# Or use Docker/Container Apps for more flexibility
# See CLOUD_DEPLOYMENT.md for detailed instructions
```

## 🌐 Accessing Your Content

### Direct URLs (After Upload)
```
https://YOUR_ACCOUNT.blob.core.windows.net/videos/part1.mp4
https://YOUR_ACCOUNT.blob.core.windows.net/audio/part1.mp3
https://YOUR_ACCOUNT.blob.core.windows.net/transcripts/part1.json
```

### Via Your API (Local)
```
http://localhost:3000/api/video?video=part1
http://localhost:3000/api/audio/stream?video=part1
http://localhost:3000/api/transcript?video=part1
```

### Via Your API (After deployment)
```
https://YOUR_APP_NAME.azurewebsites.net/api/video?video=part1
https://YOUR_APP_NAME.azurewebsites.net/api/audio/stream?video=part1
https://YOUR_APP_NAME.azurewebsites.net/api/transcript?video=part1
```

## 💰 Cost Breakdown

| Component | Monthly Cost |
|---|---|
| Storage (50GB) | ~$1.05 |
| Data egress (if needed) | Variable (~$0.09/GB) |
| No charge for uploads | $0 |
| App Service (optional) | $7-50+ |
| **Total (typical)** | **~$1-5/month** |

**Free Tier Benefits:**
- 5GB free storage for 12 months
- Perfect for getting started
- No credit card charges

## 🔄 How It Works

When `USE_CLOUD_STORAGE=true` in your `.env`:

```
User Request
    ↓
Backend (/api/video?video=part1)
    ↓
Check USE_CLOUD_STORAGE
    ↓
Redirect to: https://YOUR_ACCOUNT.blob.core.windows.net/videos/part1.mp4
    ↓
Browser receives file directly from Azure
    ↓
User can download/stream
```

When `USE_CLOUD_STORAGE=false` (or `.env` missing):
```
User Request
    ↓
Backend (/api/video?video=part1)
    ↓
Serve from: bakend/assets/videos/part1.mp4
    ↓
Browser receives file
    ↓
User can download/stream
```

## 📚 Documentation Files

Read these in order:

1. **CLOUD_READY.md** (You Are Here)
   - Overview of what's been completed
   - Architecture diagram
   - Cost estimates

2. **QUICK_START_CLOUD.md**
   - Fast track to deployment
   - Multiple option paths
   - Troubleshooting

3. **CLOUD_DEPLOYMENT.md**
   - Comprehensive step-by-step
   - Detailed command explanations
   - Azure CLI reference
   - Security best practices

4. **CLOUD_SETUP_COMPLETE.md**
   - Technical details of changes
   - Architecture diagrams
   - Next steps and roadmap

## ⚙️ Configuration Options

### Environment Variables (.env)

```ini
# Enable cloud storage (true/false)
USE_CLOUD_STORAGE=true

# Azure Blob Storage URLs
CLOUD_VIDEOS_URL=https://ACCOUNT.blob.core.windows.net/videos/
CLOUD_AUDIO_URL=https://ACCOUNT.blob.core.windows.net/audio/
CLOUD_TRANSCRIPTS_URL=https://ACCOUNT.blob.core.windows.net/transcripts/

# Optional: Backend configuration
PORT=3000
NODE_ENV=production

# Optional: Admin credentials
ADMIN_USER=admin
ADMIN_PASS=admin
COOKIE_SECRET=your-secret-key
```

## 🔒 Security Notes

### Public Access (Current)
- All files are publicly accessible without authentication
- Good for: Free public learning platform
- Use CDN to serve globally

### Add Authentication (Future)
- Protect upload endpoints
- Require login for certain content
- Track usage analytics

### Best Practices Applied
- TLS 1.2 minimum for all connections
- Storage accounts configured to require HTTPS
- Containers set to public blob-level access (not container-level)

## 🐛 Troubleshooting

### "Cannot upload files"
```bash
# Verify credentials
echo $AZURE_STORAGE_ACCOUNT_NAME
echo $AZURE_STORAGE_ACCOUNT_KEY

# Test connection
az storage container list \
  --account-name $AZURE_STORAGE_ACCOUNT_NAME \
  --account-key $AZURE_STORAGE_ACCOUNT_KEY
```

### "Files not accessible"
```bash
# Check containers are public
az storage container list \
  --account-name $ACCOUNT_NAME \
  --query "[].{name:name, publicAccess:properties.publicAccess}"

# Verify files uploaded
az storage blob list \
  --container-name videos \
  --account-name $ACCOUNT_NAME
```

### "Still using local files"
```bash
# Verify .env exists and is correct
cat .env | grep USE_CLOUD_STORAGE

# Restart backend
# Press Ctrl+C and run again:
node bakend/server.js
```

## ✅ Validation Checklist

Before considering deployment complete:

- [ ] Prerequisites verified (Node.js, npm, files)
- [ ] Azure Storage Account created
- [ ] 3 containers created and set to public
- [ ] .env file configured with storage URLs
- [ ] Files uploaded via uploadToCloud.js
- [ ] Local test successful (http://localhost:3000)
- [ ] Files accessible via direct URLs
- [ ] All API endpoints responding with 200 OK
- [ ] Downloads working correctly

## 🚀 Next Milestones

### Phase 1: Initial Deployment (This Week)
- [ ] Files in Azure Blob Storage
- [ ] Backend serving from cloud
- [ ] Local testing complete

### Phase 2: Global Access (This Month)
- [ ] Backend deployed to Azure App Service
- [ ] Azure CDN enabled
- [ ] Global testing from multiple regions

### Phase 3: Production Ready (Future)
- [ ] Authentication and authorization
- [ ] Usage monitoring and analytics
- [ ] Performance optimization
- [ ] Backup and disaster recovery

## 📞 Support Resources

- **Microsoft Learn**: https://learn.microsoft.com/azure/storage/blobs/
- **Azure CLI Docs**: https://learn.microsoft.com/cli/azure/
- **Pricing Calculator**: https://azure.microsoft.com/pricing/calculator/
- **Stack Overflow**: Tag `azure-blob-storage`

---

## 🎉 You're Ready!

Your infrastructure is prepared and your code is updated. All you need now is:

1. Create Azure Storage Account
2. Configure `.env`
3. Run upload script
4. Start backend
5. Share with the world!

**Begin with `QUICK_START_CLOUD.md` for the fastest path forward.**

Good luck! 🚀
