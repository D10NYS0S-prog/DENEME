# UYAP Desktop Uygulaması

UYAP Avukat Portalı için masaüstü otomasyon uygulaması.

## ✨ Özellikler

### 🔐 Temel Özellikler
- Otomatik UYAP girişi
- Session yönetimi ve otomatik yenileme
- Çoklu retry mantığı ile hata toleransı

### 📁 Dosya Yönetimi
- Dosya listeleme ve detaylı sorgulama
- Adli Yargı, İdari Yargı, Askeri Yargı desteği
- Yargıtay dosyaları entegrasyonu
- Danıştay dosyaları entegrasyonu
- CBS (Cumhuriyet Başsavcılığı) dosyaları
- Gelişmiş dosya arama
- Otomatik dosya senkronizasyonu
- Queue (kuyruk) yönetimi

### 📄 Evrak İşlemleri
- Tüm evrak türlerini listeleme (Gelen, Giden, Diğer)
- Sayfalama desteği ile büyük evrak listelerini yönetme
- Evrak kategorilendirme
- Evrak indirme (UDF desteği)
- PDF evrak ayrıştırma

### 📮 Tebligat Yönetimi
- Elektronik tebligat (eTebligat) kontrolü
- PTT gönderi takip sistemi entegrasyonu
- Otomatik tebligat durum kontrolü
- Barkod okuma ve PDF ayrıştırma
- Tebligat bildirimleri

### 💰 Mali İşlemler
- Tahsilat (ödeme) bilgileri
- Reddiyat takibi
- Harç tahsilat detayları
- Teminat bilgileri

### 📅 Safahat Sorgulama
- Tarih aralığına göre safahat sorgulama
- Tüm yargı birimleri için toplu sorgulama
- Otomatik dosya tespiti

### 📝 Not Yönetimi
- Dosya ve evrak notları
- Google Tasks entegrasyonu
- Not kategorilendirme
- Not arama ve filtreleme

### ☁️ Google Entegrasyonu
> **NOT:** Takvim özelliği hariç tutulmuştur (kullanıcı talebi)

- ✅ **Google Tasks** - Dosya ve evrak notlarını Tasks'a aktarma
- ✅ **Google Drive** - Otomatik veri yedekleme
  - AppDataFolder kullanımı
  - Şifrelenmiş yedekleme
  - Çoklu yedek yönetimi
  - Geri yükleme
- ❌ **Google Calendar** - Devre dışı (talebe göre)

### 🔔 Bildirim Sistemi
- Gerçek zamanlı badge bildirimleri
- Desktop bildirimleri
- Yeni dosya bildirimleri
- Yeni evrak bildirimleri
- Tebligat bildirimleri

## 📦 Kurulum

```bash
npm install
```

## 🚀 Çalıştırma

### Normal Mod
```bash
npm start
```

### Geliştirme Modu
```bash
npm run dev
```

## 📖 API Kullanımı

### Başlatma

```javascript
const uyapApi = new UYAPApi();

// Session otomatik olarak başlatılır
await uyapApi.initializeSession();
```

### Dosya İşlemleri

```javascript
// Dosya taraflarını alma
const parties = await uyapApi.getParties(dosyaId);

// Dosya detaylarını alma
const details = await uyapApi.getDosyaDetails(dosyaId);

// Tüm evrakları alma (sayfalama ile)
const evraklar = await uyapApi.getAllEvrak(dosyaId);
console.log(evraklar.gelen);  // Gelen evraklar
console.log(evraklar.giden);  // Giden evraklar
console.log(evraklar.diger);  // Diğer evraklar

// Dosya senkronizasyonu
const syncedData = await uyapApi.syncDosya(dosyaId);

// Dosya arama
const results = await uyapApi.searchByDosyaNo('2024/123', birimId);
```

### Tebligat İşlemleri

```javascript
// Tebligat kontrolü
const tebligatlar = [...]; // Tebligat listesi
const results = await uyapApi.checkTebligatStatus(tebligatlar);

// PDF'den tebligat bilgisi çıkarma
const pdfData = ...; // PDF binary data
const tebligatInfo = await uyapApi.parseTebligatPDF(pdfData);
```

### Yargıtay İşlemleri

```javascript
// Yargıtay dairelerini alma
const daireler = await uyapApi.getYargitayDaireleri();

// Yargıtay dosyalarını alma
const dosyalar = await uyapApi.getYargitayDosyalar(daireId);

// Yargıtay dosya detayı
const detay = await uyapApi.getYargitayDosyaDetay(dosyaId);
```

### Danıştay İşlemleri

```javascript
// Danıştay dairelerini alma
const daireler = await uyapApi.getDanistayDaireleri();

// Danıştay dosyalarını alma
const dosyalar = await uyapApi.getDanistayDosyalar(daireId);

// Danıştay dosya detayı
const detay = await uyapApi.getDanistayDosyaDetay(dosyaId);
```

### CBS İşlemleri

```javascript
// İlleri alma
const iller = await uyapApi.getIller();

// CBS birimlerini alma
const birimler = await uyapApi.getCbsBirimler(ilKodu);

// CBS dosyalarını alma
const dosyalar = await uyapApi.getCbsDosyalar(birimId);

// Tüm CBS dosyalarını senkronize etme (uzun işlem)
const allCbs = await uyapApi.syncAllCbsDosyalar((progress) => {
  console.log(`İl: ${progress.current}/${progress.total}`);
});
```

### Mali İşlemler

