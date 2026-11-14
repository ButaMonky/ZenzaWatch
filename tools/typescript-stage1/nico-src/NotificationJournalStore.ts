import type {JournalEntry} from './NotificationJournalPolicy';

const NotificationJournalStore = (() => {
  const create = (indexedDB: IDBFactory | undefined) => {
    const DB_NAME = 'zenza-notification-journal';
    const STORE = 'entries';
    const META = 'control';
    // Task1036: 上限件数と保存期間は上級者設定で変えられる（setRetention）。古い順に自動で消す。
    let MAX_RECORDS = 5000;
    let MAX_AGE_MS = 90 * 86400000;
    let opening: Promise<IDBDatabase | null> | null = null;
    let connection: IDBDatabase | null = null;
    let writes = 0;
    let generation = 0;
    const reserve = <T>(operation: () => Promise<T>): Promise<T> => {
      try {
        const locks = typeof navigator === 'undefined' ? undefined : navigator.locks;
        // Reserve during the public call, before awaiting open(). A slow old
        // append must not overtake a later clear in another tab.
        return locks ? locks.request('zenza-notification-journal-operations', operation) : operation();
      } catch (error) { return Promise.reject(error); }
    };
    const open = (): Promise<IDBDatabase | null> => {
      if (connection) { return Promise.resolve(connection); }
      if (opening) { return opening; }
      if (typeof indexedDB === 'undefined') { return Promise.resolve(null); }
      const attempt = new Promise<IDBDatabase | null>(resolve => {
        let req: IDBOpenDBRequest;
        let settled = false;
        const fail = (): void => { if (!settled) { settled = true; resolve(null); } };
        try { req = indexedDB.open(DB_NAME, 2); }
        catch (_) { fail(); return; }
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(STORE)) {
            const store = db.createObjectStore(STORE, {keyPath: 'id'});
            store.createIndex('timestamp', 'timestamp');
          }
          if (!db.objectStoreNames.contains(META)) { db.createObjectStore(META, {keyPath: 'id'}); }
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

    /**
     * Task1038: 古い順に消すが、いいね・ニコるの記録は最後に回す。
     * 期間切れでは消さず、件数が上限を超えたときも、ほかの記録を先に消し、
     * それでも超える場合だけ古いいいね・ニコるを消す。
     */
    const isProtected = (value: unknown): boolean => {
      const v = value as {level?: unknown; activity?: {kind?: unknown}} | null;
      return !!v && v.level === 'success' && (v.activity?.kind === 'like' || v.activity?.kind === 'nicoru');
    };
    const prune = (db: IDBDatabase): void => {
      try {
        const tx = db.transaction(STORE, 'readwrite');
        const store = tx.objectStore(STORE);
        const rows: {key: IDBValidKey; timestamp: number; keep: boolean}[] = [];
        const req = store.index('timestamp').openCursor(null, 'prev');
        const oldest = MAX_AGE_MS > 0 ? Date.now() - MAX_AGE_MS : -Infinity;
        req.onsuccess = () => {
          const cursor = req.result;
          if (cursor) {
            const timestamp = Number((cursor.value as {timestamp?: unknown})?.timestamp);
            rows.push({key: cursor.primaryKey, timestamp, keep: isProtected(cursor.value)});
            cursor.continue();
            return;
          }
          // 新しい順。まず期間切れの通常記録を除き、残りから上限を超えた分を古い通常記録→古い活動記録の順に消す。
          const removals: IDBValidKey[] = [];
          const alive = rows.filter(row => {
            if (!row.keep && Number.isFinite(row.timestamp) && row.timestamp < oldest) { removals.push(row.key); return false; }
            return true;
          });
          let excess = alive.length - MAX_RECORDS;
          for (let i = alive.length - 1; i >= 0 && excess > 0; i--) {
            if (!alive[i]!.keep) { removals.push(alive[i]!.key); excess--; }
          }
          for (let i = alive.length - 1; i >= 0 && excess > 0; i--) {
            if (alive[i]!.keep) { removals.push(alive[i]!.key); excess--; }
          }
          for (const key of removals) { store.delete(key); }
        };
        req.onerror = () => {};
        tx.onerror = () => {};
      } catch (_) { /* the journal must not stop playback */ }
    };
    const epochOf = (value: unknown): number | null => {
      if (value === undefined) { return 0; }
      const epoch = value && typeof value === 'object' ? (value as {value?:unknown}).value : undefined;
      return typeof epoch === 'number' && Number.isSafeInteger(epoch) && epoch >= 0 ? epoch : null;
    };
    const readEpoch = (db: IDBDatabase): Promise<number | null> => new Promise(resolve => {
      try {
        const tx = db.transaction(META), request = tx.objectStore(META).get('clear');
        let epoch: number | null = null;
        request.onsuccess = () => { epoch = epochOf(request.result); };
        tx.oncomplete = () => resolve(epoch);
        tx.onerror = tx.onabort = () => resolve(null);
      } catch (_) { resolve(null); }
    });
    const append = (input: JournalEntry | ((epoch:number|null)=>JournalEntry|null), onCommit: () => void): void => {
      const expectedGeneration = generation;
      void reserve(async () => {
        const db = await open();
        if (expectedGeneration !== generation) { return; }
        const epoch = db ? await readEpoch(db) : null;
        if (expectedGeneration !== generation) { return; }
        const entry = typeof input === 'function' ? input(epoch) : input;
        // An unknown epoch is session-only. Never promote it later into a newer
        // epoch, which would resurrect a possibly pre-clear notification.
        if (!db || epoch === null || !entry) { return; }
        await new Promise<void>(resolve => {
          try {
            const tx = db.transaction([META, STORE], 'readwrite');
            const request = tx.objectStore(META).get('clear');let written = false;
            request.onsuccess = () => {
              if (epochOf(request.result) !== epoch || expectedGeneration !== generation) { return; }
              tx.objectStore(STORE).put({...entry, clearEpoch:epoch});written = true;
            };
            tx.onerror = tx.onabort = () => resolve();
            tx.oncomplete = () => {
              if (written) {
                try { onCommit(); } catch (_) { /* observers cannot retain the shared lock */ }
                if (++writes % 50 === 0) { prune(db); }
              }
              resolve();
            };
          } catch (_) { resolve(); }
        });
      }).catch(() => {});
    };
    const snapshot = (): Promise<{epoch:number|null;entries:JournalEntry[]}> => reserve(async () => {
        const db = await open();
        if (!db) { return {epoch:null,entries:[]}; }
        return new Promise<{epoch:number|null;entries:JournalEntry[]}>(resolve => {
            try {
              const tx = db.transaction([META, STORE]);let epoch:number|null=null,entries:JournalEntry[]=[];
              const control=tx.objectStore(META).get('clear'),request=tx.objectStore(STORE).getAll();
              control.onsuccess=()=>{epoch=epochOf(control.result);};
              request.onsuccess=()=>{entries=Array.isArray(request.result)?request.result:[];};
              tx.oncomplete=()=>resolve({epoch,entries:epoch===null?[]:entries.filter(entry=>
                ((entry as JournalEntry&{clearEpoch?:number}).clearEpoch??0)===epoch)});
              tx.onerror=tx.onabort=()=>resolve({epoch:null,entries:[]});
            } catch (_) { resolve({epoch:null,entries:[]}); }
          });
    }).catch(()=>({epoch:null,entries:[]}));
    const list = async (): Promise<JournalEntry[]> => (await snapshot()).entries;
    const clear = (onEpoch?:(epoch:number)=>void): Promise<boolean> => {
      generation++;
      return reserve(async () => {
        const db=await open();
        if (!db) { return false; }
        try {
          return new Promise<boolean>(resolve => {
            const tx = db.transaction([META,STORE], 'readwrite');
            const control=tx.objectStore(META),request=control.get('clear');let next:number|null=null;
            request.onsuccess=()=>{
              const epoch=epochOf(request.result);
              if(epoch===null||epoch>=Number.MAX_SAFE_INTEGER){tx.abort();return;}
              next=epoch+1;control.put({id:'clear',value:next});tx.objectStore(STORE).clear();
            };
            tx.oncomplete = () => {
              if (next !== null) {
                try { onEpoch?.(next); } catch (_) { /* committed deletion remains successful */ }
                resolve(true);
              } else { resolve(false); }
            };
            tx.onerror = () => resolve(false);
            tx.onabort = () => resolve(false);
          });
        } catch (_) { return false; }
      }).catch(()=>false);
    };
    /** Task1036: 上限件数（100〜50000）と保存期間（日、0は無期限）を設定し、すぐに整理する。 */
    const setRetention = (maxRecords: unknown, maxAgeDays: unknown): void => {
      const count = Number(maxRecords), days = Number(maxAgeDays);
      MAX_RECORDS = Number.isFinite(count) ? Math.max(100, Math.min(50000, Math.round(count))) : 5000;
      MAX_AGE_MS = Number.isFinite(days) && days > 0 ? Math.min(3650, days) * 86400000 : 0;
      void open().then(db => { if (db) { prune(db); } }).catch(() => {});
    };
    const limits = () => ({maxRecords: MAX_RECORDS, maxAgeMs: MAX_AGE_MS});
    return {append, list, snapshot, clear, setRetention, limits};
  };
  return {create};
})();
export { NotificationJournalStore };
