// GENERATED FROM tools/typescript-stage1/nico-src/SceneSearchPreferenceConnection.ts
//===BEGIN===
/** Owns saved-settings listeners and their serialized, read-only Config refreshes. */
class SceneSearchPreferenceConnection {
    constructor({ window, config, keys, isDisposed = () => false, onApplying = () => { }, onRefresh = () => { }, onError = () => { } }) {
        this.window = window;
        this.config = config;
        this.keys = keys.slice();
        this.isDisposed = isDisposed;
        this.onApplying = onApplying;
        this.onRefresh = onRefresh;
        this.onError = onError;
        this._disposed = false;
        this._connected = false;
        this._listeners = [];
        this._queue = Promise.resolve();
        this._allowed = new Set(this.keys);
    }
    static validSavedPreference(key, value) {
        if (key === 'sceneSearch.presentation.normal' || key === 'sceneSearch.presentation.fullscreen')
            return ['follow', 'fixed', 'legacy'].includes(value);
        if (key === 'sceneSearch.enabled' || key === 'sceneSearch.miniCommentVisible' || key === 'sceneSearch.commentListVisible')
            return typeof value === 'boolean';
        if (key === 'sceneSearch.commentListScale')
            return Number.isInteger(value) && value >= 100 && value <= 200;
        if (key === 'sceneSearch.thumbnailScale')
            return Number.isInteger(value) && value >= 50 && value <= 200;
        if (key === 'sceneSearch.commentListBackgroundOpacity')
            return Number.isInteger(value) && value >= 0 && value <= 100;
        if (key === 'sceneSearch.layout.normal' || key === 'sceneSearch.layout.fullscreen') {
            return typeof value === 'string' && /^(00|0[1-9]|10)$/.test(value);
        }
        if (key === 'sceneSearch.miniCommentMode') {
            return ['flow', 'static', 'hidden'].includes(value);
        }
        if (key === 'enableCommentPreview' || key === 'sceneSearch.layout.linkFullscreen' ||
            key === 'sceneSearch.commentPreviewVisible') {
            return typeof value === 'boolean';
        }
        if (key === 'sceneSearch.seekStepSeconds') {
            return Number.isSafeInteger(value) && value >= 0 && value <= 600;
        }
        if (key === 'sceneSearch.idleHideSeconds') {
            return typeof value === 'number' && Number.isFinite(value) && value >= 0 &&
                value <= 30 && Number.isInteger(value * 2);
        }
        if (key === 'sceneSearch.controlsReveal')
            return ['hover-focus', 'click', 'always'].includes(value);
        if (key === 'sceneSearch.animation')
            return ['off', 'subtle', 'full'].includes(value);
        return false;
    }
    _inactive() {
        return this._disposed || this.isDisposed();
    }
    connect() {
        if (this._inactive() || this._connected)
            return;
        const win = this.window, config = this.config;
        if (!win?.addEventListener || !config.storage ||
            typeof config.getStorageKey !== 'function' || typeof config.refresh !== 'function')
            return;
        const storageKeys = new Map(this.keys.map(key => [config.getStorageKey(key), key]));
        const onSaved = (event) => this._enqueue(event.detail?.keys);
        const onStorage = (event) => {
            if (event.storageArea && event.storageArea !== config.storage)
                return;
            if (event.key === null) {
                this._enqueue(this.keys);
                return;
            }
            const key = storageKeys.get(event.key);
            if (key)
                this._enqueue([key]);
        };
        this._connected = true;
        try {
            for (const [name, listener] of [
                ['ZenzaWatch-advanced-settings-saved', onSaved], ['storage', onStorage]
            ]) {
                // A listener registration wrapper may synchronously dispose this connection.
                if (this._inactive())
                    break;
                // A wrapper can install the listener and then throw. Retain it first.
                this._listeners.push([name, listener]);
                win.addEventListener(name, listener);
                if (this._inactive()) {
                    // A wrapper may dispose first, then install this very listener.
                    // Retry removal after addEventListener returns, retaining failed removals.
                    if (!this._listeners.some(([registeredName, registeredListener]) => registeredName === name && registeredListener === listener)) {
                        this._listeners.push([name, listener]);
                    }
                    this.dispose();
                    break;
                }
            }
        }
        catch (error) {
            // Preserve the registration error while retaining failed removals for retry.
            try {
                this.dispose();
            }
            catch (_) { }
            throw error;
        }
    }
    _enqueue(requested) {
        if (this._inactive() || !Array.isArray(requested))
            return;
        const selected = [...new Set(requested.filter(key => this._allowed.has(key)))];
        if (!selected.length)
            return;
        // Read when this batch reaches the queue, so a later save cannot be overtaken.
        this._queue = this._queue.then(() => this._sync(selected)).catch(error => {
            if (this._inactive())
                return;
            try {
                this.onError(error);
            }
            catch (_) {
                // Reporting is best-effort: a throwing observer must not poison the
                // serialized queue and prevent every subsequent saved update.
            }
        });
    }
    async _sync(requested) {
        if (this._inactive())
            return;
        const config = this.config;
        const changes = [], saved = {}, before = {}; // DataStorage.refresh requires hasOwnProperty.
        // Validate the entire storage snapshot before any in-memory Config mutation.
        // Events supply keys only; their values are never trusted.
        for (const key of requested) {
            const sk = config.getStorageKey(key), raw = config.storage[sk];
            const value = raw === undefined || raw === null ? config.default?.[key] : JSON.parse(raw);
            if (!SceneSearchPreferenceConnection.validSavedPreference(key, value) ||
                (config.options?.validateImport && !config.options.validateImport(key, value))) {
                throw new TypeError('Invalid saved scene preference: ' + key);
            }
            // Saved presence participates in migration even when the raw default is unchanged.
            const presenceSensitive = typeof config.resolveSceneSearch === 'function' && [
                'sceneSearch.enabled', 'sceneSearch.presentation.normal', 'sceneSearch.presentation.fullscreen',
                'sceneSearch.miniCommentVisible'
            ].includes(key);
            if (Object.is(value, config.getValue(key)) && !presenceSensitive)
                continue;
            saved[sk] = JSON.stringify(value);
            before[sk] = JSON.stringify(config.getValue(key));
            changes.push([key, value]);
        }
        if (this._inactive() || !changes.length)
            return;
        const loaded = [];
        try {
            for (const [key] of changes) {
                if (this._inactive())
                    return;
                loaded.push(key);
                await config.refresh(key, saved); // Read-only: no setValue/localStorage echo.
            }
        }
        catch (error) {
            // A custom storage adapter must not leave a half-applied failing batch.
            for (const key of loaded) {
                try {
                    await config.refresh(key, before);
                }
                catch (_) { }
            }
            throw error;
        }
        if (this._inactive())
            return;
        try {
            this.onApplying(true);
            if (this._inactive())
                return;
            config.emit?.('change', new Map(changes));
            for (const [key, value] of changes) {
                if (this._inactive())
                    return;
                config.emit?.('update', key, value);
                if (this._inactive())
                    return;
                config.emit?.('update-' + key, value);
            }
        }
        finally {
            this.onApplying(false);
        }
        if (!this._inactive())
            this.onRefresh(changes.map(([key]) => key));
    }
    dispose() {
        // In-flight awaits cannot be cancelled, but they must not emit or start more work.
        this._disposed = true;
        this._connected = false;
        const pending = [];
        let firstError;
        for (const [name, listener] of this._listeners) {
            try {
                this.window.removeEventListener(name, listener);
            }
            catch (error) {
                pending.push([name, listener]);
                if (!firstError)
                    firstError = error;
            }
        }
        this._listeners = pending;
        if (firstError)
            throw firstError;
    }
}
//===END===
export {SceneSearchPreferenceConnection};
