/**
 * Canonical TypeScript source for packages/lib/src/Emitter.js (Task800).
 * EmitterInitFunc must stay self-contained: workerUtil and MylistPocket inject
 * `EmitterInitFunc.toString()` into workers / other windows.
 */

/**
 * Listeners receive whatever payload an emitter sends (comments, configs, DOM events);
 * this one documented loose argument list covers them.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyArgs = any[];
export type Listener = {(...args: AnyArgs): unknown; _original?: Listener | null};
type Settle = (...args: unknown[]) => void;
export type PromiseCallback = (resolve: Settle, reject: Settle) => unknown;
interface PromiseKey {
  id: string;
  callback: PromiseCallback;
  status: string;
  value?: unknown[];
  result?: Promise<unknown>;
  resolve?: Settle;
  reject?: Settle;
}

function EmitterInitFunc() {
class Handler<T = Listener> { //extends Array {
  declare _list: T[];
  declare name: string;
  declare static nop: () => void;
  constructor(...args: T[]) {
    this._list = args;
  }

  get length() {
    return this._list.length;
  }

  exec(...args: AnyArgs) {
    const pending = this._list.slice();
    for (let i = pending.length - 1; i >= 0; i--) {
      const member = pending[i] as T;
      if (this._list.includes(member)) { (member as unknown as Listener).apply(this._list, args); }
    }
  }

  execMethod(name: string, ...args: AnyArgs) {
    const pending = this._list.slice();
    for (let i = pending.length - 1; i >= 0; i--) {
      const member = pending[i] as T;
      if (this._list.includes(member)) { (member as unknown as Record<string, Listener>)[name]!(...args); }
    }
  }

  add(member: T) {
    if (this._list.includes(member)) {
      return this;
    }
    this._list.unshift(member);
    return this;
  }

  remove(member: T) {
    this._list = this._list.filter(m => m !== member);
    return this;
  }

  clear() {
    this._list.length = 0;
    return this;
  }

  get isEmpty() {
    return this._list.length < 1;
  }

  *[Symbol.iterator]() {
    const list = this._list || [];
    for (const member of list) {
      yield member;
    }
  }

  next() {
    return this[Symbol.iterator]();
  }
}
Handler.nop = () => {/*     ( ˘ω˘ ) スヤァ    */};

const PromiseHandler = (() => {
  const id = function(this: {id: number}) { return `Promise${this.id++}`; }.bind({id: 0});

  class PromiseHandler extends Promise<unknown> {
    declare key: PromiseKey;
    constructor(callback: PromiseCallback = () => {}) {
      const key = new Object({id: id(), callback, status: 'pending'}) as PromiseKey;

      const cb = function(this: PromiseKey, res: Settle, rej: Settle) {
        const resolve = (...args: unknown[]) => { this.status = 'resolved'; this.value = args; res(...args); };
        const reject  = (...args: unknown[]) => { this.status = 'rejected'; this.value = args; rej(...args); };
        if (this.result) {
          return this.result.then(resolve, reject);
        }
        Object.assign(this, {resolve, reject});
        return callback(resolve, reject);
      }.bind(key);

      super(cb);
      this.resolve = this.resolve.bind(this);
      this.reject = this.reject.bind(this);
      this.key = key;
    }

    resolve(...args: unknown[]) {
      if (this.key.resolve) {
        this.key.resolve(...args);
      } else {
        this.key.result = (Promise.resolve as (...args: unknown[]) => Promise<unknown>)(...args);
      }
      return this;
    }

    reject(...args: unknown[]) {
      if (this.key.reject) {
        this.key.reject(...args);
      } else {
        this.key.result = (Promise.reject as (...args: unknown[]) => Promise<unknown>)(...args);
      }
      return this;
    }

    addCallback(callback: PromiseCallback) {
      Promise.resolve().then(() => callback(this.resolve, this.reject));
      return this;
    }
  }
  return PromiseHandler;
})();


