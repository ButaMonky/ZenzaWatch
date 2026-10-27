/**
 * Canonical TypeScript source for packages/lib/src/infra/bounce.js (Task726).
 * Debounce (`bounce.idle` / `bounce.time`) and throttle helpers. Each call returns
 * a PromiseHandler that resolves with {lastResult, lastArgs} when the wrapped
 * function finally runs.
 */
type AnyArgs = never[];
type Fn = (...args: AnyArgs) => unknown;
/** The part of PromiseHandler (packages/lib/src/Emitter.js) used here. */
type Handler = Promise<unknown> & {resolve(value: unknown): void};
declare const PromiseHandler: new () => Handler;
type Timer = number | null | undefined | void;
type Scheduler = [(callback: () => void, time?: number) => number, (id: number) => void];
type OriginSlot = Record<symbol, unknown>;
type RafState = {req: Promise<unknown> | null; count: number; id: number};

// let bid = 0;
const bounce = {
  origin: Symbol('origin'),
  idle<F extends Fn>(func: F, time?: number): (...args: Parameters<F>) => Handler {
    let reqId: Timer = null;
    let lastArgs: Parameters<F> | null = null;
    let promise = new PromiseHandler();

    const [caller, canceller] = ((time === undefined && self.requestIdleCallback) ?
        [self.requestIdleCallback, self.cancelIdleCallback] : [self.setTimeout, self.clearTimeout]) as Scheduler;
    const callback = () => {
      const lastResult = func(...(lastArgs as Parameters<F>));
      promise.resolve({lastResult, lastArgs});
      reqId = lastArgs = null;
      promise = new PromiseHandler();
    };
    const result = (...args: Parameters<F>) => {
      if (reqId) {
        reqId = canceller(reqId);
      }
      lastArgs = args;
      reqId = caller(callback, time);
      return promise;
    };
    (result as unknown as OriginSlot)[this.origin] = func;
    return result;
  },
  time<F extends Fn>(func: F, time = 0): (...args: Parameters<F>) => Handler {
    return this.idle(func, time);
  }
};
const throttle = (func: Fn, interval: number) => {
  let lastTime = 0;
  let timer: Timer;
  let promise = new PromiseHandler();

  const result = (...args: AnyArgs) => {
    if (timer) {
      return promise;
    }
    const now = performance.now();
    const timeDiff = now - lastTime;

    timer = setTimeout(() => {
      lastTime = performance.now();
      timer = null;
      const lastResult = func(...args);
      promise.resolve({lastResult, lastArgs: args});
      promise = new PromiseHandler();
    }, Math.max(interval - timeDiff, 0));

    return promise;
  };

  result.cancel = () => {
    if (timer) {
      timer = clearTimeout(timer);
    }
    promise.resolve({lastResult: null, lastArgs: null});
    promise = new PromiseHandler();
  };
  return result;
};

throttle.time = (func: Fn, interval = 0) => throttle(func, interval);


throttle.raf = function(this: RafState, func: Fn) {
  let promise: Promise<unknown> | null;
  let cancelled = false;
  let lastArgs: AnyArgs = [];

  const callRaf = (res: (time: number) => void) => requestAnimationFrame(res);
  const onRaf = () => this.req = null;
  const onCall = () => {
    if (cancelled) {
      cancelled = false;
      return;
    }
    try { func(...lastArgs); } catch (e) { console.warn(e); }
    promise = null;
  };
  const result = (...args: AnyArgs) => {
    lastArgs = args;
    if (promise) {
      return promise;
    }
    if (!this.req) {
      this.req = new Promise(callRaf).then(onRaf);
    }
    promise = this.req.then(onCall);
    return promise;
  };

  result.cancel = () => {
    cancelled = true;
    promise = null;
  };

  return result;
}.bind({req: null, count: 0, id: 0});

// throttle.raf = func => throttle.time(func, 0);

throttle.idle = (func: Fn) => {
  let id: Timer;
  const request = (self.requestIdleCallback || self.setTimeout) as Scheduler[0];
  const cancel = (self.cancelIdleCallback || self.clearTimeout) as Scheduler[1];

  const result = (...args: AnyArgs) => {
    if (id) {
      return;
    }
    id = request(() => {
      id = null;
      func(...args);
    }, 0);
  };

  result.cancel = () => {
    if (id) {
      id = cancel(id);
    }
  };

  return result;
};

export {bounce, throttle};
