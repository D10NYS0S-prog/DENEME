// Test script - butonların çalışıp çalışmadığını kontrol et
console.log('=== UYAP Desktop Test ===');

const syncBtn = document.getElementById('sync-btn');
const devtoolsBtn = document.getElementById('devtools-btn');

console.log('syncBtn:', syncBtn);
console.log('devtoolsBtn:', devtoolsBtn);

if (syncBtn) {
    syncBtn.addEventListener('click', () => {
        console.log('Sync butonuna tıklandı!');
        alert('Buton çalışıyor! ✅');
    });
    console.log('✅ Sync butonu event listener eklendi');
} else {
    console.error('❌ sync-btn bulunamadı!');
}

if (devtoolsBtn) {
    devtoolsBtn.addEventListener('click', () => {
        console.log('DevTools butonuna tıklandı!');
        const webview = document.getElementById('uyap-browser');
        if (webview) {
            webview.openDevTools();
        }
    });
    console.log('✅ DevTools butonu event listener eklendi');
} else {
    console.error('❌ devtools-btn bulunamadı!');
}

console.log('=== Test tamamlandı ===');
