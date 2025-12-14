
/**
 * UYAP API Wrapper
 * 
 * Allows direct interaction with UYAP endpoints via webview.executeJavaScript.
 * This bypasses the need for passive XHR interception and provides more reliable data fetching.
 */
/**
 * UYAP API Wrapper (Session Fixed Version)
 * 
 * Implements robust session handling, cookie capturing, and multi-strategy polling
 * to resolve persistent 500/404 errors.
 */
class UYAPApi {
    constructor() {
        this.baseUrl = 'https://avukatbeta.uyap.gov.tr';
        this.sessionData = {
            birimId: null,
            kullaniciId: null,
            sessionId: null,
            lastUpdated: null
        };

        // Initialize session immediately
        this.initializeSession();
    }

    /**
     * Capture Session Data from the Webview Context
     */
    async initializeSession() {
        console.log('🔄 Session verisi yakalanıyor...');

        const sessionScript = `
            (() => {
                // Tüm olası session kaynaklarını kontrol et
                const session = {
                    // 1. Cookie'ler
                    cookies: document.cookie,
                    jsessionid: document.cookie.match(/JSESSIONID=([^;]+)/)?.[1],
                    uyapSession: document.cookie.match(/UYAP_SESSION=([^;]+)/)?.[1],
                    
                    // 2. LocalStorage
                    birimId: localStorage.getItem('birimId') || 
                             localStorage.getItem('currentBirimId') ||
                             localStorage.getItem('selectedBirimId'),
                    
                    kullaniciId: localStorage.getItem('kullaniciId') ||
                                 localStorage.getItem('userId'),
                    
                    // 3. SessionStorage
                    sessionBirimId: sessionStorage.getItem('birimId'),
                    sessionKullaniciId: sessionStorage.getItem('kullaniciId'),
                    
                    // 4. DOM'dan (hidden inputs)
                    hiddenBirimId: document.querySelector('input[name="birimId"][type="hidden"]')?.value,
                    hiddenKullaniciId: document.querySelector('input[name="kullaniciId"][type="hidden"]')?.value,
                    
                    // 5. Meta tag'ler
                    csrfToken: document.querySelector('meta[name="csrf-token"]')?.content,
                    
                    timestamp: new Date().toISOString()
                };
                
                return session;
            })();
        `;

        try {
            // Using existing IPC mechanism
            const result = await ipcRenderer.invoke('uyap-execute-script', sessionScript);
            if (result && !result.error) {
                this.sessionData = result;
                this.sessionData.lastUpdated = new Date().toISOString();
                console.log('✅ Session verisi yakalandı:', this.sessionData);
            }
        } catch (error) {
            console.warn('❌ Session yakalama hatası:', error);
        }
    }

    /**
     * Ensure valid session before request
     */
    async ensureSession() {
        // Refresh if older than 2 minutes (UYAP sessions are short-lived)
        const now = new Date();
        const lastUpdate = this.sessionData.lastUpdated ? new Date(this.sessionData.lastUpdated) : new Date(0);
        const diffMinutes = (now - lastUpdate) / (1000 * 60);

        if (diffMinutes > 2 || !this.sessionData.jsessionid) {
            console.log('🔄 Session yenileniyor...');
            await this.initializeSession();
        }

        if (!this.sessionData.jsessionid) {
            throw new Error('JSESSIONID bulunamadı! Lütfen UYAP\'ta login olun.');
        }

        return this.sessionData;
    }

    /**
     * Generate all possible payload combinations
     */
    generatePayloads(dosyaId, session) {
        const birimId = session.birimId || session.sessionBirimId || session.hiddenBirimId || '0992';
        const kullaniciId = session.kullaniciId || session.sessionKullaniciId || session.hiddenKullaniciId || '';

        return [
            // 1. Simple ID (Most likely to work if session is good)
            { dosyaId: dosyaId.toString() },

            // 2. ID + Unit (Required by some endpoints)
            {
                dosyaId: dosyaId.toString(),
                birimId: birimId
            },

            // 3. Alternate parameter names
            {
                id: dosyaId.toString(),
                birim_id: birimId
            }
        ];
    }

