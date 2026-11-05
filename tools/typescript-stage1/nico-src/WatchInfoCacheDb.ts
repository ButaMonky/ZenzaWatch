/**
 * Canonical TypeScript source for packages/lib/src/nico/WatchInfoCacheDb.js (Task646).
 * IndexedDB watch history: video info snapshot, owner, thread info, heat map,
 * resume points and posted comments, keyed by watchId. On www.nicovideo.jp it
 * opens IndexedDB directly; elsewhere it uses the NicoVideoApi bridge injected
 * with `WatchInfoCacheDb.api(...)`.
 */

/** IndexedDbStorage store as used here (packages/lib/src/infra/IndexedDbStorage.js). */
export interface WatchInfoIdbStore {
  /** Atomic read-modify-write; resolves the stored record. */
  update(request: WatchInfoUpdateRequest): Promise<unknown>;
  /** Read-only history snapshot, without waiting for a readwrite transaction. */
  get(query: {key: string}): Promise<unknown>;
  /** Touches updatedAt and resolves the stored record (or a falsy value). */
  updateTime(query: {key: string}): Promise<unknown>;
  delete(query: {key: string}): Promise<unknown>;
  close(): Promise<unknown>;
  gc(expireTime?: number): Promise<unknown>;
}
export type WatchInfoDb = Record<string, WatchInfoIdbStore>;
export interface WatchInfoDbDefinition {
  name: string;
  ver: number;
  stores: Array<{
    name: string;
    indexes: Array<{name: string; keyPath: string; params: {unique: boolean}}>;
    definition: {keyPath: string; autoIncrement: boolean};
  }>;
}
declare const IndexedDbStorage: {open(definition: WatchInfoDbDefinition): Promise<WatchInfoDb>};

/** What WatchInfoCacheDb needs from NicoVideoApi (Task477). */
export interface WatchInfoDbBridge {
  bridgeDb(definition: WatchInfoDbDefinition): Promise<unknown>;
}
/** The part of VideoInfoModel (src/VideoInfo.js) read here. */
export interface WatchVideoInfoLike {
  toJSON?: () => unknown;
  owner?: {linkId?: string | null} | null;
  videoId?: string;
  threadId?: unknown;
  postedAt?: string | number | Date;
}
export interface WatchInfoPutOptions {
  videoInfo?: WatchVideoInfoLike | null;
  threadInfo?: unknown;
  heatMap?: unknown;
  config?: unknown;
  currentTime?: number;
  explicitResume?: boolean;
  /** 1 increments the watch count. */
  watchCount?: number;
  comment?: unknown;
}
export interface WatchInfoUpdateRequest {
  key: string;
  patch: Record<string, unknown>;
  defaults: {
    videoId: string;
    threadId: number | string;
    ownerId: string;
    postedAt: number;
    threadInfo: unknown;
    heatMap: unknown;
    config: unknown;
  };
  increment?: {watchCount: number};
  prepend?: {resume: Array<{now: number; time: number}>};
  append?: {comment: unknown[]};
  limits?: {resume: number};
}
/** The stored row as acknowledged by update(); other fields are unvalidated. */
export interface WatchInfoRecord {
  watchId: string;
  [key: string]: unknown;
}
export interface WatchInfoCache {
  /** Delete only automatic resume state; keep other watch metadata and comments. */
  clearAutomaticResume(watchId:string,reason?:'completed'|'deleted'):Promise<WatchInfoRecord>;
  /** Rejects when the store does not acknowledge the row for `watchId`. */
  put(watchId: string, options?: WatchInfoPutOptions): Promise<WatchInfoRecord>;
  get(watchId: string): Promise<unknown>;
  delete(watchId: string): Promise<unknown>;
  close(): Promise<unknown>;
  gc(expireTime?: number): Promise<unknown>;
}
export interface WatchInfoCacheDbClient {
  initWorker(): Promise<WatchInfoDb>;
  clearAutomaticResume(watchId:string,reason?:'completed'|'deleted'):Promise<WatchInfoRecord>;
  open(): Promise<WatchInfoCache>;
  put(watchId: string, options?: WatchInfoPutOptions): Promise<WatchInfoRecord>;
  /** Same as put but failures only warn (resolves undefined). */
  putBestEffort(watchId: string, options?: WatchInfoPutOptions): Promise<WatchInfoRecord | void>;
  get(watchId: string): Promise<unknown>;
  delete(watchId: string): Promise<unknown>;
  close(): Promise<unknown>;
  gc(expireTime?: number): Promise<unknown>;
  api(api: WatchInfoDbBridge): WatchInfoDbBridge;
}

