// GENERATED FROM tools/typescript-stage1/nico-src/NotificationJournalStore.ts (Task990). Edit the .ts and run npm run nico:sync.
//===BEGIN===
const NotificationJournalStore = (() => {
    const create = (indexedDB) => {
        const DB_NAME = 'zenza-notification-journal';
        const STORE = 'entries';
        const META = 'control';
        const MAX_RECORDS = 2000;
        let opening = null;
        let connection = null;
        let writes = 0;
        let generation = 0;
        const reserve = (operation) => {
            try {
                const locks = typeof navigator === 'undefined' ? undefined : navigator.locks;
                // Reserve during the public call, before awaiting open(). A slow old
                // append must not overtake a later clear in another tab.
                return locks ? locks.request('zenza-notification-journal-operations', operation) : operation();
            }
            catch (error) {
                return Promise.reject(error);
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
                    req = indexedDB.open(DB_NAME, 2);
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
                    if (!db.objectStoreNames.contains(META)) {
                        db.createObjectStore(META, { keyPath: 'id' });
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
        const epochOf = (value) => {
            if (value === undefined) {
                return 0;
            }
            const epoch = value && typeof value === 'object' ? value.value : undefined;
            return typeof epoch === 'number' && Number.isSafeInteger(epoch) && epoch >= 0 ? epoch : null;
        };
        const readEpoch = (db) => new Promise(resolve => {
            try {
                const tx = db.transaction(META), request = tx.objectStore(META).get('clear');
                let epoch = null;
                request.onsuccess = () => { epoch = epochOf(request.result); };
                tx.oncomplete = () => resolve(epoch);
                tx.onerror = tx.onabort = () => resolve(null);
            }
            catch (_) {
                resolve(null);
            }
        });
        const append = (input, onCommit) => {
            const expectedGeneration = generation;
            void reserve(async () => {
                const db = await open();
                if (expectedGeneration !== generation) {
                    return;
                }
                const epoch = db ? await readEpoch(db) : null;
                if (expectedGeneration !== generation) {
                    return;
                }
                const entry = typeof input === 'function' ? input(epoch) : input;
                // An unknown epoch is session-only. Never promote it later into a newer
                // epoch, which would resurrect a possibly pre-clear notification.
                if (!db || epoch === null || !entry) {
                    return;
                }
                await new Promise(resolve => {
                    try {
                        const tx = db.transaction([META, STORE], 'readwrite');
                        const request = tx.objectStore(META).get('clear');
                        let written = false;
                        request.onsuccess = () => {
                            if (epochOf(request.result) !== epoch || expectedGeneration !== generation) {
                                return;
                            }
                            tx.objectStore(STORE).put({ ...entry, clearEpoch: epoch });
                            written = true;
                        };
                        tx.onerror = tx.onabort = () => resolve();
                        tx.oncomplete = () => {
                            if (written) {
                                try {
                                    onCommit();
                                }
                                catch (_) { /* observers cannot retain the shared lock */ }
                                if (++writes % 50 === 0) {
                                    prune(db);
                                }
                            }
                            resolve();
                        };
                    }
                    catch (_) {
                        resolve();
                    }
                });
            }).catch(() => { });
        };
        const snapshot = () => reserve(async () => {
            const db = await open();
            if (!db) {
                return { epoch: null, entries: [] };
            }
            return new Promise(resolve => {
                try {
                    const tx = db.transaction([META, STORE]);
                    let epoch = null, entries = [];
                    const control = tx.objectStore(META).get('clear'), request = tx.objectStore(STORE).getAll();
                    control.onsuccess = () => { epoch = epochOf(control.result); };
                    request.onsuccess = () => { entries = Array.isArray(request.result) ? request.result : []; };
                    tx.oncomplete = () => resolve({ epoch, entries: epoch === null ? [] : entries.filter(entry => (entry.clearEpoch ?? 0) === epoch) });
                    tx.onerror = tx.onabort = () => resolve({ epoch: null, entries: [] });
                }
                catch (_) {
                    resolve({ epoch: null, entries: [] });
                }
            });
        }).catch(() => ({ epoch: null, entries: [] }));
        const list = async () => (await snapshot()).entries;
        const clear = (onEpoch) => {
            generation++;
            return reserve(async () => {
                const db = await open();
                if (!db) {
                    return false;
                }
                try {
                    return new Promise(resolve => {
                        const tx = db.transaction([META, STORE], 'readwrite');
                        const control = tx.objectStore(META), request = control.get('clear');
                        let next = null;
                        request.onsuccess = () => {
                            const epoch = epochOf(request.result);
                            if (epoch === null || epoch >= Number.MAX_SAFE_INTEGER) {
                                tx.abort();
                                return;
                            }
                            next = epoch + 1;
                            control.put({ id: 'clear', value: next });
                            tx.objectStore(STORE).clear();
                        };
                        tx.oncomplete = () => {
                            if (next !== null) {
                                try {
                                    onEpoch?.(next);
                                }
                                catch (_) { /* committed deletion remains successful */ }
                                resolve(true);
                            }
                            else {
                                resolve(false);
                            }
                        };
                        tx.onerror = () => resolve(false);
                        tx.onabort = () => resolve(false);
                    });
                }
                catch (_) {
                    return false;
                }
            }).catch(() => false);
        };
        return { append, list, snapshot, clear };
    };
    return { create };
})();
//===END===
export {NotificationJournalStore};
