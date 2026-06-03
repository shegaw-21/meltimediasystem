# Quick Start: Deploy to Azure Blob Storage

## 1. Prerequisites

- Windows/Mac/Linux
- Azure account (free tier: https://azure.microsoft.com/free/)
- Node.js 18+ installed
- Azure CLI installed OR use Azure Portal

## 2. Create Azure Resources (Fastest Way - No Installation)

### Option A: Using Azure Portal (Web Browser)

1. Go to https://portal.azure.com
2. Create a new Resource Group (name: `meltimedia-rg`)
3. Create a new Storage Account with these settings:
   - **Name**: Choose a unique name (e.g., `meltimediastorage` + random numbers)
   - **Region**: Select closest to your users
   - **Performance**: Standard
   - **Redundancy**: Locally-redundant storage (LRS)
4. After creation, go to Storage Account > Containers > Create three containers:
   - `videos` (set Public access level: Blob)
   - `audio` (set Public access level: Blob)
   - `transcripts` (set Public access level: Blob)
5. Go to Access keys and copy your Storage account name and Key1

### Option B: Using Azure CLI (Recommended)

```bash
# Set variables
RESOURCE_GROUP="meltimedia-rg"
LOCATION="eastus"  # Change to your preferred region
STORAGE_ACCOUNT="meltimediastorage$(date +%s | tail -c 7)"

# Create resource group
az group create --name $RESOURCE_GROUP --location $LOCATION

# Create storage account
az storage account create \
  --name $STORAGE_ACCOUNT \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION \
  --sku Standard_LRS \
  --kind StorageV2

# Create containers with public blob access
for container in videos audio transcripts; do
  az storage container create \
    --name $container \
    --account-name $STORAGE_ACCOUNT \
    --public-access blob
done

# Get connection string (you'll need this later)
az storage account show-connection-string \
  --name $STORAGE_ACCOUNT \
  --resource-group $RESOURCE_GROUP
```

## 3. Upload Your Files

### Step 1: Install Dependencies

```bash
cd /path/to/meltimedia
npm install @azure/storage-blob dotenv
```

### Step 2: Create .env file

Create a `.env` file in the project root:

```
AZURE_STORAGE_ACCOUNT_NAME=meltimediastorage12345
AZURE_STORAGE_ACCOUNT_KEY=your-storage-key-here
USE_CLOUD_STORAGE=true
CLOUD_VIDEOS_URL=https://meltimediastorage12345.blob.core.windows.net/videos/
CLOUD_AUDIO_URL=https://meltimediastorage12345.blob.core.windows.net/audio/
CLOUD_TRANSCRIPTS_URL=https://meltimediastorage12345.blob.core.windows.net/transcripts/
```

**Get these values from Azure Portal:**
- Storage Account > Access keys > Storage account name and Key1

### Step 3: Run Upload Script

```bash
node uploadToCloud.js $AZURE_STORAGE_ACCOUNT_NAME $AZURE_STORAGE_ACCOUNT_KEY
```

Example:
```bash
node uploadToCloud.js meltimediastorage12345 DefaultEndpointsProtocol=https;...
```

Wait for the script to complete. You should see:
```
✓ Uploaded: videos/part1.mp4
✓ Uploaded: audio/part1.mp3
✓ Uploaded: transcripts/part1.json
...
Upload complete!
```

## 4. Start Backend with Cloud Storage

```bash
# Install dependencies if not already done
npm install

# Start the backend
cd bakend
npm install
cd ..

# Start with .env configuration
node bakend/server.js
```

The backend will now:
- Use Azure Blob Storage URLs for video, audio, and transcripts
- Automatically redirect requests to cloud storage
- Fall back to local files if cloud storage is not configured

## 5. Access Your Content

### Direct URLs to Files
```
https://meltimediastorage12345.blob.core.windows.net/videos/part1.mp4
https://meltimediastorage12345.blob.core.windows.net/audio/part1.mp3
https://meltimediastorage12345.blob.core.windows.net/transcripts/part1.json
```

### Via API
```
http://localhost:3000/api/video?video=part1
http://localhost:3000/api/audio/stream?video=part1
http://localhost:3000/api/transcript?video=part1
```

## 6. Monitor Costs

Azure Storage pricing (as of 2024):
- **Free tier**: 5GB storage for 12 months
- **Standard LRS**: ~$0.021/GB/month
- **Data transfer out**: ~$0.09/GB

**Example costs**:
- 10GB of multimedia: ~$0.21/month + egress
- 100GB of multimedia: ~$2.10/month + egress
- Total for typical deployment: **$1-5/month**

Monitor usage in Azure Portal > Storage Account > Metrics

## Troubleshooting

### Issue: "Cannot connect to storage account"
```bash
# Verify credentials
echo $AZURE_STORAGE_ACCOUNT_NAME
echo $AZURE_STORAGE_ACCOUNT_KEY

# Test connectivity
az storage container list --account-name $AZURE_STORAGE_ACCOUNT_NAME --account-key $AZURE_STORAGE_ACCOUNT_KEY
```

### Issue: "Containers not found"
```bash
# Recreate containers
for container in videos audio transcripts; do
  az storage container create \
    --name $container \
    --account-name $AZURE_STORAGE_ACCOUNT_NAME \
    --account-key $AZURE_STORAGE_ACCOUNT_KEY \
    --public-access blob
done
```

### Issue: "Files return 404"
1. Check if files are in containers: https://portal.azure.com > Storage Account > Containers
2. Verify public access is enabled (Public access level should be "Blob")
3. Check file names match your requests

### Issue: "Backend still serving local files"
1. Make sure `.env` file has `USE_CLOUD_STORAGE=true`
2. Restart backend: `node bakend/server.js`
3. Check environment variables: `cat .env | grep CLOUD_`

## Next Steps

1. **Deploy Backend to Azure**: App Service, Container Apps, or VM
2. **Add CDN**: Enable Azure CDN for faster global delivery
3. **Enable CORS**: If accessing from different domain
4. **Add Authentication**: For uploaded files and admin panel

## Support

- Azure Docs: https://learn.microsoft.com/azure/storage/blobs/
- CLI Docs: https://learn.microsoft.com/cli/azure/
- Pricing Calculator: https://azure.microsoft.com/pricing/calculator/
