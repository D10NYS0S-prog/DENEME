// UYAP Desktop - IndexedDB Veritabanı Yönetimi
class UYAPDatabase {
    constructor() {
        this.dbName = 'UYAPDesktopDB';
        this.version = 1;
        this.db = null;
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onerror = (event) => {
                console.error('❌ Veritabanı açılamadı:', event.target.error);
                reject(event.target.error);
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                console.log('✅ Veritabanı bağlantısı kuruldu');
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Dosyalar için store
                if (!db.objectStoreNames.contains('files')) {
                    const filesStore = db.createObjectStore('files', {
                        keyPath: 'id',
                        autoIncrement: true
                    });

                    filesStore.createIndex('dosyaId', 'dosyaId', { unique: false });
                    filesStore.createIndex('dosyaNo', 'dosyaNo', { unique: false });
                    filesStore.createIndex('birimAdi', 'birimAdi', { unique: false });
                    filesStore.createIndex('durum', 'dosyaDurum', { unique: false });
                    filesStore.createIndex('tarih', 'kayitTarihi', { unique: false });
                }

                // Taraflar için store
                if (!db.objectStoreNames.contains('parties')) {
                    const partiesStore = db.createObjectStore('parties', {
                        keyPath: 'id',
                        autoIncrement: true
                    });

                    partiesStore.createIndex('dosyaId', 'dosyaId', { unique: false });
                    partiesStore.createIndex('type', 'type', { unique: false });
                }

                console.log('🗄️ Veritabanı tabloları oluşturuldu');
            };
        });
    }

    // 📥 DOSYA KAYDETME
    async saveFile(fileData) {
        if (!this.db) {
            throw new Error('Veritabanı bağlantısı yok');
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['files'], 'readwrite');
            const store = transaction.objectStore('files');

            const fileToSave = {
                ...fileData,
                kayitTarihi: fileData.kayitTarihi || new Date().toISOString(),
                guncellemeTarihi: new Date().toISOString()
            };

            // Check if file exists
            if (fileData.dosyaId) {
                const index = store.index('dosyaId');
                const getRequest = index.get(fileData.dosyaId);

                getRequest.onsuccess = () => {
                    let request;
                    if (getRequest.result) {
                        // Update existing
                        fileToSave.id = getRequest.result.id;
                        request = store.put(fileToSave);
                    } else {
                        // Add new
                        request = store.add(fileToSave);
                    }

                    request.onsuccess = async () => {
                        console.log('💾 Dosya kaydedildi:', fileData.dosyaNo);
                        if (fileData.parties && Array.isArray(fileData.parties)) {
                            await this.saveParties(fileData.dosyaId, fileData.parties);
                        }
                        resolve(request.result);
                    };
                };
            } else {
                // No dosyaId, just add
                const request = store.add(fileToSave);
                request.onsuccess = () => {
                    resolve(request.result);
                };
            }

            transaction.onerror = (event) => {
                console.error('❌ Kayıt hatası:', event.target.error);
                reject(event.target.error);
            };
        });
    }

    // 📤 TÜM DOSYALARI GETİR
    async getAllFiles() {
        if (!this.db) return [];

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['files'], 'readonly');
            const store = transaction.objectStore('files');
            const request = store.getAll();

            request.onsuccess = () => {
                resolve(request.result || []);
            };

            request.onerror = (event) => {
                reject(event.target.error);
            };
        });
    }

    // 🔍 DOSYA ARA
    async searchFiles(query) {
        if (!this.db) return [];

        const allFiles = await this.getAllFiles();
        const searchStr = query.toLowerCase();

        return allFiles.filter(file => {
            return (
                (file.dosyaNo && file.dosyaNo.toLowerCase().includes(searchStr)) ||
                (file.birimAdi && file.birimAdi.toLowerCase().includes(searchStr)) ||
                (file.dosyaTur && file.dosyaTur.toLowerCase().includes(searchStr))
            );
        });
    }



    // 📥 TARAFLARI KAYDET
    async saveParties(dosyaId, parties) {
        if (!this.db) return;

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['parties'], 'readwrite');
            const store = transaction.objectStore('parties');

            let savedCount = 0;
            parties.forEach(party => {
                const partyToSave = {
                    ...party,
                    dosyaId: dosyaId,
                    type: party.tarafSifat || party.sifat || 'Bilinmiyor'
                };
                store.add(partyToSave);
                savedCount++;
            });

            transaction.oncomplete = () => {
                console.log(`💾 ${savedCount} taraf kaydedildi (Dosya: ${dosyaId})`);
                resolve(savedCount);
            };

            transaction.onerror = (event) => {
                console.error('❌ Taraf kayıt hatası:', event.target.error);
                reject(event.target.error);
            };
        });
    }

    // 🗑️ DOSYA SİL (Parties ile birlikte)
    async deleteFile(fileId) {
        if (!this.db) return false;

        return new Promise(async (resolve, reject) => {
            try {
                // Önce dosyaId'yi bulmamız lazım (Parties silmek için)
                const transactionRead = this.db.transaction(['files'], 'readonly');
                const storeRead = transactionRead.objectStore('files');
                const requestRead = storeRead.get(fileId);

                requestRead.onsuccess = async () => {
                    const file = requestRead.result;
                    if (!file) {
                        resolve(false);
                        return;
                    }

                    const dosyaId = file.dosyaId;

                    // Şimdi silme işlemi
                    const transaction = this.db.transaction(['files', 'parties'], 'readwrite');

                    // 1. Dosyayı sil
                    transaction.objectStore('files').delete(fileId);

                    // 2. Varsa tarafları sil (Index kullanarak bul ve sil)
                    // Not: IndexedDB'de 'delete where' doğrudan yok, önce bulup sonra silmek lazım
                    // Şimdilik basitçe ID üzerinden değil, eğer dosyaId varsa index'ten bulup sileceğiz.
                    // Ancak bu biraz karmaşık, şimdilik sadece dosyayı siliyoruz.
                    // TODO: Cascade delete parties properly if needed.
                    if (dosyaId) {
                        const partyStore = transaction.objectStore('parties');
                        const index = partyStore.index('dosyaId');
                        const keyRange = IDBKeyRange.only(dosyaId);
                        const cursorRequest = index.openCursor(keyRange);

                        cursorRequest.onsuccess = (e) => {
                            const cursor = e.target.result;
                            if (cursor) {
                                cursor.delete();
                                cursor.continue();
                            }
                        };
                    }

                    transaction.oncomplete = () => {
                        console.log('🗑️ Dosya ve ilişkili taraflar silindi:', fileId);
                        resolve(true);
                    };

                    transaction.onerror = (e) => reject(e.target.error);
                };
            } catch (error) {
                reject(error);
            }
        });
    }

    // 📊 İSTATİSTİKLER
    async getStats() {
        const files = await this.getAllFiles();

        const stats = {
            total: files.length,
            acik: 0,
            kapali: 0,
            beklemede: 0
        };

        files.forEach(file => {
            const durum = (file.dosyaDurum || '').toLowerCase();
            if (durum.includes('açık')) {
                stats.acik++;
            } else if (durum.includes('kapalı') || durum.includes('karara')) {
                stats.kapali++;
            } else {
                stats.beklemede++;
            }
        });

        return stats;
    }

    // 🔄 VERİTABANINI TEMİZLE
    async clearAll() {
        if (!this.db) return;

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['files', 'parties'], 'readwrite');

            transaction.objectStore('files').clear();
            transaction.objectStore('parties').clear();

            transaction.oncomplete = () => {
                console.log('🗑️ Veritabanı temizlendi');
                resolve(true);
            };

            transaction.onerror = (event) => {
                reject(event.target.error);
            };
        });
    }
}

// Global instance
let uyapDB = null;

// Initialize database
async function initDatabase() {
    if (uyapDB) return uyapDB;

    try {
        uyapDB = new UYAPDatabase();
        await uyapDB.init();
        console.log('✅ Veritabanı hazır');
        return uyapDB;
    } catch (error) {
        console.error('❌ Veritabanı başlatılamadı:', error);
        return null;
    }
}

// Export for use in HTML
if (typeof window !== 'undefined') {
    window.UYAPDatabase = UYAPDatabase;
    window.initDatabase = initDatabase;
}
