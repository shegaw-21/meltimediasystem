require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const mammoth = require('mammoth');
const { BlobServiceClient, StorageSharedKeyCredential } = require('@azure/storage-blob');

const app = express();
const PORT = process.env.PORT || 3000;

const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'admin';
const COOKIE_SECRET = process.env.COOKIE_SECRET || 'default_secret_please_change';

// Cloud Storage Configuration
const USE_CLOUD_STORAGE = process.env.USE_CLOUD_STORAGE === 'true';
const AZURE_STORAGE_ACCOUNT_NAME = process.env.AZURE_STORAGE_ACCOUNT_NAME || '';
const AZURE_STORAGE_ACCOUNT_KEY = process.env.AZURE_STORAGE_ACCOUNT_KEY || '';
const AZURE_STORAGE_CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING || '';
const AZURE_STORAGE_BASE_URL = process.env.AZURE_STORAGE_BASE_URL || (AZURE_STORAGE_ACCOUNT_NAME ? `https://${AZURE_STORAGE_ACCOUNT_NAME}.blob.core.windows.net` : '');
const CLOUD_VIDEOS_URL = process.env.CLOUD_VIDEOS_URL || (AZURE_STORAGE_BASE_URL ? `${AZURE_STORAGE_BASE_URL}/videos/` : '');
const CLOUD_AUDIO_URL = process.env.CLOUD_AUDIO_URL || (AZURE_STORAGE_BASE_URL ? `${AZURE_STORAGE_BASE_URL}/audio/` : '');
const CLOUD_TRANSCRIPTS_URL = process.env.CLOUD_TRANSCRIPTS_URL || (AZURE_STORAGE_BASE_URL ? `${AZURE_STORAGE_BASE_URL}/transcripts/` : '');

const upload = multer({ storage: multer.memoryStorage() });

const TRANSCRIPTS_DIR = path.join(__dirname, 'assets', 'transcripts');
const PLACEHOLDER_TRANSCRIPT_PATTERN = /replace with actual text/i;

function makeSafePartName(name) {
    return name.trim().replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase();
}

function isPlaceholderTranscript(items) {
    if (!Array.isArray(items) || !items.length) {
        return true;
    }

    const texts = items.map(item => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object') return item.text || item.content || '';
        return String(item);
    });

    const nonEmpty = texts.filter(text => text && text.trim());
    if (!nonEmpty.length) {
        return true;
    }

    const placeholderCount = nonEmpty.filter(text => PLACEHOLDER_TRANSCRIPT_PATTERN.test(text)).length;
    return placeholderCount >= Math.max(1, Math.ceil(nonEmpty.length * 0.5));
}

function rawTextToTranscriptItems(raw) {
    const lines = (raw || '')
        .split(/\r?\n+/)
        .map(line => line.trim())
        .filter(line => line.length > 0);

    if (!lines.length) {
        return [{ time: 0, text: 'Transcript could not be parsed. Please ensure the document contains readable text.' }];
    }

    return lines.map((text, index) => ({
        time: index * 5,
        text,
    }));
}

function normalizeTranscriptItems(parsed) {
    if (!Array.isArray(parsed)) {
        return null;
    }

    if (!parsed.length) {
        return [];
    }

    if (typeof parsed[0] === 'string') {
        return parsed.map((text, index) => ({ time: index * 5, text }));
    }

    return parsed;
}

async function extractTextFromDocBuffer(buffer, ext) {
    if (ext === '.doc') {
        try {
            const WordExtractor = require('word-extractor');
            const extractor = new WordExtractor();
            const extracted = await extractor.extract(buffer);
            return extracted.getBody() || '';
        } catch (err) {
            console.error('Failed to read .doc transcript:', err.message || err);
            return '';
        }
    }

    const result = await mammoth.extractRawText({ buffer });
    return result.value || '';
}

