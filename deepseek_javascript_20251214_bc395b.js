// uyap-downloader.js
class UYAPDownloader {
    constructor() {
        this.baseUrl = 'https://avukatbeta.uyap.gov.tr';
        this.downloadQueue = [];
        this.isDownloading = false;
        this.concurrentDownloads = 3; // Aynı anda max indirme sayısı
        this.activeDownloads = 0;
        
        // İndirme geçmişi
        this.downloadHistory = JSON.parse(localStorage.getItem('uyap-download-history') || '[]');
    }
    
    /**
     * EVRAK/DOYSYA İNDİRME - İMEREK tarzı
     * @param {Object} fileData - İndirilecek dosya bilgileri
     * @param {string} fileData.id - Dosya/Evrak ID
     * @param {string} fileData.name - Dosya adı
     * @param {string} fileData.type - 'evrak' veya 'dosya'
     * @param {string} fileData.extension - Uzantı (pdf, docx, vs)
     */
    async downloadFile(fileData) {
        console.log(`📥 İndirme başlatılıyor: ${fileData.name}`);
        
        // Kuyruğa ekle
        const downloadId = Date.now();
        this.downloadQueue.push({
            id: downloadId,
            ...fileData,
            status: 'queued',
            progress: 0,
            startTime: null,
            endTime: null
        });
        
        this.updateDownloadUI();
        
        // Kuyruktaki işlemleri işle
        this.processQueue();
        
        return downloadId;
    }
    
    /**
     * İNDİRME KUYRUĞUNU İŞLE
     */
    async processQueue() {
        if (this.isDownloading || this.activeDownloads >= this.concurrentDownloads) {
            return;
        }
        
        if (this.downloadQueue.length === 0) {
            return;
        }
        
        this.isDownloading = true;
        
        // Aktif indirme sayısını kontrol et
        const availableSlots = this.concurrentDownloads - this.activeDownloads;
        const toDownload = this.downloadQueue
            .filter(item => item.status === 'queued')
            .slice(0, availableSlots);
        
        for (const item of toDownload) {
            this.activeDownloads++;
            item.status = 'downloading';
            item.startTime = new Date().toISOString();
            
            this.updateDownloadUI();
            
            // Paralel indirme
            this.downloadItem(item).then(result => {
                this.activeDownloads--;
                
                if (result.success) {
                    item.status = 'completed';
                    item.progress = 100;
                    item.endTime = new Date().toISOString();
                    item.filePath = result.filePath;
                    
                    // Geçmişe ekle
                    this.addToHistory(item);
                    
                    this.showNotification(`✅ ${item.name} indirildi`, 'success');
                } else {
                    item.status = 'failed';
                    item.error = result.error;
                    
                    this.showNotification(`❌ ${item.name} indirilemedi: ${result.error}`, 'error');
                }
                
                this.updateDownloadUI();
                this.processQueue(); // Sonraki indirmeye geç
            });
        }
        
        this.isDownloading = false;
    }
    
