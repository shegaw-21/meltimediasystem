# Multimedia Learning System

**Course Code:** InSy4025  
**Institution:** Debre Berhan University  
**Department:** Information Systems  
**Year:** 4th Year — 2025/2026  
**Advisor:** Amdework Asefa  

---

## Group Members

| Name | ID |
|------|----|
| Tesfu H/wold | 1501501 |
| Yonas Tilahun | 1501577 |
| Shegaw Afele | 1501469 |
| Eden Sebsbe | 1600029 |
| Samrawit Gebretensay | 1501442 |

---

## Project Title

**Design and Implementation of an Integrated Multimedia Information System for Educational and Entertainment Content Delivery**

---

## Project Description

Meltimedia is a web-based multimedia information system that delivers educational and entertainment content through a single browser interface. For each lesson part, the system simultaneously presents:

- 🎬 **Video** — streamed efficiently using HTTP range requests
- 🎧 **Audio Summary** — a companion audio track for the same content
- 📄 **Interactive Transcript** — text that auto-highlights and scrolls in sync with video playback

Users can click any transcript line to jump to that moment in the video, search the transcript for keywords, and download the transcript in JSON or HTML format.

---

## Features

- Multi-part video lesson browser with search and filter
- HTTP range-based video and audio streaming (no full-file download required)
- Real-time transcript synchronization with video playback
- Transcript full-text search with match highlighting
- Keyboard navigation (↑ ↓ arrow keys) through transcript lines
- Admin login with secure HMAC-SHA256 session tokens
- Admin content upload panel (video, audio, transcript per part)
- Automatic `.docx` → `.json` transcript conversion using Mammoth.js
- Optional Microsoft Azure Blob Storage integration for cloud delivery
- Responsive dark-themed UI

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js + Express 4 |
| File Upload | Multer |
| Document Processing | Mammoth.js |
| Cloud Storage (optional) | Azure Blob Storage SDK |
| Frontend | HTML + CSS + Vanilla JavaScript |
| Authentication | Node.js built-in `crypto` (HMAC-SHA256) |

---

## Project Structure

```
meltimedia/
├── bakend/
│   ├── server.js              # Main API server
│   ├── package.json
│   ├── convert-docx-to-json.js
│   ├── adjust-timing.js
│   └── assets/
│       ├── videos/            # .mp4 video files
│       ├── audio/             # .mp3 audio files
│       └── transcripts/       # .docx source + .json derived files
├── frontend/
│   ├── index.html             # Main viewer page
│   ├── admin-login.html       # Admin login page
│   ├── admin-upload.html      # Content upload page
│   ├── app.js                 # All frontend logic
│   ├── config.js              # API base URL config
│   └── styles.css             # Stylesheet
├── infra/
│   └── main.bicep             # Azure infrastructure template
├── uploadToCloud.js           # Batch upload to Azure
├── render.yaml                # Render.com deployment config
└── .env.example               # Environment variable template
```

---

## Getting Started

### Prerequisites

- Node.js v18 or higher
- npm

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/shegaw-21/meltimediasystem.git
cd meltimediasystem

# 2. Install backend dependencies
cd bakend
npm install

# 3. Start the server
node server.js
```

The server starts on **http://localhost:3000** and opens the browser automatically.

### Environment Variables

Copy `.env.example` to `bakend/.env` and configure as needed:

```
PORT=3000
NODE_ENV=development
ADMIN_USER=admin
ADMIN_PASS=admin
COOKIE_SECRET=your_secret_here
USE_CLOUD_STORAGE=false
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/parts` | List available video parts |
| GET | `/api/video?video={name}` | Stream video file |
| GET | `/api/audio/stream?video={name}` | Stream audio file |
| GET | `/api/audio/download?video={name}` | Download audio file |
| GET | `/api/transcript?video={name}` | Get transcript as JSON |
| GET | `/api/transcript/download/json` | Download transcript (JSON) |
| GET | `/api/transcript/download/pdf` | Download transcript (HTML) |
| POST | `/api/login` | Admin login |
| POST | `/api/logout` | Admin logout |
| GET | `/api/auth/status` | Check session status |
| POST | `/api/admin/upload` | Upload new content *(admin only)* |

---

## Admin Panel

1. Open **http://localhost:3000/admin-login.html**
2. Log in with your admin credentials (default: `admin` / `admin`)
3. You will be redirected to the upload page
4. Enter a part name (e.g. `part16`), select your files, and click **Upload Content**

Supported file types:
- Video: `.mp4`
- Audio: `.mp3`
- Transcript: `.docx`, `.doc`, or `.json`

> Uploaded `.docx` files are automatically converted to timestamped JSON.

---

## License

This project was developed as a group research assignment at Debre Berhan University.  
For academic use only.