function convertRawTextToJson(raw) {
    if (!raw || !raw.trim()) {
        return [{ time: 0, text: 'Transcript content not available or could not be extracted.' }];
    }
    return rawTextToTranscriptItems(raw);
}

async function convertDocumentBufferToJson(buffer, ext) {
    const raw = await extractTextFromDocBuffer(buffer, ext);
    return convertRawTextToJson(raw);
}

function convertDocxBufferToJson(buffer) {
    return convertDocumentBufferToJson(buffer, '.docx');
}

function findTranscriptDocumentPath(videoName) {
    if (!fs.existsSync(TRANSCRIPTS_DIR)) {
        return null;
    }

    const wantedBase = videoName.toLowerCase();
    const candidates = fs.readdirSync(TRANSCRIPTS_DIR)
        .filter(file => {
            const ext = path.extname(file).toLowerCase();
            return (ext === '.docx' || ext === '.doc') && !file.startsWith('~$');
        })
        .filter(file => path.basename(file, path.extname(file)).toLowerCase() === wantedBase);

    if (!candidates.length) {
        return null;
    }

    candidates.sort((a, b) => {
        const aDocx = a.toLowerCase().endsWith('.docx') ? 0 : 1;
        const bDocx = b.toLowerCase().endsWith('.docx') ? 0 : 1;
        return aDocx - bDocx;
    });

    return path.join(TRANSCRIPTS_DIR, candidates[0]);
}

function getTranscriptJsonPath(videoName) {
    return path.join(TRANSCRIPTS_DIR, `${videoName}.json`);
}

async function buildTranscriptFromDocument(documentPath) {
    const ext = path.extname(documentPath).toLowerCase();
    const buffer = fs.readFileSync(documentPath);
    const items = await convertDocumentBufferToJson(buffer, ext);
    return items;
}

function writeTranscriptJson(videoName, items) {
    if (!fs.existsSync(TRANSCRIPTS_DIR)) {
        fs.mkdirSync(TRANSCRIPTS_DIR, { recursive: true });
    }
    const jsonPath = getTranscriptJsonPath(videoName);
    fs.writeFileSync(jsonPath, JSON.stringify(items, null, 2));
    return jsonPath;
}

async function resolveTranscriptForVideo(videoName) {
    const jsonPath = getTranscriptJsonPath(videoName);
    const documentPath = findTranscriptDocumentPath(videoName);
    let parsed = null;
    let shouldRebuildFromDocument = false;

    if (fs.existsSync(jsonPath)) {
        try {
            parsed = normalizeTranscriptItems(JSON.parse(fs.readFileSync(jsonPath, 'utf8')));
            shouldRebuildFromDocument = isPlaceholderTranscript(parsed);
        } catch (err) {
            console.error(`Invalid transcript JSON for '${videoName}':`, err.message || err);
            parsed = null;
            shouldRebuildFromDocument = true;
        }
    } else {
        shouldRebuildFromDocument = true;
    }

    if (documentPath) {
        const docStat = fs.statSync(documentPath);
        const jsonStat = fs.existsSync(jsonPath) ? fs.statSync(jsonPath) : null;
        const docIsNewer = !jsonStat || docStat.mtimeMs > jsonStat.mtimeMs;

        if (shouldRebuildFromDocument || docIsNewer) {
            parsed = await buildTranscriptFromDocument(documentPath);
            writeTranscriptJson(videoName, parsed);
        }
    }

    if (!parsed) {
        return null;
    }

    return parsed;
}

