/**
 * Canonical TypeScript source for packages/lib/src/infra/IndexedDbStorage.js (Task783).
 * IndexedDB access through a Worker. `workerFunc` (and an optional extra `func`)
 * are stringified into the Worker by workerUtil, so they stay self-contained.
 * Records are opaque here (`unknown`); callers validate what they read.
 */

/**
 * IndexedDB events/requests and Worker RPC messages are untyped at this boundary;
 * this one documented loose alias covers them.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = Record<string, any>;

export interface IndexDefinition {name: string; keyPath: string | string[]; params?: {unique?: boolean; multiEntry?: boolean}}
export interface StoreDefinition {
  name: string;
  indexes?: IndexDefinition[];
  definition?: {keyPath?: string | string[] | null; autoIncrement?: boolean};
}
export interface DbDefinition {name: string; ver?: number; stores: StoreDefinition[]}
export interface StoreQuery {key: IDBValidKey; index?: string; timeout?: number}
export interface StoreApi {
  close(params?: unknown): Promise<unknown>;
  put(record: unknown, transfer?: Transferable[]): Promise<unknown>;
  update(data: unknown): Promise<unknown>;
  get(query: StoreQuery): Promise<unknown>;
  updateTime(query: StoreQuery): Promise<unknown>;
  delete(query: StoreQuery): Promise<unknown>;
  gc(expireTime?: number, index?: string): Promise<unknown>;
}
type Fail = (error: unknown) => void;
type Operation = (store: Loose, result: (value: unknown) => void, fail: Fail) => void;

/** The part of workerUtil (packages/lib/src/infra/workerUtil.js) used here. */
declare const workerUtil: {
  createCrossMessageWorker(func: unknown, options: {name: string}): {post(message: unknown, options?: unknown): Promise<unknown>};
};

