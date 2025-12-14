
/**
 * UYAP API Wrapper - Enhanced Version
 * 
 * Comprehensive UYAP integration with features from imerek.js:
 * - Google Drive backup integration (NO Calendar - excluded per requirements)
 * - Google Tasks integration for notes
 * - Tebligat (notification) checking with PTT integration
 * - Document/Evrak handling with PDF parsing
 * - File/Dosya management with queuing
 * - Badge notifications and menu system
 * - Database operations with queue management
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

        // Queue management (from imerek.js UYAP_EXT.DB.queue)
        this.queue = {
            dosya: {},
            evrak: {},
            taraf: {},
            tebligat: {},
            dosyaAyrinti: {},
            tahsilat: {},
            borcluBilgileri: {}
        };

        // Google integration (NO CALENDAR - excluded per requirements)
        this.googleIntegration = {
            token: null,
            enabled: false,
            // Google Tasks for notes (Görev - included)
            tasks: {
                apiUrl: 'https://www.googleapis.com/tasks/v1',
                taskListId: null
            },
            // Google Drive for backup (included)
            drive: {
                apiUrl: 'https://www.googleapis.com/drive/v3',
                appDataFolder: 'appDataFolder'
            }
        };

        // Badge and notification system
        this.badges = {
            dosyalar: 0,
            evraklar: 0,
            tebligatlar: 0,
            islemlerim: 0,
            notlarim: 0
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
            (function() {
                // Tüm olası session kaynaklarını kontrol et
                var jsessionidMatch = document.cookie.match(/JSESSIONID=([^;]+)/);
                var uyapSessionMatch = document.cookie.match(/UYAP_SESSION=([^;]+)/);
                var birimIdInput = document.querySelector('input[name="birimId"][type="hidden"]');
                var kullaniciIdInput = document.querySelector('input[name="kullaniciId"][type="hidden"]');
                var csrfTokenMeta = document.querySelector('meta[name="csrf-token"]');
                
                var session = {
                    // 1. Cookie'ler
                    cookies: document.cookie,
                    jsessionid: jsessionidMatch ? jsessionidMatch[1] : null,
                    uyapSession: uyapSessionMatch ? uyapSessionMatch[1] : null,
                    
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
                    hiddenBirimId: birimIdInput ? birimIdInput.value : null,
                    hiddenKullaniciId: kullaniciIdInput ? kullaniciIdInput.value : null,
                    
                    // 5. Meta tag'ler
                    csrfToken: csrfTokenMeta ? csrfTokenMeta.content : null,
                    
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

    /**
     * ============================================
     * GOOGLE INTEGRATION (NO CALENDAR)
     * Features from imerek.js UYAP_EXT.GOOGLE
     * ============================================
     */

    /**
     * Get Google access token
     * Note: Calendar functionality excluded per requirements
     */
    async getGoogleAccessToken() {
        if (this.googleIntegration.token) {
            return this.googleIntegration.token;
        }

        // Check localStorage for existing token
        const script = `
            (() => {
                return localStorage.getItem('_token');
            })();
        `;

        try {
            const token = await ipcRenderer.invoke('uyap-execute-script', script);
            if (token && !token.error) {
                this.googleIntegration.token = token;
                return token;
            }
        } catch (error) {
            console.warn('❌ Google token alınamadı:', error);
        }

        return null;
    }

    /**
     * Google Tasks Integration (for notes/görev)
     * Create a task from a note
     */
    async createGoogleTask(title, notes, dueDate = null) {
        const token = await this.getGoogleAccessToken();
        if (!token) {
            console.warn('Google Tasks: Token bulunamadı');
            return { error: 'Token bulunamadı' };
        }

        // Ensure task list exists
        if (!this.googleIntegration.tasks.taskListId) {
            const taskLists = await this.getGoogleTaskLists();
            if (taskLists && taskLists.items && taskLists.items.length > 0) {
                this.googleIntegration.tasks.taskListId = taskLists.items[0].id;
            }
        }

        const task = {
            title: title,
            notes: notes
        };

        if (dueDate) {
            task.due = new Date(dueDate).toISOString();
        }

        // Properly escape values for security (escape both backslashes and quotes)
        const escapeForTemplate = (str) => String(str).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        const escapedToken = escapeForTemplate(token);
        const escapedTaskListId = escapeForTemplate(this.googleIntegration.tasks.taskListId);
        const taskJson = JSON.stringify(task).replace(/\\/g, '\\\\').replace(/'/g, "\\'");

        const script = `
            (async () => {
                try {
                    const response = await fetch('${this.googleIntegration.tasks.apiUrl}/lists/${escapedTaskListId}/tasks', {
                        method: 'POST',
                        headers: {
                            'Authorization': 'Bearer ${escapedToken}',
                            'Content-Type': 'application/json'
                        },
                        body: '${taskJson}'
                    });
                    
                    if (!response.ok) {
                        return { error: 'HTTP ' + response.status };
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
     * Get Google Task Lists
     */
    async getGoogleTaskLists() {
        const token = await this.getGoogleAccessToken();
        if (!token) {
            return { error: 'Token bulunamadı' };
        }

        const script = `
            (async () => {
                try {
                    const response = await fetch('${this.googleIntegration.tasks.apiUrl}/users/@me/lists', {
                        method: 'GET',
                        headers: {
                            'Authorization': 'Bearer ${token}'
                        }
                    });
                    
                    if (!response.ok) {
                        return { error: 'HTTP ' + response.status };
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
     * Google Drive Integration (for backup)
     * Search for backup files in appDataFolder
     */
    async searchGoogleDriveBackups(avukatId) {
        const token = await this.getGoogleAccessToken();
        if (!token) {
            return { error: 'Token bulunamadı' };
        }

        // Validate and escape inputs (escape both backslashes and quotes)
        const escapeForTemplate = (str) => String(str).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        const escapedToken = escapeForTemplate(token);
        const escapedAvukatId = String(avukatId).replace(/[^a-zA-Z0-9]/g, '');
        const fileName = `${escapedAvukatId}.json`;
        const escapedFolder = escapeForTemplate(this.googleIntegration.drive.appDataFolder);
        const query = `name='${fileName}' and '${escapedFolder}' in parents`;
        const encodedQuery = encodeURIComponent(query);

        const script = `
            (async () => {
                try {
                    const response = await fetch('${this.googleIntegration.drive.apiUrl}/files?spaces=appDataFolder&fields=*&orderBy=createdTime desc&q=${encodedQuery}', {
                        method: 'GET',
                        headers: {
                            'Authorization': 'Bearer ${escapedToken}'
                        }
                    });
                    
                    if (!response.ok) {
                        return { error: 'HTTP ' + response.status };
                    }
                    
                    const data = await response.json();
                    return data.files || [];
                } catch(error) {
                    return { error: error.message };
                }
            })();
        `;

        return await ipcRenderer.invoke('uyap-execute-script', script);
    }

    /**
     * Upload backup to Google Drive
     */
    async uploadToGoogleDrive(data, fileName, description = '') {
        const token = await this.getGoogleAccessToken();
        if (!token) {
            return { error: 'Token bulunamadı' };
        }

        const metadata = {
            name: fileName,
            mimeType: 'application/json',
            parents: [this.googleIntegration.drive.appDataFolder],
            description: description
        };

        // Escape values properly (escape both backslashes and quotes)
        const escapeForTemplate = (str) => String(str).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        const escapedToken = escapeForTemplate(token);
        const metadataJson = JSON.stringify(metadata);
        const dataJson = JSON.stringify(data);

        const script = `
            (async () => {
                try {
                    const formData = new FormData();
                    const metadataBlob = new Blob([${JSON.stringify(metadataJson)}], { type: 'application/json' });
                    const dataBlob = new Blob([${JSON.stringify(dataJson)}], { type: 'application/json' });
                    
                    formData.append('metadata', metadataBlob);
                    formData.append('file', dataBlob);
                    
                    const response = await fetch('${this.googleIntegration.drive.apiUrl}/upload/drive/v3/files?uploadType=multipart&fields=*', {
                        method: 'POST',
                        headers: {
                            'Authorization': 'Bearer ${escapedToken}'
                        },
                        body: formData
                    });
                    
                    if (!response.ok) {
                        return { error: 'HTTP ' + response.status };
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
     * Download backup from Google Drive
     */
    async downloadFromGoogleDrive(fileId, progressCallback = null) {
        const token = await this.getGoogleAccessToken();
        if (!token) {
            return { error: 'Token bulunamadı' };
        }

        const script = `
            (async () => {
                try {
                    const response = await fetch('${this.googleIntegration.drive.apiUrl}/files/${fileId}?alt=media', {
                        method: 'GET',
                        headers: {
                            'Authorization': 'Bearer ${token}',
                            'Accept': 'application/json'
                        }
                    });
                    
                    if (!response.ok) {
                        return { error: 'HTTP ' + response.status };
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
     * Delete backup file from Google Drive
     */
    async deleteFromGoogleDrive(fileId) {
        const token = await this.getGoogleAccessToken();
        if (!token) {
            return { error: 'Token bulunamadı' };
        }

        const script = `
            (async () => {
                try {
                    const response = await fetch('${this.googleIntegration.drive.apiUrl}/files/${fileId}', {
                        method: 'DELETE',
                        headers: {
                            'Authorization': 'Bearer ${token}'
                        }
                    });
                    
                    if (!response.ok) {
                        return { error: 'HTTP ' + response.status };
                    }
                    
                    return { success: true };
                } catch(error) {
                    return { error: error.message };
                }
            })();
        `;

        return await ipcRenderer.invoke('uyap-execute-script', script);
    }

    /**
     * ============================================
     * TEBLIGAT (NOTIFICATION) OPERATIONS
     * Features from imerek.js UYAP_EXT.DB.tebligatCheck
     * ============================================
     */

    /**
     * Check tebligat status with PTT integration
     */
    async checkTebligatStatus(tebligatList) {
        console.log(`📮 Tebligatlar kontrol ediliyor: ${tebligatList.length} adet`);
        
        const results = [];
        
        for (let i = 0; i < tebligatList.length; i++) {
            const tebligat = tebligatList[i];
            
            // Check if it's eTebligat (electronic notification)
            if (tebligat.eTebligat) {
                // For eTebligat, calculate delivery based on date
                const result = this.calculateETebligatStatus(tebligat);
                results.push(result);
            } else if (tebligat.barkodNo && tebligat.barkodNo > 0) {
                // For physical delivery, check with PTT (via main process)
                try {
                    const pttResult = await ipcRenderer.invoke('check-ptt-status', {
                        barkodNo: tebligat.barkodNo,
                        index: i,
                        total: tebligatList.length
                    });
                    
                    results.push({
                        ...tebligat,
                        ...pttResult,
                        checked: true
                    });
                } catch (error) {
                    console.error(`PTT kontrolü hatası (${tebligat.barkodNo}):`, error);
                    results.push({
                        ...tebligat,
                        error: error.message,
                        checked: false
                    });
                }
            } else {
                // No barcode, can't track
                results.push({
                    ...tebligat,
                    durum: 'BARKOD BULUNAMADI',
                    checked: false
                });
            }
        }
        
        console.log(`✅ Tebligat kontrolü tamamlandı: ${results.length} adet`);
        return results;
    }

    /**
     * Calculate eTebligat (electronic notification) status
     * eTebligat is considered delivered 5 days after being sent
     */
    calculateETebligatStatus(tebligat) {
        const sentDate = new Date(tebligat.evrakTarihi || tebligat.lastStateTarihi);
        const now = new Date();
        const daysSinceSent = Math.ceil((now - sentDate) / (1000 * 60 * 60 * 24));
        
        const result = { ...tebligat };
        
        if (daysSinceSent >= 5) {
            const deliveryDate = new Date(sentDate);
            deliveryDate.setDate(sentDate.getDate() + 5);
            
            result.isLastState = 2; // Delivered
            result.lastStateTarihi = deliveryDate;
            result.durum = `${Math.abs(daysSinceSent - 5)} GÜN ÖNCE UETS HESABINDA TEBLİĞ EDİLDİ`;
        } else {
            result.isLastState = 0; // Waiting
            result.lastStateTarihi = sentDate;
            result.durum = `UETS HESABINDA BEKLEMEDE(${daysSinceSent}. GÜN)`;
        }
        
        return result;
    }

    /**
     * Parse PDF for tebligat information
     * Extract barcode and content from notification PDF
     */
    async parseTebligatPDF(pdfData) {
        // This would typically use a PDF parsing library
        // For now, return a placeholder structure
        console.log('📄 Tebligat PDF ayrıştırılıyor...');
        
        try {
            // PDF parsing would happen here
            // Using ipcRenderer to delegate to main process if needed
            const result = await ipcRenderer.invoke('parse-tebligat-pdf', pdfData);
            
            return {
                barkodNo: result.barkodNo || 0,
                icerik: result.icerik || '?',
                eTebligat: result.eTebligat || false
            };
        } catch (error) {
            console.error('PDF ayrıştırma hatası:', error);
            return {
                barkodNo: 0,
                icerik: '?',
                eTebligat: false,
                error: error.message
            };
        }
    }

    /**
     * ============================================
     * DOSYA (FILE) OPERATIONS
     * Features from imerek.js UYAP_EXT.DB
     * ============================================
     */

    /**
     * Get file details with retry logic
     */
    async getDosyaDetails(dosyaId, includeDetails = true) {
        console.log(`📁 Dosya detayları alınıyor: ${dosyaId}`);
        
        const session = await this.ensureSession();
        let details = {};
        
        // Get basic file info
        const payload = { dosyaId: dosyaId.toString() };
        
        // Get file details
        if (includeDetails) {
            const detailsResponse = await this._fetchWithSession('/dosyaAyrintiBilgileri_brd.ajx', payload, session);
            if (this.isValidResponse(detailsResponse)) {
                details = detailsResponse;
            }
        }
        
        // Get parties
        const parties = await this.getParties(dosyaId);
        
        // Get documents summary
        const evrakPageTotal = await this.getEvrakPageTotal(dosyaId);
        
        return {
            dosyaId: dosyaId,
            details: details,
            parties: parties,
            evrakPageTotal: evrakPageTotal,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Sync file from UYAP with queue management
     */
    async syncDosya(dosyaId) {
        // Check if already in queue
        if (this.queue.dosya[dosyaId]) {
            console.log(`⏳ Dosya zaten kuyrukta: ${dosyaId}`);
            return this.queue.dosya[dosyaId];
        }
        
        // Add to queue
        const queueId = this.generateQueueId();
        this.queue.dosya[queueId] = new Promise(async (resolve, reject) => {
            try {
                console.log(`🔄 Dosya senkronize ediliyor: ${dosyaId}`);
                
                const dosyaData = await this.getDosyaDetails(dosyaId, true);
                
                console.log(`✅ Dosya senkronize edildi: ${dosyaId}`);
                resolve(dosyaData);
            } catch (error) {
                console.error(`❌ Dosya senkronizasyon hatası: ${dosyaId}`, error);
                reject(error);
            } finally {
                // Remove from queue
                delete this.queue.dosya[queueId];
            }
        });
        
        return this.queue.dosya[queueId];
    }

    /**
     * Generate unique queue ID
     */
    generateQueueId() {
        // Use crypto for better randomness and avoid collisions
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            return crypto.randomUUID();
        }
        // Fallback to more robust random generation
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    /**
     * ============================================
     * BADGE AND NOTIFICATION SYSTEM
     * Features from imerek.js UYAP_EXT.MENU
     * ============================================
     */

    /**
     * Update badge counts
     */
    async updateBadges(counts) {
        if (counts.dosyalar !== undefined) this.badges.dosyalar = counts.dosyalar;
        if (counts.evraklar !== undefined) this.badges.evraklar = counts.evraklar;
        if (counts.tebligatlar !== undefined) this.badges.tebligatlar = counts.tebligatlar;
        if (counts.islemlerim !== undefined) this.badges.islemlerim = counts.islemlerim;
        if (counts.notlarim !== undefined) this.badges.notlarim = counts.notlarim;
        
        console.log('🔔 Badge güncellendi:', this.badges);
        
        // Emit event for UI update
        if (typeof window !== 'undefined' && window.dispatchEvent) {
            window.dispatchEvent(new CustomEvent('uyap-badges-updated', {
                detail: this.badges
            }));
        }
        
        return this.badges;
    }

    /**
     * Get current badge counts
     */
    getBadges() {
        return { ...this.badges };
    }

    /**
     * Reset all badges
     */
    resetBadges() {
        this.badges = {
            dosyalar: 0,
            evraklar: 0,
            tebligatlar: 0,
            islemlerim: 0,
            notlarim: 0
        };
        return this.badges;
    }

    /**
     * ============================================
     * NOTE MANAGEMENT SYSTEM
     * Features from imerek.js UYAP_EXT.DB.notuAl/notuKaydet
     * ============================================
     */

    /**
     * Save a note
     */
    async saveNote(kaynakId, noteText, noteType = 'dosya') {
        console.log(`📝 Not kaydediliyor: ${kaynakId}`);
        
        try {
            const noteData = {
                type: noteType,
                alinan_not: noteText,
                kaynakId: kaynakId,
                created_tarihi: new Date().toISOString(),
                creator: 'user' // Would be replaced with actual user info
            };
            
            // Save via IPC to main process (database operation)
            const result = await ipcRenderer.invoke('save-note', noteData);
            
            if (result && !result.error) {
                console.log(`✅ Not kaydedildi: ${kaynakId}`);
                // Update badge
                await this.updateBadges({ notlarim: (this.badges.notlarim || 0) + 1 });
            }
            
            return result;
        } catch (error) {
            console.error('Not kaydetme hatası:', error);
            return { error: error.message };
        }
    }

    /**
     * Get notes for a source
     */
    async getNotes(kaynakId, noteType = 'dosya', limit = 10) {
        console.log(`📖 Notlar alınıyor: ${kaynakId}`);
        
        try {
            const result = await ipcRenderer.invoke('get-notes', {
                kaynakId: kaynakId,
                type: noteType,
                limit: limit
            });
            
            return result || [];
        } catch (error) {
            console.error('Not alma hatası:', error);
            return { error: error.message };
        }
    }

    /**
     * Delete a note
     */
    async deleteNote(noteId) {
        console.log(`🗑️ Not siliniyor: ${noteId}`);
        
        try {
            const result = await ipcRenderer.invoke('delete-note', noteId);
            
            if (result && !result.error) {
                console.log(`✅ Not silindi: ${noteId}`);
                // Update badge
                const currentCount = Math.max(0, (this.badges.notlarim || 0) - 1);
                await this.updateBadges({ notlarim: currentCount });
            }
            
            return result;
        } catch (error) {
            console.error('Not silme hatası:', error);
            return { error: error.message };
        }
    }

    /**
     * ============================================
     * TAHSILAT (PAYMENT) OPERATIONS
     * Features from imerek.js UYAP_EXT.DB
     * ============================================
     */

    /**
     * Get payment/collection information for a file
     */
    async getTahsilatBilgileri(dosyaId, dosyaTurKod = 1) {
        console.log(`💰 Tahsilat bilgileri alınıyor: ${dosyaId}`);
        
        try {
            const session = await this.ensureSession();
            const payload = {
                dosyaId: dosyaId.toString(),
                dosyaTurKod: dosyaTurKod
            };
            
            const response = await this._fetchWithSession('/dosya_tahsilat_reddiyat_bilgileri_brd.ajx', payload, session);
            
            if (this.isValidResponse(response)) {
                console.log(`✅ Tahsilat bilgileri alındı: ${dosyaId}`);
                
                // Parse the response
                return {
                    toplamTahsilat: response.toplamTahsilat || 0,
                    toplamReddiyat: response.toplamreddiyat || 0,
                    toplamTahsilHarci: response.toplamTahsilHarci || 0,
                    toplamKalan: response.toplamKalan || 0,
                    toplamTeminat: response.toplamTeminat || 0,
                    harcList: response.harcList || [],
                    tahsilatList: response.tahsilatList || [],
                    reddiyatList: response.reddiyatList || [],
                    haricen: response.haricen,
                    isIcraMi: response.isIcraMi
                };
            }
            
            return { error: 'Tahsilat bilgileri alınamadı' };
        } catch (error) {
            console.error('Tahsilat bilgileri alma hatası:', error);
            return { error: error.message };
        }
    }

    /**
     * ============================================
     * SAFAHAT (CASE PHASE) OPERATIONS
     * Features from imerek.js UYAP_EXT.DB
     * ============================================
     */

    /**
     * Query safahat (case phases) for a date range
     */
    async querySafahat(yargiTuru, yargiBirimi, baslangicTarihi, bitisTarihi, safahatTuru = '') {
        console.log(`📅 Safahat sorgulanıyor: ${yargiBirimi}`);
        
        try {
            const session = await this.ensureSession();
            
            // Format dates as DD.MM.YYYY with proper padding
            const formatDate = (date) => {
                const d = new Date(date);
                const day = String(d.getDate()).padStart(2, '0');
                const month = String(d.getMonth() + 1).padStart(2, '0');
                const year = d.getFullYear();
                return `${day}.${month}.${year}`;
            };
            
            const payload = {
                baslangicTarihi: formatDate(baslangicTarihi),
                bitisTarihi: formatDate(bitisTarihi),
                safahatTuru: safahatTuru,
                yargiBirimi: yargiBirimi,
                yargiTuru: yargiTuru
            };
            
            const response = await this._fetchWithSession('/avukat_safahat_sorgula_brd.ajx', payload, session);
            
            if (this.isValidResponse(response)) {
                console.log(`✅ Safahat sorgulandı: ${response.length || 0} kayıt`);
                return response;
            }
            
            return { error: 'Safahat sorgulanamadı' };
        } catch (error) {
            console.error('Safahat sorgulama hatası:', error);
            return { error: error.message };
        }
    }

    /**
     * Query all judicial units for safahat
     */
    async queryAllSafahat(yargiTuru, baslangicTarihi, bitisTarihi) {
        console.log(`📊 Tüm birimler için safahat sorgulanıyor...`);
        
        try {
            const session = await this.ensureSession();
            
            // First, get judicial units
            const unitsPayload = { yargiTuru: yargiTuru };
            const unitsResponse = await this._fetchWithSession('/yargiBirimleriSorgula_brd.ajx', unitsPayload, session);
            
            if (!this.isValidResponse(unitsResponse)) {
                return { error: 'Yargı birimleri alınamadı' };
            }
            
            const allSafahat = [];
            const units = Array.isArray(unitsResponse) ? unitsResponse : unitsResponse.data || [];
            
            // Query each unit
            for (let i = 0; i < units.length; i++) {
                const unit = units[i];
                console.log(`  Sorgulanıyor: ${unit.kod} (${i + 1}/${units.length})`);
                
                const safahat = await this.querySafahat(
                    yargiTuru,
                    unit.tablo,
                    baslangicTarihi,
                    bitisTarihi
                );
                
                if (Array.isArray(safahat)) {
                    allSafahat.push(...safahat);
                }
            }
            
            console.log(`✅ Toplam ${allSafahat.length} safahat kaydı bulundu`);
            return allSafahat;
            
        } catch (error) {
            console.error('Tüm safahat sorgulama hatası:', error);
            return { error: error.message };
        }
    }

    /**
     * ============================================
     * ERROR HANDLING AND RETRY LOGIC
     * Features from imerek.js UYAP_EXT.TOOL.errors
     * ============================================
     */

    /**
     * Common UYAP errors
     */
    getErrorCodes() {
        return {
            DOSYA_BULUNAMADI: {
                errorCode: '404',
                error: 'Dosya bulunamadı',
                message: 'Dosya sistemde bulunamadı veya erişim izniniz yok'
            },
            OTURUM_KAPALI: {
                errorCode: '401',
                error: 'Oturum kapalı',
                message: 'UYAP oturumunuz kapalı, lütfen tekrar giriş yapın'
            },
            YETKISIZ_ISLEM: {
                errorCode: '403',
                error: 'Yetkisiz işlem',
                message: 'Bu işlem için yetkiniz bulunmuyor'
            },
            SUNUCU_HATASI: {
                errorCode: '500',
                error: 'Sunucu hatası',
                message: 'UYAP sunucusunda bir hata oluştu'
            },
            DOSYA_AKTIF_DEGIL: {
                errorCode: 'DOSYA_INACTIVE',
                error: 'Dosya aktif değil',
                message: 'Dosya kapatılmış veya arşivlenmiş'
            },
            ZAMAN_ASIMI: {
                errorCode: 'TIMEOUT',
                error: 'Zaman aşımı',
                message: 'İşlem süresi doldu, lütfen tekrar deneyin'
            }
        };
    }

    /**
     * Handle UYAP API errors with retry logic
     */
    async handleError(error, context = {}, retryCount = 0, maxRetries = 3) {
        const errors = this.getErrorCodes();
        
        console.error(`❌ UYAP Hatası (Deneme ${retryCount + 1}/${maxRetries}):`, error);
        
        // Session expired - refresh and retry
        if (error.includes('401') || error.includes('OTURUM')) {
            if (retryCount < maxRetries) {
                console.log('🔄 Oturum yenileniyor...');
                await this.initializeSession();
                return { shouldRetry: true, retryCount: retryCount + 1 };
            }
        }
        
        // File not found - might need to update dosyaId
        if (error.includes('404') || error.includes('DOSYA_BULUNAMADI')) {
            if (retryCount < maxRetries && context.dosyaId) {
                console.log('🔄 Dosya ID güncelleniyor...');
                // Would call updateDosyaId here
                return { shouldRetry: true, retryCount: retryCount + 1 };
            }
        }
        
        // Server error - retry with exponential backoff
        if (error.includes('500') || error.includes('SUNUCU')) {
            if (retryCount < maxRetries) {
                const delay = Math.pow(2, retryCount) * 1000; // Exponential backoff
                console.log(`⏳ ${delay}ms beklenip tekrar denenecek...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                return { shouldRetry: true, retryCount: retryCount + 1 };
            }
        }
        
        // No more retries
        return { shouldRetry: false, error: error };
    }

    /**
     * Execute with retry logic
     */
    async executeWithRetry(asyncFunction, context = {}, maxRetries = 3) {
        let retryCount = 0;
        let lastError = null;
        
        while (retryCount <= maxRetries) {
            try {
                const result = await asyncFunction();
                return result;
            } catch (error) {
                lastError = error;
                const errorHandler = await this.handleError(error.message || error, context, retryCount, maxRetries);
                
                if (errorHandler.shouldRetry) {
                    retryCount = errorHandler.retryCount;
                    continue;
                } else {
                    break;
                }
            }
        }
        
        // All retries failed
        console.error(`❌ Tüm denemeler başarısız oldu:`, lastError);
        return { error: lastError };
    }

    /**
     * ============================================
     * UTILITY FUNCTIONS
     * ============================================
     */

    /**
     * Get yargi turu (court type) code
     */
    getYargiTuruCode(birimTuru3) {
        const mapping = {
            '0991': 1, // Adli Yargı
            '0992': 2, // İdari Yargı
            '6700': 3  // Askeri Yargı
        };
        return mapping[birimTuru3] || 1;
    }

    /**
     * Format dosya number
     */
    formatDosyaNo(dosyaNo) {
        if (!dosyaNo) return '';
        
        // UYAP dosya format: YYYY/XXXXX (5 digit sıra number)
        const DOSYA_SIRA_LENGTH = 5;
        
        // Format: YYYY/XXXXX
        const parts = dosyaNo.split('/');
        if (parts.length === 2) {
            return `${parts[0]}/${parts[1].padStart(DOSYA_SIRA_LENGTH, '0')}`;
        }
        return dosyaNo;
    }

    /**
     * Parse dosya number
     */
    parseDosyaNo(dosyaNo) {
        const parts = dosyaNo.split('/');
        if (parts.length === 2) {
            return {
                yil: parseInt(parts[0]),
                sira: parseInt(parts[1])
            };
        }
        return null;
    }

    /**
     * Check if dosya is active
     */
    isDosyaActive(dosya) {
        if (!dosya) return false;
        
        // Check various status indicators
        if (dosya.dosyaDurumKod === 0 || dosya.dosyaDurumKod === '0') return false;
        if (dosya.genelDosyaDurumu === 'Arşivde') return false;
        if (dosya.durumAdi === 'Arşivde') return false;
        if (dosya.is_aktif === false || dosya.is_aktif === 'false') return false;
        
        return true;
    }

    /**
     * ============================================
     * YARGITAY (SUPREME COURT) OPERATIONS
     * Features from imerek.js for Yargıtay
     * ============================================
     */

    /**
     * Get Yargıtay chambers (daireler)
     */
    async getYargitayDaireleri() {
        console.log('🏛️ Yargıtay daireleri alınıyor...');
        
        try {
            const session = await this.ensureSession();
            const response = await this._fetchWithSession('/getYargitayDaireleri.ajx', {}, session);
            
            if (this.isValidResponse(response)) {
                console.log(`✅ ${response.length || 0} Yargıtay dairesi bulundu`);
                return response;
            }
            
            return { error: 'Yargıtay daireleri alınamadı' };
        } catch (error) {
            console.error('Yargıtay daireleri alma hatası:', error);
            return { error: error.message };
        }
    }

    /**
     * Get Yargıtay files
     */
    async getYargitayDosyalar(yargitayDairesi) {
        console.log(`📁 Yargıtay dosyaları alınıyor (Daire: ${yargitayDairesi})...`);
        
        try {
            const session = await this.ensureSession();
            const payload = { yargitayDairesi: yargitayDairesi };
            const response = await this._fetchWithSession('/getYargitayDosyalar_brd.ajx', payload, session);
            
            if (this.isValidResponse(response)) {
                console.log(`✅ ${response.length || 0} Yargıtay dosyası bulundu`);
                return response;
            }
            
            return { error: 'Yargıtay dosyaları alınamadı' };
        } catch (error) {
            console.error('Yargıtay dosyaları alma hatası:', error);
            return { error: error.message };
        }
    }

    /**
     * Get Yargıtay file details
     */
    async getYargitayDosyaDetay(dosyaId) {
        console.log(`📋 Yargıtay dosya detayı alınıyor: ${dosyaId}`);
        
        try {
            const session = await this.ensureSession();
            const payload = { dosyaId: dosyaId.toString() };
            const response = await this._fetchWithSession('/yargitayDosyaAyrintiBilgileri_brd.ajx', payload, session);
            
            if (this.isValidResponse(response)) {
                console.log(`✅ Yargıtay dosya detayı alındı`);
                return response.yargitaySorguDosyaDetayDVO || response;
            }
            
            return { error: 'Yargıtay dosya detayı alınamadı' };
        } catch (error) {
            console.error('Yargıtay dosya detayı alma hatası:', error);
            return { error: error.message };
        }
    }

    /**
     * ============================================
     * DANIŞTAY (COUNCIL OF STATE) OPERATIONS
     * Features from imerek.js for Danıştay
     * ============================================
     */

    /**
     * Get Danıştay chambers (daireler)
     */
    async getDanistayDaireleri() {
        console.log('🏛️ Danıştay daireleri alınıyor...');
        
        try {
            const session = await this.ensureSession();
            const response = await this._fetchWithSession('/avukatDanistayDaireSorgula.ajx', {}, session);
            
            if (this.isValidResponse(response)) {
                console.log(`✅ ${response.length || 0} Danıştay dairesi bulundu`);
                return response;
            }
            
            return { error: 'Danıştay daireleri alınamadı' };
        } catch (error) {
            console.error('Danıştay daireleri alma hatası:', error);
            return { error: error.message };
        }
    }

    /**
     * Get Danıştay files
     */
    async getDanistayDosyalar(danistayDairesi) {
        console.log(`📁 Danıştay dosyaları alınıyor (Daire: ${danistayDairesi})...`);
        
        try {
            const session = await this.ensureSession();
            const payload = { danistayDairesi: danistayDairesi };
            const response = await this._fetchWithSession('/avukatDanistayDosyaSorgula.ajx', payload, session);
            
            if (this.isValidResponse(response)) {
                console.log(`✅ ${response.length || 0} Danıştay dosyası bulundu`);
                return response;
            }
            
            return { error: 'Danıştay dosyaları alınamadı' };
        } catch (error) {
            console.error('Danıştay dosyaları alma hatası:', error);
            return { error: error.message };
        }
    }

    /**
     * Get Danıştay file details
     */
    async getDanistayDosyaDetay(dosyaId) {
        console.log(`📋 Danıştay dosya detayı alınıyor: ${dosyaId}`);
        
        try {
            const session = await this.ensureSession();
            const payload = { dosyaId: dosyaId.toString() };
            const response = await this._fetchWithSession('/danistayDosyaAyrintiBilgileri_brd.ajx', payload, session);
            
            if (this.isValidResponse(response)) {
                console.log(`✅ Danıştay dosya detayı alındı`);
                return response;
            }
            
            return { error: 'Danıştay dosya detayı alınamadı' };
        } catch (error) {
            console.error('Danıştay dosya detayı alma hatası:', error);
            return { error: error.message };
        }
    }

    /**
     * ============================================
     * CBS (CUMHURIYET BAŞSAVCILIK) OPERATIONS
     * Features from imerek.js for CBS
     * ============================================
     */

    /**
     * Get provinces (iller) for CBS queries
     */
    async getIller() {
        console.log('🗺️ İller alınıyor...');
        
        try {
            const session = await this.ensureSession();
            const response = await this._fetchWithSession('/illeri_getirJSON.ajx', {}, session);
            
            if (this.isValidResponse(response)) {
                console.log(`✅ ${response.length || 0} il bulundu`);
                return response;
            }
            
            return { error: 'İller alınamadı' };
        } catch (error) {
            console.error('İller alma hatası:', error);
            return { error: error.message };
        }
    }

    /**
     * Query CBS units (birimler) for a province
     */
    async getCbsBirimler(ilKodu) {
        console.log(`🏢 CBS birimleri alınıyor (İl: ${ilKodu})...`);
        
        try {
            const session = await this.ensureSession();
            const payload = { ilKodu: ilKodu };
            const response = await this._fetchWithSession('/cbs_birim_sorgula.ajx', payload, session);
            
            if (this.isValidResponse(response)) {
                console.log(`✅ ${response.length || 0} CBS birimi bulundu`);
                return response;
            }
            
            return { error: 'CBS birimleri alınamadı' };
        } catch (error) {
            console.error('CBS birimleri alma hatası:', error);
            return { error: error.message };
        }
    }

    /**
     * Query CBS files
     */
    async getCbsDosyalar(birimId, dosyaDurumKod = 1) {
        console.log(`📁 CBS dosyaları alınıyor (Birim: ${birimId})...`);
        
        try {
            const session = await this.ensureSession();
            const payload = {
                birimId: birimId || '',
                birimTuru2: birimId,
                birimTuru3: '3', // CBS
                dosyaDurumKod: dosyaDurumKod,
                pageNumber: 1,
                pageSize: 500
            };
            
            const response = await this._fetchWithSession('/avukat_dosya_sorgula_cbs_brd.ajx', payload, session);
            
            if (this.isValidResponse(response)) {
                console.log(`✅ ${response.length || 0} CBS dosyası bulundu`);
                return response;
            }
            
            return { error: 'CBS dosyaları alınamadı' };
        } catch (error) {
            console.error('CBS dosyaları alma hatası:', error);
            return { error: error.message };
        }
    }

    /**
     * Sync all CBS files across all provinces
     * Warning: This is a long-running operation
     */
    async syncAllCbsDosyalar(progressCallback = null) {
        console.log('🔄 Tüm CBS dosyaları senkronize ediliyor...');
        
        try {
            // Get all provinces
            const iller = await this.getIller();
            if (!Array.isArray(iller)) {
                return { error: 'İller alınamadı' };
            }
            
            let totalDosyalar = [];
            
            for (let i = 0; i < iller.length; i++) {
                const il = iller[i];
                
                if (progressCallback) {
                    progressCallback({
                        stage: 'il',
                        current: i + 1,
                        total: iller.length,
                        ilAdi: il.ilAdi || il.il
                    });
                }
                
                // Get CBS units for this province
                const birimler = await this.getCbsBirimler(il.il);
                
                if (Array.isArray(birimler)) {
                    for (let j = 0; j < birimler.length; j++) {
                        const birim = birimler[j];
                        
                        if (progressCallback) {
                            progressCallback({
                                stage: 'birim',
                                ilCurrent: i + 1,
                                ilTotal: iller.length,
                                birimCurrent: j + 1,
                                birimTotal: birimler.length
                            });
                        }
                        
                        // Get files for this unit
                        const dosyalar = await this.getCbsDosyalar(birim.birimId);
                        
                        if (Array.isArray(dosyalar)) {
                            totalDosyalar.push(...dosyalar);
                        }
                    }
                }
            }
            
            console.log(`✅ Toplam ${totalDosyalar.length} CBS dosyası senkronize edildi`);
            return totalDosyalar;
            
        } catch (error) {
            console.error('CBS dosyaları senkronizasyon hatası:', error);
            return { error: error.message };
        }
    }

    /**
     * ============================================
     * ADVANCED SEARCH OPERATIONS
     * ============================================
     */

    /**
     * Advanced file search
     */
    async searchDosyalar(criteria) {
        console.log('🔍 Gelişmiş dosya araması yapılıyor...', criteria);
        
        try {
            const session = await this.ensureSession();
            
            const payload = {
                birimTuru3: criteria.yargiTuru || '',
                birimTuru2: criteria.birimId || '',
                birimId: criteria.birimId || '',
                dosyaDurumKod: criteria.dosyaDurumKod !== undefined ? criteria.dosyaDurumKod : 1,
                dosyaYil: criteria.dosyaYil || '',
                dosyaSira: criteria.dosyaSira || '',
                pageNumber: criteria.pageNumber || 1,
                pageSize: criteria.pageSize || 500
            };
            
            const response = await this._fetchWithSession('/search_phrase_detayli.ajx', payload, session);
            
            if (this.isValidResponse(response)) {
                console.log(`✅ ${response.length || 0} dosya bulundu`);
                return response;
            }
            
            return { error: 'Dosya bulunamadı' };
        } catch (error) {
            console.error('Dosya arama hatası:', error);
            return { error: error.message };
        }
    }

    /**
     * Search by file number
     */
    async searchByDosyaNo(dosyaNo, birimId = '', yargiTuru = '') {
        const parsed = this.parseDosyaNo(dosyaNo);
        if (!parsed) {
            return { error: 'Geçersiz dosya numarası formatı' };
        }
        
        return await this.searchDosyalar({
            birimId: birimId,
            yargiTuru: yargiTuru,
            dosyaYil: parsed.yil,
            dosyaSira: parsed.sira
        });
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
                    const contentDisposition = response.headers.get('content-disposition');
                    let filename = 'evrak.udf';
                    if (contentDisposition) {
                        const filenamePart = contentDisposition.split('filename=')[1];
                        if (filenamePart) {
                            filename = filenamePart.replace(/['"]/g, '');
                        }
                    }
                    
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
