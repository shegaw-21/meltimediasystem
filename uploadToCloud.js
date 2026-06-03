#!/usr/bin/env node

/**
 * Upload multimedia files to Azure Blob Storage
 * Usage: node uploadToCloud.js <storage-account-name> <storage-account-key>
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { BlobServiceClient, StorageSharedKeyCredential } = require('@azure/storage-blob');

async function uploadFiles() {
    const storageAccountName = process.argv[2] || process.env.AZURE_STORAGE_ACCOUNT_NAME;
    const storageAccountKey = process.argv[3] || process.env.AZURE_STORAGE_ACCOUNT_KEY;
    const envConnectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;

    if (!envConnectionString && (!storageAccountName || !storageAccountKey)) {
        console.error('Usage: node uploadToCloud.js <storage-account-name> <storage-account-key>');
        console.error('Or set AZURE_STORAGE_CONNECTION_STRING in a .env file.');
        process.exit(1);
    }

    const connectionString = envConnectionString || `DefaultEndpointsProtocol=https;AccountName=${storageAccountName};AccountKey=${storageAccountKey};EndpointSuffix=core.windows.net`;
    const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);

    // uploadToCloud.js lives at project root; bakend/assets is a sibling folder
    const assetsDir = path.join(__dirname, 'bakend', 'assets');
    const containerConfigs = [
        { dir: 'videos', container: 'videos' },
        { dir: 'audio', container: 'audio' },
        { dir: 'transcripts', container: 'transcripts' },
    ];

    for (const config of containerConfigs) {
        const containerClient = blobServiceClient.getContainerClient(config.container);
        const fileDir = path.join(assetsDir, config.dir);

        if (!fs.existsSync(fileDir)) {
            console.log(`Directory not found: ${fileDir}`);
            continue;
        }

        const files = fs.readdirSync(fileDir);
        for (const file of files) {
            const filePath = path.join(fileDir, file);
            const stats = fs.statSync(filePath);

            if (stats.isFile()) {
                try {
                    console.log(`Uploading ${config.dir}/${file}...`);
                    const blockBlobClient = containerClient.getBlockBlobClient(file);
                    const fileStream = fs.createReadStream(filePath);

                    // Set content type based on file extension
                    let contentType = 'application/octet-stream';
                    if (file.endsWith('.mp4')) contentType = 'video/mp4';
                    else if (file.endsWith('.mp3')) contentType = 'audio/mpeg';
                    else if (file.endsWith('.json')) contentType = 'application/json';

                    await blockBlobClient.uploadStream(fileStream, undefined, undefined, {
                        blobHTTPHeaders: { blobContentType: contentType },
                    });

                    console.log(`✓ Uploaded: ${config.container}/${file}`);
                } catch (error) {
                    console.error(`✗ Error uploading ${file}:`, error.message);
                }
            }
        }
    }

    console.log('\nUpload complete!');
    console.log(`\nBlob Storage URL: https://${storageAccountName}.blob.core.windows.net/`);
}

uploadFiles().catch(console.error);