const IndexedDbStorage = (() => {
  const workerFunc = function(self: Loose) {
    const db: Record<string, Loose> = Object.create(null);
    const initializing = new Map<string, Loose>();
    const schemas = new Map<string, StoreDefinition[]>();

    const controller: Loose = {
      async init({name, ver, stores}: Loose): Promise<Loose> {
        if (db[name] && (ver === undefined || db[name].version === ver)) { return db[name]; }
        const active = initializing.get(name);
        if (active) {
          await active.promise;
          return this.init({name, ver, stores});
        }
        if (db[name]) { this.close({name}); }
        const schema = stores || schemas.get(name) || [];
        const entry: Loose = {};
        const pending = new Promise<Loose>((resolve, reject) => {
          let settled = false, req: Loose;
          const fail = (error: unknown) => {
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
          req.onupgradeneeded = (e: Loose) => {
            if (settled) { try { req.transaction.abort(); } catch (error) {} return; }
            try {
              const connection = e.target.result;
              for (const meta of schema) {
                const definition: Loose = meta.definition || {};
                const exists = connection.objectStoreNames.contains(meta.name);
                const store = exists ? req.transaction.objectStore(meta.name) :
                  connection.createObjectStore(meta.name, definition);
                if (exists && (JSON.stringify(store.keyPath) !== JSON.stringify(definition.keyPath ?? null) ||
                    store.autoIncrement !== !!definition.autoIncrement)) {
                  throw new Error('IndexedDB store migration requires an explicit data migration');
                }
                for (const idx of meta.indexes || []) {
                  if (store.indexNames.contains(idx.name)) {
                    const current = store.index(idx.name), params: Loose = idx.params || {};
                    if (JSON.stringify(current.keyPath) !== JSON.stringify(idx.keyPath) ||
                        current.unique !== !!params.unique || current.multiEntry !== !!params.multiEntry) {
                      throw new Error('IndexedDB index migration requires an explicit data migration');
                    }
                  } else { store.createIndex(idx.name, idx.keyPath, idx.params); }
                }
              }
            } catch (error) { fail(error); }
          };
          req.onsuccess = (e: Loose) => {
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
          req.onerror = (e: unknown) => fail(req.error || e);
        });
        entry.promise = pending;
        initializing.set(name, entry);
        try { return await pending; }
        finally { if (initializing.get(name) === entry) { initializing.delete(name); } }
      },
      close({name}: Loose) {
        const active = initializing.get(name);
        if (active) { active.cancel(); initializing.delete(name); }
        if (db[name]) { db[name].close(); delete db[name]; }
      },
      async getStore({name, storeName, mode = 'readonly'}: Loose) {
        let connection;
        do { connection = await this.init({name}); } while (db[name] !== connection);
        const transaction = connection.transaction(storeName, mode);
        return {store: transaction.objectStore(storeName), transaction};
      },
      async _write({name, storeName}: Loose, operation: Operation) {
        const {store, transaction} = await this.getStore({name, storeName, mode: 'readwrite'});
        return new Promise((resolve, reject) => {
          let result: unknown, settled = false;
          const cleanup = () => {
            transaction.oncomplete = transaction.onabort = transaction.onerror = null;
          };
          const fail = (error: unknown) => {
            if (settled) { return; }
            settled = true;
            const reason = (error && (error as Loose).target) ?
              ((error as Loose).target.error || transaction.error || new Error('IndexedDB transaction failed')) : error;
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
      async put({name, storeName, data}: Loose) {
        return this._write({name, storeName}, (store: Loose, result: (value: unknown) => void, fail: Fail) => {
          const req = store.put(data);
          req.onsuccess = (e: Loose) => result(e.target.result);
          req.onerror = fail;
        });
      },
      async get({name, storeName, data: {key, index, timeout}}: Loose) {
        const {store} = await this.getStore({name, storeName});
        return new Promise((resolve, reject) => {
          const req = index ? store.index(index).get(key) : store.get(key);
          let timer: ReturnType<typeof setTimeout> | undefined;
          let settled = false;
          // Release the timer and request callbacks on any settlement. The
          // IndexedDB request itself cannot be canceled, but late completion
          // must not keep this closure or key alive after a timeout.
          const finish = (callback: (value: unknown) => void, result: unknown) => {
            if (settled) { return; }
            settled = true;
            if (timer !== undefined) {
              clearTimeout(timer);
              timer = undefined;
            }
            req.onsuccess = req.onerror = null;
            callback(result);
          };
          req.onsuccess = (event: Loose) => finish(resolve, event.target.result);
          req.onerror = (event: unknown) => finish(reject, event);
          if (timeout) {
            timer = setTimeout(() => finish(reject, 'IndexedDB get timed out'), timeout);
          }
        });
      },
      // Read and modify inside the same readwrite transaction. Other tabs
      // cannot commit a newer record between this read and its write.
      async update({name, storeName, data}: Loose) {
        return this._write({name, storeName}, (store: Loose, result: (value: unknown) => void, fail: Fail) => {
          const req = data.index ? store.index(data.index).get(data.key) : store.get(data.key);
          req.onerror = fail;
          req.onsuccess = () => {
            try {
              if (data.onlyExisting && !req.result) { result(null); return; }
              const record: Loose = {...(req.result || {})};
              const safe = (key: string) => !['__proto__', 'constructor', 'prototype'].includes(key);
              for (const [key, value] of Object.entries(data.defaults || {})) {
                if (safe(key) && !record[key]) { record[key] = value; }
              }
              for (const [key, value] of Object.entries(data.patch || {})) {
                if (safe(key)) { record[key] = value; }
              }
              for (const [key, value] of Object.entries(data.increment || {})) {
                if (!safe(key) || !Number.isFinite(value)) { throw new TypeError('Invalid increment'); }
                record[key] = (Number.isFinite(record[key]) ? record[key] : 0) + (value as number);
              }
              for (const [kind, first] of [['prepend', true], ['append', false]] as const) {
                for (const [key, values] of Object.entries(data[kind] || {})) {
                  if (!safe(key) || !Array.isArray(values)) { throw new TypeError('Invalid list update'); }
                  const old = Array.isArray(record[key]) ? record[key] : [];
                  record[key] = first ? values.concat(old) : old.concat(values);
                }
              }
              for (const [key, length] of Object.entries(data.limits || {})) {
                if (!safe(key) || !Number.isSafeInteger(length) || (length as number) < 0) { throw new TypeError('Invalid list limit'); }
                if (Array.isArray(record[key])) { record[key] = record[key].slice(0, length as number); }
              }
              const write = store.put(record);
              write.onerror = fail;
              write.onsuccess = () => result(record);
            } catch (error) { fail(error); }
          };
        });
      },
      async updateTime({name, storeName, data: {key, index}}: Loose) {
        return this.update({name, storeName, data: {key, index, onlyExisting: true, patch: {updatedAt: Date.now()}}});
      },
      async delete({name, storeName, data: {key, index}}: Loose) {
        return this._write({name, storeName}, (store: Loose, result: (value: unknown) => void, fail: Fail) => {
          let remove = 0;
          const range = IDBKeyRange.only(key);
          const req = index ? store.index(index).openCursor(range) : store.openCursor(range);
          req.onsuccess = (e: Loose) => {
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
      async clear({name, storeName}: Loose) {
        return this._write({name, storeName}, (store: Loose, result: (value: unknown) => void, fail: Fail) => {
          const req = store.clear();
          req.onsuccess = () => result(undefined);
          req.onerror = fail;
        });
      },
      async gc({name, storeName, data: {expireTime, index}}: Loose) {
        index = index || 'updatedAt';
        const now = Date.now(), ptime = performance.now();
        const expiresAt = (index !== 'expiresAt') ? (now - expireTime) : now;
        let count = 0;
        return this._write({name, storeName}, (store: Loose, result: (value: unknown) => void, fail: Fail) => {
          const range = IDBKeyRange.upperBound(expiresAt);
          const req = store.index(index).openCursor(range);
          req.onsuccess = (e: Loose) => {
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
        }).catch((e: unknown) => {
          console.warn('IndexedDB cache cleanup failed');
          throw e;
        });
      }

    };

    self.onmessage = async ({command, params}: Loose) => {
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

  const workers = new Map<unknown, ReturnType<typeof workerUtil.createCrossMessageWorker>>();
  const open = async ({name, ver, stores}: DbDefinition, func?: unknown) => {
    let worker;
    if (func) {
      let _func: unknown = workerFunc;
      if (func) {
        _func = `
        (() => {
        const controller = (${workerFunc.toString()})(self);
        (${(func as {toString(): string}).toString()})(self)
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

    const post = (command: string, data: unknown, storeName: string, transfer?: Transferable[]) => {
      const params = {data, name, storeName, transfer};
      // IDB-POST-TRANSFER-001 (Task787): post() takes options; the transfer list used to
      // be passed in the options position and was ignored.
      return worker.post({command, params}, {transfer});
    };

    const result: Record<string, StoreApi> & {worker: typeof worker} = {worker} as Record<string, StoreApi> & {worker: typeof worker};
    for (const meta of stores) {
      const storeName = meta.name;
      result[storeName] = (storeName => {
        return {
          close: (params?: unknown) => post('close', params, storeName),
          put: (record: unknown, transfer?: Transferable[]) => post('put', record, storeName, transfer),
          update: (data: unknown) => post('update', data, storeName),
          get: ({key, index, timeout}: StoreQuery) => post('get', {key, index, timeout}, storeName),
          updateTime: ({key, index, timeout}: StoreQuery) => post('updateTime', {key, index, timeout}, storeName),
          delete: ({key, index, timeout}: StoreQuery) => post('delete', {key, index, timeout}, storeName),
          gc: (expireTime = 30 * 24 * 60 * 60 * 1000, index = 'updatedAt') => post('gc', {expireTime, index}, storeName)
        };
      })(storeName);
    }
    return result;
  };
  return {open};
})();

export {IndexedDbStorage};