const WatchInfoCacheDb: WatchInfoCacheDbClient = (() => {
  const WATCH_INFO: WatchInfoDbDefinition = {
    name: 'watch-info',
    ver: 2,
    stores: [
      {
        name: 'cache',
        indexes: [
          {name: 'videoId',    keyPath: 'videoId',    params: {unique: false}},
          {name: 'threadId',   keyPath: 'threadId',   params: {unique: false}},
          {name: 'ownerId',    keyPath: 'ownerId',    params: {unique: false}},
          {name: 'watchCount', keyPath: 'watchCount', params: {unique: false}},
          {name: 'postedAt',   keyPath: 'postedAt',   params: {unique: false}},
          {name: 'updatedAt',  keyPath: 'updatedAt',  params: {unique: false}},
        ],
        definition: {keyPath: 'watchId', autoIncrement: false}
      }
    ]
  };

  let db: WatchInfoDb | undefined, instance: WatchInfoCache | undefined, NicoVideoApi: WatchInfoDbBridge | undefined;
  // Task647 (WI-OPEN-RACE-001): startup initWorker() and an early put/get used to open
  // the database twice and build two facades. Share the in-flight open (as
  // StoryboardCacheDb does) and clear it on failure so a later call can retry.
  let dbOpening: Promise<WatchInfoDb> | null = null, instanceOpening: Promise<WatchInfoCache> | null = null;
  const initWorker = async (): Promise<WatchInfoDb> => {
    if (db) { return db; }
    if (dbOpening) { return dbOpening; }
    dbOpening = (async (): Promise<WatchInfoDb> => {
      const connection = location.host === 'www.nicovideo.jp' ?
        await IndexedDbStorage.open(WATCH_INFO) :
        await (NicoVideoApi as WatchInfoDbBridge).bridgeDb(WATCH_INFO) as WatchInfoDb;
      db = connection;
      return connection;
    })();
    try { return await dbOpening; }
    finally { dbOpening = null; }
  };

  const open = async (): Promise<WatchInfoCache> => {
    if (instance) { return instance; }
    if (instanceOpening) { return instanceOpening; }
    instanceOpening = createInstance();
    try { return await instanceOpening; }
    finally { instanceOpening = null; }
  };
  const createInstance = async (): Promise<WatchInfoCache> => {
    await initWorker();
    const cacheDb = (db as WatchInfoDb)['cache'] as WatchInfoIdbStore;
    return instance = {
      async put(watchId: string, options: WatchInfoPutOptions = {}): Promise<WatchInfoRecord> {
        /** @type {VideoInfoModel|null} */
        const videoInfo = options.videoInfo || null;
        const videoInfoRawData = (videoInfo && videoInfo.toJSON) ? videoInfo.toJSON() : videoInfo;
        const now = Date.now();
        const patch: Record<string, unknown> = {watchId, updatedAt: now};
        const ownerId = videoInfo?.owner?.linkId || '';
        if (ownerId) { patch.ownerId = ownerId; }
        if (videoInfoRawData) { patch.videoInfo = videoInfoRawData; }
        for (const key of ['threadInfo', 'heatMap', 'config'] as const) {
          if (options[key]) { patch[key] = options[key]; }
        }
        const explicit=options.explicitResume===true;
        if(explicit&&(!Number.isFinite(options.currentTime)||(options.currentTime as number)<0)){
          throw new TypeError('Invalid explicit resume time');
        }
        if(explicit)patch.resumeOverride=options.currentTime;
        else if(Number.isFinite(options.currentTime)&&(options.currentTime as number)>0)patch.resumeOverride=null;
        const resume = Number.isFinite(options.currentTime) && ((options.currentTime as number) > 0 || explicit) ?
          [{now, time: options.currentTime as number}] : [];
        const record = await cacheDb.update({
          key: watchId, patch,
          defaults: {
            videoId: (videoInfo ? videoInfo.videoId : watchId) || '',
            threadId: (videoInfo ? (videoInfo.threadId as number) * 1 : 0) || '',
            ownerId, postedAt: videoInfo ? new Date(videoInfo.postedAt as string).getTime() : 0,
            threadInfo: 0, heatMap: null, config: ''
          },
          increment: {watchCount: options.watchCount === 1 ? 1 : 0},
          prepend: {resume}, append: {comment: options.comment ? [options.comment] : []},
          limits: {resume: 1}
        });
        if (!record || typeof record !== 'object' || (record as WatchInfoRecord).watchId !== watchId) {
          throw new Error('Watch history update was not acknowledged');
        }
        return record as WatchInfoRecord;
      },
      // Atomic per-video clear. The transaction updates only resume and its
      // barrier, never deleting the watch row (videoInfo/comments/bookmarks).
      async clearAutomaticResume(watchId:string,reason:'completed'|'deleted'='deleted'):Promise<WatchInfoRecord> {
        if(typeof watchId!=='string'||!watchId.trim()||
           !['completed','deleted'].includes(reason)){
          throw new TypeError('Invalid automatic resume clear request');
        }
        const now=Date.now();
        const record=await cacheDb.update({
          key:watchId,
          patch:{watchId,updatedAt:now,resume:[],resumeOverride:null,resumeClearedAt:now,resumeClearReason:reason},
          defaults:{videoId:watchId,threadId:'',ownerId:'',postedAt:0,
            threadInfo:0,heatMap:null,config:''}
        });
        if(!record||typeof record!=='object'||
           (record as WatchInfoRecord).watchId!==watchId||
           !Array.isArray((record as WatchInfoRecord).resume)||
           ((record as WatchInfoRecord).resume as unknown[]).length!==0){
          throw new Error('Automatic resume clear was not acknowledged');
        }
        return record as WatchInfoRecord;
      },
      async get(watchId: string): Promise<unknown> {
        // Playback only needs the saved resume/comment snapshot to start.
        // A timestamp touch is still requested, but its readwrite commit must
        // not extend the video's pre-session metadata wait.
        const record = await cacheDb.get({key: watchId});
        if (record) {
          void Promise.resolve()
            .then(() => cacheDb.updateTime({key: watchId}))
            .catch(() => console.warn('Watch info cache access timestamp update failed'));
        }
        return record;
      },
      delete(watchId: string): Promise<unknown> { return cacheDb.delete({key: watchId}); },
      close(): Promise<unknown> { return cacheDb.close(); },
      gc(expireTime?: number): Promise<unknown> { return cacheDb.gc(expireTime); }
    };
  };
  const put = (watchId: string, options: WatchInfoPutOptions = {}): Promise<WatchInfoRecord> => open().then(db => db.put(watchId, options));
  // Playback callers deliberately keep persistence best effort; explicit put still rejects.
  const putBestEffort = (watchId: string, options: WatchInfoPutOptions = {}): Promise<WatchInfoRecord | void> => put(watchId, options)
    .catch(() => { console.warn('Watch info cache write failed'); });
  const clearAutomaticResume = (watchId:string,reason:'completed'|'deleted'='deleted'):Promise<WatchInfoRecord> =>
    open().then(db => db.clearAutomaticResume(watchId,reason));
  const get = (watchId: string): Promise<unknown> => open().then(db => db.get(watchId));
  const del = (watchId: string): Promise<unknown> => open().then(db => db.delete(watchId));
  const close = (): Promise<unknown> => open().then(db => db.close());
  const gc = (expireTime?: number): Promise<unknown> => open().then(db => db.gc(expireTime));
  const api = (api: WatchInfoDbBridge): WatchInfoDbBridge => NicoVideoApi = api;

  return {initWorker, open, put, putBestEffort, clearAutomaticResume, get, delete: del, close, gc, api};
})();

export {WatchInfoCacheDb};
