const { ipcRenderer } = require('electron');

console.log('✅ UYAP Preload Script Yüklendi (DEBUG Modu)');

// OTOMASYON MODÜLÜ
ipcRenderer.on('run-automation', async () => {
    console.log('🤖 Gelişmiş Otomasyon Başlatılıyor...');
    ipcRenderer.send('log-message', '🤖 Otomasyon isteği alındı, script başlıyor...');
    // alert('🤖 Otomasyon Başlatıldı! Lütfen bekleyin...');

    // Yardımcı: Bekleme Fonksiyonu
    const delay = ms => new Promise(r => setTimeout(r, ms));

    // Yardımcı: Element Bulucu (Text İçeriğine Göre)
    const findByText = (selector, text) => {
        const elements = Array.from(document.querySelectorAll(selector));
        return elements.find(el => el.innerText && el.innerText.trim() === text);
    }

    // Yardımcı: Label'dan Select Bulucu
    const findSelectByLabel = (labelText) => {
        const labels = Array.from(document.querySelectorAll('label'));
        const label = labels.find(l => l.innerText.includes(labelText));
        if (!label) return null;
        if (label.htmlFor) return document.getElementById(label.htmlFor);
        const container = label.closest('div, td, tr, .col-md-6');
        if (container) return container.querySelector('select');
        return null;
    }

    // -------------------------------------------------------------
    // ADIM 0: "Dosya Sorgula" Menüsüne Git (Eğer orada değilsek)
    // -------------------------------------------------------------
    const sidebarBtn = findByText('a, span', 'Dosya Sorgula');
    if (sidebarBtn) {
        console.log('📂 Dosya Sorgula menüsü tıklandı.');
        sidebarBtn.click();
        await delay(1000); // Sayfa geçişi için bekle
    }

    // -------------------------------------------------------------
    // ADIM 1: Yargı Türü -> Hukuk
    // -------------------------------------------------------------
    const typeSelect = findSelectByLabel('Yargı Türü');
    if (typeSelect) {
        console.log('✅ Yargı Türü kutusu bulundu.');
        // "Hukuk" seçeneğini bul
        const options = Array.from(typeSelect.options);
        const targetOpt = options.find(o => o.text.includes('Hukuk'));

        if (targetOpt) {
            typeSelect.value = targetOpt.value;
            typeSelect.dispatchEvent(new Event('change', { bubbles: true }));
            console.log('👉 "Hukuk" seçildi.');
        } else {
            console.error('❌ "Hukuk" seçeneği bulunamadı!');
        }
    } else {
        console.error('❌ "Yargı Türü" kutusu bulunamadı!');
    }

    await delay(1500); // Birimlerin yüklenmesi için bekle

    // -------------------------------------------------------------
    // ADIM 2: Yargı Birimi -> Seçim Yap (Bekleyerek)
    // -------------------------------------------------------------
    console.log('⏳ Birimlerin yüklenmesi bekleniyor...');

    // 10 saniye boyunca deneyeceğiz (her 1 saniyede bir)
    let unitSelect = null;
    let unitsLoaded = false;

    for (let i = 0; i < 10; i++) {
        unitSelect = findSelectByLabel('Yargı Birimi');
        if (unitSelect && unitSelect.options.length > 1) {
            unitsLoaded = true;
            break;
        }
        await delay(1000);
        console.log(`...bekleniyor (${i + 1}/10)`);
    }

    if (unitsLoaded && unitSelect) {
        console.log('✅ Yargı Birimi listesi doldu.');

        // Varsa "TİCARET" mahkemesini seçelim (genelde yoğun dosya olur), yoksa ilkini
        // Burası kullanıcının isteğine göre özelleştirilebilir
        const options = Array.from(unitSelect.options);
        // Öncelik: Asliye Hukuk veya İş, yoksa ilk sıradaki
        const targetUnit = options.find(o => o.text.includes('1.')) || options[1];

        if (targetUnit) {
            unitSelect.value = targetUnit.value;
            unitSelect.dispatchEvent(new Event('change', { bubbles: true }));
            console.log('👉 Birim seçildi:', targetUnit.text);
        }
    } else {
        console.error('❌ Yargı Birimi listesi yüklenemedi veya boş!');
        // Yine de devam edelim, belki sadece sorgula butonuna basmak yeterlidir.
    }

    await delay(1000);

    // -------------------------------------------------------------
    // ADIM 3: Sorgula Butonuna Bas
    // -------------------------------------------------------------
    const buttons = Array.from(document.querySelectorAll('button, a.btn'));
    const sorgulaBtn = buttons.find(b => b.innerText.includes('Sorgula'));

    if (sorgulaBtn) {
        console.log('✅ Sorgula Butonu Bulundu ve Tıklanıyor...');
        sorgulaBtn.style.border = '5px solid green';
        sorgulaBtn.click();
    } else {
        console.error('❌ Sorgula butonu bulunamadı!');
    }
});

