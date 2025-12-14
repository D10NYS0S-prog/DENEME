const fs = require('fs');
const path = 'imerek_src/portal/main.js';

try {
    const content = fs.readFileSync(path, 'utf8');
    const index = content.indexOf('fileDownload:');

    if (index !== -1) {
        // Extract a chunk around it
        const start = Math.max(0, index - 50);
        const end = Math.min(content.length, index + 2000); // 2000 chars should cover the function
        console.log("--- EXTRACTED START ---");
        console.log(content.substring(start, end));
        console.log("--- EXTRACTED END ---");
    } else {
        console.log("fileDownload: NOT FOUND");
    }
} catch (err) {
    console.error(err);
}
