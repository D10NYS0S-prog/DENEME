/**
 * UYAP Evrak Automation Module
 * 
 * Evraklara ulaşmak için gereken UI automation:
 * 1. Dosyaya gir
 * 2. "Evrak" butonuna tıkla
 * 3. "Tüm Evrak" seç
 * 4. 3 farklı klasörü (Gelen, Giden, Diğer) ayrı ayrı seç ve evrakları topla
 */

class UYAPEvrakAutomation {
    constructor() {
        this.delay = (ms) => new Promise(r => setTimeout(r, ms));
        this.currentDosyaId = null;
        this.evrakData = {
            gelen: [],
            giden: [],
            diger: []
        };
    }

    /**
     * Ana evrak toplama fonksiyonu
     * @param {string} dosyaId - UYAP Dosya ID
     */
    async collectAllEvrak(dosyaId) {
        console.log(`📄 Evrak toplama başlıyor: ${dosyaId}`);
        this.currentDosyaId = dosyaId;

        try {
            // 1. Dosyaya git
            await this.navigateToDosya(dosyaId);
            await this.delay(1500);

            // 2. Evrak butonuna tıkla
            await this.clickEvrakButton();
            await this.delay(1000);

            // 3. Tüm Evrak seç
            await this.selectTumEvrak();
            await this.delay(1000);

            // 4. Her klasörü sırayla topla
            await this.collectFromFolder('Gelen Evraklar', 'gelen');
            await this.delay(500);

            await this.collectFromFolder('Giden Evraklar', 'giden');
            await this.delay(500);

            await this.collectFromFolder('Diğer Evraklar', 'diger');

            console.log('✅ Tüm evraklar toplandı:', this.evrakData);
            return this.evrakData;

        } catch (error) {
            console.error('❌ Evrak toplama hatası:', error);
            throw error;
        }
    }

    /**
     * Dosya detay sayfasına git
     */
    async navigateToDosya(dosyaId) {
        console.log('📂 Dosyaya gidiliyor...');

        // Dosya kartını bul ve tıkla
        const cards = Array.from(document.querySelectorAll('.file-card, [data-dosya-id], .dosya-item'));
        const targetCard = cards.find(card => {
            return card.textContent.includes(dosyaId) ||
                card.dataset.dosyaId === dosyaId ||
                card.getAttribute('data-dosya-id') === dosyaId;
        });

        if (targetCard) {
            targetCard.click();
            console.log('✅ Dosya kartı tıklandı');
        } else {
            // Alternatif: Direkt URL ile git
            const detailUrl = `/dosya/detay?dosyaId=${dosyaId}`;
            window.location.href = detailUrl;
            console.log('✅ Dosya URL ile açıldı');
        }
    }

    /**
     * "Evrak" butonunu bul ve tıkla
     */
    async clickEvrakButton() {
        console.log('🔘 Evrak butonu aranıyor...');

        // Farklı selector kombinasyonları dene
        const selectors = [
            'button:contains("Evrak")',
            'a:contains("Evrak")',
            '[data-tab="evrak"]',
            '.tab-evrak',
            '#evrak-tab'
        ];

        for (const selector of selectors) {
            try {
                // jQuery-style :contains için manuel arama
                const buttons = Array.from(document.querySelectorAll('button, a, [role="tab"]'));
                const evrakBtn = buttons.find(btn =>
                    btn.textContent.trim().toLowerCase().includes('evrak')
                );

                if (evrakBtn) {
                    evrakBtn.click();
                    console.log('✅ Evrak butonu tıklandı');
                    return;
                }
            } catch (e) {
                continue;
            }
        }

        throw new Error('Evrak butonu bulunamadı!');
    }

    /**
     * "Tüm Evrak" seçeneğini seç
     */
    async selectTumEvrak() {
        console.log('📋 Tüm Evrak seçiliyor...');

        // Dropdown veya radio button olabilir
        const options = Array.from(document.querySelectorAll('option, input[type="radio"], .filter-option'));
        const tumEvrakOption = options.find(opt =>
            opt.textContent.trim().toLowerCase().includes('tüm evrak') ||
            opt.value === 'tum_evrak' ||
            opt.value === 'all'
        );

        if (tumEvrakOption) {
            if (tumEvrakOption.tagName === 'OPTION') {
                tumEvrakOption.selected = true;
                tumEvrakOption.parentElement.dispatchEvent(new Event('change', { bubbles: true }));
            } else if (tumEvrakOption.tagName === 'INPUT') {
                tumEvrakOption.checked = true;
                tumEvrakOption.dispatchEvent(new Event('change', { bubbles: true }));
            } else {
                tumEvrakOption.click();
            }
            console.log('✅ Tüm Evrak seçildi');
        } else {
            console.warn('⚠️ Tüm Evrak seçeneği bulunamadı, varsayılan görünüm kullanılacak');
        }
    }

    /**
     * Belirli bir klasörden evrakları topla
     * @param {string} folderName - Klasör adı (Gelen Evraklar, Giden Evraklar, Diğer Evraklar)
     * @param {string} key - Data key (gelen, giden, diger)
     */
    async collectFromFolder(folderName, key) {
        console.log(`📁 ${folderName} klasörü işleniyor...`);

        try {
            // Klasör butonunu bul ve tıkla
            const folderButtons = Array.from(document.querySelectorAll('button, a, .folder-tab, [role="tab"]'));
            const folderBtn = folderButtons.find(btn =>
                btn.textContent.trim().includes(folderName) ||
                btn.textContent.trim().includes(folderName.split(' ')[0]) // "Gelen", "Giden", "Diğer"
            );

            if (folderBtn) {
                folderBtn.click();
                await this.delay(1000);
                console.log(`✅ ${folderName} klasörü açıldı`);
            } else {
                console.warn(`⚠️ ${folderName} klasör butonu bulunamadı`);
                return;
            }

            // Evrakları topla
            const evrakList = await this.extractEvrakFromPage();
            this.evrakData[key] = evrakList;
            console.log(`✅ ${folderName}: ${evrakList.length} evrak toplandı`);

        } catch (error) {
            console.error(`❌ ${folderName} klasör hatası:`, error);
        }
    }

