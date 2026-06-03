# Meltimedia Cloud Deployment Guide

## Overview
This guide explains how to deploy your multimedia learning system to Azure Blob Storage for global public access.

## Prerequisites
- Azure Account (free tier available at https://azure.microsoft.com/free/)
- Azure CLI installed
- Node.js and npm installed

## Deployment Steps

### Step 1: Create a Resource Group

```bash
az group create --name meltimedia-rg --location eastus
```

### Step 2: Deploy Azure Resources using Bicep

```bash
# Validate the Bicep template
az deployment group what-if \
  --name meltimedia-deployment \
  --resource-group meltimedia-rg \
  --template-file infra/main.bicep

# Deploy the resources
az deployment group create \
  --name meltimedia-deployment \
  --resource-group meltimedia-rg \
  --template-file infra/main.bicep
```

### Step 3: Retrieve Storage Account Details

```bash
# Get storage account name
STORAGE_ACCOUNT=$(az storage account list --resource-group meltimedia-rg --query [0].name -o tsv)

# Get storage account key
STORAGE_KEY=$(az storage account keys list --resource-group meltimedia-rg --account-name $STORAGE_ACCOUNT --query [0].value -o tsv)

# Display blob endpoint
BLOB_ENDPOINT=$(az storage account show --name $STORAGE_ACCOUNT --resource-group meltimedia-rg --query "primaryEndpoints.blob" -o tsv)

echo "Storage Account: $STORAGE_ACCOUNT"
echo "Blob Endpoint: $BLOB_ENDPOINT"
```

### Step 4: Upload Files to Azure Blob Storage

First, install the Azure Blob Storage SDK:

```bash
cd /path/to/meltimedia
npm install @azure/storage-blob
```

Then upload your files:

```bash
node uploadToCloud.js $STORAGE_ACCOUNT $STORAGE_KEY
```

Example output:
```
Uploading videos/part1.mp4...
✓ Uploaded: videos/part1.mp4
Uploading audio/part1.mp3...
✓ Uploaded: audio/part1.mp3
Uploading transcripts/part1.json...
✓ Uploaded: transcripts/part1.json
...
Upload complete!

Blob Storage URL: https://meltimediastoragexxxxx.blob.core.windows.net/
```

### Step 5: Configure Backend for Cloud Storage

Create a `.env` file in the project root:

```bash
cd /path/to/meltimedia
cat > .env << EOF
USE_CLOUD_STORAGE=true
CLOUD_VIDEOS_URL=https://$STORAGE_ACCOUNT.blob.core.windows.net/videos/
CLOUD_AUDIO_URL=https://$STORAGE_ACCOUNT.blob.core.windows.net/audio/
CLOUD_TRANSCRIPTS_URL=https://$STORAGE_ACCOUNT.blob.core.windows.net/transcripts/
PORT=3000
NODE_ENV=production
EOF
```

### Step 6: Update Backend to Use Cloud Storage

The backend server is configured to use cloud URLs when `USE_CLOUD_STORAGE=true`.

### Step 7: Deploy Backend to Azure

Option A: Deploy to Azure App Service

```bash
# Create App Service plan
az appservice plan create --name meltimedia-plan --resource-group meltimedia-rg --sku F1 --is-linux

# Create web app
az webapp create --resource-group meltimedia-rg --plan meltimedia-plan --name meltimedia-app --runtime "NODE|18.0"

# Deploy application
az webapp up --resource-group meltimedia-rg --name meltimedia-app --plan meltimedia-plan
```

Option B: Deploy using Azure Container Apps

```bash
# Create container app environment
az containerapp env create --name meltimedia-env --resource-group meltimedia-rg

# Create and deploy container app
az containerapp create \
  --name meltimedia-api \
  --resource-group meltimedia-rg \
  --environment meltimedia-env \
  --image YOUR_REGISTRY/meltimedia:latest \
  --target-port 3000 \
  --ingress 'external' \
  --query properties.configuration.ingress.fqdn
```

## Public Access URLs

After deployment, your files will be publicly accessible at:

- **Videos**: `https://<storage-account>.blob.core.windows.net/videos/<filename>.mp4`
- **Audio**: `https://<storage-account>.blob.core.windows.net/audio/<filename>.mp3`
- **Transcripts**: `https://<storage-account>.blob.core.windows.net/transcripts/<filename>.json`

Example:
```
https://meltimediastoragexxxxx.blob.core.windows.net/videos/part1.mp4
https://meltimediastoragexxxxx.blob.core.windows.net/audio/part1.mp3
https://meltimediastoragexxxxx.blob.core.windows.net/transcripts/part1.json
```

## Cost Estimation

For **1GB of storage** with typical multimedia content:

- **Storage**: ~$0.02/month (Standard LRS)
- **Data Transfer (egress)**: ~$0.09 per GB (after free tier)
- **Free tier**: 12 months, 5GB storage

Total estimated cost for production: **$1-5/month** depending on usage

## Security Best Practices

1. **Blob Access**: Files are set to public read-only access (Blob level)
2. **Storage Key**: Keep `STORAGE_KEY` secure - never commit to version control
3. **HTTPS Only**: All URLs use HTTPS for secure transmission
4. **Network Security**: Consider adding IP restrictions for management access

## Troubleshooting

### Upload Fails
```bash
# Check storage account connectivity
az storage account show --name $STORAGE_ACCOUNT --resource-group meltimedia-rg

# Verify containers exist
az storage container list --account-name $STORAGE_ACCOUNT --account-key $STORAGE_KEY
```

### Files Not Accessible
```bash
# Verify public access is enabled
az storage container show --name videos --account-name $STORAGE_ACCOUNT \
  --account-key $STORAGE_KEY --query publicAccess
```

### Backend Not Serving Cloud URLs
```bash
# Check backend configuration
cat .env
grep USE_CLOUD_STORAGE bakend/server.js
```

## Cleanup

To remove all resources:

```bash
az group delete --name meltimedia-rg --yes --no-wait
```

## Support

For Azure CLI issues: https://learn.microsoft.com/cli/azure/
For Blob Storage docs: https://learn.microsoft.com/azure/storage/blobs/