```javascript
// Tahsilat bilgileri
const tahsilat = await uyapApi.getTahsilatBilgileri(dosyaId);
console.log('Toplam Tahsilat:', tahsilat.toplamTahsilat);
console.log('Toplam Reddiyat:', tahsilat.toplamReddiyat);
console.log('Kalan:', tahsilat.toplamKalan);
```

### Safahat Sorgulama

```javascript
// Belirli bir birim için safahat sorgulama
const safahat = await uyapApi.querySafahat(
  yargiTuru,
  yargiBirimi,
  new Date('2024-01-01'),
  new Date('2024-12-31')
);

// Tüm birimler için safahat sorgulama
const allSafahat = await uyapApi.queryAllSafahat(
  yargiTuru,
  new Date('2024-01-01'),
  new Date('2024-12-31')
);
```

### Not Yönetimi

```javascript
// Not kaydetme
await uyapApi.saveNote(dosyaId, 'Bu bir nottur', 'dosya');

// Notları alma
const notlar = await uyapApi.getNotes(dosyaId, 'dosya', 10);

// Not silme
await uyapApi.deleteNote(noteId);
```

### Google Entegrasyonu

```javascript
// Google Tasks'a not ekleme
await uyapApi.createGoogleTask(
  'Duruşma Hazırlığı',
  'Tanık listesini hazırla',
  new Date('2024-12-20')
);

// Google Drive'a yedekleme
const backupData = { /* veriler */ };
await uyapApi.uploadToGoogleDrive(
  backupData,
  '12345678.json',
  'UYAP Yedeği - 20.12.2024'
);

// Google Drive'dan geri yükleme
const backups = await uyapApi.searchGoogleDriveBackups('12345678');
const restoredData = await uyapApi.downloadFromGoogleDrive(backups[0].id);

// Yedek silme
await uyapApi.deleteFromGoogleDrive(fileId);
```

### Badge (Rozet) Bildirimleri

```javascript
// Badge sayılarını güncelleme
await uyapApi.updateBadges({
  dosyalar: 5,
  evraklar: 12,
  tebligatlar: 3
});

// Badge sayılarını alma
const badges = uyapApi.getBadges();
console.log('Yeni dosyalar:', badges.dosyalar);

// Tüm badge'leri sıfırlama
uyapApi.resetBadges();

// Badge değişikliklerini dinleme
window.addEventListener('uyap-badges-updated', (event) => {
  console.log('Badge güncellendi:', event.detail);
});
```

### Hata Yönetimi

```javascript
// Retry mantığı ile çalıştırma
const result = await uyapApi.executeWithRetry(
  async () => await uyapApi.getParties(dosyaId),
  { dosyaId: dosyaId },
  3 // max retry sayısı
);

// Hata kodlarını alma
const errorCodes = uyapApi.getErrorCodes();
console.log(errorCodes.OTURUM_KAPALI);
```

## 🔧 Teknolojiler

- **Electron** - Desktop uygulama framework'ü
- **Puppeteer** - Web otomasyon
- **SQLite** - Yerel veritabanı
- **Node.js** - Backend runtime
- **Google APIs** - Tasks ve Drive entegrasyonu

## 📋 Özellik Karşılaştırması

| Özellik | imerek.js | uyap-api.js | Durum |
|---------|-----------|-------------|-------|
| Dosya Yönetimi | ✅ | ✅ | Entegre edildi |
| Evrak Listeleme | ✅ | ✅ | Entegre edildi |
| Taraf Bilgileri | ✅ | ✅ | Entegre edildi |
| Tebligat Kontrolü | ✅ | ✅ | Entegre edildi |
| PTT Entegrasyonu | ✅ | ✅ | Entegre edildi |
| Google Tasks | ✅ | ✅ | Entegre edildi |
| Google Drive | ✅ | ✅ | Entegre edildi |
| Google Calendar | ✅ | ❌ | **Talep üzerine hariç tutuldu** |
| Badge Sistem | ✅ | ✅ | Entegre edildi |
| Not Yönetimi | ✅ | ✅ | Entegre edildi |
| Tahsilat | ✅ | ✅ | Entegre edildi |
| Safahat | ✅ | ✅ | Entegre edildi |
| Yargıtay | ✅ | ✅ | Entegre edildi |
| Danıştay | ✅ | ✅ | Entegre edildi |
| CBS | ✅ | ✅ | Entegre edildi |
| Queue Yönetimi | ✅ | ✅ | Entegre edildi |
| Hata Yönetimi | ✅ | ✅ | Entegre edildi |
| Retry Mantığı | ✅ | ✅ | Entegre edildi |

## 🚨 Önemli Notlar

- **Takvim özelliği hariç tutulmuştur**: Kullanıcı talebi üzerine Google Calendar entegrasyonu uygulanmamıştır.
- **PTT entegrasyonu**: Tebligat kontrolü için PTT API'sine main process üzerinden erişim gereklidir.
- **PDF parsing**: Tebligat PDF ayrıştırma için ek kütüphane gerekebilir (pdf-parse önerilir).
- **Session yönetimi**: UYAP session'ları kısa ömürlüdür, otomatik yenileme aktiftir.
- **CBS senkronizasyonu**: Tüm illeri taramak uzun sürebilir (10-30 dakika).

## 📝 Lisans

MIT

## 👤 Yazar

Av. Ahmet Hakan UYSAL

## 🤝 Katkıda Bulunma

1. Fork edin
2. Feature branch oluşturun (`git checkout -b feature/AmazingFeature`)
3. Commit edin (`git commit -m 'Add some AmazingFeature'`)
4. Push edin (`git push origin feature/AmazingFeature`)
5. Pull Request açın

## 📞 Destek

Sorularınız için issue açabilirsiniz.

