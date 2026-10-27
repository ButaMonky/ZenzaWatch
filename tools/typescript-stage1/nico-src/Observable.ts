/**
 * Canonical TypeScript source for packages/lib/src/infra/Observable.js (Task782).
 * A small, hot Observable: subscribers share one connection; sources added with
 * concat() run after the producer completes. Values are untyped (`unknown`).
 */
type Callback = (value?: unknown) => unknown;
type Cleanup = (() => void) | {unsubscribe(): unknown} | null | undefined | void;
/** What a producer receives (the inner Subscriber class). */
interface SubscriberLike {
  start(arg?: unknown): void;
  next(arg?: unknown): void;
  error(arg?: unknown): void;
  complete(arg?: unknown): void;
  readonly closed: boolean;
}
type Producer = (observer: SubscriberLike) => Cleanup;
type Filter = ((value: unknown) => unknown) | undefined;
type Mapper = ((value: unknown) => unknown) | undefined;

/** The part of Handler (packages/lib/src/Emitter.js) used here. */
interface HandlerLike {
  execMethod(name: string, ...args: unknown[]): void;
  add(member: unknown): HandlerLike;
  remove(member: unknown): HandlerLike;
  clear(): HandlerLike;
  readonly isEmpty: boolean;
}
declare const Handler: {new(): HandlerLike; nop: (...args: unknown[]) => void};
/** The part of PromiseHandler (packages/lib/src/Emitter.js) used here. */
type Deferred = Promise<unknown> & {resolve(value: unknown): unknown; reject(reason: unknown): unknown};
declare const PromiseHandler: new () => Deferred;

export interface SubscriberCallbacks {
  start?: unknown;
  next?: unknown;
  error?: unknown;
  complete?: unknown;
  closed?: unknown;
}
interface Token {done: boolean; cleanup: (() => void) | null}
interface Connection {closed: boolean; started: boolean; handlers: HandlerLike; tokens: Set<Token>}
interface SubscribeRequest {subscriber: SubscriberLike; isNop: boolean; filterFunc?: Filter; mapFunc?: Mapper}

