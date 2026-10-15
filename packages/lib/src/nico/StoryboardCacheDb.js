import {IndexedDbStorage} from '../infra/IndexedDbStorage';
import {NicoVideoApi} from './loader';

//===BEGIN===
const StoryboardCacheDb = (() => {
  const WATCH_INFO = {
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

  let db, instance, NicoVideoApi;
  let dbOpening, instanceOpening;
  const initWorker = async () => {
    if (db) { return db; }
    if (dbOpening) { return dbOpening; }
    // Share an in-flight IndexedDB/bridge open across simultaneous callers.
    // Rejected attempts must be cleared so a later request can retry.
    dbOpening = (async () => {
      const connection = location.host === 'www.nicovideo.jp' ?
        await IndexedDbStorage.open(WATCH_INFO) :
        await NicoVideoApi.bridgeDb(WATCH_INFO);
      db = connection;
      return connection;
    })();
    try { return await dbOpening; }
    finally { dbOpening = null; }
  };

  const open = async () => {
    if (instance) { return instance; }
    if (instanceOpening) { return instanceOpening; }
    // Initialize the facade once, and schedule the initial GC only once.
    instanceOpening = (async () => {
      await initWorker();
      const cacheDb = db['cache'];
      instance = {
        async put(watchId, sbInfo = {}) {
          if (!sbInfo || typeof sbInfo !== 'object' || sbInfo.status !== 'ok') {
            console.warn('Storyboard cache rejected non-ok payload');
            return;
          }
          const record = {
            watchId,
            updatedAt: Date.now(),
            sbInfo
          };
          await cacheDb.put(record);
          return record;
        },
        async get(watchId) {
          const record = await cacheDb.updateTime({key: watchId});
          if (!record) { return null; }
          return record.sbInfo;
        },
        delete(watchId) { return cacheDb.delete({key: watchId}); },
        close() { return cacheDb.close(); },
        gc(expireTime) { return cacheDb.gc(expireTime); }
      };
      instance.gc(7 * 24 * 60 * 60 * 1000).catch(() => console.warn('Storyboard cache cleanup failed'));
      return instance;
    })();
    try { return await instanceOpening; }
    finally { instanceOpening = null; }
  };
  const put = (watchId, sbInfo = {}) => open().then(db => db.put(watchId, sbInfo));
  const get = watchId => open().then(db => db.get(watchId));
  const del = watchId => open().then(db => db.delete(watchId));
  const close = () => open().then(db => db.close());
  const gc = (expireTime = 24 * 60 * 60 * 1000) => open().then(db => db.gc(expireTime));
  const api = api => NicoVideoApi = api;

  return {initWorker, open, put, get, delete: del, close, gc, db, api};
})();
//===END===
export {StoryboardCacheDb};