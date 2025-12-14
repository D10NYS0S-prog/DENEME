/**
 * UYAP Evrak Test Script
 * Bu script evrak API'sini test etmek için kullanılır
 */

// Test fonksiyonu
async function testEvrakAPI() {
    console.log('🧪 UYAP Evrak API Testi Başlıyor...');

    // 1. Dosya ID'sini al (örnek)
    const dosyaId = prompt('Dosya ID girin (UYAP\'tan):');

    if (!dosyaId) {
        console.error('❌ Dosya ID gerekli!');
        return;
    }

    try {
        // 2. API instance'ı oluştur
        const uyapApi = new UYAPApi();

        // 3. Session kontrolü
        console.log('🔐 Session kontrol ediliyor...');
        await uyapApi.ensureSession();
        console.log('✅ Session hazır');

        // 4. Evrakları al
        console.log(`📄 Evraklar alınıyor: ${dosyaId}`);
        const evrakData = await uyapApi.getAllEvrak(dosyaId);

        // 5. Sonuçları göster
        console.log('📊 Sonuçlar:');
        console.log(`  - Toplam: ${evrakData.all.length}`);
        console.log(`  - Gelen: ${evrakData.gelen.length}`);
        console.log(`  - Giden: ${evrakData.giden.length}`);
        console.log(`  - Diğer: ${evrakData.diger.length}`);

        // 6. İlk 5 evrakı göster
        console.log('\n📋 İlk 5 Evrak:');
        evrakData.all.slice(0, 5).forEach((evrak, index) => {
            console.log(`${index + 1}. ${evrak.evrakTur || evrak.tur} - ${evrak.evrakTarih || evrak.tarih}`);
        });

        // 7. Alert ile özet göster
        alert(`✅ Başarılı!\n\nToplam: ${evrakData.all.length} evrak\nGelen: ${evrakData.gelen.length}\nGiden: ${evrakData.giden.length}\nDiğer: ${evrakData.diger.length}`);

        return evrakData;

    } catch (error) {
        console.error('❌ Hata:', error);
        alert(`❌ Hata oluştu:\n${error.message}\n\nDetaylar console'da`);
        throw error;
    }
}

// Test fonksiyonunu global scope'a ekle
window.testEvrakAPI = testEvrakAPI;

console.log('✅ Test script yüklendi. Kullanım: testEvrakAPI()');