const Observable = (() => {
  // if (window.Observable) {
  //   return window.Observable;
  // }
  const observableSymbol: symbol = (Symbol as unknown as {observable?: symbol}).observable || Symbol('observable');
  const nop = Handler.nop;
  class Subscription {
    declare callbacks: {unsubscribe?: (() => void) | undefined; closed?: (() => boolean) | undefined};
    declare observable: Observable;
    declare _closed: boolean;
    declare _filterFunc: Filter;
    declare _mapFunc: Mapper;
    constructor({observable, subscriber, unsubscribe, closed}: {
      observable: Observable; subscriber: SubscriberLike; unsubscribe?: () => void; closed?: () => boolean}) {
      this.callbacks = {unsubscribe, closed};
      this.observable = observable;
      const next = subscriber.next.bind(subscriber);
      subscriber.next = args => {
        if (this.closed || (this._filterFunc && !this._filterFunc(args))) {
          return;
        }
        return this._mapFunc ? next(this._mapFunc(args)) : next(args);
      };
      this._closed = false;
    }
    subscribe(onNext?: unknown, onError?: unknown, onCompleted?: unknown): Subscription {
      return this.observable._subscribe({
        subscriber: Subscriber.create(onNext, onError, onCompleted),
        isNop: [onNext, onError, onCompleted].every(f => f == null),
        filterFunc: this._filterFunc, mapFunc: this._mapFunc
      });
    }
    unsubscribe(): this {
      if (this._closed) { return this; }
      this._closed = true;
      if (this.callbacks.unsubscribe) { this.callbacks.unsubscribe(); }
      return this;
    }
    dispose(): this {
      return this.unsubscribe();
    }
    filter(func: Filter): this {
      const _func = this._filterFunc;
      this._filterFunc = _func ? (arg => _func(arg) && (func as (value: unknown) => unknown)(arg)) : func;
      return this;
    }
    map(func: Mapper): this {
      const _func = this._mapFunc;
      this._mapFunc = _func ? arg => (func as (value: unknown) => unknown)(_func(arg)) : func;
      return this;
    }
    get closed(): boolean {
      if (this.callbacks.closed) {
        return this._closed || this.callbacks.closed();
      } else {
        return this._closed;
      }
    }
  }

  class Subscriber {
    declare static nop: Record<'start' | 'next' | 'error' | 'complete' | 'closed', (...args: unknown[]) => void>;
    declare callbacks: {start: Callback; next: Callback; error: Callback; complete: Callback; closed: () => boolean};
    static create(onNext: unknown = null, onError: unknown = null, onCompleted: unknown = null): Subscriber {
      if (typeof onNext === 'function') {
        return new this({
          next: onNext,
          error: onError,
          complete: onCompleted
        });
      }
      return new this((onNext || {}) as SubscriberCallbacks);
    }
    constructor({start, next, error, complete, closed}: SubscriberCallbacks = {}) {
      this.callbacks = {
        start: typeof start === 'function' ? start as Callback : nop,
        next: typeof next === 'function' ? next as Callback : nop,
        error: typeof error === 'function' ? error as Callback : nop,
        complete: typeof complete === 'function' ? complete as Callback : nop,
        closed: typeof closed === 'function' ? closed as () => boolean : () => false
      };
    }
    start(arg?: unknown): void {this.callbacks.start(arg);}
    next(arg?: unknown): void {this.callbacks.next(arg);}
    error(arg?: unknown): void {this.callbacks.error(arg);}
    complete(arg?: unknown): void {this.callbacks.complete(arg);}
    get closed(): boolean {
      return this.callbacks.closed();
    }
  }
  Subscriber.nop = {start: nop, next: nop, error: nop, complete: nop, closed: nop};

  const eleMap = new WeakMap<object, Record<string, Observable>>();
  class Observable {
    declare static observavle: symbol;
    declare _subscriberFunction: Producer;
    declare _sources: Observable[];
    declare _connection: Connection | null;
    declare _subscriber: Subscriber;
    static of(...args: unknown[]): Observable {
      return new this(o => {
        for (const arg of args) {
          o.next(arg);
        }
        o.complete();
        return () => {};
      });
    }
    static from(arg: unknown): Observable | void {
      if ((arg as Record<symbol, unknown>)[Symbol.iterator]) {
        return this.of(...(arg as Iterable<unknown>));
      } else if ((arg as Record<symbol, unknown>)[Observable.observavle]) {
        return (arg as Record<symbol, () => Observable>)[Observable.observavle]!();
      }
    }
    static fromEvent(element: EventTarget, eventName: string): Observable {
      const em = eleMap.get(element) || {};
      if (em && em[eventName]) {
        return em[eventName];
      }
      eleMap.set(element, em);
      return em[eventName] = new this(o => {
        const onUpdate = (e: Event) => o.next(e);
        element.addEventListener(eventName, onUpdate, {passive: true});
        return () => element.removeEventListener(eventName, onUpdate);
      });
    }
    static interval(ms: number): Observable {
      return new this(function(this: {i: number}, o: SubscriberLike) {
        const timer = setInterval(() => o.next(this.i++), ms);
        return () => clearInterval(timer);
      }.bind({i: 0}));
    }
    constructor(subscriberFunction: Producer) {
      this._subscriberFunction = subscriberFunction;
      this._sources = [];
      this._connection = null;
    }
    get closed(): boolean { return !!(this._connection && this._connection.closed); }

    _disposeToken(token: Token): void {
      token.done = true;
      if (!token.cleanup) { return; }
      const cleanup = token.cleanup;
      token.cleanup = null;
      try { cleanup(); } catch (error) { console.warn('Observable cleanup failed', error); }
    }

    _finish(connection: Connection, method?: string, value?: unknown): void {
      if (connection.closed) { return; }
      connection.closed = true;
      try { if (method) { connection.handlers.execMethod(method, value); } }
      finally {
        connection.handlers.clear();
        for (const token of connection.tokens) { this._disposeToken(token); }
        connection.tokens.clear();
      }
    }

    _connect(connection: Connection): void {
      connection.started = true;
      const sources: Producer[] = [observer => this._subscriberFunction(observer),
        ...this._sources.map(source => (observer: SubscriberLike) => source.subscribe({
          next: (value: unknown) => observer.next(value), error: (error: unknown) => observer.error(error),
          complete: (value: unknown) => observer.complete(value)
        }))];
      let index = 0;
      const advance = (completion?: unknown) => {
        if (connection.closed) { return; }
        if (index === sources.length) { this._finish(connection, 'complete', completion); return; }
        const producer = sources[index++] as Producer;
        const token: Token = {done: false, cleanup: null};
        connection.tokens.add(token);
        const active = () => !connection.closed && !token.done;
        const observer = new Subscriber({
          start: (value: unknown) => { if (active()) { connection.handlers.execMethod('start', value); } },
          next: (value: unknown) => { if (active()) { connection.handlers.execMethod('next', value); } },
          error: (error: unknown) => { if (active()) { this._finish(connection, 'error', error); } },
          complete: (value: unknown) => {
            if (!active()) { return; }
            this._disposeToken(token);
            advance(value);
          },
          closed: () => !active()
        });
        this._subscriber = observer;
        try {
          const cleanup = producer(observer);
          token.cleanup = typeof cleanup === 'function' ? cleanup :
            cleanup && typeof cleanup.unsubscribe === 'function' ? () => cleanup.unsubscribe() : null;
          // Synchronous complete/unsubscribe may precede the returned cleanup.
          if (token.done || connection.closed) { this._disposeToken(token); }
        } catch (error) { observer.error(error); }
      };
      advance();
    }

    filter(func: Filter): Subscription {
      return this.subscribe().filter(func);
    }
    map(func: Mapper): Subscription {
      return this.subscribe().map(func);
    }
    concat(arg: unknown): this {
      const observable = Observable.from(arg);
      if (!observable || observable === this) { throw new TypeError('Invalid concatenated Observable'); }
      const pending: Observable[] = [observable], seen = new Set<Observable>();
      while (pending.length) {
        const source = pending.pop() as Observable;
        if (source === this) { throw new TypeError('Cyclic concatenated Observable'); }
        if (seen.has(source)) { continue; }
        seen.add(source);
        pending.push(...(source._sources || []));
      }
      this._sources.push(observable);
      return this;
    }
    forEach(callback: (deferred: Deferred) => void): Subscription {
      let p = new PromiseHandler();
      callback(p);
      return this.subscribe({
        next: (arg: unknown) => {
          const lp = p;
          p = new PromiseHandler();
          lp.resolve(arg);
          callback(p);
        },
        error: (arg: unknown) => {
          const lp = p;
          p = new PromiseHandler();
          lp.reject(arg);
          callback(p);
      }});
    }
    onStart(arg?: unknown): void { this._subscriber.start(arg); }
    onNext(arg?: unknown): void { this._subscriber.next(arg); }
    onError(arg?: unknown): void { this._subscriber.error(arg); }
    onComplete(arg?: unknown): void { this._subscriber.complete(arg);}
    disconnect(): void {
      if (this._connection) { this._finish(this._connection); }
    }
    [observableSymbol](): this { return this; }
    subscribe(onNext: unknown = null, onError: unknown = null, onCompleted: unknown = null): Subscription {
      return this._subscribe({
        subscriber: Subscriber.create(onNext, onError, onCompleted),
        isNop: [onNext, onError, onCompleted].every(f => f === null)
      });
    }
    _subscribe({subscriber, isNop, filterFunc, mapFunc}: SubscribeRequest): Subscription {
      let connection = this._connection;
      if (!connection || connection.closed) {
        connection = {closed: false, started: false, handlers: new Handler(), tokens: new Set()};
        if (!isNop) { this._connection = connection; }
      }
      const subscription = new Subscription({
        observable: this, subscriber,
        unsubscribe: () => {
          if (isNop) { return; }
          connection.handlers.remove(subscriber);
          if (connection.handlers.isEmpty) { this._finish(connection); }
        },
        closed: () => connection.closed
      }).filter(filterFunc).map(mapFunc);
      if (isNop) { return subscription; }
      connection.handlers.add(subscriber);
      try { subscriber.start(subscription); }
      catch (error) { subscription.unsubscribe(); throw error; }
      if (!connection.closed && !connection.started) { this._connect(connection); }
      return subscription;
    }
  }

  Observable.observavle = observableSymbol;

  return Observable;
})();

const WindowResizeObserver = Observable.fromEvent(window, 'resize')
  .map(o => { return {width: window.innerWidth, height: window.innerHeight}; });

export {Observable, WindowResizeObserver};