    /**
     * TEKİL DOSYA İNDİRME (İMEREK mantığı)
     */
    async downloadItem(item) {
        try {
            // 1. Önce endpoint'i belirle (evrak mı dosya mı?)
            let endpoint = '';
            let payload = {};
            
            if (item.type === 'evrak') {
                endpoint = '/download_document_brd.uyap'; // İMEREK'teki endpoint
                payload = {
                    evrakId: item.id,
                    dosyaId: item.dosyaId || '',
                    birimId: item.birimId || await this.getBirimId(),
                    islemTuru: 'INDIR'
                };
            } else if (item.type === 'dosya') {
                endpoint = '/dosya_indir.ajx';
                payload = {
                    dosyaId: item.id,
                    birimId: item.birimId || await this.getBirimId(),
                    indirmeTipi: 'TAM'
                };
            }
            
            console.log(`   İndirme endpoint: ${endpoint}`, payload);
            
            // 2. İndirme isteğini gönder
            const response = await this._fetchDownload(endpoint, payload, item.name);
            
            if (response.success) {
                // 3. Blob'u dosyaya çevir ve kaydet
                const filePath = await this.saveBlobToFile(
                    response.blob,
                    item.name,
                    item.extension || 'pdf'
                );
                
                return {
                    success: true,
                    filePath: filePath,
                    size: response.blob.size,
                    mimeType: response.blob.type
                };
            } else {
                return {
                    success: false,
                    error: response.error
                };
            }
            
        } catch (error) {
            console.error('İndirme hatası:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    /**
     * İNDİRME İSTEĞİ GÖNDER (İMEREK tarzı - blob response)
     */
    async _fetchDownload(endpoint, payload, filename) {
        const fullUrl = this.baseUrl + endpoint;
        
        const script = `
            (async () => {
                try {
                    console.log('📤 İndirme isteği:', '${endpoint}', ${JSON.stringify(payload)});
                    
                    const response = await fetch('${fullUrl}', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-Requested-With': 'XMLHttpRequest',
                            'Accept': 'application/octet-stream, application/pdf, */*'
                        },
                        credentials: 'include',
                        body: JSON.stringify(${JSON.stringify(payload)})
                    });
                    
                    console.log('📥 İndirme yanıtı:', response.status, response.headers.get('content-type'));
                    
                    if (!response.ok) {
                        const errorText = await response.text();
                        throw new Error('HTTP ' + response.status + ': ' + errorText.substring(0, 200));
                    }
                    
                    // Content-Disposition'dan dosya adını al
                    const contentDisposition = response.headers.get('content-disposition');
                    let actualFilename = '${filename}';
                    
                    if (contentDisposition && contentDisposition.includes('filename=')) {
                        const matches = contentDisposition.match(/filename[^;=\\n]*=((['"]).*?\\2|[^;\\n]*)/);
                        if (matches && matches[1]) {
                            actualFilename = matches[1].replace(/['"]/g, '');
                        }
                    }
                    
                    // Blob'u al
                    const blob = await response.blob();
                    
                    console.log('✅ Blob alındı:', blob.size, 'bytes, type:', blob.type);
                    
                    return {
                        success: true,
                        blob: blob,
                        filename: actualFilename,
                        contentType: blob.type,
                        size: blob.size
                    };
                    
                } catch (error) {
                    console.error('İndirme fetch hatası:', error);
                    return {
                        success: false,
                        error: error.toString()
                    };
                }
            })();
        `;
        
        if (window.electronAPI && window.electronAPI.executeScript) {
            const result = await window.electronAPI.executeScript(script);
            
            if (result && result.error) {
                throw new Error(result.error);
            }
            
            return result;
        }
        
        throw new Error('Electron API not available');
    }
    
    /**
     * BLOB'U DOSYAYA KAYDET (Electron ile)
     */
    async saveBlobToFile(blobData, filename, extension) {
        // Base64'e çevir
        const base64Script = `
            (async () => {
                return new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onloadend = function() {
                        const base64data = reader.result.split(',')[1];
                        resolve({
                            base64: base64data,
                            mimeType: '${blobData.type}',
                            size: ${blobData.size}
                        });
                    };
                    reader.readAsDataURL(new Blob([${JSON.stringify(Array.from(new Uint8Array(blobData)))}], {
                        type: '${blobData.type}'
                    }));
                });
            })();
        `;
        
        const fileData = await window.electronAPI.executeScript(base64Script);
        
        // Electron main process'e dosya kaydetme isteği gönder
        const saveResult = await window.electronAPI.saveFile({
            filename: this.sanitizeFilename(filename, extension),
            data: fileData.base64,
            mimeType: fileData.mimeType
        });
        
        return saveResult.filePath;
    }
    
    /**
     * TOPLU İNDİRME (Birden fazla dosya)
     */
    async downloadMultiple(files) {
        console.log(`📦 Toplu indirme başlatılıyor: ${files.length} dosya`);
        
        const downloadIds = [];
        
        for (const file of files) {
            const id = await this.downloadFile(file);
            downloadIds.push(id);
            
            // Biraz bekle (sunucuyu zorlama)
            await this.sleep(500);
        }
        
        return downloadIds;
    }
    
    /**
     * İNDİRME DURUMUNU GÖSTEREN UI
     */
    updateDownloadUI() {
        const container = document.getElementById('download-manager') || this.createDownloadUI();
        
        let html = `
            <div class="download-header">
                <h4>📥 İndirme Yöneticisi</h4>
                <div class="download-stats">
                    <span>Kuyruk: ${this.downloadQueue.filter(d => d.status === 'queued').length}</span>
                    <span>Aktif: ${this.activeDownloads}</span>
                    <span>Tamamlanan: ${this.downloadQueue.filter(d => d.status === 'completed').length}</span>
                </div>
            </div>
            
            <div class="download-list">
        `;
        
        if (this.downloadQueue.length === 0) {
            html += `<div class="empty-state">📭 İndirme kuyruğu boş</div>`;
        } else {
            this.downloadQueue.forEach(item => {
                const statusIcons = {
                    'queued': '⏳',
                    'downloading': '⬇️',
                    'completed': '✅',
                    'failed': '❌'
                };
                
                const statusColors = {
                    'queued': '#ffc107',
                    'downloading': '#2196f3',
                    'completed': '#4caf50',
                    'failed': '#f44336'
                };
                
                html += `
                    <div class="download-item" data-id="${item.id}">
                        <div class="download-info">
                            <span class="status-icon">${statusIcons[item.status]}</span>
                            <span class="filename">${item.name}</span>
                            <span class="file-size">${item.size ? this.formatFileSize(item.size) : ''}</span>
                        </div>
                        
                        <div class="download-progress">
                            <div class="progress-bar" style="width: ${item.progress}%; background: ${statusColors[item.status]}"></div>
                            <span class="progress-text">${item.status === 'downloading' ? `${item.progress}%` : item.status}</span>
                        </div>
                        
                        ${item.error ? `<div class="download-error">${item.error}</div>` : ''}
                        
                        <div class="download-actions">
                            ${item.status === 'failed' ? 
                                `<button onclick="retryDownload('${item.id}')">🔄 Tekrar Dene</button>` : ''}
                            ${item.status === 'completed' && item.filePath ? 
                                `<button onclick="openFile('${item.filePath}')">📂 Aç</button>` : ''}
                            <button onclick="removeDownload('${item.id}')">🗑️</button>
                        </div>
                    </div>
                `;
            });
        }
        
        html += `</div>`;
        
        container.innerHTML = html;
    }
    
    /**
     * DOSYA KARTLARINA İNDİRME BUTONU EKLE
     */
    addDownloadButtonToCard(fileCard, fileData) {
        const downloadBtn = document.createElement('button');
        downloadBtn.className = 'btn-download';
        downloadBtn.innerHTML = '📥 İndir';
        downloadBtn.title = `${fileData.name} indir`;
        
        downloadBtn.onclick = async (e) => {
            e.stopPropagation();
            
            // Butonu disable et
            downloadBtn.disabled = true;
            downloadBtn.innerHTML = '⏳';
            
            try {
                await this.downloadFile(fileData);
                downloadBtn.innerHTML = '✅';
                
                // 2 saniye sonra eski haline dön
                setTimeout(() => {
                    downloadBtn.disabled = false;
                    downloadBtn.innerHTML = '📥 İndir';
                }, 2000);
                
            } catch (error) {
                downloadBtn.innerHTML = '❌';
                downloadBtn.title = `Hata: ${error.message}`;
                
                setTimeout(() => {
                    downloadBtn.disabled = false;
                    downloadBtn.innerHTML = '📥 İndir';
                    downloadBtn.title = `${fileData.name} indir`;
                }, 3000);
            }
        };
        
        // Dosya kartına ekle
        const actionsDiv = fileCard.querySelector('.file-actions') || 
                          fileCard.querySelector('.card-actions');
        
        if (actionsDiv) {
            actionsDiv.appendChild(downloadBtn);
        } else {
            // Yeni actions div oluştur
            const newActions = document.createElement('div');
            newActions.className = 'file-actions';
            newActions.appendChild(downloadBtn);
            fileCard.appendChild(newActions);
        }
    }
    
    /**
     * TOPLU İNDİRME BUTONU (Tüm seçili dosyalar)
     */
    addBatchDownloadButton() {
        const batchBtn = document.createElement('button');
        batchBtn.id = 'batch-download-btn';
        batchBtn.className = 'btn btn-primary';
        batchBtn.innerHTML = '📦 Seçilenleri İndir (0)';
        batchBtn.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            z-index: 1000;
            padding: 12px 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            border-radius: 50px;
            cursor: pointer;
            box-shadow: 0 4px 15px rgba(0,0,0,0.2);
            display: flex;
            align-items: center;
            gap: 8px;
            font-weight: bold;
        `;
        
        // Seçim sayacını güncelle
        const updateCounter = () => {
            const selectedCount = document.querySelectorAll('.file-card.selected').length;
            batchBtn.innerHTML = `📦 Seçilenleri İndir (${selectedCount})`;
            batchBtn.style.display = selectedCount > 0 ? 'flex' : 'none';
        };
        
        // Dosya kartlarına tıklama event'i ekle
        document.addEventListener('click', (e) => {
            const card = e.target.closest('.file-card');
            if (card) {
                card.classList.toggle('selected');
                updateCounter();
            }
        });
        
        // Toplu indirme işlemi
        batchBtn.onclick = async () => {
            const selectedCards = document.querySelectorAll('.file-card.selected');
            const files = [];
            
            selectedCards.forEach(card => {
                // Dosya bilgilerini card'dan al
                const fileData = {
                    id: card.dataset.fileId,
                    name: card.querySelector('.file-number')?.textContent || `Dosya_${Date.now()}`,
                    type: 'evrak', // veya card'dan type bilgisi al
                    extension: 'pdf',
                    dosyaId: card.dataset.dosyaId,
                    birimId: card.dataset.birimId
                };
                files.push(fileData);
            });
            
            if (files.length > 0) {
                batchBtn.disabled = true;
                batchBtn.innerHTML = `⏳ İndiriliyor (${files.length})...`;
                
                try {
                    await this.downloadMultiple(files);
                    batchBtn.innerHTML = `✅ Tamamlandı!`;
                    
                    // Seçimleri temizle
                    selectedCards.forEach(card => card.classList.remove('selected'));
                    
                    setTimeout(() => {
                        batchBtn.disabled = false;
                        updateCounter();
                    }, 2000);
                    
                } catch (error) {
                    batchBtn.innerHTML = `❌ Hata!`;
                    setTimeout(() => {
                        batchBtn.disabled = false;
                        updateCounter();
                    }, 3000);
                }
            }
        };
        
        document.body.appendChild(batchBtn);
        updateCounter();
    }
    
    /**
     * YARDIMCI FONKSİYONLAR
     */
    sanitizeFilename(filename, extension) {
        // Türkçe karakterleri düzelt, özel karakterleri temizle
        return filename
            .replace(/[<>:"/\\|?*]/g, '_')
            .replace(/ğ/g, 'g').replace(/Ğ/g, 'G')
            .replace(/ü/g, 'u').replace(/Ü/g, 'U')
            .replace(/ş/g, 's').replace(/Ş/g, 'S')
            .replace(/ı/g, 'i').replace(/İ/g, 'I')
            .replace(/ö/g, 'o').replace(/Ö/g, 'O')
            .replace(/ç/g, 'c').replace(/Ç/g, 'C')
            .trim() + '.' + (extension || 'pdf');
    }
    
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    async getBirimId() {
        // Daha önceki kodunuzdan birimId alma fonksiyonu
        const script = `localStorage.getItem('birimId') || '0992'`;
        return await window.electronAPI.executeScript(script);
    }
    
    addToHistory(item) {
        this.downloadHistory.unshift({
            ...item,
            downloadedAt: new Date().toISOString()
        });
        
        // Son 100 kaydı sakla
        if (this.downloadHistory.length > 100) {
            this.downloadHistory.pop();
        }
        
        localStorage.setItem('uyap-download-history', JSON.stringify(this.downloadHistory));
    }
    
    showNotification(message, type = 'info') {
        // Basit bildirim sistemi
        const notification = document.createElement('div');
        notification.className = `download-notification ${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : '#2196F3'};
            color: white;
            border-radius: 5px;
            z-index: 10000;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            animation: slideIn 0.3s ease-out;
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease-out';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
    
    createDownloadUI() {
        const container = document.createElement('div');
        container.id = 'download-manager';
        container.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 20px;
            width: 400px;
            max-height: 500px;
            background: white;
            border-radius: 10px;
            box-shadow: 0 5px 20px rgba(0,0,0,0.15);
            z-index: 9999;
            overflow: hidden;
            display: none;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        `;
        
        document.body.appendChild(container);
        return container;
    }
}

// CSS Stilleri
const downloadStyles = `
    <style>
        /* İndirme Yöneticisi Stilleri */
        #download-manager {
            border: 1px solid #e0e0e0;
        }
        
        .download-header {
            padding: 15px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .download-header h4 {
            margin: 0;
            font-size: 16px;
        }
        
        .download-stats {
            display: flex;
            gap: 10px;
            font-size: 12px;
            opacity: 0.9;
        }
        
        .download-list {
            max-height: 400px;
            overflow-y: auto;
            padding: 10px;
        }
        
        .download-item {
            padding: 10px;
            border-bottom: 1px solid #f0f0f0;
            transition: background 0.2s;
        }
        
        .download-item:hover {
            background: #f9f9f9;
        }
        
        .download-info {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 5px;
        }
        
        .status-icon {
            font-size: 14px;
        }
        
        .filename {
            flex: 1;
            font-weight: 500;
            font-size: 14px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        
        .file-size {
            font-size: 12px;
            color: #666;
        }
        
        .download-progress {
            height: 20px;
            background: #f0f0f0;
            border-radius: 10px;
            overflow: hidden;
            position: relative;
            margin: 5px 0;
        }
        
        .progress-bar {
            height: 100%;
            transition: width 0.3s ease;
        }
        
        .progress-text {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 11px;
            font-weight: bold;
            color: white;
            text-shadow: 0 1px 1px rgba(0,0,0,0.3);
        }
        
        .download-error {
            font-size: 11px;
            color: #f44336;
            margin-top: 5px;
            padding: 3px 5px;
            background: #ffebee;
            border-radius: 3px;
        }
        
        .download-actions {
            display: flex;
            gap: 5px;
            margin-top: 5px;
        }
        
        .download-actions button {
            padding: 3px 8px;
            font-size: 11px;
            border: 1px solid #ddd;
            background: white;
            border-radius: 3px;
            cursor: pointer;
            transition: all 0.2s;
        }
        
        .download-actions button:hover {
            background: #f5f5f5;
        }
        
        .empty-state {
            text-align: center;
            padding: 40px 20px;
            color: #999;
            font-size: 14px;
        }
        
        /* Dosya kartı seçim stili */
        .file-card.selected {
            border: 2px solid #667eea !important;
            background: #f0f4ff !important;
        }
        
        /* İndirme butonu */
        .btn-download {
            padding: 4px 10px;
            font-size: 12px;
            background: #4CAF50;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            transition: background 0.2s;
        }
        
        .btn-download:hover {
            background: #45a049;
        }
        
        .btn-download:disabled {
            background: #cccccc;
            cursor: not-allowed;
        }
        
        /* Animasyonlar */
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        
        @keyframes slideOut {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(100%); opacity: 0; }
        }
    </style>
`;

// Global fonksiyonlar
window.retryDownload = async function(downloadId) {
    const downloader = window.uyapDownloader;
    const item = downloader.downloadQueue.find(d => d.id == downloadId);
    
    if (item) {
        item.status = 'queued';
        item.progress = 0;
        downloader.updateDownloadUI();
        downloader.processQueue();
    }
};

window.openFile = function(filePath) {
    if (window.electronAPI && window.electronAPI.openFile) {
        window.electronAPI.openFile(filePath);
    } else {
        // Fallback: yeni tab'da aç
        window.open(`file://${filePath}`, '_blank');
    }
};

window.removeDownload = function(downloadId) {
    const downloader = window.uyapDownloader;
    downloader.downloadQueue = downloader.downloadQueue.filter(d => d.id != downloadId);
    downloader.updateDownloadUI();
};

// Başlatma
document.addEventListener('DOMContentLoaded', () => {
    // Stilleri ekle
    document.head.insertAdjacentHTML('beforeend', downloadStyles);
    
    // Downloader'ı başlat
    window.uyapDownloader = new UYAPDownloader();
    
    // Toplu indirme butonunu ekle
    setTimeout(() => {
        window.uyapDownloader.addBatchDownloadButton();
    }, 1000);
    
    console.log('✅ UYAP Downloader başlatıldı!');
});

// Electron Main Process için handler'lar (main.js'ye ekleyin)
/*
// main.js'ye ekleyin:
ipcMain.handle('save-file', async (event, fileData) => {
    const { dialog } = require('electron');
    const fs = require('fs');
    const path = require('path');
    
    const defaultPath = path.join(app.getPath('downloads'), fileData.filename);
    
    const { filePath } = await dialog.showSaveDialog({
        defaultPath: defaultPath,
        filters: [
            { name: 'PDF Files', extensions: ['pdf'] },
            { name: 'All Files', extensions: ['*'] }
        ]
    });
    
    if (filePath) {
        // Base64'ü decode et ve kaydet
        const buffer = Buffer.from(fileData.data, 'base64');
        fs.writeFileSync(filePath, buffer);
        
        return { success: true, filePath };
    }
    
    return { success: false };
});
*/