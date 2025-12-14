/**
 * UYAP Desktop - Stage 2 Application Logic
 * Enhanced UI with full API integration
 */

const { ipcRenderer } = require('electron');

// Initialize API and components
const uyapApi = new UYAPApi();
const webview = document.getElementById('uyap-browser');
let currentFilesMap = new Map();
let currentNotes = [];
let currentFileId = null;
let db = null; // Database instance

console.log('✅ UYAP Desktop Stage 2 Initializing...');

// ============================================================================
// INITIALIZATION
// ============================================================================

window.addEventListener('DOMContentLoaded', () => {
    initializeTabs();
    initializeSessionMonitor();
    initializeBadges();
    initializeEventListeners();
    initializeDatabase();
    loadNotes();
    checkGoogleAuth();
    console.log('✅ Stage 2 UI Initialized');
});

// Initialize database
async function initializeDatabase() {
    try {
        db = await initDatabase();
        console.log('✅ Veritabanı hazır');
    } catch (error) {
        console.error('❌ Veritabanı başlatma hatası:', error);
        showToast('Veritabanı başlatılamadı', 'error');
    }
}

// ============================================================================
// TAB SYSTEM
// ============================================================================

function initializeTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabName = btn.dataset.tab;
            switchTab(tabName);
        });
    });
}

function switchTab(tabName) {
    // Update buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
    
    // Update content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.toggle('active', content.id === `tab-${tabName}`);
    });
    
    // Load data for specific tabs
    if (tabName === 'notlar') {
        loadNotes();
    } else if (tabName === 'google') {
        loadGoogleData();
    }
}

// ============================================================================
// SESSION MONITORING
// ============================================================================

function initializeSessionMonitor() {
    setInterval(checkSession, 30000); // Check every 30 seconds
    checkSession(); // Initial check
}

async function checkSession() {
    const statusEl = document.getElementById('sessionStatus');
    const statusDot = statusEl.querySelector('.status-dot');
    const statusText = statusEl.querySelector('.status-text');
    
    try {
        await uyapApi.ensureSession();
        if (uyapApi.sessionData.sessionId) {
            statusDot.classList.add('active');
            statusText.textContent = 'Bağlı';
        } else {
            statusDot.classList.remove('active');
            statusText.textContent = 'Bağlanıyor...';
        }
    } catch (error) {
        statusDot.classList.remove('active');
        statusText.textContent = 'Bağlantı Hatası';
    }
}

// ============================================================================
// BADGE SYSTEM
// ============================================================================

function initializeBadges() {
    // Listen for badge updates from API
    window.addEventListener('uyap-badges-updated', (event) => {
        updateBadges(event.detail);
    });
    
    // Initial badge load
    updateBadges(uyapApi.getBadges());
}

function updateBadges(badges) {
    Object.keys(badges).forEach(key => {
        const badgeEl = document.getElementById(`badge-${key}`);
        if (badgeEl) {
            const countEl = badgeEl.querySelector('.badge-count');
            countEl.textContent = badges[key];
            countEl.classList.toggle('zero', badges[key] === 0);
        }
    });
}

// ============================================================================
// FILE OPERATIONS
// ============================================================================

// Listen for file data from IPC
ipcRenderer.on('uyap-files-ready', (event, packet) => {
    console.log('📡 Dosya verisi alındı:', packet);
    handleFileData(packet);
});

function handleFileData(packet) {
    try {
        let files = packet.files || [];
        if (files.length === 0) {
            showToast('Dosya bulunamadı', 'warning');
            return;
        }
        
        // Update global state
        files.forEach(file => {
            const fileId = file.dosyaId || file.dosyaNo || `temp-${Date.now()}`;
            const existing = currentFilesMap.get(fileId);
            currentFilesMap.set(fileId, {
                ...file,
                parties: existing?.parties || [],
                evraklar: existing?.evraklar || []
            });
        });
        
        renderFileList();
        
        // Update badge
        uyapApi.updateBadges({ dosyalar: currentFilesMap.size });
        showToast(`${files.length} dosya yüklendi`, 'success');
        
    } catch (error) {
        console.error('❌ Dosya verisi işleme hatası:', error);
        showToast('Dosya verisi işlenirken hata oluştu', 'error');
    }
}

function renderFileList() {
    const listEl = document.getElementById('file-list');
    const files = Array.from(currentFilesMap.values());
    
    if (files.length === 0) {
        listEl.innerHTML = '<p class="text-muted text-center">Henüz dosya yok</p>';
        return;
    }
    
    listEl.innerHTML = files.map(file => `
        <div class="file-card" onclick="openFileDetails('${file.dosyaId}')">
            <div class="file-number">${file.dosyaNo || 'N/A'}</div>
            ${file.dosyaDurum ? `<div class="file-status">${file.dosyaDurum}</div>` : ''}
            <div class="file-detail-item"><strong>Birim:</strong> ${file.birimAdi || 'N/A'}</div>
            ${file.parties?.length ? `<div class="file-detail-item">👥 ${file.parties.length} taraf</div>` : ''}
        </div>
    `).join('');
}

// Simple search
document.getElementById('simpleSearchBtn')?.addEventListener('click', async () => {
    const query = document.getElementById('simpleSearchInput').value.trim();
    if (!query) {
        showToast('Lütfen dosya numarası girin', 'warning');
        return;
    }
    
    showToast('Aranıyor...', 'info');
    try {
        const results = await uyapApi.searchByDosyaNo(query);
        if (results && results.length > 0) {
            handleFileData({ files: results });
        } else {
            showToast('Dosya bulunamadı', 'warning');
        }
    } catch (error) {
        showToast('Arama hatası: ' + error.message, 'error');
    }
});

