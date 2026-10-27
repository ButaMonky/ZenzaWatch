import {Handler, PromiseHandler} from '../Emitter';

//===BEGIN===
const Observable = (() => {
  // if (window.Observable) {
  //   return window.Observable;
  // }
  const observableSymbol = Symbol.observable || Symbol('observable');
  const nop = Handler.nop;
  class Subscription {
    constructor({observable, subscriber, unsubscribe, closed}) {
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
    subscribe(onNext, onError, onCompleted) {
      return this.observable._subscribe({
        subscriber: Subscriber.create(onNext, onError, onCompleted),
        isNop: [onNext, onError, onCompleted].every(f => f == null),
        filterFunc: this._filterFunc, mapFunc: this._mapFunc
      });
    }
    unsubscribe() {
      if (this._closed) { return this; }
      this._closed = true;
      if (this.callbacks.unsubscribe) { this.callbacks.unsubscribe(); }
      return this;
    }
    dispose() {
      return this.unsubscribe();
    }
    filter(func) {
      const _func = this._filterFunc;
      this._filterFunc = _func ? (arg => _func(arg) && func(arg)) : func;
      return this;
    }
    map(func) {
      const _func = this._mapFunc;
      this._mapFunc = _func ? arg => func(_func(arg)) : func;
      return this;
    }
    get closed() {
      if (this.callbacks.closed) {
        return this._closed || this.callbacks.closed();
      } else {
        return this._closed;
      }
    }
  }

  class Subscriber {
    static create(onNext = null, onError = null, onCompleted = null) {
      if (typeof onNext === 'function') {
        return new this({
          next: onNext,
          error: onError,
          complete: onCompleted
        });
      }
      return new this(onNext || {});
    }
    constructor({start, next, error, complete, closed} = {}) {
      this.callbacks = {
        start: typeof start === 'function' ? start : nop,
        next: typeof next === 'function' ? next : nop,
        error: typeof error === 'function' ? error : nop,
        complete: typeof complete === 'function' ? complete : nop,
        closed: typeof closed === 'function' ? closed : () => false
      };
    }
    start(arg) {this.callbacks.start(arg);}
    next(arg) {this.callbacks.next(arg);}
    error(arg) {this.callbacks.error(arg);}
    complete(arg) {this.callbacks.complete(arg);}
    get closed() {
      return this.callbacks.closed();
    }
  }
  Subscriber.nop = {start: nop, next: nop, error: nop, complete: nop, closed: nop};

  const eleMap = new WeakMap();
  class Observable {
    static of(...args) {
      return new this(o => {
        for (const arg of args) {
          o.next(arg);
        }
        o.complete();
        return () => {};
      });
    }
    static from(arg) {
      if (arg[Symbol.iterator]) {
        return this.of(...arg);
      } else if (arg[Observable.observavle]) {
        return arg[Observable.observavle]();
      }
    }
    static fromEvent(element, eventName) {
      const em = eleMap.get(element) || {};
      if (em && em[eventName]) {
        return em[eventName];
      }
      eleMap.set(element, em);
      return em[eventName] = new this(o => {
        const onUpdate = e => o.next(e);
        element.addEventListener(eventName, onUpdate, {passive: true});
        return () => element.removeEventListener(eventName, onUpdate);
      });
    }
    static interval(ms) {
      return new this(function(o) {
        const timer = setInterval(() => o.next(this.i++), ms);
        return () => clearInterval(timer);
      }.bind({i: 0}));
    }
    constructor(subscriberFunction) {
      this._subscriberFunction = subscriberFunction;
      this._sources = [];
      this._connection = null;
    }
    get closed() { return !!(this._connection && this._connection.closed); }

    _disposeToken(token) {
      token.done = true;
      if (!token.cleanup) { return; }
      const cleanup = token.cleanup;
      token.cleanup = null;
      try { cleanup(); } catch (error) { console.warn('Observable cleanup failed', error); }
    }

    _finish(connection, method, value) {
      if (connection.closed) { return; }
      connection.closed = true;
      try { if (method) { connection.handlers.execMethod(method, value); } }
      finally {
        connection.handlers.clear();
        for (const token of connection.tokens) { this._disposeToken(token); }
        connection.tokens.clear();
      }
    }

    _connect(connection) {
      connection.started = true;
      const sources = [observer => this._subscriberFunction(observer),
        ...this._sources.map(source => observer => source.subscribe({
          next: value => observer.next(value), error: error => observer.error(error),
          complete: value => observer.complete(value)
        }))];
      let index = 0;
      const advance = completion => {
        if (connection.closed) { return; }
        if (index === sources.length) { this._finish(connection, 'complete', completion); return; }
        const producer = sources[index++];
        const token = {done: false, cleanup: null};
        connection.tokens.add(token);
        const active = () => !connection.closed && !token.done;
        const observer = new Subscriber({
          start: value => { if (active()) { connection.handlers.execMethod('start', value); } },
          next: value => { if (active()) { connection.handlers.execMethod('next', value); } },
          error: error => { if (active()) { this._finish(connection, 'error', error); } },
          complete: value => {
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

    filter(func) {
      return this.subscribe().filter(func);
    }
    map(func) {
      return this.subscribe().map(func);
    }
    concat(arg) {
      const observable = Observable.from(arg);
      if (!observable || observable === this) { throw new TypeError('Invalid concatenated Observable'); }
      const pending = [observable], seen = new Set();
      while (pending.length) {
        const source = pending.pop();
        if (source === this) { throw new TypeError('Cyclic concatenated Observable'); }
        if (seen.has(source)) { continue; }
        seen.add(source);
        pending.push(...(source._sources || []));
      }
      this._sources.push(observable);
      return this;
    }
    forEach(callback) {
      let p = new PromiseHandler();
      callback(p);
      return this.subscribe({
        next: arg => {
          const lp = p;
          p = new PromiseHandler();
          lp.resolve(arg);
          callback(p);
        },
        error: arg => {
          const lp = p;
          p = new PromiseHandler();
          lp.reject(arg);
          callback(p);
      }});
    }
    onStart(arg) { this._subscriber.start(arg); }
    onNext(arg) { this._subscriber.next(arg); }
    onError(arg) { this._subscriber.error(arg); }
    onComplete(arg) { this._subscriber.complete(arg);}
    disconnect() {
      if (this._connection) { this._finish(this._connection); }
    }
    [observableSymbol]() { return this; }
    subscribe(onNext = null, onError = null, onCompleted = null) {
      return this._subscribe({
        subscriber: Subscriber.create(onNext, onError, onCompleted),
        isNop: [onNext, onError, onCompleted].every(f => f === null)
      });
    }
    _subscribe({subscriber, isNop, filterFunc, mapFunc}) {
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
//===END===

export {Observable, WindowResizeObserver};

// _subscribe({subscriber, isNop}) {
//   const complete = subscriber.complete;
//   subscriber.complete = (...args) => {
//     this._completed = true;
//     complete(...args);
//   };
//   const disconnectFunction = isNop ? nop : this._subscriberFunction(subscriber);
//   this._disconnectors ?
//     this._disconnectors.add(disconnectFunction) :
//     (this._disconnectors = Handler.of(disconnectFunction));
//   this._members ? this._members.add(subscriber) : (this._members = Handler.of(subscriber));
//   return new Subscription({
//     observable: this,
//     subscriber,
//     unsubscribe: disconnectFunction,
//     closed: () => this.closed
//   });
// }

// disconnect() {
//   this._closed = true;
//   if (this._disconnectors) {
//     this._disconnectors.exec();
//     this._disconnectors.clear();
//   }
//   this._members && this._members.clear();
// }

// static fromEvent(element, eventName) {
//   return new this(o => {
//     const onUpdate = e => {
//       const val = {};
//       for (const key of Object.getOwnPropertyNames(e)) {
//         const v = e[key];
//         if (typeof v === 'function') { continue; }
//         val[key] = v;
//       }
//       o.next(val);
//     }
//     element.addEventListener(eventNName, onUpdate, {passive: true});
//     return () => element.removeEventListener(eventName, onUpdate);
//   });
// }