const {Emitter} = (() => {
  let totalCount = 0;
  let warnings: unknown[] = [];
  class Emitter {
    declare _events?: Map<string, Handler>;
    declare _promise?: Map<string, InstanceType<typeof PromiseHandler>>;
    declare static totalCount: number;
    declare static warnings: unknown[];
    on(name: string, callback: Listener) {
      if (!this._events) {
        Emitter.totalCount++;
        this._events = new Map();
      }

      name = name.toLowerCase();
      let e = this._events.get(name);
      if (!e) {
        const handler = new Handler(callback);
        handler.name = name;
        // Task800 (EMITTER-ON-WARN-001): Map#set returns the map, not the handler, so the
        // listener-count warning below read `Map.length` (undefined) for a new name.
        this._events.set(name, handler);
        e = handler;
      } else {
        e.add(callback);
      }
      if (e.length > 10) {
        console.warn('listener count > 10', name, e, callback);
        !Emitter.warnings.includes(this) && Emitter.warnings.push(this);
      }
      return this;
    }

    off(name: string, callback?: Listener) {
      if (!this._events) {
        return;
      }

      name = name.toLowerCase();
      const e = this._events.get(name) as Handler;

      if (!this._events.has(name)) {
        return;
      } else if (!callback) {
        this._events.delete(name);
      } else {
        for (const listener of e) {
          if (listener === callback || listener._original === callback) {
            e.remove(listener);
          }
        }

        if (e.isEmpty) {
          this._events.delete(name);
        }
      }

      if (this._events.size < 1) {
        delete this._events;
        // Task800 (EMITTER-TOTALCOUNT-001): `on` counts each new event map; count it down
        // here too, as `clear()` does, so the diagnostic does not only grow.
        Emitter.totalCount--;
      }
      return this;
    }

    once(name: string, func: Listener) {
      const wrapper: Listener = (...args: AnyArgs) => {
        this.off(name, wrapper);
        wrapper._original = null;
        func(...args);
      };
      wrapper._original = func;
      return this.on(name, wrapper);
    }

    clear(name?: string) {
      if (!this._events) {
        return;
      }

      if (name) {
        // Task800 (EMITTER-CLEAR-CASE-001): event names are stored lower-cased by `on`.
        this._events.delete(name.toLowerCase());
      } else {
        delete this._events;
        Emitter.totalCount--;
      }
      return this;
    }

    emit(name: string, ...args: AnyArgs) {
      if (!this._events) {
        return;
      }

      name = name.toLowerCase();
      const e = this._events.get(name);

      if (!e) {
        return;
      }

      e.exec(...args);
      return this;
    }
    emitAsync(...args: [string, ...AnyArgs]) {
      if (!this._events) {
        return;
      }

      setTimeout(() => this.emit(...args), 0);
      return this;
    }
    promise(name: string, callback?: PromiseCallback) {
      if (!this._promise) {
        this._promise = new Map;
      }
      const p = this._promise.get(name);
      if (p) {
        return callback ? p.addCallback(callback) : p;
      }
      this._promise.set(name, new PromiseHandler(callback));
      return this._promise.get(name)!;
    }
    emitResolve(name: string, ...args: unknown[]) {
      if (!this._promise) {
        this._promise = new Map;
      }
      if (!this._promise.has(name)) {
        this._promise.set(name, new PromiseHandler());
      }
      return this._promise.get(name)!.resolve(...args);
    }
    emitReject(name: string, ...args: unknown[]) {
      if (!this._promise) {
        this._promise = new Map;
      }
      if (!this._promise.has(name)) {
        this._promise.set(name, new PromiseHandler);
      }
      return this._promise.get(name)!.reject(...args);
    }
    resetPromise(name: string) {
      if (!this._promise) { return; }
      this._promise.delete(name);
    }
    hasPromise(name: string) {
      return this._promise && this._promise.has(name);
    }
    addEventListener(...args: [string, Listener]) { return this.on(...args); }
    removeEventListener(...args: [string, Listener?]) { return this.off(...args);}
  }
  Emitter.totalCount = totalCount;
  Emitter.warnings = warnings;
  return {Emitter};
})();

  return {Handler, PromiseHandler, Emitter};
}
const {Handler, PromiseHandler, Emitter} = EmitterInitFunc();
/** Instance types for TypeScript callers (erased from the runtime JS). */
export type EmitterInstance = InstanceType<typeof Emitter>;
export type PromiseHandlerInstance = InstanceType<typeof PromiseHandler>;

export {
  EmitterInitFunc,
  Handler,
  PromiseHandler,
  Emitter
};