// Bulk query
document.getElementById('bulkQueryBtn')?.addEventListener('click', async () => {
    const files = Array.from(currentFilesMap.values());
    if (files.length === 0) {
        showToast('Listede dosya yok', 'warning');
        return;
    }
    
    if (!confirm(`${files.length} dosya için taraf bilgisi sorgulanacak. Devam?`)) {
        return;
    }
    
    const progressContainer = document.getElementById('bulkProgress');
    const countEl = document.getElementById('bulkCount');
    const totalEl = document.getElementById('bulkTotal');
    const barEl = document.getElementById('bulkBar');
    const btnEl = document.getElementById('bulkQueryBtn');
    
    progressContainer.style.display = 'block';
    btnEl.disabled = true;
    btnEl.textContent = '⏳ İşleniyor...';
    totalEl.textContent = files.length;
    
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        countEl.textContent = i + 1;
        barEl.style.width = `${((i + 1) / files.length) * 100}%`;
        
        try {
            if (!file.parties || file.parties.length === 0) {
                const response = await uyapApi.getParties(file.dosyaId);
                if (response?.data) {
                    file.parties = Array.isArray(response.data) ? response.data : response.data.tarafListesi || [];
                    currentFilesMap.set(file.dosyaId, file);
                }
            }
            
            // Delay between requests
            await new Promise(r => setTimeout(r, 3000 + Math.random() * 2000));
        } catch (error) {
            console.error(`Hata (${file.dosyaNo}):`, error);
        }
    }
    
    btnEl.disabled = false;
    btnEl.textContent = '🔄 Tümünü Sorgula';
    setTimeout(() => progressContainer.style.display = 'none', 3000);
    renderFileList();
    showToast('Sorgulama tamamlandı', 'success');
});

// Safahat query
document.getElementById('safahatQueryBtn')?.addEventListener('click', async () => {
    const startDate = prompt('Başlangıç tarihi (YYYY-MM-DD):', '2024-01-01');
    const endDate = prompt('Bitiş tarihi (YYYY-MM-DD):', new Date().toISOString().split('T')[0]);
    
    if (!startDate || !endDate) return;
    
    showToast('Safahat sorgulanıyor...', 'info');
    try {
        const results = await uyapApi.queryAllSafahat('0991', new Date(startDate), new Date(endDate));
        showToast(`${results.length} safahat bulundu`, 'success');
        // Process results...
    } catch (error) {
        showToast('Safahat sorgulama hatası: ' + error.message, 'error');
    }
});

// ============================================================================
// FILE DETAILS MODAL
// ============================================================================

window.openFileDetails = function(dosyaId) {
    const file = currentFilesMap.get(dosyaId);
    if (!file) return;
    
    currentFileId = dosyaId;
    const modal = document.getElementById('fileDetailsModal');
    const title = document.getElementById('fileDetailsTitle');
    
    title.textContent = `📂 ${file.dosyaNo} - ${file.birimAdi}`;
    
    // Initialize details tabs
    initializeDetailsTabs();
    
    // Load initial tab (taraflar)
    loadFileTab('taraflar', dosyaId);
    
    openModal('fileDetailsModal');
};

function initializeDetailsTabs() {
    const tabs = document.querySelectorAll('.details-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.dataset.detailTab;
            
            // Update active tab
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            // Load tab content
            loadFileTab(tabName, currentFileId);
        });
    });
}

async function loadFileTab(tabName, dosyaId) {
    const contentEl = document.getElementById('fileDetailsContent');
    contentEl.innerHTML = '<p class="text-center">Yükleniyor...</p>';
    
    try {
        switch(tabName) {
            case 'taraflar':
                await loadPartiesTab(dosyaId, contentEl);
                break;
            case 'evraklar':
                await loadEvraklarTab(dosyaId, contentEl);
                break;
            case 'mali':
                await loadMaliTab(dosyaId, contentEl);
                break;
            case 'notlar':
                await loadNotlarTab(dosyaId, contentEl);
                break;
            case 'tebligat':
                await loadTebligatTab(dosyaId, contentEl);
                break;
        }
    } catch (error) {
        contentEl.innerHTML = `<p class="text-center" style="color: var(--danger-color);">Hata: ${error.message}</p>`;
    }
}

async function loadPartiesTab(dosyaId, contentEl) {
    const file = currentFilesMap.get(dosyaId);
    let parties = file?.parties || [];
    
    if (parties.length === 0) {
        const response = await uyapApi.getParties(dosyaId);
        parties = response?.data || [];
        if (file) {
            file.parties = parties;
            currentFilesMap.set(dosyaId, file);
        }
    }
    
    if (parties.length === 0) {
        contentEl.innerHTML = '<p class="text-center text-muted">Taraf bilgisi bulunamadı</p>';
        return;
    }
    
    contentEl.innerHTML = parties.map(party => {
        const name = party.adi || party.kisiKurumAdi || 'İsimsiz';
        const role = party.sifatAdi || party.tarafSifat || 'Taraf';
        return `
            <div class="party-card" style="margin-bottom: 10px; padding: 12px; background: var(--light-bg); border-radius: 6px;">
                <strong>${name}</strong>
                <span style="float: right; color: var(--primary-color);">${role}</span>
            </div>
        `;
    }).join('');
}

async function loadEvraklarTab(dosyaId, contentEl) {
    const evrakData = await uyapApi.getAllEvrak(dosyaId);
    
    contentEl.innerHTML = `
        <p>📊 Toplam: ${evrakData.all.length} evrak</p>
        <p>📥 Gelen: ${evrakData.gelen.length}</p>
        <p>📤 Giden: ${evrakData.giden.length}</p>
        <p>📋 Diğer: ${evrakData.diger.length}</p>
        <button class="btn-primary mt-10" onclick="openModal('docsModal'); loadFullEvrakModal('${dosyaId}')">
            Tüm Evrakları Görüntüle
        </button>
    `;
}

