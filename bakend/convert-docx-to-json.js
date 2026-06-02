const fs = require('fs');
const path = require('path');
const mammoth = require('mammoth');

const transcriptsDir = path.join(__dirname, 'assets', 'transcripts');

function parseLines(rawText) {
    return rawText
        .split(/\r?\n+/)
        .map(line => line.trim())
        .filter(line => line.length > 0);
}

function estimateTimestamps(lines, intervalSeconds = 5) {
    return lines.map((text, index) => ({
        time: index * intervalSeconds,
        text,
    }));
}

async function convertDocxFile(docxPath, jsonPath) {
    const result = await mammoth.extractRawText({ path: docxPath });
    const lines = parseLines(result.value);

    if (!lines.length) {
        throw new Error(`No transcript text found in ${path.basename(docxPath)}`);
    }

    const items = estimateTimestamps(lines);
    fs.writeFileSync(jsonPath, JSON.stringify(items, null, 2));
    console.log(`✓ Converted ${path.basename(docxPath)} -> ${path.basename(jsonPath)} (${items.length} lines)`);
}

(async() => {
    const docxFiles = fs.readdirSync(transcriptsDir)
        .filter(file => file.toLowerCase().endsWith('.docx') && !file.startsWith('~$'));

    if (!docxFiles.length) {
        console.error('No .docx transcript files found in', transcriptsDir);
        process.exit(1);
    }

    console.log('Converting .docx transcript files to JSON...');

    for (const file of docxFiles) {
        const docxPath = path.join(transcriptsDir, file);
        const jsonName = `${path.basename(file, '.docx')}.json`;
        const jsonPath = path.join(transcriptsDir, jsonName);

        try {
            await convertDocxFile(docxPath, jsonPath);
        } catch (err) {
            console.error(`✗ Failed to convert ${file}:`, err.message);
        }
    }

    console.log('\nConversion complete.');
    console.log('Review generated JSON files and adjust timestamps where needed.');
})();