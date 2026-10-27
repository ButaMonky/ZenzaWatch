/**
 * Canonical TypeScript source for packages/lib/src/infra/StorageWriter.js (Task726).
 * JSON writer for Web Storage that survives prototype.js pollution
 * (Array.prototype.toJSON) by serializing in a worker. `func` is stringified
 * into the worker by workerUtil, so it must stay self-contained.
 */
type ToJsonParams = {obj: unknown; replacer: Parameters<typeof JSON.stringify>[1]; space: string | number};
type WorkerSelf = {onmessage: (message: {command: string; params: ToJsonParams}) => string};
type StorageSlot = Record<symbol, unknown>;

/** The part of workerUtil (packages/lib/src/infra/workerUtil.js) used here. */
declare const workerUtil: {
  createCrossMessageWorker(func: (self: WorkerSelf) => void, options: {name: string}): {
    post(message: {command: string; params: ToJsonParams}): Promise<string>;
  };
};

const StorageWriter = (() => {
  const func = function(self: WorkerSelf) {
    self.onmessage = ({command, params}) => {
      const {obj, replacer, space} = params;
      return JSON.stringify(obj, replacer || null, space || 0);
    };
  };

  let worker: ReturnType<typeof workerUtil.createCrossMessageWorker> | undefined;
  const prototypePollution = (window as unknown as {Prototype?: unknown}).Prototype && Array.prototype.hasOwnProperty('toJSON');

  const toJson = async (obj: unknown, replacer: ToJsonParams['replacer'] = null, space: string | number = 0): Promise<string> => {
    if (!prototypePollution || obj === null || ['string', 'number', 'boolean'].includes(typeof obj)) {
      return JSON.stringify(obj, replacer as (number | string)[] | null, space);
    }
    worker = worker || workerUtil.createCrossMessageWorker(func, {name: 'ToJsonWorker'});
    return worker.post({command: 'toJson', params: {obj, replacer, space}});
  };

  const writer = Symbol('StorageWriter');
  const setItem = (storage: Storage, key: string, value: unknown) => {
    if (!prototypePollution || value === null || ['string', 'number', 'boolean'].includes(typeof value)) {
      storage.setItem(key, JSON.stringify(value));
    } else {
      toJson(value).then(json => storage.setItem(key, json));
    }
  };

  (localStorage as unknown as StorageSlot)[writer] = (key: string, value: unknown) => setItem(localStorage, key, value);
  (sessionStorage as unknown as StorageSlot)[writer] = (key: string, value: unknown) => setItem(sessionStorage, key, value);


  return { writer, toJson };
})();

export {StorageWriter};
