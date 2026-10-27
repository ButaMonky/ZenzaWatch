import {IndexedDbStorage} from '../infra/IndexedDbStorage';
import {VideoInfoModel} from '../../../../src/VideoInfo';

//===BEGIN===
const WatchInfoCacheDb = (() => {
  const WATCH_INFO = {
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

  let db, instance, NicoVideoApi;
  const initWorker = async () => {
    if (db) { return db; }
    if (location.host === 'www.nicovideo.jp') {
      db = db || await IndexedDbStorage.open(WATCH_INFO);
    } else {
      db = db || await NicoVideoApi.bridgeDb(WATCH_INFO);
    }
    return db;
  };

  const open = async () => {
    if (instance) { return instance; }
    await initWorker();
    const cacheDb = db['cache'];
    return instance = {
      async put(watchId, options = {}) {
        /** @type {VideoInfoModel|null} */
        const videoInfo = options.videoInfo || null;
        const videoInfoRawData = (videoInfo && videoInfo.toJSON) ? videoInfo.toJSON() : videoInfo;
        const now = Date.now();
        const patch = {watchId, updatedAt: now};
        const ownerId = videoInfo?.owner?.linkId || '';
        if (ownerId) { patch.ownerId = ownerId; }
        if (videoInfoRawData) { patch.videoInfo = videoInfoRawData; }
        for (const key of ['threadInfo', 'heatMap', 'config']) {
          if (options[key]) { patch[key] = options[key]; }
        }
        const resume = Number.isFinite(options.currentTime) && options.currentTime > 0 ?
          [{now, time: options.currentTime}] : [];
        const record = await cacheDb.update({
          key: watchId, patch,
          defaults: {
            videoId: (videoInfo ? videoInfo.videoId : watchId) || '',
            threadId: (videoInfo ? videoInfo.threadId * 1 : 0) || '',
            ownerId, postedAt: videoInfo ? new Date(videoInfo.postedAt).getTime() : 0,
            threadInfo: 0, heatMap: null, config: ''
          },
          increment: {watchCount: options.watchCount === 1 ? 1 : 0},
          prepend: {resume}, append: {comment: options.comment ? [options.comment] : []},
          limits: {resume: 10}
        });
        if (!record || typeof record !== 'object' || record.watchId !== watchId) {
          throw new Error('Watch history update was not acknowledged');
        }
        return record;
      },
      get(watchId) { return cacheDb.updateTime({key: watchId}); },
      delete(watchId) { return cacheDb.delete({key: watchId}); },
      close() { return cacheDb.close(); },
      gc(expireTime) { return cacheDb.gc(expireTime); }
    };
  };
  const put = (watchId, options = {}) => open().then(db => db.put(watchId, options));
  // Playback callers deliberately keep persistence best effort; explicit put still rejects.
  const putBestEffort = (watchId, options = {}) => put(watchId, options)
    .catch(() => { console.warn('Watch info cache write failed'); });
  const get = watchId => open().then(db => db.get(watchId));
  const del = watchId => open().then(db => db.delete(watchId));
  const close = () => open().then(db => db.close());
  const gc = (expireTime) => open().then(db => db.gc(expireTime));
  const api = api => NicoVideoApi = api;

  return {initWorker, open, put, putBestEffort, get, delete: del, close, gc, api};
})();
//===END===
export {WatchInfoCacheDb};