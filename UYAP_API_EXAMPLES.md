# UYAP API Kullanım Örnekleri

Bu doküman, uyap-api.js'nin çeşitli kullanım senaryolarını göstermektedir.

## İçindekiler

- [Temel Kullanım](#temel-kullanım)
- [Dosya İşlemleri](#dosya-i̇şlemleri)
- [Evrak İşlemleri](#evrak-i̇şlemleri)
- [Tebligat İşlemleri](#tebligat-i̇şlemleri)
- [Yargıtay/Danıştay](#yargıtaydanıştay)
- [CBS İşlemleri](#cbs-i̇şlemleri)
- [Google Entegrasyonu](#google-entegrasyonu)
- [Hata Yönetimi](#hata-yönetimi)

## Temel Kullanım

### API'yi Başlatma

```javascript
// UYAPApi sınıfını oluştur
const uyapApi = new UYAPApi();

// Session otomatik olarak başlatılır
// Manuel başlatmak için:
await uyapApi.initializeSession();

// Session bilgilerini kontrol et
console.log('Session:', uyapApi.sessionData);
```

### Session Yenileme

```javascript
// Session otomatik olarak yenilenir (2 dakikadan eski ise)
// Manuel yenilemek için:
await uyapApi.ensureSession();
```

## Dosya İşlemleri

### Basit Dosya Sorgulama

```javascript
// Dosya ID ile tarafları alma
const dosyaId = '12345678901234567890';
const parties = await uyapApi.getParties(dosyaId);

if (parties.error) {
  console.error('Hata:', parties.error);
} else {
  console.log('Davacı:', parties.data.filter(p => p.rol === 'Davacı'));
  console.log('Davalı:', parties.data.filter(p => p.rol === 'Davalı'));
}
```

### Detaylı Dosya Bilgileri

```javascript
// Tam dosya bilgileri (parties, evrak sayısı, detaylar)
const fullInfo = await uyapApi.getDosyaDetails(dosyaId, true);

console.log('Dosya ID:', fullInfo.dosyaId);
console.log('Detaylar:', fullInfo.details);
console.log('Taraflar:', fullInfo.parties);
console.log('Toplam Evrak Sayfası:', fullInfo.evrakPageTotal);
```

### Queue ile Senkronizasyon

```javascript
// Birden fazla dosyayı senkronize etme
const dosyaIds = ['123...', '456...', '789...'];

const syncPromises = dosyaIds.map(id => uyapApi.syncDosya(id));
const results = await Promise.allSettled(syncPromises);

results.forEach((result, index) => {
  if (result.status === 'fulfilled') {
    console.log(`Dosya ${dosyaIds[index]} başarılı:`, result.value);
  } else {
    console.error(`Dosya ${dosyaIds[index]} hata:`, result.reason);
  }
});
```

### Gelişmiş Arama

```javascript
// Dosya numarasıyla arama
const results = await uyapApi.searchByDosyaNo(
  '2024/123',
  'birimId123',
  '0991' // Adli Yargı
);

// Kriterlere göre arama
const searchResults = await uyapApi.searchDosyalar({
  yargiTuru: '0991',
  birimId: 'birimId123',
  dosyaDurumKod: 1, // Açık dosyalar
  dosyaYil: 2024,
  dosyaSira: 123,
  pageNumber: 1,
  pageSize: 100
});
```

### Dosya Durumu Kontrolü

```javascript
// Dosyanın aktif olup olmadığını kontrol et
const dosya = { /* dosya bilgileri */ };

if (uyapApi.isDosyaActive(dosya)) {
  console.log('Dosya aktif');
} else {
  console.log('Dosya arşivde veya kapalı');
}
```

## Evrak İşlemleri

### Tüm Evrakları Listeleme

```javascript
// Tüm evrakları kategorilere ayrılmış şekilde al
const evraklar = await uyapApi.getAllEvrak(dosyaId);

console.log('Gelen Evraklar:', evraklar.gelen.length);
console.log('Giden Evraklar:', evraklar.giden.length);
console.log('Diğer Evraklar:', evraklar.diger.length);
console.log('Toplam:', evraklar.all.length);

// İlk 5 gelen evrakı göster
evraklar.gelen.slice(0, 5).forEach(evrak => {
  console.log(`${evrak.evrakNo} - ${evrak.evrakTuru}`);
});
```

### Sayfa Sayısını Alma

```javascript
// Evrak sayfa sayısını öğren
const pageTotal = await uyapApi.getEvrakPageTotal(dosyaId);
console.log(`Toplam ${pageTotal} sayfa evrak var`);
```

### Evrak İndirme

```javascript
// Belirli bir evrakı indir
const evrak = {
  evrakId: '12345',
  dosyaId: dosyaId
};

const downloadResult = await uyapApi.downloadDocument(evrak);

if (downloadResult.error) {
  console.error('İndirme hatası:', downloadResult.error);
} else {
  // Base64 olarak döner
  console.log('Dosya adı:', downloadResult.filename);
  console.log('MIME type:', downloadResult.mime);
  // downloadResult.base64 ile dosyayı kaydet
}
```

## Tebligat İşlemleri

### Tebligat Kontrolü

```javascript
// Tebligat listesini hazırla
const tebligatlar = [
  {
    barkodNo: 12345678901234,
    evrakTarihi: new Date('2024-01-15'),
    eTebligat: false
  },
  {
    barkodNo: 0,
    evrakTarihi: new Date('2024-01-20'),
    eTebligat: true
  }
];

// Tebligat durumlarını kontrol et
const results = await uyapApi.checkTebligatStatus(tebligatlar);

results.forEach(result => {
  console.log(`Barkod: ${result.barkodNo}`);
  console.log(`Durum: ${result.durum}`);
  console.log(`Son Durum Tarihi: ${result.lastStateTarihi}`);
});
```

### eTebligat Hesaplama

```javascript
// eTebligat durumunu hesapla (5 gün kuralı)
const eTebligat = {
  evrakTarihi: new Date('2024-01-10'),
  eTebligat: true
};

const status = uyapApi.calculateETebligatStatus(eTebligat);
console.log('Durum:', status.durum);
console.log('Teslim durumu:', status.isLastState); // 0: Beklemede, 2: Teslim edildi
```

### PDF'den Tebligat Bilgisi

```javascript
// Tebligat PDF'ini ayrıştır
const pdfData = /* PDF binary data */;
const tebligatInfo = await uyapApi.parseTebligatPDF(pdfData);

console.log('Barkod No:', tebligatInfo.barkodNo);
console.log('İçerik:', tebligatInfo.icerik);
console.log('eTebligat mı?:', tebligatInfo.eTebligat);
```

## Yargıtay/Danıştay

### Yargıtay İşlemleri

```javascript
// Yargıtay dairelerini listele
const daireler = await uyapApi.getYargitayDaireleri();
console.log('Yargıtay Daireleri:', daireler.length);

// Belirli bir dairedeki dosyaları al
const dosyalar = await uyapApi.getYargitayDosyalar(daireler[0].birimId);
console.log('Dosya sayısı:', dosyalar.length);

// Dosya detayını al
if (dosyalar.length > 0) {
  const detay = await uyapApi.getYargitayDosyaDetay(dosyalar[0].dosyaId);
  console.log('Dosya Detayı:', detay);
}
```

### Danıştay İşlemleri

```javascript
// Danıştay dairelerini listele
const daireler = await uyapApi.getDanistayDaireleri();
console.log('Danıştay Daireleri:', daireler.length);

// Belirli bir dairedeki dosyaları al
const dosyalar = await uyapApi.getDanistayDosyalar(daireler[0].birimId);
console.log('Dosya sayısı:', dosyalar.length);

// Dosya detayını al
if (dosyalar.length > 0) {
  const detay = await uyapApi.getDanistayDosyaDetay(dosyalar[0].dosyaId);
  console.log('Dosya Detayı:', detay);
}
```

## CBS İşlemleri

### Basit CBS Sorgulama

```javascript
// İlleri listele
const iller = await uyapApi.getIller();
console.log('Toplam il sayısı:', iller.length);

// Ankara'nın CBS birimlerini al
const ankaraIl = iller.find(il => il.ilAdi === 'ANKARA');
const birimler = await uyapApi.getCbsBirimler(ankaraIl.il);
console.log('Ankara CBS birimleri:', birimler.length);

// İlk birimin dosyalarını al
if (birimler.length > 0) {
  const dosyalar = await uyapApi.getCbsDosyalar(birimler[0].birimId);
  console.log('Dosya sayısı:', dosyalar.length);
}
```

### Tüm CBS Dosyalarını Senkronize Etme

```javascript
// ⚠️ UYARI: Bu işlem uzun sürebilir (10-30 dakika)
const allCbsDosyalar = await uyapApi.syncAllCbsDosyalar((progress) => {
  if (progress.stage === 'il') {
    console.log(`İl işleniyor: ${progress.ilAdi} (${progress.current}/${progress.total})`);
  } else if (progress.stage === 'birim') {
    console.log(`  Birim: ${progress.birimCurrent}/${progress.birimTotal}`);
  }
});

console.log(`Toplam ${allCbsDosyalar.length} CBS dosyası bulundu`);
```

## Google Entegrasyonu

### Google Tasks (Görevler)

```javascript
// Google Tasks'a yeni görev ekle
const task = await uyapApi.createGoogleTask(
  'Duruşma Hazırlığı - Dosya 2024/123',
  'Tanık listesini hazırla\nDelilleri derle\nSavunma dosyasını kontrol et',
  new Date('2024-12-25') // Bitiş tarihi
);

if (task.error) {
  console.error('Task oluşturulamadı:', task.error);
} else {
  console.log('Task oluşturuldu:', task.id);
}

// Görev listelerini al
const taskLists = await uyapApi.getGoogleTaskLists();
console.log('Görev listeleri:', taskLists.items);
```

### Google Drive Yedekleme

```javascript
// Veriyi Google Drive'a yedekle
const backupData = {
  dosyalar: [ /* dosya listesi */ ],
  evraklar: [ /* evrak listesi */ ],
  notlar: [ /* not listesi */ ],
  timestamp: new Date().toISOString()
};

const avukatId = '12345678';
const fileName = `${avukatId}.json`;
const description = `UYAP Yedeği - ${new Date().toLocaleDateString('tr-TR')}`;

const uploadResult = await uyapApi.uploadToGoogleDrive(
  backupData,
  fileName,
  description
);

if (uploadResult.error) {
  console.error('Yedekleme hatası:', uploadResult.error);
} else {
  console.log('Yedek oluşturuldu:', uploadResult.id);
}
```

### Google Drive'dan Geri Yükleme

```javascript
// Mevcut yedekleri ara
const backups = await uyapApi.searchGoogleDriveBackups('12345678');

if (backups.length === 0) {
  console.log('Yedek bulunamadı');
} else {
  console.log(`${backups.length} yedek bulundu`);
  
  // En son yedeği indir
  const latestBackup = backups[0]; // Zaten tarihe göre sıralı
  console.log('İndiriliyor:', latestBackup.name);
  console.log('Oluşturma tarihi:', latestBackup.createdTime);
  
  const restoredData = await uyapApi.downloadFromGoogleDrive(latestBackup.id);
  
  if (restoredData.error) {
    console.error('İndirme hatası:', restoredData.error);
  } else {
    console.log('Veri geri yüklendi');
    console.log('Dosya sayısı:', restoredData.dosyalar?.length);
    console.log('Evrak sayısı:', restoredData.evraklar?.length);
  }
}
```

### Eski Yedekleri Temizleme

```javascript
// 30 günden eski yedekleri sil
const backups = await uyapApi.searchGoogleDriveBackups('12345678');
const thirtyDaysAgo = new Date();
thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

for (const backup of backups) {
  const backupDate = new Date(backup.createdTime);
  
  if (backupDate < thirtyDaysAgo) {
    console.log('Siliniyor:', backup.name);
    await uyapApi.deleteFromGoogleDrive(backup.id);
  }
}
```

## Diğer Özellikler

### Not Yönetimi

```javascript
// Not kaydet
await uyapApi.saveNote(
  dosyaId,
  'Bu dosyada eksik belgeler var, tamamlanmalı',
  'dosya'
);

// Notları al
const notlar = await uyapApi.getNotes(dosyaId, 'dosya', 10);
notlar.forEach(not => {
  console.log(`${not.created_tarihi}: ${not.alinan_not}`);
});

// Not sil
await uyapApi.deleteNote(notlar[0].notlar_id);
```

### Mali İşlemler (Tahsilat)

```javascript
// Dosya tahsilat bilgileri
const tahsilat = await uyapApi.getTahsilatBilgileri(dosyaId, 1);

console.log('Toplam Tahsilat:', tahsilat.toplamTahsilat, 'TL');
console.log('Toplam Reddiyat:', tahsilat.toplamReddiyat, 'TL');
console.log('Kalan:', tahsilat.toplamKalan, 'TL');
console.log('Harç Tahsilat:', tahsilat.toplamTahsilHarci, 'TL');

// Detaylı harç listesi
tahsilat.harcList.forEach(harc => {
  console.log(`${harc.tahsilatTarihi}: ${harc.miktar} TL - ${harc.tahsilatTuru}`);
});
```

### Safahat (Duruşma) Sorgulama

```javascript
// Son 2 haftalık safahatları sorgula
const baslangic = new Date();
baslangic.setDate(baslangic.getDate() - 14);
const bitis = new Date();

const safahat = await uyapApi.querySafahat(
  '0991', // Adli Yargı
  'birimId123',
  baslangic,
  bitis
);

console.log(`${safahat.length} safahat kaydı bulundu`);

safahat.forEach(s => {
  console.log(`${s.dosyaNo} - ${s.safahatTuru} - ${s.safahatTarihi}`);
});

// Tüm birimler için sorgula (uzun işlem)
const tumSafahat = await uyapApi.queryAllSafahat(
  '0991',
  baslangic,
  bitis
);

console.log(`Toplam ${tumSafahat.length} safahat kaydı`);
```

### Badge Yönetimi

```javascript
// Badge sayılarını güncelle
await uyapApi.updateBadges({
  dosyalar: 5,
  evraklar: 12,
  tebligatlar: 3,
  notlarim: 8
});

// Güncel badge sayıları
const badges = uyapApi.getBadges();
console.log('Badges:', badges);

// Badge değişikliklerini dinle
window.addEventListener('uyap-badges-updated', (event) => {
  const badges = event.detail;
  
  // UI'yi güncelle
  document.getElementById('badge-dosyalar').textContent = badges.dosyalar;
  document.getElementById('badge-evraklar').textContent = badges.evraklar;
  document.getElementById('badge-tebligatlar').textContent = badges.tebligatlar;
});

// Tüm badge'leri sıfırla
uyapApi.resetBadges();
```

## Hata Yönetimi

### Basit Hata Kontrolü

```javascript
const result = await uyapApi.getParties(dosyaId);

if (result.error) {
  console.error('İşlem başarısız:', result.error);
  
  // Hata detayları varsa
  if (result.details) {
    console.error('Detaylar:', result.details);
  }
} else {
  console.log('İşlem başarılı:', result);
}
```

### Retry ile Çalıştırma

```javascript
// Otomatik retry ile işlem
const result = await uyapApi.executeWithRetry(
  async () => {
    return await uyapApi.getParties(dosyaId);
  },
  { dosyaId: dosyaId },
  3 // Maksimum 3 deneme
);

if (result.error) {
  console.error('3 denemeden sonra başarısız:', result.error);
} else {
  console.log('Başarılı:', result);
}
```

### Hata Kodlarını Kullanma

```javascript
const errorCodes = uyapApi.getErrorCodes();

// Oturum kontrolü
if (result.error && result.error.includes('401')) {
  console.error(errorCodes.OTURUM_KAPALI.message);
  // Kullanıcıyı login sayfasına yönlendir
}

// Dosya bulunamadı
if (result.error && result.error.includes('404')) {
  console.error(errorCodes.DOSYA_BULUNAMADI.message);
  // Alternatif arama yap
}
```

### Manuel Hata İşleme

```javascript
let retryCount = 0;
const maxRetries = 3;

while (retryCount < maxRetries) {
  const result = await uyapApi.getParties(dosyaId);
  
  if (result.error) {
    const errorHandler = await uyapApi.handleError(
      result.error,
      { dosyaId: dosyaId },
      retryCount,
      maxRetries
    );
    
    if (errorHandler.shouldRetry) {
      retryCount = errorHandler.retryCount;
      console.log(`Tekrar deneniyor (${retryCount}/${maxRetries})...`);
      continue;
    } else {
      console.error('İşlem başarısız, retry yapılamadı');
      break;
    }
  } else {
    console.log('İşlem başarılı:', result);
    break;
  }
}
```

## İleri Seviye Senaryolar

### Toplu Dosya İşleme

```javascript
// Birden fazla dosyayı paralel işle
async function processDosyalarInBatches(dosyaIds, batchSize = 5) {
  const results = [];
  
  for (let i = 0; i < dosyaIds.length; i += batchSize) {
    const batch = dosyaIds.slice(i, i + batchSize);
    console.log(`Batch ${Math.floor(i/batchSize) + 1} işleniyor...`);
    
    const batchPromises = batch.map(async (dosyaId) => {
      return await uyapApi.executeWithRetry(
        async () => await uyapApi.getDosyaDetails(dosyaId),
        { dosyaId },
        3
      );
    });
    
    const batchResults = await Promise.allSettled(batchPromises);
    results.push(...batchResults);
    
    // API'yi yormamak için kısa bekle
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  return results;
}

// Kullanım
const dosyaIds = [ /* 100 dosya ID */ ];
const results = await processDosyalarInBatches(dosyaIds, 5);

const successCount = results.filter(r => r.status === 'fulfilled').length;
console.log(`${successCount}/${results.length} dosya başarılı`);
```

### Otomatik Yedekleme Sistemi

```javascript
// Her gün otomatik yedekleme
async function autoBackup(avukatId) {
  console.log('Otomatik yedekleme başlatılıyor...');
  
  // Tüm verileri topla
  const allData = {
    dosyalar: await collectAllDosyalar(),
    evraklar: await collectAllEvraklar(),
    notlar: await collectAllNotlar(),
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
    console.error('Yedekleme başarısız:', result.error);
    // Hata bildir
  } else {
    console.log('Yedekleme başarılı:', result.id);
    
    // Eski yedekleri temizle (30+ günlük)
    await cleanOldBackups(avukatId, 30);
  }
}

// Her gün çalıştır
setInterval(() => autoBackup('12345678'), 24 * 60 * 60 * 1000);
```

### Akıllı Tebligat Takibi

```javascript
// Düzenli tebligat kontrolü
async function smartTebligatCheck() {
  console.log('Tebligat kontrolü başlatılıyor...');
  
  // Bekleyen tebligatları al (veritabanından)
  const bekleyenTebligatlar = await getBekleyenTebligatlarFromDB();
  
  // PTT kontrolü yap
  const results = await uyapApi.checkTebligatStatus(bekleyenTebligatlar);
  
  // Sonuçları işle
  for (const result of results) {
    if (result.isLastState === 2) {
      // Teslim edildi
      console.log(`✅ Tebligat teslim edildi: ${result.barkodNo}`);
      
      // Desktop bildirim gönder
      new Notification('Tebligat Teslim Edildi', {
        body: `${result.muhatap} - ${result.icerik}`,
        icon: 'tebligat-icon.png'
      });
      
      // Google Tasks'a ekle
      await uyapApi.createGoogleTask(
        `Tebligat Yanıtı - ${result.dosyaNo}`,
        `${result.muhatap} tebligatı ${result.lastStateTarihi} tarihinde teslim edildi.\nYanıt süresi takip edilmeli.`,
        new Date(result.lastStateTarihi).setDate(new Date(result.lastStateTarihi).getDate() + 7)
      );
    } else if (result.isLastState === 1) {
      // Teslim edilemedi
      console.warn(`⚠️ Tebligat teslim edilemedi: ${result.barkodNo}`);
      
      // Bildirim gönder
      new Notification('Tebligat Teslim Edilemedi', {
        body: `${result.muhatap} - ${result.durum}`,
        icon: 'warning-icon.png'
      });
    }
  }
  
  // Badge'i güncelle
  const bekleyenSayisi = results.filter(r => r.isLastState === 0).length;
  await uyapApi.updateBadges({ tebligatlar: bekleyenSayisi });
}

// Her 2 saatte bir kontrol et
setInterval(smartTebligatCheck, 2 * 60 * 60 * 1000);
```

## Performans İpuçları

1. **Toplu İşlemler**: Birden fazla dosyayı paralel olarak işlerken batch kullanın
2. **Queue Yönetimi**: Aynı dosya için birden fazla istek göndermekten kaçının
3. **Cache**: Session bilgilerini cache'leyin, her istekte yenilemyin
4. **Retry Stratejisi**: Kritik olmayan işlemler için retry sayısını azaltın
5. **Progress Callback**: Uzun işlemler için progress callback kullanın

```javascript
// Örnek: Optimized batch processing
async function optimizedBatchProcess(items, processor, batchSize = 10) {
  const results = [];
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(item => processor(item).catch(e => ({ error: e.message })))
    );
    results.push(...batchResults);
    
    // Rate limiting
    if (i + batchSize < items.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  return results;
}
```

## Kaynaklar

- [UYAP Ana Sayfa](https://uyap.gov.tr)
- [Google Tasks API](https://developers.google.com/tasks)
- [Google Drive API](https://developers.google.com/drive)

## Notlar

- Tüm örnekler test amaçlıdır
- Gerçek kullanımda hata kontrolü yapılmalıdır
- Session süreleri UYAP tarafından belirlenir
- Rate limiting'e dikkat edilmelidir
