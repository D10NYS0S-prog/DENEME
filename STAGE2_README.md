# UYAP Desktop - Aşama 2 (Stage 2) Dokümantasyonu

## 🎯 Genel Bakış

Aşama 2, UYAP Desktop uygulamasının kullanıcı arayüzünü (UI) tamamen yeniden tasarlayan ve Stage 1'de entegre edilen tüm API özelliklerini kullanıcıya sunan fazıdır.

## ✨ Yeni Özellikler

### 1. Modern Tabbed Interface (Sekmeli Arayüz)

Yan çubuk artık 4 sekmeye ayrılmış:

- **📁 Dosyalar**: Dosya listeleme, arama, sorgulama
- **📝 Notlar**: Not yönetimi (CRUD işlemleri)
- **☁️ Google**: Google Drive ve Tasks entegrasyonu
- **⚖️ Özel Mahkemeler**: Yargıtay, Danıştay, CBS erişimi

### 2. Badge (Rozet) Sistemi

Header'da gerçek zamanlı bildirimler:
- 📁 Yeni Dosyalar
- 📄 Yeni Evraklar
- 📮 Bekleyen Tebligatlar
- 📝 Notlarım

### 3. Session İzleme

Header'da UYAP bağlantı durumu göstergesi:
- 🟢 Yeşil nokta: Bağlı
- 🟡 Sarı nokta: Bağlanıyor
- 🔴 Kırmızı: Bağlantı hatası

### 4. Dosya Detay Modalı

Her dosya için 5 sekmeli detay ekranı:
- **👥 Taraflar**: Davacı, davalı, vekiller
- **📄 Evraklar**: Tüm evraklar (gelen/giden/diğer)
- **💰 Mali İşlemler**: Tahsilat, reddiyat bilgileri
- **📝 Notlar**: Dosyaya özel notlar
- **📮 Tebligatlar**: Tebligat kontrolü

### 5. Not Yönetimi

Kapsamlı not sistemi:
- Genel notlar
- Dosya notları
- Evrak notları
- Google Tasks'a otomatik aktarım
- Filtreleme ve arama

### 6. Google Entegrasyonu UI

Tam özellikli Google arayüzü:
- **Google Drive Yedekleme**:
  - Tek tıkla yedekleme
  - Yedek geçmişini görüntüleme
  - Geri yükleme
  - Otomatik yedekleme ayarı
  
- **Google Tasks**:
  - Görev listesini görüntüleme
  - Notları Tasks'a senkronizasyon
  - Duruşma hatırlatıcıları

### 7. Ayarlar Paneli

Yapılandırılabilir ayarlar:
- Bildirim tercihleri
- Otomatik senkronizasyon
- Otomatik yedekleme
- Yedek saklama süresi
- Veritabanı yönetimi

### 8. Toast Bildirimleri

Kullanıcı dostu bildirim sistemi:
- Başarı mesajları (yeşil)
- Hata mesajları (kırmızı)
- Uyarılar (sarı)
- Bilgilendirme (mavi)

## 🗂️ Dosya Yapısı

```
/
├── index.html                    # Stage 2 UI (aktif)
├── index-stage2.html             # Yedek Stage 2 dosyası
├── index.html.backup_original    # Orijinal backup
├── index.html.backup_stage1      # Stage 1 backup
├── styles-stage2.css             # Stage 2 stilleri
├── app-stage2.js                 # Stage 2 ana mantık
├── uyap-api.js                   # Güncellenmiş API (getAllNotes, getGoogleTasks eklendi)
├── electron.js                   # Güncellenmiş (note IPC handlers eklendi)
└── db.js                         # Veritabanı (değişiklik yok)
```

## 🎨 Tasarım

### Renk Paleti

```css
--primary-color: #667eea      /* Mor-mavi (ana butonlar) */
--secondary-color: #764ba2    /* Koyu mor (gradient) */
--success-color: #28a745      /* Yeşil (başarı) */
--danger-color: #dc3545       /* Kırmızı (hata) */
--warning-color: #ffc107      /* Sarı (uyarı) */
--info-color: #17a2b8         /* Turkuaz (bilgi) */
```

### UI Prensipleri

- **Material Design** ilhamı
- **Responsive** tasarım
- **Accessibility** (erişilebilirlik) odaklı
- **Minimal** ve temiz görünüm
- **Tutarlı** ikonografi