async function loadMaliTab(dosyaId, contentEl) {
    const maliData = await uyapApi.getTahsilatBilgileri(dosyaId);
    
    contentEl.innerHTML = `
        <div style="background: var(--light-bg); padding: 15px; border-radius: 8px;">
            <h4>💰 Mali Durum</h4>
            <p><strong>Toplam Tahsilat:</strong> ${maliData.toplamTahsilat || '0'} TL</p>
            <p><strong>Toplam Reddiyat:</strong> ${maliData.toplamReddiyat || '0'} TL</p>
            <p><strong>Kalan:</strong> ${maliData.toplamKalan || '0'} TL</p>
        </div>
    `;
}

async function loadNotlarTab(dosyaId, contentEl) {
    const notes = await uyapApi.getNotes(dosyaId, 'dosya');
    
    if (notes.length === 0) {
        contentEl.innerHTML = `
            <p class="text-center text-muted">Bu dosya için not yok</p>
            <button class="btn-primary mt-10" onclick="openNoteDialog('dosya', '${dosyaId}')">
                + Not Ekle
            </button>
        `;
        return;
    }
    
    contentEl.innerHTML = notes.map(note => `
        <div class="note-card">
            <div class="note-header">
                <span class="note-date">${new Date(note.tarih).toLocaleDateString('tr-TR')}</span>
            </div>
            <div class="note-content">${note.icerik}</div>
        </div>
    `).join('') + `
        <button class="btn-primary mt-10" onclick="openNoteDialog('dosya', '${dosyaId}')">
            + Not Ekle
        </button>
    `;
}

async function loadTebligatTab(dosyaId, contentEl) {
    contentEl.innerHTML = `
        <div class="tebligat-section">
            <h4>📮 Tebligat Kontrolü</h4>
            <p class="text-muted">Bu dosyanın evraklarındaki tebligat durumlarını kontrol edin</p>
            
            <div class="tebligat-actions">
                <button class="btn-primary" onclick="checkAllTebligatForFile('${dosyaId}')">
                    🔄 Tüm Tebligatları Kontrol Et
                </button>
                <button class="btn-secondary" onclick="checkETebligatForFile('${dosyaId}')">
                    💻 Sadece eTebligat Kontrol Et
                </button>
            </div>
            
            <div id="tebligat-results" class="tebligat-results" style="margin-top: 20px;">
                <p class="text-muted text-center">Kontrol sonuçları burada görünecek</p>
            </div>
        </div>
    `;
}

// Check all tebligat for a file
window.checkAllTebligatForFile = async function(dosyaId) {
    const resultsEl = document.getElementById('tebligat-results');
    resultsEl.innerHTML = '<p class="text-center">⏳ Evraklar alınıyor ve tebligatlar kontrol ediliyor...</p>';
    
    try {
        // Get all evrak for the file
        const evrakData = await uyapApi.getAllEvrak(dosyaId);
        
        if (!evrakData || evrakData.all.length === 0) {
            resultsEl.innerHTML = '<p class="text-center text-muted">Bu dosyada evrak bulunamadı</p>';
            return;
        }
        
        // Filter evrak that might have tebligat
        const tebligatEvrak = evrakData.all.filter(evrak => 
            evrak.evrakTur && (
                evrak.evrakTur.toLowerCase().includes('tebligat') ||
                evrak.evrakTur.toLowerCase().includes('tebliğ') ||
                evrak.barkodNo
            )
        );
        
        if (tebligatEvrak.length === 0) {
            resultsEl.innerHTML = '<p class="text-center text-muted">Bu dosyada tebligat evrağı bulunamadı</p>';
            return;
        }
        
        showToast(`${tebligatEvrak.length} tebligat kontrol ediliyor...`, 'info');
        resultsEl.innerHTML = `<p class="text-center">⏳ ${tebligatEvrak.length} tebligat kontrol ediliyor...</p>`;
        
        // Check tebligat status
        const results = await uyapApi.checkTebligatStatus(tebligatEvrak);
        
        // Display results
        displayTebligatResults(results, resultsEl);
        showToast('Tebligat kontrolü tamamlandı', 'success');
        
    } catch (error) {
        resultsEl.innerHTML = `<p class="text-center" style="color: var(--danger-color);">Hata: ${error.message}</p>`;
        showToast('Tebligat kontrolü hatası: ' + error.message, 'error');
    }
};

// Check only eTebligat for a file
window.checkETebligatForFile = async function(dosyaId) {
    const resultsEl = document.getElementById('tebligat-results');
    resultsEl.innerHTML = '<p class="text-center">⏳ eTebligat kontrol ediliyor...</p>';
    
    try {
        const evrakData = await uyapApi.getAllEvrak(dosyaId);
        
        if (!evrakData || evrakData.all.length === 0) {
            resultsEl.innerHTML = '<p class="text-center text-muted">Bu dosyada evrak bulunamadı</p>';
            return;
        }
        
        // Filter only eTebligat
        const eTebligatEvrak = evrakData.all.filter(evrak => 
            evrak.eTebligat === true || evrak.eTebligat === 1
        );
        
        if (eTebligatEvrak.length === 0) {
            resultsEl.innerHTML = '<p class="text-center text-muted">Bu dosyada eTebligat bulunamadı</p>';
            return;
        }
        
        showToast(`${eTebligatEvrak.length} eTebligat kontrol ediliyor...`, 'info');
        
        // Calculate eTebligat status (no API call needed)
        const results = eTebligatEvrak.map(evrak => 
            uyapApi.calculateETebligatStatus(evrak)
        );
        
        displayTebligatResults(results, resultsEl);
        showToast('eTebligat kontrolü tamamlandı', 'success');
        
    } catch (error) {
        resultsEl.innerHTML = `<p class="text-center" style="color: var(--danger-color);">Hata: ${error.message}</p>`;
        showToast('eTebligat kontrolü hatası: ' + error.message, 'error');
    }
};

