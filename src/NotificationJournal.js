// GENERATED FROM tools/typescript-stage1/nico-src/NotificationJournal.ts (TaskNLOG20261023). Edit the .ts and run npm run nico:sync.
//===BEGIN===
const NotificationJournal = (() => {
    const DB_NAME = 'zenza-notification-journal';
    const STORE = 'entries';
    const MAX_RECORDS = 2000;
    const MAX_TEXT = 1024;
    const MAX_SESSION = 2000;
    const listeners = new Set();
    const session = [];
    const recent = [];
    const levels = new Set(['info', 'success', 'warning', 'error']);
    const categories = new Set(['general', 'comment', 'like', 'network', 'player', 'system']);
    const safeKeys = new Set([
        'phase', 'event', 'reason', 'outcome', 'errorCode', 'statusCode',
        'httpStatus', 'threadId', 'attempt', 'retryScheduled', 'retryAfterMs',
        'operation', 'kind', 'errorName', 'requestId', 'postedNo'
    ]);
    let opening = null;
    let connection = null;
    let sequence = 0;
    let writes = 0;
    let generation = 0;
    const privatePath = (path) => path
        .replace(/\/[^/]+/g, segment => /%[0-9a-f]{2}|^\/[a-z0-9._~+=-]{24,}$/i.test(segment) ? '/[REDACTED]' : segment)
        .replace(/(\/(?:token|secret|authorization|password|csrf|session)\/)[^/]+/gi, '$1[REDACTED]');
    const text = (value) => {
        if (typeof value !== 'string') {
            return '';
        }
        return value
            .replace(/(["'](?:token|(?:access|refresh)[_-]?token|secret|authorization|cookie|password|csrf|session)["']\s*:\s*)("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[^,}\s]+)/gi, '$1"[REDACTED]"')
            .replace(/(?:https?|wss?):\/\/[^\s<>"']+/gi, match => {
            try {
                const url = new URL(match);
                return url.origin + privatePath(url.pathname);
            }
            catch (_) {
                return '[URL]';
            }
        })
            .replace(/(?:\/[A-Za-z0-9_~%.+=-]+)+(?:[?#][^\s<>"']*)?/g, match => privatePath(match.split(/[?#]/)[0]))
            .replace(/\bBearer\s+[A-Za-z0-9._~+/-]+/gi, 'Bearer [REDACTED]')
            .replace(/\b(token|(?:access|refresh)[_-]?token|secret|authorization|cookie|password|csrf|session)\s*[:=]\s*[^\s,;]+/gi, '$1=[REDACTED]')
            .slice(0, MAX_TEXT);
    };
    const code = (value) => typeof value === 'string' && /^[a-z0-9_-]{1,80}$/i.test(value) ? value : undefined;
    const videoId = (value) => typeof value === 'string' && /^(?:sm|nm|so|ss)\d{1,16}$/i.test(value) ? value : '';
    const details = (data) => {
        const result = {};
        if (!data || typeof data !== 'object' || Array.isArray(data)) {
            return result;
        }
        const fields = data;
        for (const key of safeKeys) {
            const value = fields[key];
            if (typeof value === 'boolean') {
                result[key] = value;
            }
            else if (typeof value === 'number' && Number.isFinite(value) &&
                Number.isSafeInteger(value) && Math.abs(value) <= 1e12) {
                result[key] = value;
            }
            else if (typeof value === 'string') {
                const normalized = code(value);
                if (normalized !== undefined) {
                    result[key] = normalized;
                }
            }
        }
        return result;
    };
    const normalize = (entry) => {
        if (!entry || typeof entry !== 'object') {
            return null;
        }
        const now = Date.now();
        return {
            id: now.toString(36) + '-' + (++sequence).toString(36) + '-' +
                Math.random().toString(36).slice(2, 10),
            timestamp: now,
            level: levels.has(String(entry.level)) ? entry.level : 'info',
            category: categories.has(String(entry.category)) ? entry.category : 'general',
            message: text(entry.message),
            videoId: videoId(entry.videoId),
            source: code(entry.source) || '',
            details: details(entry.details)
        };
    };
    const announce = () => {
        for (const listener of listeners) {
            try {
                listener();
            }
            catch (_) { /* listeners may not break logging */ }
        }
    };
    const open = () => {
        if (connection) {
            return Promise.resolve(connection);
        }
        if (opening) {
            return opening;
        }
        if (typeof indexedDB === 'undefined') {
            return Promise.resolve(null);
        }
        const attempt = new Promise(resolve => {
            let req;
            let settled = false;
            const fail = () => { if (!settled) {
                settled = true;
                resolve(null);
            } };
            try {
                req = indexedDB.open(DB_NAME, 1);
            }
            catch (_) {
                fail();
                return;
            }
            req.onupgradeneeded = () => {
                const db = req.result;
                if (!db.objectStoreNames.contains(STORE)) {
                    const store = db.createObjectStore(STORE, { keyPath: 'id' });
                    store.createIndex('timestamp', 'timestamp');
                }
            };
            req.onsuccess = () => {
                const db = req.result;
                // A blocked request may succeed after a new attempt already owns open().
                if (settled) {
                    db.close();
                    return;
                }
                settled = true;
                connection = db;
                const release = () => {
                    if (connection === db) {
                        connection = null;
                        if (opening === attempt) {
                            opening = null;
                        }
                    }
                };
                db.onversionchange = () => { db.close(); release(); };
                db.onclose = release;
                resolve(db);
            };
            req.onerror = fail;
            req.onblocked = fail;
        });
        opening = attempt;
        void attempt.then(() => { if (opening === attempt) {
            opening = null;
        } });
        return attempt;
    };
    const prune = (db) => {
        try {
            const tx = db.transaction(STORE, 'readwrite');
            let kept = 0;
            const req = tx.objectStore(STORE).index('timestamp').openCursor(null, 'prev');
            req.onsuccess = () => {
                const cursor = req.result;
                if (!cursor) {
                    return;
                }
                if (++kept > MAX_RECORDS) {
                    cursor.delete();
                }
                cursor.continue();
            };
            req.onerror = () => { };
            tx.onerror = () => { };
        }
        catch (_) { /* the journal must not stop playback */ }
    };
    const persist = (entry, expectedGeneration) => {
        void open().then(db => {
            if (!db || expectedGeneration !== generation) {
                return;
            }
            try {
                const tx = db.transaction(STORE, 'readwrite');
                tx.objectStore(STORE).put(entry);
                tx.onerror = () => { };
                tx.oncomplete = () => {
                    // Retain in memory only until the transaction commits. This avoids
                    // resurfacing stale events after a different tab clears IndexedDB.
                    const index = session.findIndex(item => item.id === entry.id);
                    if (index !== -1) {
                        session.splice(index, 1);
                    }
                    if (++writes % 50 === 0) {
                        prune(db);
                    }
                };
            }
            catch (_) { /* still available in session memory */ }
        }).catch(() => { });
    };
    const record = (input) => {
        const entry = normalize(input);
        if (!entry || !entry.message) {
            return null;
        }
        // An explicitly classified event is emitted just before its generic popup.
        // Save only the richer event; do not lose two legitimate repeated notifications.
        if (entry.category === 'general') {
            const duplicate = recent.some(previous => previous.category !== 'general' &&
                previous.message === entry.message &&
                // PopupMessage has no video ownership at this low-level boundary.
                // A classified event immediately preceding the same popup already
                // carries the original video ID; suppress only that generic echo.
                // Do not suppress unrelated unclassified entries without a video ID.
                (previous.videoId === entry.videoId ||
                    (entry.source === 'popup' && entry.videoId === '')) &&
                entry.timestamp - previous.timestamp <= 2000);
            if (duplicate) {
                return null;
            }
        }
        session.unshift(entry);
        if (session.length > MAX_SESSION) {
            session.length = MAX_SESSION;
        }
        recent.unshift(entry);
        if (recent.length > 8) {
            recent.length = 8;
        }
        persist(entry, generation);
        announce();
        return entry;
    };
    const list = async (limit = 300) => {
        const count = Number.isSafeInteger(limit) ? Math.max(1, Math.min(limit, MAX_RECORDS)) : 300;
        let stored = [];
        try {
            const db = await open();
            if (db) {
                stored = await new Promise(resolve => {
                    try {
                        const request = db.transaction(STORE).objectStore(STORE).getAll();
                        request.onsuccess = () => resolve(Array.isArray(request.result) ? request.result : []);
                        request.onerror = () => resolve([]);
                    }
                    catch (_) {
                        resolve([]);
                    }
                });
            }
        }
        catch (_) { /* fall back to session memory */ }
        const map = new Map();
        for (const entry of stored) {
            if (entry && typeof entry.id === 'string') {
                map.set(entry.id, entry);
            }
        }
        for (const entry of session) {
            map.set(entry.id, entry);
        }
        return Array.from(map.values())
            .sort((a, b) => b.timestamp - a.timestamp || (a.id < b.id ? 1 : -1))
            .slice(0, count);
    };
    const clear = async () => {
        generation++;
        session.length = 0;
        recent.length = 0;
        announce();
        const db = await open();
        if (!db) {
            return false;
        }
        try {
            return await new Promise(resolve => {
                const tx = db.transaction(STORE, 'readwrite');
                tx.objectStore(STORE).clear();
                tx.oncomplete = () => resolve(true);
                tx.onerror = () => resolve(false);
                tx.onabort = () => resolve(false);
            });
        }
        catch (_) {
            return false;
        }
    };
    const subscribe = (listener) => {
        if (typeof listener !== 'function') {
            return () => { };
        }
        listeners.add(listener);
        return () => listeners.delete(listener);
    };
    return { record, list, clear, subscribe };
})();
//===END===
export {NotificationJournal};
