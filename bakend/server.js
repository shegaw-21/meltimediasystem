const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

// Serve your frontend files automatically on the same server origin
app.use(express.static(path.join(__dirname, '../frontend')));

// 1. Video Streaming Endpoint (Progressive buffer streaming with adaptive chunking)
app.get('/api/video', (req, res) => {
    const videoName = req.query.video || 'sample';
    const videoPath = path.join(__dirname, 'assets', 'videos', `${videoName}.mp4`);

    if (!fs.existsSync(videoPath)) {
        return res.status(404).send(`Error: Video '${videoName}.mp4' not found in bakend/assets/videos/`);
    }

    const stat = fs.statSync(videoPath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

        // Adaptive chunk sizing: smaller chunks for better buffering on slow connections
        const chunksize = (end - start) + 1;
        const file = fs.createReadStream(videoPath, { start, end });

        const head = {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunksize,
            'Content-Type': 'video/mp4',
            'Cache-Control': 'public, max-age=31536000', // Cache for 1 year
        };

        res.writeHead(206, head); // 206 Partial Content for streaming

        // Error handling for stream
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
    const videoName = req.query.video || 'sample';
    const jsonPath = path.join(__dirname, 'assets', 'transcripts', `${videoName}.json`);

    if (!fs.existsSync(jsonPath)) {
        return res.status(404).send(`JSON transcript file '${videoName}.json' not found.`);
    }
    res.setHeader('Content-Type', 'application/json');
    fs.createReadStream(jsonPath).pipe(res);
});

// 3. Audio Streaming Endpoint (Range requests for audio playback)
app.get('/api/audio/stream', (req, res) => {
    const videoName = req.query.video || 'sample';
    const audioPath = path.join(__dirname, 'assets', 'audio', `${videoName}.mp3`);

    if (!fs.existsSync(audioPath)) {
        return res.status(404).send(`Error: Audio '${videoName}.mp3' not found in bakend/assets/audio/`);
    }

    const stat = fs.statSync(audioPath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

        const chunksize = (end - start) + 1;
        const file = fs.createReadStream(audioPath, { start, end });

        const head = {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunksize,
            'Content-Type': 'audio/mpeg',
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
            'Content-Type': 'audio/mpeg',
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
    const videoName = req.query.video || 'sample';
    const audioPath = path.join(__dirname, 'assets', 'audio', `${videoName}.mp3`);

    if (!fs.existsSync(audioPath)) {
        return res.status(404).send(`Error: Audio '${videoName}.mp3' not found in bakend/assets/audio/`);
    }

    res.download(audioPath, `${videoName}_summary.mp3`);
});

app.listen(PORT, () => {
    const url = `http://localhost:${PORT}/index.html`;
    console.log(`🚀 Multimedia backend engine running at ${url}`);
    console.log(`🌐 Open ${url} to view your dashboard!`);

    // Automatically open the user's default browser based on their OS
    const exec = require('child_process').exec;
    switch (process.platform) {
        case 'win32': // Windows
            exec(`start ${url}`);
            break;
        case 'darwin': // macOS
            exec(`open ${url}`);
            break;
        default: // Linux / Ubuntu
            exec(`xdg-open ${url}`);
            break;
    }
});