// Display tebligat results in a nice format
function displayTebligatResults(results, containerEl) {
    if (!results || results.length === 0) {
        containerEl.innerHTML = '<p class="text-center text-muted">Sonuç bulunamadı</p>';
        return;
    }
    
    // Count statuses
    const delivered = results.filter(r => r.isLastState === 2).length;
    const failed = results.filter(r => r.isLastState === 1).length;
    const pending = results.filter(r => r.isLastState === 0 || !r.isLastState).length;
    
    const html = `
        <div class="tebligat-summary">
            <div class="summary-card success">
                <div class="summary-icon">✅</div>
                <div class="summary-info">
                    <strong>${delivered}</strong>
                    <span>Teslim Edildi</span>
                </div>
            </div>
            <div class="summary-card danger">
                <div class="summary-icon">❌</div>
                <div class="summary-info">
                    <strong>${failed}</strong>
                    <span>Teslim Edilemedi</span>
                </div>
            </div>
            <div class="summary-card warning">
                <div class="summary-icon">⏳</div>
                <div class="summary-info">
                    <strong>${pending}</strong>
                    <span>Beklemede</span>
                </div>
            </div>
        </div>
        
        <div class="tebligat-details" style="margin-top: 20px; max-height: 300px; overflow-y: auto;">
            ${results.map(teb => {
                const statusClass = 
                    teb.isLastState === 2 ? 'success' : 
                    teb.isLastState === 1 ? 'danger' : 
                    'warning';
                
                const statusIcon = 
                    teb.isLastState === 2 ? '✅' : 
                    teb.isLastState === 1 ? '❌' : 
                    '⏳';
                
                return `
                    <div class="tebligat-card ${statusClass}">
                        <div class="tebligat-header">
                            <span class="tebligat-icon">${statusIcon}</span>
                            <strong>${teb.evrakTur || 'Tebligat'}</strong>
                        </div>
                        <div class="tebligat-body">
                            <p><strong>Durum:</strong> ${teb.durum || 'Bilinmiyor'}</p>
                            ${teb.evrakTarih ? `<p><strong>Evrak Tarihi:</strong> ${teb.evrakTarih}</p>` : ''}
                            ${teb.lastStateTarihi ? `<p><strong>Durum Tarihi:</strong> ${new Date(teb.lastStateTarihi).toLocaleDateString('tr-TR')}</p>` : ''}
                            ${teb.barkodNo ? `<p><strong>Barkod:</strong> ${teb.barkodNo}</p>` : ''}
                            ${teb.eTebligat ? `<p><span class="badge">💻 eTebligat</span></p>` : ''}
                            ${teb.aciklama ? `<p class="text-muted">${teb.aciklama}</p>` : ''}
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
    
    containerEl.innerHTML = html;
}

// ============================================================================
// NOTES MANAGEMENT
// ============================================================================

async function loadNotes() {
    const listEl = document.getElementById('notes-list');
    const filterType = document.getElementById('noteFilterType')?.value || 'all';
    
    try {
        // Get all notes
        currentNotes = await uyapApi.getAllNotes();
        
        // Filter
        let filtered = currentNotes;
        if (filterType !== 'all') {
            filtered = currentNotes.filter(n => n.type === filterType);
        }
        
        if (filtered.length === 0) {
            listEl.innerHTML = '<p class="text-center text-muted">Not bulunamadı</p>';
            return;
        }
        
        listEl.innerHTML = filtered.map(note => `
            <div class="note-card">
                <div class="note-header">
                    <span class="note-type">${note.type}</span>
                    <span class="note-date">${new Date(note.tarih).toLocaleDateString('tr-TR')}</span>
                </div>
                <div class="note-content">${note.icerik}</div>
                <button class="btn-secondary btn-sm mt-10" onclick="deleteNote('${note.id}')">🗑️ Sil</button>
            </div>
        `).join('');
        
        // Update badge
        uyapApi.updateBadges({ notlarim: currentNotes.length });
        
    } catch (error) {
        listEl.innerHTML = `<p style="color: var(--danger-color);">Hata: ${error.message}</p>`;
    }
}

// Note filter listener
document.getElementById('noteFilterType')?.addEventListener('change', loadNotes);

window.openNoteDialog = function(type = 'genel', targetId = null) {
    const modal = document.getElementById('noteDialog');
    const typeSelect = document.getElementById('noteType');
    const targetGroup = document.getElementById('noteTargetGroup');
    const targetInput = document.getElementById('noteTarget');
    
    typeSelect.value = type;
    if (type !== 'genel' && targetId) {
        targetGroup.style.display = 'block';
        targetInput.value = targetId;
    } else {
        targetGroup.style.display = 'none';
    }
    
    document.getElementById('noteContent').value = '';
    document.getElementById('noteToTasks').checked = false;
    
    openModal('noteDialog');
};

// Note type change listener
document.getElementById('noteType')?.addEventListener('change', (e) => {
    const targetGroup = document.getElementById('noteTargetGroup');
    targetGroup.style.display = e.target.value === 'genel' ? 'none' : 'block';
});

window.saveNote = async function() {
    const type = document.getElementById('noteType').value;
    const target = document.getElementById('noteTarget').value;
    const content = document.getElementById('noteContent').value.trim();
    const toTasks = document.getElementById('noteToTasks').checked;
    
    if (!content) {
        showToast('Not içeriği boş olamaz', 'warning');
        return;
    }
    
    try {
        // Save to local database
        await uyapApi.saveNote(target || null, content, type);
        
        // Optionally create Google Task
        if (toTasks) {
            await uyapApi.createGoogleTask(`Not: ${type}`, content);
        }
        
        closeModal('noteDialog');
        loadNotes();
        showToast('Not kaydedildi', 'success');
    } catch (error) {
        showToast('Not kaydetme hatası: ' + error.message, 'error');
    }
};

