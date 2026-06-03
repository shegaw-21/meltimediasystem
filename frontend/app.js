const video = document.getElementById('video-player');
const audio = document.getElementById('audio-player');
const container = document.getElementById('transcript-container');
const progressBar = document.getElementById('progress-bar');
const currentTimeDisplay = document.getElementById('current-time');
const durationDisplay = document.getElementById('duration');
const videoSelect = document.getElementById('video-select');
const videoSearch = document.getElementById('video-search');
// Audio download link — new Tailwind UI uses id="audio-download-link"
const downloadBtn = document.getElementById('audio-download-link') || document.querySelector('.btn-download');
const downloadJsonBtn = document.getElementById('download-json');
const downloadPdfBtn = document.getElementById('download-pdf');
let transcriptData = [];
let currentVideo = 'part1';
let allVideoParts = [];

function cleanTranscriptText(text) {
    return text
        .replace(/^\s*\d{1,2}:\d{2}\s*[-–]\s*\d{1,2}:\d{2}\s*/u, '')
        .trim();
}

async function populateVideoSelect() {
    try {
        const response = await fetch('/api/parts');
        const parts = await response.json();
        if (Array.isArray(parts) && parts.length) {
            allVideoParts = parts;
            setVideoOptions(parts);
            // set default if current not present
            if (!parts.includes(currentVideo)) {
                currentVideo = parts[0];
            }
            // if search field has text, apply filter
            if (videoSearch && videoSearch.value) {
                applyVideoFilter(videoSearch.value);
            } else {
                switchVideo(currentVideo);
            }
        }
    } catch (err) {
        console.error('Failed to load video list:', err);
    }
}

function setVideoOptions(parts) {
    videoSelect.innerHTML = '';
    parts.forEach(part => {
        const option = document.createElement('option');
        option.value = part;
        option.textContent = part.replace(/^part/i, match => match.toUpperCase());
        videoSelect.appendChild(option);
    });
}

function applyVideoFilter(query) {
    if (!allVideoParts || !allVideoParts.length) return;
    const q = (query || '').toLowerCase();
    const filtered = allVideoParts.filter(p => p.toLowerCase().includes(q));
    setVideoOptions(filtered.length ? filtered : allVideoParts);
}

if (videoSearch) {
    videoSearch.addEventListener('input', (e) => {
        applyVideoFilter(e.target.value);
    });
}

function showTranscriptMessage(message, className = 'transcript-message') {
    container.innerHTML = '';
    const note = document.createElement('p');
    note.className = className;
    note.textContent = message;
    container.appendChild(note);
}

// Fetch the clean JSON array from our backend route
async function loadTranscript(videoName = 'part1') {
    try {
        const response = await fetch(`/api/transcript?video=${videoName}`);
        if (!response.ok) {
            let message = `No transcript found for "${videoName}".`;
            try {
                const errorData = await response.json();
                if (errorData && errorData.error) {
                    message = errorData.error;
                }
            } catch (parseErr) {
                // ignore non-JSON error bodies
            }
            transcriptData = [];
            showTranscriptMessage(`${message} Upload or place a matching ${videoName}.docx file in bakend/assets/transcripts/.`);
            return;
        }

        transcriptData = await response.json();
        if (!Array.isArray(transcriptData) || !transcriptData.length) {
            transcriptData = [];
            showTranscriptMessage(`Transcript for "${videoName}" is empty. Re-upload a .docx file with the same name.`);
            return;
        }

        container.innerHTML = ''; // Wipe out old content placeholders

        // Map and render clickable paragraphs dynamically; render uploaded transcript verbatim
        transcriptData.forEach((item, index) => {
            let text = '';
            let time = null;

            if (typeof item === 'string') {
                text = item;
            } else if (item && typeof item === 'object') {
                text = item.text || item.content || JSON.stringify(item);
                if (typeof item.time === 'number') time = item.time;
            } else {
                text = String(item);
            }

            // Skip empty entries
            if (!text || !text.trim()) return;

            const cleanedText = cleanTranscriptText(text);
            if (!cleanedText || !cleanedText.trim()) return;

            const paragraph = document.createElement('p');
            paragraph.className = 'transcript-line';
            paragraph.setAttribute('data-index', index);
            if (time !== null) paragraph.setAttribute('data-time', time);

            const textNode = document.createElement('span');
            textNode.className = 'text';
            textNode.innerText = cleanedText;

            paragraph.appendChild(textNode);

            // If the item includes a time field, clicking seeks; otherwise only scrolls
            paragraph.addEventListener('click', () => {
                if (time !== null) {
                    smoothSeek(time);
                    video.play();
                }
                paragraph.scrollIntoView({ behavior: 'smooth', block: 'center' });
            });

            container.appendChild(paragraph);
        });
    } catch (err) {
        console.error("System error loading transcript stream:", err);
        transcriptData = [];
        showTranscriptMessage(`Could not load transcript for "${videoName}". Check that ${videoName}.docx exists and restart the server.`);
    }
}

