# UYAP Desktop Uygulaması - Kullanım Kılavuzu

Bu kılavuz, UYAP API özelliklerinin nasıl kullanılacağını adım adım açıklar.

## 🚀 Hızlı Başlangıç

### 1. Kurulum

Önce gerekli paketleri yükleyin:

```bash
npm install
```

### 2. Uygulamayı Çalıştırma

Uygulamayı başlatmak için:

```bash
npm start
```

veya geliştirme modunda:

```bash
npm run dev
```

## 📖 Temel Kullanım

### Uygulama Başlatma

1. **Terminal açın** (Windows: CMD veya PowerShell, Mac/Linux: Terminal)
2. Proje klasörüne gidin:
   ```bash
   cd /path/to/DENEME
   ```
3. Uygulamayı başlatın:
   ```bash
   npm start
   ```

### İlk Kullanım

Uygulama başladığında:

1. **UYAP'a giriş yapın** - Webview üzerinden normal UYAP girişi yapın
2. **Session otomatik yakalanır** - Cookies ve session bilgileri otomatik olarak alınır
3. **API kullanıma hazır** - Artık tüm UYAP API fonksiyonları kullanılabilir

## 🔧 API Kullanımı

### Konsol Üzerinden Test

Electron Developer Tools'u açın (F12 veya Ctrl+Shift+I) ve Console'da şunları deneyin:

#### 1. API Başlatma

```javascript
// UYAPApi instance'ı oluştur
const uyapApi = new UYAPApi();

// Session bilgilerini kontrol et
console.log('Session:', uyapApi.sessionData);
```

#### 2. Dosya İşlemleri

```javascript
// Dosya taraflarını al
const dosyaId = 'BURAYA_DOSYA_ID_YAZIN';
const parties = await uyapApi.getParties(dosyaId);
console.log('Taraflar:', parties);

// Dosya detaylarını al
const details = await uyapApi.getDosyaDetails(dosyaId);
console.log('Dosya Detayları:', details);

// Tüm evrakları al
const evraklar = await uyapApi.getAllEvrak(dosyaId);
console.log('Gelen Evraklar:', evraklar.gelen.length);
console.log('Giden Evraklar:', evraklar.giden.length);
```

#### 3. Tebligat Kontrolü

```javascript
// Tebligat durumunu kontrol et
const tebligatlar = [
  {
    barkodNo: 12345678901234,
    evrakTarihi: new Date('2024-01-15'),
    eTebligat: false
  }
];

const results = await uyapApi.checkTebligatStatus(tebligatlar);
console.log('Tebligat Durumları:', results);
```

#### 4. Google Drive Yedekleme

```javascript
// Yedek al
const backupData = {
  dosyalar: [],
  evraklar: [],
  timestamp: new Date().toISOString()
};

const result = await uyapApi.uploadToGoogleDrive(
  backupData,
  '12345678.json',
  'Test Yedeği'
);
console.log('Yedek Sonucu:', result);
```

#### 5. Badge Güncelleme

```javascript
// Badge sayılarını güncelle
await uyapApi.updateBadges({
  dosyalar: 5,
  evraklar: 12,
  tebligatlar: 3
});

// Mevcut badge'leri gör
const badges = uyapApi.getBadges();
console.log('Badges:', badges);
```

## 📝 Kod Örnekleri

### Tam Örnek: Dosya Bilgilerini Alma

```javascript
async function dosyaBilgileriniAl(dosyaId) {
  try {
    const uyapApi = new UYAPApi();
    
    console.log('📁 Dosya bilgileri alınıyor...');
    
    // Session kontrolü
    await uyapApi.ensureSession();
    
    // Tarafları al
    const parties = await uyapApi.getParties(dosyaId);
    console.log('👥 Taraflar:', parties);
    
    // Evrakları al
    const evraklar = await uyapApi.getAllEvrak(dosyaId);
    console.log(`📄 Toplam ${evraklar.all.length} evrak bulundu`);
    console.log(`  - Gelen: ${evraklar.gelen.length}`);
    console.log(`  - Giden: ${evraklar.giden.length}`);
    console.log(`  - Diğer: ${evraklar.diger.length}`);
    
    // Dosya detaylarını al
    const details = await uyapApi.getDosyaDetails(dosyaId);
    console.log('📋 Dosya Detayları:', details);
    
    return {
      parties,
      evraklar,
      details
    };
    
  } catch (error) {
    console.error('❌ Hata:', error);
    throw error;
  }
}

// Kullanım
dosyaBilgileriniAl('DOSYA_ID_BURAYA').then(result => {
  console.log('✅ İşlem tamamlandı:', result);
});
```

### Tam Örnek: Otomatik Yedekleme