window.deleteNote = async function(noteId) {
    if (!confirm('Bu notu silmek istediğinize emin misiniz?')) return;
    
    try {
        await uyapApi.deleteNote(noteId);
        loadNotes();
        showToast('Not silindi', 'success');
    } catch (error) {
        showToast('Not silme hatası: ' + error.message, 'error');
    }
};

// ============================================================================
// GOOGLE INTEGRATION
// ============================================================================

async function checkGoogleAuth() {
    const token = await uyapApi.getGoogleAccessToken();
    const statusEl = document.getElementById('googleAuthStatus');
    const actionsEl = document.getElementById('googleActions');
    
    if (token) {
        statusEl.style.display = 'none';
        actionsEl.style.display = 'block';
        loadGoogleData();
    } else {
        statusEl.style.display = 'block';
        actionsEl.style.display = 'none';
    }
}

async function loadGoogleData() {
    await loadGoogleTasks();
}

async function loadGoogleTasks() {
    const listEl = document.getElementById('tasks-list');
    
    try {
        const tasks = await uyapApi.getGoogleTasks();
        
        if (!tasks || tasks.length === 0) {
            listEl.innerHTML = '<p class="text-muted">Görev bulunamadı</p>';
            return;
        }
        
        listEl.innerHTML = tasks.map(task => `
            <div style="padding: 10px; background: var(--light-bg); border-radius: 6px; margin-bottom: 8px;">
                <strong>${task.title}</strong>
                ${task.notes ? `<p style="font-size: 12px; color: var(--text-secondary);">${task.notes}</p>` : ''}
                ${task.due ? `<p style="font-size: 11px; color: var(--text-muted);">📅 ${new Date(task.due).toLocaleDateString('tr-TR')}</p>` : ''}
            </div>
        `).join('');
    } catch (error) {
        listEl.innerHTML = `<p style="color: var(--danger-color);">Hata: ${error.message}</p>`;
    }
}

window.authorizeGoogle = async function() {
    showToast('Google yetkilendirmesi yapılıyor...', 'info');
    // Trigger OAuth flow through IPC
    ipcRenderer.send('google-authorize');
};

window.backupNow = async function() {
    if (!confirm('Şimdi yedekleme yapılsın mı?')) return;
    
    showToast('Yedekleme başlatıldı...', 'info');
    
    try {
        const backupData = {
            dosyalar: Array.from(currentFilesMap.values()),
            notlar: currentNotes,
            timestamp: new Date().toISOString()
        };
        
        const result = await uyapApi.uploadToGoogleDrive(
            backupData,
            `backup-${Date.now()}.json`,
            `UYAP Yedeği - ${new Date().toLocaleString('tr-TR')}`
        );
        
        if (result.error) {
            showToast('Yedekleme başarısız: ' + result.error, 'error');
        } else {
            showToast('Yedekleme başarılı', 'success');
        }
    } catch (error) {
        showToast('Yedekleme hatası: ' + error.message, 'error');
    }
};

window.showBackupHistory = async function() {
    showToast('Yedek geçmişi yükleniyor...', 'info');
    try {
        const backups = await uyapApi.searchGoogleDriveBackups('backup');
        alert(`${backups.length} yedek dosyası bulundu`);
        // TODO: Show in modal
    } catch (error) {
        showToast('Yedek listeleme hatası: ' + error.message, 'error');
    }
};

window.restoreBackup = async function() {
    // TODO: Implement backup restore UI
    showToast('Geri yükleme özelliği yakında eklenecek', 'info');
};

window.syncNotesToTasks = async function() {
    if (!confirm('Tüm notlar Google Tasks\'a aktarılsın mı?')) return;
    
    showToast('Notlar senkronize ediliyor...', 'info');
    
    try {
        let synced = 0;
        for (const note of currentNotes) {
            await uyapApi.createGoogleTask(
                `Not (${note.type})`,
                note.icerik
            );
            synced++;
        }
        showToast(`${synced} not aktarıldı`, 'success');
        loadGoogleTasks();
    } catch (error) {
        showToast('Senkronizasyon hatası: ' + error.message, 'error');
    }
};

// ============================================================================
// SPECIAL COURTS
// ============================================================================

window.openYargitay = async function() {
    showToast('Yargıtay daireleri yükleniyor...', 'info');
    
    try {
        // Fetch chambers list
        const daireler = await uyapApi.getYargitayDaireleri();
        
        if (daireler.error) {
            showToast('Yargıtay daireleri alınamadı: ' + daireler.error, 'error');
            return;
        }
        
        // Create modal content
        const modalHtml = `
            <div class="special-court-modal" id="yargitayModal">
                <h3>⚖️ Yargıtay Daireleri</h3>
                <p class="text-muted">Bir daire seçerek dosyaları görüntüleyin</p>
                <div class="daire-list">
                    ${Array.isArray(daireler) ? daireler.map(daire => `
                        <div class="daire-card" onclick="loadYargitayFiles('${daire.id || daire.daire}', '${daire.adi || daire.ad}')">
                            <div class="daire-icon">⚖️</div>
                            <div class="daire-info">
                                <strong>${daire.adi || daire.ad || 'Daire ' + (daire.id || daire.daire)}</strong>
                                ${daire.aciklama ? `<p class="text-muted">${daire.aciklama}</p>` : ''}
                            </div>
                            <div class="daire-arrow">→</div>
                        </div>
                    `).join('') : '<p class="text-center text-muted">Daire bulunamadı</p>'}
                </div>
            </div>
        `;
        
        // Show in settings modal (reuse modal)
        const modal = document.getElementById('settingsModal');
        const modalBody = modal.querySelector('.modal-body');
        const modalTitle = modal.querySelector('.modal-header h3');
        
        modalTitle.textContent = '⚖️ Yargıtay';
        modalBody.innerHTML = modalHtml;
        openModal('settingsModal');
        
    } catch (error) {
        showToast('Yargıtay modülü hatası: ' + error.message, 'error');
    }
};

