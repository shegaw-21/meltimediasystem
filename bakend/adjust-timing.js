const fs = require('fs');
const path = require('path');

// Read the transcript file
const transcriptFile = process.argv[2] || 'sample';
const jsonPath = path.join(__dirname, 'assets', 'transcripts', `${transcriptFile}.json`);

if (!fs.existsSync(jsonPath)) {
    console.error(`Transcript file ${transcriptFile}.json not found`);
    process.exit(1);
}

const transcript = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

console.log(`\n=== ${transcriptFile} Transcript Timing ===`);
console.log('Current timestamps:');
console.log('Line | Time (s) | Text');
console.log('-----|----------|-----');

transcript.forEach((item, index) => {
    const timeStr = item.time.toString().padStart(5, ' ');
    const indexStr = (index + 1).toString().padStart(4, ' ');
    const textPreview = item.text.substring(0, 50) + (item.text.length > 50 ? '...' : '');
    console.log(`${indexStr} | ${timeStr}  | ${textPreview}`);
});

console.log('\n=== Instructions ===');
console.log('1. Play your video and note the exact time each line is spoken');
console.log('2. Edit the JSON file directly to update the "time" values');
console.log(`3. File location: ${jsonPath}`);
console.log('4. Format: { "time": 123, "text": "Your text here" }');
console.log('5. Time should be in seconds (e.g., 30 = 30 seconds, 90 = 1 minute 30 seconds)');

console.log('\n=== Quick Edit Format ===');
console.log('To quickly update all timestamps with an offset, run:');
console.log(`node adjust-timing.js ${transcriptFile} <offset_seconds>`);
console.log('Example: node adjust-timing.js sample 5 (adds 5 seconds to all timestamps)');

// If offset is provided, apply it
if (process.argv[3]) {
    const offset = parseFloat(process.argv[3]);
    if (!isNaN(offset)) {
        const updatedTranscript = transcript.map(item => ({
            time: Math.max(0, item.time + offset),
            text: item.text
        }));
        
        fs.writeFileSync(jsonPath, JSON.stringify(updatedTranscript, null, 2));
        console.log(`\n✓ Applied ${offset}s offset to all timestamps`);
        console.log('✓ File updated successfully');
    }
}
