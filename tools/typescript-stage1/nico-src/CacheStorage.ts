/**
 * Canonical TypeScript source for packages/lib/src/infra/CacheStorage.js (Task726).
 * Expiring key/value cache on a Web Storage object. Entries live under
 * `${PRODUCT}_cache_`; broken or malformed entries are dropped on read.
 * `gc` is debounced per instance; quota errors trigger one synchronous GC + retry.
 */
declare const PRODUCT: string;
type Debounced<F extends (...args: never[]) => unknown> = F & {cancel(): void};
declare const _: {debounce<F extends (...args: never[]) => unknown>(func: F, wait: number): Debounced<F>};

/** What is stored per key. `expiredAt` is '' for entries that never expire. */
export interface CacheItem {
  data: unknown;
  type: string;
  expiredAt: number | '';
}

const CacheStorage = (() => {
  const PREFIX = `${PRODUCT}_cache_`;

  class CacheStorage {
    declare _storage: Storage;

    constructor(storage: Storage) {
      this._storage = storage;
      (this as {gc: unknown}).gc = _.debounce(this.gc.bind(this), 100);
    }

    _readItem(key: string): CacheItem | null {
      let item;
      try {
        item = JSON.parse(this._storage[key] as string) as unknown;
      } catch (e) {
        this._storage.removeItem(key);
        return null;
      }
      if (!item || typeof item !== 'object' || Array.isArray(item) ||
          !Object.prototype.hasOwnProperty.call(item, 'data') ||
          !((item as CacheItem).expiredAt === '' ||
            (typeof (item as CacheItem).expiredAt === 'number' && Number.isFinite((item as CacheItem).expiredAt)))) {
        this._storage.removeItem(key);
        return null;
      }
      return item as CacheItem;
    }

    gc(now = NaN): void {
      const storage = this._storage;
      now = isNaN(now) ? Date.now() : now;
      Object.keys(storage).forEach(key => {
        if (key.indexOf(PREFIX) !== 0) { return; }
        const item = this._readItem(key);
        if (!item || item.expiredAt === '' || item.expiredAt > now) { return; }
        storage.removeItem(key);
      });
    }

    setItem(key: string, data: unknown, expireTime?: unknown): void {
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
        if ((e as {name?: unknown}).name === 'QuotaExceededError' || (e as {name?: unknown}).name === 'NS_ERROR_DOM_QUOTA_REACHED') {
          try {
            // Emergency cleanup must complete before retrying; this.gc is debounced.
            (this.gc as Debounced<() => void>).cancel();
            CacheStorage.prototype.gc.call(this);
            this._storage[key] = serialized;
            this.gc();
          } catch (retryError) {
            // Cache writes have always been best effort; retry only once.
          }
        }
      }
    }

    getItem(key: string): unknown {
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

    removeItem(key: string): void {
      key = PREFIX + key;
      if (this._storage.hasOwnProperty(key) || this._storage[key] !== undefined) {
        this._storage.removeItem(key);
      }
    }

    clear(): void {
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

export {CacheStorage};