window.loadYargitayFiles = async function(daireId, daireAdi) {
    showToast(`${daireAdi} dosyaları yükleniyor...`, 'info');
    
    try {
        const dosyalar = await uyapApi.getYargitayDosyalar(daireId);
        
        if (dosyalar.error) {
            showToast('Dosyalar alınamadı: ' + dosyalar.error, 'error');
            return;
        }
        
        const filesHtml = `
            <div class="special-court-files">
                <div style="margin-bottom: 15px;">
                    <button class="btn-secondary" onclick="openYargitay()">← Dairelere Dön</button>
                </div>
                <h4>${daireAdi} - Dosyalar</h4>
                <p class="text-muted">Toplam ${Array.isArray(dosyalar) ? dosyalar.length : 0} dosya</p>
                <div class="files-list" style="max-height: 400px; overflow-y: auto;">
                    ${Array.isArray(dosyalar) && dosyalar.length > 0 ? dosyalar.map(dosya => `
                        <div class="file-card" onclick="showYargitayFileDetails('${dosya.dosyaId}', '${dosya.dosyaNo || 'N/A'}')">
                            <div class="file-number">${dosya.dosyaNo || dosya.esasNo || 'N/A'}</div>
                            <div class="file-detail-item"><strong>Karar No:</strong> ${dosya.kararNo || 'Yok'}</div>
                            ${dosya.ilkIncelemeTarih ? `<div class="file-detail-item">📅 ${dosya.ilkIncelemeTarih}</div>` : ''}
                        </div>
                    `).join('') : '<p class="text-center text-muted">Dosya bulunamadı</p>'}
                </div>
            </div>
        `;
        
        const modal = document.getElementById('settingsModal');
        const modalBody = modal.querySelector('.modal-body');
        modalBody.innerHTML = filesHtml;
        
    } catch (error) {
        showToast('Dosyalar yüklenemedi: ' + error.message, 'error');
    }
};

window.showYargitayFileDetails = async function(dosyaId, dosyaNo) {
    showToast('Dosya detayları yükleniyor...', 'info');
    
    try {
        const detay = await uyapApi.getYargitayDosyaDetay(dosyaId);
        
        if (detay.error) {
            showToast('Detay alınamadı: ' + detay.error, 'error');
            return;
        }
        
        alert(`Yargıtay Dosya Detayı:\n\nDosya No: ${dosyaNo}\nDosya ID: ${dosyaId}\n\n${JSON.stringify(detay, null, 2)}`);
        // TODO: Create better detail view
        
    } catch (error) {
        showToast('Detay yüklenemedi: ' + error.message, 'error');
    }
};

window.openDanistay = async function() {
    showToast('Danıştay daireleri yükleniyor...', 'info');
    
    try {
        const daireler = await uyapApi.getDanistayDaireleri();
        
        if (daireler.error) {
            showToast('Danıştay daireleri alınamadı: ' + daireler.error, 'error');
            return;
        }
        
        const modalHtml = `
            <div class="special-court-modal" id="danistayModal">
                <h3>🏛️ Danıştay Daireleri</h3>
                <p class="text-muted">Bir daire seçerek dosyaları görüntüleyin</p>
                <div class="daire-list">
                    ${Array.isArray(daireler) ? daireler.map(daire => `
                        <div class="daire-card" onclick="loadDanistayFiles('${daire.id || daire.daire}', '${daire.adi || daire.ad}')">
                            <div class="daire-icon">🏛️</div>
                            <div class="daire-info">
                                <strong>${daire.adi || daire.ad || 'Daire ' + (daire.id || daire.daire)}</strong>
                                ${daire.aciklama ? `<p class="text-muted">${daire.aciklama}</p>` : ''}
                            </div>
                            <div class="daire-arrow">→</div>
                        </div>
                    `).join('') : '<p class="text-center text-muted">Daire bulunamadı</p>'}
                </div>
            </div>
        `;
        
        const modal = document.getElementById('settingsModal');
        const modalBody = modal.querySelector('.modal-body');
        const modalTitle = modal.querySelector('.modal-header h3');
        
        modalTitle.textContent = '🏛️ Danıştay';
        modalBody.innerHTML = modalHtml;
        openModal('settingsModal');
        
    } catch (error) {
        showToast('Danıştay modülü hatası: ' + error.message, 'error');
    }
};

