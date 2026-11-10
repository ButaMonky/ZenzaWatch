import type {JournalEntry} from './NotificationJournalPolicy';

const NotificationJournalStore = (() => {
  const create = (indexedDB: IDBFactory | undefined) => {
    const DB_NAME = 'zenza-notification-journal';
    const STORE = 'entries';
    const MAX_RECORDS = 2000;
    let opening: Promise<IDBDatabase | null> | null = null;
    let connection: IDBDatabase | null = null;
    let writes = 0;
    let generation = 0;
    const open = (): Promise<IDBDatabase | null> => {
      if (connection) { return Promise.resolve(connection); }
      if (opening) { return opening; }
      if (typeof indexedDB === 'undefined') { return Promise.resolve(null); }
      const attempt = new Promise<IDBDatabase | null>(resolve => {
        let req: IDBOpenDBRequest;
        let settled = false;
        const fail = (): void => { if (!settled) { settled = true; resolve(null); } };
        try { req = indexedDB.open(DB_NAME, 1); }
        catch (_) { fail(); return; }
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(STORE)) {
            const store = db.createObjectStore(STORE, {keyPath: 'id'});
            store.createIndex('timestamp', 'timestamp');
          }
        };
        req.onsuccess = () => {
          const db = req.result;
          // A blocked request may succeed after a new attempt already owns open().
          if (settled) { db.close(); return; }
          settled = true;
          connection = db;
          const release = (): void => {
            if (connection === db) {
              connection = null;
              if (opening === attempt) { opening = null; }
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
      void attempt.then(() => { if (opening === attempt) { opening = null; } });
      return attempt;
    };

    const prune = (db: IDBDatabase): void => {
      try {
        const tx = db.transaction(STORE, 'readwrite');
        let kept = 0;
        const req = tx.objectStore(STORE).index('timestamp').openCursor(null, 'prev');
        req.onsuccess = () => {
          const cursor = req.result;
          if (!cursor) { return; }
          if (++kept > MAX_RECORDS) { cursor.delete(); }
          cursor.continue();
        };
        req.onerror = () => {};
        tx.onerror = () => {};
      } catch (_) { /* the journal must not stop playback */ }
    };
    const append = (entry: JournalEntry, onCommit: () => void): void => {
      const expectedGeneration = generation;
      void open().then(db => {
        if (!db || expectedGeneration !== generation) { return; }
        try {
          const tx = db.transaction(STORE, 'readwrite');
          tx.objectStore(STORE).put(entry);
          tx.onerror = () => {};
          tx.oncomplete = () => {
            onCommit();
            if (++writes % 50 === 0) { prune(db); }
          };
        } catch (_) { /* still available in session memory */ }
      }).catch(() => {});
    };
    const list = async (): Promise<JournalEntry[]> => {
      let stored: JournalEntry[] = [];
      try {
        const db = await open();
        if (db) {
          stored = await new Promise<JournalEntry[]>(resolve => {
            try {
              const request = db.transaction(STORE).objectStore(STORE).getAll();
              request.onsuccess = () => resolve(Array.isArray(request.result) ? request.result : []);
              request.onerror = () => resolve([]);
            } catch (_) { resolve([]); }
          });
        }
      } catch (_) { /* fall back to session memory */ }
      return stored;
    };
    const clear = (): Promise<boolean> => {
      generation++;
      // Use the same open promise as append, preserving transaction order even
      // when the host supplies a Promise from a different realm.
      return open().then(db => {
        if (!db) { return false; }
        try {
          return new Promise<boolean>(resolve => {
            const tx = db.transaction(STORE, 'readwrite');
            tx.objectStore(STORE).clear();
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => resolve(false);
            tx.onabort = () => resolve(false);
          });
        } catch (_) { return false; }
      });
    };
    return {append, list, clear};
  };
  return {create};
})();
export { NotificationJournalStore };