async function syncTranscriptsFromDocuments() {
    if (!fs.existsSync(TRANSCRIPTS_DIR)) {
        return;
    }

    const documentFiles = fs.readdirSync(TRANSCRIPTS_DIR)
        .filter(file => {
            const ext = path.extname(file).toLowerCase();
            return (ext === '.docx' || ext === '.doc') && !file.startsWith('~$');
        });

    for (const file of documentFiles) {
        const videoName = path.basename(file, path.extname(file));
        const jsonPath = getTranscriptJsonPath(videoName);
        const documentPath = path.join(TRANSCRIPTS_DIR, file);
        const docStat = fs.statSync(documentPath);
        const jsonStat = fs.existsSync(jsonPath) ? fs.statSync(jsonPath) : null;

        let needsSync = !jsonStat || docStat.mtimeMs > jsonStat.mtimeMs;
        if (!needsSync && jsonStat) {
            try {
                const existing = normalizeTranscriptItems(JSON.parse(fs.readFileSync(jsonPath, 'utf8')));
                needsSync = isPlaceholderTranscript(existing);
            } catch (err) {
                needsSync = true;
            }
        }

        if (!needsSync) {
            continue;
        }

        try {
            const items = await buildTranscriptFromDocument(documentPath);
            writeTranscriptJson(videoName, items);
            console.log(`Transcript sync: ${file} -> ${videoName}.json (${items.length} lines)`);
        } catch (err) {
            console.error(`Transcript sync failed for ${file}:`, err.message || err);
        }
    }
}

let cloudBlobServiceClient = null;

function getBlobServiceClient() {
    if (cloudBlobServiceClient) {
        return cloudBlobServiceClient;
    }

    if (!USE_CLOUD_STORAGE) {
        return null;
    }

    if (AZURE_STORAGE_CONNECTION_STRING) {
        cloudBlobServiceClient = BlobServiceClient.fromConnectionString(AZURE_STORAGE_CONNECTION_STRING);
        return cloudBlobServiceClient;
    }

    if (AZURE_STORAGE_ACCOUNT_NAME && AZURE_STORAGE_ACCOUNT_KEY) {
        const credential = new StorageSharedKeyCredential(AZURE_STORAGE_ACCOUNT_NAME, AZURE_STORAGE_ACCOUNT_KEY);
        const accountUrl = `https://${AZURE_STORAGE_ACCOUNT_NAME}.blob.core.windows.net`;
        cloudBlobServiceClient = new BlobServiceClient(accountUrl, credential);
        return cloudBlobServiceClient;
    }

    return null;
}

function isCloudStorageConfigured() {
    return USE_CLOUD_STORAGE && getBlobServiceClient() !== null;
}

function getBlobContentType(filename) {
    const ext = path.extname(filename).toLowerCase();
    if (ext === '.mp4') return 'video/mp4';
    if (ext === '.mp3') return 'audio/mpeg';
    if (ext === '.json') return 'application/json';
    if (ext === '.docx') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    return 'application/octet-stream';
}

async function uploadBufferToCloud(containerName, blobName, buffer, contentType) {
    const blobServiceClient = getBlobServiceClient();
    if (!blobServiceClient) {
        throw new Error('Cloud storage is not configured.');
    }

    const containerClient = blobServiceClient.getContainerClient(containerName);
    await containerClient.createIfNotExists({ access: 'blob' });
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);
    await blockBlobClient.uploadData(buffer, {
        blobHTTPHeaders: { blobContentType: contentType },
    });
}

async function uploadFileToCloud(containerName, blobName, filePath, contentType) {
    const blobServiceClient = getBlobServiceClient();
    if (!blobServiceClient) {
        throw new Error('Cloud storage is not configured.');
    }

    const containerClient = blobServiceClient.getContainerClient(containerName);
    await containerClient.createIfNotExists({ access: 'blob' });
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);
    await blockBlobClient.uploadFile(filePath, {
        blobHTTPHeaders: { blobContentType: contentType },
    });
}