// Inject XHook
const path = require('path');
const fs = require('fs');
try {
    const xhookPath = path.join(__dirname, 'xhook.js');
    console.log('Loading XHook from:', xhookPath);
    const xhookContent = fs.readFileSync(xhookPath, 'utf8');
    // Append explicit assignment to window.xhook
    const payload = xhookContent + "; if(typeof xhook !== 'undefined') { window.xhook = xhook; }";
    // Execute in global scope
    window.eval(payload);
    console.log('✅ XHook loaded via window.eval');
    ipcRenderer.send('xhook-status', '✅ Hazır');
} catch (e) {
    console.error('❌ XHook load failed:', e);
    ipcRenderer.send('xhook-status', '❌ Hata: ' + e.message);
}

// Ensure xhook is available globally
if (window.xhook) {
    console.log('✅ XHook loaded successfully');

    // Setup Passive Capture
    window.xhook.after(function (request, response) {
        // Log EVERYTHING to find the correct URL
        // console.log('🔍 [XHOOK Traffic]:', request.url);

        // ALWAYS send traffic to renderer for the "Last URL" display
        ipcRenderer.send('xhook-traffic', request.url);

        try {
            if (!response.data) return;
            const resData = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;

            // SEND EVERYTHING TO RENDERER FOR DEBUGGING (Temporary)
            // This allows the "Debug Raw Data" view to show the last successful JSON response
            // regardless of URL. This is the only way to find the new endpoint name.
            if (resData) {
                ipcRenderer.send('uyap-debug-data', {
                    url: request.url,
                    data: resData
                });
            }

            // 1. Capture File List (Specific Scope)
            if (request.url.includes('dosya_listele') ||
                request.url.includes('search_phrase_detayli') ||
                request.url.includes('tum_dosyalar')) {

                console.log('📦 [Dosya Listesi Yakalandı]', request.url);
                // ... rest of logic ...
                console.log('📄 Ham Veri Tipi:', typeof resData);
                console.log('📄 Ham Veri:', JSON.stringify(resData).substring(0, 500) + '...');

                if (resData) {
                    let files = [];
                    let count = 0;

                    // Case 1: Direct Array (likely search_phrase_detayli)
                    if (Array.isArray(resData)) {
                        console.log('✅ Veri tipi: Doğrudan Dizi (Array)');

                        // Check for [List, Count] format
                        if (resData.length === 2 && Array.isArray(resData[0]) && typeof resData[1] === 'number') {
                            console.log('✅ Format identified: [FileArray, Count]');
                            files = resData[0];
                            count = resData[1];
                        } else {
                            // Fallback for simple list
                            files = resData;
                            count = files.length;
                        }
                    }
                    // Case 2: Wrapped in data property (standard UYAP)
                    else if (resData.data && Array.isArray(resData.data)) {
                        console.log('✅ Veri tipi: data[...]');
                        files = resData.data;
                        count = files.length;
                    }
                    // Case 3: Nested data.data (pagination)
                    else if (resData.data && resData.data.data && Array.isArray(resData.data.data)) {
                        console.log('✅ Veri tipi: data.data[...]');
                        files = resData.data.data;
                        count = resData.data.total || files.length;
                    }

                    if (files.length > 0) {
                        console.log(`📤 Captured ${files.length} raw items`);

                        // Normalize Data
                        const normalizedFiles = files.map(row => {
                            // If row is already an object (not array), return it
                            if (!Array.isArray(row)) return row;

                            // If row is array of objects {dosyaId:..., text:...}
                            // We need to flatten and find key info
                            const fileObj = {};

                            // 1. Scan for specific keys and merge
                            row.forEach(cell => {
                                if (cell && typeof cell === 'object') {
                                    Object.assign(fileObj, cell);
                                }
                            });

                            // Helper to get text content from cell
                            const getText = c => (c && (c.text || c.value || c.data || ''));

                            // 2. Heuristic Scans for Display Text if not explicit keys
                            if (!fileObj.dosyaNo) {
                                // Find YYYY/NNNN pattern
                                const dosyaNoCell = row.find(c => /^\d{4}\/\d+/.test(getText(c)));
                                if (dosyaNoCell) fileObj.dosyaNo = getText(dosyaNoCell);
                            }
                            if (!fileObj.birimAdi) {
                                // Find 'Mahkemesi', 'Hakimliği', 'Dairesi'
                                const unitCell = row.find(c => /(Mahkemesi|Hakimliği|Dairesi|Bakanlığı|Kurulu)/.test(getText(c)));
                                if (unitCell) fileObj.birimAdi = getText(unitCell);
                            }
                            if (!fileObj.dosyaDurum) {
                                // Find 'Açık', 'Kapalı'
                                const statusCell = row.find(c => /^(Açık|Kapalı)$/.test(getText(c)));
                                if (statusCell) fileObj.dosyaDurum = getText(statusCell);
                                else fileObj.dosyaDurum = 'Açık'; // Default
                            }

                            // DEBUG: Log the first object's keys to understand structure
                            if (resData.data.indexOf(row) === 0 || files.indexOf(row) === 0) {
                                console.log('🔍 First Item Keys:', Object.keys(fileObj));
                                console.log('🔍 First Item Raw:', fileObj);
                            }

                            return fileObj;
                        });

                        console.log(`✅ Normalized ${normalizedFiles.length} files`);

                        // Use a distinct relay channel
                        ipcRenderer.send('uyap-files-relay', {
                            files: normalizedFiles,
                            count: count,
                            source: request.url
                        });

                        // Delay status update slightly to ensure data arrives first
                        setTimeout(() => {
                            ipcRenderer.send('xhook-status', `✅ ${normalizedFiles.length} Dosya Aktarıldı`);
                        }, 500);

                    } else {
                        console.warn('⚠️ Dizi boş veya format tanınamadı', resData);
                        ipcRenderer.send('xhook-status', '⚠️ Veri alındı ama format dışı');
                    }
                } else {
                    console.error('❌ Beklenen veri yapısı bulunamadı (resData boş)');
                }
            }

            // 2. Capture Party Data
            if (request.url.includes('dosya_taraf_bilgileri')) {
                // Parse dosyaId from request body or url
                let dosyaId = null;

                // Try from Body (form url encoded or json)
                if (request.body) {
                    if (typeof request.body === 'string') {
                        // "dosyaId=..."
                        const match = request.body.match(/dosyaId=([^&]+)/);
                        if (match) dosyaId = decodeURIComponent(match[1]);
                    } else if (request.body.dosyaId) {
                        dosyaId = request.body.dosyaId;
                    }
                }

                if (dosyaId && resData.data) {
                    console.log(`📤 Captured Parties for ${dosyaId} (Passive-XHook)`);
                    ipcRenderer.send('party-data-received', {
                        dosyaId: dosyaId,
                        parties: resData.data,
                        url: request.url
                    });
                }
            }

            // 3. Capture Documents
            if (request.url.includes('dosya_evrak_bilgileri')) {
                let dosyaId = null;
                if (request.body) {
                    if (typeof request.body === 'string') {
                        const match = request.body.match(/dosyaId=([^&]+)/);
                        if (match) dosyaId = decodeURIComponent(match[1]);
                    } else if (request.body.dosyaId) {
                        dosyaId = request.body.dosyaId;
                    }
                }

                if (dosyaId && resData.data) {
                    ipcRenderer.send('document-data-received', {
                        dosyaId: dosyaId,
                        documents: resData.data
                    });
                }
            }

        } catch (err) {
            // Ignore parse errors for non-json
        }
    });

} else {
    console.error('❌ XHook failed to load');
}

// Renderer process'in (index.html) bu fonksiyonu tetiklemesine izin ver
// Redundant helper functions removed. Data fetching is now handled by UYAPApi via direct injection.

// Fetch API Interception (Yedek - Devre Dışı)
/*
// Fetch API Interception (Devre Dışı - Stabilite İçin)
// window.fetch override kaldırıldı.
*/
