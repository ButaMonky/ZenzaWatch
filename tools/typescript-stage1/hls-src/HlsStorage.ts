/** Extracted HLS implementation (Task997); preserve legacy playback/cache behavior. */
// Internal browser/hls.js compatibility records remain loose during extraction.
type Loose = any;

export interface HlsConfigAccess {
  get(key: string): Loose;
  on(name: string, listener: (...args: Loose[]) => void): unknown;
}
export interface HlsCancelableCallback {
  (...args: Loose[]): Loose;
  cancel(): void;
}
export type HlsDebounce = (callback: (...args: Loose[]) => Loose, interval?: number) => HlsCancelableCallback;
export interface HlsStorageClient {
  setConfig(config: Record<string, unknown>): Promise<unknown>;
  save(data: {hash: string; videoId?: string; meta?: Loose}, buffer?: ArrayBuffer): Promise<unknown>;
  load(data: {hash: string}): Promise<Loose>;
  hasData(data: {hash: string}): Promise<boolean>;
  touch(data: {hash: string}): Promise<unknown>;
  gc(): unknown;
  clear(): Promise<unknown>;
}
export function createHlsStorage(Config: HlsConfigAccess, debounce: HlsDebounce): HlsStorageClient {
  const window = globalThis.window as Loose;
  const console = window.console;
    const StorageWorker = function(self?: Loose) {
      const Config = {
        cache_expire_time: 6 * 60 * 60 * 1000
      };

      class IndexDBStorage {
        declare static _opening: Loose;
        declare static db: Loose;
        declare static _instance: Loose;
        declare _instance: Loose;
        declare _opening: Loose;
        declare db: Loose;
        declare isBusy: Loose;
        static get name() { return 'zenza_hls'; }
        static get ver() { return 5; }
        static get storeNames() { return ['ts-data']; }

        static get expireTime() {
          return Config.cache_expire_time;
        }

        static getInstance() {
          if (this._instance) {
            return this._instance;
          }
          this._instance = new this();
          return this._instance;
        }

        static async init() {
          if (this.db) {
            return Promise.resolve(this.db);
          }
          if (this._opening) { return this._opening; }
          // Task516/931: share a pending IDB open between simultaneous cache requests.
          const pending = new Promise((resolve, reject) => {
            const req = indexedDB.open(this.name, this.ver);
            let abandoned = false;
            req.onblocked = () => {
              abandoned = true;
              reject(new Error('HLS cache upgrade blocked'));
            };
            req.onupgradeneeded = e => {
              const db = (e.target as Loose).result;

              const [meta] = this.storeNames;
              // 修正前はdb.objectStoreNames.contains(this.name)（データベース名
              // 'zenza_hls'）を見ていたが、実際に作成しているストア名は'ts-data'
              // （this.storeNames[0]）であり、データベース名と一致することはない。
              // そのためverを上げてもこの分岐が発火せず、次のcreateObjectStoreで
              // 既存ストアと衝突してConstraintErrorになりうる不具合があった。
              if (db.objectStoreNames.contains(meta)) {
                db.deleteObjectStore(meta);
              }

              const store = db.createObjectStore(meta,
                {keyPath: 'hash', autoIncrement: false});
              store.createIndex('hash', 'hash', {unique: true});
              store.createIndex('expiresAt', 'expiresAt', {unique: false});
              store.createIndex('videoId', 'videoId', {unique: false});
            };

            req.onsuccess = e => {
              const db = (e.target as Loose).result;
              if (abandoned) { db.close(); return; }
              db.onversionchange = () => {
                db.close();
                if (this.db === db) { this.db = null; }
              };
              this.db = db;
              resolve(db);
            };

            req.onerror = reject;

          });
          this._opening = pending;
          try { return await pending; }
          finally {
            // Failed opens must permit a new attempt; do not cache rejections.
            if (this._opening === pending) { this._opening = null; }
          }
        }

        static close() {
          if (!this.db) {
            return;
          }
          this.db.close();
          this.db = null;
        }

        async getStore({mode} = {mode: 'readwrite'}) {
          const db = await (this.constructor as Loose).init();
          const [data] = (this.constructor as Loose).storeNames;
          const transaction = db.transaction((this.constructor as Loose).storeNames, mode);
          return {transaction, store: transaction.objectStore(data)};
        }

        putRecord(store?: Loose, record?: Loose) {
          return new Promise((resolve, reject) => {
            const req = store.put(record);
            req.onsuccess = (e?: Loose) => {
              resolve(e.target.result);
            };
            req.onerror = reject;
          });
        }

        getRecord(store: Loose, key: Loose, {index, timeout}: Loose) {
          return new Promise((resolve, reject) => {
            const req =
              index ?
                store.index(index).get(key) : store.get(key);
            let timeoutId: Loose;
            req.onsuccess = (e?: Loose) => {
              if (timeoutId !== undefined) { clearTimeout(timeoutId); }
              resolve(e.target.result);
            };
            req.onerror = (e?: Loose) => {
              if (timeoutId !== undefined) { clearTimeout(timeoutId); }
              reject(e);
            };
            if (timeout) {
              timeoutId = setTimeout(() => reject(`timeout: key${key}`), timeout);
            }
          });
        }

        getCount(store: Loose, key: Loose, {index, timeout}: Loose) {
          return new Promise((resolve, reject) => {
            const req =
              index ?
                store.index(index).count(key) : store.count(key);
            let timeoutId: Loose;
            req.onsuccess = (e?: Loose) => {
              if (timeoutId !== undefined) { clearTimeout(timeoutId); }
              resolve(req.result);
            };
            // 修正前は`err => resolve`で、resolve関数自体を返すだけでresolveを
            // 呼び出しておらず、IndexedDBのエラー時にPromiseが確定しないまま
            // 残っていた（timeout指定時はフォールバックのsetTimeoutで最終的に
            // rejectされるが、無駄に待たされていた。timeout未指定の呼び出し方が
            // あった場合は永久にpendingのままになる）。
            req.onerror = (e?: Loose) => {
              if (timeoutId !== undefined) { clearTimeout(timeoutId); }
              reject(e);
            };
            if (timeout) {
              timeoutId = setTimeout(() => reject(`timeout: key${key}`), timeout);
            }
          });
        }

        deleteRecord(store: Loose, key: Loose, {index}: Loose) {
          return new Promise((resolve, reject) => {
            let deleted = 0;
            const range = IDBKeyRange.only(key);
            const req =
              index ?
                store.index(index).openCursor(range) : store.openCursor(range);
            req.onsuccess = (e?: Loose) =>  {
              const result = e.target.result;
              if (!result) {
                return resolve(deleted > 0);
              }
              result.delete();
              deleted++;
              result.continue();
            };
            req.onerror = reject;
          });
        }

        async load({hash}: Loose) {
          try {
            const {store} =
              await this.getStore({mode: 'readonly'});
            const meta = await this.getRecord(store, hash,
              {index: 'hash', timeout: 3000});
            // this.constructor.close();
            if (!meta) {
              return null;
            }
            return meta;
          } catch(e) {
            console.warn('exeption', e);
            return null;
          }
        }

        async hasData({hash}: Loose) {
          try {
            const {store} = await this.getStore({mode: 'readonly'});
            return 0 < (await this.getCount(store, hash, {index: 'hash', timeout: 3000}) as Loose);
          } catch(e) {
            console.warn('exeption', e);
            return false;
          }
        }

        async save({hash, videoId, meta}: Loose, buffer?: Loose) {
          const now = Date.now();
          const expiresAt = now + (this.constructor as Loose).expireTime;
          const record = {
            expiresAt,
            hash,
            videoId,
            expireDate: new Date(expiresAt).toLocaleString(),
            meta,
            updatedAt: now,
            buffer
          };
          // console.log('save', record);
          const {transaction, store} = await this.getStore();
          return new Promise((resolve) => {
            let request: Loose;
            // Request success may still be rolled back by a transaction abort.
            transaction.oncomplete = () => {
              (this.constructor as Loose).close();
              resolve(request.result);
            };
            transaction.onabort = () => {
              console.error('HLS cache save failed');
              resolve(false);
            };
            try {
              request = store.put(record);
              // A hash-keyed put atomically replaces only this fragment.
              transaction.commit && transaction.commit();
            } catch (e) {
              transaction.abort();
              resolve(false);
            }
          });
        }

        async gc() {
          if (this.isBusy) {
            return;
          }
          const now = Date.now();
          const {store, transaction} = await this.getStore();
          this.isBusy = true;
          const timekey = `storage gc:${new Date().toLocaleString()}`;
          console.time(timekey);
          return new Promise<void>((resolve, reject) => {
            transaction.oncomplete = () => {
              this.isBusy = false;
              (this.constructor as Loose).close();
              console.timeEnd(timekey);
              resolve();
            };
            transaction.onabort = () => reject(transaction.error || new Error('HLS cache collection aborted'));
            const range = IDBKeyRange.upperBound(now);
            const req = store.index('expiresAt').openCursor(range);
            req.onsuccess = (e?: Loose) => {
              const cursor = e.target.result;
              if (cursor) {
                cursor.delete();
                cursor.continue();
              } else {
                transaction.commit && transaction.commit();
              }
            };
            req.onerror = (e?: Loose) => {
              reject(e);
              this.isBusy = false;
            };
          }).catch((e) => {
            this.isBusy = false;
            console.error('gc fail', e);
            throw e;
          });
        }

        async touch({hash}: Loose) {
          const {store, transaction} = await this.getStore();
          return new Promise((resolve, reject) => {
            let found = false;
            transaction.oncomplete = () => resolve(found);
            transaction.onabort = () => reject(new Error('HLS cache touch aborted'));
            transaction.onerror = () => reject(new Error('HLS cache touch failed'));
            const request = store.openCursor(hash);
            request.onsuccess = () => {
              const cursor = request.result;
              if (!cursor) { return; }
              const record = cursor.value;
              const now = Date.now();
              record.updatedAt = now;
              record.expiresAt = now + (this.constructor as Loose).expireTime;
              record.expireDate = new Date(record.expiresAt).toLocaleString();
              cursor.update(record);
              found = true;
            };
          });
        }

        async clear() {
          const {store, transaction} = await this.getStore();
          return new Promise<void>((resolve, reject) => {
            transaction.oncomplete = () => resolve();
            transaction.onabort = () => reject(new Error('HLS cache clear aborted'));
            transaction.onerror = () => reject(new Error('HLS cache clear failed'));
            try { store.clear(); }
            catch (_) { transaction.abort(); reject(new Error('HLS cache clear failed')); }
          });
        }
      }

      const Storage = {
        async save({hash, videoId, meta}: Loose, buffer?: Loose) {
          return IndexDBStorage.getInstance().save({hash, videoId, meta}, buffer);
        },
        async load(...args: Loose[]) {
          try {
            const result = await IndexDBStorage.getInstance().load(...args);
            // console.log('Storage load result', result);
            if (!result) {
              return null;
            }
            const buffer = result.buffer;
            return {meta: result.meta, buffer};
          } catch(e) {
            console.warn('Storage load fail', e);
            return null;
          }
        },
        async hasData(...args: Loose[]) {
          const result = await IndexDBStorage.getInstance().hasData(...args);
          return {result};
        },
        async gc() {
          if (navigator && navigator.locks) {
            return await navigator.locks.request('ZenzaHLS_GC', {ifAvailable: true}, async lock => {
              if (!lock) {
                return;
              }
              await IndexDBStorage.getInstance().gc();
              await new Promise(r => setTimeout(r, 5000));
            });
          } else {
            return IndexDBStorage.getInstance().gc();
          }
        },
        async touch(data?: Loose) {
          return IndexDBStorage.getInstance().touch(data);
        },
        async clear() {
          return IndexDBStorage.getInstance().clear();
        }
      };

      self.onmessage = async (e?: Loose) => {
        let result;
        const data = e.data.data;
        const id = e.data.id;
        let status = 'ok';
        try {
          switch (e.data.command) {
            case 'config':
              Object.assign(Config, data);
              return self.postMessage({id, result: 'ok'});
            case 'save':
              // let {hash, videoId, meta} = data;
              result = await Storage.save(data, e.data.buffer);
              return self.postMessage({id, result});
            case 'load':
              result = await Storage.load(data);
              if (!result) {
                return self.postMessage({id, status, result: null}, []);
              }
              return self.postMessage({id, status, result: result.meta, buffer: result.buffer}, [result.buffer]);
            case 'hasData':
                result = await Storage.hasData(data);
                if (!result) {
                  return self.postMessage({id, status, result: false});
                }
                return self.postMessage({id, status, result});
              case 'gc':
              await Storage.gc();
              return self.postMessage({id, status, result: null});
            case 'touch':
              result = await Storage.touch(data);
              return self.postMessage({id, status, result});
            case 'clear':
              result = await Storage.clear();
              return self.postMessage({id, status, result});
          }
        } catch (err) {
          status = 'fail';
          return self.postMessage({id, status, result: 'HLS cache operation failed'});
        }
      };
    };

    const createWebWorker = (func?: Loose, {type, name}: Loose = {}) => {
      const src = func.toString().replace(/^function.*?{/, '').replace(/}$/, '');

      const blob = new Blob([src], {type: 'text/javascript'});
      const url = URL.createObjectURL(blob);

      try {
        if (type === 'SharedWorker') { return new SharedWorker(url, {name}); }
        return new Worker(url, {name});
      } finally { URL.revokeObjectURL(url); }
    };

    const Storage = {
      request: {},
      worker: (null as Loose),
      onMessage(e?: Loose) {
        const id = e.data.id;
        const request = (this.request as Loose)[id];
        if (!request) {
          window.console.warn('unkwnown request id', id);
          return;
        }
        delete (this.request as Loose)[id];
        clearTimeout(request.timer);
        if (e.data.status === 'fail') {
          return request.reject(new Error('HLS cache worker request failed'));
        }
        switch (request.command) {
          case 'load':
            if (e.data.result) {
              return request.resolve([e.data.result, e.data.buffer]);
            } else {
              return request.resolve([null, null]);
            }
          default:
            return request.resolve(e.data.result);
        }
      },
      restartCount: 0,
      generation: 0,
      ready: (null as Loose),
      startWorker() {
        const generation = ++this.generation;
        this.worker = createWebWorker(StorageWorker, {name: 'ZenzaWatchHLSWorker'});
        (this as Loose).failed = false;
        this.worker.addEventListener('message', (e: Loose) => {
          if (generation === this.generation) { this.onMessage(e); }
        });
        const failed = () => { if (generation === this.generation) { this.onError(); } };
        this.worker.addEventListener('error', failed);
        this.worker.addEventListener('messageerror', failed);
      },
      async recover() {
        if (this.ready) { return this.ready; }
        if (this.restartCount >= 2) { throw new Error('HLS cache worker unavailable'); }
        this.restartCount++;
        const pending = (async () => {
          try {
            this.startWorker();
            await this.sendRequest('config', {cache_expire_time: Config.get('cache_expire_time')}, null, true);
          } catch (_) {
            this.onError();
            throw new Error('HLS cache worker unavailable');
          }
        })();
        this.ready = pending;
        try { await pending; }
        finally { if (this.ready === pending) { this.ready = null; } }
      },
      onError() {
        ++this.generation;
        if (this.worker && typeof this.worker.terminate === 'function') { this.worker.terminate(); }
        (this as Loose).failed = true;
        for (const [id, request] of Object.entries(this.request)) {
          delete (this.request as Loose)[id];
          clearTimeout((request as Loose).timer);
          (request as Loose).reject(new Error('HLS cache worker unavailable'));
        }
      },
      getId() {
        return `id:${Math.random()}-${performance.now()}`;
      },
      async sendRequest(command?: Loose, data?: Loose, buffer: Loose = null, initializing = false): Promise<Loose> {
        if (window.Prototype) { return null; }
        if (!initializing) {
          if (this.ready) { await this.ready; }
          if ((this as Loose).failed) { await this.recover(); }
        }
        if ((this as Loose).failed) { throw new Error('HLS cache worker unavailable'); }
        const id = this.getId();
        // window.console.info('sendrequest', command, data, buffer);
        return new Promise((resolve, reject) => {
          const fail = (error?: Loose) => {
            const request = (this.request as Loose)[id];
            if (!request) { return; }
            delete (this.request as Loose)[id];
            clearTimeout(request.timer);
            reject(error);
          };
          const timer = setTimeout(() => fail(new Error('HLS cache request timeout')), 10000);
          (this.request as Loose)[id] = {id, command, resolve, reject, timer};
          try {
            if (buffer) {
              this.worker.postMessage({id, command, data, buffer}, [buffer]);
            } else {
              this.worker.postMessage({id, command, data});
            }
          } catch (error) { fail(error); }
        });
      },
      async setConfig(config?: Loose) {
        return this.sendRequest('config', config);
      },
      async save({hash, videoId, meta}: Loose, buffer?: Loose) {
        return this.sendRequest('save', {hash, videoId, meta}, buffer);
      },
      async load({hash}: Loose) {
        return await this.sendRequest('load', {hash});
      },
      async hasData({hash}: Loose) {
        const result = await this.sendRequest('hasData', {hash});
        return result === true || !!(result && result.result === true);
      },
      async gc() {
        if (Config.get('enable_db_cache') && !window.Prototype) {
          return this.sendRequest('gc', {});
        } else {
          return Promise.resolve();
        }
      },
      async touch(data?: Loose) { return this.sendRequest('touch', data); },
      async clear() {
        return this.sendRequest('clear', {});
      }
    };
    try {
      Storage.worker = null;
      Storage.startWorker();
    } catch (error) { Storage.onError(); }
    Storage.setConfig({cache_expire_time: Config.get('cache_expire_time')})
      .catch(() => console.warn('HLS cache configuration failed'));
    Config.on('update-cache_expire_time', (value: Loose) => {
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) { return; }
      Storage.setConfig({cache_expire_time: value})
        .catch(() => console.warn('HLS cache configuration failed'));
    });
    const runStorageGc = Storage.gc.bind(Storage);
    Storage.gc = (debounce(() => runStorageGc()
      .catch(() => console.warn('HLS cache maintenance failed')), 10 * 1000) as Loose);


  return Storage;
}
