/**
 * Canonical TypeScript source for packages/lib/src/nico/ThumbInfoCacheDb.js (Task646).
 * IndexedDB cache of getthumbinfo responses (raw XML + parsed thumbInfo), keyed
 * by watchId. Used by the ext.nicovideo.jp thumbInfo gate (GateAPI / MylistPocket).
 */
import type {ThumbInfoResult, ThumbInfoData} from './parseThumbInfo';

/** IndexedDbStorage store as used here (packages/lib/src/infra/IndexedDbStorage.js). */
export interface ThumbInfoIdbStore {
  put(record: ThumbInfoCacheRecord): Promise<unknown>;
  /** Touches updatedAt and resolves the stored record (or a falsy value). */
  updateTime(query: {key: string}): Promise<unknown>;
  delete(query: {key: string}): Promise<unknown>;
  close(): Promise<unknown>;
  gc(expireTime: number): Promise<unknown>;
}
export interface ThumbInfoDbDefinition {
  name: string;
  ver: number;
  stores: Array<{
    name: string;
    indexes: Array<{name: string; keyPath: string; params: {unique: boolean}}>;
    definition: {keyPath: string; autoIncrement: boolean};
  }>;
}
declare const IndexedDbStorage: {open(definition: ThumbInfoDbDefinition): Promise<Record<string, ThumbInfoIdbStore>>};
declare const parseThumbInfo: (xmlText: string) => ThumbInfoResult;

export interface ThumbInfoCacheRecord {
  watchId: string;
  videoId: string;
  postedAt: number;
  updatedAt: number;
  xml: string;
  thumbInfo: ThumbInfoData;
}
export interface ThumbInfoCache {
  /** Stores an ok thumbInfo (parsed from `xml` when not given); resolves undefined otherwise. */
  put(xml: string, thumbInfo?: ThumbInfoResult | null): Promise<{watchId: string; updatedAt: number} | undefined>;
  /** Resolves the stored record (unvalidated) or a falsy value. */
  get(watchId: string): Promise<unknown>;
  delete(watchId: string): Promise<unknown>;
  close(): Promise<unknown>;
}
export interface ThumbInfoCacheDbClient {
  open(): Promise<ThumbInfoCache>;
}

const ThumbInfoCacheDb: ThumbInfoCacheDbClient = (() => {
  const THUMB_INFO: ThumbInfoDbDefinition = {
    name: 'thumb-info',
    ver: 1,
    stores: [
      {
        name: 'cache',
        indexes: [
          {name: 'postedAt', keyPath: 'postedAt', params: {unique: false}},
          {name: 'updatedAt', keyPath: 'updatedAt', params: {unique: false}}
        ],
        definition: {keyPath: 'watchId', autoIncrement: false}
      }
    ]
  };

  let db: Record<string, ThumbInfoIdbStore> | undefined;
  const open = async (): Promise<ThumbInfoCache> => {
    db = db || await IndexedDbStorage.open(THUMB_INFO);
    const cacheDb = db['cache'] as ThumbInfoIdbStore;
    cacheDb.gc(90 * 24 * 60 * 60 * 1000).catch(() => console.warn('Thumbnail cache cleanup failed'));
    return {
      put: async (xml: string, thumbInfo: ThumbInfoResult | null = null): Promise<{watchId: string; updatedAt: number} | undefined> => {
        thumbInfo = thumbInfo || parseThumbInfo(xml);
        if (thumbInfo.status !== 'ok') {
          return;
        }
        const watchId = thumbInfo.v;
        const videoId = thumbInfo.id;
        const postedAt = new Date(thumbInfo.postedAt).getTime();
        const updatedAt = Date.now();
        const record: ThumbInfoCacheRecord = {
          watchId,
          videoId,
          postedAt,
          updatedAt,
          xml,
          thumbInfo
        };
        await cacheDb.put(record);
        return {watchId, updatedAt};
      },
      get: (watchId: string): Promise<unknown> => cacheDb.updateTime({key: watchId}),
      delete: (watchId: string): Promise<unknown> => cacheDb.delete({key: watchId}),
      close: (): Promise<unknown> => cacheDb.close()
    };
  };

  return {open};
})();

export {ThumbInfoCacheDb};
