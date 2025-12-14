const { contextBridge, ipcRenderer } = require('electron');

// Güvenli API'yi frontend'e expose et
contextBridge.exposeInMainWorld('electronAPI', {
    // UYAP işlemleri
    uyapLogin: (credentials) => ipcRenderer.invoke('uyap:login', credentials),
    getDosyaList: () => ipcRenderer.invoke('uyap:getDosyaList'),
    getEvrakList: (dosyaId) => ipcRenderer.invoke('uyap:getEvrakList', dosyaId),
    downloadEvrak: (evrakData) => ipcRenderer.invoke('uyap:downloadEvrak', evrakData),

    // Veritabanı işlemleri
    dbQuery: (query) => ipcRenderer.invoke('db:query', query),

    // Bildirimler
    onNotification: (callback) => ipcRenderer.on('notification', callback),

    // UYAP Veri Dinleyicisi
    onUyapData: (callback) => ipcRenderer.on('uyap-data-captured', (event, data) => callback(data))
});