async function synchronizeLocalAssetsToCloud() {
    if (!isCloudStorageConfigured()) {
        return;
    }

    const assetConfigs = [
        { dir: 'videos', container: 'videos' },
        { dir: 'audio', container: 'audio' },
        { dir: 'transcripts', container: 'transcripts' },
    ];

    for (const config of assetConfigs) {
        const assetDir = path.join(__dirname, 'assets', config.dir);
        if (!fs.existsSync(assetDir)) {
            continue;
        }

        const files = fs.readdirSync(assetDir);
        for (const file of files) {
            const filePath = path.join(assetDir, file);
            if (!fs.statSync(filePath).isFile()) {
                continue;
            }

            try {
                const contentType = getBlobContentType(file);
                await uploadFileToCloud(config.container, file, filePath, contentType);
                console.log(`Cloud sync: uploaded ${config.container}/${file}`);
            } catch (err) {
                console.error(`Cloud sync failed for ${config.container}/${file}:`, err.message || err);
            }
        }
    }
}

function signToken(payload) {
    const payloadString = JSON.stringify(payload);
    const signature = crypto
        .createHmac('sha256', COOKIE_SECRET)
        .update(payloadString)
        .digest('hex');
    return Buffer.from(`${payloadString}.${signature}`).toString('base64');
}

function verifyToken(token) {
    try {
        const decoded = Buffer.from(token, 'base64').toString('utf8');
        const dotIndex = decoded.lastIndexOf('.');
        if (dotIndex === -1) return null;

        const payloadString = decoded.slice(0, dotIndex);
        const signature = decoded.slice(dotIndex + 1);
        const expected = crypto
            .createHmac('sha256', COOKIE_SECRET)
            .update(payloadString)
            .digest('hex');

        if (signature !== expected) return null;

        return JSON.parse(payloadString);
    } catch (err) {
        return null;
    }
}

function parseCookies(req) {
    const cookieHeader = req.headers.cookie || '';
    return cookieHeader.split(';').reduce((acc, cookie) => {
        const [name, ...rest] = cookie.trim().split('=');
        if (!name) return acc;
        acc[name] = rest.join('=');
        return acc;
    }, {});
}

function isUserLoggedIn(req) {
    const cookies = parseCookies(req);
    const authToken = cookies.auth_token;
    if (!authToken) return false;
    const payload = verifyToken(authToken);
    return payload && payload.user === ADMIN_USER && payload.expires > Date.now();
}

function requireAdminAuth(req, res, next) {
    if (isUserLoggedIn(req)) {
        return next();
    }

    const adminToken = req.body.adminToken || req.query.adminToken || '';
    const allowedToken = process.env.ADMIN_UPLOAD_TOKEN || '';
    if (allowedToken && adminToken === allowedToken) {
        return next();
    }

    return res.status(401).json({ error: 'Unauthorized. Please log in as admin.' });
}

// Provide dynamic list of available video parts for the frontend dropdown
app.get('/api/parts', (req, res) => {
    const videoDir = path.join(__dirname, 'assets', 'videos');
    if (!fs.existsSync(videoDir)) {
        return res.json([]);
    }

    const files = fs.readdirSync(videoDir)
        .filter(file => path.extname(file).toLowerCase() === '.mp4')
        .map(file => path.basename(file, '.mp4'))
        .sort((a, b) => {
            const aNum = parseInt(a.replace(/[^0-9]/g, ''), 10) || 0;
            const bNum = parseInt(b.replace(/[^0-9]/g, ''), 10) || 0;
            if (aNum !== bNum) return aNum - bNum;
            return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
        });

    res.json(files);
});

