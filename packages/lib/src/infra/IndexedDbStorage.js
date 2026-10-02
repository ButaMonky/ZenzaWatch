import {workerUtil} from './workerUtil';
//===BEGIN===
const IndexedDbStorage = (() => {
  const workerFunc = function(self) {
    const db = Object.create(null);
    const initializing = new Map();
    const schemas = new Map();

    const controller = {
      async init({name, ver, stores}) {
        if (db[name] && (ver === undefined || db[name].version === ver)) { return db[name]; }
        const active = initializing.get(name);
        if (active) {
          await active.promise;
          return this.init({name, ver, stores});
        }
        if (db[name]) { this.close({name}); }
        const schema = stores || schemas.get(name) || [];
        const entry = {};
        const pending = new Promise((resolve, reject) => {
          let settled = false, req;
          const fail = error => {
            if (settled) { return; }
            settled = true;
            clearTimeout(timer);
            try { req && req.transaction && req.transaction.abort(); } catch (abortError) {}
            reject(error);
          };
          const timer = setTimeout(() => fail(new Error('IndexedDB open timed out')), 30000);
          entry.cancel = () => fail(new Error('IndexedDB open cancelled'));
          try { req = indexedDB.open(name, ver); } catch (error) { fail(error); return; }
          req.onblocked = () => fail(new Error('IndexedDB upgrade blocked by another connection'));
          req.onupgradeneeded = e => {
            if (settled) { try { req.transaction.abort(); } catch (error) {} return; }
            try {
              const connection = e.target.result;
              for (const meta of schema) {
                const definition = meta.definition || {};
                const exists = connection.objectStoreNames.contains(meta.name);
                const store = exists ? req.transaction.objectStore(meta.name) :
                  connection.createObjectStore(meta.name, definition);
                if (exists && (JSON.stringify(store.keyPath) !== JSON.stringify(definition.keyPath ?? null) ||
                    store.autoIncrement !== !!definition.autoIncrement)) {
                  throw new Error('IndexedDB store migration requires an explicit data migration');
                }
                for (const idx of meta.indexes || []) {
                  if (store.indexNames.contains(idx.name)) {
                    const current = store.index(idx.name), params = idx.params || {};
                    if (JSON.stringify(current.keyPath) !== JSON.stringify(idx.keyPath) ||
                        current.unique !== !!params.unique || current.multiEntry !== !!params.multiEntry) {
                      throw new Error('IndexedDB index migration requires an explicit data migration');
                    }
                  } else { store.createIndex(idx.name, idx.keyPath, idx.params); }
                }
              }
            } catch (error) { fail(error); }
          };
          req.onsuccess = e => {
            const connection = e.target.result;
            if (settled) { connection.close(); return; }
            settled = true;
            clearTimeout(timer);
            const forget = () => { if (db[name] === connection) { delete db[name]; } };
            connection.onversionchange = () => { connection.close(); forget(); };
            connection.onclose = forget;
            db[name] = connection;
            schemas.set(name, schema);
            resolve(connection);
          };
          req.onerror = e => fail(req.error || e);
        });
        entry.promise = pending;
        initializing.set(name, entry);
        try { return await pending; }
        finally { if (initializing.get(name) === entry) { initializing.delete(name); } }
      },
      close({name}) {
        const active = initializing.get(name);
        if (active) { active.cancel(); initializing.delete(name); }
        if (db[name]) { db[name].close(); delete db[name]; }
      },
      async getStore({name, storeName, mode = 'readonly'}) {
        let connection;
        do { connection = await this.init({name}); } while (db[name] !== connection);
        const transaction = connection.transaction(storeName, mode);
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
      // Read and modify inside the same readwrite transaction. Other tabs
      // cannot commit a newer record between this read and its write.
      async update({name, storeName, data}) {
        return this._write({name, storeName}, (store, result, fail) => {
          const req = data.index ? store.index(data.index).get(data.key) : store.get(data.key);
          req.onerror = fail;
          req.onsuccess = () => {
            try {
              if (data.onlyExisting && !req.result) { result(null); return; }
              const record = {...(req.result || {})};
              const safe = key => !['__proto__', 'constructor', 'prototype'].includes(key);
              for (const [key, value] of Object.entries(data.defaults || {})) {
                if (safe(key) && !record[key]) { record[key] = value; }
              }
              for (const [key, value] of Object.entries(data.patch || {})) {
                if (safe(key)) { record[key] = value; }
              }
              for (const [key, value] of Object.entries(data.increment || {})) {
                if (!safe(key) || !Number.isFinite(value)) { throw new TypeError('Invalid increment'); }
                record[key] = (Number.isFinite(record[key]) ? record[key] : 0) + value;
              }
              for (const [kind, first] of [['prepend', true], ['append', false]]) {
                for (const [key, values] of Object.entries(data[kind] || {})) {
                  if (!safe(key) || !Array.isArray(values)) { throw new TypeError('Invalid list update'); }
                  const old = Array.isArray(record[key]) ? record[key] : [];
                  record[key] = first ? values.concat(old) : old.concat(values);
                }
              }
              for (const [key, length] of Object.entries(data.limits || {})) {
                if (!safe(key) || !Number.isSafeInteger(length) || length < 0) { throw new TypeError('Invalid list limit'); }
                if (Array.isArray(record[key])) { record[key] = record[key].slice(0, length); }
              }
              const write = store.put(record);
              write.onerror = fail;
              write.onsuccess = () => result(record);
            } catch (error) { fail(error); }
          };
        });
      },
      async updateTime({name, storeName, data: {key, index}}) {
        return this.update({name, storeName, data: {key, index, onlyExisting: true, patch: {updatedAt: Date.now()}}});
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
          update: data => post('update', data, storeName),
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