    /**
     * Execute fetch with explicit session injection
     */
    async _fetchWithSession(endpoint, payload, session) {
        const fullUrl = endpoint.startsWith('http') ? endpoint : (this.baseUrl + endpoint);

        const script = `
            (async () => {
                try {
                    // CONVERT PAYLOAD TO FORM URL ENCODED STRING
                    // UYAP .ajx endpoints usually expect this, NOT JSON.
                    const formBody = [];
                    for (const property in ${JSON.stringify(payload)}) {
                        const encodedKey = encodeURIComponent(property);
                        const encodedValue = encodeURIComponent(${JSON.stringify(payload)}[property]);
                        formBody.push(encodedKey + "=" + encodedValue);
                    }
                    const formBodyString = formBody.join("&");

                    const headers = {
                        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                        'X-Requested-With': 'XMLHttpRequest',
                        'Accept': 'application/json, text/javascript, */*; q=0.01'
                    };
                    
                    // Inject CSRF if available
                    ${session.csrfToken ? `headers['X-CSRF-Token'] = '${session.csrfToken}';` : ''}
                    
                    // console.log('📤 Request (Form):', '${endpoint}', formBodyString);
                    
                    const response = await fetch('${fullUrl}', {
                        method: 'POST',
                        headers: headers,
                        credentials: 'include',
                        body: formBodyString // Send as string, not JSON
                    });
                    
                    if (!response.ok) {
                        const err = await response.text();
                        console.error('❌ HTTP Error:', response.status, err); // Full error log
                        return { error: 'HTTP ' + response.status, details: err.substring(0, 200) };
                    }
                    
                    return await response.json();
                } catch(error) {
                    return { error: error.message };
                }
            })();
        `;

        return await ipcRenderer.invoke('uyap-execute-script', script);
    }

    /**
     * Get Parties with Multi-Strategy Polling
     */
    async getParties(info) {
        // Extract plain ID
        let dosyaId = (typeof info === 'object' && info.dosyaId) ? info.dosyaId : info;
        console.log(`🔍 Taraflar çekiliyor (Session garantili): ${dosyaId}`);

        try {
            const session = await this.ensureSession();
            const payloads = this.generatePayloads(dosyaId, session);

            // Priority: confirmed working endpoint first
            const endpoints = [
                '/dosya_taraf_bilgileri_brd.ajx',
                '/dosya_taraf_bilgileri.ajx'
            ];

            let lastResult = null;

            for (const endpoint of endpoints) {
                for (const payload of payloads) {
                    // console.log(`   Attempt: ${endpoint}`, payload);
                    const response = await this._fetchWithSession(endpoint, payload, session);

                    if (this.isValidResponse(response)) {
                        console.log(`   ✅ BAŞARILI: ${endpoint}`);
                        return this.normalizeResponse(response);
                    }
                    if (response && response.error) {
                        lastResult = response;
                    }
                }
            }

            console.warn('❌ Taraf bilgisi alınamadı. Son hata:', lastResult);
            return lastResult || { error: 'Taraf bulunamadı' };

        } catch (error) {
            console.error('getParties Error:', error);
            return { error: error.message };
        }
    }

    /**
     * Get Documents (using similar strategy)
     */
    async getDocuments(dosyaId) {
        console.log(`fetching docs for ${dosyaId}...`);
        const session = await this.ensureSession();
        const payload = { dosyaId: dosyaId.toString() };

        // Try BRD first
        let response = await this._fetchWithSession('/dosya_evrak_bilgileri_brd.ajx', payload, session);

        if (!this.isValidResponse(response)) {
            response = await this._fetchWithSession('/dosya_evrak_bilgileri.ajx', payload, session);
        }
        return response;
    }

