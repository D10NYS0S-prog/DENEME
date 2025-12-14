// Frontend JavaScript - UI Logic

let isLoggedIn = false;

// DOM Elements
const loginScreen = document.getElementById('login-screen');
const dashboardScreen = document.getElementById('dashboard-screen');
const loginForm = document.getElementById('login-form');
const loginBtn = document.getElementById('login-btn');
const loginStatus = document.getElementById('login-status');
const syncStatus = document.getElementById('sync-status');
const filesContainer = document.getElementById('files-container');
const syncBtn = document.getElementById('sync-btn');
const downloadAllBtn = document.getElementById('download-all-btn');

// Login Form Submit
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    loginBtn.disabled = true;
    loginBtn.textContent = 'Giriş yapılıyor...';
    loginStatus.innerHTML = '<p style="color: #667eea;">UYAP\'a bağlanılıyor...</p>';

    try {
        const result = await window.electronAPI.uyapLogin({ username, password });

        if (result.success) {
            loginStatus.innerHTML = '<p style="color: #4caf50;">✓ Giriş başarılı!</p>';
            isLoggedIn = true;
            syncStatus.textContent = '🟢 Bağlı';
            syncStatus.style.background = '#d4edda';

            setTimeout(() => {
                showDashboard();
                loadDosyaList();
            }, 1000);
        } else {
            loginStatus.innerHTML = `<p style="color: #f44336;">✗ Hata: ${result.error}</p>`;
            loginBtn.disabled = false;
            loginBtn.textContent = 'Giriş Yap';
        }
    } catch (error) {
        loginStatus.innerHTML = `<p style="color: #f44336;">✗ Beklenmeyen hata: ${error.message}</p>`;
        loginBtn.disabled = false;
        loginBtn.textContent = 'Giriş Yap';
    }
});

// Show Dashboard
function showDashboard() {
    loginScreen.classList.remove('active');
    dashboardScreen.classList.add('active');
}

// Load Dosya List
async function loadDosyaList() {
    filesContainer.innerHTML = '<p class="loading">Dosyalar yükleniyor...</p>';

    try {
        const result = await window.electronAPI.getDosyaList();

        if (result.success && result.data) {
            displayDosyaList(result.data);
            updateStats(result.data);
        } else {
            filesContainer.innerHTML = '<p style="color: #f44336;">Dosyalar yüklenemedi.</p>';
        }
    } catch (error) {
        filesContainer.innerHTML = `<p style="color: #f44336;">Hata: ${error.message}</p>`;
    }
}

// Display Dosya List
function displayDosyaList(dosyalar) {
    if (!dosyalar || dosyalar.length === 0) {
        filesContainer.innerHTML = '<p class="loading">Henüz dosya bulunmuyor.</p>';
        return;
    }

    filesContainer.innerHTML = '';

    dosyalar.forEach(dosya => {
        const fileItem = document.createElement('div');
        fileItem.className = 'file-item';
        if (dosya.yeniEvrakSayisi > 0) {
            fileItem.classList.add('new');
        }

        fileItem.innerHTML = `
            <h3>
                ${dosya.mahkeme}
                ${dosya.yeniEvrakSayisi > 0 ? `<span class="file-badge">${dosya.yeniEvrakSayisi} yeni</span>` : ''}
            </h3>
            <p><strong>Dosya No:</strong> ${dosya.dosyaNo}</p>
            <p><strong>Taraflar:</strong> ${dosya.taraflar || 'Bilgi yok'}</p>
            <p><strong>Durum:</strong> ${dosya.durum || 'Aktif'}</p>
        `;

        fileItem.addEventListener('click', () => {
            showDosyaDetay(dosya);
        });

        filesContainer.appendChild(fileItem);
    });
}

// Update Stats
function updateStats(dosyalar) {
    const totalFiles = dosyalar.length;
    const newDocuments = dosyalar.reduce((sum, d) => sum + (d.yeniEvrakSayisi || 0), 0);

    document.getElementById('total-files').textContent = totalFiles;
    document.getElementById('new-documents').textContent = newDocuments;
}

// Show Dosya Detay
function showDosyaDetay(dosya) {
    alert(`Dosya Detayı:\n\nMahkeme: ${dosya.mahkeme}\nDosya No: ${dosya.dosyaNo}\n\n(Detay ekranı yakında eklenecek)`);
}

// Webview console mesajlarını ana konsola yönlendir
// Note: 'webview' object is not defined in this render process context.
// This part of the code seems to be intended for a different context (e.g., main process or a webview-specific script).
// For now, it's commented out to avoid errors.
/*
webview.addEventListener('console-message', (e) => {
    console.log('WebView:', e.message);
});
*/

// Yakalanan UYAP verilerini dinle (Main Process üzerinden gelecek)
window.electronAPI?.onUyapData((data) => {
    console.log('📦 Render Process Veriyi Aldı:', data);

    // Veriyi analiz et ve dosya listesi ise ekrana bas
    // Not: Gelen veri yapısına göre burayı özelleştireceğiz.
    // Şimdilik ham veriyi kontrol edelim.
    if (Array.isArray(data.data)) {
        processUyapData(data.data);
    } else if (data.data && data.data.data && Array.isArray(data.data.data)) {
        // Bazen { success: true, data: [...] } formatında olabilir
        processUyapData(data.data.data);
    }
});

function processUyapData(items) {
    if (!items || !items.length) return;

    // Dosya yapısına benziyor mu kontrol et
    const possibleFiles = items.filter(item =>
        (item.dosyaNo || item.dosyaId || (item.birimAd && item.dosyaYil))
    );

    if (possibleFiles.length > 0) {
        // Mevcut listeyi temizle
        // const fileList = document.getElementById('file-list');
        // fileList.innerHTML = '';

        // Bildirim göster
        const syncBtn = document.getElementById('sync-btn');
        syncBtn.innerText = `✅ ${possibleFiles.length} Dosya Tespit Edildi`;
        syncBtn.style.background = '#48bb78';

        possibleFiles.forEach(d => {
            addFileToUI({
                mahkeme: d.birimAd || d.mahkeme || 'Bilinmeyen Birim',
                dosyaNo: d.dosyaNo || `${d.dosyaYil}/${d.dosyaSiraNo}`,
                taraflar: d.tarafRol || d.dosyaTuru || ''
            });
        });
    }
}

function addFileToUI(file) {
    const fileList = document.getElementById('file-list');
    const div = document.createElement('div');
    div.className = 'file-item';
    div.innerHTML = `
        <h4>${file.mahkeme}</h4>
        <p><strong>Dosya No:</strong> ${file.dosyaNo}</p>
        <p>${file.taraflar}</p>
    `;
    fileList.prepend(div); // En üste ekle
}

// Sync Button
syncBtn.addEventListener('click', async () => {
    syncBtn.disabled = true;
    syncBtn.textContent = '🔄 Senkronize ediliyor...';

    await loadDosyaList();

    syncBtn.disabled = false;
    syncBtn.textContent = '🔄 Senkronize Et';
});

// Download All Button
downloadAllBtn.addEventListener('click', () => {
    alert('Toplu indirme özelliği yakında eklenecek!');
});

console.log('UYAP Desktop UI yüklendi');
