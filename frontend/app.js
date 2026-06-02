const video = document.getElementById('video-player');
const audio = document.getElementById('audio-player');
const container = document.getElementById('transcript-container');
const progressBar = document.getElementById('progress-bar');
const currentTimeDisplay = document.getElementById('current-time');
const durationDisplay = document.getElementById('duration');
const videoSelect = document.getElementById('video-select');
const downloadBtn = document.querySelector('.btn-download');
const downloadJsonBtn = document.getElementById('download-json');
const downloadPdfBtn = document.getElementById('download-pdf');
let transcriptData = [];
let currentVideo = 'part1';

function cleanTranscriptText(text) {
    return text
        .replace(/^\s*\d{1,2}:\d{2}\s*[-–]\s*\d{1,2}:\d{2}\s*/u, '')
        .trim();
}

// Fetch the clean JSON array from our backend route
async function loadTranscript(videoName = 'part1') {
    try {
        const response = await fetch(`/api/transcript?video=${videoName}`);
        transcriptData = await response.json();

        container.innerHTML = ''; // Wipe out old content placeholders

        // Map and render clickable paragraphs dynamically
        transcriptData.forEach((item, index) => {
            const cleanedText = cleanTranscriptText(item.text);
            if (!cleanedText) return;

            const paragraph = document.createElement('p');
            paragraph.className = 'transcript-line';
            paragraph.setAttribute('data-time', item.time);
            paragraph.setAttribute('data-index', index);
            paragraph.innerText = cleanedText;

            // Media control feature: user clicks line -> video jumps to frame with smooth seeking
            paragraph.addEventListener('click', () => {
                smoothSeek(item.time);
                video.play();
                // Scroll to clicked line
                paragraph.scrollIntoView({ behavior: 'smooth', block: 'center' });
            });

            container.appendChild(paragraph);
        });
    } catch (err) {
        console.error("System error loading transcript stream:", err);
    }
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

// Boot script immediately upon document ready state
loadTranscript('part1');