    /**
     * Get ALL Evrak (Gelen, Giden, Diğer) with pagination
     * İmerek.js'deki yöntem: /list_dosya_evraklar.ajx
     */
    async getAllEvrak(dosyaId) {
        console.log(`📄 Tüm evraklar alınıyor: ${dosyaId}`);
        const session = await this.ensureSession();

        let allEvrak = [];
        let pageNumber = 1;
        let hasMore = true;
        const maxPages = 50; // Güvenlik limiti

        while (hasMore && pageNumber <= maxPages) {
            try {
                const payload = {
                    dosyaId: dosyaId.toString(),
                    pageNumber: pageNumber
                };

                const response = await this._fetchWithSession('/list_dosya_evraklar.ajx', payload, session);

                // DEBUG: Response'u detaylı göster
                console.log(`📦 Sayfa ${pageNumber} RAW Response:`, response);
                console.log(`📦 Response type:`, typeof response);
                console.log(`📦 Is Array:`, Array.isArray(response));
                if (response && typeof response === 'object') {
                    console.log(`📦 Response keys:`, Object.keys(response));
                    console.log(`📦 Full response:`, JSON.stringify(response).substring(0, 500));
                }

                if (this.isValidResponse(response)) {
                    let evrakList = [];

                    // Normalize response - UYAP Evrak Yapısı
                    if (response.tumEvraklar) {
                        // tumEvraklar: { "2025/123": [...], "2024/456": [...] }
                        // Her dosya numarası altında evraklar array olarak
                        console.log(`📦 tumEvraklar yapısı tespit edildi`);

                        for (const dosyaNo in response.tumEvraklar) {
                            const dosyaEvraklari = response.tumEvraklar[dosyaNo];
                            if (Array.isArray(dosyaEvraklari)) {
                                evrakList.push(...dosyaEvraklari);
                            }
                        }
                    } else if (response.son20Evrak && Array.isArray(response.son20Evrak)) {
                        // Alternatif: son20Evrak array'i
                        evrakList = response.son20Evrak;
                    } else if (Array.isArray(response)) {
                        evrakList = response;
                    } else if (response.data && Array.isArray(response.data)) {
                        evrakList = response.data;
                    } else if (response.evraklar && Array.isArray(response.evraklar)) {
                        evrakList = response.evraklar;
                    } else if (response.evrakListesi && Array.isArray(response.evrakListesi)) {
                        evrakList = response.evrakListesi;
                    }

                    console.log(`📋 Parsed ${evrakList.length} evrak from page ${pageNumber}`);

                    if (evrakList.length > 0) {
                        allEvrak.push(...evrakList);
                        console.log(`  ✅ Sayfa ${pageNumber}: ${evrakList.length} evrak`);
                        pageNumber++;
                    } else {
                        console.log(`  ⚠️ Sayfa ${pageNumber}: Boş liste`);
                        hasMore = false;
                    }
                } else {
                    console.warn(`  ❌ Sayfa ${pageNumber}: isValidResponse = false`, response);
                    hasMore = false;
                }

            } catch (error) {
                console.error(`❌ Sayfa ${pageNumber} hatası:`, error);
                hasMore = false;
            }
        }

        console.log(`✅ Toplam ${allEvrak.length} evrak toplandı`);

        // Kategorilere ayır
        return this.categorizeEvrak(allEvrak);
    }

    /**
     * Evrakları kategorilere ayır (Gelen, Giden, Diğer)
     */
    categorizeEvrak(evrakList) {
        const categorized = {
            gelen: [],
            giden: [],
            diger: [],
            all: evrakList
        };

        evrakList.forEach(evrak => {
            // UYAP evrak yapısı: tip: "GLN" (Gelen), "GDN" (Giden)
            // tur: "Hazırlık Dosyası Gelen Evrak" gibi açıklama
            const tip = (evrak.tip || evrak.evrakTipi || '').toUpperCase();
            const tur = (evrak.tur || evrak.evrakTur || evrak.evrakTuru || '').toUpperCase();

            // Önce tip field'ına bak (GLN/GDN)
            if (tip === 'GLN' || tip.includes('GELEN') || tip.includes('INCOMING')) {
                categorized.gelen.push(evrak);
            } else if (tip === 'GDN' || tip.includes('GIDEN') || tip.includes('OUTGOING')) {
                categorized.giden.push(evrak);
            }
            // Alternatif: tur field'ına bak
            else if (tur.includes('GELEN') || tur.includes('INCOMING')) {
                categorized.gelen.push(evrak);
            } else if (tur.includes('GIDEN') || tur.includes('OUTGOING')) {
                categorized.giden.push(evrak);
            } else {
                categorized.diger.push(evrak);
            }
        });

        console.log(`📊 Kategoriler: Gelen=${categorized.gelen.length}, Giden=${categorized.giden.length}, Diğer=${categorized.diger.length}`);
        return categorized;
    }

    /**
     * Get total page count for evrak
     * İmerek.js: /listDosyaEvraklarPageTotal.ajx
     */
    async getEvrakPageTotal(dosyaId) {
        console.log(`📊 Evrak sayfa sayısı alınıyor: ${dosyaId}`);
        const session = await this.ensureSession();
        const payload = { dosyaId: dosyaId.toString() };

        const response = await this._fetchWithSession('/listDosyaEvraklarPageTotal.ajx', payload, session);

        if (response && !response.error) {
            const pageTotal = parseInt(response) || 1;
            console.log(`✅ Toplam sayfa: ${pageTotal}`);
            return pageTotal;
        }

        return 1; // Default
    }


