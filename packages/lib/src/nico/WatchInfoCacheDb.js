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
    // #255: Only public display metadata belongs in persistent watch history.
    // Never enumerate model getters via toJSON(): that pulls in csrfToken,
    // watchAuthKey, DMC signatures and Domand access-right keys.
    const snapshotPublicVideoInfo = (value) => {
        const source = value;
        const data = {};
        const scalars = [
            'videoId', 'watchId', 'contextWatchId', 'originalVideoId',
            'title', 'postedAt', 'thumbnail', 'betterThumbnail',
            'duration', 'threadId', 'description', 'watchUrl'
        ];
        for (const key of scalars) {
            try {
                const v = source[key];
                if (typeof v === 'string' || typeof v === 'boolean' ||
                    (typeof v === 'number' && Number.isFinite(v))) {
                    data[key] = v;
                }
            }
            catch (_) { /* A broken metadata getter is not a reason to fail history. */ }
        }
        try {
            const count = source.count;
            if (count && typeof count === 'object') {
                const publicCounts = {};
                for (const key of ['comment', 'mylist', 'view', 'like']) {
                    if (typeof count[key] === 'number' && Number.isFinite(count[key])) {
                        publicCounts[key] = count[key];
                    }
                }
                data.count = publicCounts;
            }
        }
        catch (_) { }
        try {
            const owner = source.owner;
            if (owner && typeof owner === 'object') {
                const publicOwner = {};
                for (const key of ['type', 'url', 'icon', 'id', 'linkId', 'name']) {
                    const v = owner[key];
                    if (typeof v === 'string' ||
                        (typeof v === 'number' && Number.isFinite(v))) {
                        publicOwner[key] = v;
                    }
                }
                data.owner = publicOwner;
            }
        }
        catch (_) { }
        try {
            const genre = source.genre;
            if (genre && typeof genre === 'object') {
                const key = typeof genre.key === 'string' ? genre.key : '';
                const label = typeof genre.label === 'string' ? genre.label : '';
                data.genre = { key, label };
            }
        }
        catch (_) { }
        return data;
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
    // #286: Legacy cache rows predate the public videoInfo allowlist. Scrub in
    // small, transactionally isolated batches without delaying watch playback.
    // Other row fields (resume, comments, bookmarks and updatedAt) are untouched.
    let legacyScrubStarted = false;
    const scheduleLegacyScrub = (store) => {
        if (legacyScrubStarted || typeof store.scrubWatchVideoInfo !== 'function') {
            return;
        }
        legacyScrubStarted = true;
        const scan = async () => {
            let afterKey = null;
            while (true) {
                const page = await store.scrubWatchVideoInfo({
                    afterKey, maxRecords: 64
                });
                if (!page || !Number.isSafeInteger(page.scanned) ||
                    !Number.isSafeInteger(page.changed) || page.changed > page.scanned ||
                    (page.nextKey !== null &&
                        (typeof page.nextKey !== 'string' || !page.nextKey ||
                            (afterKey !== null && page.nextKey <= afterKey)))) {
                    throw new Error('Invalid legacy watch-info cleanup cursor');
                }
                if (page.nextKey === null) {
                    return;
                }
                afterKey = page.nextKey;
                // Yield so playback/resume and other tabs are not blocked by migration.
                await new Promise(resolve => setTimeout(resolve, 0));
            }
        };
        const start = () => {
            void scan().catch(() => {
                // No saved videoInfo/watchId/token or exception payload may reach logs.
                console.warn('Legacy watch history cleanup incomplete; retrying');
                void new Promise(resolve => setTimeout(resolve, 300))
                    .then(scan).catch(() => { console.warn('Legacy watch history cleanup incomplete'); });
            });
        };
        setTimeout(start, 0);
    };
    const createInstance = async () => {
        await initWorker();
        const cacheDb = db['cache'];
        scheduleLegacyScrub(cacheDb);
        return instance = {
            listSavedPoints,
            async put(watchId, options = {}) {
                /** @type {VideoInfoModel|null} */
                const videoInfo = options.videoInfo || null;
                const videoInfoRawData = videoInfo ? snapshotPublicVideoInfo(videoInfo) : null;
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
                const explicit = options.explicitResume === true;
                if (explicit && (!Number.isFinite(options.currentTime) || options.currentTime < 0)) {
                    throw new TypeError('Invalid explicit resume time');
                }
                if (explicit)
                    patch.resumeOverride = options.currentTime;
                else if (Number.isFinite(options.currentTime) && options.currentTime > 0)
                    patch.resumeOverride = null;
                const resume = Number.isFinite(options.currentTime) && (options.currentTime > 0 || explicit) ?
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
                    limits: { resume: 1 }
                });
                if (!record || typeof record !== 'object' || record.watchId !== watchId) {
                    throw new Error('Watch history update was not acknowledged');
                }
                return record;
            },
            // Atomic per-video clear. The transaction updates only resume and its
            // barrier, never deleting the watch row (videoInfo/comments/bookmarks).
            async clearAutomaticResume(watchId, reason = 'deleted') {
                if (typeof watchId !== 'string' || !watchId.trim() ||
                    !['completed', 'deleted'].includes(reason)) {
                    throw new TypeError('Invalid automatic resume clear request');
                }
                const now = Date.now();
                const record = await cacheDb.update({
                    key: watchId,
                    patch: { watchId, updatedAt: now, resume: [], resumeOverride: null, resumeClearedAt: now, resumeClearReason: reason },
                    defaults: { videoId: watchId, threadId: '', ownerId: '', postedAt: 0,
                        threadInfo: 0, heatMap: null, config: '' }
                });
                if (!record || typeof record !== 'object' ||
                    record.watchId !== watchId ||
                    !Array.isArray(record.resume) ||
                    record.resume.length !== 0) {
                    throw new Error('Automatic resume clear was not acknowledged');
                }
                return record;
            },
            async get(watchId) {
                // Playback only needs the saved resume/comment snapshot to start.
                // A timestamp touch is still requested, but its readwrite commit must
                // not extend the video's pre-session metadata wait.
                const record = await cacheDb.get({ key: watchId });
                if (record) {
                    void Promise.resolve()
                        .then(() => cacheDb.updateTime({ key: watchId }))
                        .catch(() => console.warn('Watch info cache access timestamp update failed'));
                }
                return record;
            },
            delete(watchId) { return cacheDb.delete({ key: watchId }); },
            close() { return cacheDb.close(); },
            gc(expireTime) { return cacheDb.gc(expireTime); }
        };
    };
    // Use initWorker directly: enumeration must not touch access timestamps or
    // start the write-only legacy scrub performed by open().
    const listSavedPoints = async () => {
        const cache = (await initWorker()).cache;
        if (!cache || typeof cache.listSavedPoints !== 'function')
            throw new Error('Saved points enumeration unavailable');
        const items = [];
        let afterKey = null;
        do {
            const page = await cache.listSavedPoints({ afterKey, maxRecords: 200 });
            if (!page || !Array.isArray(page.items) ||
                (page.nextKey !== null && (typeof page.nextKey !== 'string' || !page.nextKey ||
                    (afterKey !== null && page.nextKey <= afterKey)))) {
                throw new Error('Invalid saved points page');
            }
            for (const item of page.items) {
                if (!item || typeof item.watchId !== 'string' || !item.watchId)
                    continue;
                items.push({ watchId: item.watchId, title: item.title, duration: item.duration,
                    updatedAt: item.updatedAt, automaticTime: item.automaticTime });
            }
            afterKey = page.nextKey;
        } while (afterKey !== null);
        return items;
    };
    const put = (watchId, options = {}) => open().then(db => db.put(watchId, options));
    // Playback callers deliberately keep persistence best effort; explicit put still rejects.
    const putBestEffort = (watchId, options = {}) => put(watchId, options)
        .catch(() => { console.warn('Watch info cache write failed'); });
    const clearAutomaticResume = (watchId, reason = 'deleted') => open().then(db => db.clearAutomaticResume(watchId, reason));
    const get = (watchId) => open().then(db => db.get(watchId));
    const del = (watchId) => open().then(db => db.delete(watchId));
    const close = () => open().then(db => db.close());
    const gc = (expireTime) => open().then(db => db.gc(expireTime));
    const api = (api) => NicoVideoApi = api;
    return { initWorker, open, listSavedPoints, put, putBestEffort, clearAutomaticResume, get, delete: del, close, gc, api };
})();
//===END===
export {WatchInfoCacheDb};
