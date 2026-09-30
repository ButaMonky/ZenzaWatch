import {workerUtil} from './workerUtil';
//===BEGIN===
const IndexedDbStorage = (() => {
  const workerFunc = function(self) {
    const db = {};
    const initializing = new Map();

    const controller = {
      async init({name, ver, stores}) {
        if (db[name]) {
          return Promise.resolve(db[name]);
        }
        if (initializing.has(name)) { return initializing.get(name); }
        const pending = new Promise((resolve, reject) => {
          const req = indexedDB.open(name, ver);
          req.onupgradeneeded = e => {
            try {
            const _db = e.target.result;

            for (const meta of stores) {
              if(_db.objectStoreNames.contains(meta.name)) {
                _db.deleteObjectStore(meta.name);
              }
              const store = _db.createObjectStore(meta.name, meta.definition);
              const indexes = meta.indexes || [];
              for (const idx of indexes) {
                store.createIndex(idx.name, idx.keyPath, idx.params);
              }
              store.transaction.oncomplete = () => {
                console.log('store.transaction.complete', JSON.stringify({name, ver, store: meta}));
              };
            }
            } catch (error) {
              try { req.transaction && req.transaction.abort(); } catch (abortError) {}
              reject(error);
            }
          };
          req.onsuccess = e => {
            db[name] = e.target.result;
            resolve(db[name]);
          };
          req.onerror = e => reject(req.error || e);
        });
        initializing.set(name, pending);
        try {
          return await pending;
        } finally {
          if (initializing.get(name) === pending) { initializing.delete(name); }
        }
      },
      close({name}) {
        if (!db[name]) {
          return;
        }
        db[name].close();
        db[name] = null;
      },
      async getStore({name, storeName, mode = 'readonly'}) {
        const db = await this.init({name});
        const transaction = db.transaction(storeName, mode);
        return {store: transaction.objectStore(storeName), transaction};
      },
      async _write({name, storeName}, operation) {
        const {store, transaction} = await this.getStore({name, storeName, mode: 'readwrite'});
        return new Promise((resolve, reject) => {
          let result, settled = false;
          const cleanup = () => {
            transaction.oncomplete = transaction.onabort = transaction.onerror = null;
          };
          const fail = error => {
            if (settled) { return; }
            settled = true;
            const reason = (error && error.target) ?
              (error.target.error || transaction.error || new Error('IndexedDB transaction failed')) : error;
            cleanup();
            try { transaction.abort(); } catch (abortError) {}
            reject(reason || new Error('IndexedDB transaction failed'));
          };
          transaction.oncomplete = () => {
            if (settled) { return; }
            settled = true;
            cleanup();
            resolve(result);
          };
          transaction.onabort = transaction.onerror = fail;
          try {
            operation(store, value => { result = value; }, fail);
          } catch (error) { fail(error); }
        });
      },
      async put({name, storeName, data}) {
        return this._write({name, storeName}, (store, result, fail) => {
          const req = store.put(data);
          req.onsuccess = e => result(e.target.result);
          req.onerror = fail;
        });
      },
      async get({name, storeName, data: {key, index, timeout}}) {
        const {store} = await this.getStore({name, storeName});
        // console.log('get', {name, storeName, key, index, timeout});
        return new Promise((resolve, reject) => {
          const req =
            index ?
              store.index(index).get(key) : store.get(key);
          req.onsuccess = e => resolve(e.target.result);
          req.onerror = reject;
          if (timeout) {
            setTimeout(() => {
              reject(`timeout: key${key}`);
            }, timeout);
          }
        });
      },
      // データ取得しつつupdatedAt更新
      async updateTime({name, storeName, data: {key, index, timeout}}) {
        const record = await this.get({name, storeName, data: {key, index, timeout}});
        if (!record) {
          return null;
        }
        record.updatedAt = Date.now();
        await this.put({name, storeName, data: record});
        return record;
      },
      async delete({name, storeName, data: {key, index}}) {
        return this._write({name, storeName}, (store, result, fail) => {
          let remove = 0;
          const range = IDBKeyRange.only(key);
          const req = index ? store.index(index).openCursor(range) : store.openCursor(range);
          req.onsuccess = e => {
            try {
              const cursor = e.target.result;
              if (!cursor) { result(remove > 0); return; }
              cursor.delete();
              remove++;
              cursor.continue();
            } catch (error) { fail(error); }
          };
          req.onerror = fail;
        });
      },
      async clear({name, storeName}) {
        return this._write({name, storeName}, (store, result, fail) => {
          const req = store.clear();
          req.onsuccess = () => result(undefined);
          req.onerror = fail;
        });
      },
      async gc({name, storeName, data: {expireTime, index}}) {
        index = index || 'updatedAt';
        const now = Date.now(), ptime = performance.now();
        const expiresAt = (index !== 'expiresAt') ? (now - expireTime) : now;
        let count = 0;
        return this._write({name, storeName}, (store, result, fail) => {
          const range = IDBKeyRange.upperBound(expiresAt);
          const req = store.index(index).openCursor(range);
          req.onsuccess = e => {
            try {
              const cursor = e.target.result;
              if (cursor) {
                count++;
                cursor.delete();
                cursor.continue();
              } else {
                result({status: 'ok', count, time: performance.now() - ptime});
              }
            } catch (error) { fail(error); }
          };
          req.onerror = fail;
        }).catch(e => {
          console.warn('IndexedDB cache cleanup failed');
          throw e;
        });
      }

    };

    self.onmessage = async ({command, params}) => {
      try {
      switch (command) {
        case 'init':
          await controller[command](params);
          return 'ok';
        case 'put':
          return controller.put(params);
        case 'updateTime':
        case 'get':
          return controller[command](params);
        default:
          return controller[command](params) || 'ok';
        }
      } catch (err) {
        console.warn('command failed: ', {command, params});
        throw err;
      }
    };
    return controller;
  };

  const workers = new Map;
  const open = async ({name, ver, stores}, func) => {
    let worker;
    if (func) {
      let _func = workerFunc;
      if (func) {
        _func = `
        (() => {
        const controller = (${workerFunc.toString()})(self);
        (${func.toString()})(self)
        })
        `;
      }
      worker = workers.get(func) || workerUtil.createCrossMessageWorker(_func, {name: `IndexedDb[${name}]`});
      workers.set(func, worker);
    } else {
      worker = workers.get(workerFunc) || workerUtil.createCrossMessageWorker(workerFunc, {name: 'IndexedDb'});
      workers.set(workerFunc, worker);
    }

    await worker.post({command: 'init', params: {name, ver, stores}});

    const post = (command, data, storeName, transfer) => {
      const params = {data, name, storeName, transfer};
      return worker.post({command, params}, transfer);
    };

    const result = {worker};
    for (const meta of stores) {
      const storeName = meta.name;
      result[storeName] = (storeName => {
        return {
          close: params => post('close', params, storeName),
          put: (record, transfer) => post('put', record, storeName, transfer),
          get: ({key, index, timeout}) => post('get', {key, index, timeout}, storeName),
          updateTime: ({key, index, timeout}) => post('updateTime', {key, index, timeout}, storeName),
          delete: ({key, index, timeout}) => post('delete', {key, index, timeout}, storeName),
          gc: (expireTime = 30 * 24 * 60 * 60 * 1000, index = 'updatedAt') => post('gc', {expireTime, index}, storeName)
        };
      })(storeName);
    }
    return result;
  };
  return {open};
})();


//===END===

export {IndexedDbStorage};