```javascript
async function otomatikYedekle(avukatId) {
  try {
    const uyapApi = new UYAPApi();
    
    console.log('💾 Otomatik yedekleme başlatılıyor...');
    
    // Tüm verileri topla (örnek - kendi verilerinizi kullanın)
    const allData = {
      dosyalar: [], // Dosya listesi
      evraklar: [], // Evrak listesi
      notlar: [],   // Notlar
      timestamp: new Date().toISOString(),
      version: '1.0'
    };
    
    // Google Drive'a yedekle
    const fileName = `${avukatId}.json`;
    const description = `Otomatik Yedek - ${new Date().toLocaleDateString('tr-TR')}`;
    
    const result = await uyapApi.uploadToGoogleDrive(
      allData,
      fileName,
      description
    );
    
    if (result.error) {
      console.error('❌ Yedekleme başarısız:', result.error);
      return false;
    }
    
    console.log('✅ Yedekleme başarılı:', result.id);
    
    // Eski yedekleri temizle (30+ günlük)
    const backups = await uyapApi.searchGoogleDriveBackups(avukatId);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    for (const backup of backups) {
      const backupDate = new Date(backup.createdTime);
      if (backupDate < thirtyDaysAgo) {
        console.log('🗑️ Eski yedek siliniyor:', backup.name);
        await uyapApi.deleteFromGoogleDrive(backup.id);
      }
    }
    
    return true;
    
  } catch (error) {
    console.error('❌ Yedekleme hatası:', error);
    return false;
  }
}

// Her gün otomatik yedekleme
setInterval(() => {
  otomatikYedekle('12345678');
}, 24 * 60 * 60 * 1000);
```

## 🎯 Pratik Senaryolar

### Senaryo 1: Tüm Yeni Dosyalarımı Bul

```javascript
async function yeniDosyalariBul(yargiTuru = '0991') {
  const uyapApi = new UYAPApi();
  
  // Son 2 hafta
  const baslangic = new Date();
  baslangic.setDate(baslangic.getDate() - 14);
  const bitis = new Date();
  
  console.log('🔍 Yeni dosyalar aranıyor...');
  
  const safahat = await uyapApi.queryAllSafahat(
    yargiTuru,
    baslangic,
    bitis
  );
  
  console.log(`✅ ${safahat.length} yeni dosya bulundu`);
  return safahat;
}
```

### Senaryo 2: Tüm Tebligatları Kontrol Et

```javascript
async function tumTebligatKontrol() {
  const uyapApi = new UYAPApi();
  
  // Veritabanından bekleyen tebligatları al (örnek)
  const bekleyenTebligatlar = [
    // Tebligat listesi buraya
  ];
  
  console.log('📮 Tebligatlar kontrol ediliyor...');
  
  const results = await uyapApi.checkTebligatStatus(bekleyenTebligatlar);
  
  // Teslim edilen tebligatları göster
  const teslimedilen = results.filter(r => r.isLastState === 2);
  console.log(`✅ ${teslimedilen.length} tebligat teslim edildi`);
  
  // Teslim edilemeyen tebligatları göster
  const edilemeyen = results.filter(r => r.isLastState === 1);
  console.log(`⚠️ ${edilemeyen.length} tebligat teslim edilemedi`);
  
  return results;
}
```

### Senaryo 3: CBS Dosyalarını Senkronize Et

```javascript
async function cbsSync() {
  const uyapApi = new UYAPApi();
  
  console.log('🔄 CBS dosyaları senkronize ediliyor...');
  console.log('⚠️ Bu işlem 10-30 dakika sürebilir!');
  
  const allCbs = await uyapApi.syncAllCbsDosyalar((progress) => {
    if (progress.stage === 'il') {
      console.log(`📍 İl: ${progress.ilAdi} (${progress.current}/${progress.total})`);
    } else if (progress.stage === 'birim') {
      console.log(`  📂 Birim: ${progress.birimCurrent}/${progress.birimTotal}`);
    }
  });
  
  console.log(`✅ Toplam ${allCbs.length} CBS dosyası bulundu`);
  return allCbs;
}
```

## 🐛 Sorun Giderme

### Hata: "JSESSIONID bulunamadı"

**Çözüm**: UYAP'a giriş yapmadınız. Webview'den UYAP'a giriş yapın.

```javascript
// Session'ı manuel kontrol edin
const uyapApi = new UYAPApi();
await uyapApi.initializeSession();
console.log('Session:', uyapApi.sessionData);
```

### Hata: "Token bulunamadı"

**Çözüm**: Google entegrasyonu için yetkilendirme gerekli.

```javascript
// Token'ı kontrol edin
const token = await uyapApi.getGoogleAccessToken();
if (!token) {
  console.log('Google yetkilendirmesi gerekli!');
}
```

### Hata: "Dosya bulunamadı" (404)

**Çözüm**: Dosya ID'si yanlış veya dosya arşivlenmiş.

```javascript
// Dosya aktiflik kontrolü
const dosya = { /* dosya bilgileri */ };
if (uyapApi.isDosyaActive(dosya)) {
  console.log('✅ Dosya aktif');
} else {
  console.log('❌ Dosya arşivde veya kapalı');
}
```

### Hata: Oturum kapalı (401)

**Çözüm**: Session süresi dolmuş, otomatik yenilenecek.

```javascript
// Manuel yenileme
await uyapApi.ensureSession();
```

## 📚 Daha Fazla Bilgi

- **Detaylı API Dokümantasyonu**: `README.md`
- **Kod Örnekleri**: `UYAP_API_EXAMPLES.md`
- **Entegrasyon Özeti**: `INTEGRATION_SUMMARY.md`

## 💡 İpuçları

1. **Developer Tools kullanın**: F12 ile konsolu açın ve API'yi test edin
2. **Hataları yakalayın**: Her zaman try-catch kullanın
3. **Retry kullanın**: Kritik işlemler için `executeWithRetry()` kullanın
4. **Progress callback**: Uzun işlemlerde progress callback kullanın
5. **Badge güncelleyin**: Kullanıcı deneyimi için badge'leri güncelleyin

## 📞 Destek

Sorularınız için GitHub Issues kullanabilirsiniz.

---

**Son Güncelleme**: 14 Aralık 2024  
**Versiyon**: 1.0.0
