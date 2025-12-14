// 1. Tek dosya indirme
const downloader = new UYAPDownloader();

await downloader.downloadFile({
    id: 'evrak_12345',
    name: 'Dilekçe_2024.pdf',
    type: 'evrak',
    extension: 'pdf',
    dosyaId: 'dosya_67890',
    birimId: '0992'
});

// 2. Dosya kartlarına otomatik indirme butonu ekle
document.querySelectorAll('.file-card').forEach(card => {
    const fileData = {
        id: card.dataset.evrakId,
        name: card.querySelector('.file-name').textContent,
        type: 'evrak',
        dosyaId: card.dataset.dosyaId
    };
    
    downloader.addDownloadButtonToCard(card, fileData);
});

// 3. Toplu indirme (seçili dosyalar)
// Otomatik olarak sağ altta buton çıkacak