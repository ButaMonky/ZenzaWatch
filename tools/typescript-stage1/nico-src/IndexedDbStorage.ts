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
export interface SavedPointProjection {
  watchId:string; title:string; duration:number; updatedAt:number; automaticTime:number|null;
}
export interface SavedPointsPage {items:SavedPointProjection[];nextKey:string|null}
export interface StoreApi {
  listSavedPoints?(data:{afterKey?:string|null;maxRecords?:number}):Promise<SavedPointsPage>;
  close(params?: unknown): Promise<unknown>;
  put(record: unknown, transfer?: Transferable[]): Promise<unknown>;
  update(data: unknown): Promise<unknown>;
  /** Non-destructive, bounded migration of legacy watch-info video metadata. */
  scrubWatchVideoInfo?(data: {afterKey?: string | null; maxRecords?: number}): Promise<{
    scanned: number; changed: number; nextKey: string | null;
  }>;
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
    // #286: Common projection for both legacy cursor scrub and read-only
    // cross-domain responses. Do not serialize old authentication fields into
    // a page/iframe reply while the background migration is still pending.
    const pickPublicVideoInfo = (value: unknown): Loose => {
      const data: Loose = {};
      if (!value || typeof value !== 'object' || Array.isArray(value)) { return data; }
      const source = value as Loose;
      for (const key of ['videoId','watchId','contextWatchId','originalVideoId',
        'title','postedAt','thumbnail','betterThumbnail','duration','threadId',
        'description','watchUrl']) {
        const v = source[key];
        if (typeof v === 'string' || typeof v === 'boolean' ||
            (typeof v === 'number' && Number.isFinite(v))) { data[key] = v; }
      }
      if (source.count && typeof source.count === 'object' && !Array.isArray(source.count)) {
        const counts: Loose = {};
        for (const key of ['comment','mylist','view','like']) {
          const v = source.count[key];
          if (typeof v === 'number' && Number.isFinite(v)) { counts[key] = v; }
        }
        data.count = counts;
      }
      if (source.owner && typeof source.owner === 'object' && !Array.isArray(source.owner)) {
        const owner: Loose = {};
        for (const key of ['type','url','icon','id','linkId','name']) {
          const v = source.owner[key];
          if (typeof v === 'string' || (typeof v === 'number' && Number.isFinite(v))) {
            owner[key] = v;
          }
        }
        data.owner = owner;
      }
      if (source.genre && typeof source.genre === 'object' && !Array.isArray(source.genre)) {
        data.genre = {
          key: typeof source.genre.key === 'string' ? source.genre.key : '',
          label: typeof source.genre.label === 'string' ? source.genre.label : ''
        };
      }
      return data;
    };
    const projectWatchHistoryRecord = (name: string, storeName: string, row: unknown): unknown => {
      if (name !== 'watch-info' || storeName !== 'cache' ||
          !row || typeof row !== 'object' || Array.isArray(row) ||
          (row as Loose).videoInfo == null) {
        return row;
      }
      return {...row, videoInfo: pickPublicVideoInfo((row as Loose).videoInfo)};
    };

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
          req.onsuccess = (event: Loose) => {
            const row = event.target.result;
            finish(resolve, projectWatchHistoryRecord(name, storeName, row));
          };
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
              // update()/updateTime() return full rows through the bridge too.
              // Project the response only; the persisted row remains unchanged
              // until the bounded background scrub reaches it.
              write.onsuccess = () => result(projectWatchHistoryRecord(name, storeName, record));
            } catch (error) { fail(error); }
          };
        });
      },
      // #286: read/modify/write only legacy videoInfo in the SAME transaction.
      // This is a fixed internal operation; never accept arbitrary JS callbacks,
      // field names or full records from an untrusted bridge message.
      async scrubWatchVideoInfo({name, storeName, data}: Loose) {
        if (name !== 'watch-info' || storeName !== 'cache') {
          throw new TypeError('Legacy watch-info scrub restricted to cache store');
        }
        const afterKey: unknown = data?.afterKey ?? null;
        const maxRecords: unknown = data?.maxRecords ?? 64;
        if ((afterKey !== null && (typeof afterKey !== 'string' || !afterKey)) ||
            !Number.isSafeInteger(maxRecords) || (maxRecords as number) < 1 ||
            (maxRecords as number) > 256) {
          throw new TypeError('Invalid legacy watch-info scrub cursor');
        }
        const same = (old: unknown, projected: Loose): boolean => {
          if (!old || typeof old !== 'object' || Array.isArray(old)) { return false; }
          const fields = old as Loose, keys = Object.keys(fields);
          if (keys.length !== Object.keys(projected).length) { return false; }
          return keys.every(key => {
            if (!Object.prototype.hasOwnProperty.call(projected, key)) { return false; }
            if (!['count','owner','genre'].includes(key)) { return fields[key] === projected[key]; }
            const nested = fields[key] as Loose, safe = projected[key] as Loose;
            return !!nested && typeof nested === 'object' && !Array.isArray(nested) &&
              Object.keys(nested).length === Object.keys(safe).length &&
              Object.keys(safe).every(child => nested[child] === safe[child]);
          });
        };
        return this._write({name, storeName}, (store: Loose,
          result: (value: unknown) => void, fail: Fail) => {
          const range = afterKey === null ? undefined :
            IDBKeyRange.lowerBound(afterKey as IDBValidKey, true);
          const req = store.openCursor(range);
          let scanned = 0, changed = 0;
          req.onerror = fail;
          req.onsuccess = () => {
            try {
              const cursor = req.result;
              if (!cursor) { result({scanned, changed, nextKey: null}); return; }
              if (typeof cursor.primaryKey !== 'string' || !cursor.primaryKey) {
                throw new TypeError('Unexpected watch-info cursor key');
              }
              const record = cursor.value;
              if (record && typeof record === 'object' && !Array.isArray(record) &&
                  record.videoInfo != null &&
                  Object.prototype.hasOwnProperty.call(record, 'videoInfo')) {
                const projected = pickPublicVideoInfo(record.videoInfo);
                if (!same(record.videoInfo, projected)) {
                  const request = cursor.update({...record, videoInfo: projected});
                  request.onerror = fail;
                  changed++;
                }
              }
              scanned++;
              // The resume key is a cursor, not user data for telemetry/logging.
              if (scanned >= (maxRecords as number)) {
                result({scanned, changed, nextKey: cursor.primaryKey});
              } else {
                cursor.continue();
              }
            } catch (error) { fail(error); }
          };
        });
      },
      /** Read-only, allowlisted projection; never transfer full history rows. */
      async listSavedPoints({name,storeName,data}:Loose):Promise<SavedPointsPage> {
        if(name!=='watch-info'||storeName!=='cache'){
          throw new TypeError('Saved points restricted to watch history cache');
        }
        const afterKey:unknown=data?.afterKey??null;
        const maxRecords:unknown=data?.maxRecords??200;
        if((afterKey!==null&&(typeof afterKey!=='string'||!afterKey))||
           !Number.isSafeInteger(maxRecords)||(maxRecords as number)<1||(maxRecords as number)>200){
          throw new TypeError('Invalid saved points cursor');
        }
        const {store,transaction}=await this.getStore({name,storeName,mode:'readonly'});
        return new Promise((resolve,reject)=>{
          const items:SavedPointProjection[]=[];
          let nextKey:string|null=null,scanned=0,settled=false;
          const cleanup=()=>{transaction.oncomplete=transaction.onabort=transaction.onerror=null;};
          const fail=(error:unknown)=>{
            if(settled)return;
            settled=true;cleanup();
            const reason=(error as Loose)?.target?.error||transaction.error||error;
            reject(reason||new Error('Saved points read failed'));
          };
          transaction.onabort=transaction.onerror=fail;
          transaction.oncomplete=()=>{
            if(settled)return;
            settled=true;cleanup();resolve({items,nextKey});
          };
          try{
            const range=afterKey===null?undefined:IDBKeyRange.lowerBound(afterKey as string,true);
            const req=store.openCursor(range);
            req.onerror=fail;
            req.onsuccess=()=>{
              if(settled)return;
              try{
                const cursor=req.result;
                if(!cursor){nextKey=null;return;}
                if(typeof cursor.primaryKey!=='string'||!cursor.primaryKey){
                  throw new TypeError('Unexpected saved points cursor key');
                }
                const row=cursor.value;
                if(row&&typeof row==='object'&&!Array.isArray(row)&&row.watchId===cursor.primaryKey){
                  const finite=(value:unknown):value is number=>
                    typeof value==='number'&&Number.isFinite(value)&&value>=0;
                  const resume=Array.isArray(row.resume)?row.resume[0]?.time:null;
                  items.push({
                    watchId:cursor.primaryKey,
                    title:typeof row.videoInfo?.title==='string'?row.videoInfo.title:cursor.primaryKey,
                    duration:finite(row.videoInfo?.duration)?row.videoInfo.duration:0,
                    updatedAt:finite(row.updatedAt)?row.updatedAt:0,
                    automaticTime:finite(row.resumeOverride)?row.resumeOverride:finite(resume)?resume:null
                  });
                }
                scanned++;
                if(scanned>=(maxRecords as number))nextKey=cursor.primaryKey;
                else cursor.continue();
              }catch(error){fail(error);}
            };
          }catch(error){fail(error);}
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
        const diagnosticCommand = typeof command === 'string' && /^(?:init|put|update|scrubWatchVideoInfo|updateTime|get|delete|gc|clear|close)$/.test(command) ? command : 'unknown';
        console.warn('IndexedDB command failed:', diagnosticCommand);
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
          scrubWatchVideoInfo: (data: {afterKey?: string | null; maxRecords?: number}) =>
            post('scrubWatchVideoInfo', data, storeName) as Promise<{scanned: number; changed: number; nextKey: string | null}>,
          listSavedPoints: (data:{afterKey?:string|null;maxRecords?:number}) =>
            post('listSavedPoints',data,storeName) as Promise<SavedPointsPage>,
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
