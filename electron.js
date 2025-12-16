const { app, BrowserWindow, BrowserView, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs'); // Dosya yazmak için eklendi

// ... (aradaki kodlar aynı kalsın) ...

// UYAP Data Handler (Interception)
// UYAP Data Handler (Interception)
ipcMain.on('uyap-data', (event, packet) => {
    // packet: { url: string, data: any }
    const logEntry = {
        timestamp: new Date().toISOString(),
        url: packet.url,
        data: packet.data
    };

    console.log(`📡 Veri Yakalandı: ${packet.url}`);

    try {
        const logPath = 'C:\\Users\\Ahmet Hakan UYSAL\\.gemini\\antigravity\\scratch\\uyap-desktop\\traffic.log';
        fs.appendFileSync(logPath, JSON.stringify(logEntry) + '\n');
    } catch (err) {
        console.error('Log dosyasına yazılamadı:', err);
    }

    // Send to renderer ONLY if it's file list data
    if (mainWindow && packet.url && packet.url.includes('search_phrase_detayli')) {
        console.log('📤 Ana pencereye gönderiliyor (Dosya Listesi):', packet.url);
        console.log('📦 Veri boyutu:', JSON.stringify(packet.data).length, 'bytes');
        mainWindow.webContents.send('uyap-data-captured', packet.data);
        console.log('✅ Gönderildi');
    } else if (mainWindow) {
        console.log('⏭️ Atlandı (dosya listesi değil):', packet.url);
    } else {
        console.error('❌ mainWindow bulunamadı!');
    }
});

// UYAP Party Data Handler
ipcMain.on('uyap-party-data', (event, packet) => {
    console.log('👥 Taraf Verisi Yakalandı:', packet.url);
    try {
        if (packet.payload) console.log('📤 Payload:', packet.payload);

        // Extract dosyaId from payload
        let dosyaId = null;
        try {
            const payload = JSON.parse(packet.payload);
            dosyaId = payload.dosyaId;
        } catch (e) {
            console.warn('⚠️ Payload parse edilemedi');
        }

        // Send to renderer with dosyaId for matching
        if (mainWindow) {
            mainWindow.webContents.send('party-data-received', {
                dosyaId: dosyaId,
                parties: packet.data,
                url: packet.url
            });
        }
    } catch (e) {
        console.error('❌ Taraf verisi işleme hatası:', e);
    }
});

// UYAP Docs Data Handler
ipcMain.on('uyap-docs-data', (event, packet) => {
    console.log('📄 Evrak Verisi Yakalandı:', packet.url);
    if (mainWindow) {
        mainWindow.webContents.send('uyap-docs-data-captured', packet);
    }
});

// Download Request Handler
ipcMain.on('download-request', (event, packet) => {
    console.log('📥 İndirme İsteği Alındı:', packet.url);
    if (view) {
        view.webContents.downloadURL(packet.url);
    }
});

// Setup Download Handler
app.on('session-created', (session) => {
    session.on('will-download', (event, item, webContents) => {
        const fileName = item.getFilename();
        const savePath = path.join(app.getPath('downloads'), fileName);

        console.log(`💾 İndirme Başlıyor: ${fileName} -> ${savePath}`);

        item.setSavePath(savePath);

        item.on('updated', (event, state) => {
            if (state === 'interrupted') {
                console.log('⚠️ İndirme kesildi');
            } else if (state === 'progressing') {
                if (item.isPaused()) {
                    console.log('⏸️ İndirme duraklatıldı');
                } else {
                    // console.log(`⬇️ İndiriliyor: ${Math.round(item.getReceivedBytes() / item.getTotalBytes() * 100)}%`);
                }
            }
        });

        item.on('done', (event, state) => {
            if (state === 'completed') {
                console.log('✅ İndirme Tamamlandı:', fileName);
            } else {
                console.log(`❌ İndirme Başarısız: ${state}`);
            }
        });
    });
});
try {
    require('electron-reload')(__dirname, {
        electron: path.join(__dirname, 'node_modules', '.bin', 'electron'),
        ignored: /node_modules|downloads|udf-temp|[\/\\]\./
    });
} catch (err) {
    console.log('Hot reload modülü yüklenemedi:', err);
}

let mainWindow;
let view; // Global view variable
let viewVisible = true; // Track BrowserView visibility state for performance

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    mainWindow.loadFile('index.html');

    // Ana pencerenin DevTools'unu aç (geliştirme için)
    // mainWindow.webContents.openDevTools();

    // BrowserView ile UYAP'ı yükle
    view = new BrowserView({
        webPreferences: {
            preload: path.join(__dirname, 'webview-preload.js'),
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    mainWindow.setBrowserView(view);

    // View Boyutlarını Dinamik Ayarla (Sidebar 300px, Header 48px)
    function updateViewBounds() {
        const { width, height } = mainWindow.getContentBounds();
        const HEADER_HEIGHT = 48;  // Compact header
        const SIDEBAR_WIDTH = 300; // Fixed sidebar
        
        view.setBounds({
            x: SIDEBAR_WIDTH,
            y: HEADER_HEIGHT,
            width: Math.max(width - SIDEBAR_WIDTH, 0),
            height: Math.max(height - HEADER_HEIGHT, 0)
        });
    }
    
    // Initial bounds calculation
    updateViewBounds();
    
    // Update on window state changes
    mainWindow.on('resize', updateViewBounds);
    mainWindow.on('maximize', updateViewBounds);
    mainWindow.on('unmaximize', updateViewBounds);
    
    // Load UYAP
    view.webContents.loadURL('https://uyap.gov.tr');

    // Automation Handler
    ipcMain.on('start-automation', () => {
        console.log('🤖 Otomasyon Başlatılıyor...');
        if (view) {
            view.webContents.send('run-automation');
        }
    });

    // API Script Execution Handler (Fix for BrowserView architecture)
    ipcMain.handle('uyap-execute-script', async (event, script) => {
        if (view && view.webContents) {
            try {
                // console.log('Executing Script on View...'); 
                const result = await view.webContents.executeJavaScript(script);
                return result;
            } catch (error) {
                console.error('JS Execution Error:', error);
                return { error: error.message };
            }
        }
        return { error: 'View not ready' };
    });

    function updateViewBounds() {
        const [cw, ch] = mainWindow.getContentSize();
        // Sidebar: 300px width
        // Header: 48px (compact)
        // Total top offset: 48px
        view.setBounds({ x: 300, y: 48, width: Math.max(cw - 300, 0), height: Math.max(ch - 48, 0) });
    }

    updateViewBounds();
    mainWindow.on('resize', updateViewBounds);
    mainWindow.on('maximize', updateViewBounds);
    mainWindow.on('unmaximize', updateViewBounds);
    view.setAutoResize({ width: true, height: true });

    // UYAP'ı yükle
    view.webContents.loadURL('https://avukatbeta.uyap.gov.tr/');
    // view.webContents.openDevTools({ mode: 'detach' }); // Kapalı - sadece ana pencere DevTools kullan

    view.webContents.on('did-finish-load', () => {
        console.log('✅ UYAP Sayfası Yüklendi');
    });

    view.webContents.on('preload-error', (event, preloadPath, error) => {
        console.error('❌ Preload Yükleme Hatası:', error);
    });

    // Forward Console Logs from Webview
    view.webContents.on('console-message', (event, level, message, line, sourceId) => {
        console.log(`[WebView]: ${message}`);
    });

    // View Visibility Handlers (Fix for Modal Overlay)
    ipcMain.on('hide-view', () => {
        if (mainWindow && viewVisible) {
            mainWindow.setBrowserView(null);
            viewVisible = false;
            console.log('🙈 BrowserView hidden (Modal open)');
        }
    });

    ipcMain.on('show-view', () => {
        if (mainWindow && view && !viewVisible) {
            mainWindow.setBrowserView(view);
            updateViewBounds(); // Restore correct size/position
            viewVisible = true;
            console.log('👁️ BrowserView restored');
        }
    });

    mainWindow.on('resize', updateViewBounds);

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

app.whenReady().then(() => {
    createWindow();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

// UYAP Data Handler (Interception)
// Duplicate listener removed

// Forward XHook Status to Renderer
ipcMain.on('xhook-status', (event, status) => {
    console.log('XHook Status:', status);
    if (mainWindow) mainWindow.webContents.send('update-xhook-status', status);
});

// Forward XHook Traffic to Renderer
ipcMain.on('xhook-traffic', (event, url) => {
    // console.log('Traffic:', url); // Optional log
    if (mainWindow) mainWindow.webContents.send('update-last-url', url);
});

// CRITICAL: Forward Data Captured from BrowserView to MainWindow
const { dialog } = require('electron'); // Ensure dialog is available

ipcMain.on('uyap-files-relay', (event, packet) => {
    console.log('📦 RELAYING File List Data:', packet.files.length);

    // DEBUG ALERT
    // dialog.showMessageBox({
    //    type: 'info',
    //    title: 'Veri Yakalandı',
    //    message: `${packet.files.length} dosya yakalandı ve arayüze gönderiliyor.`
    // });

    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('uyap-files-ready', packet);
        console.log('✅ Sent to Renderer');
    } else {
        console.error('❌ MainWindow is missing or destroyed!');
    }
});

// Generic Debug
ipcMain.on('uyap-debug-data', (event, data) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('uyap-debug-data', data);
    }
});

// ============================================================================
// NOTE OPERATIONS (Stage 2)
// ============================================================================

// Simple in-memory storage for Stage 2 demo
// In production, this should use the database (db.js)
let notesStore = [];

ipcMain.handle('get-all-notes', async () => {
    console.log('📝 Tüm notlar istendi, döndürülüyor:', notesStore.length);
    return notesStore;
});

ipcMain.handle('save-note', async (event, { kaynakId, noteText, noteType }) => {
    const note = {
        id: Date.now().toString(),
        kaynakId: kaynakId,
        icerik: noteText,
        type: noteType || 'genel',
        tarih: new Date().toISOString(),
        kullanici: 'current-user'
    };
    
    notesStore.push(note);
    console.log('✅ Not kaydedildi:', note.id);
    
    return { success: true, note };
});

ipcMain.handle('get-notes', async (event, { kaynakId, noteType, limit }) => {
    let filtered = notesStore;
    
    if (kaynakId) {
        filtered = filtered.filter(n => n.kaynakId === kaynakId);
    }
    
    if (noteType) {
        filtered = filtered.filter(n => n.type === noteType);
    }
    
    if (limit) {
        filtered = filtered.slice(0, limit);
    }
    
    console.log(`📝 ${filtered.length} not döndürüldü`);
    return filtered;
});

ipcMain.handle('delete-note', async (event, noteId) => {
    const index = notesStore.findIndex(n => n.id === noteId);
    if (index !== -1) {
        notesStore.splice(index, 1);
        console.log('✅ Not silindi:', noteId);
        return { success: true };
    }
    
    console.warn('⚠️ Not bulunamadı:', noteId);
    return { error: 'Not bulunamadı' };
});

// Google Authorization Handler
ipcMain.on('google-authorize', () => {
    console.log('🔐 Google yetkilendirme istendi');
    // TODO: Implement OAuth flow
    // For now, show a dialog
    const { dialog } = require('electron');
    dialog.showMessageBox({
        type: 'info',
        title: 'Google Yetkilendirme',
        message: 'Google OAuth akışı henüz implement edilmemiştir.\n\nBu özellik için Google Cloud Console\'da OAuth 2.0 kimlik bilgileri oluşturmanız gerekir.'
    });
});

// PTT Status Check Handler (Stage 3)
ipcMain.handle('check-ptt-status', async (event, { barkodNo }) => {
    console.log(`📮 PTT durumu kontrol ediliyor: ${barkodNo}`);
    
    // Simulate PTT API call (in production, this would call actual PTT Kargo API)
    // PTT Kargo API documentation: https://gonderitakip.ptt.gov.tr/
    
    try {
        // Simulated response - in production, use actual PTT API
        // Example: const response = await axios.get(`https://gonderitakip.ptt.gov.tr/Track/Quicktrack?q=${barkodNo}`);
        
        // For now, return a simulated successful response
        const mockStatuses = [
            { id: 2, durum: 'TESLİM EDİLDİ', teslimTarihi: new Date().toISOString() },
            { id: 1, durum: 'TESLİM EDİLEMEDİ', aciklama: 'Adres bulunamadı' },
            { id: 0, durum: 'DAĞITIMDA', aciklama: 'Şubede' }
        ];
        
        const randomStatus = mockStatuses[Math.floor(Math.random() * mockStatuses.length)];
        
        console.log(`✅ PTT durumu: ${randomStatus.durum}`);
        
        return {
            isLastState: randomStatus.id,
            durum: randomStatus.durum,
            lastStateTarihi: randomStatus.teslimTarihi || new Date().toISOString(),
            aciklama: randomStatus.aciklama || '',
            barkodNo: barkodNo
        };
        
    } catch (error) {
        console.error('PTT kontrol hatası:', error);
        return {
            error: 'PTT servisine bağlanılamadı',
            durum: 'KONTROL EDİLEMEDİ',
            barkodNo: barkodNo
        };
    }
});