// 1. Video Streaming Endpoint (Progressive buffer streaming with adaptive chunking)
app.get('/api/video', (req, res) => {
    const videoName = req.query.video || 'part1';

    // Use cloud storage if configured
    if (USE_CLOUD_STORAGE && CLOUD_VIDEOS_URL) {
        const cloudUrl = `${CLOUD_VIDEOS_URL}${videoName}.mp4`;
        return res.redirect(307, cloudUrl);
    }

    // Fall back to local storage
    const videoPath = path.join(__dirname, 'assets', 'videos', `${videoName}.mp4`);

    if (!fs.existsSync(videoPath)) {
        return res.status(404).send(`Error: Video '${videoName}.mp4' not found in bakend/assets/videos/`);
    }

    const stat = fs.statSync(videoPath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunksize = (end - start) + 1;
        const file = fs.createReadStream(videoPath, { start, end });

        const head = {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunksize,
            'Content-Type': 'video/mp4',
            'Cache-Control': 'public, max-age=31536000',
        };

        res.writeHead(206, head);
        file.on('error', (err) => {
            console.error('Stream error:', err);
            if (!res.headersSent) {
                res.status(500).send('Stream error occurred');
            }
        });
        file.pipe(res);
    } else {
        const head = {
            'Content-Length': fileSize,
            'Content-Type': 'video/mp4',
            'Accept-Ranges': 'bytes',
            'Cache-Control': 'public, max-age=31536000',
        };
        res.writeHead(200, head);

        const file = fs.createReadStream(videoPath);
        file.on('error', (err) => {
            console.error('Stream error:', err);
            if (!res.headersSent) {
                res.status(500).send('Stream error occurred');
            }
        });
        file.pipe(res);
    }
});

// 2. Dynamic JSON Transcript Endpoint
app.get('/api/transcript', async (req, res) => {
    const videoName = req.query.video || 'part1';

    try {
        const transcript = await resolveTranscriptForVideo(videoName);
        if (!transcript) {
            if (USE_CLOUD_STORAGE && CLOUD_TRANSCRIPTS_URL) {
                const cloudUrl = `${CLOUD_TRANSCRIPTS_URL}${videoName}.json`;
                return res.redirect(307, cloudUrl);
            }
            return res.status(404).json({
                error: `No transcript found for '${videoName}'. Add ${videoName}.docx or ${videoName}.json in bakend/assets/transcripts/.`,
            });
        }

        res.setHeader('Content-Type', 'application/json');
        res.json(transcript);
    } catch (err) {
        console.error(`Transcript load failed for '${videoName}':`, err);
        res.status(500).json({ error: 'Failed to load transcript.' });
    }
});

// 2b. JSON Transcript Download Endpoint
app.get('/api/transcript/download/json', async (req, res) => {
    const videoName = req.query.video || 'part1';

    try {
        const transcript = await resolveTranscriptForVideo(videoName);
        if (!transcript) {
            return res.status(404).send(`Transcript for '${videoName}' not found.`);
        }

        const jsonPath = getTranscriptJsonPath(videoName);
        if (!fs.existsSync(jsonPath)) {
            writeTranscriptJson(videoName, transcript);
        }

        res.download(jsonPath, `${videoName}_transcript.json`);
    } catch (err) {
        console.error(`Transcript JSON download failed for '${videoName}':`, err);
        res.status(500).send('Failed to prepare transcript download.');
    }
});

// 2c. PDF Transcript Download Endpoint
app.get('/api/transcript/download/pdf', async (req, res) => {
    const videoName = req.query.video || 'part1';

    let transcript;
    try {
        transcript = await resolveTranscriptForVideo(videoName);
    } catch (err) {
        console.error(`Transcript PDF download failed for '${videoName}':`, err);
        return res.status(500).send('Failed to load transcript.');
    }

    if (!transcript) {
        return res.status(404).send(`Transcript for '${videoName}' not found.`);
    }
    let htmlContent = `<!DOCTYPE html>\n<html>\n<head>\n    <meta charset=\"UTF-8\">\n    <title>${videoName} Transcript</title>\n    <style>\n        body { font-family: Arial, sans-serif; padding: 40px; line-height: 1.6; }\n        h1 { color: #0066cc; border-bottom: 2px solid #0066cc; padding-bottom: 10px; }\n        .transcript-item { margin: 20px 0; padding: 10px; background: #f5f5f5; border-left: 4px solid #0066cc; }\n        .timestamp { font-weight: bold; color: #666; font-size: 0.9em; }\n        .text { margin-top: 5px; }\n    </style>\n</head>\n<body>\n    <h1>Transcript: ${videoName}</h1>\n`;

    transcript.forEach(item => {
        let text = '';
        let time = 0;
        if (typeof item === 'string') {
            text = item;
            time = 0;
        } else if (item && typeof item === 'object') {
            text = item.text || item.content || JSON.stringify(item);
            time = item.time || 0;
        } else {
            text = String(item);
            time = 0;
        }

        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        const timestamp = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        htmlContent += `\n    <div class=\"transcript-item\">\n        <div class=\"timestamp\">Time: ${timestamp}</div>\n        <div class=\"text\">${text}</div>\n    </div>\n`;
    });

    htmlContent += `\n</body>\n</html>`;
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Content-Disposition', `attachment; filename=\"${videoName}_transcript.html\"`);
    res.send(htmlContent);
});

