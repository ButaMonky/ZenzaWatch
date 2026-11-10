/**
 * Canonical TypeScript source for packages/lib/src/nico/StoryboardCacheDb.js (Task642).
 * IndexedDB cache of storyboard (seek thumbnail) info keyed by watch/cache id.
 * On www.nicovideo.jp it opens IndexedDB directly; elsewhere it goes through the
 * NicoVideoApi IndexedDB bridge injected with `StoryboardCacheDb.api(...)`.
 * Only status:'ok' payloads are stored. Worker transactions enforce a shared
 * byte budget and idle retention, including legacy records and partial sheets.
 */

/** IndexedDbStorage store as used here (packages/lib/src/infra/IndexedDbStorage.js). */
export interface StoryboardIdbStore {
  storyboardCache(data: unknown): Promise<unknown>;
  put(record: StoryboardCacheRecord): Promise<unknown>;
  /** Touches updatedAt and resolves the stored record (or a falsy value). */
  updateTime(query: {key: string}): Promise<unknown>;
  delete(query: {key: string}): Promise<unknown>;
  close(): Promise<unknown>;
  gc(expireTime: number): Promise<unknown>;
}
export type StoryboardDb = Record<string, StoryboardIdbStore>;

export interface StoryboardDbDefinition {
  name: string;
  ver: number;
  stores: Array<{
    name: string;
    indexes: Array<{name: string; keyPath: string; params: {unique: boolean}}>;
    definition: {keyPath: string; autoIncrement: boolean};
  }>;
}

declare const IndexedDbStorage: {open(definition: StoryboardDbDefinition): Promise<StoryboardDb>};

/** What StoryboardCacheDb needs from NicoVideoApi (Task477). */
export interface StoryboardDbBridge {
  bridgeDb(definition: StoryboardDbDefinition): Promise<unknown>;
}

/** The storyboard payload is opaque here; only `status` is inspected. */
export type StoryboardInfoLike = {status?: unknown; [key: string]: unknown};

export interface StoryboardCacheRecord {
  watchId: string;
  updatedAt: number;
  sbInfo: StoryboardInfoLike;
}

export interface StoryboardCachePolicy {maxBytes?: number; maxAgeMs?: number}
export interface StoryboardCacheStats {bytes: number; entries: number; maxBytes: number; maxAgeMs: number; clearedAt: number}
export interface StoryboardCacheFacade {
  /** Stores only `status === 'ok'` objects; anything else is rejected with a warning (resolves undefined). */
  put(watchId: string, sbInfo?: unknown, expectedGeneration?: number): Promise<StoryboardCacheRecord | undefined>;
  /** Resolves the cached sbInfo or null on a miss. */
  get(watchId: string): Promise<unknown>;
  delete(watchId: string): Promise<unknown>;
  close(): Promise<unknown>;
  gc(expireTime: number): Promise<unknown>;
}

export interface StoryboardCacheDbClient {
  configure(policy: StoryboardCachePolicy): Promise<unknown>;
  clear(): Promise<unknown>;
  stats(): Promise<StoryboardCacheStats>;
  captureGeneration(): number;
  getPreview(watchId: string, time: number): Promise<unknown>;
  initWorker(): Promise<StoryboardDb>;
  open(): Promise<StoryboardCacheFacade>;
  put(watchId: string, sbInfo?: unknown, expectedGeneration?: number): Promise<StoryboardCacheRecord | undefined>;
  get(watchId: string): Promise<unknown>;
  delete(watchId: string): Promise<unknown>;
  close(): Promise<unknown>;
  gc(expireTime?: number): Promise<unknown>;
  /** Legacy: always the value at creation time (undefined); kept for the debug object. */
  db: StoryboardDb | undefined;
  api(api: StoryboardDbBridge): StoryboardDbBridge;
}

