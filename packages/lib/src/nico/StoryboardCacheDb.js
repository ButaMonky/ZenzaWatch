import {IndexedDbStorage} from '../infra/IndexedDbStorage';
import {NicoVideoApi} from './loader';
// GENERATED FROM tools/typescript-stage1/nico-src/StoryboardCacheDb.ts (Task642). Edit the .ts and run npm run nico:sync.
//===BEGIN===
/**
 * Canonical TypeScript source for packages/lib/src/nico/StoryboardCacheDb.js (Task642).
 * IndexedDB cache of storyboard (seek thumbnail) info keyed by watch/cache id.
 * On www.nicovideo.jp it opens IndexedDB directly; elsewhere it goes through the
 * NicoVideoApi IndexedDB bridge injected with `StoryboardCacheDb.api(...)`.
 * Only status:'ok' payloads are stored. Worker transactions enforce a shared
 * byte budget and idle retention, including legacy records and partial sheets.
 */
const StoryboardCacheDb = (() => {
    const WATCH_INFO = {
        name: 'storyboard',
        ver: 2,
        stores: [
            {
                name: 'cache',
                indexes: [
                    { name: 'updatedAt', keyPath: 'updatedAt', params: { unique: false } },
                ],
                definition: { keyPath: 'watchId', autoIncrement: false }
            }
        ]
    };
    let db, instance, NicoVideoApi;
    let dbOpening, instanceOpening;
    let generationFloor = 0;
    const captureGeneration = () => Math.max(Date.now(), generationFloor);
    const operation = async (data) => {
        const connection = await initWorker();
        return connection.cache.storyboardCache(data);
    };
    const configure = (policy) => operation({ op: 'configure', ...policy });
    const clear = async () => {
        generationFloor = Math.max(Date.now(), generationFloor) + 1;
        const result = await operation({ op: 'clear' });
        generationFloor = Math.max(generationFloor, result.clearedAt + 1);
        return result;
    };
    const stats = () => operation({ op: 'stats' });
    const getPreview = async (watchId, time) => {
        try {
            const row = await operation({ op: 'get', key: watchId, previewTime: time });
            return row?.sbInfo || null;
        }
        catch (_) {
            return null;
        }
    };
    const initWorker = async () => {
        if (db) {
            return db;
        }
        if (dbOpening) {
            return dbOpening;
        }
        // Share an in-flight IndexedDB/bridge open across simultaneous callers.
        // Rejected attempts must be cleared so a later request can retry.
        dbOpening = (async () => {
            const connection = location.host === 'www.nicovideo.jp' ?
                await IndexedDbStorage.open(WATCH_INFO) :
                await NicoVideoApi.bridgeDb(WATCH_INFO);
            db = connection;
            return connection;
        })();
        try {
            return await dbOpening;
        }
        finally {
            dbOpening = null;
        }
    };
    const open = async () => {
        if (instance) {
            return instance;
        }
        if (instanceOpening) {
            return instanceOpening;
        }
        // Initialize the facade once, and schedule the initial GC only once.
        instanceOpening = (async () => {
            await initWorker();
            const cacheDb = db['cache'];
            const facade = instance = {
                async put(watchId, sbInfo = {}, expectedGeneration) {
                    if (!sbInfo || typeof sbInfo !== 'object' || sbInfo.status !== 'ok') {
                        console.warn('Storyboard cache rejected non-ok payload');
                        return;
                    }
                    const record = {
                        watchId,
                        updatedAt: Date.now(),
                        sbInfo: sbInfo
                    };
                    if (expectedGeneration !== undefined && expectedGeneration < generationFloor) {
                        return;
                    }
                    try {
                        return await cacheDb.storyboardCache({ op: 'put', record, expectedGeneration }) || undefined;
                    }
                    catch (_) {
                        return;
                    } // Storage/quota failure must not prevent image rendering.
                },
                async get(watchId) {
                    let record;
                    try {
                        record = await cacheDb.storyboardCache({ op: 'get', key: watchId });
                    }
                    catch (_) {
                        return null;
                    }
                    if (!record) {
                        return null;
                    }
                    return record.sbInfo;
                },
                delete(watchId) { return cacheDb.delete({ key: watchId }); },
                close() { return cacheDb.close(); },
                gc(expireTime) { return cacheDb.gc(expireTime); }
            };
            operation({ op: 'stats' }).catch(() => console.warn('Storyboard cache cleanup failed'));
            return facade;
        })();
        try {
            return await instanceOpening;
        }
        finally {
            instanceOpening = null;
        }
    };
    const put = (watchId, sbInfo = {}, expectedGeneration = captureGeneration()) => open().then(db => db.put(watchId, sbInfo, expectedGeneration)).catch(() => undefined);
    const get = (watchId) => open().then(db => db.get(watchId)).catch(() => null);
    const del = (watchId) => open().then(db => db.delete(watchId));
    const close = () => open().then(db => db.close());
    const gc = (expireTime = 24 * 60 * 60 * 1000) => open().then(db => db.gc(expireTime));
    const api = (api) => NicoVideoApi = api;
    return { initWorker, open, put, get, getPreview, configure, clear, stats, captureGeneration, delete: del, close, gc, db, api };
})();
//===END===
export {StoryboardCacheDb};
