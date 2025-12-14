// UYAP Veri Çekme Scripti
// Bu kodu UYAP sayfasında Console'da çalıştırın

(function () {
    console.log('🔍 UYAP Dosya Listesi Çekiliyor...');

    // Tüm dosya satırlarını bul
    const rows = document.querySelectorAll('.dx-datagrid tr[role="row"]');
    const dosyalar = [];

    rows.forEach((row, index) => {
        // Her satırdaki hücreleri al
        const cells = row.querySelectorAll('td');

        if (cells.length > 0) {
            // Hücrelerdeki metinleri al
            const data = Array.from(cells).map(cell => cell.textContent.trim());

            // Dosya bilgilerini oluştur
            if (data.length >= 3) {
                dosyalar.push({
                    id: index + 1,
                    mahkeme: data[0] || '',
                    dosyaNo: data[1] || '',
                    taraflar: data[2] || '',
                    durum: data[3] || 'Aktif',
                    yeniEvrakSayisi: 0 // Bu bilgi başka bir yerden alınmalı
                });
            }
        }
    });

    console.log(`✅ ${dosyalar.length} dosya bulundu:`, dosyalar);

    // Sonucu kopyalanabilir formatta göster
    console.log('📋 Kopyalanabilir JSON:');
    console.log(JSON.stringify(dosyalar, null, 2));

    return dosyalar;
})();
