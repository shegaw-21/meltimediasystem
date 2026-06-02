const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

// 1. Video Streaming Endpoint (Progressive buffer streaming with adaptive chunking)
app.get('/api/video', (req, res) => {
    const videoName = req.query.video || 'part1';
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
app.get('/api/transcript', (req, res) => {
    const videoName = req.query.video || 'part1';
    const jsonPath = path.join(__dirname, 'assets', 'transcripts', `${videoName}.json`);

    if (!fs.existsSync(jsonPath)) {
        return res.status(404).send(`JSON transcript file '${videoName}.json' not found.`);
    }

    res.setHeader('Content-Type', 'application/json');
    fs.createReadStream(jsonPath).pipe(res);
});

// 2b. JSON Transcript Download Endpoint
app.get('/api/transcript/download/json', (req, res) => {
    const videoName = req.query.video || 'part1';
    const jsonPath = path.join(__dirname, 'assets', 'transcripts', `${videoName}.json`);

    if (!fs.existsSync(jsonPath)) {
        return res.status(404).send(`JSON transcript file '${videoName}.json' not found.`);
    }

    res.download(jsonPath, `${videoName}_transcript.json`);
});

// 2c. PDF Transcript Download Endpoint
app.get('/api/transcript/download/pdf', (req, res) => {
    const videoName = req.query.video || 'part1';
    const jsonPath = path.join(__dirname, 'assets', 'transcripts', `${videoName}.json`);

    if (!fs.existsSync(jsonPath)) {
        return res.status(404).send(`JSON transcript file '${videoName}.json' not found.`);
    }

    const transcript = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    let htmlContent = `<!DOCTYPE html>\n<html>\n<head>\n    <meta charset=\"UTF-8\">\n    <title>${videoName} Transcript</title>\n    <style>\n        body { font-family: Arial, sans-serif; padding: 40px; line-height: 1.6; }\n        h1 { color: #0066cc; border-bottom: 2px solid #0066cc; padding-bottom: 10px; }\n        .transcript-item { margin: 20px 0; padding: 10px; background: #f5f5f5; border-left: 4px solid #0066cc; }\n        .timestamp { font-weight: bold; color: #666; font-size: 0.9em; }\n        .text { margin-top: 5px; }\n    </style>\n</head>\n<body>\n    <h1>Transcript: ${videoName}</h1>\n`;

    transcript.forEach(item => {
        const minutes = Math.floor(item.time / 60);
        const seconds = Math.floor(item.time % 60);
        const timestamp = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        htmlContent += `\n    <div class=\"transcript-item\">\n        <div class=\"timestamp\">Time: ${timestamp}</div>\n        <div class=\"text\">${item.text}</div>\n    </div>\n`;
    });

    htmlContent += `\n</body>\n</html>`;
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Content-Disposition', `attachment; filename=\"${videoName}_transcript.html\"`);
    res.send(htmlContent);
});

// 3. Audio Streaming Endpoint (Range requests for audio playback)
app.get('/api/audio/stream', (req, res) => {
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

// Serve frontend static assets after API routes
app.use(express.static(path.join(__dirname, '../frontend')));

app.listen(PORT, () => {
    const url = `http://localhost:${PORT}/index.html`;
    console.log(`🚀 Multimedia backend engine running at ${url}`);
    console.log(`🌐 Open ${url} to view your dashboard!`);

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
});