// 3. Audio Streaming Endpoint (Range requests for audio playback)
app.get('/api/audio/stream', (req, res) => {
    const videoName = req.query.video || 'part1';

    // Use cloud storage if configured
    if (USE_CLOUD_STORAGE && CLOUD_AUDIO_URL) {
        const cloudUrl = `${CLOUD_AUDIO_URL}${videoName}.mp3`;
        return res.redirect(307, cloudUrl);
    }

    // Fall back to local storage
    const audioDir = path.join(__dirname, 'assets', 'audio');

    // Try multiple audio file extensions
    const possibleExtensions = ['.mp3', '.mp4', ''];
    let audioPath = null;

    for (const ext of possibleExtensions) {
        const testPath = path.join(audioDir, `${videoName}${ext}`);
        if (fs.existsSync(testPath)) {
            audioPath = testPath;
            break;
        }
    }

    if (!audioPath) {
        return res.status(404).send(`Error: Audio file for '${videoName}' not found in bakend/assets/audio/`);
    }

    const stat = fs.statSync(audioPath);
    const fileSize = stat.size;
    const range = req.headers.range;

    // Determine content type based on extension
    const ext = path.extname(audioPath).toLowerCase();
    const contentType = ext === '.mp4' ? 'video/mp4' : 'audio/mpeg';

    if (range) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunksize = (end - start) + 1;
        const file = fs.createReadStream(audioPath, { start, end });

        const head = {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunksize,
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=31536000',
        };

        res.writeHead(206, head);
        file.on('error', (err) => {
            console.error('Audio stream error:', err);
            if (!res.headersSent) {
                res.status(500).send('Stream error occurred');
            }
        });
        file.pipe(res);
    } else {
        const head = {
            'Content-Length': fileSize,
            'Content-Type': contentType,
            'Accept-Ranges': 'bytes',
            'Cache-Control': 'public, max-age=31536000',
        };
        res.writeHead(200, head);

        const file = fs.createReadStream(audioPath);
        file.on('error', (err) => {
            console.error('Audio stream error:', err);
            if (!res.headersSent) {
                res.status(500).send('Stream error occurred');
            }
        });
        file.pipe(res);
    }
});

// 4. Audio Summary Download Endpoint
app.get('/api/audio/download', (req, res) => {
    const videoName = req.query.video || 'part1';
    const audioDir = path.join(__dirname, 'assets', 'audio');

    // Try multiple audio file extensions
    const possibleExtensions = ['.mp3', '.mp4', ''];
    let audioPath = null;

    for (const ext of possibleExtensions) {
        const testPath = path.join(audioDir, `${videoName}${ext}`);
        if (fs.existsSync(testPath)) {
            audioPath = testPath;
            break;
        }
    }

    if (!audioPath) {
        return res.status(404).send(`Error: Audio file for '${videoName}' not found in bakend/assets/audio/`);
    }

    const ext = path.extname(audioPath);
    res.download(audioPath, `${videoName}_summary${ext}`);
});

