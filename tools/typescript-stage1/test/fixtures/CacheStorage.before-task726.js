import {textUtil} from '../text/textUtil';
import {netUtil} from './netUtil';

const PRODUCT = 'TEST';
const _ = window._;
//===BEGIN===

const CacheStorage = (() => {
  const PREFIX = `${PRODUCT}_cache_`;

  class CacheStorage {
    constructor(storage) {
      this._storage = storage;
      this.gc = _.debounce(this.gc.bind(this), 100);
    }

    _readItem(key) {
      let item;
      try {
        item = JSON.parse(this._storage[key]);
      } catch (e) {
        this._storage.removeItem(key);
        return null;
      }
      if (!item || typeof item !== 'object' || Array.isArray(item) ||
          !Object.prototype.hasOwnProperty.call(item, 'data') ||
          !(item.expiredAt === '' ||
            (typeof item.expiredAt === 'number' && Number.isFinite(item.expiredAt)))) {
        this._storage.removeItem(key);
        return null;
      }
      return item;
    }

    gc(now = NaN) {
      const storage = this._storage;
      now = isNaN(now) ? Date.now() : now;
      Object.keys(storage).forEach(key => {
        if (key.indexOf(PREFIX) !== 0) { return; }
        const item = this._readItem(key);
        if (!item || item.expiredAt === '' || item.expiredAt > now) { return; }
        storage.removeItem(key);
      });
    }

    setItem(key, data, expireTime) {
      key = PREFIX + key;
      const expiredAt =
        typeof expireTime === 'number' ? (Date.now() + expireTime) : '';

      const cacheData = {
        data: data,
        type: typeof data,
        expiredAt: expiredAt
      };

      let serialized;
      try {
        serialized = JSON.stringify(cacheData);
        this._storage[key] = serialized;
        this.gc();
      } catch (e) {
        if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
          try {
            // Emergency cleanup must complete before retrying; this.gc is debounced.
            this.gc.cancel();
            CacheStorage.prototype.gc.call(this);
            this._storage[key] = serialized;
            this.gc();
          } catch (retryError) {
            // Cache writes have always been best effort; retry only once.
          }
        }
      }
    }

    getItem(key) {
      key = PREFIX + key;
      if (!(this._storage.hasOwnProperty(key) || this._storage[key] !== undefined)) {
        return null;
      }
      const item = this._readItem(key);
      if (!item) { return null; }

      if (item.expiredAt === '' || item.expiredAt > Date.now()) {
        return item.data;
      }
      return null;
    }

    removeItem(key) {
      key = PREFIX + key;
      if (this._storage.hasOwnProperty(key) || this._storage[key] !== undefined) {
        this._storage.removeItem(key);
      }
    }

    clear() {
      const storage = this._storage;
      Object.keys(storage).forEach(v => {
        if (v.indexOf(PREFIX) === 0) {
          storage.removeItem(v);
        }
      });
    }
  }

  return CacheStorage;
})();


//===END===

export {CacheStorage};