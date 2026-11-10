// GENERATED FROM tools/typescript-stage1/nico-src/NotificationJournalStore.ts (Task990). Edit the .ts and run npm run nico:sync.
//===BEGIN===
const NotificationJournalStore = (() => {
    const create = (indexedDB) => {
        const DB_NAME = 'zenza-notification-journal';
        const STORE = 'entries';
        const MAX_RECORDS = 2000;
        let opening = null;
        let connection = null;
        let writes = 0;
        let generation = 0;
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
        const append = (entry, onCommit) => {
            const expectedGeneration = generation;
            void open().then(db => {
                if (!db || expectedGeneration !== generation) {
                    return;
                }
                try {
                    const tx = db.transaction(STORE, 'readwrite');
                    tx.objectStore(STORE).put(entry);
                    tx.onerror = () => { };
                    tx.oncomplete = () => {
                        onCommit();
                        if (++writes % 50 === 0) {
                            prune(db);
                        }
                    };
                }
                catch (_) { /* still available in session memory */ }
            }).catch(() => { });
        };
        const list = async () => {
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
            return stored;
        };
        const clear = async () => {
            generation++;
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
        return { append, list, clear };
    };
    return { create };
})();
//===END===
export {NotificationJournalStore};
