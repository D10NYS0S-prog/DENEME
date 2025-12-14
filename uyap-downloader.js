/**
 * UYAP Downloader Utility
 * Manages file downloads, UI buttons, and bulk operations.
 */
class UYAPDownloader {
    constructor(api) {
        if (!api || typeof api.downloadDocument !== 'function') {
            throw new Error('Valid UYAPApi instance with downloadDocument method required');
        }
        this.api = api;
        this.queue = [];
        this.isProcessing = false;

        // Ensure floating UI exists when DOM is ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.createFloatingUI());
        } else {
            this.createFloatingUI();
        }
    }

    /**
     * Add item to download queue
     */
    addToQueue(metadata) {
        this.queue.push(metadata);
        if (!this.isProcessing) {
            this.processQueue();
        }
    }

    /**
     * Process the download queue sequentially
     */
    async processQueue() {
        if (this.isProcessing || this.queue.length === 0) return;

        this.isProcessing = true;

        while (this.queue.length > 0) {
            const item = this.queue.shift();
            try {
                await this.downloadFile(item);
            } catch (e) {
                console.error('Queue item failed:', item.name, e);
                // Continue to next item even if one fails
            }
            // Small delay between downloads to be polite
            await new Promise(r => setTimeout(r, 1000));
        }

        this.isProcessing = false;
        this.showToast('✅ Kuyruk tamamlandı', 'success');
    }

    /**
     * Download a single file
     * @param {Object} metadata - { id, name, type, extension, dosyaId }
     */
    async downloadFile(metadata) {
        // Normalize input for API
        const doc = {
            evrakId: metadata.id || metadata.evrakId,
            id: metadata.id || metadata.evrakId,
            dosyaId: metadata.dosyaId,
            ...metadata
        };

        const toastId = this.showToast(`⏳ İndiriliyor: ${metadata.name}`, 'info');

        try {
            const result = await this.api.downloadDocument(doc);

            if (result && result.base64) {
                this.saveToDisk(result.base64, result.filename || metadata.name, result.mime);
                this.updateToast(toastId, `✅ İndirildi: ${metadata.name}`, 'success');
                return true;
            } else {
                throw new Error(result ? result.error : 'Veri boş döndü');
            }
        } catch (e) {
            console.error('Download error:', e);
            this.updateToast(toastId, `❌ Hata: ${metadata.name}`, 'error');
            throw e; // Re-throw for queue handler
        }
    }

    /**
     * Save Base64 to Disk (via Browser Download)
     */
    saveToDisk(base64, filename, mimeType) {
        const mime = mimeType || 'application/octet-stream';
        const link = document.createElement('a');
        link.href = `data:${mime};base64,${base64}`;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    /**
     * Add a download button to a DOM element (Card/Row)
     */
    addDownloadButtonToCard(container, fileData) {
        // Safety checks
        if (!container || !container.isConnected) {
            console.warn('Container not ready or not in DOM');
            return;
        }

        // Check if button already exists
        if (container.querySelector('.btn-quick-dl')) return;

        const btn = document.createElement('button');
        btn.innerHTML = '📥'; // Icon
        btn.className = 'btn-quick-dl btn-party'; // Reuse existing classes for style
        btn.title = 'Hızlı İndir';
        btn.style.cssText = `
            background: #17a2b8; 
            margin-left: 5px; 
            padding: 2px 8px; 
            min-width: auto;
        `;

        btn.onclick = (e) => {
            e.stopPropagation(); // Prevent card expansion
            // Direct download or Add to Queue? Let's use Queue for safety
            this.addToQueue(fileData);
        };

        // Append to suitable location
        // Try to find actions container, else append to container itself
        const actionArea = container.querySelector('.actions') ||
            container.querySelector('.file-number') || // Next to title?
            container;

        if (actionArea === container.querySelector('.file-number')) {
            // If appending to title, make sure it flows right
            const wrapper = document.createElement('span');
            wrapper.appendChild(btn);
            actionArea.appendChild(wrapper);
        } else {
            actionArea.appendChild(btn);
        }
    }

    /**
     * Create Floating Queue/Status UI
     */
    createFloatingUI() {
        if (document.getElementById('uyap-downloader-ui')) return;

        const div = document.createElement('div');
        div.id = 'uyap-downloader-ui';
        div.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            width: 300px;
            z-index: 9999;
            display: flex;
            flex-direction: column;
            gap: 10px;
            pointer-events: none; /* Let clicks pass through empty areas */
        `;
        document.body.appendChild(div);
    }

    showToast(msg, type = 'info') {
        const ui = document.getElementById('uyap-downloader-ui');
        if (!ui) return; // Should exist, but safety first

        const toast = document.createElement('div');
        // Safe Unique ID
        const id = 'toast-' + performance.now().toString().replace('.', '-') + '-' + Math.random().toString(36).substr(2, 9);

        let bg = '#333';
        if (type === 'success') bg = '#28a745';
        if (type === 'error') bg = '#dc3545';

        toast.id = id;
        toast.style.cssText = `
            background: ${bg};
            color: white;
            padding: 12px;
            border-radius: 4px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
            font-size: 13px;
            opacity: 0;
            transform: translateY(20px);
            transition: all 0.3s ease;
            pointer-events: auto;
        `;
        toast.textContent = msg;

        ui.appendChild(toast);

        // Animation
        requestAnimationFrame(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateY(0)';
        });

        // Auto remove success messages quickly, errors stay longer
        const duration = type === 'error' ? 5000 : 3000;
        setTimeout(() => {
            if (toast.parentNode) this.removeToast(id);
        }, duration);

        return id;
    }

    updateToast(id, msg, type) {
        const toast = document.getElementById(id);
        if (!toast) return;

        let bg = '#333';
        if (type === 'success') bg = '#28a745';
        if (type === 'error') bg = '#dc3545';

        toast.style.background = bg;
        toast.textContent = msg;
    }

    removeToast(id) {
        const toast = document.getElementById(id);
        if (!toast) return;

        toast.style.opacity = '0';
        toast.style.transform = 'translateY(20px)';
        setTimeout(() => toast.remove(), 300);
    }
}

// Global Export
if (typeof module !== 'undefined') {
    module.exports = UYAPDownloader;
} else {
    window.UYAPDownloader = UYAPDownloader;
}
