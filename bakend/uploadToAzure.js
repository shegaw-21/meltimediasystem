#!/usr/bin/env node
/**
 * uploadToAzure.js
 * ----------------
 * Uploads all local media files to Azure Blob Storage.
 *
 * Usage (from inside bakend/ folder):
 *   node uploadToAzure.js
 *
 * Credentials are read from bakend/.env automatically.
 * Make sure USE_CLOUD_STORAGE=true and AZURE_STORAGE_ACCOUNT_NAME /
 * AZURE_STORAGE_ACCOUNT_KEY are set in your .env file before running.
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { BlobServiceClient, StorageSharedKeyCredential } = require('@azure/storage-blob');

// ── Read credentials from environment ──────────────────────────────────────
const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME;
const accountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY;
const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;

if (!connectionString && (!accountName || !accountKey)) {
    console.error('\n❌  Azure credentials not found.');
    console.error('    Set AZURE_STORAGE_ACCOUNT_NAME and AZURE_STORAGE_ACCOUNT_KEY in bakend/.env\n');
    process.exit(1);
}

// ── Create BlobServiceClient ────────────────────────────────────────────────
let blobServiceClient;
if (connectionString) {
    blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
} else {
    const credential = new StorageSharedKeyCredential(accountName, accountKey);
    blobServiceClient = new BlobServiceClient(
        `https://${accountName}.blob.core.windows.net`,
        credential
    );
}

// ── Folders to upload ───────────────────────────────────────────────────────
const assetsDir = path.join(__dirname, 'assets');
const containers = [
    { localDir: 'videos', container: 'videos' },
    { localDir: 'audio', container: 'audio' },
    { localDir: 'transcripts', container: 'transcripts' },
];

// ── Content-type helper ─────────────────────────────────────────────────────
function getContentType(filename) {
    const ext = path.extname(filename).toLowerCase();
    if (ext === '.mp4') return 'video/mp4';
    if (ext === '.mp3') return 'audio/mpeg';
    if (ext === '.json') return 'application/json';
    if (ext === '.docx') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    return 'application/octet-stream';
}

// ── Main upload function ────────────────────────────────────────────────────
async function uploadAll() {
    console.log('\n🚀 Starting Azure Blob Storage upload...\n');

    let totalUploaded = 0;
    let totalFailed = 0;

    for (const cfg of containers) {
        const localDir = path.join(assetsDir, cfg.localDir);

        if (!fs.existsSync(localDir)) {
            console.log(`⚠  Skipping '${cfg.localDir}' — folder not found.`);
            continue;
        }

        // Ensure container exists with public blob access
        const containerClient = blobServiceClient.getContainerClient(cfg.container);
        await containerClient.createIfNotExists({ access: 'blob' });

        const files = fs.readdirSync(localDir).filter(f =>
            fs.statSync(path.join(localDir, f)).isFile()
        );

        if (files.length === 0) {
            console.log(`⚠  '${cfg.localDir}' is empty, nothing to upload.`);
            continue;
        }

        console.log(`📁 Uploading ${files.length} file(s) to container '${cfg.container}'...`);

        for (const file of files) {
            const filePath = path.join(localDir, file);
            const contentType = getContentType(file);

            try {
                const blockBlobClient = containerClient.getBlockBlobClient(file);
                const fileStream = fs.createReadStream(filePath);
                const fileSize = fs.statSync(filePath).size;

                await blockBlobClient.uploadStream(fileStream, undefined, undefined, {
                    blobHTTPHeaders: { blobContentType: contentType },
                });

                const sizeMB = (fileSize / 1024 / 1024).toFixed(2);
                console.log(`   ✅  ${cfg.container}/${file}  (${sizeMB} MB)`);
                totalUploaded++;
            } catch (err) {
                console.error(`   ❌  ${cfg.container}/${file} — ${err.message}`);
                totalFailed++;
            }
        }

        console.log('');
    }

    const baseUrl = connectionString
        ? '(see Azure Portal for URL)'
        : `https://${accountName}.blob.core.windows.net`;

    console.log('─────────────────────────────────────────────');
    console.log(`✅  Upload complete — ${totalUploaded} succeeded, ${totalFailed} failed`);
    console.log(`🌐  Storage URL: ${baseUrl}`);
    console.log('─────────────────────────────────────────────\n');

    if (totalFailed > 0) process.exit(1);
}

uploadAll().catch(err => {
    console.error('Fatal error:', err.message);
    process.exit(1);
});
