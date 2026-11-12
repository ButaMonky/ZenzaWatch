//===BEGIN===
class AdvancedSettingsController {
    options;
    panel;
    pending;
    disposed = false;
    entry;
    entryHost;
    entryAnchor;
    entryBefore = false;
    entryObserver;
    relocateEntry = () => {
        const doc = this.options.document, host = this.entryHost;
        if (this.disposed || !host || !doc.body) {
            return;
        }
        host.hidden = !/^\/my(?:\/|$)/.test(doc.location.pathname);
        if (host.hidden) {
            return;
        }
        const anchor = this.entryAnchor;
        if (anchor?.isConnected && host.isConnected && host.parentElement === anchor.parentElement &&
            (this.entryBefore ? host.nextElementSibling === anchor : anchor.nextElementSibling === host)) {
            return;
        }
        // Use known profile controls first, matching the former standalone entry.
        // Never put our button inside a React-owned control or Zenza's own dialog.
        const find = (selector) => Array.from(doc.querySelectorAll(selector)).find(node => !node.closest('.zw-modern-root,.zenzaPlayerContainer,[data-zw-advanced-host]'));
        const account = find('.accountEdit');
        const dropdown = doc.querySelector('#js-initial-userpage-data') ? find('.Dropdown-button') : undefined;
        let target = account || dropdown;
        let before = !account;
        if (target) {
            const list = target.closest('ul,ol');
            if (list) {
                target = list;
                before = false;
            }
        }
        else {
            target = find('[aria-label="nicovideo-content"]') || find('main,[role="main"]');
            before = true;
        }
        this.entryAnchor = target;
        this.entryBefore = before;
        if (target?.parentElement) {
            target.parentElement.insertBefore(host, before ? target : target.nextSibling);
        }
        else if (host.parentElement !== doc.body) {
            doc.body.append(host);
        }
    };
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
        // The companion may have updated public preferences through userscript storage.
        for (const key of Object.keys(this.options.config.default || {}).filter(key => key.startsWith('externalLinks.'))) {
            await this.options.config.refresh?.(key);
        }
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
        if (this.disposed) {
            return;
        }
        if (this.entry) {
            this.relocateEntry();
            return;
        }
        const doc = this.options.document;
        if (!doc.body) {
            return;
        }
        const host = doc.createElement('div');
        host.dataset.zwAdvancedHost = 'true';
        const button = doc.createElement('button');
        button.type = 'button';
        button.dataset.zwAdvancedEntry = 'true';
        button.textContent = 'ZenzaWatch 上級者設定';
        const style = doc.createElement('style');
        style.textContent = `
      [data-zw-advanced-host]{position:static;display:flex;justify-content:flex-end;box-sizing:border-box;margin:8px 0;padding:0 12px}
      [data-zw-advanced-host][hidden]{display:none!important}
      button[data-zw-advanced-entry]{appearance:none;position:static;box-sizing:border-box;font:12px/1.5 system-ui,sans-serif;padding:8px 12px;border:1px solid #8294ae;border-radius:6px;background:#17212d;color:#f4f7ff;cursor:pointer;box-shadow:0 1px 3px #0003}
      button[data-zw-advanced-entry]:hover{background:#303c51;border-color:#a8bed8}
      button[data-zw-advanced-entry]:focus-visible{outline:2px solid #8ecbff;outline-offset:3px}
      @media(forced-colors:active){button[data-zw-advanced-entry]{background:ButtonFace;color:ButtonText;border-color:ButtonText}}
    `;
        button.addEventListener('click', this.requestOpen);
        host.append(button, style);
        this.entry = button;
        this.entryHost = host;
        this.relocateEntry();
        const Observer = doc.defaultView?.MutationObserver;
        if (Observer) {
            this.entryObserver = new Observer(this.relocateEntry);
            this.entryObserver.observe(doc.body, { childList: true, subtree: true });
        }
        doc.defaultView?.addEventListener('popstate', this.relocateEntry);
    }
    dispose() {
        if (this.disposed) {
            return;
        }
        this.disposed = true;
        this.options.document.removeEventListener('zenza-open-advanced-settings', this.requestOpen);
        this.entryObserver?.disconnect();
        this.entryObserver = undefined;
        this.options.document.defaultView?.removeEventListener('popstate', this.relocateEntry);
        this.entry?.removeEventListener('click', this.requestOpen);
        this.entryHost?.remove();
        this.entryHost = undefined;
        this.entryAnchor = undefined;
        this.entry = undefined;
        this.panel?.dispose();
        this.panel = undefined;
    }
}
//===END===
export { AdvancedSettingsController };
