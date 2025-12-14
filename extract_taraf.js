const fs = require('fs');
try {
    const content = fs.readFileSync('imerek_src/portal/main.js', 'utf8');
    const idx = content.indexOf('tarafSorgula:');
    if (idx >= 0) {
        const snippet = content.substring(idx, idx + 10000);
        fs.writeFileSync('extracted_tarafSorgula.js', snippet);
        console.log('Extracted tarafSorgula');
    } else {
        console.log('tarafSorgula not found');
    }
} catch (e) {
    console.error(e);
}
