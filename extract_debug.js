const fs = require('fs');
try {
    const content = fs.readFileSync('imerek_src/portal/main.js', 'utf8');
    const idx = content.indexOf('dosyaTaraflariAl:');
    if (idx >= 0) {
        const snippet = content.substring(idx, idx + 20000);
        fs.writeFileSync('extracted_core.js', snippet);
        console.log('Extracted dosyaTaraflariAl');
    } else {
        console.log('dosyaTaraflariAl not found');
    }

    // Also search for the endpoint
    const idx2 = content.indexOf('dosya_evrak_bilgileri_brd');
    if (idx2 >= 0) {
        const snippet2 = content.substring(idx2 - 1000, idx2 + 10000);
        fs.writeFileSync('extracted_endpoint.js', snippet2);
        console.log('Extracted endpoint usage');
    } else {
        console.log('endpoint not found');
    }

} catch (e) {
    console.error(e);
}