// 5. Admin login endpoint
app.use(express.json());

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required.' });
    }

    if (username === ADMIN_USER && password === ADMIN_PASS) {
        const token = signToken({ user: ADMIN_USER, expires: Date.now() + 1000 * 60 * 60 * 2 });
        res.cookie('auth_token', token, {
            httpOnly: true,
            sameSite: 'lax',
        });
        return res.json({ success: true });
    }

    return res.status(401).json({ error: 'Invalid credentials.' });
});

app.post('/api/logout', (req, res) => {
    res.cookie('auth_token', '', { maxAge: 0, httpOnly: true, sameSite: 'lax' });
    res.json({ success: true });
});

app.get('/api/auth/status', (req, res) => {
    res.json({ authenticated: isUserLoggedIn(req) });
});

// 6. Admin upload endpoint for new multimedia content
app.post('/api/admin/upload', upload.fields([
    { name: 'videoFile', maxCount: 1 },
    { name: 'audioFile', maxCount: 1 },
    { name: 'transcriptFile', maxCount: 1 },
]), requireAdminAuth, async (req, res) => {
    const { partName } = req.body;

    if (!partName || !partName.trim()) {
        return res.status(400).json({ error: 'Part name is required.' });
    }

    const safePart = makeSafePartName(partName);
    if (!safePart) {
        return res.status(400).json({ error: 'Invalid part name. Use letters, numbers, dash, or underscore only.' });
    }

    const files = req.files || {};
    const result = [];

    const cloudUploads = [];

    if (files.videoFile && files.videoFile[0]) {
        const file = files.videoFile[0];
        const ext = path.extname(file.originalname).toLowerCase();
        if (ext !== '.mp4') {
            return res.status(400).json({ error: 'Video file must be .mp4' });
        }

        const target = path.join(__dirname, 'assets', 'videos', `${safePart}${ext}`);
        fs.writeFileSync(target, file.buffer);
        result.push('video');

        if (isCloudStorageConfigured()) {
            cloudUploads.push(uploadBufferToCloud('videos', `${safePart}${ext}`, file.buffer, 'video/mp4'));
        }
    }

    if (files.audioFile && files.audioFile[0]) {
        const file = files.audioFile[0];
        const ext = path.extname(file.originalname).toLowerCase();
        // Only accept MP3 for admin uploads to ensure consistent audio format
        if (ext !== '.mp3') {
            return res.status(400).json({ error: 'Audio file must be .mp3' });
        }

        const target = path.join(__dirname, 'assets', 'audio', `${safePart}${ext}`);
        fs.writeFileSync(target, file.buffer);
        result.push('audio');

        if (isCloudStorageConfigured()) {
            cloudUploads.push(uploadBufferToCloud('audio', `${safePart}${ext}`, file.buffer, getBlobContentType(`${safePart}${ext}`)));
        }
    }

    if (files.transcriptFile && files.transcriptFile[0]) {
        const file = files.transcriptFile[0];
        const ext = path.extname(file.originalname).toLowerCase();
        const transcriptDir = path.join(__dirname, 'assets', 'transcripts');

        if (ext === '.json') {
            // Normalize JSON transcript structure: accept array of strings or array of objects
            let parsed = null;
            try {
                parsed = normalizeTranscriptItems(JSON.parse(file.buffer.toString('utf8')));
            } catch (err) {
                return res.status(400).json({ error: 'Uploaded JSON is not valid JSON.' });
            }

            if (isPlaceholderTranscript(parsed)) {
                const matchingDoc = findTranscriptDocumentPath(safePart);
                if (matchingDoc) {
                    try {
                        parsed = await buildTranscriptFromDocument(matchingDoc);
                    } catch (err) {
                        return res.status(400).json({ error: 'Uploaded JSON is a placeholder template. Add a .docx transcript with real text instead.' });
                    }
                } else {
                    return res.status(400).json({ error: 'Uploaded JSON looks like placeholder text. Upload a .docx/.doc transcript with real content.' });
                }
            }

            const target = path.join(transcriptDir, `${safePart}.json`);
            fs.writeFileSync(target, JSON.stringify(parsed, null, 2));
            result.push('transcript-json');

            if (isCloudStorageConfigured()) {
                cloudUploads.push(uploadBufferToCloud('transcripts', `${safePart}.json`, Buffer.from(JSON.stringify(parsed, null, 2)), 'application/json'));
            }
        } else if (ext === '.docx' || ext === '.doc') {
            const docTarget = path.join(transcriptDir, `${safePart}${ext}`);
            fs.writeFileSync(docTarget, file.buffer);
            result.push(ext === '.docx' ? 'transcript-docx' : 'transcript-doc');

            if (isCloudStorageConfigured()) {
                const docContentType = ext === '.docx'
                    ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                    : 'application/msword';
                cloudUploads.push(uploadBufferToCloud('transcripts', `${safePart}${ext}`, file.buffer, docContentType));
            }

            try {
                const transcriptJson = await convertDocumentBufferToJson(file.buffer, ext);
                const jsonTarget = path.join(transcriptDir, `${safePart}.json`);
                fs.writeFileSync(jsonTarget, JSON.stringify(transcriptJson, null, 2));
                result.push('transcript-json');

                if (isCloudStorageConfigured()) {
                    cloudUploads.push(uploadBufferToCloud('transcripts', `${safePart}.json`, Buffer.from(JSON.stringify(transcriptJson, null, 2)), 'application/json'));
                }
            } catch (err) {
                console.error('Transcript conversion failed:', err);
                return res.status(500).json({ error: `Failed to convert uploaded ${ext} transcript to JSON.` });
            }
        } else {
            return res.status(400).json({ error: 'Transcript file must be .json, .docx, or .doc' });
        }
    }

    if (!result.length) {
        return res.status(400).json({ error: 'No files were uploaded. Please choose video, audio, or transcript files.' });
    }

    if (cloudUploads.length) {
        try {
            await Promise.all(cloudUploads);
        } catch (err) {
            console.error('Cloud sync failed during admin upload:', err);
            return res.status(500).json({ error: 'Upload completed locally, but failed to sync to cloud storage.' });
        }
    }

    res.json({ message: 'Upload completed successfully.', uploaded: result, part: safePart });
});