window.loadDanistayFiles = async function(daireId, daireAdi) {
    showToast(`${daireAdi} dosyaları yükleniyor...`, 'info');
    
    try {
        const dosyalar = await uyapApi.getDanistayDosyalar(daireId);
        
        if (dosyalar.error) {
            showToast('Dosyalar alınamadı: ' + dosyalar.error, 'error');
            return;
        }
        
        const filesHtml = `
            <div class="special-court-files">
                <div style="margin-bottom: 15px;">
                    <button class="btn-secondary" onclick="openDanistay()">← Dairelere Dön</button>
                </div>
                <h4>${daireAdi} - Dosyalar</h4>
                <p class="text-muted">Toplam ${Array.isArray(dosyalar) ? dosyalar.length : 0} dosya</p>
                <div class="files-list" style="max-height: 400px; overflow-y: auto;">
                    ${Array.isArray(dosyalar) && dosyalar.length > 0 ? dosyalar.map(dosya => `
                        <div class="file-card" onclick="showDanistayFileDetails('${dosya.dosyaId}', '${dosya.dosyaNo || 'N/A'}')">
                            <div class="file-number">${dosya.dosyaNo || dosya.esasNo || 'N/A'}</div>
                            <div class="file-detail-item"><strong>Karar No:</strong> ${dosya.kararNo || 'Yok'}</div>
                            ${dosya.ilkIncelemeTarih ? `<div class="file-detail-item">📅 ${dosya.ilkIncelemeTarih}</div>` : ''}
                        </div>
                    `).join('') : '<p class="text-center text-muted">Dosya bulunamadı</p>'}
                </div>
            </div>
        `;
        
        const modal = document.getElementById('settingsModal');
        const modalBody = modal.querySelector('.modal-body');
        modalBody.innerHTML = filesHtml;
        
    } catch (error) {
        showToast('Dosyalar yüklenemedi: ' + error.message, 'error');
    }
};

window.showDanistayFileDetails = async function(dosyaId, dosyaNo) {
    showToast('Dosya detayları yükleniyor...', 'info');
    
    try {
        const detay = await uyapApi.getDanistayDosyaDetay(dosyaId);
        
        if (detay.error) {
            showToast('Detay alınamadı: ' + detay.error, 'error');
            return;
        }
        
        alert(`Danıştay Dosya Detayı:\n\nDosya No: ${dosyaNo}\nDosya ID: ${dosyaId}\n\n${JSON.stringify(detay, null, 2)}`);
        // TODO: Create better detail view
        
    } catch (error) {
        showToast('Detay yüklenemedi: ' + error.message, 'error');
    }
};

window.openCBS = async function() {
    showToast('CBS illeri yükleniyor...', 'info');
    
    try {
        const iller = await uyapApi.getIller();
        
        if (iller.error) {
            showToast('İller alınamadı: ' + iller.error, 'error');
            return;
        }
        
        const modalHtml = `
            <div class="special-court-modal" id="cbsModal">
                <h3>📋 CBS İlleri</h3>
                <p class="text-muted">Bir il seçerek CBS birimlerini görüntüleyin</p>
                <div class="search-container" style="margin-bottom: 15px;">
                    <input type="text" id="ilSearchInput" class="search-input" placeholder="İl ara...">
                </div>
                <div class="daire-list" id="ilList" style="max-height: 400px; overflow-y: auto;">
                    ${Array.isArray(iller) ? iller.map(il => `
                        <div class="daire-card il-card" data-il-name="${(il.adi || il.ad || '').toLowerCase()}" onclick="loadCbsBirimler('${il.kodu || il.kod}', '${il.adi || il.ad}')">
                            <div class="daire-icon">📍</div>
                            <div class="daire-info">
                                <strong>${il.adi || il.ad || 'İl ' + (il.kodu || il.kod)}</strong>
                            </div>
                            <div class="daire-arrow">→</div>
                        </div>
                    `).join('') : '<p class="text-center text-muted">İl bulunamadı</p>'}
                </div>
            </div>
        `;
        
        const modal = document.getElementById('settingsModal');
        const modalBody = modal.querySelector('.modal-body');
        const modalTitle = modal.querySelector('.modal-header h3');
        
        modalTitle.textContent = '📋 CBS';
        modalBody.innerHTML = modalHtml;
        openModal('settingsModal');
        
        // Add search functionality
        setTimeout(() => {
            const searchInput = document.getElementById('ilSearchInput');
            if (searchInput) {
                searchInput.addEventListener('input', (e) => {
                    const query = e.target.value.toLowerCase();
                    const ilCards = document.querySelectorAll('.il-card');
                    ilCards.forEach(card => {
                        const ilName = card.dataset.ilName || '';
                        card.style.display = ilName.includes(query) ? 'flex' : 'none';
                    });
                });
            }
        }, 100);
        
    } catch (error) {
        showToast('CBS modülü hatası: ' + error.message, 'error');
    }
};

window.loadCbsBirimler = async function(ilKodu, ilAdi) {
    showToast(`${ilAdi} CBS birimleri yükleniyor...`, 'info');
    
    // Store ilKodu for back navigation
    window.currentCbsIlKodu = ilKodu;
    window.currentCbsIlAdi = ilAdi;
    
    try {
        const birimler = await uyapApi.getCbsBirimler(ilKodu);
        
        if (birimler.error) {
            showToast('Birimler alınamadı: ' + birimler.error, 'error');
            return;
        }
        
        const birimlHtml = `
            <div class="special-court-files">
                <div style="margin-bottom: 15px;">
                    <button class="btn-secondary" onclick="openCBS()">← İllere Dön</button>
                </div>
                <h4>${ilAdi} - CBS Birimleri</h4>
                <p class="text-muted">Toplam ${Array.isArray(birimler) ? birimler.length : 0} birim</p>
                <div class="daire-list">
                    ${Array.isArray(birimler) && birimler.length > 0 ? birimler.map(birim => `
                        <div class="daire-card" onclick="loadCbsFiles('${birim.id || birim.birimId}', '${birim.adi || birim.ad}')">
                            <div class="daire-icon">📋</div>
                            <div class="daire-info">
                                <strong>${birim.adi || birim.ad || 'Birim ' + (birim.id || birim.birimId)}</strong>
                            </div>
                            <div class="daire-arrow">→</div>
                        </div>
                    `).join('') : '<p class="text-center text-muted">Birim bulunamadı</p>'}
                </div>
            </div>
        `;
        
        const modal = document.getElementById('settingsModal');
        const modalBody = modal.querySelector('.modal-body');
        modalBody.innerHTML = birimlHtml;
        
    } catch (error) {
        showToast('Birimler yüklenemedi: ' + error.message, 'error');
    }
};

