/**
 * Canonical TypeScript source for packages/lib/src/nico/WatchInfoCacheDb.js (Task646).
 * IndexedDB watch history: video info snapshot, owner, thread info, heat map,
 * resume points and posted comments, keyed by watchId. On www.nicovideo.jp it
 * opens IndexedDB directly; elsewhere it uses the NicoVideoApi bridge injected
 * with `WatchInfoCacheDb.api(...)`.
 */

import type {SavedPointProjection,SavedPointsPage} from './IndexedDbStorage';

/** IndexedDbStorage store as used here (packages/lib/src/infra/IndexedDbStorage.js). */
export interface WatchInfoIdbStore {
  listSavedPoints?(query:{afterKey?:string|null;maxRecords?:number}):Promise<SavedPointsPage>;
  /** Atomic read-modify-write; resolves the stored record. */
  update(request: WatchInfoUpdateRequest): Promise<unknown>;
  /** Optional for old mocks/bridges; the modern worker makes this atomic. */
  scrubWatchVideoInfo?(query: {afterKey?: string | null; maxRecords?: number}): Promise<{
    scanned: number; changed: number; nextKey: string | null;
  }>;
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
  listSavedPoints():Promise<SavedPointProjection[]>;
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
  listSavedPoints():Promise<SavedPointProjection[]>;
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

