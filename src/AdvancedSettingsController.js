//===BEGIN===
class AdvancedSettingsController {
    options;
    panel;
    pending;
    disposed = false;
    entry;
    requestOpen;
    constructor(options) {
        this.options = options;
        this.requestOpen = () => { this.open().catch(() => options.onError?.()); };
        options.document.addEventListener('zenza-open-advanced-settings', this.requestOpen);
    }
    async open() {
        if (this.disposed) {
            return;
        }
        if (!this.pending) {
            this.pending = (async () => {
                await this.options.config.promise('restore');
                if (!this.disposed && !this.panel) {
                    this.panel = this.options.createPanel(this.options.config);
                }
            })().catch(error => { this.pending = undefined; throw error; });
        }
        await this.pending;
        if (this.disposed) {
            return;
        }
        try {
            this.panel?.show();
        }
        catch (error) {
            this.panel?.dispose();
            this.panel = undefined;
            this.pending = undefined;
            throw error;
        }
    }
    close() { this.panel?.hide(); }
    mountEntry() {
        if (this.disposed || this.entry) {
            return;
        }
        const button = this.options.document.createElement('button');
        button.type = 'button';
        button.dataset.zwAdvancedEntry = 'true';
        button.textContent = 'ZenzaWatch 上級者設定';
        button.style.cssText = 'position:fixed;right:18px;bottom:18px;z-index:2147483000;padding:10px 14px;border:1px solid #64748b;border-radius:6px;background:#17212d;color:#eee;cursor:pointer';
        button.addEventListener('click', this.requestOpen);
        this.options.document.body.append(button);
        this.entry = button;
    }
    dispose() {
        if (this.disposed) {
            return;
        }
        this.disposed = true;
        this.options.document.removeEventListener('zenza-open-advanced-settings', this.requestOpen);
        this.entry?.removeEventListener('click', this.requestOpen);
        this.entry?.remove();
        this.entry = undefined;
        this.panel?.dispose();
        this.panel = undefined;
    }
}
//===END===
export { AdvancedSettingsController };