    // Helper: Valid Response Check
    isValidResponse(response) {
        if (!response || response.error || response.errorCode) return false;

        // Check for recognized data structures
        if (Array.isArray(response)) return true;
        if (response.data && Array.isArray(response.data)) return true;
        if (response.tarafListesi || response.taraflar) return true;
        // Check for normalized structure
        if (response.davaci || response.davali) return true;

        // EVRAK RESPONSE STRUCTURES
        if (response.tumEvraklar) return true;  // /list_dosya_evraklar.ajx
        if (response.son20Evrak && Array.isArray(response.son20Evrak)) return true;
        if (response.evrakListesi && Array.isArray(response.evrakListesi)) return true;

        return false;
    }

    // Helper: Normalize Response to Common Format
    normalizeResponse(response) {
        // If already normalized or raw array, return as is (UI handles it currently)
        // Or strictly normalize if UI logic expects it.
        // Current UI expects: { data: [...] } or [...] or { tarafListesi: [...] }

        // Let's inspect what we have and wrap it if needed to match UI expectations
        let parties = [];
        if (Array.isArray(response)) parties = response;
        else if (response.data && Array.isArray(response.data)) parties = response.data;
        else if (response.tarafListesi) parties = response.tarafListesi;
        else return response; // Unknown struct or already normalized

        return { data: parties }; // Wrapper to match existing UI logic
    }
    /**
     * Execute fetch and return Blob as Base64 (for file downloads)
     */
    async _fetchBlob(endpoint, payload, session) {
        const fullUrl = endpoint.startsWith('http') ? endpoint : (this.baseUrl + endpoint);

        const script = `
            (async () => {
                try {
                    // CONVERT PAYLOAD TO FORM URL ENCODED STRING
                    const formBody = [];
                    for (const property in ${JSON.stringify(payload)}) {
                        const encodedKey = encodeURIComponent(property);
                        const encodedValue = encodeURIComponent(${JSON.stringify(payload)}[property]);
                        formBody.push(encodedKey + "=" + encodedValue);
                    }
                    const formBodyString = formBody.join("&");

                    const headers = {
                        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                        'X-Requested-With': 'XMLHttpRequest'
                    };
                    
                    ${session.csrfToken ? `headers['X-CSRF-Token'] = '${session.csrfToken}';` : ''}
                    
                    const response = await fetch('${fullUrl}', {
                        method: 'POST',
                        headers: headers,
                        credentials: 'include',
                        body: formBodyString // Use string
                    });
                    
                    if (!response.ok) {
                        return { error: 'HTTP ' + response.status };
                    }
                    
                    const blob = await response.blob();
                    const filename = response.headers.get('content-disposition')?.split('filename=')[1]?.replace(/['"]/g, '') || 'evrak.udf';
                    
                    return await new Promise((resolve) => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve({
                            base64: reader.result.split(',')[1],
                            filename: filename,
                            mime: blob.type
                        });
                        reader.readAsDataURL(blob);
                    });

                } catch(error) {
                    return { error: error.message };
                }
            })();
        `;

        return await ipcRenderer.invoke('uyap-execute-script', script);
    }

    /**
     * Download a specific document
     */
    async downloadDocument(doc) {
        console.log(`Downloading doc: ${doc.evrakId || doc.id}...`);
        const session = await this.ensureSession();

        // Payload depends on what the endpoint expects. 
        // Standard UYAP usually wants evrakId and sometimes dosyaId.
        const payload = {
            evrakId: (doc.evrakId || doc.id).toString(),
            dosyaId: (doc.dosyaId || '').toString(),
            ...this.generatePayloads(doc.dosyaId || '', session)[1] // Add context if possible
        };

        // Try standard document reading endpoints
        // Note: Real endpoint might be /dosya/evrak/indir or /dosya_evrak_oku.ajx
        // We will try the most common one.
        const endpoint = '/dosya_evrak_oku.ajx';

        return await this._fetchBlob(endpoint, payload, session);
    }
}

// Export
if (typeof module !== 'undefined') module.exports = UYAPApi;
// Export for use in renderer process (index.html)
if (typeof module !== 'undefined') {
    module.exports = UYAPApi;
}