function formatTime(seconds) {
    const s = Math.max(0, Math.floor(seconds || 0));
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
}

// Switch video function
function switchVideo(videoName) {
    currentVideo = videoName;

    // Update video source
    video.src = `/api/video?video=${videoName}`;
    video.load();

    // Update audio source
    audio.src = `/api/audio/stream?video=${videoName}`;
    audio.load();

    // Update audio download link
    downloadBtn.href = `/api/audio/download?video=${videoName}`;

    // Update transcript download links
    downloadJsonBtn.href = `/api/transcript/download/json?video=${videoName}`;
    downloadPdfBtn.href = `/api/transcript/download/pdf?video=${videoName}`;

    // Reset progress bar and time displays
    progressBar.style.width = '0%';
    currentTimeDisplay.textContent = '0:00';
    durationDisplay.textContent = '0:00';

    // Load new transcript
    loadTranscript(videoName);

    // Clear search
    if (searchInput) {
        searchInput.value = '';
        searchTranscript('');
    }
}

// Event listener for video selection
videoSelect.addEventListener('change', (e) => {
    switchVideo(e.target.value);
});

// Smooth seeking function for better user experience
function smoothSeek(targetTime) {
    const currentTime = video.currentTime;
    const diff = targetTime - currentTime;
    const steps = 10;
    const stepTime = diff / steps;
    let currentStep = 0;

    const seekInterval = setInterval(() => {
        currentStep++;
        video.currentTime = currentTime + (stepTime * currentStep);

        if (currentStep >= steps) {
            clearInterval(seekInterval);
            video.currentTime = targetTime;
        }
    }, 20);
}

// Media sync listener: applies styling class based on play state timestamps
video.addEventListener('timeupdate', () => {
    const currentTime = video.currentTime;
    const lines = document.querySelectorAll('.transcript-line');
    let activeIndex = -1;

    lines.forEach((line, index) => {
        const time = parseFloat(line.getAttribute('data-time'));
        const nextTime = lines[index + 1] ? parseFloat(lines[index + 1].getAttribute('data-time')) : Infinity;

        if (currentTime >= time && currentTime < nextTime) {
            line.classList.add('highlight');
            activeIndex = index;
        } else {
            line.classList.remove('highlight');
        }
    });

    // Auto-scroll to active line
    if (activeIndex !== -1) {
        const activeLine = lines[activeIndex];
        const containerRect = container.getBoundingClientRect();
        const lineRect = activeLine.getBoundingClientRect();

        // Only scroll if the active line is not in view
        if (lineRect.top < containerRect.top || lineRect.bottom > containerRect.bottom) {
            activeLine.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    // Update progress bar
    if (progressBar && video.duration) {
        const progress = (currentTime / video.duration) * 100;
        progressBar.style.width = `${progress}%`;
    }

    // Update time displays
    if (currentTimeDisplay) {
        currentTimeDisplay.textContent = formatTime(currentTime);
    }
    if (durationDisplay && video.duration) {
        durationDisplay.textContent = formatTime(video.duration);
    }
});

// Format time in MM:SS format
function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Add keyboard navigation for transcript
document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        const lines = document.querySelectorAll('.transcript-line');
        const currentIndex = Array.from(lines).findIndex(line => line.classList.contains('highlight'));

        if (e.key === 'ArrowUp' && currentIndex > 0) {
            lines[currentIndex - 1].click();
        } else if (e.key === 'ArrowDown' && currentIndex < lines.length - 1) {
            lines[currentIndex + 1].click();
        }
    }
});

// Transcript search functionality
const searchInput = document.getElementById('search-input');
const searchBtn = document.getElementById('search-btn');
const matchCount = document.getElementById('match-count');

