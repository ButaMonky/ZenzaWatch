// GENERATED FROM tools/typescript-stage1/nico-src/SceneSearchLayoutResources.ts
//===BEGIN===
class SceneSearchLayoutResources {
    constructor(onError = () => { }) {
        this._onError = onError;
        this._pending = new Map();
    }
    get pendingCount() { return this._pending.size; }
    release(cleanup, key = 'scene-layout-cleanup') {
        const entry = this._pending.get(cleanup) || { cleanup, key, running: false };
        if (entry.running)
            return false;
        this._pending.set(cleanup, entry);
        entry.running = true;
        try {
            cleanup();
            this._pending.delete(cleanup);
            return true;
        }
        catch (error) {
            entry.error = error;
            // Error reporting is external code too. Keep failed cleanup for retry.
            try {
                this._onError(error, key);
            }
            catch (reportError) {
                entry.reportError = reportError;
            }
            return false;
        }
        finally {
            entry.running = false;
        }
    }
    retry(onlyKey) {
        for (const { cleanup, key } of [...this._pending.values()]) {
            if (onlyKey === undefined || key === onlyKey)
                this.release(cleanup, key);
        }
        return ![...this._pending.values()].some(entry => onlyKey === undefined || entry.key === onlyKey);
    }
}
//===END===
export {SceneSearchLayoutResources};
