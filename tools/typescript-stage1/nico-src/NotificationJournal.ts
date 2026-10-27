/** Canonical TypeScript implementation of the notification journal. */
export type JournalLevel = 'info' | 'success' | 'warning' | 'error';
export type JournalCategory = 'general' | 'comment' | 'like' | 'network' | 'player' | 'system';
export type JournalDetails = Record<string, string | number | boolean>;
export interface JournalInput {
  level?: JournalLevel;
  category?: JournalCategory;
  message?: unknown;
  videoId?: unknown;
  source?: unknown;
  details?: unknown;
}
export interface JournalEntry {
  id: string;
  timestamp: number;
  level: JournalLevel;
  category: JournalCategory;
  message: string;
  videoId: string;
  source: string;
  details: JournalDetails;
}

const NotificationJournal = (() => {
  const DB_NAME = 'zenza-notification-journal';
  const STORE = 'entries';
  const MAX_RECORDS = 2000;
  const MAX_TEXT = 1024;
  const MAX_SESSION = 2000;
  const listeners = new Set<() => void>();
  const session: JournalEntry[] = [];
  const recent: JournalEntry[] = [];
  const levels = new Set(['info', 'success', 'warning', 'error']);
  const categories = new Set(['general', 'comment', 'like', 'network', 'player', 'system']);
  const safeKeys = new Set([
    'phase', 'event', 'reason', 'outcome', 'errorCode', 'statusCode',
    'httpStatus', 'threadId', 'attempt', 'retryScheduled', 'retryAfterMs',
    'operation', 'kind', 'errorName', 'requestId', 'postedNo'
  ]);
  let opening: Promise<IDBDatabase | null> | null = null;
  let connection: IDBDatabase | null = null;
  let sequence = 0;
  let writes = 0;
  let generation = 0;

  const text = (value: unknown): string => {
    if (typeof value !== 'string') { return ''; }
    return value
      .replace(/(["'](?:token|secret|authorization|cookie|password|csrf|session)["']\s*:\s*)(["'][^"']*["']|[^,}\s]+)/gi,
        '$1"[REDACTED]"')
      .replace(/https?:\/\/[^\s<>"']+/gi, match => {
        try {
          const url = new URL(match);
          return url.origin + url.pathname.replace(/\/[A-Za-z0-9_-]{48,}/g, '/[REDACTED]');
        } catch (_) { return '[URL]'; }
      })
      .replace(/\bBearer\s+[A-Za-z0-9._~+/-]+/gi, 'Bearer [REDACTED]')
      .replace(/\b(token|secret|authorization|cookie|password|csrf|session)\s*[:=]\s*[^\s,;]+/gi, '$1=[REDACTED]')
      .slice(0, MAX_TEXT);
  };
  const code = (value: unknown): string | undefined => typeof value === 'string' && /^[a-z0-9_-]{1,80}$/i.test(value) ? value : undefined;
  const videoId = (value: unknown): string => typeof value === 'string' && /^(?:sm|nm|so|ss)\d{1,16}$/i.test(value) ? value : '';
  const details = (data: unknown): JournalDetails => {
    const result: JournalDetails = {};
    if (!data || typeof data !== 'object' || Array.isArray(data)) { return result; }
    const fields = data as Record<string, unknown>;
    for (const key of safeKeys) {
      const value = fields[key];
      if (typeof value === 'boolean') { result[key] = value; }
      else if (typeof value === 'number' && Number.isFinite(value) &&
          Number.isSafeInteger(value) && Math.abs(value) <= 1e12) { result[key] = value; }
      else if (typeof value === 'string') {
        const normalized = code(value);
        if (normalized !== undefined) { result[key] = normalized; }
      }
    }
    return result;
  };
  const normalize = (entry: JournalInput | null | undefined): JournalEntry | null => {
    if (!entry || typeof entry !== 'object') { return null; }
    const now = Date.now();
    return {
      id: now.toString(36) + '-' + (++sequence).toString(36) + '-' +
        Math.random().toString(36).slice(2, 10),
      timestamp: now,
      level: levels.has(String(entry.level)) ? entry.level as JournalLevel : 'info',
      category: categories.has(String(entry.category)) ? entry.category as JournalCategory : 'general',
      message: text(entry.message),
      videoId: videoId(entry.videoId),
      source: code(entry.source) || '',
      details: details(entry.details)
    };
  };
  const announce = (): void => {
    for (const listener of listeners) {
      try { listener(); } catch (_) { /* listeners may not break logging */ }
    }
  };
  const open = (): Promise<IDBDatabase | null> => {
    if (connection) { return Promise.resolve(connection); }
    if (opening) { return opening; }
    if (typeof indexedDB === 'undefined') { return Promise.resolve(null); }
    opening = new Promise<IDBDatabase | null>(resolve => {
      let req: IDBOpenDBRequest;
      try { req = indexedDB.open(DB_NAME, 1); }
      catch (_) { resolve(null); return; }
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, {keyPath: 'id'});
          store.createIndex('timestamp', 'timestamp');
        }
      };
      req.onsuccess = () => {
        const db = req.result;
        connection = db;
        db.onversionchange = () => {
          db.close();
          if (connection === db) { connection = null; opening = null; }
        };
        resolve(db);
      };
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    });
    return opening;
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
  const persist = (entry: JournalEntry, expectedGeneration: number): void => {
    void open().then(db => {
      if (!db || expectedGeneration !== generation) { return; }
      try {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put(entry);
        tx.onerror = () => {};
        tx.oncomplete = () => {
          // Retain in memory only until the transaction commits. This avoids
          // resurfacing stale events after a different tab clears IndexedDB.
          const index = session.findIndex(item => item.id === entry.id);
          if (index !== -1) { session.splice(index, 1); }
          if (++writes % 50 === 0) { prune(db); }
        };
      } catch (_) { /* still available in session memory */ }
    }).catch(() => {});
  };
  const record = (input: JournalInput | null | undefined): JournalEntry | null => {
    const entry = normalize(input);
    if (!entry || !entry.message) { return null; }
    // An explicitly classified event is emitted just before its generic popup.
    // Save only the richer event; do not lose two legitimate repeated notifications.
    if (entry.category === 'general') {
      const duplicate = recent.some(previous =>
        previous.category !== 'general' &&
        previous.message === entry.message &&
        // PopupMessage has no video ownership at this low-level boundary.
        // A classified event immediately preceding the same popup already
        // carries the original video ID; suppress only that generic echo.
        // Do not suppress unrelated unclassified entries without a video ID.
        (previous.videoId === entry.videoId ||
          (entry.source === 'popup' && entry.videoId === '')) &&
        entry.timestamp - previous.timestamp <= 2000);
      if (duplicate) { return null; }
    }
    session.unshift(entry);
    if (session.length > MAX_SESSION) { session.length = MAX_SESSION; }
    recent.unshift(entry);
    if (recent.length > 8) { recent.length = 8; }
    persist(entry, generation);
    announce();
    return entry;
  };
  const list = async (limit = 300): Promise<JournalEntry[]> => {
    const count = Number.isSafeInteger(limit) ? Math.max(1, Math.min(limit, MAX_RECORDS)) : 300;
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
    const map = new Map<string, JournalEntry>();
    for (const entry of stored) {
      if (entry && typeof entry.id === 'string') { map.set(entry.id, entry); }
    }
    for (const entry of session) { map.set(entry.id, entry); }
    return Array.from(map.values())
      .sort((a, b) => b.timestamp - a.timestamp || (a.id < b.id ? 1 : -1))
      .slice(0, count);
  };
  const clear = async (): Promise<boolean> => {
    generation++;
    session.length = 0;
    recent.length = 0;
    announce();
    const db = await open();
    if (!db) { return false; }
    try {
      return await new Promise<boolean>(resolve => {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).clear();
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
        tx.onabort = () => resolve(false);
      });
    } catch (_) { return false; }
  };
  const subscribe = (listener: () => void): (() => void) => {
    if (typeof listener !== 'function') { return () => {}; }
    listeners.add(listener);
    return () => listeners.delete(listener);
  };
  return {record, list, clear, subscribe};
})();
export { NotificationJournal };