const StoryboardCacheDb: StoryboardCacheDbClient = (() => {
  const WATCH_INFO: StoryboardDbDefinition = {
    name: 'storyboard',
    ver: 2,
    stores: [
      {
        name: 'cache',
        indexes: [
          {name: 'updatedAt',  keyPath: 'updatedAt',  params: {unique: false}},
        ],
        definition: {keyPath: 'watchId', autoIncrement: false}
      }
    ]
  };

  let db: StoryboardDb | undefined, instance: StoryboardCacheFacade | undefined, NicoVideoApi: StoryboardDbBridge | undefined;
  let dbOpening: Promise<StoryboardDb> | null | undefined, instanceOpening: Promise<StoryboardCacheFacade> | null | undefined;
  let generationFloor = 0;
  const captureGeneration = (): number => Math.max(Date.now(), generationFloor);
  const operation = async (data: unknown): Promise<unknown> => {
    const connection = await initWorker();
    return (connection.cache as StoryboardIdbStore).storyboardCache(data);
  };
  const configure = (policy: StoryboardCachePolicy): Promise<unknown> => operation({op: 'configure', ...policy});
  const clear = async (): Promise<unknown> => {
    generationFloor = Math.max(Date.now(), generationFloor) + 1;
    const result = await operation({op: 'clear'}) as StoryboardCacheStats;
    generationFloor = Math.max(generationFloor, result.clearedAt + 1);
    return result;
  };
  const stats = (): Promise<StoryboardCacheStats> => operation({op: 'stats'}) as Promise<StoryboardCacheStats>;
  const getPreview = async (watchId: string, time: number): Promise<unknown> => {
    try { const row = await operation({op: 'get', key: watchId, previewTime: time}) as StoryboardCacheRecord | null; return row?.sbInfo || null; }
    catch (_) { return null; }
  };
  const initWorker = async (): Promise<StoryboardDb> => {
    if (db) { return db; }
    if (dbOpening) { return dbOpening; }
    // Share an in-flight IndexedDB/bridge open across simultaneous callers.
    // Rejected attempts must be cleared so a later request can retry.
    dbOpening = (async (): Promise<StoryboardDb> => {
      const connection = location.host === 'www.nicovideo.jp' ?
        await IndexedDbStorage.open(WATCH_INFO) :
        await (NicoVideoApi as StoryboardDbBridge).bridgeDb(WATCH_INFO) as StoryboardDb;
      db = connection;
      return connection;
    })();
    try { return await dbOpening; }
    finally { dbOpening = null; }
  };

  const open = async (): Promise<StoryboardCacheFacade> => {
    if (instance) { return instance; }
    if (instanceOpening) { return instanceOpening; }
    // Initialize the facade once, and schedule the initial GC only once.
    instanceOpening = (async (): Promise<StoryboardCacheFacade> => {
      await initWorker();
      const cacheDb = (db as StoryboardDb)['cache'] as StoryboardIdbStore;
      const facade: StoryboardCacheFacade = instance = {
        async put(watchId: string, sbInfo: unknown = {}, expectedGeneration?: number): Promise<StoryboardCacheRecord | undefined> {
          if (!sbInfo || typeof sbInfo !== 'object' || (sbInfo as StoryboardInfoLike).status !== 'ok') {
            console.warn('Storyboard cache rejected non-ok payload');
            return;
          }
          const record: StoryboardCacheRecord = {
            watchId,
            updatedAt: Date.now(),
            sbInfo: sbInfo as StoryboardInfoLike
          };
          if (expectedGeneration !== undefined && expectedGeneration < generationFloor) { return; }
          try {
            return await cacheDb.storyboardCache({op: 'put', record, expectedGeneration}) as StoryboardCacheRecord || undefined;
          } catch (_) { return; } // Storage/quota failure must not prevent image rendering.
        },
        async get(watchId: string): Promise<unknown> {
          let record;
          try { record = await cacheDb.storyboardCache({op: 'get', key: watchId}); }
          catch (_) { return null; }
          if (!record) { return null; }
          return (record as {sbInfo?: unknown}).sbInfo;
        },
        delete(watchId: string): Promise<unknown> { return cacheDb.delete({key: watchId}); },
        close(): Promise<unknown> { return cacheDb.close(); },
        gc(expireTime: number): Promise<unknown> { return cacheDb.gc(expireTime); }
      };
      operation({op: 'stats'}).catch(() => console.warn('Storyboard cache cleanup failed'));
      return facade;
    })();
    try { return await instanceOpening; }
    finally { instanceOpening = null; }
  };
  const put = (watchId: string, sbInfo: unknown = {}, expectedGeneration: number = captureGeneration()): Promise<StoryboardCacheRecord | undefined> => open().then(db => db.put(watchId, sbInfo, expectedGeneration)).catch(() => undefined);
  const get = (watchId: string): Promise<unknown> => open().then(db => db.get(watchId)).catch(() => null);
  const del = (watchId: string): Promise<unknown> => open().then(db => db.delete(watchId));
  const close = (): Promise<unknown> => open().then(db => db.close());
  const gc = (expireTime: number = 24 * 60 * 60 * 1000): Promise<unknown> => open().then(db => db.gc(expireTime));
  const api = (api: StoryboardDbBridge): StoryboardDbBridge => NicoVideoApi = api;

  return {initWorker, open, put, get, getPreview, configure, clear, stats, captureGeneration, delete: del, close, gc, db, api};
})();

export {StoryboardCacheDb};