  // #255: Only public display metadata belongs in persistent watch history.
  // Never enumerate model getters via toJSON(): that pulls in csrfToken,
  // watchAuthKey, DMC signatures and Domand access-right keys.
  const snapshotPublicVideoInfo = (value: WatchVideoInfoLike): Record<string, unknown> => {
    const source = value as unknown as Record<string, unknown>;
    const data: Record<string, unknown> = {};
    const scalars = [
      'videoId', 'watchId', 'contextWatchId', 'originalVideoId',
      'title', 'postedAt', 'thumbnail', 'betterThumbnail',
      'duration', 'threadId', 'description', 'watchUrl'
    ] as const;
    for (const key of scalars) {
      try {
        const v = source[key];
        if (typeof v === 'string' || typeof v === 'boolean' ||
            (typeof v === 'number' && Number.isFinite(v))) {
          data[key] = v;
        }
      } catch (_) { /* A broken metadata getter is not a reason to fail history. */ }
    }
    try {
      const count = source.count as Record<string, unknown> | null;
      if (count && typeof count === 'object') {
        const publicCounts: Record<string, number> = {};
        for (const key of ['comment', 'mylist', 'view', 'like'] as const) {
          if (typeof count[key] === 'number' && Number.isFinite(count[key])) {
            publicCounts[key] = count[key] as number;
          }
        }
        data.count = publicCounts;
      }
    } catch (_) {}
    try {
      const owner = source.owner as Record<string, unknown> | null;
      if (owner && typeof owner === 'object') {
        const publicOwner: Record<string, string | number> = {};
        for (const key of ['type', 'url', 'icon', 'id', 'linkId', 'name'] as const) {
          const v = owner[key];
          if (typeof v === 'string' ||
              (typeof v === 'number' && Number.isFinite(v))) {
            publicOwner[key] = v;
          }
        }
        data.owner = publicOwner;
      }
    } catch (_) {}
    try {
      const genre = source.genre as Record<string, unknown> | null;
      if (genre && typeof genre === 'object') {
        const key = typeof genre.key === 'string' ? genre.key : '';
        const label = typeof genre.label === 'string' ? genre.label : '';
        data.genre = {key, label};
      }
    } catch (_) {}
    return data;
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
  // #286: Legacy cache rows predate the public videoInfo allowlist. Scrub in
  // small, transactionally isolated batches without delaying watch playback.
  // Other row fields (resume, comments, bookmarks and updatedAt) are untouched.
  let legacyScrubStarted = false;
  const scheduleLegacyScrub = (store: WatchInfoIdbStore): void => {
    if (legacyScrubStarted || typeof store.scrubWatchVideoInfo !== 'function') { return; }
    legacyScrubStarted = true;
    const scan = async (): Promise<void> => {
      let afterKey: string | null = null;
      while (true) {
        const page = await (store.scrubWatchVideoInfo as NonNullable<WatchInfoIdbStore['scrubWatchVideoInfo']>)({
          afterKey, maxRecords: 64
        });
        if (!page || !Number.isSafeInteger(page.scanned) ||
            !Number.isSafeInteger(page.changed) || page.changed > page.scanned ||
            (page.nextKey !== null &&
              (typeof page.nextKey !== 'string' || !page.nextKey ||
               (afterKey !== null && page.nextKey <= afterKey)))) {
          throw new Error('Invalid legacy watch-info cleanup cursor');
        }
        if (page.nextKey === null) { return; }
        afterKey = page.nextKey;
        // Yield so playback/resume and other tabs are not blocked by migration.
        await new Promise<void>(resolve => setTimeout(resolve, 0));
      }
    };
    const start = (): void => {
      void scan().catch(() => {
        // No saved videoInfo/watchId/token or exception payload may reach logs.
        console.warn('Legacy watch history cleanup incomplete; retrying');
        void new Promise<void>(resolve => setTimeout(resolve, 300))
          .then(scan).catch(() => { console.warn('Legacy watch history cleanup incomplete'); });
      });
    };
    setTimeout(start, 0);
  };

  const createInstance = async (): Promise<WatchInfoCache> => {
    await initWorker();
    const cacheDb = (db as WatchInfoDb)['cache'] as WatchInfoIdbStore;
    scheduleLegacyScrub(cacheDb);
    return instance = {
      listSavedPoints,
      async put(watchId: string, options: WatchInfoPutOptions = {}): Promise<WatchInfoRecord> {
        /** @type {VideoInfoModel|null} */
        const videoInfo = options.videoInfo || null;
        const videoInfoRawData = videoInfo ? snapshotPublicVideoInfo(videoInfo) : null;
        const now = Date.now();
        const patch: Record<string, unknown> = {watchId, updatedAt: now};
        const ownerId = videoInfo?.owner?.linkId || '';
        if (ownerId) { patch.ownerId = ownerId; }
        if (videoInfoRawData) { patch.videoInfo = videoInfoRawData; }
        for (const key of ['threadInfo', 'heatMap', 'config'] as const) {
          if (options[key]) { patch[key] = options[key]; }
        }
        const explicit=options.explicitResume===true;
        // Viewing time is separate from cache access, edits, comments and metadata.
        if(options.watchCount===1||(!explicit&&Number.isFinite(options.currentTime)&&
           (options.currentTime as number)>=0))patch.viewedAt=now;
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
  // Use initWorker directly: enumeration must not touch access timestamps or
  // start the write-only legacy scrub performed by open().
  const listSavedPoints=async():Promise<SavedPointProjection[]>=>{
    const cache=(await initWorker()).cache;
    if(!cache||typeof cache.listSavedPoints!=='function')throw new Error('Saved points enumeration unavailable');
    const items:SavedPointProjection[]=[];
    let afterKey:string|null=null;
    do{
      const page:SavedPointsPage=await cache.listSavedPoints({afterKey,maxRecords:200});
      if(!page||!Array.isArray(page.items)||
         (page.nextKey!==null&&(typeof page.nextKey!=='string'||!page.nextKey||
          (afterKey!==null&&page.nextKey<=afterKey)))){
        throw new Error('Invalid saved points page');
      }
      for(const item of page.items){
        if(!item||typeof item.watchId!=='string'||!item.watchId)continue;
        items.push({watchId:item.watchId,title:item.title,duration:item.duration,
          updatedAt:item.updatedAt,automaticTime:item.automaticTime,
          ...(item.thumbnailUrl!==undefined?{thumbnailUrl:item.thumbnailUrl}:{}),
          ...(item.viewedAt!==undefined?{viewedAt:item.viewedAt}:{})});
      }
      afterKey=page.nextKey;
    }while(afterKey!==null);
    return items;
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

  return {initWorker, open, listSavedPoints, put, putBestEffort, clearAutomaticResume, get, delete: del, close, gc, api};
})();

export {WatchInfoCacheDb};