function searchTranscript(query) {
    const lines = document.querySelectorAll('.transcript-line');
    let matchCountNum = 0;
    const lowerQuery = query.toLowerCase();

    lines.forEach(line => {
        line.classList.remove('search-match');
        if (query && line.innerText.toLowerCase().includes(lowerQuery)) {
            line.classList.add('search-match');
            matchCountNum++;
        }
    });

    if (matchCount) {
        if (query) {
            matchCount.textContent = `Found ${matchCountNum} match${matchCountNum !== 1 ? 'es' : ''}`;
        } else {
            matchCount.textContent = '';
        }
    }

    // Scroll to first match if found
    if (matchCountNum > 0) {
        const firstMatch = document.querySelector('.search-match');
        if (firstMatch) {
            firstMatch.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }
}

searchBtn.addEventListener('click', () => {
    searchTranscript(searchInput.value);
});

searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        searchTranscript(searchInput.value);
    }
});

searchInput.addEventListener('input', () => {
    if (searchInput.value === '') {
        searchTranscript('');
    }
});

const adminLoginForm = document.getElementById('admin-login-form');
const adminLoginStatus = document.getElementById('admin-login-status');
// Legacy sidebar elements (may not exist in new UI; guarded with ?. below)
const adminUploadForm = document.getElementById('admin-upload-form');
const adminUploadStatus = document.getElementById('admin-upload-status');
const adminLoginSection = document.getElementById('admin-login-section');
const adminUploadSection = document.getElementById('admin-upload-section');
const adminLogoutBtn = document.getElementById('admin-logout-btn');

// Header elements (new Tailwind UI)
const headerLoginEl = document.getElementById('header-login');
const headerAdminBar = document.getElementById('header-admin-bar');

function showAdminPanel(authenticated) {
    // New header UI
    if (headerLoginEl && headerAdminBar) {
        if (authenticated) {
            headerLoginEl.classList.add('hidden');
            headerAdminBar.classList.remove('hidden');
            headerAdminBar.classList.add('flex');
        } else {
            headerLoginEl.classList.remove('hidden');
            headerAdminBar.classList.add('hidden');
            headerAdminBar.classList.remove('flex');
        }
    }
    // Legacy sidebar fallback
    if (adminLoginSection) adminLoginSection.style.display = 'none';
    if (adminUploadSection) adminUploadSection.style.display = authenticated ? 'block' : 'none';
}

async function refreshAuthState() {
    try {
        const response = await fetch('/api/auth/status');
        const data = await response.json();
        showAdminPanel(data.authenticated);
    } catch (error) {
        console.error('Auth status check failed:', error);
        showAdminPanel(false);
    }
}

if (adminLoginForm) {
    adminLoginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const username = document.getElementById('admin-username').value;
        const password = document.getElementById('admin-password').value;

        adminLoginStatus.textContent = 'Logging in...';
        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password }),
                credentials: 'include'
            });
            const data = await response.json();
            if (!response.ok) {
                adminLoginStatus.textContent = data.error || 'Login failed.';
                return;
            }
            adminLoginStatus.textContent = 'Logged in successfully.';
            showAdminPanel(true);
        } catch (error) {
            adminLoginStatus.textContent = `Login error: ${error.message}`;
        }
    });
}

if (adminUploadForm) {
    adminUploadForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const formData = new FormData(adminUploadForm);
        adminUploadStatus.textContent = 'Uploading content...';

        try {
            const response = await fetch('/api/admin/upload', {
                method: 'POST',
                body: formData,
                credentials: 'include'
            });

            const data = await response.json();
            if (!response.ok) {
                adminUploadStatus.textContent = data.error || 'Upload failed. Please try again.';
                return;
            }

            adminUploadStatus.textContent = `Upload successful: ${data.uploaded.join(', ')}`;
            const partName = formData.get('partName');
            if (partName) {
                await populateVideoSelect();
                videoSelect.value = partName;
            }
            if (partName) {
                videoSelect.value = partName;
                switchVideo(partName);
            }
        } catch (error) {
            adminUploadStatus.textContent = `Upload error: ${error.message}`;
        }
    });
}

if (adminLogoutBtn) {
    adminLogoutBtn.addEventListener('click', async () => {
        try {
            await fetch('/api/logout', { method: 'POST', credentials: 'include' });
            showAdminPanel(false);
        } catch (error) {
            console.error('Logout failed:', error);
        }
    });
}

// Boot script immediately upon document ready state
(async () => {
    await refreshAuthState();
    await populateVideoSelect();
    loadTranscript(currentVideo);
})();