window.loadCbsFiles = async function(birimId, birimAdi) {
    showToast(`${birimAdi} dosyaları yükleniyor...`, 'info');
    
    try {
        const dosyalar = await uyapApi.getCbsDosyalar(birimId);
        
        if (dosyalar.error) {
            showToast('Dosyalar alınamadı: ' + dosyalar.error, 'error');
            return;
        }
        
        const filesHtml = `
            <div class="special-court-files">
                <div style="margin-bottom: 15px;">
                    <button class="btn-secondary" onclick="loadCbsBirimler('${window.currentCbsIlKodu || ''}', '${window.currentCbsIlAdi || 'İl'}')">← Birimlere Dön</button>
                </div>
                <h4>${birimAdi} - Dosyalar</h4>
                <p class="text-muted">Toplam ${Array.isArray(dosyalar) ? dosyalar.length : 0} dosya</p>
                <div class="files-list" style="max-height: 400px; overflow-y: auto;">
                    ${Array.isArray(dosyalar) && dosyalar.length > 0 ? dosyalar.map(dosya => `
                        <div class="file-card">
                            <div class="file-number">${dosya.dosyaNo || dosya.esasNo || 'N/A'}</div>
                            <div class="file-detail-item"><strong>Birim:</strong> ${dosya.birimAdi || 'N/A'}</div>
                            ${dosya.durum ? `<div class="file-status">${dosya.durum}</div>` : ''}
                        </div>
                    `).join('') : '<p class="text-center text-muted">Dosya bulunamadı</p>'}
                </div>
            </div>
        `;
        
        const modal = document.getElementById('settingsModal');
        const modalBody = modal.querySelector('.modal-body');
        modalBody.innerHTML = filesHtml;
        
    } catch (error) {
        showToast('Dosyalar yüklenemedi: ' + error.message, 'error');
    }
};

// ============================================================================
// SETTINGS
// ============================================================================

window.openSettings = function() {
    // Load current settings
    const notificationEnabled = localStorage.getItem('notificationEnabled') !== 'false';
    const autoSyncEnabled = localStorage.getItem('autoSyncEnabled') !== 'false';
    const autoBackupEnabled = localStorage.getItem('autoBackupEnabled') === 'true';
    const backupRetention = localStorage.getItem('backupRetention') || '30';
    
    document.getElementById('notificationEnabled').checked = notificationEnabled;
    document.getElementById('autoSyncEnabled').checked = autoSyncEnabled;
    document.getElementById('autoBackupEnabled').checked = autoBackupEnabled;
    document.getElementById('backupRetention').value = backupRetention;
    
    openModal('settingsModal');
};

window.saveSettings = function() {
    localStorage.setItem('notificationEnabled', document.getElementById('notificationEnabled').checked);
    localStorage.setItem('autoSyncEnabled', document.getElementById('autoSyncEnabled').checked);
    localStorage.setItem('autoBackupEnabled', document.getElementById('autoBackupEnabled').checked);
    localStorage.setItem('backupRetention', document.getElementById('backupRetention').value);
    
    closeModal('settingsModal');
    showToast('Ayarlar kaydedildi', 'success');
};

window.exportDatabase = async function() {
    showToast('Veritabanı dışa aktarılıyor...', 'info');
    // TODO: Implement database export
};

window.clearDatabase = async function() {
    if (!confirm('TÜM VERİLER SİLİNECEK! Emin misiniz?')) return;
    if (!confirm('Bu işlem geri alınamaz. Son kez soruyoruz, emin misiniz?')) return;
    
    showToast('Veritabanı temizleniyor...', 'info');
    // TODO: Implement database clear
};

// ============================================================================
// MODAL MANAGEMENT
// ============================================================================

function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('active');
        
        // Hide webview container to prevent z-index issues (webview always renders on top)
        const browserContainer = document.getElementById('browser-container');
        if (browserContainer) {
            browserContainer.classList.add('modal-open');
        }
    }
}

window.closeModal = function(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
        
        // Show webview container again
        const browserContainer = document.getElementById('browser-container');
        if (browserContainer) {
            browserContainer.classList.remove('modal-open');
        }
    }
};

// Close modals on background click
document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('active');
            
            // Show webview container again
            const browserContainer = document.getElementById('browser-container');
            if (browserContainer) {
                browserContainer.classList.remove('modal-open');
            }
        }
    });
});

// ============================================================================
// TOAST NOTIFICATIONS
// ============================================================================

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icons = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
    };
    
    toast.innerHTML = `
        <span class="toast-icon">${icons[type]}</span>
        <span class="toast-message">${message}</span>
    `;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideIn 0.3s ease reverse';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ============================================================================
// EVENT LISTENERS
// ============================================================================

function initializeEventListeners() {
    // Webview ready
    webview?.addEventListener('dom-ready', () => {
        console.log('✅ Webview hazır');
        checkSession();
    });
    
    // Badge clicks
    document.getElementById('badge-dosyalar')?.addEventListener('click', () => switchTab('dosyalar'));
    document.getElementById('badge-evraklar')?.addEventListener('click', () => switchTab('dosyalar'));
    document.getElementById('badge-tebligatlar')?.addEventListener('click', () => switchTab('dosyalar'));
    document.getElementById('badge-notlar')?.addEventListener('click', () => switchTab('notlar'));
}

// ============================================================================
// EXPORTS
// ============================================================================

window.uyapApp = {
    switchTab,
    openFileDetails,
    openNoteDialog,
    saveNote,
    deleteNote,
    openSettings,
    saveSettings,
    showToast,
    openModal,
    closeModal
};

console.log('✅ UYAP Desktop Stage 2 Ready');