    /**
     * Sayfadaki evrakları çıkar
     */
    async extractEvrakFromPage() {
        const evrakList = [];

        // Tablo satırlarını bul
        const rows = Array.from(document.querySelectorAll('table tbody tr, .evrak-item, .document-row'));

        for (const row of rows) {
            try {
                const evrak = {
                    evrakId: this.extractText(row, '[data-evrak-id]', 'data-evrak-id'),
                    evrakNo: this.extractText(row, '.evrak-no, td:nth-child(1)'),
                    evrakTuru: this.extractText(row, '.evrak-turu, td:nth-child(2)'),
                    tarih: this.extractText(row, '.tarih, td:nth-child(3)'),
                    aciklama: this.extractText(row, '.aciklama, td:nth-child(4)'),
                    durum: this.extractText(row, '.durum, .status'),
                    dosyaId: this.currentDosyaId
                };

                // En azından evrakId veya evrakNo olmalı
                if (evrak.evrakId || evrak.evrakNo) {
                    evrakList.push(evrak);
                }
            } catch (e) {
                console.warn('⚠️ Evrak satırı parse edilemedi:', e);
            }
        }

        return evrakList;
    }

    /**
     * Helper: Element'ten text çıkar
     */
    extractText(parent, selector, attribute = null) {
        try {
            const element = parent.querySelector(selector);
            if (!element) return '';

            if (attribute) {
                return element.getAttribute(attribute) || '';
            }
            return element.textContent.trim();
        } catch (e) {
            return '';
        }
    }

    /**
     * API endpoint kullanarak evrak listesi al (Alternatif yöntem)
     * İmerek.js'deki gibi direkt API çağrısı
     */
    async getEvrakViaAPI(dosyaId) {
        console.log('🌐 API ile evrak listesi alınıyor...');

        try {
            // İmerek.js'deki endpoint: /list_dosya_evraklar.ajx
            const response = await fetch('/list_dosya_evraklar.ajx', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json; charset=utf-8',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                credentials: 'include',
                body: JSON.stringify({
                    dosyaId: dosyaId,
                    pageNumber: 1
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            console.log('✅ API yanıtı alındı:', data);

            // Veriyi normalize et
            return this.normalizeAPIResponse(data);

        } catch (error) {
            console.error('❌ API hatası:', error);
            throw error;
        }
    }

    /**
     * API yanıtını normalize et
     */
    normalizeAPIResponse(data) {
        let evraklar = [];

        if (Array.isArray(data)) {
            evraklar = data;
        } else if (data.data && Array.isArray(data.data)) {
            evraklar = data.data;
        } else if (data.evraklar && Array.isArray(data.evraklar)) {
            evraklar = data.evraklar;
        }

        return {
            gelen: evraklar.filter(e => e.evrakTipi === 'GELEN' || e.tip === 'gelen'),
            giden: evraklar.filter(e => e.evrakTipi === 'GIDEN' || e.tip === 'giden'),
            diger: evraklar.filter(e => !e.evrakTipi || (e.evrakTipi !== 'GELEN' && e.evrakTipi !== 'GIDEN'))
        };
    }

    /**
     * Tüm sayfaları topla (pagination varsa)
     */
    async collectAllPages(dosyaId) {
        console.log('📚 Tüm sayfalar toplanıyor...');

        let allEvrak = { gelen: [], giden: [], diger: [] };
        let pageNumber = 1;
        let hasMore = true;

        while (hasMore) {
            try {
                const response = await fetch('/list_dosya_evraklar.ajx', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json; charset=utf-8',
                        'X-Requested-With': 'XMLHttpRequest'
                    },
                    credentials: 'include',
                    body: JSON.stringify({
                        dosyaId: dosyaId,
                        pageNumber: pageNumber
                    })
                });

                const data = await response.json();
                const normalized = this.normalizeAPIResponse(data);

                // Evrakları birleştir
                allEvrak.gelen.push(...normalized.gelen);
                allEvrak.giden.push(...normalized.giden);
                allEvrak.diger.push(...normalized.diger);

                // Daha fazla sayfa var mı kontrol et
                const totalEvrak = normalized.gelen.length + normalized.giden.length + normalized.diger.length;
                hasMore = totalEvrak > 0 && pageNumber < 100; // Max 100 sayfa
                pageNumber++;

                console.log(`📄 Sayfa ${pageNumber - 1}: ${totalEvrak} evrak`);

            } catch (error) {
                console.error(`❌ Sayfa ${pageNumber} hatası:`, error);
                hasMore = false;
            }
        }

        console.log(`✅ Toplam ${allEvrak.gelen.length + allEvrak.giden.length + allEvrak.diger.length} evrak toplandı`);
        return allEvrak;
    }
}

// Global export
if (typeof module !== 'undefined') {
    module.exports = UYAPEvrakAutomation;
} else {
    window.UYAPEvrakAutomation = UYAPEvrakAutomation;
}
