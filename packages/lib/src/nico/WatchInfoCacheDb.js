import {IndexedDbStorage} from '../infra/IndexedDbStorage';
import {VideoInfoModel} from '../../../../src/VideoInfo';
// GENERATED FROM tools/typescript-stage1/nico-src/WatchInfoCacheDb.ts (Task646). Edit the .ts and run npm run nico:sync.
//===BEGIN===
/**
 * Canonical TypeScript source for packages/lib/src/nico/WatchInfoCacheDb.js (Task646).
 * IndexedDB watch history: video info snapshot, owner, thread info, heat map,
 * resume points and posted comments, keyed by watchId. On www.nicovideo.jp it
 * opens IndexedDB directly; elsewhere it uses the NicoVideoApi bridge injected
 * with `WatchInfoCacheDb.api(...)`.
 */
const WatchInfoCacheDb = (() => {
    const WATCH_INFO = {
        name: 'watch-info',
        ver: 2,
        stores: [
            {
                name: 'cache',
                indexes: [
                    { name: 'videoId', keyPath: 'videoId', params: { unique: false } },
                    { name: 'threadId', keyPath: 'threadId', params: { unique: false } },
                    { name: 'ownerId', keyPath: 'ownerId', params: { unique: false } },
                    { name: 'watchCount', keyPath: 'watchCount', params: { unique: false } },
                    { name: 'postedAt', keyPath: 'postedAt', params: { unique: false } },
                    { name: 'updatedAt', keyPath: 'updatedAt', params: { unique: false } },
                ],
                definition: { keyPath: 'watchId', autoIncrement: false }
            }
        ]
    };
    let db, instance, NicoVideoApi;
    // Task647 (WI-OPEN-RACE-001): startup initWorker() and an early put/get used to open
    // the database twice and build two facades. Share the in-flight open (as
    // StoryboardCacheDb does) and clear it on failure so a later call can retry.
    let dbOpening = null, instanceOpening = null;
    const initWorker = async () => {
        if (db) {
            return db;
        }
        if (dbOpening) {
            return dbOpening;
        }
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
        instanceOpening = createInstance();
        try {
            return await instanceOpening;
        }
        finally {
            instanceOpening = null;
        }
    };
    const createInstance = async () => {
        await initWorker();
        const cacheDb = db['cache'];
        return instance = {
            async put(watchId, options = {}) {
                /** @type {VideoInfoModel|null} */
                const videoInfo = options.videoInfo || null;
                const videoInfoRawData = (videoInfo && videoInfo.toJSON) ? videoInfo.toJSON() : videoInfo;
                const now = Date.now();
                const patch = { watchId, updatedAt: now };
                const ownerId = videoInfo?.owner?.linkId || '';
                if (ownerId) {
                    patch.ownerId = ownerId;
                }
                if (videoInfoRawData) {
                    patch.videoInfo = videoInfoRawData;
                }
                for (const key of ['threadInfo', 'heatMap', 'config']) {
                    if (options[key]) {
                        patch[key] = options[key];
                    }
                }
                const resume = Number.isFinite(options.currentTime) && options.currentTime > 0 ?
                    [{ now, time: options.currentTime }] : [];
                const record = await cacheDb.update({
                    key: watchId, patch,
                    defaults: {
                        videoId: (videoInfo ? videoInfo.videoId : watchId) || '',
                        threadId: (videoInfo ? videoInfo.threadId * 1 : 0) || '',
                        ownerId, postedAt: videoInfo ? new Date(videoInfo.postedAt).getTime() : 0,
                        threadInfo: 0, heatMap: null, config: ''
                    },
                    increment: { watchCount: options.watchCount === 1 ? 1 : 0 },
                    prepend: { resume }, append: { comment: options.comment ? [options.comment] : [] },
                    limits: { resume: 10 }
                });
                if (!record || typeof record !== 'object' || record.watchId !== watchId) {
                    throw new Error('Watch history update was not acknowledged');
                }
                return record;
            },
            get(watchId) { return cacheDb.updateTime({ key: watchId }); },
            delete(watchId) { return cacheDb.delete({ key: watchId }); },
            close() { return cacheDb.close(); },
            gc(expireTime) { return cacheDb.gc(expireTime); }
        };
    };
    const put = (watchId, options = {}) => open().then(db => db.put(watchId, options));
    // Playback callers deliberately keep persistence best effort; explicit put still rejects.
    const putBestEffort = (watchId, options = {}) => put(watchId, options)
        .catch(() => { console.warn('Watch info cache write failed'); });
    const get = (watchId) => open().then(db => db.get(watchId));
    const del = (watchId) => open().then(db => db.delete(watchId));
    const close = () => open().then(db => db.close());
    const gc = (expireTime) => open().then(db => db.gc(expireTime));
    const api = (api) => NicoVideoApi = api;
    return { initWorker, open, put, putBestEffort, get, delete: del, close, gc, api };
})();
//===END===
export {WatchInfoCacheDb};