## 🔧 Teknik Detaylar

### Yeni Eklenen Metodlar

**uyap-api.js:**
```javascript
async getAllNotes()        // Tüm notları getir
async getGoogleTasks()     // Google Tasks'ı getir
```

**electron.js IPC Handlers:**
```javascript
'get-all-notes'            // Tüm notları getir
'save-note'                // Not kaydet
'get-notes'                // Filtrelenmiş notları getir
'delete-note'              // Not sil
'google-authorize'         // Google OAuth başlat
```

### Bileşen Mimarisi

```
app-stage2.js
├── Initialization
│   ├── Tabs System
│   ├── Session Monitor
│   ├── Badge System
│   ├── Event Listeners
│   └── Database Init
│
├── File Operations
│   ├── File List Rendering
│   ├── Search & Filter
│   ├── Bulk Query
│   └── Safahat Query
│
├── Modal Management
│   ├── File Details Modal
│   ├── Documents Modal
│   ├── Note Dialog
│   └── Settings Modal
│
├── Notes Management
│   ├── Load Notes
│   ├── Save Note
│   ├── Delete Note
│   └── Filter Notes
│
├── Google Integration
│   ├── Auth Check
│   ├── Tasks Management
│   ├── Backup Operations
│   └── Restore Operations
│
└── Utilities
    ├── Toast Notifications
    ├── Modal Controls
    └── Event Handlers
```

## 📊 Durum

### ✅ Tamamlanan

- [x] Modern tabbed interface
- [x] Badge notification system
- [x] Session monitoring
- [x] File detail modal (5 tabs)
- [x] Note management (CRUD)
- [x] Google Tasks UI
- [x] Google Drive backup UI
- [x] Settings panel
- [x] Toast notifications
- [x] Responsive styling
- [x] Database integration
- [x] IPC handlers

### 🚧 Devam Eden

- [ ] Yargıtay modülü implementasyonu
- [ ] Danıştay modülü implementasyonu
- [ ] CBS modülü implementasyonu
- [ ] Tebligat kontrolü implementasyonu
- [ ] Help tooltips
- [ ] Google OAuth akışı

### 📝 İyileştirmeler

- [ ] Keyboard shortcuts
- [ ] Drag & drop file upload
- [ ] Dark mode
- [ ] Export to PDF/Excel
- [ ] Advanced search filters
- [ ] File tagging system

## 🚀 Kullanım

### Başlatma

```bash
npm start
```

### Dosya Arama

1. **Dosyalar** sekmesine git
2. Arama kutusuna dosya numarası gir
3. **Ara** butonuna tıkla

### Not Ekleme

1. **Notlar** sekmesine git
2. **+ Yeni Not** butonuna tıkla
3. Not türünü seç (Genel/Dosya/Evrak)
4. Not içeriğini yaz
5. İsteğe bağlı: "Google Tasks'a da ekle" işaretle
6. **Kaydet** butonuna tıkla

### Yedekleme

1. **Google** sekmesine git
2. İlk kullanımda "Google'a Bağlan" butonuna tıkla
3. **Şimdi Yedekle** butonuna tıkla
4. Yedekleme tamamlanınca bildirim gelir

### Dosya Detayları

1. Bir dosya kartına tıkla
2. Detay modalı açılır
3. İstediğin sekmeye tıkla (Taraflar/Evraklar/Mali/Notlar/Tebligat)
4. İlgili bilgileri görüntüle

## 🐛 Bilinen Sorunlar

- Google OAuth henüz implement edilmemiş (alert gösterir)
- Özel mahkeme modülleri (Yargıtay, Danıştay, CBS) UI'da ama backend implement edilmemiş
- Tebligat kontrolü fonksiyonu placeholder

## 🔒 Güvenlik

Stage 2'de yapılan güvenlik iyileştirmeleri:
- Input validation tüm formlarda
- XSS koruması (template literal sanitization)
- CSRF token desteği (API seviyesinde)
- Güvenli IPC iletişimi

## 📞 Destek

Sorularınız için:
- GitHub Issues
- Pull Request
- Email: (projedeki email adresi)

## 📄 Lisans

MIT License - Stage 1 ile aynı

---

**Son Güncelleme**: 14 Aralık 2024  
**Versiyon**: 2.0.0  
**Durum**: Beta (Test aşamasında)