// Serve frontend static assets after API routes
// Support both local layout (bakend/../frontend) and flat deploy layout (./frontend)
const frontendPath = fs.existsSync(path.join(__dirname, '../frontend'))
    ? path.join(__dirname, '../frontend')
    : path.join(__dirname, 'frontend');
app.use(express.static(frontendPath));

app.listen(PORT, async () => {
    const url = `http://localhost:${PORT}/index.html`;
    console.log(`🚀 Multimedia backend engine running at ${url}`);
    console.log(`🌐 Open ${url} to view your dashboard!`);

    try {
        await syncTranscriptsFromDocuments();
    } catch (err) {
        console.error('Transcript sync failed at startup:', err.message || err);
    }

    const exec = require('child_process').exec;
    switch (process.platform) {
        case 'win32':
            exec(`start ${url}`);
            break;
        case 'darwin':
            exec(`open ${url}`);
            break;
        default:
            exec(`xdg-open ${url}`);
            break;
    }

    if (isCloudStorageConfigured()) {
        console.log('📤 Cloud storage is enabled. Syncing existing local assets to Azure...');
        synchronizeLocalAssetsToCloud()
            .then(() => console.log('✅ Existing local assets synced to cloud storage.'))
            .catch(err => console.error('Cloud sync failed at startup:', err));
    } else if (USE_CLOUD_STORAGE) {
        console.warn('⚠ Cloud storage is enabled but not fully configured. Please set AZURE_STORAGE_ACCOUNT_NAME and AZURE_STORAGE_ACCOUNT_KEY or connection string.');
    }
});