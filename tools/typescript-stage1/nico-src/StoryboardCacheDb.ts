/**
 * Canonical TypeScript source for packages/lib/src/nico/StoryboardCacheDb.js (Task642).
 * IndexedDB cache of storyboard (seek thumbnail) info keyed by watch/cache id.
 * On www.nicovideo.jp it opens IndexedDB directly; elsewhere it goes through the
 * NicoVideoApi IndexedDB bridge injected with `StoryboardCacheDb.api(...)`.
 * Only status:'ok' payloads are stored; entries older than 7 days are collected
 * once when the facade is first opened.
 */

/** IndexedDbStorage store as used here (packages/lib/src/infra/IndexedDbStorage.js). */
export interface StoryboardIdbStore {
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

export interface StoryboardCacheFacade {
  /** Stores only `status === 'ok'` objects; anything else is rejected with a warning (resolves undefined). */
  put(watchId: string, sbInfo?: unknown): Promise<StoryboardCacheRecord | undefined>;
  /** Resolves the cached sbInfo or null on a miss. */
  get(watchId: string): Promise<unknown>;
  delete(watchId: string): Promise<unknown>;
  close(): Promise<unknown>;
  gc(expireTime: number): Promise<unknown>;
}

export interface StoryboardCacheDbClient {
  initWorker(): Promise<StoryboardDb>;
  open(): Promise<StoryboardCacheFacade>;
  put(watchId: string, sbInfo?: unknown): Promise<StoryboardCacheRecord | undefined>;
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
        async put(watchId: string, sbInfo: unknown = {}): Promise<StoryboardCacheRecord | undefined> {
          if (!sbInfo || typeof sbInfo !== 'object' || (sbInfo as StoryboardInfoLike).status !== 'ok') {
            console.warn('Storyboard cache rejected non-ok payload');
            return;
          }
          const record: StoryboardCacheRecord = {
            watchId,
            updatedAt: Date.now(),
            sbInfo: sbInfo as StoryboardInfoLike
          };
          await cacheDb.put(record);
          return record;
        },
        async get(watchId: string): Promise<unknown> {
          const record = await cacheDb.updateTime({key: watchId});
          if (!record) { return null; }
          return (record as {sbInfo?: unknown}).sbInfo;
        },
        delete(watchId: string): Promise<unknown> { return cacheDb.delete({key: watchId}); },
        close(): Promise<unknown> { return cacheDb.close(); },
        gc(expireTime: number): Promise<unknown> { return cacheDb.gc(expireTime); }
      };
      facade.gc(7 * 24 * 60 * 60 * 1000).catch(() => console.warn('Storyboard cache cleanup failed'));
      return facade;
    })();
    try { return await instanceOpening; }
    finally { instanceOpening = null; }
  };
  const put = (watchId: string, sbInfo: unknown = {}): Promise<StoryboardCacheRecord | undefined> => open().then(db => db.put(watchId, sbInfo));
  const get = (watchId: string): Promise<unknown> => open().then(db => db.get(watchId));
  const del = (watchId: string): Promise<unknown> => open().then(db => db.delete(watchId));
  const close = (): Promise<unknown> => open().then(db => db.close());
  const gc = (expireTime: number = 24 * 60 * 60 * 1000): Promise<unknown> => open().then(db => db.gc(expireTime));
  const api = (api: StoryboardDbBridge): StoryboardDbBridge => NicoVideoApi = api;

  return {initWorker, open, put, get, delete: del, close, gc, db, api};
})();

export {StoryboardCacheDb};
