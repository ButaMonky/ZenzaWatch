// ==UserScript==
// @name        ZenzaWatch 上級者用設定
// @namespace   https://github.com/segabito/
// @description1 ZenzaWatchの上級者向け設定。変更する時だけ有効にすればOK
// @include     *//www.nicovideo.jp/my*
// @version     0.3.82-task976
// @author      segabito macmoto
// @license     public domain
// @grant       none
// @noframes
// @require     https://cdn.jsdelivr.net/npm/lodash@4.18.1/lodash.min.js
// @homepageURL    https://github.com/ButaMonky/ZenzaWatch
// @supportURL     https://github.com/ButaMonky/ZenzaWatch/issues
// @downloadURL    https://github.com/ButaMonky/ZenzaWatch/raw/develop/dist/ZenzaAdvancedSettings.user.js
// @updateURL      https://github.com/ButaMonky/ZenzaWatch/raw/develop/dist/ZenzaAdvancedSettings.user.js
// ==/UserScript==
// build: 2026-10-27 18:43Z ef81b7d1
/* eslint-disable */
// CommentDisplayBudget は Config の //@require で同じスコープに入る（ここで重ねてrequireしない）
((window) => {
    const self = window;
    const PRODUCT = 'ZenzaWatch';
    const monkey = async (PRODUCT) => {
        const _ = window._;
        const Array = window.PureArray || window.Array;
function EmitterInitFunc() {
		class Handler {
				constructor(...args) {
						this._list = args;
				}
				get length() {
						return this._list.length;
				}
				exec(...args) {
						const pending = this._list.slice();
						for (let i = pending.length - 1; i >= 0; i--) {
								const member = pending[i];
								if (this._list.includes(member)) {
										member.apply(this._list, args);
								}
						}
				}
				execMethod(name, ...args) {
						const pending = this._list.slice();
						for (let i = pending.length - 1; i >= 0; i--) {
								const member = pending[i];
								if (this._list.includes(member)) {
										member[name](...args);
								}
						}
				}
				add(member) {
						if (this._list.includes(member)) {
								return this;
						}
						this._list.unshift(member);
						return this;
				}
				remove(member) {
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
		Handler.nop = () => { };
		const PromiseHandler = (() => {
				const id = function () { return `Promise${this.id++}`; }.bind({ id: 0 });
				class PromiseHandler extends Promise {
						constructor(callback = () => { }) {
								const key = new Object({ id: id(), callback, status: 'pending' });
								const cb = function (res, rej) {
										const resolve = (...args) => { this.status = 'resolved'; this.value = args; res(...args); };
										const reject = (...args) => { this.status = 'rejected'; this.value = args; rej(...args); };
										if (this.result) {
												return this.result.then(resolve, reject);
										}
										Object.assign(this, { resolve, reject });
										return callback(resolve, reject);
								}.bind(key);
								super(cb);
								this.resolve = this.resolve.bind(this);
								this.reject = this.reject.bind(this);
								this.key = key;
						}
						resolve(...args) {
								if (this.key.resolve) {
										this.key.resolve(...args);
								}
								else {
										this.key.result = Promise.resolve(...args);
								}
								return this;
						}
						reject(...args) {
								if (this.key.reject) {
										this.key.reject(...args);
								}
								else {
										this.key.result = Promise.reject(...args);
								}
								return this;
						}
						addCallback(callback) {
								Promise.resolve().then(() => callback(this.resolve, this.reject));
								return this;
						}
				}
				return PromiseHandler;
		})();
		const { Emitter } = (() => {
				let totalCount = 0;
				let warnings = [];
				class Emitter {
						on(name, callback) {
								if (!this._events) {
										Emitter.totalCount++;
										this._events = new Map();
								}
								name = name.toLowerCase();
								let e = this._events.get(name);
								if (!e) {
										const handler = new Handler(callback);
										handler.name = name;
										this._events.set(name, handler);
										e = handler;
								}
								else {
										e.add(callback);
								}
								if (e.length > 10) {
										console.warn('listener count > 10', name, e, callback);
										!Emitter.warnings.includes(this) && Emitter.warnings.push(this);
								}
								return this;
						}
						off(name, callback) {
								if (!this._events) {
										return;
								}
								name = name.toLowerCase();
								const e = this._events.get(name);
								if (!this._events.has(name)) {
										return;
								}
								else if (!callback) {
										this._events.delete(name);
								}
								else {
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
										Emitter.totalCount--;
								}
								return this;
						}
						once(name, func) {
								const wrapper = (...args) => {
										this.off(name, wrapper);
										wrapper._original = null;
										func(...args);
								};
								wrapper._original = func;
								return this.on(name, wrapper);
						}
						clear(name) {
								if (!this._events) {
										return;
								}
								if (name) {
										this._events.delete(name.toLowerCase());
								}
								else {
										delete this._events;
										Emitter.totalCount--;
								}
								return this;
						}
						emit(name, ...args) {
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
						emitAsync(...args) {
								if (!this._events) {
										return;
								}
								setTimeout(() => this.emit(...args), 0);
								return this;
						}
						promise(name, callback) {
								if (!this._promise) {
										this._promise = new Map;
								}
								const p = this._promise.get(name);
								if (p) {
										return callback ? p.addCallback(callback) : p;
								}
								this._promise.set(name, new PromiseHandler(callback));
								return this._promise.get(name);
						}
						emitResolve(name, ...args) {
								if (!this._promise) {
										this._promise = new Map;
								}
								if (!this._promise.has(name)) {
										this._promise.set(name, new PromiseHandler());
								}
								return this._promise.get(name).resolve(...args);
						}
						emitReject(name, ...args) {
								if (!this._promise) {
										this._promise = new Map;
								}
								if (!this._promise.has(name)) {
										this._promise.set(name, new PromiseHandler);
								}
								return this._promise.get(name).reject(...args);
						}
						resetPromise(name) {
								if (!this._promise) {
										return;
								}
								this._promise.delete(name);
						}
						hasPromise(name) {
								return this._promise && this._promise.has(name);
						}
						addEventListener(...args) { return this.on(...args); }
						removeEventListener(...args) { return this.off(...args); }
				}
				Emitter.totalCount = totalCount;
				Emitter.warnings = warnings;
				return { Emitter };
		})();
		return { Handler, PromiseHandler, Emitter };
}
const { Handler, PromiseHandler, Emitter } = EmitterInitFunc();
const StorageWriter = (() => {
		const func = function (self) {
				self.onmessage = ({ command, params }) => {
						const { obj, replacer, space } = params;
						return JSON.stringify(obj, replacer || null, space || 0);
				};
		};
		let worker;
		const prototypePollution = window.Prototype && Array.prototype.hasOwnProperty('toJSON');
		const toJson = async (obj, replacer = null, space = 0) => {
				if (!prototypePollution || obj === null || ['string', 'number', 'boolean'].includes(typeof obj)) {
						return JSON.stringify(obj, replacer, space);
				}
				worker = worker || workerUtil.createCrossMessageWorker(func, { name: 'ToJsonWorker' });
				return worker.post({ command: 'toJson', params: { obj, replacer, space } });
		};
		const writer = Symbol('StorageWriter');
		const setItem = (storage, key, value) => {
				if (!prototypePollution || value === null || ['string', 'number', 'boolean'].includes(typeof value)) {
						storage.setItem(key, JSON.stringify(value));
				}
				else {
						toJson(value).then(json => storage.setItem(key, json));
				}
		};
		localStorage[writer] = (key, value) => setItem(localStorage, key, value);
		sessionStorage[writer] = (key, value) => setItem(sessionStorage, key, value);
		return { writer, toJson };
})();
const objUtil = (() => {
		const isObject = (e) => e !== null && e instanceof Object;
		const PROPS = Symbol('PROPS');
		const REVISION = Symbol('REVISION');
		const CHANGED = Symbol('CHANGED');
		const HAS = Symbol('HAS');
		const SET = Symbol('SET');
		const GET = Symbol('GET');
		return {
				bridge: (self, target, keys = null) => {
						(keys || Object.getOwnPropertyNames(target.constructor.prototype))
								.filter(key => typeof target[key] === 'function')
								.forEach(key => self[key] = target[key].bind(target));
				},
				isObject,
				toMap: (obj, mapper = Map) => {
						if (obj instanceof mapper) {
								return obj;
						}
						return new mapper(Object.entries(obj));
				},
				mapToObj: (map) => {
						if (!(map instanceof Map)) {
								return map;
						}
						const obj = {};
						for (const [key, val] of map) {
								obj[key] = val;
						}
						return obj;
				}
		};
})();
const Observable = (() => {
		const observableSymbol = Symbol.observable || Symbol('observable');
		const nop = Handler.nop;
		class Subscription {
				constructor({ observable, subscriber, unsubscribe, closed }) {
						this.callbacks = { unsubscribe, closed };
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
						if (this._closed) {
								return this;
						}
						this._closed = true;
						if (this.callbacks.unsubscribe) {
								this.callbacks.unsubscribe();
						}
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
						}
						else {
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
						return new this((onNext || {}));
				}
				constructor({ start, next, error, complete, closed } = {}) {
						this.callbacks = {
								start: typeof start === 'function' ? start : nop,
								next: typeof next === 'function' ? next : nop,
								error: typeof error === 'function' ? error : nop,
								complete: typeof complete === 'function' ? complete : nop,
								closed: typeof closed === 'function' ? closed : () => false
						};
				}
				start(arg) { this.callbacks.start(arg); }
				next(arg) { this.callbacks.next(arg); }
				error(arg) { this.callbacks.error(arg); }
				complete(arg) { this.callbacks.complete(arg); }
				get closed() {
						return this.callbacks.closed();
				}
		}
		Subscriber.nop = { start: nop, next: nop, error: nop, complete: nop, closed: nop };
		const eleMap = new WeakMap();
		class Observable {
				static of(...args) {
						return new this(o => {
								for (const arg of args) {
										o.next(arg);
								}
								o.complete();
								return () => { };
						});
				}
				static from(arg) {
						if (arg[Symbol.iterator]) {
								return this.of(...arg);
						}
						else if (arg[Observable.observavle]) {
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
								const onUpdate = (e) => o.next(e);
								element.addEventListener(eventName, onUpdate, { passive: true });
								return () => element.removeEventListener(eventName, onUpdate);
						});
				}
				static interval(ms) {
						return new this(function (o) {
								const timer = setInterval(() => o.next(this.i++), ms);
								return () => clearInterval(timer);
						}.bind({ i: 0 }));
				}
				constructor(subscriberFunction) {
						this._subscriberFunction = subscriberFunction;
						this._sources = [];
						this._connection = null;
				}
				get closed() { return !!(this._connection && this._connection.closed); }
				_disposeToken(token) {
						token.done = true;
						if (!token.cleanup) {
								return;
						}
						const cleanup = token.cleanup;
						token.cleanup = null;
						try {
								cleanup();
						}
						catch (error) {
								console.warn('Observable cleanup failed', error);
						}
				}
				_finish(connection, method, value) {
						if (connection.closed) {
								return;
						}
						connection.closed = true;
						try {
								if (method) {
										connection.handlers.execMethod(method, value);
								}
						}
						finally {
								connection.handlers.clear();
								for (const token of connection.tokens) {
										this._disposeToken(token);
								}
								connection.tokens.clear();
						}
				}
				_connect(connection) {
						connection.started = true;
						const sources = [observer => this._subscriberFunction(observer),
								...this._sources.map(source => (observer) => source.subscribe({
										next: (value) => observer.next(value), error: (error) => observer.error(error),
										complete: (value) => observer.complete(value)
								}))];
						let index = 0;
						const advance = (completion) => {
								if (connection.closed) {
										return;
								}
								if (index === sources.length) {
										this._finish(connection, 'complete', completion);
										return;
								}
								const producer = sources[index++];
								const token = { done: false, cleanup: null };
								connection.tokens.add(token);
								const active = () => !connection.closed && !token.done;
								const observer = new Subscriber({
										start: (value) => { if (active()) {
												connection.handlers.execMethod('start', value);
										} },
										next: (value) => { if (active()) {
												connection.handlers.execMethod('next', value);
										} },
										error: (error) => { if (active()) {
												this._finish(connection, 'error', error);
										} },
										complete: (value) => {
												if (!active()) {
														return;
												}
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
										if (token.done || connection.closed) {
												this._disposeToken(token);
										}
								}
								catch (error) {
										observer.error(error);
								}
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
						if (!observable || observable === this) {
								throw new TypeError('Invalid concatenated Observable');
						}
						const pending = [observable], seen = new Set();
						while (pending.length) {
								const source = pending.pop();
								if (source === this) {
										throw new TypeError('Cyclic concatenated Observable');
								}
								if (seen.has(source)) {
										continue;
								}
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
								next: (arg) => {
										const lp = p;
										p = new PromiseHandler();
										lp.resolve(arg);
										callback(p);
								},
								error: (arg) => {
										const lp = p;
										p = new PromiseHandler();
										lp.reject(arg);
										callback(p);
								}
						});
				}
				onStart(arg) { this._subscriber.start(arg); }
				onNext(arg) { this._subscriber.next(arg); }
				onError(arg) { this._subscriber.error(arg); }
				onComplete(arg) { this._subscriber.complete(arg); }
				disconnect() {
						if (this._connection) {
								this._finish(this._connection);
						}
				}
				[observableSymbol]() { return this; }
				subscribe(onNext = null, onError = null, onCompleted = null) {
						return this._subscribe({
								subscriber: Subscriber.create(onNext, onError, onCompleted),
								isNop: [onNext, onError, onCompleted].every(f => f === null)
						});
				}
				_subscribe({ subscriber, isNop, filterFunc, mapFunc }) {
						let connection = this._connection;
						if (!connection || connection.closed) {
								connection = { closed: false, started: false, handlers: new Handler(), tokens: new Set() };
								if (!isNop) {
										this._connection = connection;
								}
						}
						const subscription = new Subscription({
								observable: this, subscriber,
								unsubscribe: () => {
										if (isNop) {
												return;
										}
										connection.handlers.remove(subscriber);
										if (connection.handlers.isEmpty) {
												this._finish(connection);
										}
								},
								closed: () => connection.closed
						}).filter(filterFunc).map(mapFunc);
						if (isNop) {
								return subscription;
						}
						connection.handlers.add(subscriber);
						try {
								subscriber.start(subscription);
						}
						catch (error) {
								subscription.unsubscribe();
								throw error;
						}
						if (!connection.closed && !connection.started) {
								this._connect(connection);
						}
						return subscription;
				}
		}
		Observable.observavle = observableSymbol;
		return Observable;
})();
const WindowResizeObserver = Observable.fromEvent(window, 'resize')
		.map(o => { return { width: window.innerWidth, height: window.innerHeight }; });
const bounce = {
		origin: Symbol('origin'),
		idle(func, time) {
				let reqId = null;
				let lastArgs = null;
				let promise = new PromiseHandler();
				const [caller, canceller] = ((time === undefined && self.requestIdleCallback) ?
						[self.requestIdleCallback, self.cancelIdleCallback] : [self.setTimeout, self.clearTimeout]);
				const callback = () => {
						const lastResult = func(...lastArgs);
						promise.resolve({ lastResult, lastArgs });
						reqId = lastArgs = null;
						promise = new PromiseHandler();
				};
				const result = (...args) => {
						if (reqId) {
								reqId = canceller(reqId);
						}
						lastArgs = args;
						reqId = caller(callback, time);
						return promise;
				};
				result[this.origin] = func;
				return result;
		},
		time(func, time = 0) {
				return this.idle(func, time);
		}
};
const throttle = (func, interval) => {
		let lastTime = 0;
		let timer;
		let promise = new PromiseHandler();
		const result = (...args) => {
				if (timer) {
						return promise;
				}
				const now = performance.now();
				const timeDiff = now - lastTime;
				timer = setTimeout(() => {
						lastTime = performance.now();
						timer = null;
						const lastResult = func(...args);
						promise.resolve({ lastResult, lastArgs: args });
						promise = new PromiseHandler();
				}, Math.max(interval - timeDiff, 0));
				return promise;
		};
		result.cancel = () => {
				if (timer) {
						timer = clearTimeout(timer);
				}
				promise.resolve({ lastResult: null, lastArgs: null });
				promise = new PromiseHandler();
		};
		return result;
};
throttle.time = (func, interval = 0) => throttle(func, interval);
throttle.raf = function (func) {
		let promise;
		let cancelled = false;
		let lastArgs = [];
		const callRaf = (res) => requestAnimationFrame(res);
		const onRaf = () => this.req = null;
		const onCall = () => {
				if (cancelled) {
						cancelled = false;
						return;
				}
				try {
						func(...lastArgs);
				}
				catch (e) {
						console.warn(e);
				}
				promise = null;
		};
		const result = (...args) => {
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
}.bind({ req: null, count: 0, id: 0 });
throttle.idle = (func) => {
		let id;
		const request = (self.requestIdleCallback || self.setTimeout);
		const cancel = (self.cancelIdleCallback || self.clearTimeout);
		const result = (...args) => {
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
class DataStorage {
	static create(defaultData, options = {}) {
		return new DataStorage(defaultData, options);
	}
	static clone(dataStorage) {
		const options = {
			prefix:  dataStorage.prefix,
			storage: dataStorage.storage,
			ignoreExportKeys: dataStorage.options.ignoreExportKeys,
			readonly: dataStorage.readonly,
			normalizeImport: dataStorage.options.normalizeImport,
			validateImport: dataStorage.options.validateImport,
			preserveInvalidKeys: dataStorage.options.preserveInvalidKeys
		};
		return DataStorage.create(dataStorage.default, options);
	}
	constructor(defaultData, options = {}) {
		this.options = options;
		this.default = defaultData;
		this._data = Object.assign({}, defaultData);
		this.prefix = `${options.prefix || 'DATA'}_`;
		this.storage = options.storage || localStorage;
		this._ignoreExportKeys = options.ignoreExportKeys || [];
		this.readonly = options.readonly;
		this.silently = false;
		this._changed = new Map();
		this._onChange = bounce.time(this._onChange.bind(this));
		objUtil.bridge(this, new Emitter());
		this.restoreError = null;
		this.restore().catch(error => {
			this.restoreError = error;
			this._data = Object.assign({}, defaultData);
			window.console.error('DataStorage restore failed; using defaults',
				{name: error && error.name});
		}).then(() => {
			this.props = this._makeProps(defaultData);
			this.emitResolve('restore');
		});
		this.logger = (self || window).console;
		this.consoleSubscriber = {
			next: (v, ...args) => this.logger.log('next', v, ...args),
			error: (e, ...args) => this.logger.warn('error', e, ...args),
			complete: (c, ...args) => this.logger.log('complete', c, ...args)
		};
	}
	_makeProps(defaultData = {}, namespace = '') {
		namespace = namespace ? `${namespace}.` : '';
		const self = this;
		const def = {};
		const props = {};
		Object.keys(defaultData).sort()
			.filter(key => key.includes(namespace))
			.forEach(key => {
				const k = key.slice(namespace.length);
				if (k.includes('.')) {
					const ns = k.slice(0, k.indexOf('.'));
					props[ns] = this._makeProps(defaultData, `${namespace}${ns}`);
				}
				def[k] = {
					enumerable: !this._ignoreExportKeys.includes(key),
					get() { return self.getValue(key); },
					set(v) { self.setValue(key, v); }
				};
		});
		Object.defineProperties(props, def);
		return props;
	}
	_onChange() {
		const changed = this._changed;
		this.emit('change', changed);
		for (const [key, val] of changed) {
			this.emitAsync('update', key, val);
			this.emitAsync(`update-${key}`, val);
		}
		this._changed.clear();
	}
	onkey(key, callback) {
		this.on(`update-${key}`, callback);
	}
	offkey(key, callback) {
		this.off(`update-${key}`, callback);
	}
	async restore(storage) {
		storage = storage || this.storage;
		Object.keys(this.default).forEach(key => {
			const storageKey = this.getStorageKey(key);
			if (storage.hasOwnProperty(storageKey) || storage[storageKey] !== undefined) {
				try {
					this._data[key] = JSON.parse(storage[storageKey]);
				} catch (e) {
					console.error('DataStorage restore parse failed for key', key);
					if (!this.readonly && !this.options?.preserveInvalidKeys?.includes(key)) { delete storage[storageKey]; }
					this._data[key] = this.default[key];
				}
			} else {
				this._data[key] = this.default[key];
			}
		});
	}
	getNativeKey(key) {
		return key;
	}
	getStorageKey(key) {
		return `${this.prefix}${key}`;
	}
	async refresh(key, storage) {
		storage = storage || this.storage;
		key = this.getNativeKey(key);
		const storageKey = this.getStorageKey(key);
		if (storage.hasOwnProperty(storageKey) || storage[storageKey] !== undefined) {
			try {
				this._data[key] = JSON.parse(storage[storageKey]);
			} catch (e) {
				console.error('DataStorage refresh parse failed for key', key);
			}
		}
		return this._data[key];
	}
	getValue(key) {
		key = this.getNativeKey(key);
		return this._data[key];
	}
	deleteValue(key) {
		key = this.getNativeKey(key);
		const storageKey = this.getStorageKey(key);
		if (!this.readonly) { this.storage.removeItem(storageKey); }
		this._data[key] = this.default[key];
	}
	setValue(key, value) {
		const _key = key;
		key = this.getNativeKey(key);
		if (this._data[key] === value || value === undefined) {
			return;
		}
		const storageKey = this.getStorageKey(key);
		const storage = this.storage;
		if (!this.readonly) {
			try {
				if (typeof value === 'number' && !Number.isFinite(value)) {
					throw new TypeError('Cannot serialize non-finite DataStorage number');
				}
				const json = JSON.stringify(value);
				if (json === undefined) {
					throw new TypeError('Cannot serialize DataStorage value');
				}
				storage[storageKey] = json;
			} catch (e) {
				window.console.error(e);
				return false;
			}
		}
		this._data[key] = value;
		if (!this.silently) {
			this._changed.set(_key, value);
			this._onChange();
		}
	}
	setValueSilently(key, value) {
		const isSilent = this.silently;
		this.silently = true;
		this.setValue(key, value);
		this.silently = isSilent;
	}
	export(isAll = false) {
		const result = {};
		const _default = this.default;
		Object.keys(this.props)
			.filter(key => isAll || (_default[key] !== this._data[key]))
			.forEach(key => result[key] = this.getValue(key));
		return result;
	}
	exportJson() {
		return JSON.stringify(this.export(), null, 2);
	}
	import(data) {
		if (!data || typeof data !== 'object' || Array.isArray(data)) {
			throw new TypeError('設定データはJSONオブジェクトで指定してください。');
		}
		const entries = Object.keys(this.default)
			.filter(key => !this._ignoreExportKeys.includes(key))
			.map(key => {
				const raw = Object.prototype.hasOwnProperty.call(data, key) ? data[key] : this.default[key];
				const value = this.options.normalizeImport ? this.options.normalizeImport(key, raw) : raw;
				const expected = this.default[key];
				if (typeof value !== typeof expected || value === null && expected !== null ||
						Array.isArray(value) !== Array.isArray(expected) ||
						typeof value === 'number' && !Number.isFinite(value) ||
						this.options.validateImport && !this.options.validateImport(key, value)) {
					throw new TypeError(`設定値が不正です: ${key}`);
				}
				const json = JSON.stringify(value);
				if (json === undefined) { throw new TypeError(`設定値を保存できません: ${key}`); }
				return {key, value, json, storageKey: this.getStorageKey(key)};
			});
		if (!this.readonly) {
			const written = [];
			try {
				for (const entry of entries) {
					const previous = this.storage[entry.storageKey];
					this.storage[entry.storageKey] = entry.json;
					written.push({key: entry.storageKey, previous});
				}
			} catch (error) {
				for (const {key, previous} of written.reverse()) {
					try {
						if (previous === undefined) { delete this.storage[key]; }
						else { this.storage[key] = previous; }
					} catch (restoreError) { window.console.error('設定の復元に失敗しました', restoreError); }
				}
				throw error;
			}
		}
		for (const {key, value} of entries) { this._data[key] = value; }
	}
	importJson(json) {
		this.import(JSON.parse(json));
	}
	getKeys() {
		return Object.keys(this.props);
	}
	clearConfig() {
		this.silently = true;
		const storage = this.storage;
		Object.keys(this.default)
			.filter(key => !this._ignoreExportKeys.includes(key)).forEach(key => {
				const storageKey = this.getStorageKey(key);
				try {
					if (!this.readonly && (storage.hasOwnProperty(storageKey) || storage[storageKey] !== undefined)) {
						console.log('delete storage', storageKey);
						delete storage[storageKey];
					}
					this._data[key] = this.default[key];
				} catch (e) {}
		});
		this.silently = false;
	}
	namespace(name) {
		const namespace = name ? `${name}.` : '';
		const updateListeners = new Map();
		const result = {
			getValue: key => this.getValue(`${namespace}${key}`),
			setValue: (key, value) => this.setValue(`${namespace}${key}`, value),
			on: (key, func) => {
				if (key === 'update') {
					if (updateListeners.has(func)) { return result; }
					const onUpdate = (key, value) => {
						if (key.startsWith(namespace)) {
							func(key.slice(namespace.length), value);
						}
					};
					updateListeners.set(func, onUpdate);
					this.on('update', onUpdate);
					return result;
				}
				return this.onkey(`${namespace}${key}`, func);
			},
			off: (key, func) => {
				if (key === 'update') {
					if (!func) {
						for (const listener of updateListeners.values()) {
							this.off('update', listener);
						}
						updateListeners.clear();
					} else if (updateListeners.has(func)) {
						this.off('update', updateListeners.get(func));
						updateListeners.delete(func);
					}
					return result;
				}
				return this.offkey(`${namespace}${key}`, func);
			},
			onkey: (key, func) => {
				this.on(`update-${namespace}${key}`, func);
				return result;
			},
			offkey: (key, func) => {
				this.off(`update-${namespace}${key}`, func);
				return result;
			},
			props: this.props[name],
			refresh: () => this.refresh(),
			subscribe: subscriber => {
				return this.subscribe(subscriber)
					.filter(changed => changed.keys().some(k => k.startsWith(namespace)))
					.map(changed => {
						const result = new Map;
						for (const k of changed.keys()) {
							k.startsWith(namespace) && result.set(k, changed.get(k));
						}
						return result;
					});
			}
		};
		return result;
	}
	subscribe(subscriber) {
		subscriber = subscriber || this.consoleSubscriber;
		const observable = new Observable(o => {
			const onChange = changed => o.next(changed);
			this.on('change', onChange);
			return () => this.off('change', onChange);
		});
		return observable.subscribe(subscriber);
	}
	watch() {
	}
	unwatch() {
		this.consoleSubscription && this.consoleSubscription.unsubscribe();
		this.consoleSubscription = null;
	}
}
const KEY_MOD = {
		SHIFT: 0x1000,
		CTRL: 0x10000,
		ALT: 0x100000,
		META: 0x1000000
};
const encodeKeyCombo = (e) => {
		return (e.keyCode || 0) +
				(e.metaKey ? KEY_MOD.META : 0) +
				(e.altKey ? KEY_MOD.ALT : 0) +
				(e.ctrlKey ? KEY_MOD.CTRL : 0) +
				(e.shiftKey ? KEY_MOD.SHIFT : 0);
};
const KEY_NAME_TABLE = {
		8: 'Backspace', 9: 'Tab', 13: 'Enter', 19: 'Pause', 20: 'CapsLock',
		27: 'Esc', 32: 'Space', 33: 'PageUp', 34: 'PageDown', 35: 'End', 36: 'Home',
		37: '←', 38: '↑', 39: '→', 40: '↓',
		45: 'Insert', 46: 'Delete',
		48: '0', 49: '1', 50: '2', 51: '3', 52: '4', 53: '5', 54: '6', 55: '7', 56: '8', 57: '9',
		65: 'A', 66: 'B', 67: 'C', 68: 'D', 69: 'E', 70: 'F', 71: 'G', 72: 'H', 73: 'I',
		74: 'J', 75: 'K', 76: 'L', 77: 'M', 78: 'N', 79: 'O', 80: 'P', 81: 'Q', 82: 'R',
		83: 'S', 84: 'T', 85: 'U', 86: 'V', 87: 'W', 88: 'X', 89: 'Y', 90: 'Z',
		106: 'Num*', 107: 'Num+', 109: 'Num-', 110: 'Num.', 111: 'Num/',
		112: 'F1', 113: 'F2', 114: 'F3', 115: 'F4', 116: 'F5', 117: 'F6',
		118: 'F7', 119: 'F8', 120: 'F9', 121: 'F10', 122: 'F11', 123: 'F12',
		173: 'Mute', 174: 'VolDown', 175: 'VolUp',
		176: 'MediaNext', 177: 'MediaPrev', 178: 'MediaStop', 179: 'MediaPlay',
		186: ';', 187: '=', 188: ',', 189: '-', 190: '.', 191: '/', 192: '`',
		219: '[', 220: '\\', 221: ']', 222: '\''
};
for (let i = 96; i <= 105; i++) {
		KEY_NAME_TABLE[i] = 'Num' + (i - 96);
}
const formatKeyCombo = (code) => {
		code = parseInt(code, 10) || 0;
		if (!code) {
				return '(未設定)';
		}
		if (code >= 90000000) {
				return '(未割り当て/カスタム値)';
		}
		const mods = [];
		let rest = code;
		if (rest >= KEY_MOD.META) {
				mods.push('Meta');
				rest -= KEY_MOD.META;
		}
		if (rest >= KEY_MOD.ALT) {
				mods.push('Alt');
				rest -= KEY_MOD.ALT;
		}
		if (rest >= KEY_MOD.CTRL) {
				mods.push('Ctrl');
				rest -= KEY_MOD.CTRL;
		}
		if (rest >= KEY_MOD.SHIFT) {
				mods.push('Shift');
				rest -= KEY_MOD.SHIFT;
		}
		mods.push(KEY_NAME_TABLE[rest] || ('#' + rest));
		return mods.join(' + ');
};
// =====================================================================
// =====================================================================
const SHORTCUT_ACTIONS = [
		{ id: 'CLOSE', legacy: true, category: 'プレイヤー全般', label: '閉じる',
				defaultKey: 27, command: 'close' },
		{ id: 'RE_OPEN', legacy: true, category: 'プレイヤー全般',
				label: '今見ている動画を再読み込み(閉じている時は直前に見ていた動画を開く)',
				defaultKey: 27 + KEY_MOD.SHIFT, command: 'reload' },
		{ id: 'HOME', legacy: true, category: 'シーク', label: '先頭へシーク',
				defaultKey: 36 + KEY_MOD.SHIFT, command: 'seekTo', param: 0 },
		{ id: 'SEEK_LEFT', legacy: true, category: 'シーク', label: '5秒戻る(Shift+←/←長押しでも可)',
				defaultKey: 37 + KEY_MOD.SHIFT, command: 'seekBy', param: -5 },
		{ id: 'SEEK_RIGHT', legacy: true, category: 'シーク', label: '5秒進む(Shift+→/→長押しでも可)',
				defaultKey: 39 + KEY_MOD.SHIFT, command: 'seekBy', param: 5 },
		{ id: 'SEEK_PREV_FRAME', legacy: true, category: 'シーク', label: '1コマ戻る',
				defaultKey: 188, command: 'seekPrevFrame' },
		{ id: 'SEEK_NEXT_FRAME', legacy: true, category: 'シーク', label: '1コマ進む',
				defaultKey: 190, command: 'seekNextFrame' },
		{ id: 'VOL_UP', legacy: true, category: '音量', label: '音量を上げる',
				defaultKey: 38 + KEY_MOD.SHIFT, command: 'volumeUp' },
		{ id: 'VOL_DOWN', legacy: true, category: '音量', label: '音量を下げる',
				defaultKey: 40 + KEY_MOD.SHIFT, command: 'volumeDown' },
		{ id: 'INPUT_COMMENT', legacy: true, category: 'コメント', label: 'コメント入力欄にフォーカス',
				defaultKey: 67, command: '(専用処理)' },
		{ id: 'FULLSCREEN', legacy: true, category: '画面', label: 'フルスクリーン ON/OFF',
				defaultKey: 70, command: 'toggle-fullscreen' },
		{ id: 'MUTE', legacy: true, category: '音量', label: 'ミュート ON/OFF',
				defaultKey: 77, command: 'toggle-mute' },
		{ id: 'TOGGLE_COMMENT', legacy: true, category: 'コメント', label: 'コメント表示 ON/OFF',
				defaultKey: 86, command: 'toggle-showComment' },
		{ id: 'TOGGLE_LOOP', legacy: true, category: '再生', label: 'ループ再生 ON/OFF',
				defaultKey: 82, command: 'toggle-loop' },
		{ id: 'DEFLIST_ADD', legacy: true, category: 'マイリスト', label: 'あとで見るへ追加',
				defaultKey: 84, command: 'deflistAdd' },
		{ id: 'DEFLIST_REMOVE', legacy: true, category: 'マイリスト', label: 'あとで見るから削除',
				defaultKey: 84 + KEY_MOD.SHIFT, command: 'deflistRemove' },
		{ id: 'TOGGLE_PLAY', legacy: true, category: '再生', label: '再生 / 一時停止',
				defaultKey: 32, command: 'togglePlay' },
		{ id: 'TOGGLE_PLAYLIST', legacy: true, category: 'プレイリスト', label: 'プレイリスト表示 ON/OFF',
				defaultKey: 80, command: 'togglePlaylist' },
		{ id: 'SCREEN_MODE_1', legacy: true, category: '画面', label: '画面モード: 小',
				defaultKey: 49 + KEY_MOD.SHIFT, command: 'screenMode', param: 'small' },
		{ id: 'SCREEN_MODE_2', legacy: true, category: '画面', label: '画面モード: サイドビュー',
				defaultKey: 50 + KEY_MOD.SHIFT, command: 'screenMode', param: 'sideView' },
		{ id: 'SCREEN_MODE_3', legacy: true, category: '画面', label: '画面モード: 3D',
				defaultKey: 51 + KEY_MOD.SHIFT, command: 'screenMode', param: '3D' },
		{ id: 'SCREEN_MODE_4', legacy: true, category: '画面', label: '画面モード: 通常',
				defaultKey: 52 + KEY_MOD.SHIFT, command: 'screenMode', param: 'normal' },
		{ id: 'SCREEN_MODE_5', legacy: true, category: '画面', label: '画面モード: 大',
				defaultKey: 53 + KEY_MOD.SHIFT, command: 'screenMode', param: 'big' },
		{ id: 'SCREEN_MODE_6', legacy: true, category: '画面', label: '画面モード: ワイド',
				defaultKey: 54 + KEY_MOD.SHIFT, command: 'screenMode', param: 'wide' },
		{ id: 'SHIFT_RESET', legacy: true, category: '再生速度', label: '押している間だけ超低速再生',
				defaultKey: 49, command: 'playbackRate' },
		{ id: 'SHIFT_DOWN', legacy: true, category: '再生速度', label: '再生速度を下げる',
				defaultKey: 188 + KEY_MOD.SHIFT, command: 'shiftDown' },
		{ id: 'SHIFT_UP', legacy: true, category: '再生速度', label: '再生速度を上げる',
				defaultKey: 190 + KEY_MOD.SHIFT, command: 'shiftUp' },
		{ id: 'NEXT_VIDEO', legacy: true, category: 'プレイリスト', label: '次の動画',
				defaultKey: 74, command: 'playNextVideo' },
		{ id: 'PREV_VIDEO', legacy: true, category: 'プレイリスト', label: '前の動画',
				defaultKey: 75, command: 'playPreviousVideo' },
		{ id: 'SCREEN_SHOT', legacy: true, category: 'その他', label: 'スクリーンショット',
				defaultKey: 83, command: 'screenShot' },
		{ id: 'SCREEN_SHOT_WITH_COMMENT', legacy: true, category: 'その他', label: 'スクリーンショット(コメント付き)',
				defaultKey: 83 + KEY_MOD.SHIFT, command: 'screenShotWithComment' },
		{ id: 'TOGGLE_NOTIFICATION_HISTORY', category: 'その他', label: '通知・エラー履歴を開く/閉じる',
				defaultKey: 0, command: 'toggle-notificationHistory' },
		{ id: 'TOGGLE_LIKE', category: '再生', label: 'いいね！ ON/OFF',
				defaultKey: 0, command: 'toggle-like' },
		{ id: 'PLAYLIST_SHUFFLE', category: 'プレイリスト', label: 'プレイリストをシャッフル',
				defaultKey: 0, command: 'shufflePlaylist' },
		{ id: 'RELOAD_VIDEO', category: 'プレイヤー全般', label: '動画を再読み込み',
				defaultKey: 0, command: 'reload' },
		{ id: 'SEEK_TO_RESUME_POINT', category: 'シーク', label: '前回の再生位置へシーク',
				defaultKey: 0, command: 'seekToResumePoint' },
		{ id: 'OPEN_GINZA', category: 'プレイヤー全般', label: 'Ginza(公式プレイヤー)で開く',
				defaultKey: 0, command: 'openGinza' },
		{ id: 'SAVE_MYMEMORY', category: 'その他', label: '再生位置を「おもいで」に保存',
				defaultKey: 0, command: 'saveMymemory' },
		{ id: 'TOGGLE_BACK_COMMENT', category: 'コメント', label: 'コメントを画面全体に流す ON/OFF',
				defaultKey: 0, command: 'toggle-backComment' },
		{ id: 'TOGGLE_NG_FILTER', category: 'フィルタ/NG', label: 'NGフィルタ全体 ON/OFF',
				defaultKey: 0, command: 'toggle-enableFilter' },
		{ id: 'TOGGLE_DEBUG', category: 'その他', label: 'デバッグモード ON/OFF',
				defaultKey: 0, command: 'toggle-debug' },
		{ id: 'TOGGLE_NICOS_JUMP', category: 'コメント', label: '@ジャンプ機能 ON/OFF',
				defaultKey: 0, command: 'toggle-enableNicosJumpVideo' },
		{ id: 'TOGGLE_BEST_ZENTUBE', category: 'その他', label: 'ベストZenTube ON/OFF',
				defaultKey: 0, command: 'toggle-bestZenTube' },
		{ id: 'TOGGLE_AUTO_COMMENT_SPEED', category: 'コメント', label: 'コメント速度自動調整 ON/OFF',
				defaultKey: 0, command: 'toggle-autoCommentSpeedRate' },
		{ id: 'TOGGLE_STORYBOARD', category: '画面', label: 'シークバーのサムネイル(ストーリーボード) ON/OFF',
				defaultKey: 0, command: 'toggle-enableStoryboard' },
		{ id: 'TOGGLE_STORYBOARD_BAR', category: '画面', label: 'シーンサーチバー ON/OFF',
				defaultKey: 0, command: 'toggle-enableStoryboardBar' },
		{ id: 'TOGGLE_COMMENT_PANEL', category: 'コメント', label: 'コメントパネル表示 ON/OFF',
				defaultKey: 0, command: 'toggle-enableCommentPanel' },
		{ id: 'TOGGLE_COMMENT_PANEL_AUTOSCROLL', category: 'コメント', label: 'コメントパネルの自動スクロール ON/OFF',
				defaultKey: 0, command: 'toggle-enableCommentPanelAutoScroll' },
		{ id: 'TOGGLE_HEATMAP', category: '画面', label: '再生数ヒートマップ表示 ON/OFF',
				defaultKey: 0, command: 'toggle-enableHeatMap' },
		{ id: 'TOGGLE_AD_DECORATION', category: 'プレイリスト', label: 'プレイリストの広告 金冠/銀冠枠 ON/OFF',
				defaultKey: 0, command: 'toggle-enableAdDecoration' },
		{ id: 'TOGGLE_AUTOPLAY', category: '再生', label: '自動再生 ON/OFF',
				defaultKey: 0, command: 'toggle-autoPlay' },
		{ id: 'TOGGLE_CONTINUE_NEXT_PAGE', category: '再生', label: 'ページ切り替え後の再生継続 ON/OFF',
				defaultKey: 0, command: 'toggle-continueNextPage' },
		{ id: 'TOGGLE_AUTO_ZENTUBE', category: 'その他', label: '自動ZenTube ON/OFF',
				defaultKey: 0, command: 'toggle-autoZenTube' },
		{ id: 'TOGGLE_DBLCLICK_CLOSE', category: 'プレイヤー全般', label: '背景ダブルクリックで閉じる ON/OFF',
				defaultKey: 0, command: 'toggle-enableDblclickClose' },
		{ id: 'TOGGLE_SMALLMODE_ASPECT_LOCK', category: '画面', label: '「小」モードのアスペクト比ロック ON/OFF',
				defaultKey: 0, command: 'toggle-smallModeAspectLock' },
		{ id: 'TOGGLE_FULLSCREEN_ON_DBLCLICK', category: '画面', label: '画面ダブルクリックでフルスクリーン ON/OFF',
				defaultKey: 0, command: 'toggle-enableFullScreenOnDoubleClick' },
		{ id: 'TOGGLE_REMOVE_NG_MATCHED_USER', category: 'フィルタ/NG', label: 'NGマッチしたユーザーのコメントを全部消す ON/OFF',
				defaultKey: 0, command: 'toggle-removeNgMatchedUser' },
		{ id: 'TOGGLE_COMMENT_PREVIEW', category: 'コメント', label: 'コメント欄プレビュー ON/OFF',
				defaultKey: 0, command: 'toggle-enableCommentPreview' },
		{ id: 'SCENE_PIN', category: '画面', label: 'シーンサーチ: プレビューの固定/解除',
				defaultKey: 0, command: 'sceneSearch-togglePin' },
		{ id: 'SCENE_SHOW', category: '画面', label: 'シーンサーチ: 表示/非表示',
				defaultKey: 0, command: 'sceneSearch-togglePanel' },
		{ id: 'SCENE_CONTROLS', category: '画面', label: 'シーンサーチ: 操作ボタンを展開/収納',
				defaultKey: 0, command: 'sceneSearch-toggleControls' },
		{ id: 'SCENE_LAYOUT_NEXT', category: '画面', label: 'シーンサーチ: 次のレイアウト',
				defaultKey: 0, command: 'sceneSearch-nextLayout' },
		{ id: 'SCENE_LAYOUT_PREV', category: '画面', label: 'シーンサーチ: 前のレイアウト',
				defaultKey: 0, command: 'sceneSearch-prevLayout' },
		{ id: 'SCENE_SEEK_BACK', category: 'シーク', label: 'シーンサーチ: 設定秒数だけ戻る',
				defaultKey: 0, command: 'sceneSearch-seekBack' },
		{ id: 'SCENE_SEEK_FORWARD', category: 'シーク', label: 'シーンサーチ: 設定秒数だけ進む',
				defaultKey: 0, command: 'sceneSearch-seekForward' },
		{ id: 'SCENE_STEP_UP', category: 'シーク', label: 'シーンサーチ: 移動秒数を増やす',
				defaultKey: 0, command: 'sceneSearch-stepUp' },
		{ id: 'SCENE_STEP_DOWN', category: 'シーク', label: 'シーンサーチ: 移動秒数を減らす',
				defaultKey: 0, command: 'sceneSearch-stepDown' },
		{ id: 'SCENE_COMMENT_VISIBILITY', category: 'コメント', label: 'シーンサーチ: コメントプレビュー表示/非表示',
				defaultKey: 0, command: 'sceneSearch-toggleCommentPreview' },
		{ id: 'SCENE_COMMENT_SEARCH', category: 'コメント', label: 'シーンサーチ: コメント検索を開く/閉じる',
				defaultKey: 0, command: 'sceneSearch-toggleCommentSearch' },
		{ id: 'SCENE_IDLE_HIDE', category: '画面', label: 'シーンサーチ: 静止中サムネ自動非表示のON/OFF',
				defaultKey: 0, command: 'sceneSearch-toggleIdleHide' },
		{ id: 'OPEN_NICOAD', category: 'その他', label: 'ニコニ広告で宣伝',
				defaultKey: 0, command: 'open-uad' },
		{ id: 'OPEN_TWITTER_HASH', category: 'その他', label: 'twitterの反応を見る',
				defaultKey: 0, command: 'open-twitter-hash' },
		{ id: 'OPEN_PARENT_VIDEO', category: 'その他', label: '親作品・コンテンツツリーを開く',
				defaultKey: 0, command: 'open-parent-video' },
		{ id: 'OPEN_ORIGINAL_VIDEO', category: 'その他', label: '元動画を開く',
				defaultKey: 0, command: 'open-original-video' },
		{ id: 'PLAYLIST_SET_COMMONS_TREE', category: 'プレイリスト', label: '親作品・子作品をプレイリストに追加',
				defaultKey: 0, command: 'playlistSetCommonsTree' },
		{ id: 'COPY_WATCH_URL', category: 'その他', label: '動画URLをコピー',
				defaultKey: 0, command: 'copy-video-watch-url' },
		{ id: 'RESET_SMALLMODE_POSITION', category: '画面', label: '「小」モードの位置とサイズを初期状態に戻す',
				defaultKey: 0, command: 'resetSmallModePosition' },
		{ id: 'CUSTOM_SEEK_1', category: 'シーク', label: 'カスタムシーク1(秒数は自由入力・マイナスで戻る)',
				defaultKey: 0, command: 'seekBy', customSeekSlot: 1 },
		{ id: 'CUSTOM_SEEK_2', category: 'シーク', label: 'カスタムシーク2(秒数は自由入力・マイナスで戻る)',
				defaultKey: 0, command: 'seekBy', customSeekSlot: 2 },
		{ id: 'CUSTOM_SEEK_3', category: 'シーク', label: 'カスタムシーク3(秒数は自由入力・マイナスで戻る)',
				defaultKey: 0, command: 'seekBy', customSeekSlot: 3 },
		{ id: 'CUSTOM_SEEK_4', category: 'シーク', label: 'カスタムシーク4(秒数は自由入力・マイナスで戻る)',
				defaultKey: 0, command: 'seekBy', customSeekSlot: 4 },
		{ id: 'CUSTOM_SEEK_5', category: 'シーク', label: 'カスタムシーク5(秒数は自由入力・マイナスで戻る)',
				defaultKey: 0, command: 'seekBy', customSeekSlot: 5 },
		{ id: 'CUSTOM_SEEK_6', category: 'シーク', label: 'カスタムシーク6(秒数は自由入力・マイナスで戻る)',
				defaultKey: 0, command: 'seekBy', customSeekSlot: 6 },
		{ id: 'CUSTOM_SEEK_7', category: 'シーク', label: 'カスタムシーク7(秒数は自由入力・マイナスで戻る)',
				defaultKey: 0, command: 'seekBy', customSeekSlot: 7 },
		{ id: 'CUSTOM_SEEK_8', category: 'シーク', label: 'カスタムシーク8(秒数は自由入力・マイナスで戻る)',
				defaultKey: 0, command: 'seekBy', customSeekSlot: 8 },
		{ id: 'CUSTOM_SEEK_9', category: 'シーク', label: 'カスタムシーク9(秒数は自由入力・マイナスで戻る)',
				defaultKey: 0, command: 'seekBy', customSeekSlot: 9 },
		{ id: 'CUSTOM_SEEK_10', category: 'シーク', label: 'カスタムシーク10(秒数は自由入力・マイナスで戻る)',
				defaultKey: 0, command: 'seekBy', customSeekSlot: 10 },
		{ id: 'PICTURE_IN_PICTURE', category: 'その他', label: 'ピクチャーインピクチャー',
				defaultKey: 0, command: 'picture-in-picture' },
		{ id: 'PICTURE_IN_PICTURE_COMMENT', category: 'その他', label: 'ピクチャーインピクチャー(コメント付き)',
				defaultKey: 0, command: 'picture-in-picture-comment' },
		{ id: 'TOGGLE_AUDIO_AUTO_ADJUST', category: 'その他', label: '音声の自動調整のON/OFF',
				defaultKey: 0, command: 'toggle-audio.autoAdjust' },
		{ id: 'TOGGLE_SUPPORTER_CREDIT', category: 'その他', label: '動画の最後の「提供」画面の表示 ON/OFF',
				defaultKey: 0, command: 'toggle-supporterCredit.enable' },
		{ id: 'PLAYBACK_RATE_10', category: '再生速度', label: '再生速度: 10倍',
				defaultKey: 0, command: 'playbackRate', param: 10 },
		{ id: 'PLAYBACK_RATE_5', category: '再生速度', label: '再生速度: 5倍',
				defaultKey: 0, command: 'playbackRate', param: 5 },
		{ id: 'PLAYBACK_RATE_4', category: '再生速度', label: '再生速度: 4倍',
				defaultKey: 0, command: 'playbackRate', param: 4 },
		{ id: 'PLAYBACK_RATE_3', category: '再生速度', label: '再生速度: 3倍',
				defaultKey: 0, command: 'playbackRate', param: 3 },
		{ id: 'PLAYBACK_RATE_2', category: '再生速度', label: '再生速度: 2倍',
				defaultKey: 0, command: 'playbackRate', param: 2 },
		{ id: 'PLAYBACK_RATE_1_75', category: '再生速度', label: '再生速度: 1.75倍',
				defaultKey: 0, command: 'playbackRate', param: 1.75 },
		{ id: 'PLAYBACK_RATE_1_5', category: '再生速度', label: '再生速度: 1.5倍',
				defaultKey: 0, command: 'playbackRate', param: 1.5 },
		{ id: 'PLAYBACK_RATE_1_25', category: '再生速度', label: '再生速度: 1.25倍',
				defaultKey: 0, command: 'playbackRate', param: 1.25 },
		{ id: 'PLAYBACK_RATE_1', category: '再生速度', label: '再生速度: 標準速度(x1)',
				defaultKey: 0, command: 'playbackRate', param: 1 },
		{ id: 'PLAYBACK_RATE_0_75', category: '再生速度', label: '再生速度: 0.75倍',
				defaultKey: 0, command: 'playbackRate', param: 0.75 },
		{ id: 'PLAYBACK_RATE_0_5', category: '再生速度', label: '再生速度: 0.5倍',
				defaultKey: 0, command: 'playbackRate', param: 0.5 },
		{ id: 'PLAYBACK_RATE_0_25', category: '再生速度', label: '再生速度: 0.25倍',
				defaultKey: 0, command: 'playbackRate', param: 0.25 },
		{ id: 'PLAYBACK_RATE_0_1', category: '再生速度', label: '再生速度: 0.1倍',
				defaultKey: 0, command: 'playbackRate', param: 0.1 },
		{ id: 'OPEN_SCREEN_FILTER_PANEL', category: '画面フィルター', label: '画面フィルターのパネルを開く/閉じる',
				defaultKey: 0, command: 'toggle-screenFilterPanel' },
		{ id: 'TOGGLE_SCREEN_FILTER', category: '画面フィルター', label: 'エフェクト ON/OFF（今の設定 ⇔ 標準）',
				defaultKey: 0, command: 'toggle-screenFilter.enable' },
		{ id: 'TOGGLE_SCREEN_FILTER_SPLIT', category: '画面フィルター', label: '左右で見比べる（左半分に元の映像）ON/OFF',
				defaultKey: 0, command: 'toggle-screenFilter.split' },
		{ id: 'SCREEN_FILTER_NEXT_PRESET', category: '画面フィルター', label: 'プリセットを順番に切り替える',
				defaultKey: 0, command: 'screenFilter-nextPreset' },
		{ id: 'SCREEN_FILTER_RESET', category: '画面フィルター', label: 'すべて標準に戻す',
				defaultKey: 0, command: 'screenFilter-reset' },
		{ id: 'SCREEN_FILTER_PRESET_DARK', category: '画面フィルター', label: 'プリセット: 暗い動画を見やすく',
				defaultKey: 0, command: 'screenFilter-preset', param: 'dark' },
		{ id: 'SCREEN_FILTER_PRESET_SHARP', category: '画面フィルター', label: 'プリセット: くっきり',
				defaultKey: 0, command: 'screenFilter-preset', param: 'sharp' },
		{ id: 'SCREEN_FILTER_PRESET_FADED', category: '画面フィルター', label: 'プリセット: 色あせ補正',
				defaultKey: 0, command: 'screenFilter-preset', param: 'faded' },
		{ id: 'SCREEN_FILTER_PRESET_EYECARE', category: '画面フィルター', label: 'プリセット: 目に優しい（夜）',
				defaultKey: 0, command: 'screenFilter-preset', param: 'eyeCare' },
		{ id: 'SCREEN_FILTER_PRESET_MONO', category: '画面フィルター', label: 'プリセット: 白黒',
				defaultKey: 0, command: 'screenFilter-preset', param: 'mono' },
		{ id: 'SCREEN_FILTER_PRESET_INVERT', category: '画面フィルター', label: 'プリセット: 反転（暗転）',
				defaultKey: 0, command: 'screenFilter-preset', param: 'invert' },
		{ id: 'SCREEN_FILTER_PRESET_VIVID', category: '画面フィルター', label: 'プリセット: ビビッド',
				defaultKey: 0, command: 'screenFilter-preset', param: 'vivid' },
		{ id: 'SCREEN_FILTER_PRESET_CINEMA', category: '画面フィルター', label: 'プリセット: シネマ（銀残し風）',
				defaultKey: 0, command: 'screenFilter-preset', param: 'cinema' },
		{ id: 'SCREEN_FILTER_PRESET_FILM', category: '画面フィルター', label: 'プリセット: フィルム（レトロ）',
				defaultKey: 0, command: 'screenFilter-preset', param: 'film' },
		{ id: 'SCREEN_FILTER_PRESET_PASTEL', category: '画面フィルター', label: 'プリセット: パステル',
				defaultKey: 0, command: 'screenFilter-preset', param: 'pastel' },
		{ id: 'SCREEN_FILTER_PRESET_COOL', category: '画面フィルター', label: 'プリセット: 寒色',
				defaultKey: 0, command: 'screenFilter-preset', param: 'cool' },
		{ id: 'SCREEN_FILTER_PRESET_WARM', category: '画面フィルター', label: 'プリセット: 暖色',
				defaultKey: 0, command: 'screenFilter-preset', param: 'warm' },
		{ id: 'SCREEN_FILTER_PRESET_GOLD', category: '画面フィルター', label: 'プリセット: ゴールド',
				defaultKey: 0, command: 'screenFilter-preset', param: 'gold' },
		{ id: 'SCREEN_FILTER_PRESET_MONO_HIGH', category: '画面フィルター', label: 'プリセット: 白黒（硬調）',
				defaultKey: 0, command: 'screenFilter-preset', param: 'monoHigh' },
		{ id: 'SCREEN_FILTER_TEMPERATURE_UP', category: '画面フィルター', label: '色温度を暖かく(+5)',
				defaultKey: 0, command: 'screenFilter-adjust', param: 'temperature:5' },
		{ id: 'SCREEN_FILTER_TEMPERATURE_DOWN', category: '画面フィルター', label: '色温度を涼しく(-5)',
				defaultKey: 0, command: 'screenFilter-adjust', param: 'temperature:-5' },
		{ id: 'SCREEN_FILTER_BLUR_UP', category: '画面フィルター', label: 'ぼかしを強く(+1px)',
				defaultKey: 0, command: 'screenFilter-adjust', param: 'blur:1' },
		{ id: 'SCREEN_FILTER_BLUR_DOWN', category: '画面フィルター', label: 'ぼかしを弱く(-1px)',
				defaultKey: 0, command: 'screenFilter-adjust', param: 'blur:-1' },
		{ id: 'TOGGLE_SCREEN_FILTER_AUTO_LEVELS', category: '画面フィルター', label: '自動レベル補正 ON/OFF',
				defaultKey: 0, command: 'toggle-screenFilter.autoLevels' },
		{ id: 'SCREEN_FILTER_BRIGHTNESS_UP', category: '画面フィルター', label: '明るさを上げる(+5%)',
				defaultKey: 0, command: 'screenFilter-adjust', param: 'brightness:5' },
		{ id: 'SCREEN_FILTER_BRIGHTNESS_DOWN', category: '画面フィルター', label: '明るさを下げる(-5%)',
				defaultKey: 0, command: 'screenFilter-adjust', param: 'brightness:-5' },
		{ id: 'SCREEN_FILTER_CONTRAST_UP', category: '画面フィルター', label: 'コントラストを上げる(+5%)',
				defaultKey: 0, command: 'screenFilter-adjust', param: 'contrast:5' },
		{ id: 'SCREEN_FILTER_CONTRAST_DOWN', category: '画面フィルター', label: 'コントラストを下げる(-5%)',
				defaultKey: 0, command: 'screenFilter-adjust', param: 'contrast:-5' },
		{ id: 'SCREEN_FILTER_SATURATE_UP', category: '画面フィルター', label: '彩度(色の濃さ)を上げる(+5%)',
				defaultKey: 0, command: 'screenFilter-adjust', param: 'saturate:5' },
		{ id: 'SCREEN_FILTER_SATURATE_DOWN', category: '画面フィルター', label: '彩度(色の濃さ)を下げる(-5%)',
				defaultKey: 0, command: 'screenFilter-adjust', param: 'saturate:-5' },
		{ id: 'SCREEN_FILTER_GAMMA_UP', category: '画面フィルター', label: 'ガンマを上げる(暗い所を明るく +0.05)',
				defaultKey: 0, command: 'screenFilter-adjust', param: 'gamma:0.05' },
		{ id: 'SCREEN_FILTER_GAMMA_DOWN', category: '画面フィルター', label: 'ガンマを下げる(-0.05)',
				defaultKey: 0, command: 'screenFilter-adjust', param: 'gamma:-0.05' },
		{ id: 'TOGGLE_SCREEN_FILTER_INVERT', category: '画面フィルター', label: '階調反転(ネガ) ON/OFF',
				defaultKey: 0, command: 'toggle-screenFilter.invert' },
		{ id: 'TOGGLE_FLIP_H', category: '画面フィルター', label: '左右反転 ON/OFF',
				defaultKey: 0, command: 'toggle-flipH' },
		{ id: 'TOGGLE_FLIP_V', category: '画面フィルター', label: '上下反転 ON/OFF',
				defaultKey: 0, command: 'toggle-flipV' }
];
const buildDefaultKeyConfig = (existingDefaults = {}) => {
		const result = {};
		SHORTCUT_ACTIONS.forEach(action => {
				const propName = 'KEY_' + action.id;
				if (Object.prototype.hasOwnProperty.call(existingDefaults, propName)) {
						return;
				}
				result[propName] = action.defaultKey || 0;
		});
		return result;
};
const groupShortcutActionsByCategory = () => {
		const groups = [];
		const byCategory = {};
		SHORTCUT_ACTIONS.forEach(action => {
				if (!byCategory[action.category]) {
						byCategory[action.category] = { category: action.category, actions: [] };
						groups.push(byCategory[action.category]);
				}
				byCategory[action.category].actions.push(action);
		});
		return groups;
};
const ZenzaCommentHistorySettings = (() => {
'use strict';
const modules = [];
modules[0] = (() => {
const COMMENT_ORIGIN = 'https://public.nvcomment.nicovideo.jp';
class HistoryError extends Error {
	constructor(code, details={}) {
		super(code); this.name='HistoryError'; this.code=code;
		for (const k of ['httpStatus','apiCode','retryAfterMs','causeCode']) if (details[k] !== undefined) this[k]=details[k];
	}
}
function fail(code) { throw new HistoryError(code); }
function integerOption(value,min,max) {
	if (!Number.isSafeInteger(value) || value<min || value>max) fail('OPTION');
	return value;
}
function threadId(value) {
	if (typeof value==='number' && !Number.isSafeInteger(value)) fail('TARGET_SCHEMA');
	if (!/^[0-9]+$/.test(String(value))) fail('TARGET_SCHEMA');
	return String(value);
}
function targetKey(t) {return `${t.id}:${t.fork}`;}
function normalizeWatch(input, expectedVideoId) {
	if(input?.meta?.status!==undefined && input.meta.status!==200)fail('WATCH_SCHEMA');
	if (typeof expectedVideoId!=='string' || !/^(?:(?:sm|so|nm))?\d+$/.test(expectedVideoId)) fail('OPTION');
	const candidates=[input?.data?.response?.$watchV4?.data,input?.data?.response,
		input?.response?.$watchV4?.data,input?.response,input?.$watchV4?.data,input?.data,input];
	const w=candidates.find(x=>x?.video?.id && x?.comment?.nvComment);
	if (!w) fail('WATCH_SCHEMA');
	if (w.video.id!==expectedVideoId) fail('VIDEO_MISMATCH');
	const nv=w.comment.nvComment;
	if (nv.server!==COMMENT_ORIGIN) fail('SERVER_NOT_ALLOWED');
	if (typeof nv.threadKey!=='string' || !nv.threadKey) fail('MISSING_KEY');
	const p=nv.params;
	if (!p || !Array.isArray(p.targets) || !p.targets.length || typeof p.language!=='string' || !/^[a-z]{2}-[a-z]{2}$/i.test(p.language)) fail('WATCH_SCHEMA');
	const targets=p.targets.map(t=>{
		if (!['main','owner','easy'].includes(t.fork)) fail('TARGET_SCHEMA');
		return Object.freeze({id:threadId(t.id),fork:t.fork});
	});
	if (new Set(targets.map(targetKey)).size!==targets.length) fail('TARGET_SCHEMA');
	const ctx={videoId:expectedVideoId,server:COMMENT_ORIGIN,language:p.language,targets:Object.freeze(targets)};
	Object.defineProperty(ctx,'threadKey',{value:nv.threadKey,enumerable:false});
	return Object.freeze(ctx);
}
function checkedTargets(context, targets=context.targets) {
	if (!Array.isArray(targets) || !targets.length) fail('OPTION');
	const allowed=new Set(context.targets.map(targetKey));
	const selected=targets.map(t=>({id:threadId(t.id),fork:t.fork}));
	if (selected.some(t=>!allowed.has(targetKey(t)))) fail('TARGET_NOT_ALLOWED');
	if (new Set(selected.map(targetKey)).size!==selected.length) fail('OPTION');
	return selected;
}
function buildThreadRequest(context,{targets=context.targets,when,resFrom}={}) {
	if (context.server!==COMMENT_ORIGIN) fail('SERVER_NOT_ALLOWED');
	if (typeof context.threadKey!=='string' || !context.threadKey) fail('MISSING_KEY');
	const selected=checkedTargets(context,targets), additionals={};
	if (when!==undefined) additionals.when=integerOption(when,0,9999999999);
	if (resFrom!==undefined) additionals.res_from=integerOption(resFrom,-1000,-1);
	return {url:`${COMMENT_ORIGIN}/v1/threads?pc=1`,init:{method:'POST',
		headers:{'Content-Type':'text/plain;charset=UTF-8','X-Frontend-Id':'6','X-Frontend-Version':'0','X-Client-Os-Type':'others'},
		mode:'cors',credentials:'omit',cache:'no-store',redirect:'error',
		body:JSON.stringify({params:{targets:selected,language:context.language},threadKey:context.threadKey,additionals})}};
}
const FIELDS=['id','no','vposMs','body','commands','userId','isPremium','score','postedAt','nicoruCount','nicoruId','source','isMyPost','deleted'];
function copyComment(c) {
	const out={};for(const k of FIELDS) if(Object.hasOwn(c,k))out[k]=k==='commands'?[...c.commands]:c[k];
	return out;
}
function normalizeComment(c) {
	const idOk=typeof c?.id==='string' && c.id.length>0 || Number.isSafeInteger(c?.id) && c.id>=0;
	if(!c || !idOk || !Number.isSafeInteger(c.no) || c.no<0 || !Number.isFinite(c.vposMs) ||
		typeof c.body!=='string' || typeof c.userId!=='string' || !Array.isArray(c.commands) || c.commands.some(x=>typeof x!=='string') ||
		typeof c.postedAt!=='string' || !/^\d{4}-\d\d-\d\dT/.test(c.postedAt) || !Number.isFinite(Date.parse(c.postedAt)) || Date.parse(c.postedAt)<0) fail('COMMENT_SCHEMA');
	for(const k of ['isPremium','isMyPost'])if(Object.hasOwn(c,k)&&typeof c[k]!=='boolean')fail('COMMENT_SCHEMA');
	if(Object.hasOwn(c,'score')&&!Number.isFinite(c.score))fail('COMMENT_SCHEMA');
	if(Object.hasOwn(c,'nicoruCount')&&(!Number.isSafeInteger(c.nicoruCount)||c.nicoruCount<0))fail('COMMENT_SCHEMA');
	if(Object.hasOwn(c,'source')&&typeof c.source!=='string')fail('COMMENT_SCHEMA');
	if(Object.hasOwn(c,'nicoruId')&&c.nicoruId!==null&&typeof c.nicoruId!=='string'&&!(Number.isSafeInteger(c.nicoruId)&&c.nicoruId>=0))fail('COMMENT_SCHEMA');
	if(Object.hasOwn(c,'deleted')&&typeof c.deleted!=='boolean'&&!Number.isSafeInteger(c.deleted))fail('COMMENT_SCHEMA');
	const out=copyComment(c);out.id=String(c.id);return out;
}
function validateThreads(body, context, targets=context.targets) {
	if(body?.meta?.status!==200 || body?.meta?.errorCode) fail('API_ERROR');
	if(!Array.isArray(body?.data?.threads)) fail('RESPONSE_SCHEMA');
	const selected=checkedTargets(context,targets), expected=new Set(selected.map(targetKey)), seen=new Set();
	const result=body.data.threads.map(th=>{
		const id=threadId(th.id), fork=th.fork, key=targetKey({id,fork});
		if(!expected.has(key))fail('TARGET_NOT_ALLOWED');
		if(seen.has(key))fail('RESPONSE_SCHEMA');seen.add(key);
		if(!Array.isArray(th.comments) || !Number.isSafeInteger(th.commentCount) || th.commentCount<0)fail('RESPONSE_SCHEMA');
		return {id,fork,commentCount:th.commentCount,comments:th.comments.map(normalizeComment)};
	});
	if(seen.size!==expected.size)fail('MISSING_TARGET');
	return result;
}
class CommentStore {
	#context; #items=new Map(); #threads=new Map();
	constructor(context){this.#context=context;}
	get size(){return this.#items.size;}
	#key(t,c){return JSON.stringify([this.#context.videoId,this.#context.language,t.id,t.fork,c.no]);}
	add(threads,allowance=Infinity) {
		if(allowance!==Infinity)integerOption(allowance,0,50000);
		if(threads.length)checkedTargets(this.#context,threads);
		const ids=new Map();
		for(const t of threads)for(const c of t.comments){
			const key=this.#key(t,c),existing=this.#items.get(key)?.comment.id??ids.get(key);
			if(existing!==undefined && existing!==c.id)fail('IDENTITY_CONFLICT');
			ids.set(key,c.id);
		}
		let added=0,duplicates=0,limited=false;
		for(const t of threads){
			const tk=targetKey(t);this.#threads.set(tk,{id:t.id,fork:t.fork,commentCount:t.commentCount});
			for(const c of t.comments){
				const key=this.#key(t,c);
				if(this.#items.has(key)){duplicates++;continue;}
				if(added>=allowance){limited=true;continue;}
				this.#items.set(key,{thread:tk,comment:copyComment(c)});added++;
			}
		}
		return {added,duplicates,limited};
	}
	snapshot(){
		const out=new Map([...this.#threads].map(([k,t])=>[k,{...t,comments:[]}]));
		for(const {thread,comment} of this.#items.values())out.get(thread).comments.push(copyComment(comment));
		return [...out.values()];
	}
}
function summarizeThreads(threads){
	return threads.map(t=>{
		let oldest=Infinity,newest=-Infinity,minNo=Infinity,maxNo=-Infinity,prevDate=-Infinity,prevNo=-Infinity,prevVpos=-Infinity;
		let ascendingPostedAt=true,ascendingNo=true,ascendingVpos=true;
		for(const c of t.comments){const sec=Date.parse(c.postedAt)/1000;oldest=Math.min(oldest,sec);newest=Math.max(newest,sec);
			minNo=Math.min(minNo,c.no);maxNo=Math.max(maxNo,c.no);ascendingPostedAt&&=sec>=prevDate;ascendingNo&&=c.no>=prevNo;ascendingVpos&&=c.vposMs>=prevVpos;
			prevDate=sec;prevNo=c.no;prevVpos=c.vposMs;}
		return {id:t.id,fork:t.fork,commentCountField:t.commentCount,returnedCount:t.comments.length,
			oldestUnixSeconds:oldest===Infinity?null:Math.floor(oldest),newestUnixSeconds:newest===-Infinity?null:Math.floor(newest),
			minNo:minNo===Infinity?null:minNo,maxNo:maxNo===-Infinity?null:maxNo,ascendingPostedAt,ascendingNo,ascendingVpos};
	});
}
function withThreadKey(context,key){
	if(context.server!==COMMENT_ORIGIN)fail('SERVER_NOT_ALLOWED');
	if(typeof key!=='string'||!key)fail('MISSING_KEY');
	const next={videoId:context.videoId,server:context.server,language:context.language,targets:context.targets};
	Object.defineProperty(next,'threadKey',{value:key,enumerable:false});
	return Object.freeze(next);
}
return Object.freeze({COMMENT_ORIGIN,HistoryError,fail,integerOption,normalizeWatch,checkedTargets,buildThreadRequest,validateThreads,CommentStore,summarizeThreads,withThreadKey});
})();
modules[1] = (() => {
const {HistoryError,integerOption,fail} = modules[0];
const SETTINGS_SCHEMA=Object.freeze([
	{name:'maxAdditionalComments',label:'追加コメント上限',type:'integer',default:5000,min:1,max:20000},
	{name:'maxPages',label:'履歴ページ上限',type:'integer',default:100,min:1,max:100},
	{name:'maxRequests',label:'総リクエスト上限（再試行・キー更新を含む）',type:'integer',default:150,min:1,max:200},
	{name:'minIntervalMs',label:'通信の最小間隔（ミリ秒）',type:'integer',default:1500,min:1500,max:60000},
	{name:'requestTimeoutMs',label:'通信タイムアウト（ミリ秒）',type:'integer',default:10000,min:1000,max:30000},
	{name:'maxElapsedMs',label:'取得全体の時間上限（ミリ秒）',type:'integer',default:300000,min:1000,max:300000},
	{name:'maxRetries',label:'一操作ごとの再試行上限',type:'integer',default:2,min:0,max:3},
	{name:'maxKeyRefreshes',label:'キー更新の総上限',type:'integer',default:1,min:0,max:2},
	{name:'includeEasy',label:'かんたんコメントも追加取得',type:'boolean',default:false},
].map(d=>Object.freeze({...d,key:`commentHistory.${d.name}`})));
const DEFAULT_SETTINGS=Object.freeze(Object.fromEntries(SETTINGS_SCHEMA.map(d=>[d.name,d.default])));
function normalizeSettings(input={}){
	if(!input || typeof input!=='object' || Array.isArray(input))fail('OPTION');
	const names=new Set(SETTINGS_SCHEMA.map(d=>d.name));
	if(Object.keys(input).some(k=>!names.has(k)))fail('OPTION');
	const values={...DEFAULT_SETTINGS,...input};
	for(const d of SETTINGS_SCHEMA){
		if(d.type==='boolean'){if(typeof values[d.name]!=='boolean')fail('OPTION');}
		else integerOption(values[d.name],d.min,d.max);
	}
	return values;
}
class SettingsStore {
	#read;#write;
	constructor({read,write}){
		if(typeof read!=='function'||typeof write!=='function')fail('OPTION');
		this.#read=read;this.#write=write;
	}
	get(){
		const saved=this.#read();
		if(saved===null||saved===undefined)return normalizeSettings();
		if(saved.schema!=='nico-comment-history-settings'||saved.version!==1)throw new HistoryError('SETTINGS_VERSION');
		if(!saved.values||typeof saved.values!=='object'||Array.isArray(saved.values))fail('OPTION');
		return normalizeSettings(saved.values);
	}
	patch(changes){
		if(!changes||typeof changes!=='object'||Array.isArray(changes))fail('OPTION');
		const values=normalizeSettings({...this.get(),...changes});
		this.#write({schema:'nico-comment-history-settings',version:1,values:{...values}});
		return values;
	}
}
return Object.freeze({SETTINGS_SCHEMA,DEFAULT_SETTINGS,normalizeSettings,SettingsStore});
})();
modules[2] = (() => {
const {HistoryError} = modules[0];
const {SETTINGS_SCHEMA,normalizeSettings} = modules[1];
const ZENZA_SETTINGS_NAMES = new Set(SETTINGS_SCHEMA.map(d=>d.name));
const ZENZA_SETTINGS_KEYS = new Set(SETTINGS_SCHEMA.map(d=>d.key));
const ZENZA_SETTINGS_EVENT = 'comment-history-settings';
function settingsError(code) { return new HistoryError(code); }
function checkedSettingNames(names) {
	if (!Array.isArray(names) || names.some(n=>!ZENZA_SETTINGS_NAMES.has(n)) || new Set(names).size!==names.length) throw settingsError('OPTION');
	return names;
}
class ZenzaSettingsRepository {
	#storage; #prefix; #bus; #off; #last; #disposed=false; #listeners=new Set();
	constructor({storage,prefix='ZenzaWatch_',bus} = {}) {
		if (!storage || ['getItem','setItem','removeItem'].some(k=>typeof storage[k]!=='function') ||
				typeof prefix!=='string' || !prefix || bus && ['publish','subscribe'].some(k=>typeof bus[k]!=='function')) throw settingsError('OPTION');
		this.#storage=storage;this.#prefix=prefix;this.#bus=bus;
		this.#last=this.#read().values;
		if (bus) this.#off=bus.subscribe(message=>{
			if (this.#disposed || message?.type!==ZENZA_SETTINGS_EVENT || !Array.isArray(message.keys) ||
					!message.keys.length || message.keys.some(k=>!ZENZA_SETTINGS_KEYS.has(k))) return;
			try { this.refresh(); } catch { /* Caller sees validation failure on next explicit get/start. */ }
		});
	}
	#assertActive() { if(this.#disposed)throw settingsError('DISPOSED'); }
	#read() {
		this.#assertActive();
		const input={},raw=new Map();
		for(const d of SETTINGS_SCHEMA) {
			let value;
			try {value=this.#storage.getItem(this.#prefix+d.key);} catch {throw settingsError('SETTINGS_READ');}
			raw.set(d.name,value);
			if(value!==null && value!==undefined) {
				try {input[d.name]=JSON.parse(value);} catch {throw settingsError('SETTINGS_INVALID');}
			}
		}
		let values;
		try {values=Object.freeze(normalizeSettings(input));} catch {throw settingsError('SETTINGS_INVALID');}
		return {values,raw};
	}
	#accept(values) {
		const changed=SETTINGS_SCHEMA.some(d=>values[d.name]!==this.#last[d.name]);
		this.#last=values;
		if(changed)for(const callback of [...this.#listeners]) {
			try {callback(values);} catch { /* A UI failure must not reinterpret successful persistence. */ }
		}
	}
	get() {return this.#read().values;}
	refresh() {const values=this.get();this.#accept(values);return values;}
	patch(changes) {
		this.#assertActive();
		if(!changes || typeof changes!=='object' || Array.isArray(changes))throw settingsError('OPTION');
		checkedSettingNames(Object.keys(changes));
		const before=this.#read();
		const next=Object.freeze(normalizeSettings({...before.values,...changes}));
		const entries=SETTINGS_SCHEMA.filter(d=>Object.hasOwn(changes,d.name)&&before.values[d.name]!==next[d.name])
			.map(d=>({name:d.name,key:this.#prefix+d.key,publicKey:d.key,value:JSON.stringify(next[d.name]),previous:before.raw.get(d.name)}));
		if(!entries.length){this.#accept(next);return next;}
		const attempted=[];
		let committed;
		try {
			for(const entry of entries) {
				if(this.#storage.getItem(entry.key)!==entry.previous)throw settingsError('SETTINGS_CONFLICT');
				attempted.push(entry);
				this.#storage.setItem(entry.key,entry.value);
			}
			for(const entry of entries)if(this.#storage.getItem(entry.key)!==entry.value)throw settingsError('SETTINGS_WRITE');
			committed=this.#read().values;
		} catch {
			let rollbackComplete=true;
			for(const entry of attempted.reverse()) {
				try {
					const current=this.#storage.getItem(entry.key);
					if(current===entry.previous)continue;
					if(current!==entry.value){rollbackComplete=false;continue;}
					if(entry.previous===null || entry.previous===undefined)this.#storage.removeItem(entry.key);
					else this.#storage.setItem(entry.key,entry.previous);
					if(this.#storage.getItem(entry.key)!==(entry.previous??null))rollbackComplete=false;
				} catch {rollbackComplete=false;}
			}
			const error=settingsError('SETTINGS_WRITE');error.rollbackComplete=rollbackComplete;throw error;
		}
		this.#accept(committed);
		try {this.#bus?.publish({type:ZENZA_SETTINGS_EVENT,keys:entries.map(e=>e.publicKey)});} catch { /* Storage succeeded; next explicit refresh reconciles. */ }
		return committed;
	}
	reset(names=SETTINGS_SCHEMA.map(d=>d.name)) {
		checkedSettingNames(names);
		return this.patch(Object.fromEntries(SETTINGS_SCHEMA.filter(d=>names.includes(d.name)).map(d=>[d.name,d.default])));
	}
	subscribe(callback) {
		this.#assertActive();if(typeof callback!=='function')throw settingsError('OPTION');
		this.#listeners.add(callback);return()=>this.#listeners.delete(callback);
	}
	dispose() {
		if(this.#disposed)return;this.#disposed=true;this.#listeners.clear();
		if(typeof this.#off==='function')this.#off();this.#off=null;
	}
}
return Object.freeze({ZenzaSettingsRepository});
})();
modules[3] = (() => {
const {SETTINGS_SCHEMA,DEFAULT_SETTINGS} = modules[1];
const {ZenzaSettingsRepository} = modules[2];
const {HistoryError} = modules[0];
const HISTORY_PRESETS=Object.freeze([1000,2500,5000,7500,10000,15000,20000]);
const APPLIED_PRESETS=Object.freeze([0,...HISTORY_PRESETS]);
const HISTORY_PREFERENCE_DEFAULTS=Object.freeze({...Object.fromEntries(SETTINGS_SCHEMA.map(d=>[d.key,d.default])),'commentHistory.enabled':false});
const EVENT='ZenzaWatch-comment-history-settings';
function createBrowserHistoryPreferences({window:win=globalThis.window,config,storage=win.localStorage}={}){
	const prefix='ZenzaWatch_',enabledKey=prefix+'commentHistory.enabled';
	const listeners=new Set();let repository,disposed=false,lastSignature='',snapshot;
	function checked(){if(disposed)throw new HistoryError('DISPOSED');}
	function read(){
		checked();
		try{
			if(!repository)repository=new ZenzaSettingsRepository({storage,prefix});
			const settings=repository.get(),raw=storage.getItem(enabledKey);
			const enabled=raw===null?false:JSON.parse(raw);
			if(typeof enabled!=='boolean')throw new Error('type');
			return Object.freeze({valid:true,enabled,settings});
		}catch{return Object.freeze({valid:false,enabled:false,settings:Object.freeze({...DEFAULT_SETTINGS}),error:'SETTINGS_INVALID'});}
	}
	function refresh(){
		snapshot=read();const signature=JSON.stringify(snapshot);
		if(signature===lastSignature)return snapshot;
		lastSignature=signature;
		if(snapshot.valid&&config?._data){
			const values={...Object.fromEntries(SETTINGS_SCHEMA.map(d=>[d.key,snapshot.settings[d.name]])),'commentHistory.enabled':snapshot.enabled};
			for(const [key,value] of Object.entries(values)){
				if(config.default&&!Object.hasOwn(config.default,key))continue;
				if(config._data[key]===value)continue;
				config._data[key]=value;
				const emit=typeof config.emitAsync==='function'?config.emitAsync:config.emit;
				if(typeof emit==='function'){emit.call(config,'update',key,value);emit.call(config,'update-'+key,value);}
			}
		}
		for(const fn of [...listeners]){try{fn(snapshot);}catch{}}
		return snapshot;
	}
	function publish(keys){win.dispatchEvent(new win.CustomEvent(EVENT,{detail:{keys}}));}
	const onStorage=e=>{if(!disposed&&(e.key===null||typeof e.key==='string'&&e.key.startsWith(prefix+'commentHistory.'))&&(!e.storageArea||e.storageArea===storage))refresh();};
	const onLocal=e=>{if(!disposed&&Array.isArray(e.detail?.keys)&&e.detail.keys.every(k=>Object.hasOwn(HISTORY_PREFERENCE_DEFAULTS,k)))refresh();};
	win.addEventListener('storage',onStorage);win.addEventListener(EVENT,onLocal);refresh();
	return {
		get(){checked();return refresh();},
		patch(changes){
			checked();if(!refresh().valid)throw new HistoryError('SETTINGS_INVALID');
			repository.patch(changes);refresh();publish(Object.keys(changes).map(k=>'commentHistory.'+k));return snapshot;
		},
		setEnabled(enabled){
			checked();if(typeof enabled!=='boolean')throw new HistoryError('OPTION');
			if(!refresh().valid)throw new HistoryError('SETTINGS_INVALID');
			if(snapshot.enabled===enabled)return snapshot;
			const before=storage.getItem(enabledKey),serialized=JSON.stringify(enabled);
			try{storage.setItem(enabledKey,serialized);if(storage.getItem(enabledKey)!==serialized)throw new Error();}
			catch{
				try{if(storage.getItem(enabledKey)===serialized){before===null?storage.removeItem(enabledKey):storage.setItem(enabledKey,before);}}catch{}
				throw new HistoryError('SETTINGS_WRITE');
			}
			refresh();publish(['commentHistory.enabled']);return snapshot;
		},
		subscribe(fn){checked();listeners.add(fn);return()=>listeners.delete(fn);},
		dispose(){if(disposed)return;disposed=true;win.removeEventListener('storage',onStorage);win.removeEventListener(EVENT,onLocal);repository?.dispose();repository=null;listeners.clear();}
	};
}
return Object.freeze({HISTORY_PRESETS,APPLIED_PRESETS,HISTORY_PREFERENCE_DEFAULTS,createBrowserHistoryPreferences});
})();
modules[4] = (() => {
const {HistoryError,integerOption,buildThreadRequest,validateThreads,normalizeWatch,withThreadKey,COMMENT_ORIGIN} = modules[0];
function assertNotCancelled(signal){if(signal?.aborted)throw new HistoryError('CANCELLED');}
async function withDeadline(work,{signal,timeoutMs=10000,timeoutCode='TIMEOUT'}={}){
	integerOption(timeoutMs,1,300000);if(!['TIMEOUT','TIME_LIMIT'].includes(timeoutCode))throw new HistoryError('OPTION');assertNotCancelled(signal);
	const controller=new AbortController();let timeout=false, rejectAbort;
	const onParent=()=>controller.abort();const onAbort=()=>rejectAbort(new HistoryError(timeout?timeoutCode:'CANCELLED'));
	const aborted=new Promise((_,reject)=>{rejectAbort=reject;});
	controller.signal.addEventListener('abort',onAbort,{once:true});signal?.addEventListener('abort',onParent,{once:true});
	const timer=setTimeout(()=>{timeout=true;controller.abort();},timeoutMs);
	try{return await Promise.race([Promise.resolve().then(()=>{assertNotCancelled(controller.signal);return work(controller.signal);}),aborted]);}
	finally{clearTimeout(timer);signal?.removeEventListener('abort',onParent);controller.signal.removeEventListener('abort',onAbort);}
}
function abortableDelay(ms,signal){
	integerOption(ms,0,300000);
	return new Promise((resolve,reject)=>{
		if(signal?.aborted){reject(new HistoryError('CANCELLED'));return;}
		const finish=()=>{signal?.removeEventListener('abort',cancel);resolve();};
		const timer=setTimeout(finish,ms);
		function cancel(){clearTimeout(timer);signal?.removeEventListener('abort',cancel);reject(new HistoryError('CANCELLED'));}
		signal?.addEventListener('abort',cancel,{once:true});
	});
}
async function readBoundedText(response,maxBytes,signal){
	if(!response.body)return '';
	const reader=response.body.getReader(),parts=[];let size=0,finished=false;
	const onAbort=()=>{void reader.cancel().catch(()=>{});};
	signal?.addEventListener('abort',onAbort,{once:true});
	try{
		while(true){assertNotCancelled(signal);const {done,value}=await reader.read();if(done){finished=true;break;}
			size+=value.byteLength;if(size>maxBytes)throw new HistoryError('RESPONSE_TOO_LARGE');parts.push(value);}
		const data=new Uint8Array(size);let offset=0;for(const part of parts){data.set(part,offset);offset+=part.byteLength;}
		return new TextDecoder('utf-8',{fatal:true}).decode(data);
	}finally{signal?.removeEventListener('abort',onAbort);if(!finished){try{await reader.cancel();}catch{}}reader.releaseLock();}
}
const API_CODES=new Set(['TOO_MANY_REQUESTS','EXPIRED_TOKEN','INVALID_TOKEN','INVALID_PARAMETER','NOT_FOUND','FORBIDDEN']);
function retryAfter(header){
	if(!header)return undefined;
	if(/^\d+(?:\.\d+)?$/.test(header)){const ms=Number(header)*1000;return Number.isSafeInteger(Math.ceil(ms))?Math.ceil(ms):undefined;}
	const value=Date.parse(header);return Number.isFinite(value)?Math.max(0,value-Date.now()):undefined;
}
async function requestJson(url,init,options={}){
	const {fetchImpl=globalThis.fetch,timeoutMs=10000,maxBytes=4*1024*1024,signal}=options;
	integerOption(maxBytes,1,8*1024*1024);if(typeof fetchImpl!=='function')throw new HistoryError('OPTION');
	try{
		return await withDeadline(async innerSignal=>{
			const response=await fetchImpl(url,{...init,signal:innerSignal});assertNotCancelled(innerSignal);
			const text=await readBoundedText(response,maxBytes,innerSignal);assertNotCancelled(innerSignal);
			let data;try{data=JSON.parse(text);}catch{}
			const raw=data?.meta?.errorCode,apiCode=API_CODES.has(raw)?raw:raw?'OTHER':undefined;
			const details={httpStatus:response.status,apiCode,retryAfterMs:retryAfter(response.headers.get('Retry-After'))};
			if(response.status===429||apiCode==='TOO_MANY_REQUESTS')throw new HistoryError('RATE_LIMITED',details);
			if(apiCode==='EXPIRED_TOKEN')throw new HistoryError('TOKEN_EXPIRED',details);
			if(apiCode==='INVALID_TOKEN')throw new HistoryError('TOKEN_INVALID',details);
			if(!response.ok)throw new HistoryError(apiCode?'API_ERROR':'HTTP_ERROR',details);
			if(!data)throw new HistoryError('INVALID_JSON',{httpStatus:response.status});
			if(data.meta?.status!==200||raw)throw new HistoryError('API_ERROR',details);
			return data;
		},{signal,timeoutMs});
	}catch(error){if(error instanceof HistoryError)throw error;throw new HistoryError('NETWORK_ERROR');}
}
async function requestThreads(context,options={}){
	const {url,init}=buildThreadRequest(context,options);
	return validateThreads(await requestJson(url,init,options),context,options.targets??context.targets);
}
const READ_HEADERS=Object.freeze({'X-Frontend-Id':'6','X-Frontend-Version':'0','X-Niconico-Language':'ja-jp'});
function checkedVideoId(id){
	if(typeof id!=='string'||!/^(?:(?:sm|so|nm))?\d+$/.test(id))throw new HistoryError('OPTION');return id;
}
async function requestWatchContext(videoId,options={}){
	const id=checkedVideoId(videoId);
	const data=await requestJson(`https://www.nicovideo.jp/watch/${id}?responseType=json`,
		{method:'GET',credentials:'include',cache:'no-store',redirect:'error'},options);
	return normalizeWatch(data,id);
}
async function requestThreadKey(context,options={}){
	if(context.server!==COMMENT_ORIGIN)throw new HistoryError('SERVER_NOT_ALLOWED');
	const id=checkedVideoId(context.videoId);
	const data=await requestJson(`https://nvapi.nicovideo.jp/v1/comment/keys/thread?videoId=${id}`,
		{method:'GET',headers:{...READ_HEADERS,'X-Niconico-Language':context.language},
			credentials:'include',mode:'cors',cache:'no-store',redirect:'error'},options);
	return withThreadKey(context,data?.data?.threadKey);
}
const SAFE_CODES=new Set(['OPTION','CANCELLED','TIMEOUT','TIME_LIMIT','REQUEST_LIMIT','RETRY_LIMIT','KEY_REFRESH_LIMIT',
	'ALREADY_RUN','HISTORY_RUNNING','BASELINE_LIMIT','SETTINGS_VERSION','RATE_LIMITED','TOKEN_EXPIRED','TOKEN_INVALID',
	'API_ERROR','HTTP_ERROR','INVALID_JSON','RESPONSE_TOO_LARGE','NETWORK_ERROR','RESPONSE_SCHEMA','COMMENT_SCHEMA',
	'TARGET_SCHEMA','TARGET_NOT_ALLOWED','MISSING_TARGET','IDENTITY_CONFLICT','WATCH_SCHEMA','VIDEO_MISMATCH','MISSING_KEY',
	'SERVER_NOT_ALLOWED','CONTEXT_CHANGED','UNKNOWN_ERROR']);
function safeError(error){
	const out={code:SAFE_CODES.has(error?.code)?error.code:'UNKNOWN_ERROR'};
	if(Number.isInteger(error?.httpStatus))out.httpStatus=error.httpStatus;
	if(API_CODES.has(error?.apiCode)||error?.apiCode==='OTHER')out.apiCode=error.apiCode;
	if(Number.isFinite(error?.retryAfterMs)&&error.retryAfterMs>=0)out.retryAfterMs=error.retryAfterMs;
	if(SAFE_CODES.has(error?.causeCode))out.causeCode=error.causeCode;
	return out;
}
return Object.freeze({assertNotCancelled,withDeadline,abortableDelay,requestThreads,requestWatchContext,requestThreadKey,safeError});
})();
modules[5] = (() => {
const {HistoryError,fail} = modules[0];
const {normalizeSettings} = modules[1];
const {withDeadline,abortableDelay,assertNotCancelled,safeError} = modules[4];
class RequestCoordinator {
	#settings;#now;#sleep;#random;#start=null;#nextAllowed=0;#tail=Promise.resolve();
	#attempts=0;#successful=0;#retries=0;#keyRefreshes=0;
	#byKind={metadata:0,comment:0,key:0};
	constructor({settings={},now=()=>performance.now(),sleep=abortableDelay,random=Math.random}={}){
		this.#settings=normalizeSettings(settings);this.#now=now;this.#sleep=sleep;this.#random=random;
		if([now,sleep,random].some(f=>typeof f!=='function'))fail('OPTION');
	}
	#remaining(){return this.#settings.maxElapsedMs-(this.#now()-this.#start);}
	#check(signal){
		assertNotCancelled(signal);
		if(this.#remaining()<=0)throw new HistoryError('TIME_LIMIT');
		if(this.#attempts>=this.#settings.maxRequests)throw new HistoryError('REQUEST_LIMIT');
	}
	async #queued(work,signal){
		assertNotCancelled(signal);
		if(this.#start===null)this.#start=this.#now();
		const previous=this.#tail;let release;
		const done=new Promise(resolve=>{release=resolve;});
		this.#tail=previous.catch(()=>{}).then(()=>done);
		try{
			this.#check(signal);
			await withDeadline(()=>previous,{signal,timeoutMs:Math.max(1,Math.ceil(this.#remaining())),timeoutCode:'TIME_LIMIT'});
			this.#check(signal);return await work();
		}finally{release();}
	}
	#retryable(e){
		return ['NETWORK_ERROR','TIMEOUT','RATE_LIMITED'].includes(e?.code)||
			e?.code==='HTTP_ERROR'&&[500,502,503,504].includes(e.httpStatus);
	}
	async #perform(work,{signal,kind='comment',onRetry}={}){
		if(!['metadata','comment','key'].includes(kind)||typeof work!=='function')fail('OPTION');
		let retried=0;
		while(true){
			this.#check(signal);
			const delay=Math.max(0,Math.ceil(this.#nextAllowed-this.#now()));
			if(delay>=this.#remaining())throw new HistoryError('TIME_LIMIT');
			if(delay)await withDeadline(s=>this.#sleep(delay,s),{signal,timeoutMs:Math.max(1,Math.ceil(this.#remaining())),timeoutCode:'TIME_LIMIT'});
			this.#check(signal);
			const remaining=this.#remaining(),timeoutMs=Math.min(this.#settings.requestTimeoutMs,Math.max(1,Math.ceil(remaining)));
			this.#attempts++;this.#byKind[kind]++;this.#nextAllowed=this.#now()+this.#settings.minIntervalMs;
			try{
				const result=await withDeadline(s=>work({signal:s,timeoutMs}),{signal,timeoutMs,
					timeoutCode:remaining<=this.#settings.requestTimeoutMs?'TIME_LIMIT':'TIMEOUT'});
				assertNotCancelled(signal);
				if(this.#remaining()<=0)throw new HistoryError('TIME_LIMIT');
				this.#successful++;return result;
			}catch(e){
				assertNotCancelled(signal);
				if(!this.#retryable(e))throw e;
				if(retried>=this.#settings.maxRetries)throw new HistoryError('RETRY_LIMIT',{...safeError(e),causeCode:safeError(e).code});
				this.#check(signal);
				const random=this.#random();const jitter=Number.isFinite(random)?Math.floor(Math.max(0,Math.min(1,random))*250):0;
				const exponential=1000*2**retried+jitter;
				const rateWait=e.code==='RATE_LIMITED'?(Number.isFinite(e.retryAfterMs)&&e.retryAfterMs>=0?e.retryAfterMs:60000):0;
				const waitMs=Math.ceil(Math.max(this.#settings.minIntervalMs,exponential,rateWait));
				if(waitMs>=this.#remaining())throw new HistoryError('TIME_LIMIT',{causeCode:safeError(e).code});
				this.#nextAllowed=Math.max(this.#nextAllowed,this.#now()+waitMs);
				retried++;this.#retries++;
				try{onRetry?.({kind,retryNumber:retried,waitMs,error:safeError(e)});}catch{}
			}
		}
	}
	execute(work,options={}){return this.#queued(()=>this.#perform(work,options),options.signal);}
	refresh(work,options={}){
		return this.#queued(()=>{
			if(this.#keyRefreshes>=this.#settings.maxKeyRefreshes)throw new HistoryError('KEY_REFRESH_LIMIT');
			this.#keyRefreshes++;return this.#perform(work,{...options,kind:'key'});
		},options.signal);
	}
	stats(){
		return {attempts:this.#attempts,successfulRequests:this.#successful,retries:this.#retries,keyRefreshes:this.#keyRefreshes,
			requestsByKind:{...this.#byKind},remainingRequests:Math.max(0,this.#settings.maxRequests-this.#attempts),
			elapsedMs:this.#start===null?0:Math.max(0,Math.round(this.#now()-this.#start))};
	}
}
return Object.freeze({RequestCoordinator});
})();
modules[6] = (() => {
const {validateThreads,integerOption,fail} = modules[0];
class LayeredCommentStore {
	#context;
	#items=new Map();
	#normalMeta=new Map();
	#historyMeta=new Map();
	#normalCount=0;
	#historyCount=0;
	#overlapCount=0;
	#additionalOrder=[];
	constructor(context){this.#context=context;}
	#threadKey(t){return JSON.stringify([t.id,t.fork]);}
	#key(t,c){return JSON.stringify([this.#context.videoId,this.#context.language,t.id,t.fork,c.no]);}
	#add(input,kind,allowance){
		integerOption(allowance,0,50000);
		if(!Array.isArray(input))fail('RESPONSE_SCHEMA');
		if(!input.length)return {added:0,duplicates:0,limited:false};
		const threads=validateThreads({meta:{status:200},data:{threads:input}},this.#context,input.map(t=>({id:t.id,fork:t.fork})));
		const pageIds=new Map();
		for(const t of threads)for(const c of t.comments){
			const k=this.#key(t,c),old=this.#items.get(k);
			const id=old?.normal?.id??old?.history?.id??pageIds.get(k);
			if(id!==undefined && id!==c.id)fail('IDENTITY_CONFLICT');
			pageIds.set(k,c.id);
		}
		let added=0,duplicates=0,limited=false;
		for(const t of threads){
			const tk=this.#threadKey(t);
			const meta=kind==='normal'?this.#normalMeta:this.#historyMeta;
			meta.set(tk,{id:t.id,fork:t.fork,commentCount:t.commentCount});
			for(const c of t.comments){
				const k=this.#key(t,c),old=this.#items.get(k);
				const gains=kind==='history'?!old?.normal&&!old?.history:!old?.normal;
				if(gains && added>=allowance){limited=true;continue;}
				const entry=old??{thread:tk,normal:null,history:null};
				if(entry[kind])duplicates++;
				else {
					if(kind==='normal')this.#normalCount++;else this.#historyCount++;
					if(entry[kind==='normal'?'history':'normal'])this.#overlapCount++;
				}
				if(gains){added++;if(kind==='history')this.#additionalOrder.push(k);}
				entry[kind]=c;
				this.#items.set(k,entry);
			}
		}
		return {added,duplicates,limited};
	}
	addNormal(threads){return this.#add(threads,'normal',50000);}
	addHistory(threads,allowance=50000){return this.#add(threads,'history',allowance);}
	removeHistory(){
		for(const [key,entry] of this.#items){
			if(entry.normal)entry.history=null;else this.#items.delete(key);
		}
		this.#historyMeta.clear();this.#historyCount=0;this.#overlapCount=0;this.#additionalOrder=[];
	}
	additionalOrder(){return this.#additionalOrder.filter(k=>{const e=this.#items.get(k);return !!(e?.history&&!e.normal);});}
	restoreAdditionalOrder(keys){
		if(!Array.isArray(keys))return;
		const current=new Set(this.#additionalOrder),seen=new Set(),out=[];
		for(const k of keys)if(typeof k==='string'&&current.has(k)&&!seen.has(k)){seen.add(k);out.push(k);}
		for(const k of this.#additionalOrder)if(!seen.has(k)){seen.add(k);out.push(k);}
		this.#additionalOrder=out;
	}
	historySnapshot(){
		const out=new Map([...this.#historyMeta].map(([k,t])=>[k,{...t,comments:[]}]));
		for(const entry of this.#items.values())if(entry.history){
			const c=entry.history;out.get(entry.thread).comments.push({...c,commands:[...c.commands]});
		}
		return [...out.values()];
	}
	counts(){
		return {normalCount:this.#normalCount,historyCount:this.#historyCount,overlapCount:this.#overlapCount,
			additionalCount:this.#historyCount-this.#overlapCount,unionCount:this.#items.size};
	}
	snapshot({historyEnabled=true,historyOnly=false,historyLimit}={}){
		const out=new Map();
		if(historyEnabled)for(const [k,t] of this.#historyMeta)out.set(k,{...t,comments:[]});
		for(const [k,t] of this.#normalMeta)out.set(k,{...t,comments:[]});
		let allowed=null;
		if(historyLimit!==undefined){integerOption(historyLimit,0,50000);allowed=new Set(this.additionalOrder().slice(0,historyLimit));}
		for(const [key,entry] of this.#items){
			const history=entry.history&&(!allowed||entry.normal||allowed.has(key))?entry.history:null;
			const c=historyOnly?(entry.normal?null:history):(entry.normal??(historyEnabled?history:null));
			if(c)out.get(entry.thread).comments.push({...c,commands:[...c.commands]});
		}
		for(const t of out.values())t.comments.sort((a,b)=>a.no-b.no);
		return [...out.values()];
	}
}
return Object.freeze({LayeredCommentStore});
})();
modules[7] = (() => {
const {HistoryError,integerOption,checkedTargets,validateThreads,summarizeThreads,withThreadKey} = modules[0];
const {requestThreads,requestThreadKey,assertNotCancelled,safeError} = modules[4];
const {normalizeSettings} = modules[1];
const {RequestCoordinator} = modules[5];
const {LayeredCommentStore} = modules[6];
const resumeIdentity=c=>JSON.stringify([c.videoId,c.language,c.server,c.targets.map(t=>[String(t.id),t.fork]).sort()]);
const RESUMABLE=new Set(['comment_limit','page_limit','request_limit','time_limit','retry_limit','cancelled','network_error','timeout','rate_limited','key_refresh_limit','token_invalid','token_expired','api_error','http_error']);
class HistorySession {
	#context;#settings;#coordinator;#store;#baseline;#fetchPage;#refreshKey;
	#controller=new AbortController();#started=false;#report;#resume;#finishedNetwork;
	constructor(context,{settings={},coordinator,baseline,resume,fetchPage=requestThreads,refreshKey=requestThreadKey}={}){
		this.#context=context;this.#settings=Object.freeze(normalizeSettings(settings));
		this.#coordinator=coordinator??new RequestCoordinator({settings:this.#settings});
		if(resume && (resume.identity!==resumeIdentity(context)||!Array.isArray(resume.history)||!Array.isArray(resume.cursors)))throw new HistoryError('CONTEXT_CHANGED');
		this.#resume=resume?JSON.parse(JSON.stringify(resume)):null;
		this.#baseline=baseline;this.#fetchPage=fetchPage;this.#refreshKey=refreshKey;
		this.#store=new LayeredCommentStore(context);
		this.#report={schema:'nico-comment-history-session/1',version:'0.2.0',videoId:context.videoId,language:context.language,
			settings:{...this.#settings},reason:'not_started',pages:0,duplicates:0,targetResults:[],
			historyCursorProgressed:false,completeCoverageVerified:false};
	}
	cancel(){this.#controller.abort();}
	removeHistory(){this.cancel();this.#store.removeHistory();}
	snapshot(options){return this.#store.snapshot(options);}
	report(){return JSON.parse(JSON.stringify({...this.#report,counts:this.#store.counts(),network:this.#finishedNetwork??this.#coordinator.stats()}));}
	resumeData(){
		if(!this.#report.finishedAt)throw new HistoryError('OPTION');
		return {identity:resumeIdentity(this.#context),history:this.#store.historySnapshot(),order:this.#store.additionalOrder(),
			cursors:this.#report.targetResults.map(s=>({...s})),startWhen:this.#report.startWhen};
	}
	#verifyRefreshed(next){
		const previous=this.#context;
		const targetIdentity=c=>JSON.stringify(c.targets.map(t=>[String(t.id),t.fork]).sort());
		try{
			if(!next||next.videoId!==previous.videoId||next.server!==previous.server||next.language!==previous.language||
				targetIdentity(next)!==targetIdentity(previous)||typeof next.threadKey!=='string'||!next.threadKey)throw new Error();
		}catch{throw new HistoryError('CONTEXT_CHANGED');}
		return withThreadKey(previous,next.threadKey);
	}
	async #page(request,onRetry){
		const signal=this.#controller.signal;
		while(true){
			assertNotCancelled(signal);
			try{
				return await this.#coordinator.execute(async ({signal,timeoutMs})=>{
					const data=await this.#fetchPage(this.#context,{...request,signal,timeoutMs});assertNotCancelled(signal);
					return validateThreads({meta:{status:200},data:{threads:data}},this.#context,request.targets);
				},{signal,kind:'comment',onRetry});
			}catch(e){
				if(!['TOKEN_EXPIRED','TOKEN_INVALID'].includes(e?.code))throw e;
				const next=await this.#coordinator.refresh(async options=>this.#verifyRefreshed(await this.#refreshKey(this.#context,options)),{signal,onRetry});
				assertNotCancelled(signal);this.#context=next;
			}
		}
	}
	async run({signal,startWhen=Math.floor(Date.now()/1000),onProgress}={}){
		integerOption(startWhen,0,9999999999);
		if(this.#started)throw new HistoryError('ALREADY_RUN');this.#started=true;
		this.#report.startedAt=new Date().toISOString();this.#report.startWhen=startWhen;
		const abort=()=>this.cancel();signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)this.cancel();
		const localSignal=this.#controller.signal;
		const notify=extra=>{try{onProgress?.({event:'progress',...extra,pages:this.#report.pages,counts:this.#store.counts(),network:this.#coordinator.stats()});}catch{}};
		const onRetry=event=>notify({event:'retry',...event});
		try{
			assertNotCancelled(localSignal);
			const baseline=this.#baseline??await this.#page({targets:this.#context.targets},onRetry);
			assertNotCancelled(localSignal);
			const normal=this.#store.addNormal(baseline);if(normal.limited)throw new HistoryError('BASELINE_LIMIT');
			if(this.#resume){
				const restored=this.#store.addHistory(this.#resume.history,this.#settings.maxAdditionalComments);
				if(restored.limited)throw new HistoryError('OPTION');
				this.#store.restoreAdditionalOrder(this.#resume.order);
			}
			notify({event:'baseline'});
			const selected=this.#context.targets.filter(t=>t.fork==='main'||this.#settings.includeEasy&&t.fork==='easy');
			if(!selected.length)this.#report.reason='no_history_target';
			const targets=selected.length?checkedTargets(this.#context,selected):[];
			this.#report.targetResults=targets.map(t=>{
				if(!this.#resume)return {...t,pages:0,nextWhen:startWhen,reason:null};
				const matches=this.#resume.cursors.filter(s=>s.id===t.id&&s.fork===t.fork);
				if(matches.length!==1)throw new HistoryError('CONTEXT_CHANGED');
				const previous=matches[0];integerOption(previous.nextWhen,0,9999999999);
				return {...t,pages:0,nextWhen:previous.nextWhen,reason:RESUMABLE.has(previous.reason)?null:previous.reason};
			});
			const states=this.#report.targetResults;let stopped=false;
			while(states.some(s=>s.reason===null)&&!stopped){
				for(const state of states){
					if(state.reason!==null)continue;
					assertNotCancelled(localSignal);
					if(this.#report.pages>=this.#settings.maxPages){this.#report.reason='page_limit';stopped=true;break;}
					if(this.#store.counts().additionalCount>=this.#settings.maxAdditionalComments){this.#report.reason='comment_limit';stopped=true;break;}
					const target={id:state.id,fork:state.fork};const cursor=state.nextWhen;
					const threads=await this.#page({targets:[target],when:cursor,resFrom:-1000},onRetry);
					assertNotCancelled(localSignal);
					const summary=summarizeThreads(threads)[0];
					state.lastPageCount=summary.returnedCount;state.oldestUnixSeconds=summary.oldestUnixSeconds;state.newestUnixSeconds=summary.newestUnixSeconds;
					this.#report.pages++;state.pages++;
					if(threads[0].comments.some(c=>Date.parse(c.postedAt)/1000>cursor)){
						state.reason='cursor_not_respected';this.#report.reason=state.reason;stopped=true;break;
					}
					const newestFirst=threads.map(t=>({...t,comments:[...t.comments].sort((a,b)=>Date.parse(b.postedAt)-Date.parse(a.postedAt)||b.no-a.no)}));
					const added=this.#store.addHistory(newestFirst,this.#settings.maxAdditionalComments-this.#store.counts().additionalCount);
					this.#report.duplicates+=added.duplicates;
					notify({event:'page',target,returnedCount:summary.returnedCount,added:added.added,oldestUnixSeconds:summary.oldestUnixSeconds});
					assertNotCancelled(localSignal);
					if(added.limited){
						state.reason='comment_limit';this.#report.reason=state.reason;stopped=true;break;
					}
					const reachedGoal=this.#store.counts().additionalCount>=this.#settings.maxAdditionalComments;
					if(!summary.returnedCount){state.reason='empty_page';continue;}
					const oldest=threads[0].comments.reduce((min,c)=>Math.min(min,Date.parse(c.postedAt)/1000),Infinity);
					if(!Number.isInteger(oldest)){state.reason='subsecond_boundary_unverified';continue;}
					if(summary.oldestUnixSeconds===summary.newestUnixSeconds&&summary.returnedCount>1){
						state.reason='same_second_boundary_unverified';continue;
					}
					state.nextWhen=oldest;
					if(oldest>=cursor){state.reason='cursor_stalled';continue;}
					this.#report.historyCursorProgressed=true;
					if(reachedGoal){state.reason='comment_limit';this.#report.reason=state.reason;stopped=true;break;}
				}
			}
			if(!stopped&&states.length){
				const reasons=[...new Set(states.map(s=>s.reason))];
				this.#report.reason=reasons.length===1?reasons[0]:'target_boundaries';
				if(this.#store.counts().additionalCount>=this.#settings.maxAdditionalComments)this.#report.reason='comment_limit';
			}
			for(const state of states)if(state.reason===null)state.reason=this.#report.reason;
		}catch(e){
			this.#report.error=safeError(e);this.#report.reason=this.#report.error.code.toLowerCase();
			for(const state of this.#report.targetResults)if(state.reason===null)state.reason=this.#report.reason;
		}finally{
			signal?.removeEventListener('abort',abort);this.#report.finishedAt=new Date().toISOString();
			this.#finishedNetwork=this.#coordinator.stats();
			this.#report.resumeAvailable=this.#report.targetResults.some(s=>RESUMABLE.has(s.reason));
		}
		return this.report();
	}
}
return Object.freeze({HistorySession});
})();
modules[8] = (() => {
const {HistoryError,normalizeWatch,validateThreads,integerOption} = modules[0];
const ZENZA_FORKS = Object.freeze({main:0,owner:1,easy:2});
function seedError(code) { throw new HistoryError(code); }
function freezeSeedData(value) {
	if (value && typeof value === 'object') {
		for (const child of Object.values(value)) freezeSeedData(child);
		Object.freeze(value);
	}
	return value;
}
function copyThreadDescriptor(info) {
	if (!info || !Object.hasOwn(ZENZA_FORKS, info.forkLabel) ||
			info.fork !== ZENZA_FORKS[info.forkLabel] || typeof info.label !== 'string' ||
			!Number.isSafeInteger(info.layer?.index) || info.layer.index < 0) seedError('THREAD_METADATA');
	const out = {id:String(info.id),fork:info.fork,forkLabel:info.forkLabel,label:info.label,
		layer:{index:info.layer.index}};
	if (typeof info.layer.isTranslucent === 'boolean') out.layer.isTranslucent = info.layer.isTranslucent;
	return out;
}
function createZenzaSeed({videoInfo,normalResult,playbackGeneration,normalRevision} = {}) {
	if (typeof playbackGeneration !== 'string' || !playbackGeneration) seedError('OPTION');
	integerOption(normalRevision,1,Number.MAX_SAFE_INTEGER);
	if (normalResult?.format !== 'threads' || !normalResult.threadInfo || !normalResult.body) seedError('UNSUPPORTED_FORMAT');
	const msg = videoInfo?.msgInfo, resultInfo = normalResult.threadInfo;
	if (!msg || typeof videoInfo.videoId !== 'string') seedError('VIDEO_MISSING');
	const videoId = videoInfo.videoId;
	if (msg.videoId !== videoId || resultInfo.videoId !== videoId) seedError('VIDEO_MISMATCH');
	const rawWhen = resultInfo.when ?? 0;
	const isWaybackMode = resultInfo.isWaybackMode === true;
	let historyStartWhen = null;
	if (isWaybackMode) {
		const now = Math.floor(Date.now() / 1000);
		if (!Number.isSafeInteger(rawWhen) || rawWhen <= 0 || rawWhen > now) seedError('UNSUPPORTED_WAYBACK');
		historyStartWhen = rawWhen;
	} else if (rawWhen !== 0) {
		seedError('UNSUPPORTED_WAYBACK');
	}
	const language = normalResult.body.__usedLanguage ?? resultInfo.language;
	if (typeof language !== 'string' || !/^[a-z]{2}-[a-z]{2}$/i.test(language)) seedError('LANGUAGE_MISSING');
	const nv = msg.nvComment;
	const context = normalizeWatch({video:{id:videoId},comment:{nvComment:{
		server:nv?.server,threadKey:nv?.threadKey,params:{targets:nv?.params?.targets,language}
	}}},videoId);
	const watchId = String(videoInfo.contextWatchId ?? videoInfo.watchId ?? videoId);
	if (!/^(?:(?:sm|so|nm))?\d+$/.test(watchId)) seedError('WATCH_ID');
	if (!Number.isFinite(videoInfo.duration) || videoInfo.duration < 0) seedError('DURATION');
	if (!Array.isArray(msg.threads)) seedError('THREAD_METADATA');
	const descriptors = new Map();
	for (const target of context.targets) {
		const found = msg.threads.filter(t => String(t.id) === target.id && t.forkLabel === target.fork);
		if (found.length !== 1) seedError('THREAD_METADATA');
		descriptors.set(JSON.stringify([target.id,target.fork]),copyThreadDescriptor(found[0]));
	}
	const baseline = validateThreads({meta:{status:200},data:{threads:normalResult.body.threads}},context);
	const mainThreadId = resultInfo.threadId ?? null;
	if (mainThreadId !== null && !context.targets.some(t=>t.id===String(mainThreadId))) seedError('THREAD_METADATA');
	return freezeSeedData({context,
		identity:{videoId,watchId,language,playbackGeneration,normalRevision},baseline,historyStartWhen,
		render:{duration:videoInfo.duration,mainThreadId,threads:[...descriptors.values()]}
	});
}
function toZenzaThreads(seed, threads) {
	if (!seed?.context || !Array.isArray(seed.render?.threads)) seedError('OPTION');
	const copied = validateThreads({meta:{status:200},data:{threads}},seed.context);
	return {threads:copied.map(thread=>{
		const info = seed.render.threads.find(t=>t.id===thread.id && t.forkLabel===thread.fork);
		if (!info) seedError('THREAD_METADATA');
		return {...thread,info:{...info,layer:{...info.layer}}};
	})};
}
return Object.freeze({createZenzaSeed,toZenzaThreads});
})();
modules[9] = (() => {
const {HistorySession} = modules[7];
const {createZenzaSeed,toZenzaThreads} = modules[8];
const {normalizeSettings} = modules[1];
const MAX_ADDITIONAL=20000;
const RESET={phase:'idle',goal:0,additionalCount:0,cachedAdditional:0,appliedAdditional:0,appliedTarget:0,cacheAvailable:false,pages:0,reason:null,canContinue:false};
class CommentHistoryController {
	#preferences;#render;#clear;#create;#acquire;#notify;#off;#seed;#session;#report;
	#epoch=0;#normalRevision=0;#operation;#promise=Promise.resolve();#listeners=new Set();#disposed=false;
	#state={enabled:false,videoId:null,normalCount:0,...RESET};
	constructor({preferences,render,clearRender,createSession=(c,o)=>new HistorySession(c,o),acquire=fn=>fn(),notify=()=>{}}={}){
		if(!preferences||[preferences.get,preferences.subscribe,render,clearRender,createSession,acquire,notify].some(f=>typeof f!=='function'))throw new TypeError('Invalid history controller dependencies');
		this.#preferences=preferences;this.#render=render;this.#clear=clearRender;this.#create=createSession;this.#acquire=acquire;this.#notify=notify;
		this.#state.enabled=preferences.get().enabled===true;
		this.#off=preferences.subscribe(snapshot=>{
			if(this.#disposed)return;
			const before=this.#state.enabled;this.#state.enabled=snapshot.enabled===true;
			if(!this.#state.enabled){this.#cancel(true);this.#emit({...RESET});}
			else {this.#emit({});if(!before&&this.#seed)void this.start();}
		});
	}
	get state(){return JSON.parse(JSON.stringify(this.#state));}
	subscribe(fn){this.#listeners.add(fn);fn(this.state);return()=>this.#listeners.delete(fn);}
	#emit(changes){
		Object.assign(this.#state,changes);
		if('additionalCount' in changes)this.#state.cachedAdditional=this.#state.additionalCount;
		for(const fn of [...this.#listeners]){try{fn(this.state);}catch{}}
	}
	#cancel(clear){
		this.#epoch++;this.#operation?.abort();this.#operation=null;
		this.#session?.removeHistory();this.#session=null;this.#report=null;
		if(clear){try{this.#clear();}catch{}}
	}
	invalidate(){
		this.#cancel(true);this.#seed=null;
		this.#emit({...RESET,videoId:null,normalCount:0});
	}
	async normalReady({videoInfo,result,generation}={}){
		if(this.#disposed)return;
		this.invalidate();
		try{
			this.#seed=createZenzaSeed({videoInfo,normalResult:result,playbackGeneration:generation,normalRevision:++this.#normalRevision});
			const normalCount=this.#seed.baseline.reduce((n,t)=>n+t.comments.length,0);
			this.#emit({videoId:this.#seed.identity.videoId,normalCount});
		}catch(error){this.#emit({phase:'unavailable',reason:typeof error?.code==='string'?error.code:'CONTEXT_CHANGED'});return;}
		if(this.#state.enabled)return this.start();
	}
	setEnabled(value){this.#preferences.setEnabled(!!value);}
	stop(){
		if(this.#state.phase==='queued'){this.#operation?.abort();}
		else this.#session?.cancel();
	}
	whenIdle(){return this.#promise;}
	more(){return this.start({more:true});}
	restart(){return this.start({restart:true});}
	setAppliedCount(value){
		const n=typeof value==='number'?value:typeof value==='string'&&value.trim()!==''?Number(value):NaN;
		if(!Number.isInteger(n)||n<0||n>MAX_ADDITIONAL)throw new TypeError('Invalid applied additional count');
		if(this.#disposed||!this.#seed||!this.#state.enabled)return Promise.resolve(this.state);
		if(this.#operation)return this.#promise;
		if(!this.#session||!this.#report){
			if(n===0){this.#emit({appliedTarget:0});return Promise.resolve(this.state);}
			return this.start({target:n});
		}
		const cached=this.#report.counts.additionalCount;
		if(n>cached&&this.#report.resumeAvailable&&cached<MAX_ADDITIONAL)return this.start({more:true,target:n});
		return this.start({displayOnly:true,target:n});
	}
	start({more=false,restart=false,target,displayOnly=false}={}){
		if(this.#disposed||!this.#seed||!this.#state.enabled)return Promise.resolve(this.state);
		if(this.#operation)return this.#promise;
		let settings;try{settings=normalizeSettings(this.#preferences.get().settings);}catch{this.#emit({phase:'unavailable',reason:'SETTINGS_INVALID'});return Promise.resolve(this.state);}
		if(displayOnly&&(!this.#session||!this.#report))return Promise.resolve(this.state);
		if(more&&target===undefined&&this.#state.additionalCount>=MAX_ADDITIONAL&&this.#state.phase!=='render-error')return Promise.resolve(this.state);
		if(more&&this.#report&&!this.#report.resumeAvailable&&this.#state.phase!=='render-error')return Promise.resolve(this.state);
		const retryRender=this.#state.phase==='render-error'&&!restart&&target===undefined;
		const applyOnly=displayOnly||retryRender;
		const continuing=!!(more&&!restart&&this.#session&&this.#report);
		const resume=continuing?this.#session.resumeData():undefined;
		if(continuing)settings.includeEasy=this.#report.settings.includeEasy;
		const oldGoal=this.#state.goal;
		const goal=applyOnly?oldGoal:
			target!==undefined?Math.min(MAX_ADDITIONAL,target):
			continuing?Math.min(MAX_ADDITIONAL,this.#state.additionalCount<oldGoal?oldGoal:oldGoal+settings.maxAdditionalComments):settings.maxAdditionalComments;
		const appliedTarget=target!==undefined?target:retryRender?this.#state.appliedTarget:goal;
		const epoch=++this.#epoch,operation=new AbortController();this.#operation=operation;
		const current=()=>!this.#disposed&&this.#epoch===epoch&&!operation.signal.aborted&&this.#state.enabled;
		const seed=this.#seed;
		this.#emit({phase:applyOnly?'applying':'queued',goal,appliedTarget,reason:applyOnly?this.#state.reason:null,canContinue:false});
		this.#promise=(async()=>{
			try{
				if(!applyOnly){
					await this.#acquire(async()=>{
						if(!current())return;
						this.#session=this.#create(seed.context,{baseline:seed.baseline,settings:{...settings,maxAdditionalComments:goal},resume});
						const session=this.#session;
						this.#emit({phase:'fetching',pages:0});
						const report=await session.run({signal:operation.signal,startWhen:resume?.startWhen??seed.historyStartWhen??Math.floor(Date.now()/1000),onProgress:progress=>{
							if(current())this.#emit({phase:'fetching',additionalCount:progress.counts.additionalCount,pages:progress.pages,network:progress.network,
								waitingMs:progress.event==='retry'?progress.waitMs:0});
						}});
						if(!current())return;
						this.#report=report;
					},operation.signal);
				}
				if(!current()||!this.#report||!this.#session)return;
				const report=this.#report;
				this.#emit({phase:'applying',additionalCount:report.counts.additionalCount,cacheAvailable:true,pages:report.pages,network:report.network,waitingMs:0});
				let applied;
				const limit=Math.min(appliedTarget,report.counts.additionalCount);
				try{applied=await this.#render(toZenzaThreads(seed,this.#session.snapshot({historyOnly:true,historyLimit:limit})),{isCurrent:current,signal:operation.signal});}
				catch{
					if(current()){this.#emit({phase:'render-error',reason:'render_failed',canContinue:true});this.#notify('コメント増量：取得済みデータの反映に失敗しました。パネルから再試行できます。');}
					return;
				}
				if(!current())return;
				const partial=!['comment_limit','empty_page','no_history_target'].includes(report.reason);
				this.#emit({phase:partial?'partial':'ready',reason:report.reason,appliedAdditional:applied?.additionalCount??limit,
					canContinue:report.resumeAvailable&&report.counts.additionalCount<MAX_ADDITIONAL});
				if(partial&&report.reason!=='cancelled'&&!displayOnly)this.#notify('コメント増量：一部取得で終了しました。取得済みの正常なコメントを反映しました。');
			}catch{
				if(this.#epoch===epoch&&this.#state.enabled){
					this.#emit({phase:'partial',reason:operation.signal.aborted?'cancelled':'operation_failed',canContinue:!!this.#report?.resumeAvailable});
					if(!operation.signal.aborted)this.#notify('コメント増量：取得を開始できませんでした。パネルから再試行できます。');
				}
			}finally{if(this.#epoch===epoch)this.#operation=null;}
			return this.state;
		})();
		return this.#promise;
	}
	dispose(){if(this.#disposed)return;this.#disposed=true;this.invalidate();this.#off?.();this.#listeners.clear();}
}
return Object.freeze({CommentHistoryController});
})();
modules[10] = (() => {
const {SETTINGS_SCHEMA} = modules[1];
const {HISTORY_PRESETS,APPLIED_PRESETS,createBrowserHistoryPreferences} = modules[3];
const {CommentHistoryController} = modules[9];
const HISTORY_ICON='<svg viewBox="0 0 36 36" aria-hidden="true"><path fill-rule="evenodd" d="M8 7h20a3 3 0 0 1 3 3v13a3 3 0 0 1-3 3H16l-6 5v-5H8a3 3 0 0 1-3-3V10a3 3 0 0 1 3-3Zm1 3a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h4v2l2.4-2H27a1 1 0 0 0 1-1V11a1 1 0 0 0-1-1H9Z"/><path d="M16.5 12h3v3.5H23v3h-3.5V22h-3v-3.5H13v-3h3.5Z"/></svg>';
const CSS=`
.commentHistorySwitch .controlButtonInner{display:inline-block;width:26px;height:26px;vertical-align:middle}
.commentHistorySwitch svg{display:block;width:100%;height:100%;fill:currentColor}
.commentHistorySwitch.is-active{color:var(--enabled-button-color,#9cf);opacity:1}
.commentHistorySwitch.is-active svg{filter:drop-shadow(0 0 3px var(--enabled-button-color,#9cf))}
.commentHistorySwitch.is-fetching svg{animation:zenzaHistoryPulse 1.6s ease-in-out infinite}
@keyframes zenzaHistoryPulse{50%{opacity:.48}}
.zenzaCommentHistoryPanel{position:fixed;z-index:6060001;box-sizing:border-box;width:360px;max-width:calc(100vw - 32px);max-height:calc(100vh - 32px);overflow:auto;overscroll-behavior:contain;padding:16px;background:rgba(18,29,45,.97);color:#e6eef5;border:1px solid #455468;border-radius:12px;box-shadow:0 8px 36px #0009;font:13px/1.5 'Yu Gothic UI','Meiryo',sans-serif;text-align:left;display:none;transform-origin:var(--ch-origin,100% 100%)}
.zenzaCommentHistoryPanel.is-open{display:block;animation:zenzaHistoryIn .22s cubic-bezier(.2,.9,.3,1.15) both}
.zenzaCommentHistoryPanel.is-closing{pointer-events:none;animation:zenzaHistoryOut .16s ease-in both}
@keyframes zenzaHistoryIn{from{opacity:0;transform:translate(12px,18px) scale(.86);filter:blur(2px)}to{opacity:1;transform:none;filter:none}}
@keyframes zenzaHistoryOut{from{opacity:1;transform:none}to{opacity:0;transform:translate(8px,12px) scale(.92)}}
@media(prefers-reduced-motion:reduce){.zenzaCommentHistoryPanel.is-open,.zenzaCommentHistoryPanel.is-closing{animation-duration:.01s}.commentHistorySwitch.is-fetching svg{animation:none}}
.zenzaCommentHistoryPanel button,.zenzaCommentHistoryPanel select,.ch-settings input{font:inherit;box-sizing:border-box}
.zenzaCommentHistoryPanel button,.ch-settings button{cursor:pointer;border:1px solid #496071;border-radius:7px;padding:7px 10px;background:#27384b;color:#edf7ff}
.zenzaCommentHistoryPanel button:disabled{cursor:default;opacity:.45}
.zenzaCommentHistoryPanel button:focus-visible,.zenzaCommentHistoryPanel select:focus-visible,.ch-settings input:focus-visible{outline:2px solid #72e4cc;outline-offset:2px}
.ch-header{display:flex;align-items:center;gap:12px;margin-bottom:12px}.ch-header strong{font-size:16px;flex:1}.ch-header button{padding:1px 8px;font-size:22px;background:none;border:0}
.ch-enable{display:flex;align-items:center;gap:6px;white-space:nowrap}.ch-enable input{accent-color:#72e4cc}
.ch-counter{font-size:26px;font-weight:700;font-variant-numeric:tabular-nums;color:#91f2dc}.ch-counter small{font-size:12px;font-weight:400;color:#b4c2d0;margin-left:5px}
.ch-status,.ch-note{color:#b4c2d0;font-size:12px;white-space:normal;overflow-wrap:anywhere}.ch-note{margin:9px 0}
.zenzaCommentHistoryPanel progress{width:100%;height:6px;accent-color:#72e4cc;display:block;margin:10px 0 14px}
.ch-action-row{display:grid;grid-template-columns:124px minmax(0,1fr);gap:10px;align-items:end;margin-top:12px}.ch-action-row label{display:grid;gap:3px;color:#b4c2d0;font-size:11px}
.zenzaCommentHistoryPanel select{width:100%;height:36px;padding:4px 8px;color:#ecf7fa;background:#1c3044;border:1px solid #486175;border-radius:7px}
.zenzaCommentHistoryPanel [data-ch-primary]{background:#79dfc9;color:#0c2b28;border-color:#79dfc9;min-height:36px;font-weight:700}
.ch-details{border-top:1px solid #33475d;margin-top:14px;padding-top:11px}.ch-details summary{cursor:pointer;color:#cedde9}.ch-details>div{margin-top:10px}.ch-counts{display:grid;grid-template-columns:1fr auto;gap:5px;margin-bottom:9px;font-size:12px}.ch-footer{display:flex;justify-content:space-between;gap:8px;align-items:center;margin-top:12px}.ch-footer button{background:none;font-size:12px;padding:5px 8px}
.ch-advanced[hidden]{display:none}.ch-advanced{margin-top:16px;border-top:1px solid #415568;padding-top:12px}.ch-settings{font:13px/1.5 'Yu Gothic UI','Meiryo',sans-serif}.ch-settings label{display:grid;grid-template-columns:minmax(0,1fr) 100px;align-items:center;gap:10px;margin:10px 0}.ch-settings input[type=number]{width:100px;color:inherit;background:transparent;border:1px solid #60778a;border-radius:5px;padding:5px}.ch-settings input[type=checkbox]{justify-self:end;accent-color:#72e4cc}.ch-settings small{opacity:.75}.ch-setting-error{color:#ffbe94;min-height:1.5em}.ch-settings [aria-invalid=true]{outline:1px solid #ffae86}
.is-youTube .commentHistorySwitch{display:none}
`;
function style(doc){if(doc.querySelector('style[data-zenza-comment-history]'))return;const el=doc.createElement('style');el.dataset.zenzaCommentHistory='';el.textContent=CSS;doc.head.append(el);}
const fmt=n=>Number(n||0).toLocaleString('ja-JP');
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function mountHistorySettings(container,{preferences}={}){
	const doc=container.ownerDocument;style(doc);container.classList.add('ch-settings');
	container.innerHTML='<strong>コメント増量</strong><p class="ch-note">変更した取得条件は次の取得に使用します。取得済みデータの取り直しは行いません。</p>'+SETTINGS_SCHEMA.map(d=>
		`<label><span>${esc(d.label)}${d.type==='integer'?`<br><small>${d.min.toLocaleString()}～${d.max.toLocaleString()}</small>`:''}</span><input data-history-setting="${d.name}" type="${d.type==='boolean'?'checkbox':'number'}"${d.type==='integer'?` min="${d.min}" max="${d.max}" step="1"`:''}></label>`
	).join('')+'<p class="ch-setting-error" role="status"></p>';
	const error=container.querySelector('.ch-setting-error');
	const refresh=()=>{const s=preferences.get();for(const d of SETTINGS_SCHEMA){const e=container.querySelector(`[data-history-setting="${d.name}"]`);if(doc.activeElement===e)continue;if(d.type==='boolean')e.checked=s.settings[d.name];else e.value=s.settings[d.name];}if(s.valid===false)error.textContent='保存設定が不正です。既存設定は上書きしていません。';};
	const change=e=>{const name=e.target.dataset.historySetting,d=SETTINGS_SCHEMA.find(x=>x.name===name);if(!d)return;e.stopPropagation();try{const v=d.type==='boolean'?e.target.checked:e.target.value.trim()===''?NaN:Number(e.target.value);preferences.patch({[name]:v});error.textContent='';e.target.removeAttribute('aria-invalid');}catch{error.textContent='設定を保存できませんでした。入力範囲と保存領域を確認してください。';e.target.setAttribute('aria-invalid','true');}};
	container.addEventListener('change',change);const off=preferences.subscribe(refresh);refresh();
	return {dispose(){off();container.removeEventListener('change',change);container.replaceChildren();}};
}
class CommentHistoryPanel {
	constructor({controller,preferences,anchor,window:win=globalThis.window}){
		this.controller=controller;this.preferences=preferences;this.anchor=anchor;this.win=win;this.doc=win.document;this.listeners=[];this.closeTimer=null;this.swallowCleanup=[];this.disposed=false;
		style(this.doc);
		this.onOutside=e=>this._outside(e);this.onEscape=e=>{if(this.isOpen&&e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();this.close(true);}};
		this.onResize=()=>this._place();
		this.off=controller.subscribe(state=>this.refresh(state));this.offPrefs=preferences.subscribe(()=>this.refresh(controller.state));
	}
	get isOpen(){return !!this.view?.classList.contains('is-open')&&!this.view.classList.contains('is-closing');}
	_init(){
		if(this.view)return;
		const el=this.view=this.doc.createElement('section');el.className='zenzaCommentHistoryPanel zen-family';el.setAttribute('role','dialog');el.setAttribute('aria-label','コメント増量');el.setAttribute('aria-modal','false');
		el.innerHTML=`<header class="ch-header"><strong>コメント増量</strong><label class="ch-enable"><input type="checkbox" data-ch-enabled> ON</label><button type="button" data-ch-close aria-label="パネルを閉じる">×</button></header><div class="ch-counter"><span data-ch-count>0</span><small data-ch-goal> / 5,000 件</small></div><div class="ch-status" data-ch-status role="status" aria-live="polite"></div><progress value="0" max="5000" aria-label="追加取得の進捗"></progress><div class="ch-action-row"><label>追加する件数<select data-ch-quota aria-label="追加する件数">${HISTORY_PRESETS.map(n=>`<option value="${n}">${fmt(n)} 件</option>`).join('')}</select></label><button type="button" data-ch-primary>取得開始</button></div><div class="ch-action-row ch-apply-row"><label>適用する件数<select data-ch-applied-target aria-label="適用する件数">${APPLIED_PRESETS.map(n=>`<option value="${n}">${n?fmt(n)+' 件':'0 件（増量前）'}</option>`).join('')}</select></label><span class="ch-note" data-ch-apply-summary></span></div><p class="ch-note">ONは次の動画・再起動後も維持します。全タブが取得対象です。適用する件数を減らしても取得済みの分は保持し、戻すときは再取得しません。</p><details class="ch-details"><summary>取得条件と内訳</summary><div><div class="ch-counts"><span>通常コメント</span><span data-ch-normal></span><span>取得済みの追加分（保持中）</span><span data-ch-cached></span><span>適用中の追加分</span><span data-ch-applied></span><span>表示対象の合計</span><span data-ch-total></span></div><label><input type="checkbox" data-ch-easy> かんたんコメントも追加取得</label><p class="ch-note">取得中の条件は固定です。かんたんコメントの変更は、次の動画か「最初から取得」で使用します。NGはそのまま適用されます。</p><button type="button" data-ch-restart>最初から取得</button></div></details><footer class="ch-footer"><span class="ch-note" data-ch-pages></span><button type="button" data-ch-advanced>上級者設定</button></footer><div class="ch-advanced" hidden></div><div class="ch-setting-error" data-ch-error role="status"></div>`;
		const safe=fn=>{try{fn();this.view.querySelector('[data-ch-error]').textContent='';}catch{this.refresh(this.controller.state);this.view.querySelector('[data-ch-error]').textContent='設定を保存できませんでした。';}};
		el.querySelector('[data-ch-close]').onclick=()=>this.close(true);
		el.querySelector('[data-ch-enabled]').onchange=e=>safe(()=>this.controller.setEnabled(e.target.checked));
		el.querySelector('[data-ch-quota]').onchange=e=>safe(()=>this.preferences.patch({maxAdditionalComments:Number(e.target.value)}));
		el.querySelector('[data-ch-applied-target]').onchange=e=>safe(()=>{void this.controller.setAppliedCount(Number(e.target.value)).catch?.(()=>{});});
		el.querySelector('[data-ch-easy]').onchange=e=>safe(()=>this.preferences.patch({includeEasy:e.target.checked}));
		el.querySelector('[data-ch-primary]').onclick=()=>{const s=this.controller.state;if(['fetching','queued'].includes(s.phase))this.controller.stop();else if(!s.enabled)safe(()=>this.controller.setEnabled(true));else if(s.canContinue||s.phase==='render-error')void this.controller.more();else void this.controller.restart();};
		el.querySelector('[data-ch-restart]').onclick=()=>void this.controller.restart();
		el.querySelector('[data-ch-advanced]').onclick=()=>{const target=el.querySelector('.ch-advanced');target.hidden=!target.hidden;if(!target.hidden&&!this.advanced)this.advanced=mountHistorySettings(target,{preferences:this.preferences});if(!target.hidden)target.scrollIntoView({block:'nearest'});};
		for(const name of ['click','dblclick','mousedown','mouseup','pointerdown','wheel','keydown','keyup','contextmenu'])el.addEventListener(name,e=>e.stopPropagation());
	}
	refresh(state){
		const a=this.anchor?.();
		if(a){a.classList.toggle('is-active',state.enabled);a.classList.toggle('is-fetching',state.phase==='fetching');a.setAttribute('aria-expanded',String(this.isOpen));a.setAttribute('aria-label','コメント増量'+(state.enabled?'：ON':'：OFF'));}
		if(!this.view)return;
		const p=this.preferences.get(),v=this.view;const q=s=>v.querySelector(s),running=['fetching','queued','applying'].includes(state.phase);
		q('[data-ch-enabled]').checked=state.enabled;
		const quota=q('[data-ch-quota]');
		quota.querySelector('[data-ch-custom]')?.remove();
		if(!HISTORY_PRESETS.includes(p.settings.maxAdditionalComments)){
			const option=this.doc.createElement('option');option.dataset.chCustom='';
			option.value=String(p.settings.maxAdditionalComments);option.textContent=fmt(p.settings.maxAdditionalComments)+' 件';quota.append(option);
		}
		quota.value=p.settings.maxAdditionalComments;q('[data-ch-easy]').checked=p.settings.includeEasy;
		q('[data-ch-count]').textContent=fmt(state.additionalCount);q('[data-ch-goal]').textContent=` / ${fmt(state.goal||p.settings.maxAdditionalComments)} 件`;
		q('progress').max=state.goal||p.settings.maxAdditionalComments;q('progress').value=state.additionalCount||0;
		const texts={idle:state.enabled?'通常コメントの読込完了を待っています':'OFF · 通常コメントのみ表示',queued:'他のタブの取得終了を待っています',fetching:'取得中 · 追加分は未反映',applying:'取得終了 · 表示を準備しています',ready:'反映済み',partial:'一部取得 · 取得済みの正常分を反映',unavailable:'この動画・コメント形式では増量できません', 'render-error':'取得済みデータの反映に失敗しました'};
		q('[data-ch-status]').textContent=p.valid===false?'保存設定が不正です。上書きは行っていません。':texts[state.phase]||'待機中';
		if(['cursor_stalled','same_second_boundary','subsecond_boundary','same_second_boundary_unverified','subsecond_boundary_unverified'].includes(state.reason))q('[data-ch-status]').textContent+='（日時境界で停止）';
		const appliedSelect=q('[data-ch-applied-target]');appliedSelect.querySelector('[data-ch-custom]')?.remove();
		const appliedTarget=Number(state.appliedTarget)||0;
		if(!APPLIED_PRESETS.includes(appliedTarget)){
			const option=this.doc.createElement('option');option.dataset.chCustom='';option.value=String(appliedTarget);option.textContent=fmt(appliedTarget)+' 件';appliedSelect.append(option);
		}
		appliedSelect.value=String(appliedTarget);
		appliedSelect.disabled=!state.enabled||running||!state.cacheAvailable||p.valid===false;
		q('[data-ch-apply-summary]').textContent=state.cacheAvailable?`取得済み ${fmt(state.cachedAdditional)} 件 · 適用中 ${fmt(state.appliedAdditional)} 件`:'';
		if(state.cacheAvailable&&!running&&['ready','partial'].includes(state.phase)&&state.appliedAdditional<state.cachedAdditional)
			q('[data-ch-status]').textContent+=state.appliedAdditional===0?'（増量前の表示・取得済み分は保持）':'（一部を適用中・取得済み分は保持）';
		q('[data-ch-normal]').textContent=fmt(state.normalCount);q('[data-ch-cached]').textContent=fmt(state.cachedAdditional);q('[data-ch-applied]').textContent=fmt(state.appliedAdditional);q('[data-ch-total]').textContent=fmt((state.normalCount||0)+(state.appliedAdditional||0));q('[data-ch-pages]').textContent=`${fmt(state.pages)} ページ取得`;
		const button=q('[data-ch-primary]');button.textContent=state.phase==='queued'?'待機を中止':state.phase==='fetching'?'中止して反映':state.phase==='applying'?'反映準備中':state.phase==='render-error'?'反映を再試行':state.additionalCount>=20000?'上限に到達':state.canContinue?'さらに取得':state.enabled?'取得し直す':'取得開始';
		button.disabled=state.phase==='applying'||state.phase==='unavailable'||(state.additionalCount>=20000&&state.phase!=='render-error')||p.valid===false;q('[data-ch-restart]').disabled=running||!state.enabled;
	}
	_place(){
		if(!this.view)return;const host=this.doc.fullscreenElement||this.doc.webkitFullscreenElement||this.doc.body;if(this.view.parentNode!==host)host.append(this.view);
		const a=this.anchor?.()?.getBoundingClientRect(),width=Math.min(360,this.win.innerWidth-32);
		this.view.style.left=Math.max(16,Math.min(this.win.innerWidth-width-16,(a?.right||this.win.innerWidth-16)-width))+'px';
		this.view.style.bottom=Math.max(16,Math.min(this.win.innerHeight-120,a?this.win.innerHeight-a.top+10:50))+'px';
		this.view.style.maxHeight=Math.max(100,this.win.innerHeight-parseFloat(this.view.style.bottom)-16)+'px';
	}
	_listen(){
		const attach=win=>{if(this.listeners.includes(win))return;try{win.addEventListener('pointerdown',this.onOutside,true);win.addEventListener('keydown',this.onEscape,true);this.listeners.push(win);}catch{}};
		attach(this.win);for(const f of this.doc.querySelectorAll('iframe')){try{if(f.contentWindow?.document)attach(f.contentWindow);}catch{}}
	}
	_unlisten(){for(const w of this.listeners){try{w.removeEventListener('pointerdown',this.onOutside,true);w.removeEventListener('keydown',this.onEscape,true);}catch{}}this.listeners=[];this.observer?.disconnect();this.observer=null;this.win.removeEventListener('resize',this.onResize);this.doc.removeEventListener('fullscreenchange',this.onResize);}
	_outside(e){
		if(!this.isOpen)return;const path=e.composedPath?.()||[e.target],a=this.anchor?.();if(path.includes(this.view)||path.includes(a))return;
		let video=path.some(x=>x?.matches?.('video,.videoPlayer,.commentLayerFrame'));
		try{video=video||e.view?.frameElement?.matches('.commentLayerFrame,[name="commentLayerFrame"]');}catch{}
		this.close(false);
		if(video&&e.button===0){
			const target=e.target,win=e.view||this.win;
			const swallow=event=>{if(event.target===target||(event.composedPath?.()||[]).includes(target)){event.preventDefault();event.stopImmediatePropagation();}cleanup();};
			const timer=this.win.setTimeout(()=>cleanup(),600);
			const cleanup=()=>{win.removeEventListener('click',swallow,true);this.win.clearTimeout(timer);const i=this.swallowCleanup.indexOf(cleanup);if(i>=0)this.swallowCleanup.splice(i,1);};
			win.addEventListener('click',swallow,true);this.swallowCleanup.push(cleanup);
		}
	}
	open(){
		if(this.disposed)return;this._init();this.win.clearTimeout(this.closeTimer);this.view.classList.remove('is-closing','is-open');this._place();this.view.querySelector('details').open=false;this.view.querySelector('.ch-advanced').hidden=true;void this.view.offsetWidth;this.view.classList.add('is-open');this.view.setAttribute('aria-hidden','false');this._listen();this.win.addEventListener('resize',this.onResize);this.doc.addEventListener('fullscreenchange',this.onResize);if(this.win.MutationObserver){this.observer?.disconnect();this.observer=new this.win.MutationObserver(()=>this._listen());this.observer.observe(this.doc.body,{childList:true,subtree:true});}this.refresh(this.controller.state);
	}
	close(focus=false){if(!this.isOpen)return;this._unlisten();this.view.classList.add('is-closing');this.view.setAttribute('aria-hidden','true');this.win.clearTimeout(this.closeTimer);this.closeTimer=this.win.setTimeout(()=>this.view?.classList.remove('is-open','is-closing'),170);if(focus)this.anchor?.()?.focus?.();this.refresh(this.controller.state);}
	toggle(){this.isOpen?this.close(true):this.open();}
	dispose(){if(this.disposed)return;this.disposed=true;this._unlisten();this.off?.();this.offPrefs?.();this.advanced?.dispose();this.win.clearTimeout(this.closeTimer);[...this.swallowCleanup].forEach(f=>f());this.view?.remove();this.view=null;}
}
function createHistoryFeature({dialog,config,window:win=globalThis.window}){
	const preferences=createBrowserHistoryPreferences({window:win,config});
	const acquire=(run,signal)=>win.navigator.locks?.request?win.navigator.locks.request('zenza-comment-history-fetch',{mode:'exclusive',signal},async()=>{const result=await run();await new Promise(r=>win.setTimeout(r,1500));return result;}):run();
	const controller=new CommentHistoryController({preferences,acquire,
		render:(data,control)=>dialog._nicoVideoPlayer.applyHistoryThreads(data,control),
		clearRender:()=>dialog._nicoVideoPlayer?.clearCommentHistory(),
		notify:text=>dialog.execCommand('notify',text)});
	const panel=new CommentHistoryPanel({controller,preferences,window:win,anchor:()=>dialog._view?._$view?.[0]?.querySelector('.commentHistorySwitch')||win.document.querySelector('.commentHistorySwitch')});
	return {controller,preferences,panel,dispose(){panel.dispose();controller.dispose();preferences.dispose();}};
}
return Object.freeze({HISTORY_ICON,mountHistorySettings,CommentHistoryPanel,createHistoryFeature});
})();
return Object.freeze({
SETTINGS_SCHEMA: modules[1].SETTINGS_SCHEMA,
DEFAULT_SETTINGS: modules[1].DEFAULT_SETTINGS,
normalizeSettings: modules[1].normalizeSettings,
SettingsStore: modules[1].SettingsStore,
ZenzaSettingsRepository: modules[2].ZenzaSettingsRepository,
HISTORY_PRESETS: modules[3].HISTORY_PRESETS,
APPLIED_PRESETS: modules[3].APPLIED_PRESETS,
HISTORY_PREFERENCE_DEFAULTS: modules[3].HISTORY_PREFERENCE_DEFAULTS,
createBrowserHistoryPreferences: modules[3].createBrowserHistoryPreferences,
HISTORY_ICON: modules[10].HISTORY_ICON,
mountHistorySettings: modules[10].mountHistorySettings,
CommentHistoryPanel: modules[10].CommentHistoryPanel,
createHistoryFeature: modules[10].createHistoryFeature,
});
})();
/*
* Task 206: 同時表示コメント数の予算（取得件数・保持件数とは別）。
* - 上限判定は「新しく表示を開始する直前」だけに使う。表示を始めた要素は寿命まで消さない。
* - owner(fork1)・自分の投稿（投稿中/失敗を含む）は上限の対象外で、数にも入れない。
* - 優先度: 今回の通常取得 > 増量で追加した過去コメント、各グループ内は 通常 > かんたん > AI。
*   低い優先度ほど「表示中の総数がこの割合未満なら受け入れる」天井を低くし、
*   増量分やかんたん/AIが枠を埋め尽くしても、通常コメント用の枠が残るようにする。
*/
class CommentDisplayBudget {
	static get CONFIG_KEY() { return 'commentLayer.maxDisplayComment'; }
	static get CHOICES() { return [40, 100, 200, 400, 800]; }
	static get DEFAULT() { return 200; }
	static get TIER() {
		return {EXEMPT: -1, MAIN: 0, EASY: 1, AI: 2, HISTORY_MAIN: 3, HISTORY_EASY: 4, HISTORY_AI: 5};
	}
	static get TIER_NAMES() {
		return ['main', 'easy', 'ai', 'historyMain', 'historyEasy', 'historyAi'];
	}
	/* 各優先度が受け入れられる「表示中総数」の天井（上限に対する割合） */
	static get CEILING_RATIO() { return [1, 0.9, 0.85, 0.75, 0.7, 0.7]; }
	static normalizeLimit(value) {
		const n = Number(value);
		return CommentDisplayBudget.CHOICES.includes(n) ? n : CommentDisplayBudget.DEFAULT;
	}
	static isValidLimit(value) {
		return typeof value === 'number' && CommentDisplayBudget.CHOICES.includes(value);
	}
	static isExempt(chat) {
		if (!chat) { return false; }
		return Number(chat.fork) === 1 || !!chat.isMine || !!chat.isUpdating || !!chat.isPostFail;
	}
	static tierOf(chat, isHistory = false) {
		const T = CommentDisplayBudget.TIER;
		if (CommentDisplayBudget.isExempt(chat)) { return T.EXEMPT; }
		const fork = Number(chat.fork);
		const kind = fork === 2 ? T.EASY : (fork === 3 ? T.AI : T.MAIN);
		return isHistory ? kind + 3 : kind;
	}
	static ceilingOf(tier, limit) {
		if (tier < 0) { return Infinity; }
		const ratio = CommentDisplayBudget.CEILING_RATIO[tier];
		return Math.max(1, Math.floor(limit * (ratio === undefined ? 0.7 : ratio)));
	}
	static admit(candidates, {liveCount = 0, limit = CommentDisplayBudget.DEFAULT, tierOf, order, groupOf} = {}) {
		limit = CommentDisplayBudget.normalizeLimit(limit);
		const tiers = new Map();
		for (const chat of candidates) { tiers.set(chat, tierOf ? tierOf(chat) : CommentDisplayBudget.tierOf(chat)); }
		const byTime = order || ((a, b) => a.beginLeftTiming - b.beginLeftTiming);
		const sorted = candidates.slice().sort((a, b) => (tiers.get(a) - tiers.get(b)) || byTime(a, b));
		const units = [], groups = new Map();
		for (const chat of sorted) {
			const tier = tiers.get(chat);
			const key = tier < 0 || !groupOf ? null : groupOf(chat);
			let unit = key == null ? null : groups.get(key);
			if (!unit) {
				unit = {chats: [], tier}; units.push(unit);
				if (key != null) { groups.set(key, unit); }
			}
			unit.chats.push(chat);
			unit.tier = Math.max(unit.tier, tier);
		}
		units.sort((a,b) => a.tier-b.tier || byTime(a.chats[0],b.chats[0]));
		const admitted = [], suppressed = [];
		let live = liveCount;
		for (const unit of units) {
			const count = unit.chats.length, tier = unit.tier;
			if (tier < 0 || live + count <= CommentDisplayBudget.ceilingOf(tier, limit)) {
				admitted.push(...unit.chats);
				if (tier >= 0) { live += count; }
			} else {
				const reason = (count > 1 ? 'ca_group_' : '') + (live + count > limit ? 'limit' : 'reserve');
				for (const chat of unit.chats) { suppressed.push({chat, tier: tiers.get(chat), reason}); }
			}
		}
		return {admitted, suppressed, tiers};
	}
}
class RelatedMenuActions {
	static get CONFIG_KEY() { return 'relatedMenu.customLinks'; }
	static get VARIABLES() {
		return ['videoId', 'watchId', 'videoUrl', 'videoTitle',
			'uploaderUserId', 'uploaderChannelId', 'uploaderName', 'currentTime'];
	}
	static get _actions() {
		if (!this.__actions) { this.__actions = new Map(); }
		return this.__actions;
	}
	static get _listeners() {
		if (!this.__listeners) { this.__listeners = new Set(); }
		return this.__listeners;
	}
	static _notify() {
		for (const listener of this._listeners) {
			try { listener(); } catch (_) { /* one observer must not break the others */ }
		}
	}
	static onChange(listener) {
		if (typeof listener !== 'function') { throw new TypeError('listener must be a function'); }
		this._listeners.add(listener);
		return () => this._listeners.delete(listener);
	}
	static _safeId(id) {
		return typeof id === 'string' && /^[a-z0-9][a-z0-9._:-]{0,63}$/i.test(id);
	}
	static _validateUrlTemplate(template) {
		if (typeof template !== 'string' || !template.startsWith('http') ||
			template.length > 2048 || /[\r\n\t]/.test(template)) { return false; }
		const tokens = template.match(/\{[^{}]*\}/g) || [];
		if (tokens.some(token => !this.VARIABLES.includes(token.slice(1, -1)))) { return false; }
		if (/[{}]/.test(template.replace(/\{[^{}]*\}/g, ''))) { return false; }
		const sample = Object.fromEntries(this.VARIABLES.map(key => [key, 'sample']));
		return !!this.resolveUrl(template, sample).url;
	}
	static isCopy(item) { return item?.kind==='copy'; }
	static validateCopyTemplate(template) {
		if(typeof template!=='string' || !template.trim() || template.length>4096 ||
			/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(template)){return false;}
		const tokens=template.match(/\{[^{}]*\}/g)||[];
		return tokens.every(token=>this.VARIABLES.includes(token.slice(1,-1))) &&
			!/[{}]/.test(template.replace(/\{[^{}]*\}/g,''));
	}
	static resolveCopy(template,context={}) {
		if(!this.validateCopyTemplate(template)){return {text:null,missing:[],invalid:['template']};}
		const missing=[];
		const text=template.replace(/\{([^{}]+)\}/g,(_,key)=>{
			const value=context[key];
			if(value===undefined || value===null || String(value)===''){missing.push(key);return '';}
			return String(value);
		});
		return {text:missing.length || text.length>16384?null:text,missing};
	}
	static validateLinks(input) {
		const errors = [];
		if (!Array.isArray(input)) {
			return {valid: false, errors: ['Expected an array of links'], links: []};
		}
		if (input.length > 40) { errors.push('Maximum 40 links'); }
		const links = [];
		const ids = new Set();
		input.slice(0, 40).forEach((item, index) => {
			if (!item || typeof item !== 'object' || Array.isArray(item) ||
					!this._safeId(item.id) || ids.has(item.id) ||
					typeof item.label !== 'string' || !item.label.trim() ||
					item.label.length > 80 ||
					(item.kind!==undefined && !['link','copy'].includes(item.kind)) ||
					(this.isCopy(item)?!this.validateCopyTemplate(item.copyTemplate):!this._validateUrlTemplate(item.url)) ||
					(item.enabled !== undefined && typeof item.enabled !== 'boolean') ||
					(item.openInNewTab !== undefined && typeof item.openInNewTab !== 'boolean') ||
					(item.openMode !== undefined && !['default','same-tab','new-tab','new-window'].includes(item.openMode)) ||
					(item.popupWidth !== undefined && (!Number.isInteger(item.popupWidth) || item.popupWidth<250 || item.popupWidth>1800)) ||
					(item.popupHeight !== undefined && (!Number.isInteger(item.popupHeight) || item.popupHeight<250 || item.popupHeight>1800)) ||
					(item.shortcutKey !== undefined &&
						(!Number.isSafeInteger(item.shortcutKey) || item.shortcutKey < 0 ||
						item.shortcutKey >= 90000000))) {
				errors.push('Invalid custom link at index ' + index);
				return;
			}
			ids.add(item.id);
			const link = this.isCopy(item)?{
				id:item.id,label:item.label.trim(),kind:'copy',copyTemplate:item.copyTemplate,
				enabled:item.enabled!==false
			}:{
				id: item.id, label: item.label.trim(), url: item.url,
				enabled: item.enabled !== false,
				openInNewTab: item.openInNewTab !== false
			};
			if(!this.isCopy(item)){
				if(item.openMode && item.openMode!=='default'){link.openMode=item.openMode;}
				if(item.popupWidth!==undefined){link.popupWidth=item.popupWidth;}
				if(item.popupHeight!==undefined){link.popupHeight=item.popupHeight;}
			}
			if (item.shortcutKey > 0) { link.shortcutKey = item.shortcutKey; }
			links.push(link);
		});
		return {valid: errors.length === 0, errors, links};
	}
	static getLinks(input) { return this.validateLinks(input).links; }
	static openShortcutsByIds(input, ids, context, opener, copier) {
		if (!Array.isArray(ids) || typeof opener !== 'function') { return 0; }
		const selected = new Set(ids);
		const items=this.getLinks(input).filter(item=>item.enabled && selected.has(item.id));
		const copies=items.filter(item=>this.isCopy(item))
			.map(item=>this.resolveCopy(item.copyTemplate,context).text).filter(text=>text!==null);
		let copyCount=0;
		if(copies.length && typeof copier==='function'){
			try{
				const result=copier(copies.join('\n'));
				if(result && typeof result.catch==='function'){result.catch(()=>{});}
				copyCount=copies.length;
			}catch(_){ /* A denied clipboard must not prevent independent links. */ }
		}
		const resolved = items.filter(item=>!this.isCopy(item))
			.map(item => ({item, value: this.resolveUrl(item.url, context)}))
			.filter(entry => !!entry.value.url);
		let currentTabIndex = -1;
		resolved.forEach((entry, i) => {
			if (entry.item.openMode==='same-tab' ||
				(!entry.item.openMode && !entry.item.openInNewTab)) { currentTabIndex = i; }
		});
		const safeOpen = (url, target, item) => {
			const popup=item?.openMode==='new-window' ?
				'noopener,noreferrer,width='+(item.popupWidth||760)+',height='+(item.popupHeight||650) : undefined;
			try { opener(url,target,popup); } catch (_) { /* one failed tab must not block others */ }
		};
		resolved.forEach((entry, i) => {
			if (i !== currentTabIndex) { safeOpen(entry.value.url, '_blank',entry.item); }
		});
		if (currentTabIndex >= 0) {
			safeOpen(resolved[currentTabIndex].value.url, '_self',resolved[currentTabIndex].item);
		}
		return resolved.length+copyCount;
	}
	static makeContext(videoInfo, currentTime = 0) {
		if (!videoInfo || typeof videoInfo !== 'object') { return Object.freeze({}); }
		let owner;
		try { owner = videoInfo.owner || {}; } catch (_) { owner = {}; }
		const validVideoId = value => {
			const text = value == null ? '' : String(value);
			return /^(?:sm|nm|so|ss)?[0-9]+$/.test(text) ? text : '';
		};
		const videoId = validVideoId(videoInfo.videoId);
		const watchId = validVideoId(videoInfo.watchId);
		const user = owner.type === 'user';
		const channel = owner.type === 'channel';
		const id = (typeof owner.id === 'number' || typeof owner.id === 'string') &&
			String(owner.id).trim() && String(owner.id) !== '0' ?
				String(owner.id).trim() : '';
		const sec = Number(currentTime);
		return Object.freeze({
			videoId, watchId,
			videoUrl: watchId ? 'https://www.nicovideo.jp/watch/' + watchId : '',
			videoTitle: typeof videoInfo.title === 'string' ? videoInfo.title : '',
			uploaderUserId: user ? id : '',
			uploaderChannelId: channel ? id : '',
			uploaderName: user || channel ? (typeof owner.name === 'string' ? owner.name : '') : '',
			currentTime: Number.isFinite(sec) && sec >= 0 ? String(Math.floor(sec)) : '0'
		});
	}
	static resolveUrl(template, context = {}) {
		if (typeof template !== 'string') { return {url: null, missing: []}; }
		const missing = [];
		const invalid = [];
		const expanded = template.replace(/\{([^{}]+)\}/g, (_, name) => {
			if (!this.VARIABLES.includes(name)) {
				invalid.push(name);
				return '';
			}
			const value = context[name];
			if (value === undefined || value === null || String(value) === '') {
				missing.push(name);
				return '';
			}
			return encodeURIComponent(String(value));
		});
		if (invalid.length || missing.length || /[{}]/.test(expanded)) {
			return {url: null, missing, invalid};
		}
		try {
			const url = new URL(expanded);
			if (!['https:', 'http:'].includes(url.protocol) || !url.hostname ||
					url.username || url.password || url.href.length > 4096) {
				return {url: null, missing, invalid: ['unsafe URL']};
			}
			return {url: url.href, missing: [], invalid: []};
		} catch (_) {
			return {url: null, missing, invalid: ['invalid URL']};
		}
	}
	static register({id, label, action, available} = {}) {
		if (!this._safeId(id) || typeof label !== 'string' ||
				!label.trim() || label.length > 80 || typeof action !== 'function' ||
				(available !== undefined && typeof available !== 'function')) {
			throw new TypeError('Invalid related-menu action registration');
		}
		if (this._actions.has(id)) { throw new Error('Action already registered: ' + id); }
		const entry = Object.freeze({id, label: label.trim(), action, available});
		this._actions.set(id, entry);
		this._notify();
		return () => {
			if (this._actions.get(id) === entry) { this.unregister(id); }
		};
	}
	static unregister(id) {
		const removed = this._actions.delete(id);
		if (removed) { this._notify(); }
		return removed;
	}
	static getActions(context) {
		return [...this._actions.values()].map(item => {
			let enabled = true;
			if (item.available) {
				try { enabled = !!item.available(context); } catch (_) { enabled = false; }
			}
			return {id: item.id, label: item.label, enabled};
		});
	}
	static invoke(id, context) {
		const entry = this._actions.get(id);
		if (!entry || !this.getActions(context).some(item => item.id === id && item.enabled)) {
			return false;
		}
		try {
			const result = entry.action(context);
			if (result && typeof result.catch === 'function') {
				result.catch(() => console.warn('Related-menu custom action failed:', id));
			}
			return true;
		} catch (_) {
			console.warn('Related-menu custom action failed:', id);
			return false;
		}
	}
}
class RelatedMenuOrder {
	static get CONFIG_KEY() { return 'relatedMenu.order'; }
	static get HIDDEN_KEY() { return 'relatedMenu.hiddenItems'; }
	static get OPTIONS_KEY() { return 'relatedMenu.builtinOptions'; }
	static get SHORTCUT_ACTION_IDS() {
		return Object.freeze({
			official:'OPEN_GINZA',ad:'OPEN_NICOAD',twitter:'OPEN_TWITTER_HASH',
			original:'OPEN_ORIGINAL_VIDEO',tree:'OPEN_PARENT_VIDEO',
			'tree-playlist':'PLAYLIST_SET_COMMONS_TREE','copy-url':'COPY_WATCH_URL'
		});
	}
	static get OPEN_MODES() { return ['default','same-tab','new-tab','new-window']; }
	static get COPY_FORMATS() { return ['url','id','position','title-url','markdown']; }
	static formatCopy(format,context={}) {
		const id=String(context.videoId||context.watchId||'');
		const watchId=String(context.watchId||id);
		const url=String(context.videoUrl||(watchId?'https://www.nicovideo.jp/watch/'+watchId:''));
		const title=String(context.videoTitle||'').trim();
		if(format==='id'){return id;}
		if(format==='position'){
			const seconds=Number(context.currentTime);
			if(!url || !Number.isFinite(seconds) || seconds<=0){return url;}
			const separator=url.includes('?')?'&':'?';
			return url+separator+'from='+Math.floor(seconds);
		}
		if(format==='title-url'){return title?title+'\n'+url:url;}
		if(format==='markdown'){
			const safeTitle=(title||id).replace(/[\[\]\\]/g,'\\$&');
			return '['+safeTitle+']('+url+')';
		}
		return url;
	}
	static openUrl(id,url,option={},opener) {
		if(!url || typeof opener!=='function'){return;}
		const mode=option.openMode||'default';
		if(mode==='same-tab'){return opener(url,'_self');}
		if(mode==='new-tab'){return opener(url,'_blank','noopener,noreferrer');}
		if(mode==='new-window'){
			const dimension=(key,fallback)=>Number.isInteger(option[key]) &&
				option[key]>=250 && option[key]<=1800?option[key]:fallback;
			const width=dimension('popupWidth',id==='ad'?428:760);
			const height=dimension('popupHeight',id==='ad'?600:650);
			return opener(url,'_blank','noopener,noreferrer,width='+width+
				',height='+height+',scrollbars=yes');
		}
		if(id==='ad'){return opener(url,'','width=428, height=600, toolbar=no, scrollbars=1');}
		if(id==='official'){return opener(url,'_blank','noopener');}
		return opener(url);
	}
	static getOption(options,id) {
		return options && typeof options==='object' && !Array.isArray(options) &&
			options[id] && typeof options[id]==='object' && !Array.isArray(options[id]) ?
			options[id] : {};
	}
	static validateOptions(value) {
		if (!value || typeof value!=='object' || Array.isArray(value)) {return false;}
		const allowedIds=new Set(this.STANDARD.map(item=>item.id));
		const allowedFields=new Set(['label','openMode','popupWidth','popupHeight',
			'copyFormat','urlTemplate','includePosition']);
		for(const [id,option] of Object.entries(value)){
			if(!allowedIds.has(id) || !option || typeof option!=='object' || Array.isArray(option) ||
				Object.keys(option).some(k=>!allowedFields.has(k))){return false;}
			if(option.label!==undefined && (typeof option.label!=='string' ||
				!option.label.trim() || option.label.trim().length>80)){return false;}
			if(option.openMode!==undefined && !this.OPEN_MODES.includes(option.openMode)){return false;}
			for(const size of ['popupWidth','popupHeight']){
				if(option[size]!==undefined && (!Number.isInteger(option[size]) ||
					option[size]<250 || option[size]>1800)){return false;}
			}
			if(option.includePosition!==undefined && typeof option.includePosition!=='boolean'){return false;}
			if(option.copyFormat!==undefined && (id!=='copy-url' ||
				!this.COPY_FORMATS.includes(option.copyFormat))){return false;}
			if(option.urlTemplate!==undefined){
				if(!['twitter','tree'].includes(id) || typeof option.urlTemplate!=='string' ||
					option.urlTemplate.length>2048){return false;}
				if(option.urlTemplate){
					if(!/^https:\/\//i.test(option.urlTemplate) || /[\r\n\t]/.test(option.urlTemplate)){return false;}
					const vars=new Set(['videoId','watchId','videoUrl','videoTitle',
						'uploaderUserId','uploaderChannelId','uploaderName','currentTime']);
					const tokens=option.urlTemplate.match(/\{([^{}]*)\}/g)||[];
					if(tokens.some(token=>!vars.has(token.slice(1,-1))) ||
						/[{}]/.test(option.urlTemplate.replace(/\{[^{}]*\}/g,''))){return false;}
					try{
						const sample=option.urlTemplate.replace(/\{[^{}]*\}/g,'sample');
						const url=new URL(sample);
						if(url.protocol!=='https:' || !url.hostname || url.username || url.password){return false;}
					}catch(_){return false;}
				}
			}
		}
		return true;
	}
	static get STANDARD() {
		return [
			{id:'official',label:'公式プレイヤーで開く'},
			{id:'ad',label:'ニコニ広告で宣伝'},
			{id:'twitter',label:'X（Twitter）の反応を見る'},
			{id:'original',label:'元動画を開く'},
			{id:'tree',label:'親作品・コンテンツツリー'},
			{id:'tree-playlist',label:'親作品・子作品をプレイリストに追加'},
			{id:'copy-url',label:'動画URLをコピー'}
		];
	}
	static isValidKey(key) {
		if (typeof key !== 'string' || key.length > 96) { return false; }
		if (key.startsWith('builtin:')) {
			return this.STANDARD.some(item=>key==='builtin:'+item.id);
		}
		return /^(?:link|action):[a-z0-9][a-z0-9._:-]{0,63}$/i.test(key);
	}
	static validateOrder(value) {
		return Array.isArray(value) && value.length<=256 &&
			value.every(key=>this.isValidKey(key)) &&
			new Set(value).size===value.length;
	}
	static validateHiddenItems(value) { return this.validateOrder(value); }
	static isHidden(key, hiddenItems) {
		return this.validateHiddenItems(hiddenItems) && hiddenItems.includes(key);
	}
	static entries(links=[], actions=[], savedOrder=[]) {
		const items=this.STANDARD.map(item=>({
			key:'builtin:'+item.id,label:item.label,type:'builtin',present:true
		}));
		for (const link of Array.isArray(links)?links:[]) {
			if (!link || !this.isValidKey('link:'+link.id)) { continue; }
			if (items.some(item=>item.key==='link:'+link.id)) { continue; }
			items.push({key:'link:'+link.id,label:String(link.label||link.id||'無題'),
				type:'link',present:true,enabled:link.enabled!==false});
		}
		for (const action of Array.isArray(actions)?actions:[]) {
			if (!action || !this.isValidKey('action:'+action.id)) { continue; }
			if (items.some(item=>item.key==='action:'+action.id)) { continue; }
			items.push({key:'action:'+action.id,label:String(action.label||action.id),
				type:'action',present:true});
		}
		const ordered=this.validateOrder(savedOrder)?savedOrder:[];
		const known=new Map(items.map(item=>[item.key,item]));
		const missing=ordered.filter(key=>!known.has(key)).map(key=>({
			key,label:key.startsWith('action:')?'未登録アクション: '+key.slice(7):
				'存在しないリンク: '+key.slice(5),
			type:key.startsWith('action:')?'action':'link',present:false
		}));
		const all=new Map(items.concat(missing).map(item=>[item.key,item]));
		const keys=[...ordered,...items.map(item=>item.key)].filter((key,index,array)=>
			array.indexOf(key)===index && all.has(key));
		return keys.map(key=>all.get(key));
	}
	static orderedKeys(savedOrder, actualKeys) {
		const all=[...new Set(actualKeys.filter(key=>this.isValidKey(key)))];
		const present=new Set(all);
		const order=this.validateOrder(savedOrder)?savedOrder:[];
		return [...order.filter(key=>present.has(key)),
			...all.filter(key=>!order.includes(key))];
	}
}
class ScreenshotFileName {
	static get DEFAULT_TEMPLATE() { return '{title} - {watchId}@{time}{suffix}'; }
	static get TOKENS() {
		return ['title','watchId','videoId','uploader','time','date','datetime','suffix'];
	}
	static get PRESETS() {
		return [
			{name:'従来どおり（標準）',value:''},
			{name:'動画IDと再生位置',value:'{watchId}_{time}{suffix}'},
			{name:'日付・動画タイトル',value:'{date}_{title}_{watchId}@{time}{suffix}'},
			{name:'タイトル・再生位置',value:'{title}_{time}{suffix}'},
			{name:'投稿者・動画ID',value:'{uploader}_{watchId}@{time}{suffix}'}
		];
	}
	static validateTemplate(value) {
		if(typeof value!=='string'||value.length>200){return false;}
		if(value===''){return true;}
		const tokens=value.match(/\{[^{}]*\}/g)||[];
		if(tokens.some(token=>!this.TOKENS.includes(token.slice(1,-1)))){return false;}
		const plain=value.replace(/\{[^{}]*\}/g,'');
		return !/[{}<>:"/\\|?*\x00-\x1f]/.test(plain) &&
			!/\.\./.test(plain) && !!value.trim();
	}
	static _safe(value) {
		return String(value??'').replace(/[<>:"/\\|?*\x00-\x1f]/g,'_')
			.replace(/[. ]+$/g,'').trim();
	}
	static format({prefix='',template='',title='',watchId='',videoId='',
		uploader='',currentTime=0,suffix='',now=new Date(),formatTime}={}) {
		const date=now && typeof now.getTime==='function' &&
			!Number.isNaN(now.getTime())?new Date(now.getTime()):new Date();
		const pad=n=>String(n).padStart(2,'0');
		const day=[date.getFullYear(),pad(date.getMonth()+1),pad(date.getDate())].join('-');
		const dateTime=day+'_'+[pad(date.getHours()),pad(date.getMinutes()),
			pad(date.getSeconds())].join('-');
		const time=typeof formatTime==='function'?
			String(formatTime(currentTime)||'0_00').replace(/:/g,'_'):
			String(Math.floor(Math.max(0,Number(currentTime)||0)));
		const values={title:this._safe(title),watchId:this._safe(watchId),
			videoId:this._safe(videoId||watchId),uploader:this._safe(uploader)||'投稿者不明',
			time:this._safe(time),date:day,datetime:dateTime,suffix:this._safe(suffix)};
		const resolvedTemplate=this.validateTemplate(template)&&template?
			template:this.DEFAULT_TEMPLATE;
		const expand=input=>String(input).replace(/\{([^{}]+)\}/g,(match,key)=>
			this.TOKENS.includes(key)?values[key]:match);
		let base=expand(resolvedTemplate);
		base=base.replace(/\.png$/i,'');
		if(suffix && !resolvedTemplate.includes('{suffix}')){base+=values.suffix;}
		const expandedPrefix=expand(prefix);
		const raw=this._safe(expandedPrefix+base)||this._safe(values.watchId+'@'+values.time);
		const bounded=raw.slice(0,176).replace(/[. ]+$/g,'')||'screenshot';
		const safeName=/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(bounded)?
			'_'+bounded:bounded;
		return safeName+'.png';
	}
}
class SceneSearchPreferences {
		static validLayout(value) {
				return value === 'follow' || value === 'fixed' || value === 'legacy';
		}
		static resolve(read, hasSaved) {
				const migration = [];
				const layout = (mode) => {
						const key = 'sceneSearch.presentation.' + mode, value = read(key);
						if (hasSaved(key) && this.validLayout(value))
								return value;
						const oldKey = 'sceneSearch.layout.' + mode, old = read(oldKey);
						if (!hasSaved(oldKey) || typeof old !== 'string' || !/^(00|0[1-9]|10)$/.test(old))
								return 'follow';
						const result = old === '00' ? 'legacy' : old === '01' || old === '06' ? 'follow' : 'fixed';
						migration.push({ key, oldValue: old, newValue: result });
						return result;
				};
				const enabled = hasSaved('sceneSearch.enabled') ? read('sceneSearch.enabled') !== false :
						read('sceneSearch.enabled') !== false && read('ui.scene.panel') !== false;
				const master = enabled && read('sceneSearch.commentPreviewVisible') !== false;
				const oldMini = read('sceneSearch.miniCommentMode');
				const miniVisible = hasSaved('sceneSearch.miniCommentVisible') ?
						read('sceneSearch.miniCommentVisible') !== false : oldMini !== 'hidden';
				const listVisible = read('sceneSearch.commentListVisible') !== false;
				const bounded = (key, min, max, fallback) => {
						const value = read(key);
						return typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max ? value : fallback;
				};
				return { enabled, listScale: bounded('sceneSearch.commentListScale', 100, 200, 100), normal: layout('normal'), fullscreen: layout('fullscreen'),
						linked: read('sceneSearch.layout.linkFullscreen') === true,
						miniStyle: oldMini === 'static' ? 'static' : 'flow', miniVisible, listVisible,
						miniEnabled: master && miniVisible, listAllowed: master && listVisible,
						listOpen: master && listVisible && read('enableCommentPreview') === true,
						opacity: bounded('sceneSearch.commentListBackgroundOpacity', 0, 100, 90),
						scale: bounded('sceneSearch.thumbnailScale', 50, 200, 100), migration };
		}
}
class UiVisibilityRegistry {
		static get SHARED_SETTINGS() {
				return [
						['showComment', 'comments-video'], ['enableCommentPanel', 'comments-list'],
						['enableCommentPreview', 'comments-preview'], ['enableHeatMap', 'comment-heatmap'],
						['enableStoryboard', 'seek-thumbnail'], ['enableStoryboardBar', 'scene-filmstrip'],
						['enableAdDecoration', 'ad-crown'],
						['sceneSearch.enabled', 'seek-thumbnail'], ['sceneSearch.commentPreviewVisible', 'comments-preview'],
						['sceneSearch.miniCommentVisible', 'comments-video'], ['sceneSearch.commentListVisible', 'comments-list']
				];
		}
		static get ITEMS() {
				if (this.__items) {
						return this.__items;
				}
				return this.__items = Object.freeze([
						{ key: 'ui.hover.like', scope: 'hover', label: 'いいねボタン', icon: '♡', selector: '.toggleLikeButton' },
						{ key: 'ui.hover.tweet', scope: 'hover', label: 'ツイート（X共有）ボタン', icon: 't', selector: '.zenzaTweetButton' },
						{ key: 'ui.hover.mylist', scope: 'hover', label: 'マイリスト登録', icon: 'My', selector: '.mylistButton.mylistAddMenu' },
						{ key: 'ui.hover.watchLater', scope: 'hover', label: 'あとで見る', icon: '✚', selector: '.mylistButton.deflistAdd' },
						{ key: 'ui.hover.comments', scope: 'hover', label: 'コメント表示切替', icon: '💬', selector: '.showCommentSwitch' },
						{ key: 'ui.hover.ngFilter', scope: 'hover', label: 'NGフィルター切替', icon: 'shield-ng', selector: '.ngFilterSwitch' },
						{ key: 'ui.relatedMenu', scope: 'related', label: '関連メニュー', icon: 'related-menu', selector: '.RelatedInfoMenu',
								description: '動画上部と動画情報パネルの2か所を一括で切り替えます。登録したリンクは削除しません。' },
						{ key: 'ui.commentInput', scope: 'comment', label: 'コメント入力欄', icon: 'comment-input', selector: '.commentInputPanel',
								description: 'コメント入力・コマンド・送信ボタンをまとめて隠します。コメント表示とショートカットはそのままです。' },
						{ key: 'ui.bar.previous', scope: 'bar', label: '前の動画ボタン', icon: '⇤', selector: '.prevVideo' },
						{ key: 'ui.bar.next', scope: 'bar', label: '次の動画ボタン', icon: '⇥', selector: '.nextVideo' },
						{ key: 'ui.bar.storyboard', scope: 'bar', label: 'シーンサーチの切替ボタン', icon: '▤', selector: '.toggleStoryboard' },
						{ key: 'ui.bar.loop', scope: 'bar', label: 'ループボタン', icon: '↻', selector: '.loopSwitch' },
						{ key: 'ui.bar.seekTop', scope: 'bar', label: '動画の先頭へ戻るボタン', icon: '⇤', selector: '.seekTop' },
						{ key: 'ui.bar.speed', scope: 'bar', label: '再生速度メニュー', icon: '1.0×', selector: '.playbackRateMenu' },
						{ key: 'ui.bar.time', scope: 'bar', label: '再生時間の表示', icon: '1:23', selector: '.videoTime' },
						{ key: 'ui.bar.mute', scope: 'bar', label: 'ミュートボタン', icon: '🔊', selector: '.muteSwitch' },
						{ key: 'ui.bar.volume', scope: 'bar', label: '音量スライダー', icon: '━●', selector: '.volumeControl' },
						{ key: 'ui.bar.history', scope: 'bar', label: 'コメント増量ボタン', icon: '▤', selector: '.commentHistorySwitch' },
						{ key: 'ui.bar.notificationHistory', scope: 'bar', label: '通知・エラー履歴を開くボタン', icon: '🔔', selector: '.notificationHistorySwitch',
								description: 'プレイヤー左下のhls横にある通知履歴ボタンを表示・非表示にします。履歴データは消去せず、設定したショートカットは引き続き使えます。' },
						{ key: 'ui.bar.filter', scope: 'bar', label: '画面フィルターボタン', icon: 'filter-sparkle', selector: '.screenFilterSwitch' },
						{ key: 'ui.bar.quality', scope: 'bar', label: '画質・動画サーバー選択', icon: '画', selector: '.videoServerTypeMenu' },
						{ key: 'ui.bar.screenMode', scope: 'bar', label: '画面サイズ・モード選択', icon: '⛶', selector: '.screenModeMenu' },
						{ key: 'ui.bar.pin', scope: 'bar', label: '操作バーの表示モード選択', icon: '📌', selector: '.fullscreenControlBarModeMenu' },
						{ key: 'ui.bar.fullscreen', scope: 'bar', label: 'フルスクリーン切替ボタン', icon: '⛶', selector: '.fullscreenSwitch',
								description: '画面の切替ボタンを隠します。通常のFキーで全画面を切り替えられます。上級者設定のこの画面から再表示できます。' },
						{ key: 'ui.bar.settings', scope: 'bar', label: 'プレイヤー設定（歯車）ボタン', icon: '⚙', selector: '.settingPanelSwitch',
								description: 'プレイヤー内の歯車を隠します。再表示するにはニコニコのマイページ（/my）のZenzaWatch上級者設定から戻してください。' },
						{ key: 'ui.scene.panel', scope: 'scene', hidden: true, label: 'シーンサーチのプレビュー枠',
								icon: '▣', selector: '.zenzaSceneSearchHost' },
						{ key: 'ui.scene.pin', scope: 'scene', hidden: true, label: 'シーンサーチのピン固定ボタン',
								icon: '📌', selector: '.zenzaSceneSearchPin, .zenzaSceneSearchHost [data-scui-action="pin"]' },
						{ key: 'ui.scene.seekArrows', scope: 'scene', label: 'シーンサーチの前後矢印',
								icon: '↔', selector: '.zenzaSceneSeekStepControl [data-scui="back"], .zenzaSceneSeekStepControl [data-scui="forward"], .zenzaSceneSearchHost [data-scui-action="seek-back"], .zenzaSceneSearchHost [data-scui-action="seek-forward"]' },
						{ key: 'ui.scene.seekSeconds', scope: 'scene', hidden: true, label: 'シーンサーチの移動秒数ボタン',
								icon: '5s', selector: '.zenzaSceneSeekStepControl [data-scui="open"], .zenzaSceneSearchHost [data-scui-action="seek-step"]' },
						{ key: 'ui.scene.commentToggle', scope: 'scene', label: 'シーンサーチのコメント表示切替ボタン',
								icon: '💬', selector: '.zenzaSceneCommentToggle, .zenzaSceneSearchHost [data-scui-action="comment-toggle"]' },
						{ key: 'ui.scene.commentSearch', scope: 'scene', label: 'シーンサーチのコメント検索ボタン',
								icon: '⌕', selector: '.zenzaSceneCommentSearchToggle, .zenzaSceneSearchHost [data-scui-action="comment-search"]' },
						{ key: 'ui.scene.more', scope: 'scene', hidden: true, label: 'シーンサーチの操作メニュー展開ボタン',
								icon: '⋯', selector: '.zenzaSceneSearchMore, .zenzaSceneSearchHost [data-scui-action="more"]' },
						{ key: 'ui.info.owner', scope: 'info', label: '投稿者情報', icon: '👤', selector: '.videoOwnerInfoContainer' },
						{ key: 'ui.info.description', scope: 'info', label: '動画説明文', icon: '≡', selector: '.videoDescription' },
						{ key: 'ui.info.series', scope: 'info', label: 'シリーズ情報', icon: '▤', selector: '.seriesList' },
						{ key: 'ui.info.tags', scope: 'info', label: '動画情報のタグ一覧', icon: '#', selector: '.videoTagsContainer.sideTab' },
						{ key: 'ui.info.credits', scope: 'info', label: 'ニコニ広告関連情報', icon: '広告', selector: '.uaaContainer' },
						{ key: 'ui.info.likeThanks', scope: 'info', label: 'いいねのお礼メッセージ', icon: '♥', selector: '.likeMessageContainer' },
						{ key: 'ui.info.metadata', scope: 'info', label: '動画の再生数などの情報', icon: 'ℹ', selector: '.videoMetaInfoContainer' },
						{ key: 'ui.info.relatedTab', scope: 'info', label: '関連動画タブ', icon: '▶', selector: '.tabSelect.relatedVideoTab, .tabs.relatedVideoTab',
								description: '関連動画タブを隠した場合、開いていた内容は動画情報タブへ戻ります。' },
						{ key: 'ui.header.title', scope: 'header', label: '動画タイトル（上部）', icon: 'T', selector: '.videoTitleContainer' },
						{ key: 'ui.header.tags', scope: 'header', label: '上部のタグ一覧', icon: '#', selector: '.videoTagsContainer.videoHeader' },
						{ key: 'ui.header.metadata', scope: 'header', label: '上部の動画情報', icon: 'ℹ', selector: '.videoMetaInfoContainer' },
						{ key: 'ui.header.series', scope: 'header', label: '上部のシリーズ画像', icon: '▧', selector: '.series-thumbnail-cover' },
						{ key: 'ui.header.search', scope: 'header', label: '動画検索ウィンドウ', icon: '⌕', selector: '.zenzaVideoSearchPanel',
								description: '上部の動画検索欄・候補一覧を隠します。検索文字は削除されません。ニコニコのマイページ（/my）の上級者設定から再表示できます。' }
				].map(item => Object.freeze(item)));
		}
		static get _byKey() {
				if (!this.__byKey) {
						this.__byKey = new Map(this.ITEMS.map(item => [item.key, item]));
				}
				return this.__byKey;
		}
		static get(key) { return this._byKey.get(key) || null; }
		static list(scope) { return this.ITEMS.filter(item => item.scope === scope); }
		static defaults() { return Object.fromEntries(this.ITEMS.map(item => [item.key, true])); }
		static isVisibilityKey(key) { return !!this.get(key); }
		static descriptors() {
				return this.ITEMS.map(item => ({
						id: item.key, label: item.label + 'を表示', category: '画面・映像',
						subcategory: '表示・非表示', type: 'boolean',
						icon: item.icon, visibilityScope: item.scope, hidden: item.hidden === true,
						description: item.description || '画面上の表示のみ切り替えます。機能・操作コマンド自体は削除しません。'
				}));
		}
		static get _savedDisplay() {
				if (!this.__savedDisplay) {
						this.__savedDisplay = new WeakMap();
				}
				return this.__savedDisplay;
		}
		static apply(config, root, key, { beforeHide, afterApply } = {}) {
				const entry = this.get(key);
				if (!entry || !root || !config) {
						return 0;
				}
				if (key === 'ui.scene.panel' && root.matches?.('.zenzaSceneSharedPreview'))
						return 0;
				const read = (k) => typeof config.getValue === 'function' ? config.getValue(k) : config.props?.[k];
				const sceneEnabled = entry.scope !== 'scene' || (config.resolveSceneSearch?.()?.enabled ?? read('sceneSearch.enabled') !== false);
				const visible = (entry.scope !== 'scene' || sceneEnabled) &&
						(key === 'ui.scene.panel' && (typeof config.resolveSceneSearch === 'function' || read('sceneSearch.enabled') !== undefined) ? sceneEnabled : read(key) !== false);
				const nodes = [];
				if (root.matches?.(entry.selector)) {
						nodes.push(root);
				}
				root.querySelectorAll?.(entry.selector).forEach(node => nodes.push(node));
				let changed = 0;
				for (const node of nodes) {
						const saved = this._savedDisplay.get(node);
						if (!visible && !saved) {
								beforeHide?.(entry, node);
								this._savedDisplay.set(node, {
										value: node.style.getPropertyValue('display'),
										priority: node.style.getPropertyPriority('display'),
										hidden: node.hidden
								});
								node.hidden = true;
								node.style.setProperty('display', 'none', 'important');
								changed++;
						}
						else if (!visible && saved && (node.hidden !== true ||
								node.style.getPropertyValue('display') !== 'none' ||
								node.style.getPropertyPriority('display') !== 'important')) {
								node.hidden = true;
								node.style.setProperty('display', 'none', 'important');
								changed++;
						}
						else if (visible && saved) {
								if (saved.value) {
										node.style.setProperty('display', saved.value, saved.priority);
								}
								else {
										node.style.removeProperty('display');
								}
								node.hidden = saved.hidden;
								this._savedDisplay.delete(node);
								changed++;
						}
				}
				if (changed) {
						afterApply?.(entry, visible);
				}
				return changed;
		}
		static connectShortcutTooltips(config, root, scope) {
				if (scope !== 'hover' && scope !== 'bar') {
						return () => { };
				}
				const actions = typeof SHORTCUT_ACTIONS !== 'undefined' ? SHORTCUT_ACTIONS : [];
				const format = typeof formatKeyCombo === 'function' ? formatKeyCombo : () => '';
				const selector = scope === 'hover' ? '.menuButton[data-command]' : '.controlButton[data-command]';
				const aliases = {
						'toggle-showComment': 'TOGGLE_COMMENT',
						'toggle-enableFilter': 'TOGGLE_NG_FILTER',
						'toggle-like': 'TOGGLE_LIKE',
						'deflistAdd': 'DEFLIST_ADD',
						'toggle-fullscreen': 'FULLSCREEN',
						'fullscreen': 'FULLSCREEN', // Actual toolbar command, not toggle-fullscreen.
						'toggle-mute': 'MUTE',
						'toggleStoryboard': 'TOGGLE_STORYBOARD_BAR',
						'seek': 'HOME', // Toolbar seek-to-beginning only (data-param=0).
						'togglePlay': 'TOGGLE_PLAY'
				};
				const bindings = [], multiHints = [], keys = new Set();
				root.querySelectorAll(selector).forEach(button => {
						const tooltip = button.querySelector('.tooltip');
						if (!tooltip) {
								return;
						}
						const command = button.dataset.command || '';
						if (command === 'seek' && button.dataset.param !== '0') {
								return;
						}
						const exact = actions.filter(a => a.command === command);
						const assigned = aliases[command] ?
								actions.filter(a => a.id === aliases[command]) : exact;
						if (!assigned.length) {
								return;
						}
						const base = (tooltip.textContent || '').replace(/\([MFVT]\)\s*$/, '').trim();
						bindings.push({ tooltip, base, actions: assigned });
						for (const a of assigned) {
								keys.add('KEY_' + a.id);
						}
				});
				if (scope === 'bar') {
						const groups = {
								volume: { label: '音量調整', entries: [{ id: 'VOL_UP', verb: '上げる' }, { id: 'VOL_DOWN', verb: '下げる' }] },
								speed: { label: '再生速度', entries: [{ id: 'SHIFT_UP', verb: '上げる' }, { id: 'SHIFT_DOWN', verb: '下げる' }] }
						};
						root.querySelectorAll('[data-shortcut-hint]').forEach(control => {
								const group = groups[control.dataset.shortcutHint || ''];
								const tooltip = control.querySelector('.tooltip');
								if (!group || !tooltip) {
										return;
								}
								multiHints.push({ tooltip, ...group });
								for (const entry of group.entries) {
										keys.add('KEY_' + entry.id);
								}
						});
				}
				const hintFor = (id) => {
						const value = Number(config.getValue?.('KEY_' + id) ?? config.props?.['KEY_' + id] ?? 0);
						if (!Number.isSafeInteger(value) || value <= 0 || value >= 90000000) {
								return '';
						}
						const hint = format(value);
						return hint && !hint.startsWith('(') ? hint : '';
				};
				const update = () => {
						for (const item of bindings) {
								const hint = item.actions.map(a => hintFor(a.id)).find(Boolean) || '';
								item.tooltip.textContent = item.base + (hint ? '（' + hint + '）' : '');
						}
						for (const group of multiHints) {
								const parts = group.entries.map(({ id, verb }) => {
										const shortcut = hintFor(id);
										return shortcut ? verb + ': ' + shortcut : '';
								}).filter(Boolean);
								group.tooltip.textContent = group.label + (parts.length ? '（' + parts.join(' / ') + '）' : '');
						}
				};
				for (const key of keys) {
						config.onkey?.(key, update);
				}
				if (scope === 'hover' && bindings.length) {
						const doc = root.ownerDocument;
						if (!doc.getElementById('zenzaHoverTooltipOpaque')) {
								const style = doc.createElement('style');
								style.id = 'zenzaHoverTooltipOpaque';
								style.textContent =
										'.hoverMenuContainer .menuButton:hover{opacity:1!important;}' +
												'.hoverMenuContainer .menuButton:hover .tooltip{' +
												'opacity:1!important;background:#fffbd2;color:#111;}';
								(doc.head || doc.documentElement).appendChild(style);
						}
				}
				update();
				return () => { for (const key of keys) {
						config.offkey?.(key, update);
				} };
		}
		static connect(config, root, scope, callbacks = {}) {
				const items = this.list(scope);
				const disposeTooltips = this.connectShortcutTooltips(config, root, scope);
				const api = {
						refresh: () => items.forEach(item => this.apply(config, root, item.key, callbacks)),
						apply: (key) => {
								if (items.some(item => item.key === key)) {
										return this.apply(config, root, key, callbacks);
								}
								return 0;
						}
				};
				const subscriptions = [];
				if (items.some(item => item.scope === 'scene')) {
						const listener = () => api.refresh();
						config.onkey?.('sceneSearch.enabled', listener);
						subscriptions.push(['sceneSearch.enabled', listener]);
				}
				for (const item of items) {
						const listener = () => api.apply(item.key);
						config.onkey?.(item.key, listener);
						subscriptions.push([item.key, listener]);
				}
				const win = root.ownerDocument?.defaultView;
				let disposed = false;
				let onStorage = null, onAdvancedSave = null;
				if (scope !== 'related' && win?.addEventListener &&
						typeof config.getStorageKey === 'function' &&
						typeof config.refresh === 'function') {
						const shortcutKeys = Object.keys(config.default || {}).filter(key => /^KEY_|^PARAM_CUSTOM_SEEK_\d+$/.test(key));
						const sharedKeys = new Set(scope === 'bar' ?
								[...this.SHARED_SETTINGS.map(([key]) => key), ...shortcutKeys] : []);
						const ownKeys = new Set([...items.map(item => item.key), ...sharedKeys]);
						const byStorageKey = new Map([...ownKeys].map(key => [config.getStorageKey(key), key]));
						const sync = (key, removed = false) => {
								if (disposed || !ownKeys.has(key)) {
										return;
								}
								const storageKey = config.getStorageKey(key);
								const fallback = removed && config.storage?.[storageKey] === undefined &&
										Object.prototype.hasOwnProperty.call(config.default || {}, key) ?
										{ [storageKey]: JSON.stringify(config.default[key]) } : undefined;
								try {
										const previous = config.getValue(key);
										Promise.resolve(config.refresh(key, fallback))
												.then(() => {
												if (disposed) {
														return;
												}
												if (!sharedKeys.has(key)) {
														api.apply(key);
														return;
												}
												const value = config.getValue(key);
												const numeric = shortcutKeys.includes(key);
												const valid = numeric ? (typeof value === 'number' && Number.isFinite(value) &&
														(!key.startsWith('KEY_') || (Number.isSafeInteger(value) && value >= 0))) :
														typeof value === 'boolean';
												if (!valid || value === previous) {
														return;
												}
												config.emit?.('change', new Map([[key, value]]));
												const emit = config.emitAsync?.bind(config) || config.emit?.bind(config);
												emit?.('update', key, value);
												emit?.('update-' + key, value);
										})
												.catch(() => { }); // A blocked storage read must not break playback.
								}
								catch (_) { /* Navigation must continue on denied storage access. */ }
						};
						onStorage = e => {
								if (e.storageArea && config.storage && e.storageArea !== config.storage) {
										return;
								}
								const key = byStorageKey.get(e.key);
								if (key) {
										sync(key, e.newValue === null);
								}
						};
						onAdvancedSave = e => {
								const keys = (Array.isArray(e.detail?.keys) ? e.detail.keys : []);
								keys.forEach((key) => sync(key));
						};
						win.addEventListener('storage', onStorage);
						win.addEventListener('ZenzaWatch-advanced-settings-saved', onAdvancedSave);
				}
				api.dispose = () => {
						disposed = true;
						disposeTooltips();
						if (typeof config.offkey === 'function') {
								for (const [key, listener] of subscriptions) {
										config.offkey(key, listener);
								}
						}
						if (onStorage) {
								win.removeEventListener('storage', onStorage);
						}
						if (onAdvancedSave) {
								win.removeEventListener('ZenzaWatch-advanced-settings-saved', onAdvancedSave);
						}
						subscriptions.length = 0;
				};
				api.refresh();
				return api;
		}
		static assertValidManifest() {
				const items = this.ITEMS;
				const keys = new Set();
				for (const item of items) {
						if (!/^ui\.[a-z][a-zA-Z.]*$/.test(item.key) ||
								keys.has(item.key) || !item.scope || !item.label ||
								!item.icon || !item.selector) {
								throw new Error('Invalid visibility entry: ' + item.key);
						}
						keys.add(item.key);
				}
				return true;
		}
}
const NG_COLOR_HEX = Object.freeze({
	white:'#FFFFFF',red:'#FF0000',pink:'#FF8080',orange:'#FFC000',
	yellow:'#FFFF00',green:'#00FF00',cyan:'#00FFFF',blue:'#0000FF',
	purple:'#C000FF',black:'#000000',white2:'#CCCC99',
	niconicowhite:'#CCCC99',red2:'#CC0033',truered:'#CC0033',
	pink2:'#FF33CC',orange2:'#FF6600',passionorange:'#FF6600',
	yellow2:'#999900',madyellow:'#999900',green2:'#00CC66',
	elementalgreen:'#00CC66',cyan2:'#00CCCC',blue2:'#3399FF',
	marineblue:'#3399FF',purple2:'#6633CC',nobleviolet:'#6633CC',
	black2:'#666666'
});
class NgCompositeRules {
	static get CONFIG_KEY() {return 'ngComposite.rules';}
	static get COLORS() {return NG_COLOR_HEX;}
	static get FIELDS() {return ['text','regex','cmd','color','size','user','nicoru','position','fork','score','vpos','video'];}
	static get ACTIONS() {return ['hide','hideAuthor','replace','strip','normalize','dim','mask'];}
	static get MAX_RULES() {return 50;}
	static isSafeRegex(pattern,flags='i') {
		if(typeof pattern!=='string'||!pattern||pattern.length>160||!NgCompositeRules.validFlags(flags))return false;
		const ANY=null,empty=()=>new Set(),union=(a,b)=>a===ANY||b===ANY?ANY:new Set([...a,...b]);
		const ignoreCase=flags.includes('i'),proofFlags=(ignoreCase?'i':'')+(flags.includes('u')?'u':'');
		const proofCache=new Map();
		const literalTest=(word,value,prefix=false)=>{
			const key=JSON.stringify([word,prefix]);let re=proofCache.get(key);
			if(!re){
				const escaped=word.replace(/[.*+?^$(){}|[\]\\]/g,'\\$&');
				re=new RegExp('^(?:'+escaped+')'+(prefix?'':'$'),proofFlags);proofCache.set(key,re);
			}
			return re.test(value);
		};
		const overlap=(a,b)=>{
			if(a===ANY||b===ANY)return true;
			for(const c of a){
				if(b.has(c))return true;
				if(ignoreCase)for(const d of b)if(literalTest(c,d))return true;
			}
			return false;
		};
		const atom=(chars,word,min=1)=>({first:chars,chars,min,variable:false,ambiguous:false,words:word===null?null:[word]});
		const literal=s=>/[\ud800-\udfff]/.test(s)?atom(ANY,null):atom(new Set([s]),s);
		const zero=()=>atom(empty(),'',0);
		const wordsJoin=(a,b)=>!a||!b||a.length*b.length>32||
			a.some(x=>b.some(y=>x.length+y.length>160))?null:a.flatMap(x=>b.map(y=>x+y));
		const prefixFree=(a,b)=>a&&b&&!a.some(x=>b.some(y=>ignoreCase?
			literalTest(x,y,true)||literalTest(y,x,true):x.startsWith(y)||y.startsWith(x)));
		let i=0,depth=0;
		const fail=()=>{throw new Error('Unsupported or ambiguous regexp');};
		const sequence=()=>{
			const parts=[];
			while(i<pattern.length&&![')', '|'].includes(pattern[i])){
				let a=readAtom(),min=1,max=1;
				const q=pattern[i];
				if(q==='*'||q==='+'||q==='?'){i++;min=q==='+'?1:0;max=q==='?'?1:Infinity;}
				else if(q==='{'){
					const m=/^\{(\d+)(?:,(\d*))?\}/.exec(pattern.slice(i));
					if(m){i+=m[0].length;min=Number(m[1]);max=m[2]===undefined?min:m[2]===''?Infinity:Number(m[2]);}
				}
				if(min>1024||max!==Infinity&&max>1024||max<min)fail();
				if(max>1&&(a.min===0||a.variable||a.ambiguous))fail();
				if(min!==1||max!==1){
					if(pattern[i]==='?')i++;
					a={...a,min:a.min*min,variable:a.variable||min!==max,
						words:min===max&&min<=4?Array.from({length:min}).reduce(w=>wordsJoin(w,a.words),['']):null};
				}
				parts.push(a);
			}
			for(let p=0;p<parts.length;p++)if(parts[p].variable){
				for(let q=p+1;q<parts.length;q++)if(parts[q].variable&&overlap(parts[p].chars,parts[q].chars)){
					if(!parts.slice(p+1,q).some(x=>x.min>0&&!overlap(x.chars,parts[p].chars)))fail();
				}
			}
			let out=zero(),nullable=true;
			for(const a of parts){
				if(nullable)out.first=union(out.first,a.first);
				nullable=nullable&&a.min===0;out.chars=union(out.chars,a.chars);out.min+=a.min;
				out.variable=out.variable||a.variable;out.ambiguous=out.ambiguous||a.ambiguous;
				out.words=wordsJoin(out.words,a.words);
			}
			return out;
		};
		const expression=()=>{
			const branches=[sequence()];
			while(pattern[i]==='|'){i++;branches.push(sequence());}
			const out={...branches[0]};
			for(let p=0;p<branches.length;p++)for(let q=p+1;q<branches.length;q++){
				if(overlap(branches[p].first,branches[q].first)&&!prefixFree(branches[p].words,branches[q].words))out.ambiguous=true;
			}
			for(const a of branches.slice(1)){
				out.first=union(out.first,a.first);out.chars=union(out.chars,a.chars);out.min=Math.min(out.min,a.min);
				out.variable=out.variable||a.variable;out.ambiguous=out.ambiguous||a.ambiguous;
				out.words=out.words&&a.words&&out.words.length+a.words.length<=32?[...out.words,...a.words]:null;
			}
			return out;
		};
		const readAtom=()=>{
			const ch=pattern[i++];
			if(ch==='('){
				if(++depth>12)fail();
				if(pattern.slice(i,i+2)==='?:')i+=2;
				else if(pattern[i]==='?')fail(); // Lookarounds/named groups are outside this initial subset.
				const a=expression();if(pattern[i++]!==')')fail();depth--;return a;
			}
			if(ch==='['){
				const start=i-1;
				while(i<pattern.length){if(pattern[i]==='\\'){i+=2;continue;}if(pattern[i++]===']')break;}
				const raw=pattern.slice(start,i);if(!raw.endsWith(']'))fail();
				if(raw[1]==='^'||/\\|[^\x00-\x7f]/.test(raw))return atom(ANY,null);
				const re=new RegExp('^(?:'+raw+')$',proofFlags),chars=empty();
				for(let n=0;n<128;n++){const c=String.fromCharCode(n);if(re.test(c))chars.add(c);}
				return atom(chars,null);
			}
			if(ch==='.')return atom(ANY,null);
			if(ch==='^'||ch==='$')return zero();
			if(ch==='\\'){
				const e=pattern[i++];if(!e||/[1-9k]/.test(e))fail();
				if(e==='b'||e==='B')return zero();
				if(e==='d')return atom(new Set('0123456789'),null);
				if(e==='w')return atom(new Set('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_'),null);
				if(e==='s')return atom(new Set([' ','\t','\n','\r','\f','\v','\u00a0','\u1680',
					'\u2000','\u2001','\u2002','\u2003','\u2004','\u2005','\u2006','\u2007','\u2008',
					'\u2009','\u200a','\u2028','\u2029','\u202f','\u205f','\u3000','\ufeff']),null);
				if(/[DSW]/.test(e))return atom(ANY,null);
				if(e==='p'||e==='P'){
					const m=/^\{[A-Za-z_=]+\}/.exec(pattern.slice(i));if(!m||!flags.includes('u'))fail();i+=m[0].length;return atom(ANY,null);
				}
				if(e==='x'||e==='u'){
					const size=e==='x'?2:4;
					const hex=pattern.slice(i,i+size);if(!new RegExp('^[0-9a-f]{'+size+'}$','i').test(hex))fail();
					i+=size;return literal(String.fromCharCode(parseInt(hex,16)));
				}
				if(e==='0'){if(/\d/.test(pattern[i]||''))fail();return literal('\0');}
				if(e==='c')fail();
				return literal(({n:'\n',r:'\r',t:'\t',f:'\f',v:'\v'})[e]||e);
			}
			if(!ch||'*+?)'.includes(ch))fail();
			return literal(ch);
		};
		try{expression();if(i!==pattern.length)return false;new RegExp(pattern,flags);return true;}
		catch(_){return false;}
	}
	static validFlags(flags){
		return typeof flags==='string'&&/^[gimsu]*$/.test(flags)&&new Set(flags).size===flags.length;
	}
	static get MAX_REGEX_INPUT(){return 2048;}
	static color(value){
		if(typeof value!=='string')return null;
		const key=value.toLowerCase();
		if(Object.prototype.hasOwnProperty.call(NG_COLOR_HEX,key))return NG_COLOR_HEX[key];
		return /^#[0-9a-f]{6}$/i.test(value)?value.toUpperCase():null;
	}
	static number(value){
		if(typeof value==='number')return Number.isFinite(value)?value:null;
		if(typeof value==='string'&&/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value.trim())){
			const n=Number(value);return Number.isFinite(n)?n:null;
		}
		return null;
	}
	static validate(rules) {
		try{return NgCompositeRules._validate(rules);}catch(_){return false;}
	}
	static _validate(rules) {
		if(!Array.isArray(rules)||rules.length>NgCompositeRules.MAX_RULES) {return false;}
		let count=0,nodeIds=new Set();
		const str=(v,max=200)=>typeof v==='string'&&v.length<=max;
		const walk=(node,depth)=>{
			if(!node||typeof node!=='object'||++count>350||typeof node.id!=='string'||
					!node.id.trim()||node.id.length>80||nodeIds.has(node.id)){return false;}
			nodeIds.add(node.id);
			if(node.kind==='group'){
				return (node.not===undefined||node.not===false)&&depth<3&&['all','any'].includes(node.mode)&&Array.isArray(node.nodes)&&
					node.nodes.length>0&&node.nodes.length<=45&&node.nodes.every(n=>walk(n,depth+1));
			}
			if(Object.prototype.hasOwnProperty.call(node,'nodes')||!NgCompositeRules.FIELDS.includes(node.field)||typeof node.not!=='boolean'||
					!str(node.value,160)||!['contains','equals','notEquals','starts','ends','regex','gte','lte'].includes(node.cmp)){return false;}
			if(node.value.trim()===''||(['nicoru','score','vpos'].includes(node.field)&&
				!['gte','lte','equals'].includes(node.cmp))){return false;}
			if(node.field==='color'&&!NgCompositeRules.color(node.value)){return false;}
			if(node.field==='regex'||node.cmp==='regex'){
				if(!NgCompositeRules.isSafeRegex(node.value)){return false;}
				try{new RegExp(node.value,'i');}catch(_){return false;}
			}
			if(['nicoru','score','vpos'].includes(node.field)&&
				NgCompositeRules.number(node.value)===null){return false;}
			return true;
		};
		const ruleIds=new Set();
		return rules.every(r=>{
			nodeIds=new Set();
			if(!r||typeof r!=='object'||!str(r.id,80)||!r.id.trim()||ruleIds.has(r.id)||
					!str(r.name,90)||
					typeof r.enabled!=='boolean'||!['normal','any','owner','easy'].includes(r.scope)||
					!NgCompositeRules.ACTIONS.includes(r.action)||!['before','after'].includes(r.phase)||
					typeof r.stopOnMatch!=='boolean'||typeof r.exemptNicoru!=='boolean'||
					!Number.isInteger(r.nicoruMin)||r.nicoruMin<0||r.nicoruMin>10000000||
					!['evaluate','skip'].includes(r.unknownPolicy)||
					typeof r.keepProtectedOnAuthorHide!=='boolean'||!str(r.pattern,160)||
					!str(r.replacement,800)||!str(r.mask,800)||typeof r.regexReplace!=='boolean'||
					!str(r.flags,5)||!NgCompositeRules.validFlags(r.flags)||!Array.isArray(r.strip)||
					r.strip.length>40||r.strip.some(c=>!str(c,40)||
						!Object.prototype.hasOwnProperty.call(NG_COLOR_HEX,c.toLowerCase())&&
						!['big','small'].includes(c.toLowerCase())&&
						!/^#[0-9a-f]{6}$/i.test(c))||
					!(r.normalizeColor==='keep'||NgCompositeRules.color(r.normalizeColor))||
					!['keep','medium','big','small'].includes(r.normalizeSize)||
					!Number.isFinite(r.dim)||r.dim<5||r.dim>100||
					r.conditions?.kind!=='group'||!walk(r.conditions,0)){return false;}
			if(r.action==='replace'&&!r.pattern){return false;}
			if(r.action==='replace'&&r.regexReplace){
				if(!NgCompositeRules.isSafeRegex(r.pattern,r.flags)){return false;}
				try{new RegExp(r.pattern,r.flags);}catch(_){return false;}
			}
			ruleIds.add(r.id);
			return true;
		});
	}
	static matchScope(rule,chat) {
		const fork=Number(chat.fork);
		return rule.scope==='any'||(rule.scope==='normal'&&fork===0)||
			(rule.scope==='owner'&&fork===1)||(rule.scope==='easy'&&fork===2);
	}
	static nicoru(chat) {
		if(chat.nicoruKnown===false||chat.nicoru===null||chat.nicoru===undefined){return null;}
		const value=NgCompositeRules.number(chat.nicoru);
		return value!==null&&value>=0?value:null;
	}
	static protected(rule,chat) {
		if(!rule.exemptNicoru){return false;}
		const value=NgCompositeRules.nicoru(chat);
		return value===null?rule.unknownPolicy==='skip':value>=rule.nicoruMin;
	}
	static commandColor(cmd,base) {
		let value=NgCompositeRules.color(base)||'#FFFFFF';
		for(const token of String(cmd||'').toLowerCase().split(/\s+/)){
			if(Object.prototype.hasOwnProperty.call(NG_COLOR_HEX,token)){value=NG_COLOR_HEX[token];}
			else if(/^#[a-f0-9]{6}$/i.test(token)){value=token.toUpperCase();}
		}
		return value;
	}
	static matches(node,chat,regexCache=null) {
		if(!node){return false;}
		let matched=false;
		let known=true;
		if(node.kind==='group') {
			if(node.not!==undefined&&node.not!==false)return false;
			matched=node.nodes.length>0 && (node.mode==='all'?
				node.nodes.every(n=>NgCompositeRules.matches(n,chat,regexCache)):
				node.nodes.some(n=>NgCompositeRules.matches(n,chat,regexCache)));
		}else{
			const f=node.field;
			let actual;
			if(f==='text'||f==='regex'){actual=chat.text;}
			else if(f==='cmd'){actual=chat.cmd;}
			else if(f==='color'){actual=NgCompositeRules.commandColor(chat.cmd,chat.color);}
			else if(f==='size'){actual=chat.size;}
			else if(f==='user'){actual=chat.userId;}
			else if(f==='nicoru'){actual=NgCompositeRules.nicoru(chat);}
			else if(f==='position'){actual=chat.type;}
			else if(f==='fork'){actual=({0:'normal',1:'owner',2:'easy'})[chat.fork]||'other';}
			else if(f==='score'){actual=chat.score;}
			else if(f==='vpos'){const n=NgCompositeRules.number(chat.vpos);actual=n===null?null:n/100;}
			else if(f==='video'){actual=chat.videoId;}
			const expected=f==='color'?NgCompositeRules.color(node.value):node.value;
			if(f==='color'&&expected===null)return false;
			if(actual!==null&&actual!==undefined&&
					(!['score','vpos'].includes(f)||Number.isFinite(Number(actual)))){
				if(['nicoru','score','vpos'].includes(f)){
					const a=NgCompositeRules.number(actual),b=NgCompositeRules.number(expected);
					known=a!==null&&b!==null;
					matched=known&&(node.cmp==='gte'?a>=b:node.cmp==='lte'?a<=b:a===b);
				}else if(node.cmp==='regex'||f==='regex'){
					try{
						const cacheKey=JSON.stringify([expected,'i']);
						let regexp=regexCache?.get(cacheKey);
						if(!regexp){
							if(!NgCompositeRules.isSafeRegex(expected,'i'))return false;
							regexp=new RegExp(expected,'i');regexCache?.set(cacheKey,regexp);
						}
						const text=String(actual);
						if(text.length>NgCompositeRules.MAX_REGEX_INPUT)return false;
						regexp.lastIndex=0;matched=regexp.test(text);regexp.lastIndex=0;
					}catch(_){known=false;matched=false;}
				}else{
					const a=String(actual),b=String(expected);
					if(node.cmp==='contains'){matched=a.includes(b);}
					else if(node.cmp==='starts'){matched=a.startsWith(b);}
					else if(node.cmp==='ends'){matched=a.endsWith(b);}
					else if(node.cmp==='notEquals'){matched=a!==b;}
					else {matched=a===b;}
				}
			} else {known=false;}
		}
		return known?(node.not?!matched:matched):false;
	}
	static initialState(chat,videoId='') {
		const p=chat.props||chat;
		return {
			text:String(chat.text||''),cmd:String(chat.cmd||''),color:chat.color||'#FFFFFF',
			size:chat.size||'medium',type:chat.type||'naka',
			opacity:Number.isFinite(chat.opacity)?chat.opacity:1,
			nicoru:chat.nicoru,nicoruKnown:chat.nicoruKnown!==undefined?chat.nicoruKnown:p.nicoruKnown,
			userId:chat.userId||'',fork:chat.fork,score:chat.score,vpos:chat.vpos,
			videoId:videoId||'',threadLabel:chat.threadLabel,isCA:chat.isCA
		};
	}
	static applyAction(rule,state,regexCache=null) {
		if(rule.action==='hide'||rule.action==='hideAuthor'){state.hidden=true;return;}
		if(rule.action==='mask'){state.text=rule.mask;return;}
		if(rule.action==='dim'){state.opacity*=rule.dim/100;return;}
		if(rule.action==='replace'){
			if(!rule.pattern){return;}
			if(rule.regexReplace){
				if(state.text.length>NgCompositeRules.MAX_REGEX_INPUT)return false;
				try{
					const key=JSON.stringify([rule.pattern,rule.flags]);
					let re=regexCache?.get(key);
					if(!re){
						if(!NgCompositeRules.isSafeRegex(rule.pattern,rule.flags))return false;
						re=new RegExp(rule.pattern,rule.flags);regexCache?.set(key,re);
					}
					re.lastIndex=0;
					const replaced=state.text.replace(re,rule.replacement);
					re.lastIndex=0;
					if(replaced.length>8192)return false;
					state.text=replaced;
				}catch(_){return false;}
			}else {
				if(state.text.length>8192)return false;
				const replaced=state.text.split(rule.pattern).join(rule.replacement);
				if(replaced.length>8192)return false;state.text=replaced;
			}
			return;
		}
		if(rule.action==='normalize'&&rule.normalizeColor==='keep'&&rule.normalizeSize==='keep')return;
		let tokens=state.cmd.split(/\s+/).filter(Boolean);
		let colorChanged=false,sizeChanged=false;
		if(rule.action==='strip'){
			const excluded=new Set(rule.strip.map(v=>v.toLowerCase()));
			const removed=tokens.filter(v=>excluded.has(v.toLowerCase()));
			if(!removed.length)return;
			colorChanged=removed.some(t=>Object.prototype.hasOwnProperty.call(
				NG_COLOR_HEX,t.toLowerCase())||/^#[a-f\d]{6}$/i.test(t));
			sizeChanged=removed.some(t=>['big','small'].includes(t.toLowerCase()));
			tokens=tokens.filter(v=>!excluded.has(v.toLowerCase()));
		}else if(rule.action==='normalize'){
			colorChanged=rule.normalizeColor!=='keep';
			sizeChanged=rule.normalizeSize!=='keep';
			if(colorChanged){
				tokens=tokens.filter(t=>!Object.prototype.hasOwnProperty.call(
					NG_COLOR_HEX,t.toLowerCase())&&!/^#[a-f\d]{6}$/i.test(t));
				if(rule.normalizeColor!=='white'){tokens.push(rule.normalizeColor);}
			}
			if(sizeChanged){
				tokens=tokens.filter(t=>!['big','small'].includes(t.toLowerCase()));
				if(rule.normalizeSize!=='medium'){tokens.push(rule.normalizeSize);}
			}
		}
		state.cmd=tokens.join(' ');
		if(colorChanged){state.color=NgCompositeRules.commandColor(state.cmd,'#FFFFFF');}
		if(sizeChanged){
			const lower=tokens.map(t=>t.toLowerCase());
			state.size=lower.includes('big')?'big':lower.includes('small')?'small':'medium';
		}
	}
	static compile(input) {
		if(NgCompositeRules._programs?.has(input))return input;
		let rules;
		try{rules=JSON.parse(JSON.stringify(input));}catch(_){return null;}
		if(!NgCompositeRules.validate(rules))return null;
		const regexCache=new Map();
		const add=(source,flags)=>{
			const key=JSON.stringify([source,flags]);
			if(!regexCache.has(key))regexCache.set(key,new RegExp(source,flags));
		};
		const walk=n=>{
			if(n.kind==='group')n.nodes.forEach(walk);
			else if(n.field==='regex'||n.cmp==='regex')add(n.value,'i');
		};
		for(const r of rules){walk(r.conditions);if(r.action==='replace'&&r.regexReplace)add(r.pattern,r.flags);}
		const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}};
		freeze(rules);
		const active=rules.filter(r=>r.enabled);
		const program=Object.freeze({rules,active:Object.freeze(active),regexCache,
			before:Object.freeze(active.filter(r=>r.phase==='before')),
			after:Object.freeze(active.filter(r=>r.phase==='after')),
			hasAuthors:active.some(r=>r.action==='hideAuthor')});
		if(!NgCompositeRules._programs)NgCompositeRules._programs=new WeakSet();
		NgCompositeRules._programs.add(program);
		return program;
	}
	static project(chats,rules,legacyPredicate=()=>true,videoId='',baselines=null) {
		return NgCompositeRules.projectWithMeta(chats,rules,legacyPredicate,videoId,baselines)?.results||null;
	}
	static projectWithMeta(chats,rules,legacyPredicate=()=>true,videoId='',baselines=null,seedBans=null) {
		const program=NgCompositeRules.compile(rules);
		if(!program||!program.active.length)return null;
		const rows=chats.map(chat=>{
			const live=NgCompositeRules.initialState(chat,videoId),old=baselines?.get(chat);
			if(old)for(const key of ['text','cmd','color','size','opacity'])live[key]=old[key];
			return {...live,hidden:false,visible:true,stopped:false,legacyRejected:false};
		});
		const authorMatches=new Map();
		const eligible=(s,r)=>!s.hidden&&!s.stopped&&(r.phase==='before'||!s.legacyRejected);
		const phase=rulesInPhase=>{
			for(const r of rulesInPhase){
				if(r.action==='hideAuthor'){
					const ids=new Set(seedBans?.get(r.id)||[]);
					for(const s of rows){
						if(!eligible(s,r)||!s.userId||!NgCompositeRules.matchScope(r,s)||NgCompositeRules.protected(r,s))continue;
						if(NgCompositeRules.matches(r.conditions,s,program.regexCache))ids.add(s.userId);
					}
					authorMatches.set(r.id,ids);
					for(const s of rows){
						if(!eligible(s,r)||!s.userId||!ids.has(s.userId))continue;
						if(r.keepProtectedOnAuthorHide&&NgCompositeRules.protected(r,s))continue;
						s.hidden=true;s.stopped=true;
					}
				}else for(const s of rows){
					if(!eligible(s,r)||!NgCompositeRules.matchScope(r,s)||NgCompositeRules.protected(r,s))continue;
					if(!NgCompositeRules.matches(r.conditions,s,program.regexCache))continue;
					if(NgCompositeRules.applyAction(r,s,program.regexCache)===false)continue;
					if(r.stopOnMatch||s.hidden)s.stopped=true;
				}
			}
		};
		phase(program.before);
		for(const s of rows){
			s.legacyRejected=!legacyPredicate(s);
			s.visible=!s.hidden&&!s.legacyRejected;
		}
		phase(program.after);
		const results=new Map();
		rows.forEach((s,i)=>{s.visible=!s.hidden&&!s.legacyRejected;results.set(chats[i],s);});
		return {results,authorMatches};
	}
}
const Config = (() => {
		const DEFAULT_CONFIG = {
				debug: false,
				volume: 0.3,
				showComment: true,
				autoPlay: true,
				'autoPlay:ginza': true,
				'autoPlay:others': true,
				enableResume: false,
				loop: false,
				mute: false,
				screenMode: 'normal',
				'screenMode:ginza': 'normal',
				'screenMode:others': 'normal',
				autoFullScreen: false,
				autoCloseFullScreen: true, // 再生終了時に自動でフルスクリーン解除するかどうか
				continueNextPage: false, // 動画再生中にリロードやページ切り替えしたら続きから開き直す
				backComment: false, // 全画面・ワイド表示でコメントを映像の上に全域表示
				autoPauseCommentInput: true, // コメント入力時に自動停止する
				sharedNgLevel: 'MID', // NG共有の強度 NONE, LOW, MID, HIGH, MAX
				enablePushState: true, // ブラウザの履歴に乗せる
				enableHeatMap: true,
				pipPageThumbnail: true,
				pipPageThumbnailSource: 'smart',
				enableCommentPreview: false,
				enableAutoMylistComment: false, // マイリストコメントに投稿者を入れる
				menuScale: 1.0,
				enableTogglePlayOnClick: false, // 画面クリック時に再生/一時停止するかどうか
				enableDblclickClose: true, //
				smallModeOffsetX: 0, // 画面モード「小」の位置オフセットX(px)。ドラッグで動かした位置を記憶する
				smallModeOffsetY: 0, // 画面モード「小」の位置オフセットY(px)
				smallModeWidth: 0, // 画面モード「小」の幅(px)。0 = 既定値(SIDE_PLAYER_WIDTH)を使用
				smallModeHeight: 0, // 画面モード「小」の高さ(px)。0 = 既定値(SIDE_PLAYER_HEIGHT)を使用
				smallModeAspectLock: false, // 画面モード「小」のリサイズ時にアスペクト比を固定するか
				enableFullScreenOnDoubleClick: true,
				enableStoryboard: true, // シークバーサムネイル関連
				enableStoryboardBar: false, // シーンサーチ
				'popup.notifyColor': '#00cc00',
				'popup.alertColor': '#cc0000',
				'popup.backgroundTransparency': 0, // Shared background transparency: 0% opaque, 100% clear.
				videoInfoPanelTab: 'videoInfoTab',
				fullscreenControlBarMode: 'auto', // 'always-show' 'always-hide'
				'controlBar.showOnPause.small': true,
				'controlBar.showOnPause.fullscreen': false,
				'controlBar.hideAfterSeconds.small': 3,
				'controlBar.hideAfterSeconds.fullscreen': 0.4,
				'relatedMenu.customLinks': [], // Ordered URL templates; advanced settings owns the editor
				'relatedMenu.order': [], // Empty = original seven items, then links and registered actions
				'relatedMenu.hiddenItems': [], // Per-row display visibility, without deleting actions
				'relatedMenu.builtinOptions': {}, // Optional labels/open modes/copy format for standard items
				forceEconomy: false, // 動画を強制的にエコノミーモードで開く(HoverMenu.js/initializer.jsが参照)
				enableFilter: true,
				wordFilter: '',
				wordRegFilter: '',
				wordRegFilterFlags: 'i',
				userIdFilter: '',
				commandFilter: '',
				removeNgMatchedUser: false, // NGにマッチしたユーザーのコメント全部消す
				'ngComposite.rules': [], // 上級者向け複合NG・置換（初期状態は既存挙動のまま）
				'filter.fork0': true, // 通常コメント
				'filter.fork1': true, // 投稿者コメント
				'filter.fork2': true, // かんたんコメント
				'filter.fork3': true, // AIキャラクターコメント
				'filter.defaultThread': true, // 通常コメント
				'filter.ownerThread': true, // 投稿者コメント
				'filter.communityThread': true, // チャンネルコメント / コミュニティコメント
				'filter.nicosThread': true, // ニコスクリプトコメント
				'filter.easyThread': true, // かんたんコメント
				'filter.aiThread': true, // AIキャラクターコメント
				'filter.extraDefaultThread': true, // ***extra-default
				'filter.extraOwnerThread': true, // ***extra-owner
				'filter.extraCommunityThread': true, // 引用コメント
				'filter.extraNicosThread': true, // ***extra-nicos
				'filter.extraEasyThread': true, // 引用かんたんコメント
				videoTagFilter: '',
				videoOwnerFilter: '',
				enableCommentPanel: true,
				enableCommentPanelAutoScroll: true,
				commentSpeedRate: 1.0,
				autoCommentSpeedRate: false,
				playlistLoop: false,
				'playlist.maxItems': 3000,
				enableAdDecoration: true, // プレイリストに広告の金冠・銀冠枠を表示する(Task 054)
				debugCheckAdDecoration: false,
				commentLanguage: 'ja-jp',
				baseFontFamily: '',
				baseChatScale: 1.0,
				baseFontBolder: true,
				cssFontWeight: 'bold',
				allowOtherDomain: true,
				overrideWatchLink: false, // すべての動画リンクをZenzaWatchで開く
				'overrideWatchLink:others': false, // すべての動画リンクをZenzaWatchで開く
				speakLark: false, // 一発ネタのコメント読み上げ機能. 飽きたら消す
				speakLarkVolume: 1.0, // 一発ネタのコメント読み上げ機能. 飽きたら消す
				enableSingleton: false,
				loadLinkedChannelVideo: false,
				commentLayerOpacity: 1.0, //
				'commentLayer.textShadowType': '', // フォントの修飾タイプ
				'commentLayer.enableSlotLayoutEmulation': false,
				'commentLayer.maxDisplayComment': CommentDisplayBudget.DEFAULT,
				'commentLayer.protectCA': true,
				'commentLayer.ownerCommentShadowColor': '#008800', // 投稿者コメントの影の色
				'commentLayer.easyCommentOpacity': 0.5, // かんたんコメントの透明度
				'commentLayer.aiCommentOpacity': 0.5, // かんたんコメントの透明度
				overrideGinza: false, // 動画視聴ページでもGinzaの代わりに起動する
				enableGinzaSlayer: false, // まだ実験中
				lastPlayerId: '',
				playbackRate: 1.0,
				lastWatchId: 'sm9',
				message: '',
				enableVideoSession: true,
				videoServerType: 'dmc',
				autoDisableNew: true, // dmcのほうが高画質と思われる動画でdomandを無効にする
				dmcVideoQuality: 'auto', // 優先する画質 auto, veryhigh, high, mid, low
				domandVideoQuality: 'auto', // 優先する画質 auto, 1080p, 720, 480p, 360p, 144p
				'video.hls.enableOnlyRequired': true, // hlsが必須の動画だけ有効化する
				enableNicosJumpVideo: true, // @ジャンプを有効にするかどうか
				'videoSearch.ownerOnly': false, // Task 073: 検索欄を開くたびにOFFへ戻す（VideoSearchForm）
				'videoSearch.mode': 'tag',
				'videoSearch.order': 'desc',
				'videoSearch.sort': 'playlist',
				'videoSearch.word': '',
				'videoSearch.f_range': 0,
				'videoSearch.l_range': 0,
				'videoSearch.genre': 'all',
				'videoSearch.videoIdSuggestMode': 'merged',
				'videoSearch.wordCountMode': 'on-demand',
				'videoHeader.position': 'auto',
				'uaa.enable': true,
				'audio.autoAdjust': false, // 既定はOFF（ONにすると音が大きい動画だけ音量が下がる）
				'supporterCredit.enable': true, // 提供画面を表示する
				'supporterCredit.voice': true, // 提供音声（期間ごとに変わる読み上げ）を鳴らす
				'supporterCredit.gift': true, // ギフトが落ちてくる演出を表示する
				'supporterCredit.skipInPlaylist': false, // 連続再生中は表示しない
				'screenFilter.enable': true,
				'screenFilter.saved': '',
				'screenFilter.brightness': 100, // 明るさ(%)
				'screenFilter.contrast': 100, // コントラスト(%)
				'screenFilter.saturate': 100, // 彩度(%)
				'screenFilter.sepia': 0, // 暖色(%)
				'screenFilter.hue': 0, // 色相(度)
				'screenFilter.blur': 0, // ぼかし(px)
				'screenFilter.invert': false, // 階調反転
				'screenFilter.gamma': 1.0, // ガンマ
				'screenFilter.blackLevel': 0, // 黒レベル（SVGフィルター）
				'screenFilter.whiteLevel': 0, // 白レベル（SVGフィルター）
				'screenFilter.sharpen': 0, // シャープ（SVGフィルター）
				'screenFilter.temperature': 0, // 色温度（-100 青〜+100 橙）
				'screenFilter.tint': 0, // 色かぶり補正（-100 緑〜+100 赤紫）
				'screenFilter.autoLevels': false, // 自動レベル補正
				'screenFilter.vignette': 0, // 周辺減光(%)
				'screenFilter.colorize': 'none', // 着色（none/gold/sepia/blue/green）
				'screenFilter.flipH': false, // 左右反転（旧 toggle-flipH。ページを開き直すとOFFに戻る）
				'screenFilter.flipV': false, // 上下反転（旧 toggle-flipV。同上）
				'screenFilter.applyToScreenshot': true, // スクリーンショットにも反映する
				'screenFilter.applyToCommentPip': true, // P in P(コメント付き)にも反映する
				'screenshot.prefix': '', // スクリーンショットのファイル名の先頭につける文字
				'screenshot.filenameTemplate': '', // 空は従来書式。トークンでファイル名構成を指定可能
				'search.limit': 1000,
				'touch.enable': window.ontouchstart !== undefined,
				'touch.tap2command': '',
				'touch.tap3command': 'toggle-mute',
				'touch.tap4command': 'toggle-showComment',
				'touch.tap5command': 'screenShot',
				autoZenTube: false,
				bestZenTube: false,
				KEY_CLOSE: 27, // ESC
				KEY_RE_OPEN: 27 + 0x1000, // SHIFT + ESC
				KEY_HOME: 36 + 0x1000, // SHIFT + HOME
				KEY_SEEK_LEFT: 37 + 0x1000, // SHIFT + LEFT
				KEY_SEEK_RIGHT: 39 + 0x1000, // SHIFT + RIGHT
				KEY_SEEK_PREV_FRAME: 188, // ,
				KEY_SEEK_NEXT_FRAME: 190, // .
				KEY_VOL_UP: 38 + 0x1000, // SHIFT + UP
				KEY_VOL_DOWN: 40 + 0x1000, // SHIFT + DOWN
				KEY_INPUT_COMMENT: 67, // C
				KEY_FULLSCREEN: 70, // F
				KEY_MUTE: 77, // M
				KEY_TOGGLE_COMMENT: 86, // V
				KEY_TOGGLE_LOOP: 82, // R 76, // L
				KEY_DEFLIST_ADD: 84, // T
				KEY_DEFLIST_REMOVE: 84 + 0x1000, // SHIFT + T
				KEY_TOGGLE_PLAY: 32, // SPACE
				KEY_TOGGLE_PLAYLIST: 80, // P
				KEY_SCREEN_MODE_1: 49 + 0x1000, // SHIFT + 1
				KEY_SCREEN_MODE_2: 50 + 0x1000, // SHIFT + 2
				KEY_SCREEN_MODE_3: 51 + 0x1000, // SHIFT + 3
				KEY_SCREEN_MODE_4: 52 + 0x1000, // SHIFT + 4
				KEY_SCREEN_MODE_5: 53 + 0x1000, // SHIFT + 5
				KEY_SCREEN_MODE_6: 54 + 0x1000, // SHIFT + 6
				KEY_SHIFT_RESET: 49, // 1
				KEY_SHIFT_DOWN: 188 + 0x1000, // <
				KEY_SHIFT_UP: 190 + 0x1000, // >
				KEY_NEXT_VIDEO: 74, // J
				KEY_PREV_VIDEO: 75, // K
				KEY_SCREEN_SHOT: 83, // S
				KEY_SCREEN_SHOT_WITH_COMMENT: 83 + 0x1000, // SHIFT + S
		};
		// =====================================================================
		// =====================================================================
		if (navigator &&
				navigator.userAgent &&
				navigator.userAgent.match(/(Android|iPad;|CriOS)/i)) {
				DEFAULT_CONFIG.overrideWatchLink = true;
				DEFAULT_CONFIG.enableTogglePlayOnClick = true;
				DEFAULT_CONFIG.autoFullScreen = true;
				DEFAULT_CONFIG.autoCloseFullScreen = false;
				DEFAULT_CONFIG.volume = 1.0;
				DEFAULT_CONFIG.enableVideoSession = true;
				DEFAULT_CONFIG['uaa.enable'] = false;
		}
		Object.assign(DEFAULT_CONFIG, UiVisibilityRegistry.defaults());
		Object.assign(DEFAULT_CONFIG, {
				'sceneSearch.presentation.normal': 'follow',
				'sceneSearch.presentation.fullscreen': 'follow',
				'sceneSearch.presentation.migrationAcknowledged': false,
				'sceneSearch.layout.normal': '01',
				'sceneSearch.layout.fullscreen': '01',
				'sceneSearch.layout.linkFullscreen': false,
				'sceneSearch.seekStepSeconds': 5,
				'sceneSearch.idleHideSeconds': 2,
				'sceneSearch.controlsReveal': 'hover-focus',
				'sceneSearch.animation': 'subtle',
				'sceneSearch.enabled': true,
				'sceneSearch.commentListScale': 100,
				'sceneSearch.commentPreviewVisible': true,
				'sceneSearch.miniCommentVisible': true,
				'sceneSearch.commentListVisible': true,
				'sceneSearch.commentListBackgroundOpacity': 90,
				'sceneSearch.thumbnailScale': 100,
				'sceneSearch.miniCommentMode': 'flow'
		});
		Object.assign(DEFAULT_CONFIG, buildDefaultKeyConfig(DEFAULT_CONFIG));
		for (let i = 1; i <= 10; i++) {
				DEFAULT_CONFIG['PARAM_CUSTOM_SEEK_' + i] = 0;
		}
		Object.assign(DEFAULT_CONFIG, ZenzaCommentHistorySettings.HISTORY_PREFERENCE_DEFAULTS);
		const config = DataStorage.create(DEFAULT_CONFIG, {
				normalizeImport: (key, value) => {
						if (['videoSearch.f_range', 'videoSearch.l_range'].includes(key) &&
								typeof value === 'string' && /^[0-9]+$/.test(value)) {
								return Number(value);
						}
						return value;
				},
				validateImport: (key, value) => {
						if (key === 'sceneSearch.presentation.normal' || key === 'sceneSearch.presentation.fullscreen') {
								return ['follow', 'fixed', 'legacy'].includes(value);
						}
						if (key === 'sceneSearch.presentation.migrationAcknowledged') {
								return typeof value === 'boolean';
						}
						if (key === 'sceneSearch.layout.normal' ||
								key === 'sceneSearch.layout.fullscreen') {
								return typeof value === 'string' && /^(00|0[1-9]|10)$/.test(value);
						}
						if (key === 'sceneSearch.enabled' || key === 'sceneSearch.layout.linkFullscreen' ||
								key === 'sceneSearch.commentPreviewVisible' ||
								key === 'sceneSearch.miniCommentVisible' ||
								key === 'sceneSearch.commentListVisible') {
								return typeof value === 'boolean';
						}
						if (key === 'sceneSearch.miniCommentMode') {
								return ['flow', 'static', 'hidden'].includes(value);
						}
						if (key === 'sceneSearch.seekStepSeconds') {
								return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= 600;
						}
						if (key === 'sceneSearch.idleHideSeconds') {
								return typeof value === 'number' && Number.isFinite(value) &&
										value >= 0 && value <= 30 && Number.isInteger(value * 2);
						}
						if (key === 'sceneSearch.commentListBackgroundOpacity') {
								return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= 100;
						}
						if (key === 'sceneSearch.commentListScale') {
								return typeof value === 'number' && Number.isSafeInteger(value) && value >= 100 && value <= 200;
						}
						if (key === 'sceneSearch.thumbnailScale') {
								return typeof value === 'number' && Number.isSafeInteger(value) && value >= 50 && value <= 200;
						}
						if (key === 'sceneSearch.controlsReveal') {
								return ['hover-focus', 'click', 'always'].includes(value);
						}
						if (key === 'sceneSearch.animation') {
								return ['off', 'subtle', 'full'].includes(value);
						}
						if (key.startsWith('sceneSearch.')) {
								return false;
						}
						if (key === 'ngComposite.rules') {
								return typeof NgCompositeRules !== 'undefined' ? NgCompositeRules.validate(value) :
										Array.isArray(value) && value.length === 0;
						}
						if (key === RelatedMenuActions.CONFIG_KEY) {
								return RelatedMenuActions.validateLinks(value).valid;
						}
						if (key === RelatedMenuOrder.CONFIG_KEY) {
								return RelatedMenuOrder.validateOrder(value);
						}
						if (key === RelatedMenuOrder.HIDDEN_KEY) {
								return RelatedMenuOrder.validateHiddenItems(value);
						}
						if (key === RelatedMenuOrder.OPTIONS_KEY) {
								return RelatedMenuOrder.validateOptions(value);
						}
						if (UiVisibilityRegistry.isVisibilityKey(key)) {
								return typeof value === 'boolean';
						}
						if (key === 'screenshot.filenameTemplate') {
								return ScreenshotFileName.validateTemplate(value);
						}
						if (key === 'controlBar.showOnPause.small' || key === 'controlBar.showOnPause.fullscreen') {
								return typeof value === 'boolean';
						}
						if (key === 'controlBar.hideAfterSeconds.small' || key === 'controlBar.hideAfterSeconds.fullscreen') {
								return typeof value === 'number' && Number.isFinite(value) && value >= 0.2 &&
										value <= 10 && Math.abs(value * 10 - Math.round(value * 10)) < 0.000001;
						}
						if (key === 'commentHistory.enabled') {
								return typeof value === 'boolean';
						}
						if (key.startsWith('commentHistory.')) {
								const descriptor = ZenzaCommentHistorySettings.SETTINGS_SCHEMA.find(item => item.key === key);
								if (!descriptor) {
										return false;
								}
								try {
										ZenzaCommentHistorySettings.normalizeSettings({ [descriptor.name]: value });
										return true;
								}
								catch (_) {
										return false;
								}
						}
						const choices = {
								screenMode: ['normal', 'big', 'wide', 'small', 'sideView', '3D'],
								sharedNgLevel: ['NONE', 'LOW', 'MID', 'HIGH', 'MAX'],
								fullscreenControlBarMode: ['auto', 'always-show', 'always-hide'],
								pipPageThumbnailSource: ['smart', 'legacy'],
								'videoHeader.position': ['auto', 'outside', 'overlay', 'overlay-visible'],
								'videoSearch.videoIdSuggestMode': ['merged', 'side', 'delayed'],
								'videoSearch.wordCountMode': ['on-demand', 'auto', 'off']
						};
						const name = key.startsWith('screenMode:') ? 'screenMode' : key;
						if (Object.prototype.hasOwnProperty.call(choices, name)) {
								return choices[name].includes(value);
						}
						if (key.startsWith('KEY_')) {
								return Number.isSafeInteger(value) && value >= 0;
						}
						if (key === CommentDisplayBudget.CONFIG_KEY) {
								return CommentDisplayBudget.isValidLimit(value);
						}
						if (key === 'commentLayer.protectCA') {
								return typeof value === 'boolean';
						}
						if (key === 'playlist.maxItems') {
								return Number.isInteger(value) && value >= 1000 && value <= 10000 && value % 1000 === 0;
						}
						if (key === 'search.limit') {
								return Number.isInteger(value) && value >= 1 && value <= 5000;
						}
						if (['volume', 'speakLarkVolume', 'commentLayerOpacity',
								'commentLayer.easyCommentOpacity', 'commentLayer.aiCommentOpacity'].includes(key)) {
								return Number.isFinite(value) && value >= 0 && value <= 1;
						}
						if (['playbackRate', 'commentSpeedRate', 'baseChatScale', 'menuScale'].includes(key)) {
								return Number.isFinite(value) && value > 0;
						}
						if (['smallModeWidth', 'smallModeHeight'].includes(key)) {
								return Number.isFinite(value) && value >= 0;
						}
						return true;
				},
				preserveInvalidKeys: Object.keys(ZenzaCommentHistorySettings.HISTORY_PREFERENCE_DEFAULTS),
				prefix: PRODUCT,
				ignoreExportKeys: ['message', 'lastPlayerId', 'lastWatchId', 'debug'],
				readonly: !location || location.host !== 'www.nicovideo.jp',
				storage: localStorage
		});
		config.hasStoredValue = function (key) {
				try {
						const text = this.storage[this.getStorageKey(key)];
						if (typeof text !== 'string') {
								return false;
						}
						const value = JSON.parse(text);
						return Object.prototype.hasOwnProperty.call(this.default, key) &&
								typeof value === typeof this.default[key] && this.options.validateImport(key, value);
				}
				catch (_) {
						return false;
				}
		};
		config.resolveSceneSearch = function () {
				return typeof SceneSearchPreferences === 'undefined' ? null :
						SceneSearchPreferences.resolve(key => this.getValue(key), key => this.hasStoredValue(key));
		};
		config.persistSceneSearchSelection = function (values) {
				if (this.readonly) {
						throw new Error('設定は読み取り専用です');
				}
				const entries = Object.entries(values).map(([key, value]) => {
						if (!key.startsWith('sceneSearch.') || !Object.prototype.hasOwnProperty.call(this.default, key) ||
								typeof value !== typeof this.default[key] || !this.options.validateImport(key, value)) {
								throw new TypeError('無効なシーンサーチ設定: ' + key);
						}
						const storageKey = this.getStorageKey(key);
						return { key, value, storageKey, before: this.storage[storageKey], json: JSON.stringify(value) };
				});
				const written = [];
				try {
						for (const entry of entries) {
								written.push(entry);
								this.storage[entry.storageKey] = entry.json;
								if (this.storage[entry.storageKey] !== entry.json) {
										throw new Error('設定を保存できません: ' + entry.key);
								}
						}
				}
				catch (error) {
						for (const entry of written.reverse()) {
								try {
										if (entry.before === undefined) {
												delete this.storage[entry.storageKey];
										}
										else {
												this.storage[entry.storageKey] = entry.before;
										}
								}
								catch (_) { /* Preserve the write error; never report success. */ }
						}
						throw error;
				}
				for (const { key, value } of entries) {
						this._data[key] = value;
						if (!this.silently) {
								this._changed.set(key, value);
						}
				}
				if (!this.silently && entries.length) {
						this._onChange();
				}
		};
		config.import = function (data) {
				let input = data;
				if (data && typeof data === 'object' && !Array.isArray(data) && typeof SceneSearchPreferences !== 'undefined') {
						const record = data;
						const owns = (key) => Object.prototype.hasOwnProperty.call(record, key);
						const resolved = SceneSearchPreferences.resolve(key => record[key], owns);
						const imported = { ...record };
						for (const [key, value] of [
								['sceneSearch.enabled', resolved.enabled],
								['sceneSearch.presentation.normal', resolved.normal],
								['sceneSearch.presentation.fullscreen', resolved.fullscreen],
								['sceneSearch.miniCommentVisible', resolved.miniVisible]
						]) {
								if (!owns(key))
										imported[key] = value;
						}
						input = imported;
				}
				return Object.getPrototypeOf(this).import.call(this, input);
		};
		config.export = function (isAll = false) {
				const data = Object.getPrototypeOf(this).export.call(this, isAll);
				for (const key of ['sceneSearch.enabled', 'sceneSearch.presentation.normal', 'sceneSearch.presentation.fullscreen',
						'sceneSearch.miniCommentVisible']) {
						if (this.hasStoredValue(key)) {
								data[key] = this.getValue(key);
						}
				}
				return data;
		};
		return config;
})();
Config.exportConfig = () => Config.export();
Config.importConfig = v => Config.import(v);
Config.exportToFile = () => {
		const json = Config.exportJson();
		const blob = new Blob([json], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		try {
				const a = Object.assign(document.createElement('a'), {
						download: `${new Date().toLocaleString().replace(/[:/]/g, '_')}_ZenzaWatch.config.json`,
						rel: 'noopener',
						href: url
				});
				a.click();
		}
		finally {
				setTimeout(() => URL.revokeObjectURL(url), 2000);
		}
};
const NaviConfig = Config;
        await Config.promise('restore');
const uQuery = (() => {
		const endMap = new WeakMap();
		const emptyMap = new Map();
		const emptySet = new Set();
		const elementsEventMap = new WeakMap();
		const HAS_CSSTOM = (window.CSS && CSS.number) ? true : false;
		const toCamel = (p) => p.replace(/-./g, s => s.charAt(1).toUpperCase());
		const toSnake = (p) => p.replace(/[A-Z]/g, s => `-${s.toLowerCase()}`);
		const isStyleValue = (val) => ('px' in CSS) && val instanceof CSSStyleValue;
		const emitter = new Emitter();
		const UNDEF = Symbol('undefined');
		const waitForDom = (resolve) => {
				if (['interactive', 'complete'].includes(document.readyState)) {
						return resolve();
				}
				document.addEventListener('DOMContentLoaded', resolve, { once: true });
		};
		const waitForComplete = (resolve) => {
				if (['complete'].includes(document.readyState)) {
						return resolve();
				}
				window.addEventListener('load', resolve, { once: true });
		};
		const isTagLiteral = (t, ...args) => Array.isArray(t) &&
				Array.isArray(t.raw) &&
				t.length === t.raw.length &&
				args.length === t.length - 1;
		const templateMap = new WeakMap();
		const createDom = (template, ...args) => {
				const isTL = isTagLiteral(template, ...args);
				if (isTL && templateMap.has(template)) {
						const tpl = templateMap.get(template);
						return document.importNode(tpl.content, true);
				}
				const tpl = document.createElement('template');
				tpl.innerHTML = isTL ? String.raw(template, ...args) : template;
				isTL && templateMap.set(template, tpl);
				return document.importNode(tpl.content, true);
		};
		const walkingHandler = {
				set: function (target, prop, value) {
						for (const elm of target) {
								elm[prop] = value;
						}
						return true;
				},
				get: function (target, prop) {
						const isFunc = target.some(elm => typeof elm[prop] === 'function');
						if (!isFunc) {
								const isObj = target.some(elm => elm[prop] instanceof Object);
								let result = target.map(elm => typeof elm[prop] === 'function' ? elm[prop].bind(elm) : elm[prop]);
								return isObj ? result.walk : result;
						}
						return (...args) => {
								let result = target.map((elm, index) => {
										try {
												return (typeof elm[prop] === 'function' ?
														elm[prop].apply(elm, args) : elm[prop]) || elm;
										}
										catch (error) {
												console.warn('Exception: ', { target, prop, index, error });
										}
								});
								const isObj = result.some((r) => r instanceof Object);
								return isObj ? result.walk : result;
						};
				}
		};
		const isHTMLElement = (elm) => {
				return (elm instanceof HTMLElement) ||
						(elm.ownerDocument && elm instanceof elm.ownerDocument.defaultView.HTMLElement);
		};
		const isNode = (elm) => {
				return (elm instanceof Node) ||
						(elm.ownerDocument && elm instanceof elm.ownerDocument.defaultView.Node);
		};
		const isDocument = (d) => {
				return (d instanceof Document) || (d && d[Symbol.toStringTag] === 'HTMLDocument') ||
						(d.documentElement && d instanceof d.documentElement.ownerDocument.defaultView.Node);
		};
		const isEventTarget = (e) => {
				return (e instanceof EventTarget) ||
						(e[Symbol.toStringTag] === 'EventTarget') ||
						(e.addEventListener && e.removeEventListener && e.dispatchEvent);
		};
		const isHTMLCollection = (e) => {
				return e instanceof HTMLCollection || (e && e[Symbol.toStringTag] === 'HTMLCollection');
		};
		const isNodeList = (e) => {
				return e instanceof NodeList || (e && e[Symbol.toStringTag] === 'NodeList');
		};
		class RafCaller {
				constructor(elm, methods = []) {
						this.elm = elm;
						methods.forEach(method => {
								const task = elm[method].bind(elm);
								task._name = method;
								this[method] = (...args) => {
										this.enqueue(task, ...args);
										return elm;
								};
						});
				}
				get promise() {
						return this.constructor.promise;
				}
				enqueue(task, ...args) {
						this.constructor.taskList.push([task, ...args]);
						this.constructor.exec();
				}
				cancel() {
						this.constructor.taskList.length = 0;
				}
		}
		RafCaller.promise = new PromiseHandler();
		RafCaller.taskList = [];
		RafCaller.exec = throttle.raf(function () {
				const taskList = this.taskList.concat();
				this.taskList.length = 0;
				for (const [task, ...args] of taskList) {
						try {
								task(...args);
						}
						catch (err) {
								console.warn('RafCaller task fail', { task, args });
						}
				}
				this.promise.resolve();
				this.promise = new PromiseHandler();
		}.bind(RafCaller));
		class $Array extends Array {
				get [Symbol.toStringTag]() {
						return '$Array';
				}
				get na() {
						return this[0];
				}
				get nz() {
						return this[this.length - 1];
				}
				get walk() {
						const p = this._walker || new Proxy(this, walkingHandler);
						this._walker = p;
						return p;
				}
				get array() {
						return [...this];
				}
				toArray() {
						return this.array;
				}
				constructor(...args) {
						super();
						const elm = args.length > 1 ? args : args[0];
						if (isHTMLCollection(elm) || isNodeList(elm)) {
								for (const e of elm) {
										super.push(e);
								}
						}
						else if (typeof elm === 'number') {
								this.length = elm;
						}
						else {
								this[0] = elm;
						}
				}
				get raf() {
						if (!this._raf) {
								this._raf = new RafCaller(this, [
										'addClass', 'removeClass', 'toggleClass', 'css', 'setAttribute', 'attr', 'data', 'prop',
										'val', 'focus', 'blur', 'insert', 'append', 'appendChild', 'prepend', 'after', 'before',
										'text', 'appendTo', 'prependTo', 'remove', 'show', 'hide'
								]);
						}
						return this._raf;
				}
				get htmls() {
						return this.filter(isHTMLElement);
				}
				*getHtmls() {
						for (const elm of this) {
								if (isHTMLElement(elm)) {
										yield elm;
								}
						}
				}
				get firstElement() {
						for (const elm of this) {
								if (isHTMLElement(elm)) {
										return elm;
								}
						}
						return null;
				}
				get nodes() {
						return this.filter(isNode);
				}
				*getNodes() {
						for (const n of this) {
								if (isNode(n)) {
										yield n;
								}
						}
				}
				get firstNode() {
						for (const n of this) {
								if (isNode(n)) {
										return n;
								}
						}
						return null;
				}
				get independency() {
						const nodes = this.nodes;
						if (nodes.length <= 1) {
								return nodes;
						}
						return this.filter(elm => nodes.every(e => e === elm || !e.contains(elm)));
				}
				get uniq() {
						return this.constructor.from([...new Set(this)]);
				}
				clone() {
						return this.constructor.from(this.independency.filter(e => e.cloneNode).map(e => e.cloneNode(true)));
				}
				find(query) {
						if (typeof query !== 'string') {
								return super.find(query);
						}
						return this.query(query);
				}
				query(query) {
						const found = this
								.independency
								.filter(elm => elm.querySelectorAll)
								.map(elm => $Array.from(elm.querySelectorAll(query)))
								.flat();
						endMap.set(found, this);
						return found;
				}
				mapQuery(map) {
						const $tmp = this
								.independency
								.filter(elm => elm.querySelectorAll);
						const result = [], e = [], $ = {};
						for (const key of Object.keys(map)) {
								const query = map[key];
								const found = $tmp.map(elm => $Array.from(elm.querySelectorAll(query))).flat();
								result[key] = key.match(/^_?\$/) ? found : found[0];
								$[key.replace(/^(_?)/, '$1$')] = found;
								e[key.replace(/^(_?)\$/, '$1')] = found[0];
						}
						return { result, $, e };
				}
				end() {
						return endMap.has(this) ? endMap.get(this) : this;
				}
				each(callback) {
						this.htmls.forEach((elm, index) => callback.apply(elm, [index, elm]));
				}
				closest(selector) {
						const found = this
								.independency
								.filter(elm => elm.closest)
								.map(elm => elm.closest(selector))
								.filter(elm => elm);
						const result = this.constructor.from(found);
						endMap.set(result, this);
						return result;
				}
				parent() {
						const found = this
								.independency
								.filter(e => e.parentNode).map(e => e.parentNode);
						return found;
				}
				parents(selector) {
						let h = selector ? this.parent().closest(selector) : this.parent();
						const found = [h];
						while (h.length) {
								h = selector ? h.parent().closest(selector) : h.parent();
								found.push(h);
						}
						return $Array.from(found.flat());
				}
				toggleClass(className, v) {
						if (typeof v === 'boolean') {
								return v ? this.addClass(className) : this.removeClass(className);
						}
						const classes = className.trim().split(/\s+/);
						const htmls = this.getHtmls();
						for (const elm of htmls) {
								for (const c of classes) {
										elm.classList.toggle(c, v);
								}
						}
						return this;
				}
				addClass(className) {
						const names = className.split(/\s+/);
						const htmls = this.getHtmls();
						for (const elm of htmls) {
								elm.classList.add(...names);
						}
						return this;
				}
				removeClass(className) {
						const names = className.split(/\s+/);
						const htmls = this.getHtmls();
						for (const elm of htmls) {
								elm.classList.remove(...names);
						}
						return this;
				}
				hasClass(className) {
						const names = className.trim().split(/[\s]+/);
						const htmls = this.htmls;
						return names.every(name => htmls.every(elm => elm.classList.contains(name)));
				}
				_css(props) {
						const htmls = this.getHtmls();
						for (const element of htmls) {
								const style = element.style;
								const map = element.attributeStyleMap;
								for (let [key, val] of ((props instanceof Map) ? props : Object.entries(props))) {
										if (key.startsWith('--')) {
												style.setProperty(key, val);
												continue;
										}
										const isNumber = /^[0-9+.]+$/.test(val);
										if (isNumber && /(width|height|top|left)$/i.test(key)) {
												val = HAS_CSSTOM ? CSS.px(val) : `${val}px`;
										}
										try {
												if (HAS_CSSTOM && isStyleValue(val)) {
														key = toSnake(key);
														map.set(key, val);
												}
												else {
														key = toCamel(key);
														style[key] = val;
												}
										}
										catch (err) {
												console.warn('uQuery.css fail', { key, val, isNumber });
										}
								}
						}
						return this;
				}
				css(key, val = UNDEF) {
						if (typeof key === 'string') {
								if (val !== UNDEF) {
										return this._css({ [key]: val });
								}
								else {
										const element = this.firstElement;
										if (HAS_CSSTOM) {
												return element.attributeStyleMap.get(toSnake(key));
										}
										else {
												return element.style[toCamel(key)];
										}
								}
						}
						else if (key !== null && typeof key === 'object') {
								return this._css(key);
						}
						return this;
				}
				on(eventName, callback, options) {
						if (typeof callback !== 'function') {
								return this;
						}
						eventName = eventName.trim();
						const elementEventName = eventName.split('.')[0];
						for (const element of this.filter(isEventTarget)) {
								const elementEvents = elementsEventMap.get(element) || new Map;
								const listenerSet = elementEvents.get(eventName) || new Set;
								elementEvents.set(eventName, listenerSet);
								elementsEventMap.set(element, elementEvents);
								if (!listenerSet.has(callback)) {
										listenerSet.add(callback);
										element.addEventListener(elementEventName, callback, options);
								}
						}
						return this;
				}
				click(...args) {
						if (!args.length) {
								const f = this.firstElement;
								f && f.click();
								return this;
						}
						const callback = args.find(a => typeof a === 'function');
						const data = args[0] !== callback ? args[0] : null;
						return this.on('click', e => {
								data && (e.data = e.data || {}) && Object.assign(e.data, data);
								callback(e);
						});
				}
				dblclick(...args) {
						const callback = args.find(a => typeof a === 'function');
						const data = args[0] !== callback ? args[0] : null;
						return this.on('dblclick', e => {
								data && (e.data = e.data || {}) && Object.assign(e.data, data);
								callback(e);
						});
				}
				off(eventName = UNDEF, callback = UNDEF) {
						if (eventName === UNDEF) {
								for (const element of this.filter(isEventTarget)) {
										const eventListenerMap = elementsEventMap.get(element) || emptyMap;
										for (const [eventName, listenerSet] of eventListenerMap) {
												for (const listener of listenerSet) {
														element.removeEventListener(eventName, listener);
												}
												listenerSet.clear();
										}
										eventListenerMap.clear();
										elementsEventMap.delete(element);
								}
								return this;
						}
						eventName = eventName.trim();
						const [elementEventName, eventKey] = eventName.split('.');
						if (callback === UNDEF) {
								for (const element of this.filter(isEventTarget)) {
										const eventListenerMap = elementsEventMap.get(element) || emptyMap;
										const listenerSet = eventListenerMap.get(eventName) || emptySet;
										for (const listener of listenerSet) {
												element.removeEventListener(elementEventName, listener);
										}
										listenerSet.clear();
										eventListenerMap.delete(eventName);
										for (const [key] of eventListenerMap) {
												if ((!eventKey && key.startsWith(`${elementEventName}.`)) ||
														(!elementEventName && key.endsWith(`.${eventKey}`))) {
														this.off(key);
												}
										}
								}
								return this;
						}
						for (const element of this.filter(isEventTarget)) {
								const eventListenerMap = elementsEventMap.get(element) || new Map;
								eventListenerMap.set(eventName, (eventListenerMap.get(eventName) || new Set));
								for (const [key, listenerSet] of eventListenerMap) {
										if (key !== eventName && !key.startsWith(`${elementEventName}.`)) {
												continue;
										}
										if (!listenerSet.has(callback)) {
												continue;
										}
										listenerSet.delete(callback);
										element.removeEventListener(elementEventName, callback);
								}
						}
						return this;
				}
				_setAttribute(key, val = UNDEF) {
						const htmls = this.getHtmls();
						if (val === null || val === '' || val === UNDEF) {
								for (const e of htmls) {
										e.removeAttribute(key);
								}
						}
						else {
								for (const e of htmls) {
										e.setAttribute(key, val);
								}
						}
						return this;
				}
				setAttribute(key, val = UNDEF) {
						if (typeof key === 'string') {
								return this._setAttribute(key, val);
						}
						for (const k of Object.keys(key)) {
								this._setAttribute(k, key[k]);
						}
						return this;
				}
				attr(key, val = UNDEF) {
						if (val !== UNDEF || typeof key === 'object') {
								return this.setAttribute(key, val);
						}
						const found = this.find((e) => e.hasAttribute && e.hasAttribute(key));
						return found ? found.getAttribute(key) : null;
				}
				data(key, val = UNDEF) {
						if (typeof key === 'object') {
								for (const k of Object.keys(key)) {
										this.data(k, key[k]);
								}
								return this;
						}
						key = `data-${toSnake(key)}`;
						if (val !== UNDEF) {
								return this.setAttribute(key, JSON.stringify(val));
						}
						const found = this.find((e) => e.hasAttribute && e.hasAttribute(key));
						if (!found) {
								return null;
						}
						const attr = found.getAttribute(key);
						try {
								return JSON.parse(attr);
						}
						catch (e) {
								return attr;
						}
				}
				prop(key, val = UNDEF) {
						if (typeof key === 'object') {
								for (const k of Object.keys(key)) {
										this.prop(k, key[k]);
								}
								return this;
						}
						else if (val !== UNDEF) {
								for (const elm of this) {
										elm[key] = val;
								}
								return this;
						}
						else {
								const found = this.find((e) => e.hasOwnProperty(key));
								return found ? found[key] : null;
						}
				}
				val(v = UNDEF) {
						const htmls = this.getHtmls();
						for (const elm of htmls) {
								if (!('value' in elm)) {
										continue;
								}
								if (v === UNDEF) {
										return elm.value;
								}
								else {
										elm.value = v;
								}
						}
						return v === UNDEF ? '' : this;
				}
				hasFocus() {
						return this.some(e => e === document.activeElement);
				}
				focus() {
						const fe = this.firstElement;
						if (fe) {
								fe.focus();
						}
						return this;
				}
				blur() {
						const htmls = this.getHtmls();
						for (const elm of htmls) {
								if (elm === document.activeElement) {
										elm.blur();
								}
						}
						return this;
				}
				insert(where, ...args) {
						const fn = this.firstNode;
						if (!fn) {
								return this;
						}
						if (args.every(a => typeof a === 'string' || isNode(a))) {
								fn[where](...args);
						}
						else {
								const $d = uQuery(...args);
								if ($d instanceof $Array) {
										fn[where](...$d.filter(a => typeof a === 'string' || isNode(a)));
								}
						}
						return this;
				}
				append(...args) {
						return this.insert('append', ...args);
				}
				appendChild(...args) {
						return this.append(...args);
				}
				prepend(...args) {
						return this.insert('prepend', ...args);
				}
				after(...args) {
						return this.insert('after', ...args);
				}
				before(...args) {
						return this.insert('before', ...args);
				}
				text(text = UNDEF) {
						const fn = this.firstNode;
						if (text !== UNDEF) {
								fn && (fn.textContent = text);
						}
						else {
								const elm = this.htmls.find(e => e.textContent);
								return elm ? elm.textContent : '';
						}
						return this;
				}
				appendTo(target) {
						if (typeof target === 'string') {
								const e = document.querySelector(target);
								e && e.append(...this.nodes);
						}
						else {
								target.append(...this.nodes);
						}
						return this;
				}
				prependTo(target) {
						if (typeof target === 'string') {
								const e = document.querySelector(target);
								e && e.prepend(...this.nodes);
						}
						else {
								target.prepend(...this.nodes);
						}
						return this;
				}
				remove() {
						for (const elm of this) {
								elm.remove && elm.remove();
						}
						return this;
				}
				show() {
						for (const elm of this) {
								elm.hidden = false;
						}
						return this;
				}
				hide() {
						for (const elm of this) {
								elm.hidden = true;
						}
						return this;
				}
				shadow(...args) {
						const elm = this.firstElement;
						if (!elm) {
								return this;
						}
						if (args.length === 0) {
								elm.shadowRoot || elm.attachShadow({ mode: 'open' });
								return new $Array(elm.shadowRoot);
						}
						const $d = uQuery(...args);
						if ($d instanceof $Array) {
								elm.shadowRoot || elm.attachShadow({ mode: 'open' });
								$d.appendTo(elm.shadowRoot);
								return $d;
						}
						return this;
				}
		}
		const uQuery = (q, ...args) => {
				const isTL = isTagLiteral(q, ...args);
				if (isTL || typeof q === 'string') {
						const query = isTL ? String.raw(q, ...args) : q;
						return query.startsWith('<') ?
								new $Array(createDom(q, ...args).children) :
								new $Array(document.querySelectorAll(query));
				}
				else if (q instanceof Window) {
						return $Array.from(q.document);
				}
				else if (q instanceof $Array) {
						return q.concat();
				}
				else if (q[Symbol.iterator]) {
						return $Array.from(q);
				}
				else if (isDocument(q)) {
						return $Array.from(q.documentElement);
				}
				else {
						return new $Array(q);
				}
		};
		Object.assign(uQuery, {
				$Array,
				createDom,
				html: (...args) => new $Array(createDom(...args).children),
				isTL: isTagLiteral,
				ready: (func = () => { }) => emitter.promise('domReady', waitForDom).then(() => func()),
				complete: (func = () => { }) => emitter.promise('domComplete', waitForComplete).then(() => func()),
				each: (arr, callback) => Array.from(arr).forEach((a, i) => callback.apply(a, [i, a])),
				proxy: (func, ...args) => func.bind(...args),
				fn: {}
		});
		return uQuery;
})();
const uq = uQuery;
        const $ = uq;
const css = (() => {
		const setPropsTask = [];
		const applySetProps = throttle.raf(() => {
				const tasks = setPropsTask.concat();
				setPropsTask.length = 0;
				for (const [element, prop, value] of tasks) {
						try {
								element.style.setProperty(prop, value);
						}
						catch (error) {
								console.warn('element.style.setProperty fail', { element, prop, value, error });
						}
				}
		});
		const css = {
				addStyle: (styles, option, document = window.document) => {
						const elm = Object.assign(document.createElement('style'), {
								type: 'text/css'
						}, typeof option === 'string' ? { id: option } : (option || {}));
						if (typeof option === 'string') {
								elm.id = option;
						}
						else if (option) {
								Object.assign(elm, option);
						}
						elm.classList.add(global.PRODUCT);
						elm.append(styles.toString());
						(document.head || document.body || document.documentElement).append(elm);
						elm.disabled = (option && option.disabled);
						elm.dataset.switch = elm.disabled ? 'off' : 'on';
						return elm;
				},
				registerProps(...args) {
						if (!CSS || !('registerProperty' in CSS)) {
								return;
						}
						for (const definition of args) {
								try {
										(definition.window || window).CSS.registerProperty(definition);
								}
								catch (err) {
										console.warn('CSS.registerProperty fail', definition, err);
								}
						}
				},
				setProps(...tasks) {
						setPropsTask.push(...tasks);
						return setPropsTask.length ? applySetProps() : Promise.resolve();
				},
				addModule: async function (func, options = {}) {
						if (!CSS || !('paintWorklet' in CSS)) {
								return;
						}
						if (this.modules.has(func)) {
								return this.modules.get(func);
						}
						const pending = (async () => {
								let url;
								try {
										const src = `(${func.toString()})(this, registerPaint,
						${JSON.stringify(options.config || {}, null, 2)});`;
										const blob = new Blob([src], { type: 'text/javascript' });
										url = URL.createObjectURL(blob);
										await CSS.paintWorklet.addModule(url);
										return true;
								}
								finally {
										if (url !== undefined) {
												URL.revokeObjectURL(url);
										}
								}
						})();
						this.modules.set(func, pending);
						try {
								return await pending;
						}
						catch (error) {
								this.modules.delete(func);
								throw error;
						}
				}.bind({ modules: new WeakMap }),
				escape: (value) => CSS.escape ? CSS.escape(value) : value.replace(/([\.#()[\]])/g, '\\$1'),
				number: (value) => CSS.number ? CSS.number(value) : value,
				s: (value) => CSS.s ? CSS.s(value) : `${value}s`,
				ms: (value) => CSS.ms ? CSS.ms(value) : `${value}ms`,
				pt: (value) => CSS.pt ? CSS.pt(value) : `${value}pt`,
				px: (value) => CSS.px ? CSS.px(value) : `${value}px`,
				percent: (value) => CSS.percent ? CSS.percent(value) : `${value}%`,
				vh: (value) => CSS.vh ? CSS.vh(value) : `${value}vh`,
				vw: (value) => CSS.vw ? CSS.vw(value) : `${value}vw`,
				trans: (value) => self.CSSStyleValue ? CSSStyleValue.parse('transform', value) : value,
				word: (value) => self.CSSKeywordValue ? new CSSKeywordValue(value) : value,
				image: (value) => self.CSSStyleValue ? CSSStyleValue.parse('background-image', value) : value,
		};
		return css;
})();
const cssUtil = css;
// already required
/*
* Task 077 / 077b / 077c: 画面フィルター（バックログ D-34）
*
* 動画の映像だけに、明るさ・コントラスト・ガンマなどの補正を掛ける仕組み。
* コメント層やボタンには掛けない（.zenzaWatchVideoElement にだけ効かせる）。
*
* 【加工の方式（077c で高速化）】
*   色の処理（明るさ・コントラスト・彩度・暖色・色相・反転・色温度・色かぶり・着色）は、
*   すべて1枚の色変換行列（feColorMatrix）にまとめて1回で処理する。
*   明るさの曲線（黒/白レベル・ガンマ・自動レベル補正・着色の色）は、
*   1枚の対応表（feComponentTransfer、65点）にまとめて1回で処理する。
*   → 以前は CSS の brightness()…hue-rotate() を5段つないでいた。GPUなしの計測で
*     5段: 約38fps → 行列1枚: 約59fps（フィルターなし60fps）。
*   シャープはアンシャープマスク（ぼかした絵との差を足す）。周りの画素を見る処理なので
*   これだけは重い。ぼかしは CSS の blur()（SVGのぼかしより数倍速い）。
*   周辺減光は映像の上に影を重ねるだけ（処理はほぼゼロ）。
*
* 左右反転・上下反転（旧 toggle-flipH / toggle-flipV）もここで設定を持つが、
* 見た目の反映は今まで通り transform（.is-flipH / .is-flipV クラス）で行う。
*
* 設定は Config の 'screenFilter.*' に保存する（全部の動画で共通・次回も残る）。
* ただし反転だけは従来通り「ページを開き直すと元に戻る」（initialize で OFF に戻す）。
*
* スクリーンショット・コメント付きPiP は canvas に描き直しているため、
* drawVideo() / processCanvas() で同じ加工を canvas にも掛ける（ctx.filter）。
* 通常の P in P はブラウザが <video> をそのまま小窓に出すので加工できない。
*
* Task 080: 「使う」ON/OFF を廃止した。プリセット「標準」（全部が既定値）の時が OFF、
* それ以外は自動で ON。標準の時は filter: none・SVGなし・タイマーなし・影の要素なしで、
* 何も処理しない（077c で確認済みの作りのまま）。以前「使う」を OFF にしていた人は、
* 初回に値を「標準」へ戻し、元の値は ON/OFF ショートカット用に保存しておく（移行）。
* 「押している間だけ元の映像」は廃止し、画面の左半分だけ元の映像を重ねる比較モードにした。
*/
const ScreenFilter = (() => {
		const PREFIX = 'screenFilter.';
		const SVG_ID = 'zenzaScreenFilterSvg';
		const STYLE_ID = 'zenzaScreenFilterStyle';
		const CSS_VAR = '--zenza-screen-filter';
		const VIGNETTE_CLASS = 'zenzaScreenFilterVignette';
		/*
		* 調整項目の一覧。設定パネル（プレイヤー内のフィルターパネル・上級者用設定）の
		* 表示もこの配列から作るので、項目を足す時はここに1つ足せばよい。
		*   group: 'basic' 色と明るさ / 'tone' 明暗の細かい調整 / 'style' 雰囲気
		*   heavy: true … 周りの画素を見る処理で重い（説明に書く）
		*/
		const PARAMS = [
				{
						key: 'brightness', label: '明るさ', group: 'basic',
						min: 0, max: 200, step: 1, def: 100, unit: '%',
						desc: '画面全体を明るく／暗くします。上げすぎると明るい所が真っ白に飛びます。' +
								'暗い動画を見やすくしたい時は、下の「ガンマ」の方が自然に明るくなります。'
				},
				{
						key: 'contrast', label: 'コントラスト', group: 'basic',
						min: 0, max: 200, step: 1, def: 100, unit: '%',
						desc: '明るい所と暗い所の差の強さです。上げるとメリハリが出てくっきり、' +
								'下げると柔らかい（眠たい）感じになります。'
				},
				{
						key: 'saturate', label: '彩度（色の濃さ）', group: 'basic',
						min: 0, max: 300, step: 1, def: 100, unit: '%',
						desc: '色の濃さです。0 で白黒、100 が元のまま、上げると色が鮮やかになります。'
				},
				{
						key: 'temperature', label: '色温度', group: 'basic',
						min: -100, max: 100, step: 1, def: 0, unit: '', signed: true,
						desc: 'マイナスで青っぽく（涼しい感じ）、プラスでオレンジっぽく（暖かい感じ）なります。' +
								'夜は少しプラスにすると目に優しくなります。'
				},
				{
						key: 'tint', label: '色かぶり補正', group: 'basic',
						min: -100, max: 100, step: 1, def: 0, unit: '', signed: true,
						desc: '映像が緑っぽい時はプラス（赤紫の方向へ）、赤紫っぽい時はマイナス（緑の方向へ）に動かすと自然な色に戻ります。'
				},
				{
						key: 'hue', label: '色相（色のずらし）', group: 'basic',
						min: -180, max: 180, step: 1, def: 0, unit: '°',
						desc: 'すべての色を虹の順番にずらします（例: 赤→黄→緑…）。普段は 0 のままで大丈夫です。' +
								'遊びや、見分けにくい色がある時の補助に。'
				},
				{
						key: 'sepia', label: 'セピア', group: 'basic',
						min: 0, max: 100, step: 1, def: 0, unit: '%',
						desc: '古い写真のような茶色っぽい色味に寄せます。色温度より色が抜けた感じになります。'
				},
				{
						key: 'invert', label: '階調反転（ネガ）', group: 'basic', type: 'boolean', def: false,
						desc: '明るい所と暗い所を入れ替えます（写真のネガのような見た目）。' +
								'白い背景の資料動画を暗くしたい時は、プリセットの「反転（暗転）」を選ぶと色味が保たれます。'
				},
				{
						key: 'gamma', label: 'ガンマ（中間の明るさ）', group: 'tone',
						min: 0.3, max: 3.0, step: 0.01, def: 1.0, unit: '', digits: 2,
						desc: '真っ黒・真っ白はそのままに、中くらいの明るさだけを持ち上げ／下げます。' +
								'1 より大きくすると、白飛びさせずに暗い部分が見えやすくなります。暗い動画にいちばん効く項目です。'
				},
				{
						key: 'blackLevel', label: '黒レベル', group: 'tone',
						min: -50, max: 50, step: 1, def: 0, unit: '', signed: true,
						desc: 'いちばん暗い部分の調整です。プラスにすると真っ黒な所が少し持ち上がって暗部が見えやすく' +
								'（そのぶん黒が灰色っぽく）なり、マイナスにすると黒が引き締まります。'
				},
				{
						key: 'whiteLevel', label: '白レベル', group: 'tone',
						min: -50, max: 50, step: 1, def: 0, unit: '', signed: true,
						desc: 'いちばん明るい部分の調整です。マイナスにすると白が少し抑えられて、まぶしさ・白飛びが和らぎます。' +
								'プラスにすると明るい部分がより明るくなります。'
				},
				{
						key: 'autoLevels', label: '自動レベル補正', group: 'tone', type: 'boolean', def: false,
						desc: '動画ごとに、いちばん暗い所が黒・いちばん明るい所が白になるよう自動で合わせます（0.5秒ごとに少しずつ）。' +
								'白っぽくかすんだ動画や、全体が暗い動画に効きます。処理はとても軽いです。'
				},
				{
						key: 'sharpen', label: 'シャープ（輪郭の強調）', group: 'tone', heavy: true,
						min: 0, max: 100, step: 1, def: 0, unit: '',
						desc: '輪郭をくっきりさせます。ぼやけた低画質の動画に。20〜40 くらいがおすすめです。' +
								'周りの画素を調べる処理なので、この項目だけは少し重めです（グラフィックボードの無いパソコンで動画がカクつく時は 0 に）。'
				},
				{
						key: 'blur', label: 'ぼかし', group: 'style',
						min: 0, max: 20, step: 0.1, def: 0, unit: 'px',
						desc: '映像をぼかします。ブロックノイズやチラつきが気になる時は 1 前後、はっきりぼかしたい時は 5 以上に。' +
								'画面上の大きさ（ピクセル）で効くので、大きな画面ほど強めにすると同じ見え方になります。'
				},
				{
						key: 'vignette', label: '周辺減光', group: 'style',
						min: 0, max: 100, step: 1, def: 0, unit: '%',
						desc: '画面の周りをだんだん暗くして、映画やカメラのような雰囲気にします。映像の上に影を重ねるだけなので、処理はほぼゼロです。'
				},
				{
						key: 'colorize', label: '着色（モノトーン）', group: 'style', type: 'select', def: 'none',
						options: [
								['none', 'なし'],
								['gold', 'ゴールド'],
								['sepia', 'セピア（古写真）'],
								['blue', 'ブルー'],
								['green', 'グリーン（暗視カメラ風）']
						],
						desc: '映像をいったん白黒にして、選んだ色のグラデーションで塗り直します。' +
								'ゴールドは金属っぽい高級感、セピアは古い写真、グリーンは暗視カメラのような見た目になります。'
				}
		];
		const PARAM_MAP = PARAMS.reduce((map, p) => { map[p.key] = p; return map; }, {});
		const DEFAULTS = PARAMS.reduce((map, p) => { map[p.key] = p.def; return map; }, {});
		/*
		* プリセット。values に書いていない項目は既定値に戻る（前のプリセットの値が残らない）。
		* 反転（左右・上下）とフィルターの ON/OFF はプリセットでは変えない。
		*/
		const PRESETS = [
				{ id: 'standard', label: '標準', values: {},
						desc: 'すべて元のまま（フィルターなし）。' },
				{ id: 'dark', label: '暗い動画を見やすく', values: { gamma: 1.35, blackLevel: 4, contrast: 105 },
						desc: '夜のシーンや古い実況動画など、暗くて見えにくい動画向け。白飛びさせずに暗い所を持ち上げます。' },
				{ id: 'sharp', label: 'くっきり', values: { contrast: 112, saturate: 110, sharpen: 30 },
						desc: 'ぼやけた低画質の動画向け。輪郭とメリハリを強めます。輪郭の強調を使うので少しだけ重めです。' },
				{ id: 'vivid', label: 'ビビッド', values: { saturate: 135, contrast: 108 },
						desc: 'アニメやゲーム実況の色を鮮やかに。' },
				{ id: 'faded', label: '色あせ補正', values: { saturate: 130, contrast: 110, autoLevels: true },
						desc: '古い動画や色の薄い動画向け。色を濃くし、明るさの範囲も自動で合わせます。' },
				{ id: 'cinema', label: 'シネマ（銀残し風）', values: { saturate: 55, contrast: 120, gamma: 0.92, vignette: 35 },
						desc: '映画でよく使われる「銀残し」風。色を抜いて硬めの階調にし、周りを少し暗くします。' },
				{ id: 'film', label: 'フィルム（レトロ）', values: { saturate: 80, blackLevel: 7, whiteLevel: -6, temperature: 12 },
						desc: '黒を少し浮かせて白を抑え、色を少し抜いた、昔のフィルムのような柔らかい見た目。' },
				{ id: 'pastel', label: 'パステル', values: { saturate: 70, blackLevel: 14, contrast: 90, gamma: 1.1 },
						desc: '明るく淡い色合いに。' },
				{ id: 'cool', label: '寒色', values: { temperature: -35 },
						desc: '青っぽく涼しい色合いに。' },
				{ id: 'warm', label: '暖色', values: { temperature: 35 },
						desc: 'オレンジっぽく暖かい色合いに。' },
				{ id: 'eyeCare', label: '目に優しい（夜）', values: { brightness: 85, saturate: 90, temperature: 30 },
						desc: '暗い部屋で見る時向け。少し暗く、暖かい色にして青い光を減らします。' },
				{ id: 'gold', label: 'ゴールド', values: { colorize: 'gold', contrast: 105 },
						desc: '明るさを金色のグラデーションに置き換えます（黄金質・金属質のような見た目）。' },
				{ id: 'mono', label: '白黒', values: { saturate: 0 },
						desc: '色を抜いて白黒にします。雰囲気づくりや、色のチカチカが気になる時に。' },
				{ id: 'monoHigh', label: '白黒（硬調）', values: { saturate: 0, contrast: 135 },
						desc: 'コントラストの強い白黒。' },
				{ id: 'invert', label: '反転（暗転）', values: { invert: true, hue: 180 },
						desc: '白い背景の資料動画などを暗い画面にします（色味はなるべく保ったまま明暗だけ反転）。' }
		];
		const PRESET_MAP = PRESETS.reduce((map, p) => { map[p.id] = p; return map; }, {});
		/* 着色（colorize）のグラデーション。暗い所→明るい所の順の色（0〜1） */
		const COLORIZE_MAPS = {
				gold: [[0.08, 0.04, 0.01], [0.45, 0.28, 0.08], [0.85, 0.62, 0.25], [1, 0.9, 0.6]],
				sepia: [[0.1, 0.06, 0.03], [0.45, 0.33, 0.2], [0.8, 0.68, 0.5], [1, 0.95, 0.85]],
				blue: [[0.02, 0.05, 0.12], [0.15, 0.3, 0.55], [0.5, 0.7, 0.9], [0.9, 0.97, 1]],
				green: [[0, 0.05, 0], [0.1, 0.45, 0.1], [0.4, 0.85, 0.35], [0.85, 1, 0.8]]
		};
		let config = null;
		let bypass = false;
		let applyScheduled = false;
		let lastCss = null;
		let lastSvgKey = null;
		let lastVignette = null;
		const listeners = new Set();
		const auto = { black: 0, white: 1, available: true, timer: null, canvas: null };
		const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
		const digitsOf = (p) => p.digits !== undefined ? p.digits : (String(p.step).split('.')[1] || '').length;
		const normalize = (key, value) => {
				const p = PARAM_MAP[key];
				if (!p) {
						return value;
				}
				if (p.type === 'boolean') {
						return value === true || value === 'true';
				}
				if (p.type === 'select') {
						return p.options.some(([v]) => v === value) ? value : p.def;
				}
				let v = parseFloat(value);
				if (!isFinite(v)) {
						v = p.def;
				}
				v = clamp(v, p.min, p.max);
				return parseFloat(v.toFixed(digitsOf(p)));
		};
		const prop = (key) => config && config.props ? config.props[PREFIX + key] : undefined;
		const setProp = (key, value) => {
				if (!config || !config.props) {
						return;
				}
				if (config.props[PREFIX + key] !== value) {
						config.props[PREFIX + key] = value;
				}
		};
		const read = () => {
				const values = {};
				PARAMS.forEach(p => { values[p.key] = normalize(p.key, prop(p.key)); });
				return values;
		};
		const isEnabled = () => true;
		const isDefaultValue = (key, value) => {
				const p = PARAM_MAP[key];
				if (p.type === 'boolean') {
						return !!value === !!p.def;
				}
				if (p.type === 'select') {
						return value === p.def;
				}
				return Math.abs(value - p.def) < 1e-6;
		};
		const sameValue = (p, a, b) => {
				if (p.type === 'boolean') {
						return !!a === !!b;
				}
				if (p.type === 'select') {
						return a === b;
				}
				return Math.abs(a - b) < 1e-6;
		};
		const detectPreset = (values = read()) => {
				const found = PRESETS.find(preset => PARAMS.every(p => {
						const target = preset.values[p.key] !== undefined ? preset.values[p.key] : p.def;
						return sameValue(p, values[p.key], target);
				}));
				return found ? found.id : 'custom';
		};
		const isActive = (values = read()) => isEnabled() && PARAMS.some(p => !isDefaultValue(p.key, values[p.key]));
		const IDENTITY = [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0]];
		const compose = (a, b) => {
				const r = [];
				for (let i = 0; i < 3; i++) {
						r.push([0, 1, 2].map(j => b[i][0] * a[0][j] + b[i][1] * a[1][j] + b[i][2] * a[2][j])
								.concat(b[i][0] * a[0][3] + b[i][1] * a[1][3] + b[i][2] * a[2][3] + b[i][3]));
				}
				return r;
		};
		const diag = (r, g, b, o = 0) => [[r, 0, 0, o], [0, g, 0, o], [0, 0, b, o]];
		const saturateMatrix = (s) => [
				[0.213 + 0.787 * s, 0.715 - 0.715 * s, 0.072 - 0.072 * s, 0],
				[0.213 - 0.213 * s, 0.715 + 0.285 * s, 0.072 - 0.072 * s, 0],
				[0.213 - 0.213 * s, 0.715 - 0.715 * s, 0.072 + 0.928 * s, 0]
		];
		const sepiaMatrix = (a) => {
				const k = 1 - a;
				return [
						[0.393 + 0.607 * k, 0.769 - 0.769 * k, 0.189 - 0.189 * k, 0],
						[0.349 - 0.349 * k, 0.686 + 0.314 * k, 0.168 - 0.168 * k, 0],
						[0.272 - 0.272 * k, 0.534 - 0.534 * k, 0.131 + 0.869 * k, 0]
				];
		};
		const hueMatrix = (deg) => {
				const r = deg * Math.PI / 180, c = Math.cos(r), s = Math.sin(r);
				return [
						[0.213 + c * 0.787 - s * 0.213, 0.715 - c * 0.715 - s * 0.715, 0.072 - c * 0.072 + s * 0.928, 0],
						[0.213 - c * 0.213 + s * 0.143, 0.715 + c * 0.285 + s * 0.140, 0.072 - c * 0.072 - s * 0.283, 0],
						[0.213 - c * 0.213 - s * 0.787, 0.715 - c * 0.715 + s * 0.715, 0.072 + c * 0.928 + s * 0.072, 0]
				];
		};
		const LUMA = [0.2126, 0.7152, 0.0722];
		const buildColorMatrix = (values) => {
				let m = IDENTITY, changed = false;
				const add = (x) => { m = compose(m, x); changed = true; };
				if (!isDefaultValue('brightness', values.brightness)) {
						const b = values.brightness / 100;
						add(diag(b, b, b));
				}
				if (!isDefaultValue('contrast', values.contrast)) {
						const c = values.contrast / 100;
						add(diag(c, c, c, 0.5 - 0.5 * c));
				}
				if (!isDefaultValue('saturate', values.saturate)) {
						add(saturateMatrix(values.saturate / 100));
				}
				if (!isDefaultValue('sepia', values.sepia)) {
						add(sepiaMatrix(values.sepia / 100));
				}
				if (!isDefaultValue('hue', values.hue)) {
						add(hueMatrix(values.hue));
				}
				if (values.invert) {
						add(diag(-1, -1, -1, 1));
				}
				if (!isDefaultValue('temperature', values.temperature) || !isDefaultValue('tint', values.tint)) {
						const t = values.temperature / 100, n = values.tint / 100;
						add(diag(1 + 0.10 * t + 0.04 * n, 1 - 0.12 * n, 1 - 0.15 * t + 0.04 * n));
				}
				if (values.colorize !== 'none') {
						add([LUMA.concat(0), LUMA.concat(0), LUMA.concat(0)]);
				}
				return changed ? m : null;
		};
		const levelsToLinear = (blackLevel, whiteLevel) => {
				const b = blackLevel / 100, w = whiteLevel / 100;
				const inBlack = b < 0 ? -b : 0, outBlack = b > 0 ? b : 0;
				const inWhite = w > 0 ? 1 - w : 1, outWhite = w < 0 ? 1 + w : 1;
				const slope = (outWhite - outBlack) / Math.max(0.01, inWhite - inBlack);
				const intercept = outBlack - slope * inBlack;
				return { slope: +slope.toFixed(4), intercept: +intercept.toFixed(4) };
		};
		const TONE_TABLE_SIZE = 65;
		const lerpColor = (stops, x, ch) => {
				const pos = clamp(x, 0, 1) * (stops.length - 1);
				const i = Math.min(stops.length - 2, Math.floor(pos));
				const f = pos - i;
				return stops[i][ch] * (1 - f) + stops[i + 1][ch] * f;
		};
		const useAutoLevels = (values) => values.autoLevels && auto.available &&
				(auto.black > 0.004 || auto.white < 0.996);
		const buildToneTables = (values) => {
				const levels = !isDefaultValue('blackLevel', values.blackLevel) || !isDefaultValue('whiteLevel', values.whiteLevel);
				const gamma = !isDefaultValue('gamma', values.gamma);
				const colorize = values.colorize !== 'none' && COLORIZE_MAPS[values.colorize];
				const autoOn = useAutoLevels(values);
				if (!levels && !gamma && !colorize && !autoOn) {
						return null;
				}
				const { slope, intercept } = levelsToLinear(values.blackLevel, values.whiteLevel);
				const exponent = 1 / values.gamma;
				const tables = [[], [], []];
				for (let i = 0; i < TONE_TABLE_SIZE; i++) {
						let x = i / (TONE_TABLE_SIZE - 1);
						if (autoOn) {
								x = clamp((x - auto.black) / Math.max(0.05, auto.white - auto.black), 0, 1);
						}
						x = clamp(slope * x + intercept, 0, 1);
						x = Math.pow(x, exponent);
						for (let ch = 0; ch < 3; ch++) {
								tables[ch].push(+(colorize ? lerpColor(colorize, x, ch) : x).toFixed(4));
						}
				}
				return tables.map((t) => t.join(' '));
		};
		/*
		* シャープ: アンシャープマスク。出力 = (1 + a) × 元の絵 − a × ぼかした絵。
		* a = シャープ/100 × 6（シャープ25で a=1.5。077 の3×3畳み込みと同じくらいの効き）。
		* 077b は a = シャープ/100 × 2 で、効きが弱すぎた（077c で修正）。
		*/
		const SHARPEN_GAIN = 6;
		const buildSvgFilterMarkup = (values) => {
				const parts = [];
				let input = 'SourceGraphic';
				const m = buildColorMatrix(values);
				if (m) {
						const v = m.map(row => [row[0], row[1], row[2], 0, row[3]].map(n => +n.toFixed(5)).join(' ')).join('  ');
						parts.push(`<feColorMatrix type="matrix" values="${v}  0 0 0 1 0" result="sfColor"/>`);
						input = 'sfColor';
				}
				const tables = buildToneTables(values);
				if (tables) {
						const f = (ch, i) => `<feFunc${ch} type="table" tableValues="${tables[i]}"/>`;
						parts.push(`<feComponentTransfer in="${input}" result="sfTone">${f('R', 0)}${f('G', 1)}${f('B', 2)}</feComponentTransfer>`);
						input = 'sfTone';
				}
				if (!isDefaultValue('sharpen', values.sharpen)) {
						const amount = +(values.sharpen / 100 * SHARPEN_GAIN).toFixed(3);
						parts.push(`<feGaussianBlur in="${input}" stdDeviation="0.6" result="sfBlur"/>`);
						parts.push(`<feComposite in="${input}" in2="sfBlur" operator="arithmetic" k1="0" k2="${+(1 + amount).toFixed(3)}" k3="${-amount}" k4="0"/>`);
				}
				return parts.join('');
		};
		const ensureSvg = (markup) => {
				if (typeof document === 'undefined') {
						return;
				}
				if (markup === lastSvgKey && document.getElementById(SVG_ID)) {
						return;
				}
				lastSvgKey = markup;
				let svg = document.getElementById(`${SVG_ID}-root`);
				if (!svg) {
						svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
						svg.id = `${SVG_ID}-root`;
						svg.setAttribute('aria-hidden', 'true');
						svg.setAttribute('width', '0');
						svg.setAttribute('height', '0');
						svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none;';
						(document.body || document.documentElement).append(svg);
				}
				svg.innerHTML =
						`<filter id="${SVG_ID}" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">${markup}</filter>`;
		};
		const buildFilter = (values = read(), { enabled = isEnabled() } = {}) => {
				if (!enabled) {
						return 'none';
				}
				const list = [];
				const markup = buildSvgFilterMarkup(values);
				if (markup) {
						ensureSvg(markup);
						list.push(`url(#${SVG_ID})`);
				}
				if (!isDefaultValue('blur', values.blur)) {
						list.push(`blur(${values.blur}px)`);
				}
				return list.length ? list.join(' ') : 'none';
		};
		const vignetteAlpha = (values = read()) => (!isEnabled() || bypass) ? 0 : +(values.vignette / 100 * 0.85).toFixed(3);
		const vignetteBackground = (alpha) => `radial-gradient(ellipse at center, rgba(0,0,0,0) 45%, rgba(0,0,0,${alpha}) 100%)`;
		const ensureStyle = () => {
				if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) {
						return;
				}
				const style = document.createElement('style');
				style.id = STYLE_ID;
				style.textContent = `
			.zenzaWatchVideoElement {
				filter: var(${CSS_VAR}, none);
			}
			.${VIGNETTE_CLASS} {
				position: absolute;
				top: 0; left: 0; right: 0; bottom: 0;
				z-index: 6;
				pointer-events: none;
				display: none;
			}
			.${VIGNETTE_CLASS}.is-active {
				display: block;
			}
		`;
				(document.head || document.documentElement).append(style);
		};
		/* 周辺減光: 動画要素のすぐ後ろ（同じ親の中）に影の要素を置く。コメントより下になる */
		const applyVignette = (alpha) => {
				if (typeof document === 'undefined') {
						return;
				}
				const key = String(alpha);
				const videos = document.querySelectorAll('.zenzaWatchVideoElement');
				videos.forEach(video => {
						const parent = video.parentNode;
						if (!parent) {
								return;
						}
						let el = parent.querySelector(`:scope > .${VIGNETTE_CLASS}`);
						if (!el) {
								if (!alpha) {
										return;
								}
								el = document.createElement('div');
								el.className = VIGNETTE_CLASS;
								video.after(el);
						}
						el.classList.toggle('is-active', alpha > 0);
						if (alpha > 0) {
								el.style.background = vignetteBackground(alpha);
						}
				});
				lastVignette = key;
		};
		const emitChange = () => {
				listeners.forEach(fn => {
						try {
								fn();
						}
						catch (e) {
								window.console.warn('ScreenFilter listener error', e);
						}
				});
		};
		const apply = (values = read(), { notify = true } = {}) => {
				applyScheduled = false;
				if (typeof document === 'undefined') {
						return 'none';
				}
				ensureStyle();
				const css = bypass ? 'none' : buildFilter(values);
				if (css !== lastCss) {
						lastCss = css;
						document.documentElement.style.setProperty(CSS_VAR, css);
				}
				applyVignette(vignetteAlpha(values));
				updateAutoLevelsTimer(values);
				notify && emitChange();
				return css;
		};
		const scheduleApply = () => {
				if (applyScheduled) {
						return;
				}
				applyScheduled = true;
				Promise.resolve().then(() => apply());
		};
		const AUTO_W = 64, AUTO_H = 36;
		const sampleAutoLevels = () => {
				if (!isEnabled() || bypass) {
						return;
				}
				const video = document.querySelector('.zenzaWatchVideoElement');
				if (!video || video.paused || video.readyState < 2 || !video.videoWidth) {
						return;
				}
				try {
						if (!auto.canvas) {
								auto.canvas = document.createElement('canvas');
								auto.canvas.width = AUTO_W;
								auto.canvas.height = AUTO_H;
								auto.ctx = auto.canvas.getContext('2d', { willReadFrequently: true });
						}
						const ctx = auto.ctx;
						ctx.drawImage(video.drawableElement || video, 0, 0, AUTO_W, AUTO_H);
						const data = ctx.getImageData(0, 0, AUTO_W, AUTO_H).data;
						const hist = new Uint32Array(256);
						for (let i = 0; i < data.length; i += 4) {
								hist[(data[i] * 54 + data[i + 1] * 183 + data[i + 2] * 19) >> 8]++;
						}
						const total = AUTO_W * AUTO_H, cut = total * 0.005;
						let low = 0, high = 255, acc = 0;
						for (let i = 0; i < 256; i++) {
								acc += hist[i];
								if (acc > cut) {
										low = i;
										break;
								}
						}
						acc = 0;
						for (let i = 255; i >= 0; i--) {
								acc += hist[i];
								if (acc > cut) {
										high = i;
										break;
								}
						}
						let b = Math.min(low / 255, 0.25), w = Math.max(high / 255, 0.75);
						if (w - b < 0.4) {
								return;
						}
						b = auto.black * 0.7 + b * 0.3;
						w = auto.white * 0.7 + w * 0.3;
						if (Math.abs(b - auto.black) < 0.004 && Math.abs(w - auto.white) < 0.004) {
								return;
						}
						auto.black = b;
						auto.white = w;
						apply(read(), { notify: false });
				}
				catch (e) {
						auto.available = false;
						window.console.warn('ScreenFilter: 自動レベル補正はこの映像では使えません', e && e.name);
						stopAutoLevels();
						emitChange();
				}
		};
		const stopAutoLevels = () => {
				if (auto.timer) {
						clearInterval(auto.timer);
						auto.timer = null;
				}
		};
		const updateAutoLevelsTimer = (values) => {
				const want = values.autoLevels && isEnabled() && auto.available && typeof window !== 'undefined';
				if (want && !auto.timer) {
						auto.timer = setInterval(sampleAutoLevels, 500);
				}
				else if (!want && auto.timer) {
						stopAutoLevels();
						auto.black = 0;
						auto.white = 1;
				}
		};
		const resetAutoLevels = () => {
				auto.black = 0;
				auto.white = 1;
				auto.available = true;
				scheduleApply();
		};
		const set = (key, value) => {
				if (!PARAM_MAP[key]) {
						return;
				}
				setProp(key, normalize(key, value));
				scheduleApply();
		};
		const preview = (key, value) => {
				const values = read();
				values[key] = normalize(key, value);
				apply(values, { notify: false });
		};
		const applyPreset = (id) => {
				const preset = PRESET_MAP[id];
				if (!preset) {
						return null;
				}
				PARAMS.forEach(p => {
						const v = preset.values[p.key] !== undefined ? preset.values[p.key] : p.def;
						setProp(p.key, normalize(p.key, v));
				});
				scheduleApply();
				return preset;
		};
		const reset = () => applyPreset('standard');
		const nextPreset = () => {
				const current = detectPreset();
				const index = PRESETS.findIndex(p => p.id === current);
				const next = PRESETS[(index + 1) % PRESETS.length];
				return applyPreset(next.id);
		};
		const formatValue = (key, value) => {
				const p = PARAM_MAP[key];
				if (!p) {
						return String(value);
				}
				if (p.type === 'boolean') {
						return value ? 'ON' : 'OFF';
				}
				if (p.type === 'select') {
						const o = p.options.find(([v]) => v === value);
						return o ? o[1] : String(value);
				}
				const text = Number(value).toFixed(digitsOf(p));
				return `${p.signed && value > 0 ? '+' : ''}${text}${p.unit || ''}`;
		};
		const adjust = (param) => {
				const [key, deltaText] = String(param || '').split(':');
				const p = PARAM_MAP[key];
				if (!p || p.type === 'boolean' || p.type === 'select') {
						return null;
				}
				const delta = parseFloat(deltaText) || 0;
				const next = normalize(key, normalize(key, prop(key)) + delta);
				setProp(key, next);
				scheduleApply();
				return { param: p, value: next };
		};
		const onOff = (v) => v ? 'ON' : 'OFF';
		const isStandard = (values = read()) => PARAMS.every(p => isDefaultValue(p.key, values[p.key]));
		const saveValues = (values) => {
				try {
						setProp('saved', JSON.stringify(values));
				}
				catch (e) { /* 保存できなくても動作は続ける */ }
		};
		const loadSaved = () => {
				const raw = prop('saved');
				if (!raw) {
						return null;
				}
				try {
						const v = typeof raw === 'string' ? JSON.parse(raw) : raw;
						return v && typeof v === 'object' ? v : null;
				}
				catch (e) {
						return null;
				}
		};
		const execCommand = (command, param) => {
				switch (command) {
						case 'toggle-screenFilter.enable': {
								const values = read();
								if (!isStandard(values)) {
										saveValues(values);
										applyPreset('standard');
										return 'エフェクト: OFF（標準に戻しました。もう一度押すと元の設定に戻ります）';
								}
								const saved = loadSaved();
								if (!saved) {
										return 'エフェクト: 標準のままです（戻す設定がありません）';
								}
								PARAMS.forEach(p => {
										setProp(p.key, normalize(p.key, saved[p.key] !== undefined ? saved[p.key] : p.def));
								});
								scheduleApply();
								const preset = PRESET_MAP[detectPreset()];
								return `エフェクト: ON（${preset ? preset.label : '手動で調整した設定'}）`;
						}
						case 'toggle-screenFilter.split': {
								const v = setSplit(!split.on);
								return v ? '画面フィルター: 左半分に元の映像を表示' : '画面フィルター: 比較表示をやめました';
						}
						case 'toggle-screenFilter.flipH': {
								const v = !prop('flipH');
								setProp('flipH', v);
								return `左右反転: ${onOff(v)}`;
						}
						case 'toggle-screenFilter.flipV': {
								const v = !prop('flipV');
								setProp('flipV', v);
								return `上下反転: ${onOff(v)}`;
						}
						case 'toggle-screenFilter.invert':
						case 'toggle-screenFilter.autoLevels': {
								const key = command.replace('toggle-screenFilter.', '');
								const v = !normalize(key, prop(key));
								set(key, v);
								return `${PARAM_MAP[key].label}: ${onOff(v)}`;
						}
						case 'screenFilter-preset': {
								const preset = applyPreset(param);
								if (!preset) {
										return null;
								}
								return `画面フィルター: ${preset.label}`;
						}
						case 'screenFilter-nextPreset': {
								const preset = nextPreset();
								return preset ? `画面フィルター: ${preset.label}` : null;
						}
						case 'screenFilter-reset':
								reset();
								return '画面フィルター: 標準に戻しました';
						case 'screenFilter-adjust': {
								const result = adjust(param);
								if (!result) {
										return null;
								}
								return `${result.param.label}: ${formatValue(result.param.key, result.value)}`;
						}
				}
				return null;
		};
		const isCanvasTarget = (target) => {
				const key = target === 'screenshot' ? 'applyToScreenshot' : 'applyToCommentPip';
				const v = prop(key);
				return v === undefined ? true : !!v;
		};
		const drawVideo = (ctx, source, dx, dy, w, h, { target = 'commentPip' } = {}) => {
				const use = isCanvasTarget(target);
				const filter = use && !bypass ? buildFilter() : 'none';
				const flipH = use && !!prop('flipH'), flipV = use && !!prop('flipV');
				ctx.save();
				if (filter !== 'none') {
						ctx.filter = filter;
				}
				if (flipH || flipV) {
						ctx.translate(dx + (flipH ? w : 0), dy + (flipV ? h : 0));
						ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
						ctx.drawImage(source, 0, 0, w, h);
				}
				else {
						ctx.drawImage(source, dx, dy, w, h);
				}
				ctx.restore();
				const alpha = use ? vignetteAlpha() : 0;
				if (alpha > 0) {
						const cx = dx + w / 2, cy = dy + h / 2;
						const g = ctx.createRadialGradient(cx, cy, Math.min(w, h) * 0.3, cx, cy, Math.hypot(w, h) / 2);
						g.addColorStop(0, 'rgba(0,0,0,0)');
						g.addColorStop(1, `rgba(0,0,0,${alpha})`);
						ctx.save();
						ctx.fillStyle = g;
						ctx.fillRect(dx, dy, w, h);
						ctx.restore();
				}
		};
		const processCanvas = (canvas, { target = 'screenshot' } = {}) => {
				if (!isCanvasTarget(target)) {
						return canvas;
				}
				const filter = bypass ? 'none' : buildFilter();
				if (filter === 'none' && !prop('flipH') && !prop('flipV') && !vignetteAlpha()) {
						return canvas;
				}
				const out = document.createElement('canvas');
				out.width = canvas.width;
				out.height = canvas.height;
				const ctx = out.getContext('2d');
				drawVideo(ctx, canvas, 0, 0, canvas.width, canvas.height, { target });
				return out;
		};
		const SPLIT_CLASS = 'zenzaScreenFilterSplit';
		const split = { on: false, raf: 0, canvas: null, ctx: null, lastKey: '' };
		const hideSplitCanvas = () => {
				if (split.canvas) {
						split.canvas.style.display = 'none';
				}
				split.lastKey = '';
		};
		const drawSplit = () => {
				split.raf = 0;
				if (!split.on || typeof document === 'undefined') {
						return;
				}
				split.raf = requestAnimationFrame(drawSplit);
				const video = document.querySelector('.zenzaWatchVideoElement');
				const src = video && (video.drawableElement || video);
				const parent = video && video.parentNode;
				if (!src || !parent || !src.videoWidth || src.readyState < 2 || isStandard()) {
						hideSplitCanvas();
						return;
				}
				let canvas = split.canvas;
				if (!canvas || canvas.parentNode !== parent) {
						canvas = split.canvas || document.createElement('canvas');
						canvas.className = SPLIT_CLASS;
						canvas.style.cssText = 'position:absolute;z-index:7;pointer-events:none;';
						video.after(canvas);
						split.canvas = canvas;
						split.ctx = canvas.getContext('2d');
				}
				const vw = src.videoWidth, vh = src.videoHeight;
				const ew = video.offsetWidth, eh = video.offsetHeight;
				if (!ew || !eh) {
						hideSplitCanvas();
						return;
				}
				const scale = Math.min(ew / vw, eh / vh);
				const cw = vw * scale, ch = vh * scale;
				const left = video.offsetLeft + (ew - cw) / 2, top = video.offsetTop + (eh - ch) / 2;
				const flipH = !!prop('flipH'), flipV = !!prop('flipV');
				const key = [src.currentTime, left, top, cw, ch, flipH, flipV].join(',');
				if (key === split.lastKey && canvas.style.display !== 'none') {
						return;
				}
				split.lastKey = key;
				const dpr = Math.min(window.devicePixelRatio || 1, 2);
				const w = Math.max(1, Math.round(Math.min(cw * dpr, vw)));
				const h = Math.max(1, Math.round(Math.min(ch * dpr, vh)));
				if (canvas.width !== w || canvas.height !== h) {
						canvas.width = w;
						canvas.height = h;
				}
				Object.assign(canvas.style, {
						display: 'block', left: `${left}px`, top: `${top}px`, width: `${cw}px`, height: `${ch}px`
				});
				const ctx = split.ctx;
				const half = Math.round(w / 2);
				ctx.clearRect(0, 0, w, h);
				ctx.save();
				ctx.beginPath();
				ctx.rect(0, 0, half, h);
				ctx.clip();
				ctx.translate(flipH ? w : 0, flipV ? h : 0);
				ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
				ctx.drawImage(src, 0, 0, w, h);
				ctx.restore();
				ctx.fillStyle = 'rgba(255,255,255,0.85)';
				ctx.fillRect(half - 1, 0, 2, h);
				const fs = Math.max(11, Math.round(h / 30));
				ctx.font = `bold ${fs}px sans-serif`;
				ctx.textBaseline = 'top';
				const label = (text, x, align) => {
						ctx.textAlign = align;
						ctx.lineWidth = Math.max(2, fs / 5);
						ctx.strokeStyle = 'rgba(0,0,0,0.8)';
						ctx.strokeText(text, x, fs * 0.6);
						ctx.fillStyle = '#fff';
						ctx.fillText(text, x, fs * 0.6);
				};
				label('元の映像', half - fs * 0.6, 'right');
				label('エフェクト', half + fs * 0.6, 'left');
		};
		const setSplit = (v) => {
				split.on = !!v;
				if (split.on) {
						!split.raf && (split.raf = requestAnimationFrame(drawSplit));
				}
				else {
						split.raf && cancelAnimationFrame(split.raf);
						split.raf = 0;
						hideSplitCanvas();
				}
				emitChange();
				return split.on;
		};
		const initialize = (playerConfig) => {
				if (config === playerConfig) {
						return;
				}
				config = playerConfig;
				if (prop('enable') === false) {
						const values = read();
						if (!isStandard(values)) {
								saveValues(values);
						}
						PARAMS.forEach(p => setProp(p.key, p.def));
						setProp('enable', true);
				}
				setProp('flipH', false);
				setProp('flipV', false);
				if (config && typeof config.on === 'function') {
						config.on('update', (key) => {
								if (typeof key === 'string' && key.startsWith(PREFIX)) {
										scheduleApply();
								}
						});
				}
				apply();
		};
		return {
				PREFIX,
				PARAMS,
				PARAM_MAP,
				PRESETS,
				DEFAULTS,
				COLORIZE_MAPS,
				initialize,
				read,
				set,
				preview,
				apply,
				applyPreset,
				reset,
				nextPreset,
				adjust,
				detectPreset,
				isActive,
				buildFilter,
				buildSvgFilterMarkup,
				buildColorMatrix,
				buildToneTables,
				levelsToLinear,
				formatValue,
				normalize,
				execCommand,
				drawVideo,
				processCanvas,
				isEnabled,
				isStandard,
				setSplit,
				get isSplit() { return split.on; },
				resetAutoLevels,
				get autoLevelsAvailable() { return auto.available; },
				get flipH() { return !!prop('flipH'); },
				get flipV() { return !!prop('flipV'); },
				setBypass(v) {
						bypass = !!v;
						apply();
				},
				get bypass() { return bypass; },
				onChange(fn) {
						typeof fn === 'function' && listeners.add(fn);
						return () => listeners.delete(fn);
				},
				_reset() {
						config = null;
						bypass = false;
						lastCss = null;
						lastSvgKey = null;
						lastVignette = null;
						stopAutoLevels();
						auto.black = 0;
						auto.white = 1;
						auto.available = true;
						listeners.clear();
						split.on = false;
				}
		};
})();
/*
* プレイヤー内の「画面フィルター」パネル。
* 動画を見ながら調整できるよう、画面の右上に小さく出す（動画は隠さない）。
* 全画面の時は全画面の要素の中へ、それ以外は body へ置く（全画面中も見えるように）。
*/
const ScreenFilterPanel = (() => {
		const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' }[c]));
		const CSS = `
		.zenzaScreenFilterPanel {
			position: fixed;
			top: 16px;
			right: 16px;
			width: 380px;
			max-width: calc(100vw - 32px);
			max-height: calc(100vh - 32px);
			overflow-y: auto;
			overscroll-behavior: contain;
			z-index: 6060000;
			display: none;
			box-sizing: border-box;
			padding: 12px 14px 14px;
			border-radius: 10px;
			border: 1px solid rgba(255, 255, 255, 0.2);
			background: rgba(24, 24, 28, 0.9);
			box-shadow: 0 4px 20px rgba(0, 0, 0, 0.6);
			color: #ddd;
			font-size: 12px;
			line-height: 1.5;
			text-align: left;
			font-family: 'Hiragino Sans', 'Yu Gothic UI', 'Meiryo', sans-serif;
			user-select: none;
		}
		.zenzaScreenFilterPanel.is-open {
			display: block;
			/* Task 080: 開く時のアニメーション。右下（エフェクトボタンの方向）から、
				少し縮んだ状態でふわっと広がる */
			transform-origin: var(--sf-origin, 100% 100%);
			animation: zenzaScreenFilterPanelIn 0.22s cubic-bezier(0.2, 0.9, 0.3, 1.15) both;
		}
		.zenzaScreenFilterPanel.is-open.is-closing {
			pointer-events: none;
			animation: zenzaScreenFilterPanelOut 0.16s ease-in both;
		}
		@keyframes zenzaScreenFilterPanelIn {
			from { opacity: 0; transform: translate(12px, 18px) scale(0.86); filter: blur(2px); }
			to   { opacity: 1; transform: none; filter: none; }
		}
		@keyframes zenzaScreenFilterPanelOut {
			from { opacity: 1; transform: none; }
			to   { opacity: 0; transform: translate(8px, 12px) scale(0.92); }
		}
		@media (prefers-reduced-motion: reduce) {
			.zenzaScreenFilterPanel.is-open,
			.zenzaScreenFilterPanel.is-open.is-closing { animation-duration: 0.01s; }
		}
		.zenzaScreenFilterPanel .sfSection {
			animation: zenzaScreenFilterSectionIn 0.3s ease-out both;
		}
		.zenzaScreenFilterPanel .sfSection:nth-of-type(2) { animation-delay: 0.03s; }
		.zenzaScreenFilterPanel .sfSection:nth-of-type(3) { animation-delay: 0.06s; }
		.zenzaScreenFilterPanel .sfSection:nth-of-type(4) { animation-delay: 0.09s; }
		.zenzaScreenFilterPanel .sfSection:nth-of-type(5) { animation-delay: 0.12s; }
		@keyframes zenzaScreenFilterSectionIn {
			from { opacity: 0; transform: translateY(6px); }
			to   { opacity: 1; transform: none; }
		}
		.zenzaScreenFilterPanel button.is-on {
			background: #2d6a3e;
			border-color: #5fbf78;
			color: #fff;
		}
		.zenzaScreenFilterPanel * { box-sizing: border-box; }
		.zenzaScreenFilterPanel .sfHead {
			display: flex;
			align-items: center;
			gap: 8px;
			margin-bottom: 6px;
		}
		.zenzaScreenFilterPanel .sfTitle {
			font-size: 15px;
			font-weight: bold;
			color: #fff;
			flex: 1;
		}
		.zenzaScreenFilterPanel button {
			font-size: 12px;
			color: #eee;
			background: #3a3a44;
			border: 1px solid #555;
			border-radius: 4px;
			padding: 3px 8px;
			cursor: pointer;
		}
		.zenzaScreenFilterPanel button:hover { background: #4a4a58; }
		.zenzaScreenFilterPanel .sfClose {
			font-size: 16px;
			line-height: 1;
			padding: 2px 8px;
		}
		.zenzaScreenFilterPanel .sfIntro,
		.zenzaScreenFilterPanel .sfDesc,
		.zenzaScreenFilterPanel .sfNote {
			color: #aaa;
			font-size: 11px;
		}
		.zenzaScreenFilterPanel .sfSection {
			margin-top: 10px;
			padding-top: 8px;
			border-top: 1px solid rgba(255, 255, 255, 0.12);
		}
		.zenzaScreenFilterPanel .sfSectionTitle {
			font-weight: bold;
			color: #fff;
			margin-bottom: 2px;
		}
		.zenzaScreenFilterPanel .sfPresets {
			display: grid;
			grid-template-columns: repeat(2, 1fr);
			gap: 4px;
			margin-top: 4px;
		}
		.zenzaScreenFilterPanel .sfPresets button { text-align: left; }
		.zenzaScreenFilterPanel .sfPresets button.is-current {
			background: #2d6a3e;
			border-color: #5fbf78;
			color: #fff;
		}
		.zenzaScreenFilterPanel .sfPresetState { margin-top: 4px; color: #9c9; font-size: 11px; }
		.zenzaScreenFilterPanel .sfRow { margin-top: 8px; }
		.zenzaScreenFilterPanel .sfRowHead {
			display: flex;
			align-items: center;
			gap: 6px;
		}
		.zenzaScreenFilterPanel .sfLabel { flex: 1; color: #eee; }
		.zenzaScreenFilterPanel .sfValue {
			display: inline-flex;
			align-items: center;
			gap: 2px;
			font-family: monospace;
			color: #fff;
		}
		.zenzaScreenFilterPanel .sfNum {
			width: 62px;
			padding: 1px 3px;
			text-align: right;
			font: 12px monospace;
			color: inherit;
			background: #111;
			border: 1px solid #555;
			border-radius: 3px;
		}
		.zenzaScreenFilterPanel .sfUnit { min-width: 16px; color: #aaa; }
		.zenzaScreenFilterPanel .sfValue.is-changed .sfNum { color: #7fd38f; border-color: #4a8a58; }
		.zenzaScreenFilterPanel select.sfSelect {
			font-size: 12px;
			color: #eee;
			background: #111;
			border: 1px solid #555;
			border-radius: 3px;
			padding: 2px 4px;
		}
		.zenzaScreenFilterPanel .sfRowReset {
			padding: 0 6px;
			font-size: 11px;
		}
		.zenzaScreenFilterPanel input[type=range] {
			width: 100%;
			margin: 2px 0 0;
			cursor: pointer;
		}
		.zenzaScreenFilterPanel label.sfCheck {
			display: flex;
			align-items: center;
			gap: 6px;
			cursor: pointer;
			color: #eee;
		}
		.zenzaScreenFilterPanel .sfFoot {
			display: flex;
			flex-wrap: wrap;
			gap: 6px;
			margin-top: 12px;
		}
		.zenzaScreenFilterPanel.is-disabled .sfAdjust { opacity: 0.45; }
		.zenzaScreenFilterPanel .sfDesc.is-unavailable::after {
			content: attr(data-unavailable);
			display: block;
			color: #ff9f8f;
		}
	`;
		const rowHtml = (p) => {
				if (p.type === 'boolean') {
						return `
				<div class="sfRow" data-key="${p.key}">
					<label class="sfCheck"><input type="checkbox" data-param="${p.key}"> ${esc(p.label)}</label>
					<div class="sfDesc">${esc(p.desc)}</div>
				</div>`;
				}
				if (p.type === 'select') {
						return `
				<div class="sfRow" data-key="${p.key}">
					<div class="sfRowHead">
						<span class="sfLabel">${esc(p.label)}</span>
						<select class="sfSelect" data-param="${p.key}">
							${p.options.map(([v, label]) => `<option value="${v}">${esc(label)}</option>`).join('')}
						</select>
					</div>
					<div class="sfDesc">${esc(p.desc)}</div>
				</div>`;
				}
				return `
			<div class="sfRow" data-key="${p.key}">
				<div class="sfRowHead">
					<span class="sfLabel">${esc(p.label)}</span>
					<span class="sfValue">
						<input type="number" class="sfNum" data-num="${p.key}" min="${p.min}" max="${p.max}" step="${p.step}" title="数字を直接入力できます（Enterで決定）">
						<span class="sfUnit">${esc(p.unit || '')}</span>
					</span>
					<button type="button" class="sfRowReset" data-reset="${p.key}" title="この項目だけ元に戻す">↺</button>
				</div>
				<input type="range" data-param="${p.key}" min="${p.min}" max="${p.max}" step="${p.step}">
				<div class="sfDesc">${esc(p.desc)}</div>
			</div>`;
		};
		const TEMPLATE = () => `
		<div class="sfHead">
			<span class="sfTitle">画面フィルター</span>
			<button type="button" class="sfClose" data-action="close" title="閉じる">×</button>
		</div>
		<div class="sfIntro">
			動画の映像だけに効きます（コメントやボタンには効きません）。
			設定は全部の動画で共通で、次に開いた時も残ります。
			プリセット「標準」の時がOFFです（何も処理しません）。それ以外を選ぶと自動でONになります。
		</div>
		<div class="sfSection">
			<div class="sfSectionTitle">かんたん設定（プリセット）</div>
			<div class="sfDesc">迷ったらここから選んでください。選んだあとに下のつまみで微調整もできます。</div>
			<div class="sfPresets">
				${ScreenFilter.PRESETS.map(p => `<button type="button" data-preset="${p.id}" title="${esc(p.desc)}">${esc(p.label)}</button>`).join('')}
			</div>
			<div class="sfPresetState"></div>
			<div class="sfNote">
				ボタンにマウスを乗せると、それぞれの説明が出ます。
				「くっきり」だけは輪郭の強調を使うので少し重めです（グラフィックボードの無いノートパソコンなどで
				カクつく時は、下の「シャープ」を 0 に）。ほかのプリセットは色の計算だけなので軽いです。
			</div>
		</div>
		<div class="sfSection sfAdjust">
			<div class="sfSectionTitle">色と明るさ</div>
			<div class="sfNote">つまみは1刻みで動かせます。右の数字の欄に直接入力もできます（キーボードの←→でも1ずつ動きます）。</div>
			${ScreenFilter.PARAMS.filter(p => p.group === 'basic').map(rowHtml).join('')}
		</div>
		<div class="sfSection sfAdjust">
			<div class="sfSectionTitle">明暗・画質の細かい調整（暗い動画向け）</div>
			${ScreenFilter.PARAMS.filter(p => p.group === 'tone').map(rowHtml).join('')}
		</div>
		<div class="sfSection sfAdjust">
			<div class="sfSectionTitle">雰囲気</div>
			${ScreenFilter.PARAMS.filter(p => p.group === 'style').map(rowHtml).join('')}
		</div>
		<div class="sfSection">
			<div class="sfSectionTitle">変形（反転）</div>
			<label class="sfCheck"><input type="checkbox" data-setting="flipH"> 左右反転（鏡のように左右を入れ替える）</label>
			<label class="sfCheck"><input type="checkbox" data-setting="flipV"> 上下反転（上下をさかさまにする）</label>
			<div class="sfDesc">反転はページを開き直すと元に戻ります。「標準に戻す」をしても反転はそのままです。</div>
		</div>
		<div class="sfSection">
			<div class="sfSectionTitle">フィルターを反映する場所</div>
			<label class="sfCheck"><input type="checkbox" data-setting="applyToScreenshot"> スクリーンショットにも反映する</label>
			<label class="sfCheck"><input type="checkbox" data-setting="applyToCommentPip"> P in P(コメント付き) にも反映する</label>
			<div class="sfNote">
				通常の P in P は、ブラウザが動画をそのまま小窓に出す仕組みのため、フィルターは反映されません。
			</div>
		</div>
		<div class="sfFoot">
			<button type="button" data-action="reset" title="すべての調整を標準に戻します（反転はそのまま）">すべて標準に戻す</button>
			<button type="button" data-action="split" title="画面の左半分に元の映像、右半分にエフェクトを掛けた映像を並べて見比べます（もう一度押すと元に戻ります）">左右で見比べる（左: 元の映像）</button>
		</div>
	`;
		class Panel {
				constructor({ config }) {
						this.config = config;
						this.view = null;
						this._onFullscreenChange = this._onFullscreenChange.bind(this);
						this._refresh = this._refresh.bind(this);
				}
				_initializeDom() {
						if (this.view) {
								return;
						}
						if (!document.getElementById('zenzaScreenFilterPanelStyle')) {
								const style = document.createElement('style');
								style.id = 'zenzaScreenFilterPanelStyle';
								style.textContent = CSS;
								(document.head || document.documentElement).append(style);
						}
						const view = this.view = document.createElement('div');
						view.className = 'zenzaScreenFilterPanel zen-family';
						view.innerHTML = TEMPLATE();
						['click', 'dblclick', 'mousedown', 'mouseup', 'wheel', 'contextmenu', 'keydown', 'keyup']
								.forEach(name => view.addEventListener(name, e => e.stopPropagation()));
						view.addEventListener('keydown', e => {
								if (e.key === 'Escape') {
										e.preventDefault();
										this.close();
								}
						});
						view.addEventListener('input', e => {
								const key = e.target.dataset.param;
								if (key && e.target.type === 'range') {
										ScreenFilter.preview(key, e.target.value);
										this._updateValueLabel(key, ScreenFilter.normalize(key, e.target.value), { force: true });
								}
						});
						view.addEventListener('change', e => {
								const { param, setting, num } = e.target.dataset;
								if (num) {
										const v = ScreenFilter.normalize(num, e.target.value);
										e.target.value = v;
										ScreenFilter.set(num, v);
										const range = this.view.querySelector(`input[type=range][data-param="${num}"]`);
										range && (range.value = v);
										if (!ScreenFilter.isEnabled()) {
												this.config.props['screenFilter.enable'] = true;
										}
								}
								else if (param) {
										ScreenFilter.set(param, e.target.type === 'checkbox' ? e.target.checked : e.target.value);
										if (!ScreenFilter.isEnabled()) {
												this.config.props['screenFilter.enable'] = true;
										}
								}
								else if (setting) {
										this.config.props[`screenFilter.${setting}`] = !!e.target.checked;
								}
						});
						view.addEventListener('click', e => {
								const target = e.target.closest('button');
								if (!target) {
										return;
								}
								const { preset, reset, action } = target.dataset;
								if (preset) {
										ScreenFilter.execCommand('screenFilter-preset', preset);
								}
								else if (reset) {
										ScreenFilter.set(reset, ScreenFilter.PARAM_MAP[reset].def);
								}
								else if (action === 'reset') {
										ScreenFilter.reset();
								}
								else if (action === 'close') {
										this.close();
								}
								else if (action === 'split') {
										ScreenFilter.setSplit(!ScreenFilter.isSplit);
								}
						});
						this._onOutsidePointerDown = (e) => {
								if (!this.isOpen || this.view.classList.contains('is-closing')) {
										return;
								}
								const path = typeof e.composedPath === 'function' ? e.composedPath() : [e.target];
								if (path.includes(this.view)) {
										return;
								}
								if (path.some((el) => el && el.classList && el.classList.contains('screenFilterSwitch'))) {
										return;
								}
								const onVideo = path.some((el) => el && el.classList &&
										(el.classList.contains('videoPlayer') || el.classList.contains('commentLayerFrame')));
								this.close();
								if (onVideo) {
										const swallow = (ev) => { ev.stopPropagation(); ev.preventDefault(); };
										window.addEventListener('click', swallow, { capture: true, once: true });
										setTimeout(() => window.removeEventListener('click', swallow, { capture: true }), 600);
								}
						};
						ScreenFilter.onChange(this._refresh);
						document.addEventListener('fullscreenchange', this._onFullscreenChange);
						document.addEventListener('webkitfullscreenchange', this._onFullscreenChange);
				}
				_updateValueLabel(key, value, { force = false } = {}) {
						const row = this.view.querySelector(`.sfRow[data-key="${key}"]`);
						const label = row && row.querySelector('.sfValue');
						const num = label && label.querySelector('.sfNum');
						if (!num) {
								return;
						}
						if (force || document.activeElement !== num) {
								num.value = value;
						}
						label.classList.toggle('is-changed', Math.abs(value - ScreenFilter.PARAM_MAP[key].def) > 1e-6);
				}
				_refresh() {
						if (!this.view || !this.isOpen) {
								return;
						}
						const values = ScreenFilter.read();
						const props = this.config.props;
						ScreenFilter.PARAMS.forEach(p => {
								const input = this.view.querySelector(`[data-param="${p.key}"]`);
								if (!input) {
										return;
								}
								if (p.type === 'boolean') {
										input.checked = !!values[p.key];
								}
								else if (p.type === 'select') {
										input.value = values[p.key];
								}
								else {
										if (document.activeElement !== input) {
												input.value = values[p.key];
												this._updateValueLabel(p.key, values[p.key]);
										}
								}
						});
						this.view.querySelectorAll('[data-setting]').forEach((input) => {
								const name = input.dataset.setting;
								const v = props[`screenFilter.${name}`];
								input.checked = v === undefined ? name !== 'flipH' && name !== 'flipV' : !!v;
						});
						const current = ScreenFilter.detectPreset(values);
						this.view.querySelectorAll('[data-preset]').forEach((button) => {
								button.classList.toggle('is-current', button.dataset.preset === current);
						});
						const preset = ScreenFilter.PRESETS.find(p => p.id === current);
						this.view.querySelector('.sfPresetState').textContent = preset ?
								`いまの設定: ${preset.label}` : 'いまの設定: 手動で調整中（どのプリセットとも違う値）';
						const autoRow = this.view.querySelector('.sfRow[data-key="autoLevels"] .sfDesc');
						if (autoRow) {
								autoRow.classList.toggle('is-unavailable', !ScreenFilter.autoLevelsAvailable);
								autoRow.dataset.unavailable = ScreenFilter.autoLevelsAvailable ? '' : 'この動画では使えません（配信元が映像の読み取りを許可していないため）';
						}
						const splitButton = this.view.querySelector('[data-action="split"]');
						splitButton && splitButton.classList.toggle('is-on', ScreenFilter.isSplit);
				}
				_getParentNode() {
						const fs = document.fullscreenElement || document.webkitFullscreenElement;
						return fs || document.body;
				}
				_onFullscreenChange() {
						if (!this.view || !this.isOpen) {
								return;
						}
						const parent = this._getParentNode();
						if (this.view.parentNode !== parent) {
								parent.append(this.view);
						}
				}
				get isOpen() {
						return !!(this.view && this.view.classList.contains('is-open') &&
								!this.view.classList.contains('is-closing'));
				}
				open() {
						this._initializeDom();
						const parent = this._getParentNode();
						if (this.view.parentNode !== parent) {
								parent.append(this.view);
						}
						clearTimeout(this._closeTimer);
						this.view.classList.remove('is-closing');
						this._updateOrigin();
						this.view.classList.remove('is-open');
						void this.view.offsetWidth;
						this.view.classList.add('is-open');
						this._refresh();
						window.addEventListener('pointerdown', this._onOutsidePointerDown, { capture: true });
				}
				_updateOrigin() {
						const button = document.querySelector('.screenFilterSwitch');
						const rect = button && button.getBoundingClientRect();
						if (!rect || !rect.width) {
								this.view.style.removeProperty('--sf-origin');
								return;
						}
						const vw = window.innerWidth, vh = window.innerHeight;
						const panelW = Math.min(380, vw - 32);
						const panelLeft = vw - 16 - panelW;
						const x = Math.max(0, Math.min(100, ((rect.left + rect.width / 2) - panelLeft) / panelW * 100));
						const y = rect.top > vh / 2 ? 100 : 0;
						this.view.style.setProperty('--sf-origin', `${x.toFixed(1)}% ${y}%`);
				}
				close() {
						if (!this.view || !this.isOpen) {
								return;
						}
						window.removeEventListener('pointerdown', this._onOutsidePointerDown, { capture: true });
						this.view.classList.add('is-closing');
						clearTimeout(this._closeTimer);
						this._closeTimer = setTimeout(() => {
								this.view.classList.remove('is-open', 'is-closing');
						}, 170);
						ScreenFilter.bypass && ScreenFilter.setBypass(false);
				}
				toggle() {
						this.isOpen ? this.close() : this.open();
				}
		}
		return Panel;
})();
// already required
class RelatedMenuSettings {
	static mount(container, options) {
		return new RelatedMenuSettings(container, options);
	}
	static escape(text) {
		return String(text == null ? '' : text).replace(/[&<>"']/g, ch =>
			({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[ch]));
	}
	constructor(container, {config, actions, shortcuts = {}, embedded = false, onDraftChange = null}) {
		if (!container || !config || !actions) { throw new TypeError('Related-menu settings dependencies missing'); }
		this.container = container;
		this.doc = container.ownerDocument;
		this.config = config;
		this.actions = actions;
		this.shortcuts = shortcuts;
		this.embedded = embedded === true;
		this.onDraftChange = typeof onDraftChange === 'function' ? onDraftChange : null;
		this.getDraftShortcutValue=null;
		this.getDraftShortcutConflicts=null;
		this._recordCleanup = null;
		this.externalChanged = false;
		this.message = '';
		this.saving = false;
		this.expandedIds = new Set();
		this.variablesOpen = new Set();
		this._dragFrom = null;
		this._dragAfter = false;
		this._handleDragStart = e => this._onDragStart(e);
		this._handleDragOver = e => this._onDragOver(e);
		this._handleDrop = e => this._onDrop(e);
		this._handleDragEnd = () => this._clearDragVisuals();
		this._handleClick = e => this._onClick(e);
		this._handleInput = e => this._onField(e);
		this._handleChange = e => this._onField(e);
		this._handleConfigUpdate = key => this._onConfigUpdate(key);
		this._addStyle();
		this._load();
		container.addEventListener('click', this._handleClick);
		container.addEventListener('input', this._handleInput);
		container.addEventListener('change', this._handleChange);
		container.addEventListener('dragstart', this._handleDragStart);
		container.addEventListener('dragover', this._handleDragOver);
		container.addEventListener('drop', this._handleDrop);
		container.addEventListener('dragend', this._handleDragEnd);
		container.addEventListener('keydown', this._handleGripKeyDown=e=>this._onGripKeyDown(e));
		if (typeof config.on === 'function') {
			config.on('update', this._handleConfigUpdate);
		}
	}
	_addStyle() {
		if (this.doc.querySelector('style[data-zenza-related-menu-settings]')) { return; }
		const style = this.doc.createElement('style');
		style.setAttribute('data-zenza-related-menu-settings', '');
		style.textContent = [
			'.zenzaRelatedLinksEditor { padding:10px 4px 14px; font-size:13px; line-height:1.5; }',
			'.zenzaRelatedLinksEditor h3 { font-size:16px; font-weight:700; margin:6px 0; }',
			'.zenzaRelatedLinksEditor p { margin:6px 0; }',
			'.zenzaRelatedLinksEditor .rl-help { opacity:.72; font-size:12px; }',
			'.zenzaRelatedLinksEditor .rl-toolbar { display:flex; flex-wrap:wrap; gap:8px; align-items:center; padding:10px 0; }',
			'.zenzaRelatedLinksEditor .rl-toolbar button { padding:7px 12px; }',
			'.zenzaRelatedLinksEditor .rl-toolbar [data-rl-count] { margin-right:auto; opacity:.76; }',
			'.zenzaRelatedLinksEditor .rl-card { position:relative; border:1px solid #5c6c80; border-radius:5px; padding:12px; margin:9px 0; background:rgba(96,126,166,.09); }',
			'.zenzaRelatedLinksEditor .rl-head { display:flex; flex-wrap:wrap; align-items:center; gap:5px; margin-bottom:8px; }',
			'.zenzaRelatedLinksEditor .rl-head strong { margin-right:auto; min-width:80px; overflow-wrap:anywhere; }',
			'.zenzaRelatedLinksEditor .rl-head button { font-size:11px; padding:3px 8px; }',
			'.zenzaRelatedLinksEditor [hidden] { display:none !important; }',
			'.zenzaRelatedLinksEditor .rl-head .rl-summary { flex:1; min-width:100px; }',
			'.zenzaRelatedLinksEditor .rl-head .rl-summary strong { display:block; }',
			'.zenzaRelatedLinksEditor .rl-head .rl-summary small { display:block; opacity:.75; }',
			'.zenzaRelatedLinksEditor .rl-drag { cursor:grab; color:inherit; touch-action:none; }',
			'.zenzaRelatedLinksEditor .rl-card.rl-is-dragging { opacity:.4; border-style:dashed; }',
			'.zenzaRelatedLinksEditor .rl-card.rl-drop-target::before { content:""; position:absolute; left:0; right:0; height:4px; border-radius:4px; background:#82bfff; box-shadow:0 0 8px #82bfff; pointer-events:none; z-index:2; }',
			'.zenzaRelatedLinksEditor .rl-card.rl-drop-before::before { top:-8px; }',
			'.zenzaRelatedLinksEditor .rl-card.rl-drop-after::before { bottom:-8px; }',
			'.zenzaRelatedLinksEditor .rl-variables-toggle { margin-top:8px; }',
			'.zenzaRelatedLinksEditor .rl-variables { padding:6px; border:1px solid #4b5f76; border-radius:5px; }',
			'.zenzaRelatedLinksEditor .rl-shortcut-editor { display:flex; flex-wrap:wrap; gap:6px; align-items:center; margin:9px 0; }',
			'.zenzaRelatedLinksEditor .rl-shortcut-editor button { padding:5px 8px; }',
			'.zenzaRelatedLinksEditor .rl-shortcut-warning { color:#b67e24; font-size:12px; }',
			'.zenzaRelatedLinksEditor .rl-fields { display:grid; grid-template-columns:minmax(110px,1fr) minmax(160px,2fr); gap:10px; }',
			'.zenzaRelatedLinksEditor .rl-fields label { display:grid; gap:4px; min-width:0; }',
			'.zenzaRelatedLinksEditor .rl-fields label.rl-full { grid-column:1 / -1; }',
			'.zenzaRelatedLinksEditor .rl-fields input[type=text] { width:100%; box-sizing:border-box; min-width:0; padding:6px 8px; }',
			'.zenzaRelatedLinksEditor .rl-flags select,.zenzaRelatedLinksEditor .rl-flags input[type=number] { max-width:190px; padding:5px; background:#101927; color:#edf4ff; border:1px solid #445a71; }',
			'.zenzaRelatedLinksEditor .rl-variables small { flex:1 0 100%; }',
			'.zenzaRelatedLinksEditor .rl-flags { display:flex; gap:18px; flex-wrap:wrap; margin:10px 0; }',
			'.zenzaRelatedLinksEditor .rl-flags label { display:inline-flex; align-items:center; gap:5px; }',
			'.zenzaRelatedLinksEditor .rl-variables { display:flex; flex-wrap:wrap; gap:5px; margin:5px 0; }',
			'.zenzaRelatedLinksEditor .rl-variables button { font-size:11px; padding:3px 7px; }',
			'.zenzaRelatedLinksEditor .rl-preview { display:block; overflow-wrap:anywhere; white-space:normal; padding:7px 8px; background:rgba(100,110,130,.16); border-radius:4px; }',
			'.zenzaRelatedLinksEditor .rl-error { color:#dc5f50; font-size:12px; min-height:1.4em; }',
			'.zenzaRelatedLinksEditor .rl-no-owner, .zenzaRelatedLinksEditor .rl-status { font-size:12px; opacity:.8; }',
			'.zenzaRelatedLinksEditor .rl-status { width:100%; min-height:1.4em; }',
			'.zenzaRelatedLinksEditor button:disabled { opacity:.45; cursor:not-allowed; }',
			'.zenzaRelatedLinksEditor .rl-save { font-weight:bold; }',
			'@media(max-width:650px) {.zenzaRelatedLinksEditor .rl-fields { grid-template-columns:1fr; } .zenzaRelatedLinksEditor .rl-fields label.rl-full { grid-column:auto; }}'
		].join('\n');
		this.doc.head.append(style);
	}
	_read() {
		const raw = this.config.getValue(this.actions.CONFIG_KEY);
		if (!Array.isArray(raw)) { return null; }
		return raw.map(item => item && typeof item === 'object' && !Array.isArray(item) ?
			Object.assign({}, item) : item);
	}
	_load() {
		if (this._recordCleanup) { this._recordCleanup(); }
		this.original = this._read();
		this.draft = Array.isArray(this.original) ? this.original.map(item =>
			item && typeof item === 'object' ? Object.assign({}, item) : item) : [];
		this.externalChanged = false;
		this.expandedIds.clear();
		this.variablesOpen.clear();
		this.message = this.original === null ? '保存済みリンクの形式が不正です。JSONのバックアップを確認してください。' : '';
		this._render();
	}
	_dirty() {
		return JSON.stringify(this.draft) !== JSON.stringify(this.original);
	}
	_rowError(item, index) {
		if (!item || typeof item !== 'object' || Array.isArray(item)) { return '設定の形式が不正です。'; }
		if (typeof item.id !== 'string' || !/^[a-z0-9][a-z0-9._:-]{0,63}$/i.test(item.id)) {
			return 'IDは英数字で始まる1～64文字（英数字・._:-）にしてください。';
		}
		if (this.draft.findIndex(link => link && link.id === item.id) !== index) {
			return '同じIDが存在します。IDを重複させないでください。';
		}
		if (typeof item.label !== 'string' || !item.label.trim() || item.label.length > 80) {
			return '表示名は1～80文字で入力してください。';
		}
		if(this.actions.isCopy(item)){
			return this.actions.validateLinks([item]).valid?'':
				'コピー内容を入力してください（4096文字以内・既知の変数のみ使用可能）。';
		}
		if (typeof item.url !== 'string' || !/^https?:\/\//.test(item.url) ||
			item.url.length > 2048) {
			return 'URLはHTTP(S)の絶対URL（最大2048文字）にしてください。';
		}
		const tokens = item.url.match(/\{[^{}]*\}/g) || [];
		if (tokens.some(x => !this.actions.VARIABLES.includes(x.slice(1, -1))) ||
			/[{}]/.test(item.url.replace(/\{[^{}]*\}/g, ''))) {
			return 'URLに未知の変数、または閉じていない波括弧があります。';
		}
		if (!this.actions.validateLinks([item]).valid) {
			return 'URLまたは設定が不正です。ユーザー名・パスワード入りURLも使えません。';
		}
		return '';
	}
	replaceDraftFromParent(value) {
		if (!Array.isArray(value)) { throw new TypeError('Expected custom link array'); }
		if (this._recordCleanup) { this._recordCleanup(); }
		this.draft=value.map(entry=>
			entry && typeof entry==='object' && !Array.isArray(entry) ? {...entry} : entry);
		this.expandedIds.clear();
		this.variablesOpen.clear();
		this.message='';
		this._render();
	}
	_rowKey(item, index) {
		return item && typeof item.id === 'string' && item.id ? item.id : '__invalid_'+index;
	}
	_formatShortcut(code) {
		return typeof this.shortcuts.formatKeyCombo === 'function' ?
			this.shortcuts.formatKeyCombo(code) : (code ? String(code) : '(未設定)');
	}
	_render() {
		const E = RelatedMenuSettings.escape;
		const rows = this.draft.map((item, index) => {
			const obj = item && typeof item === 'object' ? item : {};
			const field = (key, label, attrs='') =>
				'<label>'+label+'<input type="text" data-rl-field="'+key+'" '+attrs+
				' value="'+E(obj[key])+'"></label>';
			const names={videoId:'動画ID',watchId:'視聴ID',videoUrl:'動画URL',
				videoTitle:'動画タイトル',uploaderUserId:'投稿者ID',uploaderChannelId:'チャンネルID',
				uploaderName:'投稿者名',currentTime:'再生位置（秒）'};
			const variableButtons = this.actions.VARIABLES.map(name =>
				'<button type="button" data-rl-insert="'+name+'" data-rl-index="'+index+'" title="'+E(names[name]||name)+'をURLに挿入">'+
				E(names[name] || name)+' <code>{'+name+'}</code></button>'
			).join('');
			const rowKey=this._rowKey(item,index);
			const expanded=this.expandedIds.has(rowKey);
			const variablesShown=this.variablesOpen.has(rowKey);
			return '<article class="rl-card" data-rl-row="'+index+'">' +
				'<div class="rl-head">' +
				'<button type="button" class="rl-drag" data-rl-drag="'+index+'" draggable="true" aria-label="ドラッグで移動。Alt＋上下キーでも移動できます" title="ドラッグかAlt＋↑↓で並び替え">⠿</button>' +
				'<div class="rl-summary"><strong data-rl-summary>'+E(obj.label || 'リンク '+(index+1))+'</strong>' +
				'<small data-rl-summary-status>'+(obj.enabled===false?'無効':'有効')+' ・ '+
				E(this._formatShortcut(obj.shortcutKey))+'</small>' +
				'<small data-rl-shortcut-summary-warning class="rl-shortcut-warning"></small>' +
				'<small data-rl-error-summary class="rl-error"></small></div>' +
				'<button type="button" data-rl-expand="'+index+'" aria-expanded="'+(expanded?'true':'false')+'">'+
				(expanded?'閉じる':'編集')+'</button>' +
				'<button type="button" data-rl-up="'+index+'" '+(index===0?'disabled':'')+'>↑ 上へ</button>' +
				'<button type="button" data-rl-down="'+index+'" '+(index===this.draft.length-1?'disabled':'')+'>↓ 下へ</button>' +
				'<button type="button" data-rl-duplicate="'+index+'" '+(this.draft.length>=40?'disabled':'')+'>複製</button>' +
				'<button type="button" data-rl-delete="'+index+'">削除</button></div>' +
				'<div data-rl-details '+(expanded?'':'hidden')+'>' +
				'<div class="rl-fields">' +
				field('id','ID（リンク識別子）','maxlength="64"')+
				field('label','表示名','maxlength="80"')+
				'<label class="rl-full">項目の動作<select data-rl-field="kind"><option value="link" '+(obj.kind!=='copy'?'selected':'')+'>リンクを開く</option><option value="copy" '+(obj.kind==='copy'?'selected':'')+'>テキストをコピー</option></select></label>'+
				'<label class="rl-full" data-rl-copy-fields>コピー内容のひな形<select data-rl-copy-preset><option value="">選択して挿入</option><option value="id">動画ID</option><option value="url">動画URL</option><option value="title">動画タイトル</option><option value="title-url">タイトル＋URL</option></select></label>'+
				'<label class="rl-full" data-rl-copy-fields>コピーするテキスト<textarea data-rl-field="copyTemplate" maxlength="4096" rows="4">'+E(obj.copyTemplate||'{videoId}')+'</textarea><small>変数を組み合わせたり、改行や任意の文字を追加できます。</small></label>'+
				'<label class="rl-full" data-rl-link-fields>URLテンプレート<input type="text" data-rl-field="url" maxlength="2048" value="'+E(obj.url)+'" placeholder="https://example.com/watch/{videoId}"></label>' +
				'</div><div class="rl-flags">' +
				'<label><input type="checkbox" data-rl-field="enabled" '+(obj.enabled!==false?'checked':'')+'> 有効にする</label>' +
				'<label><input type="checkbox" data-rl-field="openInNewTab" '+(obj.openInNewTab!==false?'checked':'')+'> 旧設定：新しいタブ</label>' +
				'<label>開き方 <select data-rl-field="openMode">'+
				[['default','旧設定どおり'],['same-tab','同じタブ'],['new-tab','新しいタブ'],['new-window','新しいウィンドウを要求']]
				.map(([val,label])=>'<option value="'+val+'" '+((obj.openMode||'default')===val?'selected':'')+'>'+label+'</option>').join('')+'</select></label>' +
				'<label>ウィンドウ横幅 <input type="number" data-rl-field="popupWidth" min="250" max="1800" value="'+E(obj.popupWidth||760)+'"></label>' +
				'<label>高さ <input type="number" data-rl-field="popupHeight" min="250" max="1800" value="'+E(obj.popupHeight||650)+'"></label></div>' +
				'<div class="rl-shortcut-editor"><span>ショートカット: <strong data-rl-key-text>'+E(this._formatShortcut(obj.shortcutKey))+'</strong></span>' +
				'<button type="button" data-rl-record="'+index+'">変更</button>' +
				'<button type="button" data-rl-key-clear="'+index+'">解除</button>' +
				'<span class="rl-shortcut-warning" data-rl-shortcut-warning></span></div>' +
				'<button type="button" class="rl-variables-toggle" data-rl-variables-toggle="'+index+'" aria-expanded="'+(variablesShown?'true':'false')+'">'+
				'｛ ｝ 変数を挿入 '+(variablesShown?'▴':'▾')+'</button>' +
				'<div class="rl-variables" data-rl-variables-panel '+(variablesShown?'':'hidden')+'>'+variableButtons+
				'<small class="rl-help">使える8種類の変数は、動画ID・視聴ID・動画URL・タイトル・ユーザーID・チャンネルID・投稿者名・現在時刻（秒）です。' +
				'クリックするとURLのカーソル位置に挿入します。取得できない値が必要なリンクは無効になります。</small></div>' +
				'<div class="rl-help">URLプレビュー（サンプル値）</div><code class="rl-preview" data-rl-preview></code>' +
				'<p class="rl-no-owner" data-rl-no-owner></p>' +
				'<p class="rl-error" data-rl-error role="status"></p>' +
				'</div></article>';
		}).join('');
		this.container.innerHTML =
			'<section class="zenzaRelatedLinksEditor" aria-label="関連メニュー カスタムリンク編集">' +
			'<h3>関連メニュー › カスタムリンク</h3>' +
			'<p class="rl-help">カスタムリンクの詳細編集です。URLに {videoId} のような変数を入れると動画ごとに自動で置き換わります。' +
			'「編集」→「｛ ｝変数を挿入」で全8種類と説明を開けます。ショートカットは他のキーと共有するため、重複すると警告します。' +
			'外部Userscriptから登録したアクションの動作は変更できません。</p>' +
			'<div data-rl-rows>'+rows+'</div>' +
			'<div class="rl-toolbar"><span data-rl-count></span>' +
			'<button type="button" data-rl-add>＋ リンクを追加</button>' +
			'<button type="button" data-rl-add-copy>＋ コピー項目を追加</button>' +
			'<button type="button" data-rl-cancel '+(this.embedded?'hidden':'')+'>変更を破棄</button>' +
			'<button type="button" class="rl-save" data-rl-save '+(this.embedded?'hidden':'')+'>変更を保存</button>' +
			'<p class="rl-status" role="status" aria-live="polite" data-rl-status></p></div>' +
			'</section>';
		this._refresh();
	}
	_refresh() {
		const validation = this.actions.validateLinks(this.draft);
		const invalid = this.draft.map((row,i) => this._rowError(row,i));
		const sample = {videoId:'sm9',watchId:'sm9',videoUrl:'https://www.nicovideo.jp/watch/sm9',
			videoTitle:'サンプル動画',uploaderUserId:'12345',uploaderChannelId:'4567',
			uploaderName:'投稿者の例',currentTime:'85'};
		const noOwner = Object.assign({},sample,{
			uploaderUserId:'',uploaderChannelId:'',uploaderName:''
		});
		this.container.querySelectorAll('[data-rl-row]').forEach((card,index) => {
			const item=this.draft[index] || {};
			const isCopy=this.actions.isCopy(item);
			card.querySelectorAll('[data-rl-copy-fields]').forEach(el=>{el.hidden=!isCopy;});
			card.querySelectorAll('[data-rl-link-fields]').forEach(el=>{el.hidden=isCopy;});
			card.querySelectorAll('.rl-flags [data-rl-field]').forEach(el=>{
				if(el.dataset.rlField!=='enabled'){el.closest('label').hidden=isCopy;}
			});
			const popupMode=!isCopy && item.openMode==='new-window';
			card.querySelectorAll('[data-rl-field="popupWidth"],[data-rl-field="popupHeight"]')
				.forEach(control=>{control.disabled=!popupMode;});
			card.querySelector('[data-rl-summary]').textContent=item.label || 'リンク '+(index+1);
			card.querySelector('[data-rl-summary-status]').textContent=
				(item.enabled===false?'無効':'有効')+' ・ '+this._formatShortcut(item.shortcutKey);
			const label=card.querySelector('[data-rl-key-text]');
			label.textContent=this._formatShortcut(item.shortcutKey);
			const key=Number(item.shortcutKey)||0;
			const sameLinks=this.draft.filter((other,i)=>i!==index &&
				other && Number(other.shortcutKey)===key).map(other=>other.label||other.id);
			const ordinary=(this.shortcuts.actions||[]).filter(action=>
				Number(typeof this.getDraftShortcutValue==='function' ?
					this.getDraftShortcutValue('KEY_'+action.id) :
					this.config.props?.['KEY_'+action.id])===key)
				.map(action=>action.label||action.id);
			const liveConflicts=key && typeof this.getDraftShortcutConflicts==='function'?
				this.getDraftShortcutConflicts(key):null;
			const warning=key && (liveConflicts?liveConflicts.length>1:
				sameLinks.length || ordinary.length) ?
				'⚠ ショートカットが重複: '+(liveConflicts||sameLinks.concat(ordinary)).join('、')+
				'（割り当ては自動で解除しません）' : '';
			card.querySelector('[data-rl-shortcut-warning]').textContent=warning;
			card.querySelector('[data-rl-shortcut-summary-warning]').textContent=warning ? '⚠ キー重複' : '';
			const preview=card.querySelector('[data-rl-preview]');
			const noOwnerView=card.querySelector('[data-rl-no-owner]');
			const err=card.querySelector('[data-rl-error]');
			const resolved=isCopy?this.actions.resolveCopy(item.copyTemplate,sample):
				this.actions.resolveUrl(item.url,sample);
			preview.textContent=(isCopy?resolved.text:resolved.url) || 'プレビューできません（内容・変数を確認）';
			const missing=isCopy?this.actions.resolveCopy(item.copyTemplate,noOwner):
				this.actions.resolveUrl(item.url,noOwner);
			const ownerDependent=(missing.missing||[]).some(name=>
				['uploaderUserId','uploaderChannelId','uploaderName'].includes(name));
			noOwnerView.textContent=ownerDependent ?
				'投稿者情報を取得できない動画では、このリンクは無効になります。' : '';
			err.textContent=invalid[index];
			card.querySelector('[data-rl-error-summary]').textContent=invalid[index] ? '⚠ 入力内容を確認' : '';
		});
		const count=this.container.querySelector('[data-rl-count]');
		count.textContent=this.draft.length+' / 40 件';
		this.container.querySelectorAll('[data-rl-add],[data-rl-add-copy]').forEach(button=>{
			button.disabled=this.draft.length>=40 || this.original===null;
		});
		this.container.querySelector('[data-rl-cancel]').disabled=!this._dirty() && !this.externalChanged;
		this.container.querySelector('[data-rl-save]').disabled=
			!this._dirty() || !validation.valid || invalid.some(Boolean) || this.original===null;
		const status=this.container.querySelector('[data-rl-status]');
		if (this.embedded && this.onDraftChange && this.original !== null) {
			this.onDraftChange(this.draft.map(item =>
				item && typeof item === 'object' && !Array.isArray(item) ? {...item} : item));
		}
		if(this._detailId!==undefined){this.showDetail(this._detailId);}
		status.textContent=this.externalChanged ?
			'別の画面で設定が更新されました。変更を破棄して再読み込みしてください。' :
			this.message || (!validation.valid ? 'URL・ID・表示名などの入力エラーがあります。保存前に修正してください。' :
			this._dirty() ? '未保存の変更があります。' : '');
	}
	_onField(e) {
		if(e.target.hasAttribute('data-rl-copy-preset')){
			const presets={id:'{videoId}',url:'{videoUrl}',title:'{videoTitle}',
				'title-url':'{videoTitle}\n{videoUrl}'};
			const value=presets[e.target.value],card=e.target.closest('[data-rl-row]');
			if(value && card){
				const index=Number(card.dataset.rlRow);
				this.draft=this.draft.map((item,i)=>i===index?{...item,copyTemplate:value}:item);
				card.querySelector('[data-rl-field="copyTemplate"]').value=value;
				this._refresh();
			}
			return;
		}
		const field=e.target.dataset && e.target.dataset.rlField;
		if (!field) { return; }
		const card=e.target.closest('[data-rl-row]');
		if (!card || !this.container.contains(card)) { return; }
		const index=Number(card.dataset.rlRow);
		const item=this.draft[index];
		const value=e.target.type==='checkbox' ? e.target.checked :
			e.target.type==='number'?Number(e.target.value):e.target.value;
		if (field==='id' && item && typeof item.id==='string') {
			if (this.expandedIds.delete(item.id)) { this.expandedIds.add(value); }
			if (this.variablesOpen.delete(item.id)) { this.variablesOpen.add(value); }
		}
		this.draft=this.draft.map((entry,i)=>i===index?Object.assign({},entry,{[field]:value},
			field==='kind'&&value==='copy'&&!entry.copyTemplate?{copyTemplate:'{videoId}'}:{}):entry);
		if(field==='id' && this._detailId===item?.id){this._detailId=value;}
		this.message='';
		this._refresh();
	}
	showList() {
		this._detailId=undefined;
		this.container.hidden=false;
		this.container.classList.remove('is-detail-only');
		this.container.querySelectorAll('[data-rl-row]').forEach((card,index)=>{
			card.hidden=false;
			const key=this._rowKey(this.draft[index],index);
			card.querySelector('[data-rl-details]').hidden=!this.expandedIds.has(key);
		});
	}
	showDetail(id) {
		this._detailId=id;
		this.container.classList.add('is-detail-only');
		this.container.querySelectorAll('[data-rl-row]').forEach((card,index)=>{
			card.hidden=this.draft[index]?.id!==id;
			if(!card.hidden){card.querySelector('[data-rl-details]').hidden=false;}
		});
	}
	addItem(kind='link') {
		if(this.draft.length>=40 || this.original===null){return null;}
		const id=this._uniqueId(kind==='copy'?'copy':'link');
		const item=kind==='copy'?{id,label:'動画IDをコピー',kind:'copy',copyTemplate:'{videoId}',enabled:true}:
			{id,label:'',url:'',enabled:true,openInNewTab:true};
		this.draft=this.draft.concat([item]);this.expandedIds.add(id);
		if(this._detailId!==undefined){this._detailId=id;}
		this.message='';this._render();return id;
	}
	_uniqueId(base='link') {
		const ids=new Set(this.draft.map(item=>item&&item.id));
		let n=1;
		let candidate;
		do { candidate=base.slice(0,Math.max(1,64-String(n).length-1))+'-'+n++; }
		while (ids.has(candidate));
		return candidate;
	}
	_insert(button) {
		const index=Number(button.dataset.rlIndex);
		const name=button.dataset.rlInsert;
		if (!this.actions.VARIABLES.includes(name)) { return; }
		const card=this.container.querySelector('[data-rl-row="'+index+'"]');
		if (!card) { return; }
		const field=this.actions.isCopy(this.draft[index])?'copyTemplate':'url';
		const input=card.querySelector('[data-rl-field="'+field+'"]');
		const token='{'+name+'}';
		const start=typeof input.selectionStart==='number'?input.selectionStart:input.value.length;
		const end=typeof input.selectionEnd==='number'?input.selectionEnd:start;
		input.setRangeText(token,start,end,'end');
		this.draft=this.draft.map((item,i)=>i===index?
			Object.assign({},item,{[field]:input.value}):item);
		input.focus();
		const rowKey=this._rowKey(this.draft[index],index);
		this.variablesOpen.delete(rowKey);
		const menu=card.querySelector('[data-rl-variables-panel]');
		if (menu) { menu.hidden=true; }
		const toggle=card.querySelector('[data-rl-variables-toggle]');
		if (toggle) { toggle.setAttribute('aria-expanded','false');toggle.textContent='｛ ｝ 変数を挿入 ▾'; }
		this.message='';
		this._refresh();
	}
	_save() {
		const valid=this.actions.validateLinks(this.draft);
		if (!valid.valid || this.draft.some((item,i)=>this._rowError(item,i))) {
			this.message='入力内容を確認してください。変更は保存されていません。';
			this._refresh();return;
		}
		if (JSON.stringify(this._read())!==JSON.stringify(this.original)) {
			this.externalChanged=true;this._refresh();return;
		}
		const next=valid.links.map(link=>Object.assign({},link));
		try {
			this.saving=true;
			this.config.setValue(this.actions.CONFIG_KEY,next);
			this.saving=false;
			this._load();
			this.message='保存しました。';
			this._refresh();
		} catch (_) {
			this.saving=false;
			this.message='設定の保存に失敗しました。内容は保持しています。';
			this._refresh();
		}
	}
	_onConfigUpdate(key) {
		if (key!==this.actions.CONFIG_KEY || this.saving) { return; }
		if (this._dirty()) { this.externalChanged=true;this._refresh(); }
		else { this._load(); }
	}
	_startRecording(index, button) {
		if (this._recordCleanup) { this._recordCleanup(); }
		const originalText=button.textContent;
		const document=this.doc;
		button.textContent='キーを押してください（Escで中止）';
		const cleanup=() => {
			document.removeEventListener('keydown',onKeyDown,true);
			button.textContent=originalText;
			this._recordCleanup=null;
		};
		const onKeyDown=evt => {
			evt.preventDefault();
			evt.stopPropagation();
			if (typeof evt.stopImmediatePropagation==='function') { evt.stopImmediatePropagation(); }
			if ([16,17,18,91,92,93,224].includes(evt.keyCode)) { return; }
			if (evt.keyCode===27 && !(evt.metaKey || evt.altKey || evt.ctrlKey || evt.shiftKey)) {
				cleanup();return;
			}
			const value=typeof this.shortcuts.encodeKeyCombo==='function' ?
				this.shortcuts.encodeKeyCombo(evt) : evt.keyCode;
			cleanup();
			if (!Number.isSafeInteger(value) || value<=0 || value>=90000000) { return; }
			this.draft=this.draft.map((entry,i)=>i===index ?
				Object.assign({},entry,{shortcutKey:value}) : entry);
			this.message='';
			this._refresh();
		};
		this._recordCleanup=cleanup;
		document.addEventListener('keydown',onKeyDown,true);
	}
	_onClick(e) {
		const button=e.target.closest('button');
		if (!button || !this.container.contains(button) || button.disabled) { return; }
		if (button.dataset.rlInsert) { this._insert(button);return; }
		if (button.hasAttribute('data-rl-record')) {
			const index=Number(button.dataset.rlRecord);
			if (Number.isInteger(index) && index>=0 && index<this.draft.length) {
				this._startRecording(index,button);
			}
			return;
		}
		if (button.hasAttribute('data-rl-key-clear')) {
			const index=Number(button.dataset.rlKeyClear);
			if (!Number.isInteger(index) || index<0 || index>=this.draft.length) { return; }
			if (this._recordCleanup) { this._recordCleanup(); }
			this.draft=this.draft.map((entry,i)=>i===index ?
				Object.assign({},entry,{shortcutKey:0}) : entry);
			this._refresh();
			return;
		}
		if (button.hasAttribute('data-rl-expand')) {
			const index=Number(button.dataset.rlExpand);
			const card=button.closest('[data-rl-row]');
			const key=this._rowKey(this.draft[index],index);
			if (this.expandedIds.has(key)) { this.expandedIds.delete(key); }
			else { this.expandedIds.add(key); }
			const expanded=this.expandedIds.has(key);
			if (!expanded && this._recordCleanup) { this._recordCleanup(); }
			card.querySelector('[data-rl-details]').hidden=!expanded;
			button.textContent=expanded?'閉じる':'編集';
			button.setAttribute('aria-expanded',String(expanded));
			return;
		}
		if (button.hasAttribute('data-rl-variables-toggle')) {
			const index=Number(button.dataset.rlVariablesToggle);
			const key=this._rowKey(this.draft[index],index);
			const panel=button.closest('[data-rl-row]').querySelector('[data-rl-variables-panel]');
			const expanded=panel.hidden;
			panel.hidden=!expanded;
			if (expanded) { this.variablesOpen.add(key); } else { this.variablesOpen.delete(key); }
			button.setAttribute('aria-expanded',String(expanded));
			button.textContent='｛ ｝ 変数を挿入 '+(expanded?'▴':'▾');
			return;
		}
		if (button.hasAttribute('data-rl-save')) { this._save();return; }
		if (button.hasAttribute('data-rl-cancel')) { this._load();return; }
		if (button.hasAttribute('data-rl-add')) { this.addItem('link');return; }
		if (button.hasAttribute('data-rl-add-copy')) { this.addItem('copy');return; }
		const operations=['duplicate','delete','up','down'];
		const kind=operations.find(x=>button.hasAttribute('data-rl-'+x));
		if (!kind) { return; }
		const index=Number(button.getAttribute('data-rl-'+kind));
		if (!Number.isInteger(index) || index<0 || index>=this.draft.length) { return; }
		const next=this.draft.slice();
		if (kind==='duplicate') {
			if (next.length>=40) { return; }
			const old=next[index];
			if (!old || typeof old!=='object' || Array.isArray(old) || typeof old.id!=='string') { return; }
			const id=this._uniqueId(String(old.id).slice(0,55)+'-copy');
			next.splice(index+1,0,Object.assign({},old,{id}));
			this.expandedIds.add(id);
		} else if (kind==='delete') {
			const key=this._rowKey(next[index],index);
			this.expandedIds.delete(key);
			this.variablesOpen.delete(key);
			next.splice(index,1);
		} else {
			const other=kind==='up'?index-1:index+1;
			if (other<0 || other>=next.length) { return; }
			const entry=next.splice(index,1)[0];
			next.splice(other,0,entry);
		}
		this.draft=next;this.message='';this._render();
	}
	_clearDragVisuals() {
		this._dragFrom=null;
		this._dragAfter=false;
		this.container.querySelectorAll('.rl-is-dragging,.rl-drop-target,.rl-drop-before,.rl-drop-after')
			.forEach(card=>card.classList.remove(
				'rl-is-dragging','rl-drop-target','rl-drop-before','rl-drop-after'));
	}
	_onGripKeyDown(e) {
		const grip=e.target.closest?.('[data-rl-drag]');
		if (!grip || !e.altKey || !['ArrowUp','ArrowDown'].includes(e.key)) { return; }
		const from=Number(grip.dataset.rlDrag);
		const to=from+(e.key==='ArrowUp'?-1:1);
		if (to<0 || to>=this.draft.length) { return; }
		e.preventDefault();
		const next=this.draft.slice();
		next.splice(to,0,next.splice(from,1)[0]);
		this.draft=next;
		this.message='移動しました。下部の保存で確定します。';
		this._render();
		this.container.querySelector('[data-rl-drag="'+to+'"]')?.focus();
	}
	_onDragStart(e) {
		const grip=e.target.closest && e.target.closest('[data-rl-drag]');
		if (!grip || !this.container.contains(grip)) { return; }
		const from=Number(grip.dataset.rlDrag);
		if (!Number.isInteger(from) || from<0 || from>=this.draft.length) { return; }
		this._dragFrom=from;
		this.container.querySelector('[data-rl-row="'+from+'"]')
			?.classList.add('rl-is-dragging');
		if (e.dataTransfer) {
			e.dataTransfer.effectAllowed='move';
			e.dataTransfer.setData('text/plain',String(from));
		}
	}
	_onDragOver(e) {
		if (this._dragFrom===null) { return; }
		const card=e.target.closest && e.target.closest('[data-rl-row]');
		if (!card || !this.container.contains(card)) { return; }
		e.preventDefault();
		if (e.dataTransfer) { e.dataTransfer.dropEffect='move'; }
		const rect=card.getBoundingClientRect();
		this._dragAfter=rect.height>0 ?
			e.clientY>rect.top+rect.height/2 : this._dragFrom<Number(card.dataset.rlRow);
		this.container.querySelectorAll('.rl-drop-target,.rl-drop-before,.rl-drop-after')
			.forEach(node=>node.classList.remove('rl-drop-target','rl-drop-before','rl-drop-after'));
		card.classList.add('rl-drop-target',this._dragAfter?'rl-drop-after':'rl-drop-before');
	}
	_onDrop(e) {
		if (this._dragFrom===null) { return; }
		const card=e.target.closest && e.target.closest('[data-rl-row]');
		if (!card || !this.container.contains(card)) { return; }
		e.preventDefault();
		const from=this._dragFrom;
		const to=Number(card.dataset.rlRow);
		const after=this._dragAfter;
		this._clearDragVisuals();
		if (!Number.isInteger(to) || to<0 || to>=this.draft.length) { return; }
		const insertion=to+(after?1:0);
		const destination=from<insertion?insertion-1:insertion;
		if (from===destination) { return; }
		const next=this.draft.slice();
		next.splice(destination,0,next.splice(from,1)[0]);
		this.draft=next;
		this.message='並び順を変更しました。変更を保存すると確定します。';
		this._render();
	}
	dispose() {
		if (this._recordCleanup) { this._recordCleanup(); }
		this.container.removeEventListener('click',this._handleClick);
		this.container.removeEventListener('input',this._handleInput);
		this.container.removeEventListener('change',this._handleChange);
		this.container.removeEventListener('dragstart',this._handleDragStart);
		this.container.removeEventListener('dragover',this._handleDragOver);
		this.container.removeEventListener('drop',this._handleDrop);
		this.container.removeEventListener('dragend',this._handleDragEnd);
		this.container.removeEventListener('keydown',this._handleGripKeyDown);
		if (typeof this.config.off==='function') {
			this.config.off('update',this._handleConfigUpdate);
		}
		this.container.replaceChildren();
	}
}
// already required
// already required
// already required
// already required
class ModernAdvancedSettingsModel {
		static get CATEGORIES() {
				return [
						'再生・音声', '画面・映像', 'コメント表示',
						'NG・表示対象', 'プレイリスト・検索', 'ショートカット', 'マウス・タッチ'
				];
		}
		static _clone(value) {
				if (value === undefined || value === null || typeof value !== 'object') {
						return value;
				}
				return JSON.parse(JSON.stringify(value));
		}
		static _same(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
		static visibleExtraSettings() {
				const group = (category, subcategory, rows) => rows.map(([id, label, details = {}]) => ({ id, label, category, subcategory, ...details }));
				const slider = (min, max, step = 0.01) => ({ type: 'slider', min, max, step });
				const select = (items) => ({ type: 'select', options: items.map(([value, label]) => ({ value, label })) });
				const screenModes = select([
						['normal', '通常'], ['big', '大'], ['wide', 'ワイド'],
						['small', '小'], ['sideView', 'サイドビュー'], ['3D', '3D']
				]);
				const sharedNg = select([['NONE', '無効'], ['LOW', '弱'], ['MID', '中'],
						['HIGH', '強'], ['MAX', '最大']]);
				return [
						...group('再生・音声', '再生動作', [
								['autoPlay', '動画を自動再生'],
								['autoPlay:ginza', '公式の動画ページで自動再生'],
								['autoPlay:others', '外部サイトで自動再生'],
								['enableResume', '前回の再生位置を利用'],
								['loop', '動画をループ再生'],
								['autoPauseCommentInput', 'コメント入力中に動画を一時停止'],
								['playbackRate', '再生速度', { type: 'number' }],
								['enableSingleton', '複数のプレイヤーを同時起動しない']
						]),
						...group('再生・音声', '音量', [
								['volume', '動画の音量', slider(0, 1)],
								['mute', '動画をミュート']
						]),
						...group('再生・音声', '読み上げ', [
								['speakLark', 'コメント読み上げ（現在は未対応）', {
												description: '旧設定ですが、現在のZenzaWatchには再生コメントを音声化する処理が接続されていません。ONにしても読み上げません。保存値は互換性のため保持します。'
										}],
								['speakLarkVolume', '読み上げ音量（現在は未対応）', {
												...slider(0, 1),
												description: 'コメント読み上げ機能が未実装のため、この音量値も現在の再生には作用しません。'
										}]
						]),
						...group('再生・音声', '動画の取得', [
								['forceEconomy', 'エコノミー画質で取得'],
								['autoDisableNew', '旧配信方式の画質を優先'],
								['dmcVideoQuality', '旧配信方式の優先画質', select([
												['auto', '自動'], ['veryhigh', '最高'], ['high', '高'],
												['mid', '中'], ['low', '低']
										])],
								['domandVideoQuality', '新配信方式の優先画質', select([
												['auto', '自動'], ['1080p', '1080p'], ['720p', '720p'],
												['480p', '480p'], ['360p', '360p'], ['144p', '144p']
										])]
						]),
						...group('再生・音声', '公式プレイヤー連携', [
								['overrideGinza', '公式の視聴ページでZenzaWatchを優先']
						]),
						...group('画面・映像', '画面フィルター', [
								['screenFilter.flipH', '左右反転'],
								['screenFilter.flipV', '上下反転'],
								['screenFilter.applyToScreenshot', 'スクリーンショットにも映像フィルターを適用'],
								['screenFilter.applyToCommentPip', 'コメント付きPiPにも映像フィルターを適用']
						]),
						...group('画面・映像', '表示モード', [
								['screenMode', '通常の画面モード', screenModes],
								['screenMode:ginza', '公式動画ページの画面モード', screenModes],
								['screenMode:others', '外部サイトの画面モード', screenModes]
						]),
						...group('画面・映像', '小画面モード', [
								['smallModeAspectLock', '小モードで縦横比を固定'],
								['controlBar.showOnPause.small', '一時停止時に操作バーを表示', {
												description: '既定ON。「小」モードでは一時停止時に操作バーを表示します。動画や下コメントを隠したくない場合はOFFにできます。マウス操作による表示は維持します。'
										}],
								['controlBar.hideAfterSeconds.small', '操作バーが消えるまでの時間', {
												...slider(0.2, 10, 0.1), unit: '秒',
												description: '「小」モードでマウス移動などにより表示した操作バーを隠すまでの時間。初期値3秒。実際の全画面表示中は全画面側の設定を使います。'
										}]
						]),
						...group('画面・映像', '全画面モード', [
								['autoFullScreen', '自動でフルスクリーン'],
								['fullscreenControlBarMode', '全画面での操作バー', select([
												['auto', '自動'], ['always-show', '常に表示'],
												['always-hide', '常に隠す']
										])],
								['controlBar.showOnPause.fullscreen', '一時停止時に操作バーを表示', {
												description: '既定OFF。全画面・ワイド・3Dで一時停止しただけでは操作バーを表示しません。マウス操作は従来どおり可能です。操作バーの「常に表示／常に隠す」を優先します。'
										}],
								['controlBar.hideAfterSeconds.fullscreen', '操作バーが消えるまでの時間', {
												...slider(0.2, 10, 0.1), unit: '秒',
												description: '全画面・ワイド・3Dで操作バーを自動で隠すまでの時間。初期値0.4秒。「常に表示／常に隠す」では自動非表示の設定は作用しません。'
										}]
						]),
						...group('画面・映像', 'PiP（小窓再生）', [
								['pipPageThumbnail', 'PiP中、元の画面にサムネイルを表示', {
												description: 'PiP（別の小窓）で動画を再生している間、元のZenzaWatchの動画領域に静止画を表示します。通常のPiPとコメント付きPiPの両方に共通します。\nこの設定をOFFにすると、元画面のサムネイルは表示されず、「元画面のサムネイルの選び方」も選択できなくなります。小窓内の動画・コメントには影響しません。'
										}],
								['pipPageThumbnailSource', '元画面のサムネイルの選び方', {
												...select([
														['smart', '自動切替（推奨）'],
														['legacy', '従来方式（OGP優先）']
												]),
												description: [
														'【なぜ切り替えが必要？】',
														'ニコニコ動画の公式APIは「OGP画像（SNS共有用、主に1280×720）」と「Player画像（視聴プレイヤー用、主に960×540）」を別々に返します。OGPの一部には、中央に大きな再生マークが画像自体に焼き込まれています。ZenzaWatchの再生ボタンが重なっているのではありません。',
														'',
														'【自動切替（推奨）】',
														'OGPが img.cdn.nimg.jp の元画像なら、高解像度のOGPを優先します（例：sm46962870）。OGPが goptim.video.nimg.jp 等の別配信元なら、再生マークを避けるためPlayer画像を優先します（例：sm46949237）。確認されたgoptim画像は候補から外し、画像が読み込めない場合はほかのサムネイルへ切り替えます。',
														'',
														'【従来方式（OGP優先）】',
														'配信元を区別せず、OGPの1280×720画像から順に表示します。元の高解像度画像を優先できますが、goptim配信の動画では中央に大きな再生マークが表示される場合があります。その場合も画像には手を加えません。',
														'',
														'【注意】',
														'この判定は現在確認できた配信方式に基づくもので、すべての動画で再生マークが消えることを保証するものではありません。選択は元ページの静止画だけに適用され、PiP小窓の動画画質・再生速度・コメントには影響しません。画像のURLは公式APIが返す値をそのまま使います。'
												].join('\n')
										}]
						]),
						...group('画面・映像', 'プレイヤーの操作表示', [
								['enableHeatMap', 'ヒートマップを表示'],
								['enableStoryboard', 'シークバーのサムネイルを表示'],
								['enableStoryboardBar', 'シーンサーチバーを表示'],
								['menuScale', '操作メニューの拡大率', { type: 'number' }]
						]),
						...group('画面・映像', 'シーンサーチ', [
								['sceneSearch.presentation.normal', '通常表示のシーンサーチ', {
												...select([['follow', 'シーク位置に追従'], ['fixed', '位置を固定'], ['legacy', '従来表示']])
										}],
								['sceneSearch.presentation.fullscreen', '全画面のシーンサーチ', {
												...select([['follow', 'シーク位置に追従'], ['fixed', '位置を固定'], ['legacy', '従来表示']])
										}],
								['sceneSearch.layout.normal', '旧形式の通常表示', { hidden: true,
												...select([
														['00', '00 旧式表示（検証中）'],
														['01', '01 クラシック追従'], ['02', '02 左右ツインパネル'],
														['03', '03 サイドシェルフ'], ['04', '04 トップエッジ'],
														['05', '05 プレイバック・デッキ'], ['06', '06 マイクロ・カプセル'],
														['07', '07 3コマ・フィルム'], ['08', '08 片側引き出し'],
														['09', '09 分離リモコン'], ['10', '10 スマート自動回避']
												]), description: '通常時のレイアウトです。動画の再生位置や設定値は変更しません。' }],
								['sceneSearch.layout.linkFullscreen', '全画面も同じ表示方式を使う', {
												description: 'ONにしても全画面用に保存したレイアウトは消えません。OFFに戻すとその設定を再利用します。'
										}],
								['sceneSearch.layout.fullscreen', '旧形式の全画面表示', { hidden: true,
												...select([
														['00', '00 旧式表示（検証中）'],
														['01', '01 クラシック追従'], ['02', '02 左右ツインパネル'],
														['03', '03 サイドシェルフ'], ['04', '04 トップエッジ'],
														['05', '05 プレイバック・デッキ'], ['06', '06 マイクロ・カプセル'],
														['07', '07 3コマ・フィルム'], ['08', '08 片側引き出し'],
														['09', '09 分離リモコン'], ['10', '10 スマート自動回避']
												]), description: '通常表示と別のUIを使えます。連動がONのときは保存値を保持したまま適用を休止します。' }],
								['sceneSearch.seekStepSeconds', 'シーンサーチ内の前後シーク秒数', {
												type: 'number', description: '0〜600の整数。0にすると左右のシーク矢印を非表示にして枠を小型化します。既存のキーボード用カスタムシーク設定は変更しません。'
										}],
								['sceneSearch.enabled', 'シーンサーチを表示', {
												description: 'シーンサーチ全体を表示します。OFFでもコメントの個別設定や大きさは保持します。'
										}],
								['sceneSearch.commentListScale', 'コメントプレビューの大きさ', {
												...slider(100, 200, 1), unit: '%', description: '文字サイズは変えず、表示領域を広げて一度に見えるコメントを増やします。画面に収まる範囲で適用します。'
										}],
								['sceneSearch.commentPreviewVisible', 'シーンサーチのコメント表示', {
												description: 'ミニコメントとコメントプレビューの共通スイッチです。OFFの間は両方を隠し、下の個別設定は保持します。右側の動画コメント欄とは別です。'
										}],
								['sceneSearch.miniCommentVisible', 'ミニコメントを表示する', {
												description: 'サムネイル画像上のミニコメントを表示します。すべての表示方式で共通です。親のコメント表示をONにすると、この設定を再利用します。'
										}],
								['sceneSearch.commentListVisible', 'コメントプレビューを表示する', {
												description: 'コメントボタンで一覧を開けるようにします。ONにしても一覧は自動では開きません。すべての表示方式で共通です。親のコメント表示をONにすると、この設定を再利用します。'
										}],
								['sceneSearch.commentListBackgroundOpacity', 'コメントプレビューの背景濃度', {
												...slider(0, 100, 1), unit: '%',
												description: '一覧の背景だけを調整します。文字の濃さは変わりません。0%は透明、100%は不透明です。すべての表示方式で、通常表示・全画面共通です。'
										}],
								['sceneSearch.thumbnailScale', 'サムネイルの大きさ', {
												...slider(50, 200, 1), unit: '%',
												description: 'サムネイル画像と画像上のミニコメントを一緒に拡大・縮小します。操作ボタンの大きさは変わりません。画面に収まる範囲で表示します。すべての表示方式で、通常表示・全画面共通です。'
										}],
								['sceneSearch.miniCommentMode', '画像上のミニコメントの表示方式', {
												...select([
														['flow', '流れる（旧版と同じ）'],
														['static', '静止表示（最大5行）'],
														['hidden', '旧版の非表示設定（引き継ぎ用）']
												]),
												description: 'ミニコメントの動き方を選びます。表示のON/OFFは上の子スイッチを使います。旧版の静止表示設定も引き継ぎます。'
										}],
								['enableCommentPreview', 'コメントプレビューを開いた状態にする', {
												description: 'コメントボタンによる一覧の開閉と共通です。追従・固定は画像の隣に一覧を表示し、従来表示は切り替えます。上の許可スイッチがOFFの間は閉じた状態になります。'
										}],
								['sceneSearch.controlsReveal', '追加ボタンの開き方', { hidden: true,
												...select([
														['hover-focus', 'マウスを乗せるかフォーカスで開く'],
														['click', 'クリックで開く'], ['always', '常に表示']
												]) }],
								['sceneSearch.animation', 'UIのアニメーション', {
												...select([
														['off', '無効（動きなし）'], ['subtle', '控えめ（推奨）'], ['full', '通常']
												])
										}],
								['sceneSearch.idleHideSeconds', 'プレビューを自動で隠すまでの時間', {
												...slider(0, 30, 0.5), unit: '秒',
												description: 'シークバー上にマウスを置き続けたとき、同じプレビューを表示する時間です。画像とコメント一覧で共通です。既定2秒。0秒にすると自動非表示を無効化します。ピン固定・ドラッグ・ボタン操作中は隠しません。'
										}]
						]),
						...group('画面・映像', '通知・ポップアップ', [
								['popup.notifyColor', '通常・成功通知の背景色', {
												type: 'color', hexOnly: true,
												description: '一時的な緑色の通知の背景色です。#RRGGBB または #RGB で指定できます。保存するまでプレイヤーには反映されません。'
										}],
								['popup.alertColor', 'エラー通知の背景色', {
												type: 'color', hexOnly: true,
												description: '一時的な赤色のエラー通知の背景色です。#RRGGBB または #RGB で指定できます。保存するまでプレイヤーには反映されません。'
										}],
								['popup.backgroundTransparency', '通知背景の透明度', {
												...slider(0, 100, 1), unit: '%',
												description: '通常通知とエラー通知に共通の背景透明度です。0%は不透明（従来と同じ）、100%は背景が完全に透明です。文字や影、通知の表示時間には影響しません。'
										}]
						]),
						...group('画面・映像', 'スクリーンショット', [
								['screenshot.prefix', '保存ファイル名の先頭に追加する文字', { type: 'text',
												description: '任意の文字に加え {date}（保存日）や {watchId}（動画ID）などの変数も使えます。' }],
								['screenshot.filenameTemplate', '保存ファイル名の構成・順番', {
												type: 'text',
												description: '空欄は従来どおり「タイトル - 動画ID@再生位置.png」。プリセットまたは変数 {title} {watchId} {videoId} {uploader} {time} {date} {datetime} {suffix} を組み合わせて自由に指定できます。拡張子は常に.pngです。'
										}]
						]),
						...(typeof UiVisibilityRegistry === 'undefined' ? [] : UiVisibilityRegistry.descriptors()),
						...group('コメント表示', '表示・配置', [
								['showComment', 'コメントを表示'],
								['backComment', 'コメントを画面全体に流す', {
												description: '全画面・ワイド表示時に、動画を縮小せず画面全体へコメントを重ねます。通常表示では従来どおりです。'
										}],
								['commentSpeedRate', 'コメントの移動速度', { type: 'number' }],
								['autoCommentSpeedRate', 'コメント速度を自動調整'],
								['commentLayerOpacity', 'コメントの透明度', slider(0, 1)],
								['commentLayer.easyCommentOpacity', 'かんたんコメントの透明度', slider(0, 1)],
								['commentLayer.aiCommentOpacity', 'AIコメントの透明度', slider(0, 1)],
								['enableNicosJumpVideo', '@ジャンプを有効化']
						]),
						...group('コメント表示', 'コメント一覧', [
								['enableCommentPanel', 'コメント一覧を表示'],
								['enableCommentPanelAutoScroll', 'コメント一覧を自動スクロール']
						]),
						...group('コメント表示', '文字・装飾', [
								['commentLanguage', 'コメントの言語', select([
												['ja-jp', '日本語'], ['en-us', '英語（米国）'], ['zh-tw', '中国語（繁体字）']
										])],
								['baseFontFamily', 'コメントのフォント', {
												type: 'font-picker',
												description: '候補にないフォントは「その他（自由入力）」を選んで入力できます。使用できないフォントは代替フォントで表示されます。',
												options: [
														{ value: '', label: '標準（ZenzaWatchにおまかせ）' },
														{ value: "'Yu Gothic','Meiryo',sans-serif", label: '游ゴシック' },
														{ value: "'Meiryo',sans-serif", label: 'メイリオ' },
														{ value: "'MS Gothic',monospace", label: 'MS ゴシック' },
														{ value: "'Noto Sans JP',sans-serif", label: 'Noto Sans JP' },
														{ value: 'serif', label: '明朝系' },
														{ value: 'sans-serif', label: 'ゴシック系' },
														{ value: 'monospace', label: '等幅' }
												]
										}],
								['baseChatScale', 'コメント文字の拡大率', {
												...slider(0.5, 2, 0.1), unit: '倍',
												description: '0.5〜2.0倍、0.1倍刻み。1.0倍が標準の大きさです。'
										}],
								['baseFontBolder', 'コメント文字を太くする'],
								['cssFontWeight', '文字の太さ', select([
												['normal', '標準'], ['500', '少し太め'], ['600', 'やや太め'],
												['bold', '太字'], ['800', 'かなり太い'], ['900', '最も太い']
										])],
								['commentLayer.textShadowType', '文字の影の形式', {
												...select([
														['', '標準（軽い）'], ['shadow-type2', '輪郭を強調'],
														['shadow-type3', 'ぼかした影（重い）'],
														['shadow-stroke', '縁取り2（対応ブラウザのみ）'],
														['shadow-dokaben', 'ドカベン風']
												]), description: '文字の読みやすさに影響します。ぼかした影は処理が重く、縁取り2は一部環境で表示されません。ドカベン風は主に固定コメント向けです。'
										}],
								['commentLayer.ownerCommentShadowColor', '投稿者コメントの影色', {
												type: 'color',
												description: '色見本と #RRGGBB / #RGB 形式のどちらでも変更できます。従来の CSS 色名（green など）も保持できます。'
										}]
						]),
						...group('NG・表示対象', 'NG条件', [
								['enableFilter', 'NGフィルターを有効化'],
								['wordFilter', 'NGワード一覧', { type: 'textarea' }],
								['wordRegFilter', 'NGワード（正規表現）', { type: 'text' }],
								['wordRegFilterFlags', '正規表現の適用オプション', { type: 'regex-flags',
												description: 'i は大文字・小文字を区別しない設定です。通常は初期値の i をおすすめします。m は ^ と $ を改行ごとの先頭・末尾に、s は「.」に改行も含め、u はUnicodeの文字単位を扱います。' }],
								['userIdFilter', 'NGユーザーID一覧', { type: 'textarea' }],
								['commandFilter', 'NGコマンド一覧', { type: 'textarea',
												description: 'コマンドとはコメントの色・大きさ・表示位置などの指定です。1行に1つ記入すると、その文字列を含むコマンドのコメントがNGになります。現在はNGワードなどとの「いずれかに一致」で判定します（AND条件ではありません）。' }],
								['removeNgMatchedUser', 'NGに一致する投稿者のコメントを全除外'],
								['sharedNgLevel', 'NG共有の強度', sharedNg]
						]),
						...group('NG・表示対象', '複合NGルール（上級者向け）', [
								['ngComposite.rules', '複合NG・置換ルール', { type: 'composite-ng',
												description: '複数の条件をAND/OR/NOTで組み合わせ、コメントの非表示・置換・装飾解除などを設定します。詳細説明は画面内で開けます。' }]
						]),
						...group('NG・表示対象', 'コメント種別', [
								['filter.fork0', '通常コメントを表示'],
								['filter.fork1', '投稿者コメントを表示'],
								['filter.fork2', 'かんたんコメントを表示'],
								['filter.fork3', '追加コメント種別を表示'],
								['filter.defaultThread', '通常スレッド'],
								['filter.ownerThread', '投稿者スレッド'],
								['filter.communityThread', 'コミュニティスレッド'],
								['filter.nicosThread', 'ニコスクリプトのスレッド'],
								['filter.easyThread', 'かんたんコメントのスレッド'],
								['filter.aiThread', 'AIコメントのスレッド'],
								['filter.extraDefaultThread', '追加の通常スレッド'],
								['filter.extraOwnerThread', '追加の投稿者スレッド'],
								['filter.extraCommunityThread', '追加のコミュニティスレッド'],
								['filter.extraNicosThread', '追加のニコスクリプトスレッド'],
								['filter.extraEasyThread', '追加のかんたんコメントスレッド']
						]),
						...group('プレイリスト・検索', 'プレイリスト', [
								['playlist.maxItems', '連続再生で増えるプレイリストの保持上限', {
												presentation: 'dropdown',
												...select(Array.from({ length: 10 }, (_, index) => {
														const n = (index + 1) * 1000;
														return [n, `${n.toLocaleString('ja-JP')}件${n === 3000 ? '（初期値・推奨）' : n >= 8000 ? '（高負荷）' : ''}`];
												})),
												description: '1000～10000件を1000件刻みで選択します。初期値は3000件です。連続再生などで1件ずつ増える際の保持件数で、再生中の動画は残します。検索・マイリスト・シリーズ・投稿動画から取得した一覧は、設定値より多くても最大10000件まで保持します。複数の一覧を追加して10000件を超えると、既存動画を優先して余剰分を追加しません。設定を下げるだけでは現在の動画を削除しません。8000～10000件は高負荷になり得ます。動画が多いほど表示・並べ替え・保存が遅くなり、ブラウザの保存容量不足時は再読み込み後に復元できる件数が減るため、大きな一覧は書き出しも併用してください。'
										}],
								['playlistLoop', 'プレイリストをループ'],
								['continueNextPage', '再生中の動画をページ移動後も再開'],
								['enableAdDecoration', 'プレイリストで動画の装飾枠を表示']
						]),
						...group('プレイリスト・検索', '検索', [
								['videoSearch.wordCountMode', '検索候補のヒット件数を取得するタイミング', {
												...select([
														['on-demand', '必要なときだけ（推奨・低通信量）'],
														['auto', '自動で表示（通信量が増える）'],
														['off', '件数を表示しない（最も低通信量）']
												]),
												description: '検索行とタグ候補の件数を数える追加通信の設定です。「必要なときだけ」はマウスを乗せるか↑↓キーで選んだ候補のみ取得します。「自動」は検索語と表示中のタグ候補を順番に数えます。「表示しない」は件数の追加通信を行いません。通常の検索やタグ予測の通信には影響しません。'
										}],
								['videoSearch.videoIdSuggestMode', '検索欄に表示する候補の配置', {
												...select([
														['merged', 'すべて縦にまとめる'],
														['side', 'タグ候補と動画を左右に表示'],
														['delayed', 'タグ候補を先に表示、動画を後から表示']
												]),
												description: '検索候補と動画IDのカードをどう並べるかの設定です。検索件数の問い合わせ回数を減らす設定ではありません。'
										}],
								['search.limit', '検索1回で取得する最大動画数', {
												...slider(1, 5000, 1), unit: '件', input: null,
												description: '1～5000件を1件刻みで指定できます。初期値は1000件です。連続再生の保持上限とは別に、1回の動画・タグ検索から取り込む最大件数を決めます。取得済みの検索結果は保持上限を超えても残します。1～99件も指定した件数のまま使います。多いほど通信量と待ち時間が増え、候補のヒット件数表示には影響しません。検索APIの制約や予備検索への切り替えにより指定件数まで取得できない場合があります。'
										}]
						]),
						...group('プレイリスト・検索', '関連メニュー › カスタムリンク', [
								['relatedMenu.builtinOptions', '標準関連メニューの詳細編集', { type: 'related-builtin-options',
												description: '標準機能の表示名、開き方、動画IDコピーなどの設定です。' }],
								['relatedMenu.order', '関連メニューの並び順と表示／非表示', {
												type: 'related-order',
												description: '標準7件・カスタムリンク・登録アクションを同じ一覧で移動し、項目ごとに表示を切り替えます。非表示にしても機能や保存したリンクは削除しません。動画固有の表示条件は優先されます。'
										}],
								['relatedMenu.hiddenItems', '関連メニューで非表示にする項目', {
												type: 'related-visibility',
												description: '各行の「表示する」で設定します。非表示にしても設定や外部アクションの登録は維持されます。'
										}]
						]),
						...group('プレイリスト・検索', 'リンク・移動', [
								['overrideWatchLink', '動画リンクをZenzaWatchで開く'],
								['overrideWatchLink:others', '外部サイトの動画リンクをZenzaWatchで開く'],
								['enablePushState', 'ブラウザの履歴への反映を利用'],
								['allowOtherDomain', '外部サイトの連携を許可'],
								['loadLinkedChannelVideo', 'チャンネル動画のリンクを取得']
						]),
						...group('マウス・タッチ', 'マウス', [
								['enableTogglePlayOnClick', '動画クリックで再生・停止']
						]),
						...group('マウス・タッチ', 'タッチ', [
								['touch.enable', 'タッチジェスチャーを有効化']
						])
				];
		}
		static subcategoryPriority(category, subcategory) {
				const order = {
						'再生・音声': ['再生動作', '音量', '読み上げ', '動画の取得', '公式プレイヤー連携', '提供画面'],
						'画面・映像': ['表示モード', '小画面モード', '全画面モード', '動画ヘッダー', 'PiP（小窓再生）', 'プレイヤーの操作表示', 'シーンサーチ', '表示・非表示', '通知・ポップアップ', '画面フィルター', 'スクリーンショット'],
						'コメント表示': ['表示・配置', 'コメント一覧', '文字・装飾', '追加取得'],
						'NG・表示対象': ['NG条件', 'コメント種別', '動画の除外'],
						'プレイリスト・検索': ['プレイリスト', '検索', 'リンク・移動',
								'関連メニュー › カスタムリンク', '診断'],
						'ショートカット': ['プレイヤー全般', '再生', 'シーク', '再生速度', '音量', 'コメント',
								'画面', '画面フィルター', 'フィルタ/NG', 'プレイリスト', 'マイリスト', 'その他'],
						'マウス・タッチ': ['マウス', 'タッチ']
				};
				const index = (order[category] || []).indexOf(subcategory);
				return index < 0 ? 1000 : index;
		}
		static categoryFor(key, action) {
				if (key === 'relatedMenu.customLinks') {
						return ['プレイリスト・検索', '関連メニュー › カスタムリンク'];
				}
				if (/^KEY_/.test(key) || /^PARAM_CUSTOM_SEEK_/.test(key)) {
						return ['ショートカット', action && action.category || 'シーク'];
				}
				if (/^supporterCredit\./.test(key)) {
						return ['再生・音声', '提供画面'];
				}
				if (/^audio\./.test(key) || /^(volume|mute|speakLark)/.test(key)) {
						return ['再生・音声', '音量'];
				}
				if (/^(commentHistory\.|commentHistory[A-Z]|comments\.history|commentIncrease)/.test(key)) {
						return ['コメント表示', '追加取得'];
				}
				if (/^(touch\.|touch[A-Z])/.test(key)) {
						return ['マウス・タッチ', 'タッチ'];
				}
				if (/^(mouse|enableTogglePlayOnClick|enableFullScreenOnDoubleClick|enableDblclickClose)/.test(key)) {
						return ['マウス・タッチ', 'マウス'];
				}
				if (/^(word(Reg)?Filter|wordRegFilterFlags|video(Tag|Owner)Filter|enableFilter|sharedNg)/.test(key)) {
						return ['NG・表示対象', /^video(Tag|Owner)Filter/.test(key) ? '動画の除外' : 'NG条件'];
				}
				if (/^(commentLayer\.|enableCommentPanel|autoScrollComment)/.test(key)) {
						return ['コメント表示', key === 'enableCommentPanel' ? 'コメント一覧' : '表示・配置'];
				}
				if (/^screenFilter\./.test(key)) {
						return ['画面・映像', '画面フィルター'];
				}
				if (/^videoHeader\./.test(key)) {
						return ['画面・映像', '動画ヘッダー'];
				}
				if (/^(screen|smallMode|autoFullScreen|autoCloseFullScreen|fullscreen|enableBackComment)/.test(key)) {
						return ['画面・映像', '表示モード'];
				}
				if (/^(search\.|videoSearch\.|videoIdSuggest)/.test(key)) {
						return ['プレイリスト・検索', '検索'];
				}
				if (/^(playlist|enableAdDecoration|continueNextPage)/.test(key)) {
						return ['プレイリスト・検索', 'プレイリスト'];
				}
				if (/^(debug|diagnostic)/.test(key)) {
						return ['プレイリスト・検索', '診断'];
				}
				return ['再生・音声', '再生動作'];
		}
		static dependencyFor(key) {
				if (key === 'ui.scene.commentToggle' || key === 'ui.scene.commentSearch' || key === 'enableCommentPreview')
						return 'sceneSearch.commentListVisible';
				if (key.startsWith('ui.scene.'))
						return 'sceneSearch.enabled';
				if (key === 'sceneSearch.miniCommentMode')
						return 'sceneSearch.miniCommentVisible';
				if (key === 'sceneSearch.commentListScale' || key === 'sceneSearch.commentListBackgroundOpacity')
						return 'sceneSearch.commentListVisible';
				if (key.startsWith('sceneSearch.') && !['sceneSearch.enabled', 'sceneSearch.commentPreviewVisible', 'sceneSearch.miniCommentVisible', 'sceneSearch.commentListVisible'].includes(key))
						return 'sceneSearch.enabled';
				if (key.startsWith('commentHistory.') && key !== 'commentHistory.enabled') {
						return 'commentHistory.enabled';
				}
				if (key.startsWith('filter.') || ['wordFilter', 'wordRegFilter',
						'wordRegFilterFlags', 'userIdFilter', 'commandFilter', 'sharedNgLevel',
						'removeNgMatchedUser', 'ngComposite.rules'].includes(key)) {
						return 'enableFilter';
				}
				const direct = {
						'sceneSearch.commentPreviewVisible': 'sceneSearch.enabled',
						'sceneSearch.miniCommentVisible': 'sceneSearch.commentPreviewVisible',
						'sceneSearch.commentListVisible': 'sceneSearch.commentPreviewVisible',
						'supporterCredit.voice': 'supporterCredit.enable',
						'supporterCredit.gift': 'supporterCredit.enable',
						'supporterCredit.skipInPlaylist': 'supporterCredit.enable',
						'touch.tap2command': 'touch.enable', 'touch.tap3command': 'touch.enable',
						'touch.tap4command': 'touch.enable', 'touch.tap5command': 'touch.enable',
						'enableCommentPanelAutoScroll': 'enableCommentPanel',
						'pipPageThumbnailSource': 'pipPageThumbnail',
						'speakLarkVolume': 'speakLark'
				};
				return direct[key] || null;
		}
		constructor({ config, legacyRoot = null, actions = [], screenFilterParams = [], historySchema = [] }) {
				if (!config || !config.default) {
						throw new TypeError('Config defaults are required');
				}
				this.config = config;
				this.actions = actions.slice();
				this._screenParams = new Map((Array.isArray(screenFilterParams) ? screenFilterParams : [])
						.filter(p => p && typeof p.key === 'string')
						.map(p => ['screenFilter.' + p.key, p]));
				this._historyParams = new Map((Array.isArray(historySchema) ? historySchema : [])
						.filter(p => p && typeof p.key === 'string')
						.map(p => [p.key, p]));
				this._publicSettings = new Map(ModernAdvancedSettingsModel.visibleExtraSettings()
						.map((entry, index) => [entry.id, { ...entry, sortIndex: index }]));
				this._historyOrder = new Map((Array.isArray(historySchema) ? historySchema : [])
						.map((entry, index) => [entry.key, index + 1]));
				this._screenOrder = new Map((Array.isArray(screenFilterParams) ? screenFilterParams : [])
						.map((entry, index) => ['screenFilter.' + entry.key, index]));
				this.categories = ModernAdvancedSettingsModel.CATEGORIES.slice();
				this.descriptors = [];
				this._byId = new Map();
				const add = (descriptor) => {
						if (!descriptor || !descriptor.id || !Object.prototype.hasOwnProperty.call(config.default, descriptor.id)) {
								return;
						}
						if (descriptor.id === 'screenFilter.enable' || descriptor.id === 'screenFilter.saved') {
								return;
						}
						const publicEntry = this._publicSettings.get(descriptor.id);
						if (publicEntry) {
								descriptor = { ...descriptor, ...publicEntry };
						}
						const param = this._screenParams.get(descriptor.id);
						if (param) {
								const type = param.type === 'boolean' ? 'boolean' :
										param.type === 'select' ? 'select' : 'slider';
								descriptor = { ...descriptor, label: param.label, type,
										description: param.desc || descriptor.description || '',
										min: param.min, max: param.max, step: param.step, unit: param.unit || '',
										sortIndex: this._screenOrder.get(descriptor.id),
										options: type === 'select' ? (param.options || []).map(pair => ({
												value: pair[0], label: pair[1]
										})) : [],
										input: type === 'slider' ? null : descriptor.input };
						}
						const history = this._historyParams.get(descriptor.id);
						if (history) {
								descriptor = { ...descriptor, label: history.label,
										type: history.type === 'integer' ? 'slider' : history.type === 'boolean' ? 'boolean' : descriptor.type,
										description: history.description || descriptor.description || '',
										min: history.min, max: history.max, step: 1,
										sortIndex: this._historyOrder.get(descriptor.id),
										options: [],
										input: history.type === 'integer' ? null : descriptor.input };
						}
						if (this._byId.has(descriptor.id)) {
								return;
						}
						if (!this.categories.includes(descriptor.category)) {
								throw new Error('未定義のカテゴリ: ' + descriptor.category);
						}
						const entry = { ...descriptor, dependsOn: ModernAdvancedSettingsModel.dependencyFor(descriptor.id) };
						if (entry.id === 'commentHistory.enabled') {
								entry.sortIndex = 0;
						}
						this._byId.set(entry.id, entry);
						this.descriptors.push(entry);
				};
				if (legacyRoot && typeof legacyRoot.querySelectorAll === 'function') {
						legacyRoot.querySelectorAll('[data-setting-name],[data-history-setting]').forEach(input => {
								const id = input.dataset.settingName || (input.dataset.historySetting ?
										'commentHistory.' + input.dataset.historySetting : null);
								if (!id || /^KEY_/.test(id) || /^PARAM_CUSTOM_SEEK_\d+$/.test(id)) {
										return;
								}
								const category = ModernAdvancedSettingsModel.categoryFor(id);
								const labelNode = input.closest('label');
								const labelText = labelNode ? Array.from(labelNode.childNodes)
										.filter(n => n.nodeType === 3)
										.map(n => n.textContent.trim()).filter(Boolean).join(' ').trim() : '';
								let label = labelText;
								if (!label) {
										let node = input.previousElementSibling;
										while (!node && input.parentElement) {
												node = input.parentElement.previousElementSibling;
												break;
										}
										if (node && node.matches && node.matches('.caption,.caption.sub')) {
												label = node.textContent.trim();
										}
								}
								if (!label) {
										label = id;
								}
								const type = input.type === 'checkbox' ? 'boolean' : input.tagName === 'SELECT' ? 'select' :
										input.tagName === 'TEXTAREA' ? 'textarea' : 'text';
								const options = type === 'select' ?
										Array.from(input.options).map(o => ({
												value: typeof config.default[id] === 'number' ? Number(o.value) : o.value,
												label: o.textContent.trim()
										})) : [];
								const root = input.closest('.control');
								const note = root && root.querySelector('.settingNote');
								add({ id, label, category: category[0], subcategory: category[1], type, options,
										description: note ? note.textContent.trim() : '', input });
						});
				}
				actions.forEach(action => {
						if (!action || !action.id) {
								return;
						}
						const id = 'KEY_' + action.id;
						const [category, subcategory] = ModernAdvancedSettingsModel.categoryFor(id, action);
						add({ id, label: action.label || action.id, category, subcategory, type: 'shortcut',
								description: '', actionId: action.id, defaultKey: action.defaultKey });
						if (action.customSeekSlot) {
								const seek = 'PARAM_' + action.id;
								add({ id: seek, label: (action.label || action.id) + ' の秒数',
										category: 'ショートカット', subcategory: 'シーク',
										type: 'seconds', description: 'マイナスで戻る、プラスで進む', actionId: action.id });
						}
				});
				Object.keys(config.default).forEach(id => {
						if (!/^commentHistory\.|^screenFilter\./.test(id) && id !== 'touch.enable') {
								return;
						}
						const [category, subcategory] = ModernAdvancedSettingsModel.categoryFor(id);
						const value = config.default[id];
						const type = typeof value === 'boolean' ? 'boolean' : typeof value === 'number' ? 'number' : 'text';
						const name = id.slice(id.indexOf('.') + 1);
						add({ id, label: name, category, subcategory, type, options: [], description: '' });
				});
				this._publicSettings.forEach(entry => {
						const type = entry.type || (typeof config.default[entry.id] === 'boolean' ? 'boolean' :
								typeof config.default[entry.id] === 'number' ? 'number' : 'text');
						add({ ...entry, type, options: [], description: '' });
				});
				add({ id: 'relatedMenu.customLinks', label: 'カスタム関連メニューのリンク',
						category: 'プレイリスト・検索', subcategory: '関連メニュー › カスタムリンク',
						type: 'related-links', description: '' });
				const groupRank = (d) => [
						this.categories.indexOf(d.category),
						ModernAdvancedSettingsModel.subcategoryPriority(d.category, d.subcategory),
						Number.isFinite(d.sortIndex) ? d.sortIndex : 10000
				];
				this.descriptors.sort((a, b) => {
						const ar = groupRank(a), br = groupRank(b);
						for (let i = 0; i < ar.length; i++) {
								if (ar[i] !== br[i]) {
										return ar[i] - br[i];
								}
						}
						return 0;
				});
				this.cancel();
		}
		descriptor(id) { return this._byId.get(id) || null; }
		static get SHARED_VISIBILITY() {
				return typeof UiVisibilityRegistry === 'undefined' ? [] : UiVisibilityRegistry.SHARED_SETTINGS;
		}
		sectionDescriptors(category, subcategory) {
				const entries = this.descriptors.filter(d => d.category === category && d.subcategory === subcategory);
				if (category !== '画面・映像' || subcategory !== '表示・非表示') {
						return entries;
				}
				const aliases = ModernAdvancedSettingsModel.SHARED_VISIBILITY.map(([id, icon]) => {
						const original = this.descriptor(id);
						return original ? { ...original, category, subcategory, icon, visibilityScope: id.startsWith('sceneSearch.') ? 'scene-comments' : 'shared',
								sharedWith: original.category + ' / ' + original.subcategory } : null;
				}).filter((item) => item !== null);
				const scene = entries.filter(d => d.visibilityScope === 'scene');
				const sceneAliases = aliases.filter(d => d.visibilityScope === 'scene-comments');
				const firstScene = entries.findIndex(d => d.visibilityScope === 'scene');
				const ordered = entries.filter(d => d.visibilityScope !== 'scene');
				ordered.splice(firstScene < 0 ? ordered.length : firstScene, 0, ...sceneAliases, ...scene);
				return [...ordered, ...aliases.filter(d => d.visibilityScope !== 'scene-comments')];
		}
		_liveValue(id) {
				if (typeof this.config.resolveSceneSearch === 'function') {
						const scene = this.config.resolveSceneSearch();
						if (scene) {
								if (id === 'sceneSearch.enabled')
										return scene.enabled;
								if (id === 'sceneSearch.presentation.normal')
										return scene.normal;
								if (id === 'sceneSearch.presentation.fullscreen')
										return scene.fullscreen;
								if (id === 'sceneSearch.miniCommentVisible')
										return scene.miniVisible;
						}
				}
				const v = typeof this.config.getValue === 'function' ?
						this.config.getValue(id) : this.config.props?.[id];
				if (id === 'playlist.maxItems' && typeof v === 'number' && Number.isFinite(v) && v > 10000) {
						return 10000;
				}
				return ModernAdvancedSettingsModel._clone(v);
		}
		syncLiveValue(id) {
				if (!this._byId.has(id)) {
						return false;
				}
				const live = this._liveValue(id);
				if (ModernAdvancedSettingsModel._same(this.saved[id], live)) {
						return false;
				}
				this.saved[id] = ModernAdvancedSettingsModel._clone(live);
				this.draft[id] = ModernAdvancedSettingsModel._clone(live);
				return true;
		}
		cancel() {
				this.saved = {};
				this.draft = {};
				this.descriptors.forEach(descriptor => {
						const id = descriptor.id;
						this.saved[id] = this._liveValue(id);
						this.draft[id] = ModernAdvancedSettingsModel._clone(this.saved[id]);
				});
				return this;
		}
		get(id) {
				if (!this._byId.has(id)) {
						return undefined;
				}
				return ModernAdvancedSettingsModel._clone(this.draft[id]);
		}
		set(id, value) {
				const d = this.descriptor(id);
				if (!d) {
						throw new Error('不明な設定: ' + id);
				}
				if (typeof this.config.default[id] === 'number' && typeof value === 'string' &&
						value.trim() !== '' && Number.isFinite(Number(value))) {
						value = Number(value);
				}
				this.draft[id] = ModernAdvancedSettingsModel._clone(value);
				return this;
		}
		resetItem(id) { return this.set(id, this.config.default[id]); }
		resetSubcategory(category, subcategory) {
				this.sectionDescriptors(category, subcategory).forEach(d => this.resetItem(d.id));
				return this;
		}
		resetCategory(category) {
				this.descriptors.filter(d => d.category === category)
						.forEach(d => this.resetItem(d.id));
				return this;
		}
		isEnabled(id) {
				if (['sceneSearch.layout.fullscreen', 'sceneSearch.presentation.fullscreen'].includes(id) &&
						this.get('sceneSearch.layout.linkFullscreen') === true) {
						return false;
				}
				const d = this.descriptor(id);
				return !d || !d.dependsOn || !this._byId.has(d.dependsOn) ||
						(!!this.draft[d.dependsOn] && this.isEnabled(d.dependsOn));
		}
		isDifferentFromDefault(id) {
				return this._byId.has(id) && !ModernAdvancedSettingsModel._same(this.draft[id], this.config.default[id]);
		}
		isDirty() {
				return this.descriptors.some(d => !ModernAdvancedSettingsModel._same(this.draft[d.id], this.saved[d.id]));
		}
		changes() {
				return this.descriptors.filter(d => !ModernAdvancedSettingsModel._same(this.draft[d.id], this.saved[d.id]))
						.map(d => ({ id: d.id, value: ModernAdvancedSettingsModel._clone(this.draft[d.id]) }));
		}
		validate() {
				const errs = [];
				for (const change of this.changes()) {
						const { id, value } = change;
						const basic = typeof value === typeof this.config.default[id] &&
								(typeof value !== 'number' || Number.isFinite(value));
						const descriptor = this.descriptor(id);
						const rangeOk = descriptor.type !== 'slider' ||
								(typeof value === 'number' &&
										(descriptor.min === undefined || value >= descriptor.min) &&
										(descriptor.max === undefined || value <= descriptor.max));
						const stepOk = descriptor.type !== 'slider' || !Number.isFinite(descriptor.step) ||
								descriptor.step <= 0 ||
								Math.abs((value - (descriptor.min || 0)) / descriptor.step -
										Math.round((value - (descriptor.min || 0)) / descriptor.step)) < 1e-6;
						const colorOk = descriptor.type !== 'color' ||
								(typeof value === 'string' && (descriptor.hexOnly === true ?
										/^#(?:[a-fA-F0-9]{3}|[a-fA-F0-9]{6})$/.test(value) :
										/^(?:#[a-fA-F0-9]{3}|#[a-fA-F0-9]{6}|[a-zA-Z]+)$/.test(value)));
						const prefixOk = id !== 'screenshot.prefix' ||
								(typeof value === 'string' && !/[<>:"/\\|?*\u0000-\u001f]/.test(value));
						const valid = basic && rangeOk && stepOk && colorOk && prefixOk &&
								(!this.config.options?.validateImport || this.config.options.validateImport(id, value));
						if (!valid) {
								errs.push({ id, message: prefixOk ?
												'無効な設定値です' : 'ファイル名に使用できない文字が含まれています' });
						}
				}
				if (this.changes().some(change => change.id === 'wordRegFilter' || change.id === 'wordRegFilterFlags')) {
						try {
								new RegExp((this.get('wordRegFilter') || ''), (this.get('wordRegFilterFlags') || ''));
						}
						catch (error) {
								errs.push({ id: 'wordRegFilterFlags', message: '正規表現の条件またはフラグが不正です' });
						}
				}
				return errs;
		}
		save() {
				const changes = this.changes();
				const errors = this.validate();
				if (errors.length) {
						throw new Error('不正な設定値: ' + errors.map(e => e.id).join(', '));
				}
				for (const { id } of changes) {
						if (!ModernAdvancedSettingsModel._same(this._liveValue(id), this.saved[id])) {
								throw new Error('設定が外部で更新されました。競合: ' + id);
						}
				}
				if (changes.length && this.config.readonly) {
						throw new Error('このページでは設定を保存できません（読み取り専用）');
				}
				const attempted = [];
				try {
						for (const { id, value } of changes) {
								attempted.push(id);
								if (id.startsWith('sceneSearch.') && typeof this.config.persistSceneSearchSelection === 'function') {
										this.config.persistSceneSearchSelection({ [id]: ModernAdvancedSettingsModel._clone(value) });
								}
								else {
										this.config.setValue(id, ModernAdvancedSettingsModel._clone(value));
								}
								if (this.config.storage && typeof this.config.getStorageKey === 'function') {
										const native = typeof this.config.getNativeKey === 'function' ?
												this.config.getNativeKey(id) : id;
										const storageKey = this.config.getStorageKey(native);
										if (this.config.storage[storageKey] !== JSON.stringify(value)) {
												throw new Error('設定保存の確認に失敗しました: ' + id);
										}
								}
						}
				}
				catch (error) {
						for (const id of attempted.reverse()) {
								try {
										this.config.setValue(id, ModernAdvancedSettingsModel._clone(this.saved[id]));
								}
								catch (_) { /* original error remains authoritative */ }
						}
						throw error;
				}
				this.cancel();
				return changes.length;
		}
		search(query) {
				const q = String(query || '').trim().toLocaleLowerCase();
				if (!q) {
						return this.descriptors.filter(d => !d.hidden);
				}
				return this.descriptors.filter(d => !d.hidden &&
						[d.id, d.label, d.category, d.subcategory, d.description, ...(d.aliases || [])]
								.join(' ').toLocaleLowerCase().includes(q));
		}
		keyConflicts(value) {
				const key = Number(value) || 0;
				if (!key) {
						return [];
				}
				const names = [];
				this.actions.forEach(action => {
						if (Number(this.draft['KEY_' + action.id]) === key) {
								names.push(action.label || action.id);
						}
				});
				const links = this.draft['relatedMenu.customLinks'];
				if (Array.isArray(links)) {
						links.forEach(link => {
								if (link && Number(link.shortcutKey) === key && link.enabled !== false) {
										names.push(link.label || link.id);
								}
						});
				}
				return names;
		}
}
class ModernAdvancedSettingsUI {
		_updateSceneSettingsPreview() {
				const demo = this.cards?.querySelector('[data-zw-scene-demo]');
				if (!demo)
						return;
				const state = this._sceneDemoState, get = (key) => this.model.get('sceneSearch.' + key);
				const screen = state.screen, mode = get('presentation.' + (screen === 'fullscreen' && !get('layout.linkFullscreen') ? 'fullscreen' : 'normal'));
				const stage = demo.querySelector('[data-zw-demo-stage]');
				stage.dataset.screen = screen;
				for (const b of demo.querySelectorAll('[data-demo-screen]'))
						b.setAttribute('aria-pressed', String(b.dataset.demoScreen === screen));
				const panels = demo.querySelector('[data-zw-demo-panels]');
				panels.hidden = get('enabled') === false;
				const master = get('commentPreviewVisible') !== false, allowed = master && get('commentListVisible') !== false;
				const open = allowed && state.list, legacy = mode === 'legacy';
				const scale = Math.max(.5, Math.min(2, Number(get('thumbnailScale')) / 100 || 1));
				const listScale = Math.max(1, Math.min(2, Number(get('commentListScale')) / 100 || 1));
				const image = demo.querySelector('.zw-scene-demo-image'), thumb = demo.querySelector('.zw-scene-demo-thumb'), list = demo.querySelector('.zw-scene-demo-list');
				image.hidden = legacy && open;
				image.style.width = 120 * scale + 'px';
				image.style.height = 60 * scale + 'px';
				const mini = demo.querySelector('.zw-scene-demo-mini');
				mini.hidden = !master || get('miniCommentVisible') === false;
				mini.style.fontSize = 11 * scale + 'px';
				list.hidden = !open;
				list.style.width = 155 * listScale + 'px';
				list.style.height = 140 * listScale + 'px';
				list.style.backgroundColor = 'rgba(7,13,24,' + Math.max(0, Math.min(100, Number(get('commentListBackgroundOpacity')))) / 100 + ')';
				for (const row of list.querySelectorAll('div'))
						row.remove();
				for (let i = 0; i < 24; i++) {
						const row = this.doc.createElement('div');
						row.textContent = '01:' + String(20 + i).padStart(2, '0') + '  ' + ['この場面が好き', 'いいね！', 'もう一度見たい', 'ここから楽しみ'][i % 4];
						list.append(row);
				}
				if (legacy && open) {
						thumb.prepend(list);
						thumb.style.width = 155 * listScale + 'px';
				}
				else {
						panels.append(list);
						thumb.style.width = '';
				}
				const button = demo.querySelector('[data-demo-comments]');
				button.disabled = !allowed;
				button.setAttribute('aria-pressed', String(open));
				for (const b of demo.querySelectorAll('[data-demo-back],[data-demo-next]'))
						b.hidden = Number(get('seekStepSeconds')) === 0;
				const width = stage.clientWidth || 400, total = (legacy ? (open ? 155 * listScale : 120 * scale) : 120 * scale + (open ? 161 * listScale : 0)) + 4;
				panels.style.left = Math.max(6, Math.min(width - total - 6, mode === 'fixed' ? 10 : width * state.seek / 100 - total / 2)) + 'px';
				demo.querySelector('[data-demo-caption]').textContent = panels.hidden ? 'シーンサーチは非表示です。個別設定は保持されます。' :
						(legacy ? '従来表示：画像とコメントプレビューを切り替えます。' : mode === 'fixed' ? '位置を固定：同じ場所に表示します。' : 'シーク位置に追従：シーク先に合わせて動きます。') + ' 文字サイズを保ったまま、表示領域を調整します。';
		}
		_createSceneSettingsPanel(rows) {
				const wrap = this.doc.createElement('div');
				wrap.className = 'zw-scene-settings';
				const style = this.doc.createElement('style');
				style.textContent = `
			.zw-scene-settings{display:grid;grid-template-columns:minmax(280px,1fr) minmax(300px,1fr);gap:20px;align-items:start}
			.zw-scene-settings .zw-scui-layout-grid{grid-template-columns:repeat(3,minmax(0,1fr))}
			.zw-scene-settings .zw-scui-layout-option{background:#182b40;color:#dce8f6;border:1px solid #445b72;border-radius:10px;padding:10px;text-align:left;cursor:pointer}
			.zw-scene-settings .zw-scui-layout-option[aria-pressed=true]{background:#203f5b;border-color:#79c8f5;box-shadow:0 0 10px #68baff30}
			.zw-scene-settings .zw-scui-layout-option:disabled{opacity:.5;cursor:default}
			.zw-scene-settings .zw-scui-mini{height:68px;margin-bottom:8px}
			.zw-scene-settings .zw-scui-mini[data-layout=legacy] b{left:25%!important;width:50%}
			.zw-scene-settings .zw-scui-mini[data-layout=legacy] i{display:none}
			.zw-scene-settings h4{margin:22px 0 10px;color:#b9d7ee;font-size:14px}
			.zw-scene-settings .zw-modern-card{margin-bottom:10px}
			.zw-scene-settings .zw-scene-extra{margin-top:18px}
			.zw-scene-settings .zw-scene-extra summary{cursor:pointer;padding:12px 0}
			.zw-scene-demo{position:sticky;top:12px;background:#152336;border:1px solid #40566e;border-radius:14px;padding:16px;min-width:0}
			.zw-scene-demo p{color:#a9bdd2;font-size:12px;line-height:1.7}
			.zw-scene-demo button{background:#263d55;color:#e6f2ff;border:1px solid #506780;border-radius:7px;padding:7px 10px;cursor:pointer}
			.zw-scene-demo button[aria-pressed=true]{background:#346086;border-color:#8bd2ff}
			.zw-scene-demo button:focus-visible{outline:2px solid #93d7ff;outline-offset:2px}
			.zw-scene-demo nav{display:flex;gap:6px;margin:12px 0;flex-wrap:wrap}
			.zw-scene-demo-stage{height:340px;position:relative;overflow:hidden;background:#0a131f;border:1px solid #3d5067;border-radius:9px}
			.zw-scene-demo-video{position:absolute;inset:14px 28% 70px 10px;background:linear-gradient(150deg,#35657b,#203b55 45%,#766d55);display:grid;place-items:center;color:#d1e3eb;font-size:13px;border-radius:5px;transition:inset .15s}
			.zw-scene-demo-stage[data-screen=fullscreen] .zw-scene-demo-video{inset:0 0 30px;border-radius:0}
			.zw-scene-demo-stage[data-screen=small] .zw-scene-demo-video{inset:12px 42% 56% 12px}
			.zw-scene-demo-panels{position:absolute;bottom:40px;display:flex;gap:6px;align-items:flex-start;max-width:calc(100% - 12px)}
			.zw-scene-demo [hidden]{display:none!important}
			.zw-scene-demo-thumb{background:#0d1927;border:1px solid #48627b;border-radius:6px;overflow:hidden;flex:none}
			.zw-scene-demo-image{background:linear-gradient(145deg,#427d90,#213f57 55%,#c29a63);position:relative;overflow:hidden;display:grid;place-items:center;color:#b7cbd9}
			.zw-scene-demo-mini{position:absolute;left:8%;top:25%;white-space:nowrap;color:white;text-shadow:1px 1px 2px black;font-size:11px}
			.zw-scene-demo-time{text-align:center;padding:4px;font-size:11px;color:#d9e9f6}
			.zw-scene-demo-controls{display:flex;gap:3px;padding:0 3px 3px}
			.zw-scene-demo-controls button{flex:1;padding:5px 3px}
			.zw-scene-demo-list{box-sizing:border-box;border:1px solid #4f6882;border-radius:6px;overflow:hidden;flex-shrink:1;color:#e4edf6;font-size:11px;line-height:21px}
			.zw-scene-demo-list strong{display:block;padding:4px 7px;border-bottom:1px solid #52677b;font-size:11px}
			.zw-scene-demo-list div{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:0 7px}
			.zw-scene-demo-seek{position:absolute;bottom:9px;left:3%;width:94%;accent-color:#80caff}
			@media(max-width:1100px){.zw-scene-settings{grid-template-columns:minmax(0,1fr)}.zw-scene-demo{position:static;grid-row:1}}
		`;
				const controls = this.doc.createElement('div');
				controls.append(this._createSceneLayoutPicker());
				const remaining = new Map(rows.map(row => [row.dataset.zwId, row]));
				for (const [title, keys] of [
						['画面ごとの表示', ['sceneSearch.layout.linkFullscreen']],
						['表示するもの', ['sceneSearch.enabled', 'sceneSearch.commentPreviewVisible', 'sceneSearch.miniCommentVisible', 'sceneSearch.commentListVisible']],
						['大きさと背景', ['sceneSearch.thumbnailScale', 'sceneSearch.commentListScale', 'sceneSearch.commentListBackgroundOpacity']],
						['操作と自動非表示', ['sceneSearch.seekStepSeconds', 'sceneSearch.idleHideSeconds']]
				]) {
						const heading = this.doc.createElement('h4');
						heading.textContent = title;
						controls.append(heading);
						for (const key of keys) {
								const row = remaining.get(key);
								if (row) {
										controls.append(row);
										remaining.delete(key);
								}
						}
				}
				if (remaining.size) {
						const extra = this.doc.createElement('details');
						extra.className = 'zw-scene-extra';
						const summary = this.doc.createElement('summary');
						summary.textContent = 'その他のシーンサーチ設定';
						extra.append(summary, ...remaining.values());
						controls.append(extra);
				}
				const demo = this.doc.createElement('aside');
				demo.className = 'zw-scene-demo';
				demo.dataset.zwSceneDemo = '';
				demo.setAttribute('aria-label', '設定のプレビュー');
				demo.innerHTML = '<strong>見ながら調整</strong><p>設定の見え方を確認する見本です。下のシークバーとコメントボタンを試せます。</p><nav aria-label="見本の画面"></nav><div class="zw-scene-demo-stage" data-zw-demo-stage><div class="zw-scene-demo-video">動画</div><div class="zw-scene-demo-panels" data-zw-demo-panels><div class="zw-scene-demo-thumb"><div class="zw-scene-demo-image">サムネイル<span class="zw-scene-demo-mini">ここ好き　いいね！</span></div><div class="zw-scene-demo-time">01:24</div><div class="zw-scene-demo-controls"><button type="button" data-demo-back aria-label="前へ">‹</button><button type="button" data-demo-comments aria-label="コメントプレビューを開閉">☁</button><button type="button" data-demo-next aria-label="次へ">›</button></div></div><div class="zw-scene-demo-list"><strong>コメントプレビュー</strong></div></div><input class="zw-scene-demo-seek" type="range" min="0" max="100" aria-label="見本のシーク位置"></div><p data-demo-caption></p>';
				this._sceneDemoState = this._sceneDemoState || { screen: 'normal', seek: 35, list: true };
				const nav = demo.querySelector('nav');
				for (const [screen, label] of [['normal', '通常表示'], ['fullscreen', '全画面'], ['small', '小画面']]) {
						const b = this.doc.createElement('button');
						b.type = 'button';
						b.textContent = label;
						b.dataset.demoScreen = screen;
						b.addEventListener('click', () => {
								this._sceneDemoState.screen = screen;
								this._sceneLayoutTab = screen === 'fullscreen' ? 'fullscreen' : 'normal';
								this.cards.querySelector('[data-zw-scene-layout-gallery]')?.replaceWith(this._createSceneLayoutPicker());
								this._updateSceneSettingsPreview();
						});
						nav.append(b);
				}
				const seek = demo.querySelector('input');
				seek.value = String(this._sceneDemoState.seek);
				seek.addEventListener('input', () => { this._sceneDemoState.seek = Number(seek.value); this._updateSceneSettingsPreview(); });
				demo.querySelector('[data-demo-comments]').addEventListener('click', () => { this._sceneDemoState.list = !this._sceneDemoState.list; this._updateSceneSettingsPreview(); });
				for (const [selector, sign] of [['[data-demo-back]', -1], ['[data-demo-next]', 1]]) {
						demo.querySelector(selector).addEventListener('click', () => { this._sceneDemoState.seek = Math.max(0, Math.min(100, this._sceneDemoState.seek + sign * Number(this.model.get('sceneSearch.seekStepSeconds') || 0))); seek.value = String(this._sceneDemoState.seek); this._updateSceneSettingsPreview(); });
				}
				wrap.append(style, controls, demo);
				return wrap;
		}
		static _style(doc) {
				if (doc.querySelector('style[data-zw-modern-ui]')) {
						return;
				}
				const style = doc.createElement('style');
				style.setAttribute('data-zw-modern-ui', '');
				style.textContent = [
						'.zenzaAdvancedSettingPanel.zw-modern-active { position:fixed !important; inset:0 !important; width:auto !important; height:auto !important; min-width:0; max-width:none !important; max-height:none !important; margin:0 !important; transform:none !important; transition:none !important; border:0; padding:0; background:#101927; border-radius:0; z-index:2147483647 !important; overflow:hidden; box-sizing:border-box; }',
						'.zenzaAdvancedSettingPanel.zw-modern-active:not(.show) { display:none !important; }',
						'.zenzaAdvancedSettingPanel.zw-modern-active.show { display:block; opacity:1; pointer-events:auto; box-shadow:none; }',
						'.zenzaAdvancedSettingPanel.zw-modern-active > .settingPanelInner { display:none !important; }',
						'.zenzaAdvancedSettingPanel.zw-modern-active > .zenzaAdvancedSetting-close { display:none !important; }',
						'.zw-modern-root { --zw-dark-bg:#101927; --zw-dark-side:#141e2d; --zw-dark-panel:#1b293a; --zw-dark-card:#243449; --zw-dark-border:#2b394b; --zw-dark-text:#edf4ff; --zw-dark-muted:#a5b7cb; --zw-dark-accent:#82bfff; --zw-sidebar-width:290px; color-scheme:dark; color:var(--zw-dark-text); background:var(--zw-dark-bg); display:flex; flex-direction:column; width:100%; height:100%; font:13px/1.45 system-ui,"Yu Gothic UI",Meiryo,sans-serif; box-sizing:border-box; user-select:text; }',
						'.zw-modern-root *, .zw-modern-root *::before, .zw-modern-root *::after { box-sizing:border-box; }',
						'.zenzaAdvancedSettingPanel.zw-modern-active .zw-modern-root label { width:auto; height:auto; padding:0; margin:0; min-width:0; }',
						'.zenzaAdvancedSettingPanel.zw-modern-active .zw-modern-root input[type=checkbox] { transform:none; margin:0; }',
						'.zenzaAdvancedSettingPanel.zw-modern-active .zw-modern-root input[type=text],.zenzaAdvancedSettingPanel.zw-modern-active .zw-modern-root select { font-size:inherit; margin:0; }',
						'.zenzaAdvancedSettingPanel.zw-modern-active .zw-modern-root input[type=text] { width:auto; }',
						'.zenzaAdvancedSettingPanel.zw-modern-active .zw-modern-cardcontrols label:has(textarea),.zenzaAdvancedSettingPanel.zw-modern-active .zw-modern-cardcontrols label:has(input[type=text]) { width:100%; display:flex; }',
						'.zw-modern-root button, .zw-modern-root input, .zw-modern-root select, .zw-modern-root textarea { font:inherit; }',
						'.zw-modern-root button { cursor:pointer; }',
						'.zw-modern-root button:disabled, .zw-modern-root input:disabled { opacity:.55; cursor:not-allowed; }',
						'.zw-modern-header { display:flex; align-items:center; gap:12px; background:var(--zw-dark-panel); border-bottom:1px solid var(--zw-dark-border); padding:13px 17px; flex:none; }',
						'.zw-modern-header h2 { font-size:17px; font-weight:750; margin:0; flex:1; }',
						'.zw-modern-root .zw-modern-iconbtn { border:1px solid #405069; background:#23334a; color:var(--zw-dark-text); padding:6px 10px; border-radius:5px; }',
						'.zw-modern-body { position:relative; display:flex; flex:1; min-height:0; }',
						'.zw-modern-sidebar { width:var(--zw-sidebar-width); flex:0 0 var(--zw-sidebar-width); overflow:auto; min-width:0; background:var(--zw-dark-side); border-right:1px solid var(--zw-dark-border); padding:14px 9px; transition:width .18s ease,flex-basis .18s ease; }',
						'.zw-modern-root.is-sidebar-collapsed .zw-modern-sidebar { width:0; flex-basis:0; padding:0; overflow:hidden; border:0; }',
						'.zw-modern-search { width:100%; background:#0f1a29; color:var(--zw-dark-text); border:1px solid #40516a; border-radius:5px; padding:9px 10px; margin:0 0 12px; outline-offset:1px; }',
						'.zw-modern-nav { display:flex; flex-direction:column; gap:3px; }',
						'.zw-modern-nav button { display:block; width:100%; text-align:left; border:0; border-radius:5px; color:var(--zw-dark-text); background:transparent; padding:8px; }',
						'.zw-modern-nav button:hover, .zw-modern-nav button.is-active { background:var(--zw-dark-card); }',
						'.zw-modern-nav button.is-active { color:var(--zw-dark-accent); }',
						'.zw-modern-nav .zw-modern-sub { font-size:12px; padding-left:21px; color:var(--zw-dark-muted); }',
						'.zw-modern-main { flex:1; min-width:0; overflow:auto; overscroll-behavior:contain; padding:24px clamp(12px,3vw,44px); }',
						'.zw-modern-content-inner { width:100%; max-width:960px; margin:0 auto; }',
						'.zw-modern-breadcrumb { font-size:11px; color:var(--zw-dark-muted); margin:0 0 4px; }',
						'.zw-modern-section-title { font-size:21px; line-height:1.4; margin:0 0 6px; font-weight:750; }',
						'.zw-modern-section-subtitle { margin:0 0 15px; color:var(--zw-dark-muted); font-size:12px; }',
						'.zw-modern-toolbar { display:flex; justify-content:flex-end; gap:7px; margin:0 0 14px; }',
						'.zw-modern-card { background:var(--zw-dark-card); border:1px solid var(--zw-dark-border); border-radius:5px; padding:13px 15px; margin:0 0 10px; min-width:0; }',
						'.zw-modern-card.is-inline { display:flex; align-items:center; flex-wrap:wrap; column-gap:15px; row-gap:6px; min-height:55px; }',
						'.zw-modern-card.is-inline > .zw-modern-cardhead { min-width:0; flex:1 1 210px; }',
						'.zw-modern-card.is-inline > .zw-modern-cardcontrols { flex:0 1 auto; margin:0; min-width:0; }',
						'.zw-modern-card.is-inline > .zw-modern-note { flex-basis:100%; margin-top:2px; }',
						'.zw-modern-card.is-modified { border-color:#528db7; box-shadow:0 0 0 1px #528db733,0 0 10px #82bfff22; }',
						'.zw-modern-card.is-disabled { opacity:.5; }',
						'.zw-modern-card.is-child { margin-left:14px; border-left:2px solid #475e77; }',
						'.zw-modern-cardhead { display:flex; align-items:center; gap:10px; }',
						'.zw-modern-cardhead strong { font-size:13px; font-weight:650; flex:1; overflow-wrap:anywhere; }',
						'.zw-modern-visibility-icon { display:inline-flex; justify-content:center; align-items:center; flex:none; width:38px; height:32px; background:#23354b; border:1px solid #60748c; border-radius:5px; color:#edf4ff; font:19px/1 system-ui,sans-serif; white-space:nowrap; overflow:hidden; pointer-events:none; user-select:none; }',
						'.zw-modern-visibility-icon.is-compact-glyph { font-size:12px; letter-spacing:-.25px; }',
						'.zw-modern-visibility-icon.is-pair-glyph { font-size:15px; }',
						'.zw-modern-visibility-icon.is-tweet { font-weight:750; color:#79c8f8; }',
						'.zw-modern-visibility-icon.is-mylist { font-size:15px; font-weight:750; }',
						'.zw-modern-visibility-icon.is-like { color:#ffc0d8; font-size:26px; }',
						'.zw-modern-visibility-icon.is-comment { font-size:20px; }',
						'.zw-modern-visibility-icon.is-related { width:100px; font-size:10px; gap:6px; background:#59636b; border-color:#7c8992; }',
						'.zw-modern-visibility-icon.is-comment-input { width:118px; padding:0 6px; justify-content:start; font-size:10px; border-color:#8798a9; color:#c3d3e2; background:#172437; }',
						'.zw-modern-visibility-icon svg { width:24px; height:24px; fill:none; stroke:currentColor; stroke-width:2; stroke-linecap:round; stroke-linejoin:round; }',
						'.zw-modern-root .zw-modern-plainbtn { border:1px solid #445a71; border-radius:5px; background:#1d2b3d; color:var(--zw-dark-text); padding:5px 8px; font-size:11px; }',
						'.zw-modern-cardcontrols { display:flex; gap:10px; align-items:center; justify-content:flex-end; margin:8px 0 0; flex-wrap:wrap; }',
						'.zw-modern-cardcontrols label { display:inline-flex; gap:8px; align-items:center; }',
						'.zw-modern-cardcontrols label:has(textarea), .zw-modern-cardcontrols label:has(input[type=text]) { display:flex; flex-direction:column; align-items:stretch; width:100%; }',
						'.zw-modern-cardcontrols input[type=text], .zw-modern-cardcontrols input[type=number], .zw-modern-cardcontrols textarea, .zw-modern-cardcontrols select { color:var(--zw-dark-text); background:#101927; border:1px solid #445a71; padding:7px 9px; border-radius:5px; min-width:150px; max-width:100%; }',
						'.zw-modern-cardcontrols textarea { width:100%; min-height:95px; resize:vertical; }',
						'.zw-modern-cardcontrols input[type=checkbox] { appearance:none; -webkit-appearance:none; display:inline-block; position:relative; width:39px; height:23px; flex:none; margin:0; background:#47576b; border:1px solid #546a82; border-radius:12px; cursor:pointer; }',
						'.zw-modern-cardcontrols input[type=checkbox]::after { content:""; position:absolute; top:3px; left:3px; width:15px; height:15px; border-radius:50%; background:#fff; transition:transform .14s ease; }',
						'.zw-modern-cardcontrols input[type=checkbox]:checked { background:#82bfff; border-color:#82bfff; }',
						'.zw-modern-cardcontrols input[type=checkbox]:checked::after { transform:translateX(16px); }',
						'.zw-modern-cardcontrols .checkbox { cursor:pointer; }',
						'.zw-modern-cardcontrols label input[type=checkbox] { order:1; }',
						'.zw-modern-cardcontrols .zw-modern-native-label { display:none; }',
						'.zw-modern-seek-editor { display:flex; flex-wrap:wrap; gap:8px; align-items:center; margin-top:6px; width:100%; }',
						'.zw-modern-seek-editor select,.zw-modern-seek-editor input { background:#101927; color:var(--zw-dark-text); border:1px solid #445a71; border-radius:5px; padding:6px; }',
						'.zw-modern-seek-editor input { width:100px; }',
						'.zw-modern-slider { display:flex; align-items:center; justify-content:flex-end; flex-wrap:wrap; gap:12px; width:100%; }',
						'.zw-modern-slider input[type=range] { flex:1; min-width:160px; max-width:750px; accent-color:var(--zw-dark-accent); }',
						'.zw-modern-slider input[type=number] { width:91px; color:var(--zw-dark-text); background:var(--zw-dark-bg); border:1px solid #445a71; padding:7px 9px; border-radius:5px; }',
						'.zw-modern-slider span { color:var(--zw-dark-muted); }',
						'.zw-modern-cardcontrols .zw-modern-segments { display:flex; flex-wrap:wrap; gap:5px; justify-content:flex-end; }',
						'.zw-modern-cardcontrols .zw-modern-segments button { background:#1c2c3f; color:var(--zw-dark-text); border:1px solid #435a76; padding:7px 9px; border-radius:5px; font-size:11px; }',
						'.zw-modern-cardcontrols .zw-modern-segments button.is-selected { color:#101927; background:#82bfff; border-color:#82bfff; }',
						'.zw-modern-color-editor { display:flex; align-items:center; justify-content:flex-end; gap:9px; flex-wrap:wrap; width:100%; }',
						'.zw-modern-color-editor input[type=color] { width:46px; height:34px; padding:2px; cursor:pointer; background:#101927; border:1px solid #52657c; border-radius:6px; }',
						'.zw-modern-color-editor input[type=text] { width:140px; min-width:112px; font:12px/1.4 ui-monospace,Consolas,monospace; }',
						'.zw-modern-color-hint { color:#a5b7cb; font-size:11px; flex-basis:100%; text-align:right; }',
						'.zw-popup-settings { display:grid; grid-template-columns:minmax(0,1fr) minmax(260px,.85fr); gap:18px; align-items:start; }',
						'.zw-popup-settings .zw-popup-preview { position:sticky; top:12px; background:#152336; border:1px solid #40566e; border-radius:10px; padding:15px; min-width:0; }',
						'.zw-popup-settings .zw-popup-preview h4 { margin:0 0 7px; color:#e4edf6; font-size:14px; }',
						'.zw-popup-settings .zw-popup-preview p { color:#a5b7cb; font-size:12px; line-height:1.6; margin:0 0 12px; }',
						'.zw-popup-settings .zw-popup-sample { display:block; background:#333; color:#fff; box-shadow:2px 2px 0 #ccc; padding:8px 16px; border-radius:4px; text-align:center; font-weight:bolder; margin:0 2px 12px 0; overflow-wrap:anywhere; }',
						'@media(max-width:900px){ .zw-popup-settings {grid-template-columns:minmax(0,1fr)} .zw-popup-settings .zw-popup-preview {position:static;grid-row:1} }',
						'.zw-modern-font-editor { display:flex; flex-wrap:wrap; gap:7px; width:100%; justify-content:flex-end; }',
						'.zw-modern-font-editor select { flex:1 1 190px; max-width:420px; }',
						'.zw-modern-font-editor input[type=text] { flex:1 1 220px; }',
						'.zw-modern-font-editor [hidden] { display:none!important; }',
						'.zw-modern-example { display:flex; flex-direction:column; gap:7px; border-top:1px solid #405168; padding:10px 0 1px; margin-top:10px; width:100%; }',
						'.zw-example-label { color:#a5b7cb; font-size:11px; }',
						'.zw-example-caption { font-size:11px; line-height:1.5; color:#a5b7cb; }',
						'.zw-example-text { display:block; align-self:flex-start; background:linear-gradient(145deg,#14253a,#243d50); border-radius:5px; padding:15px; color:white; font-size:24px; line-height:1.35; white-space:nowrap; max-width:100%; overflow:hidden; }',
						'.zw-example-filename { overflow-wrap:anywhere; background:#14253a; border:1px solid #405168; padding:9px; border-radius:5px; font-size:12px; }',
						'.zw-example-screen { width:min(365px,100%); height:124px; border:1px solid #51647c; border-radius:5px; background:#142137; display:flex; align-items:center; justify-content:center; gap:6px; padding:10px; position:relative; overflow:hidden; }',
						'.zw-example-video { background:linear-gradient(125deg,#213c57,#3f7481); border:2px solid #8ec8d0; width:69%; aspect-ratio:16/9; position:relative; display:flex; flex-direction:column; justify-content:center; align-items:center; transition:width .12s ease; overflow:hidden; border-radius:3px; }',
						'.zw-example-title { position:absolute; top:0; left:0; right:0; text-align:center; font-size:10px; background:#15283dcc; color:#fff; }',
						'.zw-example-fly { font-size:11px; color:#fff; text-shadow:0 1px 1px #000; white-space:nowrap; }',
						'.zw-example-controlbar { position:absolute; bottom:0;left:0;right:0; background:#111d32dc; font-size:9px; text-align:center; color:#fff; }',
						'.zw-example-sidebar { background:#22354a; padding:4px; color:#b8d1e8; border-radius:3px; font-size:10px; max-width:80px; }',
						'.zw-modern-example[data-zw-example-mode=big] .zw-example-video { width:84%; }',
						'.zw-modern-example[data-zw-example-mode=wide] .zw-example-video { width:95%; }',
						'.zw-modern-example[data-zw-example-mode=small] .zw-example-video { width:45%; margin-left:auto; }',
						'.zw-modern-example[data-zw-example-mode=sideView] .zw-example-video { width:51%; margin-left:auto; }',
						'.zw-modern-example[data-zw-example-mode="3D"] .zw-example-video { transform:perspective(200px) rotateY(-12deg); }',
						'.zw-modern-example[data-zw-example-mode=auto] .zw-example-controlbar { opacity:.6; }',
						'.zw-modern-example[data-zw-example-mode=always-hide] .zw-example-controlbar { opacity:.06; }',
						'.zw-modern-example[data-zw-example-mode=always-show] .zw-example-controlbar { opacity:1; }',
						'.zw-modern-example[data-zw-example-mode=outside] .zw-example-title { top:-17px; background:#1a314b; }',
						'.zw-modern-example[data-zw-example-mode=overlay] .zw-example-title { opacity:.3; }',
						'.zw-modern-example[data-zw-example-mode=overlay-visible] .zw-example-title { opacity:1; background:#08233ecf; }',
						'.zw-modern-search-guide { padding:12px 15px; margin:0 0 14px; background:#17283c; border:1px solid #39516e; border-radius:5px; color:var(--zw-dark-text); font-size:12px; }',
						'.zw-modern-search-guide strong { display:block; font-size:13px; margin-bottom:6px; }',
						'.zw-modern-search-guide p { margin:5px 0; color:var(--zw-dark-muted); }',
						'.zw-modern-search-guide b { color:var(--zw-dark-text); }',
						'.zw-modern-note { color:var(--zw-dark-muted); font-size:12px; padding:8px 11px; border-radius:5px; background:var(--zw-dark-panel); margin-top:9px; white-space:pre-wrap; }',
						'.zw-modern-note[hidden] { display:none; }',
						'.zw-modern-warning { color:#e6bb75; font-size:11px; display:block; margin-top:5px; }',
						'.zw-modern-regex-editor { display:grid; grid-template-columns:1fr; gap:7px; width:100%; max-width:700px; }',
						'.zw-modern-regex-editor label { display:flex; gap:9px; align-items:center; justify-content:flex-start; font-size:12px; }',
						'.zw-modern-cardcontrols .zw-modern-regex-editor input[type=checkbox] { flex:none; width:17px; height:17px; appearance:checkbox; -webkit-appearance:checkbox; accent-color:#82bfff; border:0; background:transparent; border-radius:0; padding:0; }',
						'.zw-modern-cardcontrols .zw-modern-regex-editor input[type=checkbox]::after { content:none!important; display:none!important; }',
						'.zw-modern-regex-editor [data-zw-regex-advanced-panel] { display:flex; flex-direction:column; gap:6px; align-items:flex-start; }',
						'.zw-modern-regex-editor [data-zw-regex-advanced-panel][hidden] { display:none!important; }',
						'.zw-modern-regex-editor input[type=text] { width:180px; min-width:0; }',
						'.zw-modern-regex-current { color:var(--zw-dark-muted); font-size:11px; }',
						'.zw-modern-regex-editor small { color:var(--zw-dark-muted); font-size:11px; }',
						'.zw-modern-command-assist { margin-top:10px; padding:12px; background:#1a293c; border:1px solid #445a71; border-radius:5px; display:grid; gap:10px; }',
						'.zw-modern-command-assist p { margin:0; color:var(--zw-dark-muted); font-size:12px; line-height:1.6; }',
						'.zw-modern-command-assist p strong { color:var(--zw-dark-text); }',
						'.zw-modern-command-group { display:flex; align-items:center; flex-wrap:wrap; gap:6px; }',
						'.zw-modern-command-group > strong { min-width:65px; font-size:11px; color:#c5d9ed; }',
						'.zw-modern-command-group button { border:1px solid #526c89; border-radius:5px; color:#ecf5ff; background:#23364d; padding:5px 9px; font-size:11px; }',
						'.zw-modern-command-group button:disabled { opacity:.55; background:#2f4458; }',
						'.zw-modern-prefix-breakdown { display:flex; gap:5px; flex-wrap:wrap; }',
						'.zw-modern-prefix-breakdown span { font-size:10px; padding:4px 7px; border-radius:4px; border:1px solid #465971; color:#aebed0; background:#1b293a; }',
						'.zw-modern-prefix-presets { display:flex; flex-wrap:wrap; align-items:center; gap:7px; width:100%; justify-content:flex-start; }',
						'.zw-modern-prefix-presets .is-selected { color:#101927; border-color:#82bfff; background:#82bfff; }',
						'.zw-modern-prefix-hint { color:var(--zw-dark-muted); margin:6px 0 0; font-size:11px; width:100%; }',
						'.zw-modern-backup { display:grid; gap:10px; }',
						'.zw-modern-backup textarea { width:100%; min-height:150px; padding:10px; border:1px solid #465a74; border-radius:5px; background:#101927; color:#edf4ff; resize:vertical; font:12px/1.45 ui-monospace,Consolas,monospace; }',
						'.zw-modern-backup p { color:#a5b7cb; font-size:12px; }',
						'.zw-modern-backup .zw-modern-actions { display:flex; gap:8px; flex-wrap:wrap; }',
						'.zw-modern-footer { background:var(--zw-dark-panel); border-top:1px solid var(--zw-dark-border); padding:12px 18px; display:flex; align-items:center; justify-content:flex-end; gap:9px; flex:none; }',
						'.zw-modern-footer .zw-modern-dirty { color:var(--zw-dark-muted); margin-right:auto; }',
						'.zw-modern-footer .zw-modern-primary { padding:9px 15px; border:1px solid #82bfff; color:#101927; background:#82bfff; font-weight:700; border-radius:5px; }',
						'.zw-modern-backdrop { display:none; }',
						'.zw-modern-root .relatedMenuCustomLinksContainer { width:100%; min-width:0; }',
						'.zw-modern-root .zenzaRelatedLinksEditor { color:var(--zw-dark-text); width:100%; padding:3px 0 6px; }',
						'.zw-modern-root .zenzaRelatedLinksEditor h3 { display:none; }',
						'.zw-modern-root .zenzaRelatedLinksEditor button { border:1px solid #3a4f65; color:var(--zw-dark-text); background:#1b293a; border-radius:5px; cursor:pointer; }',
						'.zw-modern-root .zenzaRelatedLinksEditor button:hover { border-color:#82bfff; }',
						'.zw-modern-root .zenzaRelatedLinksEditor .rl-card { background:#1b293a; border-color:#2b394b; }',
						'.zw-modern-root .zenzaRelatedLinksEditor input[type=text] { background:#101927; color:#edf4ff; border:1px solid #445a71; border-radius:5px; }',
						'.zw-modern-root .zenzaRelatedLinksEditor input[type=checkbox] { accent-color:#82bfff; }',
						'.zw-modern-root .zenzaRelatedLinksEditor [hidden] { display:none !important; }',
						'.zw-modern-root .zw-modern-related-editor { width:100%; }',
						'.zw-modern-order-editor { width:100%; display:grid; gap:7px; }',
						'.zw-modern-order-editor .zw-order-hint { color:#a5b7cb; font-size:12px; }',
						'.zw-modern-order-list { list-style:none; padding:0; margin:0; display:grid; gap:7px; }',
						'.zw-modern-order-row { position:relative; display:flex; align-items:center; gap:8px; padding:9px; background:#152638; border:1px solid #425b74; border-radius:5px; min-width:0; }',
						'.zw-modern-order-row .zw-order-name { flex:1 1 auto; width:auto; min-width:0; overflow-wrap:break-word; white-space:normal; }',
						'.zw-modern-order-row .zw-order-visible { flex:none; display:inline-flex; gap:6px; align-items:center; white-space:nowrap; }',
						'.zw-modern-order-row .zw-order-visible input[type=checkbox] { width:18px; height:18px; flex:none; appearance:auto; accent-color:#82bfff; }',
						'.zw-modern-order-row .zw-order-visible input[type=checkbox]::after { content:none; display:none; }',
						'.zw-modern-cardhead [data-zw-shared-setting] { flex:none; color:#a5b7cb; font-size:10px; white-space:nowrap; }',
						'.zw-modern-order-row .zw-order-name small { display:block; color:#a5b7cb; }',
						'.zw-modern-order-row.is-dragging { opacity:.4; border-style:dashed; }',
						'.zw-modern-order-row.is-drop-before::before,.zw-modern-order-row.is-drop-after::before { content:""; position:absolute; left:0; right:0; height:4px; background:#82bfff; box-shadow:0 0 9px #82bfff; z-index:2; pointer-events:none; }',
						'.zw-modern-order-row.is-drop-before::before { top:-7px; }',
						'.zw-modern-order-row.is-drop-after::before { bottom:-7px; }',
						'.zw-modern-order-row.is-missing { opacity:.62; }',
						'.zw-modern-order-row .zw-order-grip { cursor:grab; }',
						'.zw-modern-order-row .zw-order-grip:active { cursor:grabbing; }',
						'.zw-modern-order-compact .zw-modern-order-row { padding:6px 8px; gap:6px; flex-wrap:wrap; }',
						'.zw-modern-order-compact .zw-order-name { flex:1 1 175px; font-size:12px; }',
						'.zw-modern-order-compact .zw-order-key-preview { min-width:75px; font-size:10px; color:#a5b7cb; }',
						'.zw-modern-order-compact .zw-order-key-preview.is-conflict { color:#ffd28a; }',
						'.zw-modern-order-compact .zw-order-grip { touch-action:none; user-select:none; }',
						'.zw-modern-order-compact .zw-order-visible { gap:4px; font-size:11px; }',
						'.zw-modern-order-compact .zw-order-details { flex:1 0 100%; display:grid; gap:10px; padding:10px 6px 5px; border-top:1px solid #465b72; min-width:0; }',
						'.zw-modern-order-compact .zw-order-details p { margin:0; color:#c3d3e4; }',
						'.zw-modern-order-compact .zw-order-details small { color:#a5b7cb; }',
						'.zw-modern-order-compact .zw-order-field { display:grid; gap:5px; min-width:0; font-size:12px; }',
						'.zw-modern-order-compact .zw-order-field input[type=text],.zw-modern-order-compact .zw-order-field select,.zw-modern-order-compact .zw-order-field input[type=number] { width:min(100%,650px); min-width:0; padding:6px; background:#101927; border:1px solid #445a71; color:#edf4ff; }',
						'.zw-modern-order-compact .zw-order-field input[type=checkbox] { appearance:auto; width:17px; height:17px; }',
						'.zw-modern-order-compact .zw-order-field input[type=checkbox]::after { content:none; }',
						'.zw-modern-order-compact .zw-order-shortcut-editor,.zw-modern-order-compact .zw-order-sizes { display:flex; flex-wrap:wrap; align-items:center; gap:9px; }',
						'.zw-modern-order-compact .zw-order-sizes .zw-order-field { flex:1 1 130px; }',
						'.zw-modern-order-compact .zw-order-variable-palette { display:flex; flex-wrap:wrap; gap:5px; }',
						'.zw-modern-order-compact .zw-order-variable-palette p,.zw-modern-order-compact .zw-order-variable-palette small { flex:1 0 100%; }',
						'.zw-modern-order-compact .zw-order-warning { color:#ffcb78; }',
						'.zw-modern-order-compact .zw-modern-order-row.is-touch-dragging { border-color:#82bfff; box-shadow:0 0 0 1px #82bfff; }',
						'.zw-modern-order-editor [data-zw-order-status] { font-size:12px; color:#a5b7cb; min-height:1.4em; }',
						'.zw-order-toolbar { display:flex; gap:8px; flex-wrap:wrap; margin:3px 0 12px; }',
						'.zw-order-workspace { display:grid; grid-template-columns:minmax(0,1.12fr) minmax(0,1fr); gap:16px; align-items:start; width:100%; min-width:0; }',
						'.zw-order-inspector { min-width:0; background:#1b2c3f; border:1px solid #425b74; border-radius:8px; padding:17px; position:sticky; top:0; max-height:calc(100vh - 220px); overflow:auto; }',
						'.zw-order-inspector .zw-order-details { border:0; padding:0; } .zw-order-details h3 { font-size:18px; margin:0 0 6px; overflow-wrap:anywhere; }',
						'.zw-modern-order-compact .zw-order-name { border:0; padding:0; text-align:left; background:transparent; color:inherit; }',
						'.zw-modern-order-row.is-selected { border-color:#82bfff; background:#253d55; box-shadow:0 0 0 1px #82bfff44; }',
						'.zw-order-workspace .zw-modern-order-row { flex-wrap:nowrap; min-height:42px; }',
						'.zw-order-workspace .zw-order-name { flex:1 1 0; min-width:0; font-weight:600; }',
						'.zw-order-workspace .zw-modern-plainbtn { flex:none; white-space:nowrap; }',
						'.zw-order-workspace .zw-order-key-preview { min-width:0; max-width:65px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }',
						'.zw-order-inspector .is-detail-only .rl-card { padding:0; margin:10px 0 0; border:0; background:transparent; }',
						'.zw-order-inspector .is-detail-only .rl-fields { grid-template-columns:minmax(0,1fr); }',
						'.zw-order-inspector .is-detail-only .rl-head .rl-summary,.zw-order-inspector .is-detail-only [data-rl-drag],.zw-order-inspector .is-detail-only [data-rl-expand],.zw-order-inspector .is-detail-only [data-rl-up],.zw-order-inspector .is-detail-only [data-rl-down] { display:none; }',
						'.zw-order-inspector .is-detail-only .rl-toolbar>button,.zw-order-inspector .is-detail-only [data-rl-count],.zw-order-inspector .is-detail-only .zenzaRelatedLinksEditor>.rl-help { display:none; }',
						'.zw-order-inspector textarea,.zw-order-inspector select,.zw-order-inspector input[type=text] { max-width:100%; min-width:0!important; width:100%; box-sizing:border-box; }',
						'.zw-order-inspector [data-rl-preview] { white-space:pre-wrap; }',
						/* SCUI-10: miniature diagrams are layout previews only: no duplicate video players. */
						'.zw-scui-picker { padding:14px; margin-bottom:13px; border:1px solid #4b6079; border-radius:12px; background:#182536; }',
						'.zw-scui-pickerhead { display:flex; gap:8px; flex-wrap:wrap; align-items:center; justify-content:space-between; margin-bottom:12px; }',
						'.zw-scui-tabs { display:flex; gap:5px; background:#101d2e; padding:4px; border-radius:9px; }',
						'.zw-scui-tabs button { border:1px solid transparent; border-radius:6px; padding:8px 10px; color:#ddd; background:transparent; cursor:pointer; }',
						'.zw-scui-tabs button[aria-pressed=true] { background:#45698b; border-color:#8bb9e7; color:#fff; }',
						'.zw-scui-layout-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(142px,1fr)); gap:8px; }',
						'.zw-scui-layout-option { display:flex; flex-direction:column; gap:5px; background:#101a2a; border:2px solid #35475f; border-radius:9px; color:#ddd; padding:8px; text-align:left; cursor:pointer; min-width:0; }',
						'.zw-scui-layout-option[aria-pressed=true] { border-color:#76c9ff; background:#1b3654; box-shadow:0 0 0 1px #76c9ff60; }',
						'.zw-scui-layout-option:focus-visible,.zw-scui-tabs button:focus-visible { outline:2px solid #e5c075; outline-offset:2px; }',
						'.zw-scui-layout-option:disabled { opacity:.48; cursor:not-allowed; }',
						'.zw-scui-layout-option strong { font-size:11px; white-space:normal; line-height:1.35; }',
						'.zw-scui-mini { position:relative; display:block; height:62px; background:linear-gradient(135deg,#4d6486,#1c2842); border:1px solid #65768d; border-radius:6px; overflow:hidden; }',
						'.zw-scui-mini > i { position:absolute; display:block; background:#0c1725; border:1px solid #8ab8de; border-radius:3px; width:38%; height:22px; bottom:8px; left:30%; }',
						'.zw-scui-mini > b { position:absolute; display:block; background:#1b3560a8; border:1px solid #a4b7d0; border-radius:3px; width:29%; height:16px; bottom:9px; left:8px; }',
						'.zw-scui-mini > em { position:absolute; display:block; background:#6faee4; height:3px; bottom:3px; width:66%; left:17%; }',
						'.zw-scui-mini[data-layout="02"] > i { left:6px; bottom:18px; } .zw-scui-mini[data-layout="02"] > b { left:auto; right:6px; bottom:18px; }',
						'.zw-scui-mini[data-layout="03"] > i { left:auto; right:6px; bottom:9px; }',
						'.zw-scui-mini[data-layout="04"] > i { left:31%; bottom:auto; top:5px; }',
						'.zw-scui-mini[data-layout="05"] > i { width:85%; left:7%; height:21px; bottom:9px; }',
						'.zw-scui-mini[data-layout="06"] > i { width:25%; left:37%; height:17px; }',
						'.zw-scui-mini[data-layout="07"] > i { width:25%; left:37%; } .zw-scui-mini[data-layout="07"] > b { width:23%; left:7%; }',
						'.zw-scui-mini[data-layout="08"] > i { left:auto; right:3px; width:27%; height:51px; bottom:5px; }',
						'.zw-scui-mini[data-layout="09"] > i { left:10%; bottom:14px; } .zw-scui-mini[data-layout="09"] > b { right:5%; left:auto; }',
						'.zw-scui-mini[data-layout="10"] > i { left:62%; bottom:24px; width:31%; } .zw-scui-mini[data-layout="10"] > b { left:13%; bottom:8px; }',
						'.zw-scui-picker.is-modified { border-color:#528db7; box-shadow:0 0 0 1px #528db733,0 0 10px #82bfff22; }',
						'.zw-scui-layout-grid { grid-template-columns:repeat(2,minmax(0,1fr)); }',
						'.zw-scui-mini[data-layout=follow]>i,.zw-scui-mini[data-layout=fixed]>i { left:12%; width:34%; height:30px; bottom:10px; }',
						'.zw-scui-mini[data-layout=follow]>b,.zw-scui-mini[data-layout=fixed]>b { left:48%; width:36%; height:30px; bottom:10px; color:white; font:9px/14px sans-serif; }',
						'.zw-scui-mini i span { display:block; color:white; font:9px/25px sans-serif; white-space:nowrap; font-style:normal; text-shadow:1px 1px black; }',
						'.zw-scui-layout-option small { font-size:11px; line-height:1.5; }',
						'[data-zw-scene-compat] { margin-top:12px; } [data-zw-scene-compat] summary { cursor:pointer; }',
						'.zw-modern-cardcontrols input[type=checkbox]:focus-visible { outline:2px solid #e5c075; outline-offset:3px; }',
						'.zw-scui-note { display:block; font-size:12px; line-height:1.5; color:#bdcfe0; padding-top:9px; }',
						'@media(max-width:760px) {.zw-scui-layout-grid { grid-template-columns:repeat(auto-fit,minmax(126px,1fr)); }}',
						'@media(max-width:1050px) { .zw-order-workspace { grid-template-columns:minmax(0,1fr); } .zw-order-inspector { position:static; max-height:none; } }',
						'@media(max-width:760px) {.zw-modern-sidebar { position:absolute; top:0; bottom:0; left:0; z-index:5; width:min(290px,88vw); flex-basis:auto; transform:translateX(-100%); box-shadow:6px 0 22px #0007; padding:12px; } .zw-modern-root.is-drawer-open .zw-modern-sidebar { transform:translateX(0); } .zw-modern-root.is-drawer-open .zw-modern-backdrop { display:block; background:#0008; position:absolute; inset:0; z-index:4; } .zw-modern-main { padding:15px 11px; } .zw-modern-card { padding:10px; } .zw-modern-footer { padding:9px; } .zw-modern-footer .zw-modern-dirty { font-size:11px; }}'
				].join('\n');
				doc.head.append(style);
		}
		constructor({ panel, legacyRoot, model, storage, onClose, confirm, formatKeyCombo, encodeKeyCombo, relatedEditor = null, relatedOrder = null, relatedActions = null, screenshotFileName = null, playlist = null, reload = null }) {
				if (!panel || !model) {
						throw new TypeError('Panel and model are required');
				}
				this.panel = panel;
				this.legacyRoot = legacyRoot;
				this.model = model;
				this.relatedEditor = relatedEditor;
				this.relatedOrder = relatedOrder;
				this.relatedActions = relatedActions;
				this.screenshotFileName = screenshotFileName;
				this._orderDragKey = null;
				this._orderDropKey = null;
				this._orderDropAfter = false;
				this._orderAnnouncement = '';
				this._expandedRelatedOptions = new Set();
				this._touchOrder = null;
				this.playlist = playlist;
				this.reload = reload || (() => this.win.location.reload());
				if (relatedEditor) {
						relatedEditor.getDraftShortcutValue = id => this.model.get(id);
						relatedEditor.getDraftShortcutConflicts = key => [
								...this.model.actions.filter(action => Number(this.model.get('KEY_' + action.id)) === key)
										.map(action => action.label || action.id),
								...relatedEditor.draft.filter(link => link && link.enabled !== false &&
										Number(link.shortcutKey) === key).map(link => link.label || link.id)
						];
						relatedEditor.embedded = true;
						relatedEditor.onDraftChange = value => this._onCustomMenuDraft(value);
				}
				this._relatedOrigin = relatedEditor ? { parent: relatedEditor.container.parentNode,
						next: relatedEditor.container.nextSibling } : null;
				this.doc = panel.ownerDocument;
				this.win = this.doc.defaultView;
				this.storage = storage || this.win.localStorage;
				this.onClose = onClose || (() => { });
				this.confirm = confirm || (message => this.win.confirm(message));
				this.formatKeyCombo = formatKeyCombo || (v => String(v || '(未設定)'));
				this.encodeKeyCombo = encodeKeyCombo || (e => e.keyCode);
				this.expanded = new Set();
				this._moved = new Map();
				this._seekDirections = new Map();
				this._visibleSeekSlots = new Set();
				this._sceneLayoutTab = 'normal';
				this._recordCleanup = null;
				this.searchTerm = '';
				this._setupSelection();
				ModernAdvancedSettingsUI._style(this.doc);
				this.root = this.doc.createElement('section');
				this.root.className = 'zw-modern-root';
				this.root.style.setProperty('--zw-sidebar-width', '290px');
				this.root.setAttribute('role', 'dialog');
				this.root.setAttribute('aria-label', 'ZenzaWatch 上級者設定');
				this.root.innerHTML = [
						'<div class="zw-modern-header">',
						'<button type="button" class="zw-modern-iconbtn" data-zw-sidebar aria-label="サイドバーの開閉">☰</button>',
						'<h2>ZenzaWatch 上級者設定</h2>',
						'<button type="button" class="zw-modern-iconbtn" data-zw-close aria-label="設定画面を閉じる">✕</button>',
						'</div>',
						'<div class="zw-modern-body">',
						'<div class="zw-modern-backdrop" data-zw-drawer-dismiss></div>',
						'<aside class="zw-modern-sidebar">',
						'<input class="zw-modern-search" type="search" data-zw-search placeholder="すべての設定を検索" aria-label="設定を検索">',
						'<nav class="zw-modern-nav" aria-label="設定カテゴリ"></nav>',
						'</aside>',
						'<main class="zw-modern-main"><div class="zw-modern-content-inner">',
						'<div class="zw-modern-breadcrumb" data-zw-path></div>',
						'<h3 class="zw-modern-section-title" data-zw-title></h3>',
						'<p class="zw-modern-section-subtitle" data-zw-subtitle></p>',
						'<div class="zw-modern-toolbar"><button class="zw-modern-plainbtn" type="button" data-zw-reset-category>この画面の項目だけ初期値に戻す</button></div>',
						'<div data-zw-cards></div></div></main>',
						'</div>',
						'<div class="zw-modern-footer">',
						'<span class="zw-modern-dirty" data-zw-dirty>保存済み</span>',
						'<button class="zw-modern-plainbtn" type="button" data-zw-cancel>キャンセル</button>',
						'<button class="zw-modern-primary" type="button" data-zw-save>変更を保存</button>',
						'</div>'
				].join('');
				this.nav = this.root.querySelector('.zw-modern-nav');
				this.cards = this.root.querySelector('[data-zw-cards]');
				this.root.addEventListener('click', this._onClickBound = e => this._onClick(e), true);
				this.root.addEventListener('change', this._onValueBound = e => this._onValue(e), true);
				this.root.addEventListener('input', this._onInputBound = e => this._onInput(e), true);
				this.root.addEventListener('dragstart', this._onOrderDragStartBound = e => this._onOrderDragStart(e));
				this.root.addEventListener('dragover', this._onOrderDragOverBound = e => this._onOrderDragOver(e));
				this.root.addEventListener('drop', this._onOrderDropBound = e => this._onOrderDrop(e));
				this.root.addEventListener('dragend', this._onOrderDragEndBound = () => this._onOrderDragEnd());
				this.root.addEventListener('pointerdown', this._onTouchOrderDownBound = e => this._onTouchOrderDown(e));
				this.root.addEventListener('pointermove', this._onTouchOrderMoveBound = e => this._onTouchOrderMove(e));
				this.root.addEventListener('pointerup', this._onTouchOrderUpBound = e => this._onTouchOrderUp(e));
				this.root.addEventListener('pointercancel', this._onTouchOrderCancelBound = () => this._clearTouchOrder());
				this.root.addEventListener('click', this._onRelatedClickBound = e => this._onRelatedBubble(e));
				this.root.addEventListener('change', this._onRelatedChangeBound = e => this._onRelatedBubble(e));
				this.root.addEventListener('input', this._onRelatedInputBound = e => this._onRelatedBubble(e));
				this.doc.addEventListener('keydown', this._onKeyDownBound = e => this._onDocumentKeyDown(e), true);
				this.panel.appendChild(this.root);
				this._onBackCommentConfigUpdate = () => {
						if (!this.model.syncLiveValue('backComment')) {
								return;
						}
						const checked = !!this.model.get('backComment');
						this.cards.querySelectorAll('input[data-setting-name="backComment"]')
								.forEach(input => { input.checked = checked; });
						this._refreshCards();
				};
				this.model.config.onkey?.('backComment', this._onBackCommentConfigUpdate);
				this._unwatchRelatedActions = this.relatedActions?.onChange?.(() => this._refreshRelatedOrderList()) || null;
				this._renderNavigation();
				this._renderCards();
				this._refreshFooter();
				this.panel.classList.add('zw-modern-active');
				this._savedPageOverflow = null;
				this.setModalVisible(this.panel.classList.contains('show'));
		}
		setModalVisible(visible) {
				if (visible) {
						if (this._savedPageOverflow) {
								return;
						}
						const elements = [this.doc.documentElement, this.doc.body].filter(Boolean);
						this._savedPageOverflow = elements.map(el => ({
								element: el, value: el.style.getPropertyValue('overflow'),
								priority: el.style.getPropertyPriority('overflow')
						}));
						elements.forEach(el => el.style.setProperty('overflow', 'hidden', 'important'));
				}
				else if (this._savedPageOverflow) {
						this._savedPageOverflow.forEach(({ element, value, priority }) => {
								if (value) {
										element.style.setProperty('overflow', value, priority);
								}
								else {
										element.style.removeProperty('overflow');
								}
						});
						this._savedPageOverflow = null;
				}
		}
		_setupSelection() {
				const all = this.model.descriptors;
				const first = all.find(d => d.category === '再生・音声') || all[0];
				const fallback = first ? { category: first.category, subcategory: first.subcategory } :
						{ category: '再生・音声', subcategory: '再生動作' };
				const previous = this._readStored('zw-advanced-modern-selection');
				const saved = previous?.category === 'コメント増量' ?
						{ category: 'コメント表示', subcategory: '追加取得' } : previous;
				this.selected = (saved && (this.model.descriptors.some(d => d.category === saved.category &&
						d.subcategory === saved.subcategory) ||
						(saved.category === 'プレイリスト・検索' && saved.subcategory === 'データ管理'))) ? saved : fallback;
				const open = this._readStored('zw-advanced-modern-expanded');
				const majors = Array.isArray(open) ?
						[...new Set(open.map(name => name === 'コメント増量' ? 'コメント表示' : name))]
								.filter(name => this.model.categories.includes(name)) : [];
				this.expanded = new Set(majors.length ? majors : [this.selected.category]);
		}
		_readStored(key) {
				try {
						return JSON.parse(this.storage.getItem(key));
				}
				catch (_) {
						return null;
				}
		}
		_saveStored() {
				try {
						this.storage.setItem('zw-advanced-modern-selection', JSON.stringify(this.selected));
						this.storage.setItem('zw-advanced-modern-expanded', JSON.stringify([...this.expanded]));
				}
				catch (_) { /* UI navigation still works without persistent storage */ }
		}
		_button(text, attribute, value, cssClass = '') {
				const el = this.doc.createElement('button');
				el.type = 'button';
				el.textContent = text;
				el.setAttribute(attribute, value);
				el.className = cssClass;
				return el;
		}
		_renderNavigation() {
				this.nav.replaceChildren();
				for (const major of this.model.categories) {
						const subs = [...new Set(this.model.descriptors
										.filter(d => d.category === major).map(d => d.subcategory))];
						if (major === 'プレイリスト・検索') {
								subs.push('データ管理');
						}
						const open = this.expanded.has(major);
						const b = this._button((open ? '⌄ ' : '› ') + major, 'data-zw-major', major);
						b.setAttribute('aria-expanded', String(open));
						if (this.selected.category === major) {
								b.classList.add('is-active');
						}
						this.nav.appendChild(b);
						if (!open) {
								continue;
						}
						for (const sub of subs) {
								const label = sub === '関連メニュー › カスタムリンク' ? '関連メニュー（全項目）' : sub;
								const item = this._button(label, 'data-zw-sub', major + '|' + sub, 'zw-modern-sub');
								if (this.selected.category === major && this.selected.subcategory === sub) {
										item.classList.add('is-active');
								}
								this.nav.appendChild(item);
						}
				}
		}
		static _formatNgUserIds(value) {
				const text = Array.isArray(value) ? value.join('\n') : String(value ?? '');
				return text.split(/[,\r\n]+/).map(id => id.trim()).filter(Boolean).join('\n');
		}
		static _hexColor(value) {
				const text = String(value || '').trim().toLowerCase();
				if (/^#[0-9a-f]{6}$/.test(text)) {
						return text;
				}
				if (/^#[0-9a-f]{3}$/.test(text)) {
						return '#' + [...text.slice(1)].map(ch => ch + ch).join('');
				}
				const named = { green: '#008000', red: '#ff0000', blue: '#0000ff',
						black: '#000000', white: '#ffffff', gray: '#808080', grey: '#808080',
						yellow: '#ffff00', orange: '#ffa500', purple: '#800080' };
				return named[text] || null;
		}
		_createColorEditor(descriptor) {
				const box = this.doc.createElement('div');
				box.className = 'zw-modern-color-editor';
				const picker = this.doc.createElement('input');
				picker.type = 'color';
				picker.dataset.zwColorPicker = descriptor.id;
				picker.setAttribute('aria-label', descriptor.label + 'をカラーピッカーで選択');
				const raw = String(this.model.get(descriptor.id) ?? '');
				picker.value = ModernAdvancedSettingsUI._hexColor(raw) ||
						ModernAdvancedSettingsUI._hexColor(this.model.config.default[descriptor.id]) || '#008800';
				picker.disabled = !this.model.isEnabled(descriptor.id);
				const code = this.doc.createElement('input');
				code.type = 'text';
				code.dataset.settingName = descriptor.id;
				code.dataset.zwColorCode = descriptor.id;
				code.value = raw;
				code.placeholder = String(this.model.config.default[descriptor.id] ?? '#008800');
				code.spellcheck = false;
				code.autocomplete = 'off';
				code.setAttribute('aria-label', descriptor.hexOnly === true ? 'カラーコード（#RRGGBB または #RGB）' : 'カラーコード（HEXまたはCSS色名）');
				code.disabled = !this.model.isEnabled(descriptor.id);
				const hint = this.doc.createElement('span');
				hint.className = 'zw-modern-color-hint';
				hint.textContent = descriptor.hexOnly === true ?
						'カラーコード #RRGGBB または #RGB（保存前に見本を確認できます）' :
						'カラーコード #RRGGBB または #RGB（CSS色名も使用可）';
				box.append(picker, code, hint);
				return box;
		}
		_refreshColorEditor(card, descriptor, active) {
				const code = card.querySelector('[data-zw-color-code]');
				const picker = card.querySelector('[data-zw-color-picker]');
				const hint = card.querySelector('.zw-modern-color-hint');
				const value = String(this.model.get(descriptor.id) ?? '');
				const hex = ModernAdvancedSettingsUI._hexColor(value);
				const valid = descriptor.hexOnly !== true || /^#(?:[a-fA-F0-9]{3}|[a-fA-F0-9]{6})$/.test(value);
				if (code && code !== this.doc.activeElement) {
						code.value = value;
				}
				if (code) {
						code.disabled = !active;
						code.setAttribute('aria-invalid', String(!valid));
				}
				if (picker) {
						picker.disabled = !active;
						if (hex && valid) {
								picker.value = hex;
						}
				}
				if (hint) {
						hint.textContent = descriptor.hexOnly === true ?
								(valid ? '色見本をクリック、または #RGB / #RRGGBB を入力できます。' : 'カラーコードを入力中です。#RGB または #RRGGBB が必要です。') :
								(hex ? '色見本をクリックして選択、またはコードを入力できます。' : 'CSS色名を使用中／入力途中です。色見本の選択でHEX値に切り替わります。');
				}
		}
		_makeVisualExample(descriptor) {
				const id = descriptor.id;
				if (![
						'screenMode', 'screenMode:ginza', 'screenMode:others',
						'fullscreenControlBarMode', 'videoHeader.position',
						'commentLayer.textShadowType', 'commentLayer.ownerCommentShadowColor',
						'cssFontWeight', 'baseFontFamily', 'baseChatScale', 'screenshot.prefix',
						'screenshot.filenameTemplate'
				].includes(id)) {
						return null;
				}
				const area = this.doc.createElement('div');
				area.className = 'zw-modern-example';
				area.dataset.zwPreviewFor = id;
				const label = this.doc.createElement('span');
				label.className = 'zw-example-label';
				label.textContent = id === 'screenshot.prefix' || id === 'screenshot.filenameTemplate' ?
						'保存ファイル名の例' :
						'表示例（選択した設定の模式図）';
				area.append(label);
				if (id.startsWith('screenMode') || id === 'fullscreenControlBarMode' ||
						id === 'videoHeader.position') {
						const stage = this.doc.createElement('div');
						stage.className = 'zw-example-screen';
						stage.innerHTML = '<div class="zw-example-video">' +
								'<div class="zw-example-title">動画タイトル</div>' +
								'<div class="zw-example-fly">サンプルコメント　→</div>' +
								'<div class="zw-example-controlbar">▶ ━━━━━━━━━━ ◖ ))</div>' +
								'</div><div class="zw-example-sidebar">情報・タグ</div>';
						area.append(stage);
				}
				else if (id === 'screenshot.prefix' || id === 'screenshot.filenameTemplate') {
						const code = this.doc.createElement('code');
						code.className = 'zw-example-filename';
						area.append(code);
						const parts = this.doc.createElement('div');
						parts.className = 'zw-modern-prefix-breakdown';
						for (const [label, text] of [
								['先頭に追加する文字', '自由入力'],
								['動画タイトル', '自動で追加'], ['動画ID', '自動で追加'],
								['再生位置', '自動で追加'], ['.png', '自動で追加']
						]) {
								const item = this.doc.createElement('span');
								item.textContent = label + '（' + text + '）';
								parts.append(item);
						}
						area.append(parts);
				}
				else {
						const sample = this.doc.createElement('span');
						sample.className = 'zw-example-text';
						sample.textContent = id === 'commentLayer.ownerCommentShadowColor' ?
								'投稿者コメントの影色' : 'サンプルコメント 123';
						area.append(sample);
				}
				const caption = this.doc.createElement('span');
				caption.className = 'zw-example-caption';
				area.append(caption);
				this._updateVisualExample(area, id);
				return area;
		}
		_updateVisualExample(area, id) {
				const value = String(this.model.get(id) ?? '');
				area.dataset.zwExampleMode = value;
				const sample = area.querySelector('.zw-example-text');
				const caption = area.querySelector('.zw-example-caption');
				if (id.startsWith('screenMode')) {
						const hints = {
								normal: '通常サイズのウィンドウで動画を表示します。',
								big: '通常より大きなウィンドウで動画を表示します。',
								wide: '画面幅を広く使う表示です。',
								'3D': '立体的な視点を使う表示です。',
								small: '小さなポップアップ形式で表示します。',
								sideView: 'ページの横に小さく配置する表示です。'
						};
						caption.textContent = hints[value] || '動画の表示モードの例です。';
				}
				else if (id === 'fullscreenControlBarMode') {
						caption.textContent = ({
								auto: '画面サイズなどに応じて操作バーを自動調整します。',
								'always-show': '操作バーを常に表示する設定です。',
								'always-hide': '操作バーを常に隠す設定です。'
						})[value] || '操作バーの表示方法です。';
				}
				else if (id === 'videoHeader.position') {
						caption.textContent = ({
								auto: '画面幅によって外側／重ね合わせを自動で切り替えます。',
								outside: '動画の外側にタイトルなどを表示します。',
								overlay: '動画に重ね、操作時にだけ表示します。',
								'overlay-visible': '動画に重ね、常時表示します。'
						})[value] || '動画ヘッダーの配置例です。';
				}
				else if (id === 'screenshot.prefix' || id === 'screenshot.filenameTemplate') {
						const prefix = String(this.model.get('screenshot.prefix') ?? '');
						const template = String(this.model.get('screenshot.filenameTemplate') ?? '');
						area.querySelector('.zw-example-filename').textContent = this.screenshotFileName ?
								this.screenshotFileName.format({
										prefix, template, title: '動画タイトル', watchId: 'sm9', videoId: 'sm9',
										uploader: '投稿者', currentTime: 83, formatTime: () => '1_23',
										now: new Date('2026-10-10T12:34:56')
								}) : prefix + '動画タイトル - sm9@1_23.png';
						caption.textContent = '拡張子はPNG固定。コメント付き画像はCを追加し、使えない文字は安全な文字に置換します。';
				}
				else if (sample) {
						sample.style.textShadow = '';
						sample.style.webkitTextStroke = '';
						sample.style.color = '#ffffff';
						if (id === 'commentLayer.textShadowType') {
								const shadows = {
										'': '1px 1px 0 rgba(0,0,0,.9)',
										'shadow-type2': '1px 1px 0 #000,-1px 1px 0 #000,-1px -1px 0 #000,1px -1px 0 #000',
										'shadow-type3': '1px 1px 1px rgba(0,0,0,.8),0 0 3px rgba(0,0,0,.8),-1px -1px 1px #888',
										'shadow-stroke': 'none',
										'shadow-dokaben': '1px 1px 0 #963200,-1px 1px 0 #963200,-1px -1px 0 #963200,1px -1px 0 #963200'
								};
								sample.style.textShadow = shadows[value] || shadows[''];
								if (value === 'shadow-stroke') {
										sample.style.webkitTextStroke = '1px rgba(0,0,0,.7)';
								}
								else if (value === 'shadow-dokaben') {
										sample.style.color = 'rgb(200,80,0)';
								}
								caption.textContent = value === 'shadow-dokaben' ?
										'専用フォントがない場合は代替文字で表示します。' : '同じ文字を使った影の比較見本です。';
						}
						else if (id === 'commentLayer.ownerCommentShadowColor') {
								const color = ModernAdvancedSettingsUI._hexColor(value) || value;
								sample.style.textShadow = [
										'1px 1px 0 ' + color, '-1px 1px 0 ' + color,
										'1px -1px 0 ' + color, '-1px -1px 0 ' + color
								].join(',');
								caption.textContent = '現在の影色：' + value;
						}
						else if (id === 'cssFontWeight') {
								sample.style.fontWeight = value || 'normal';
								caption.textContent = 'CSS値 ' + value + ' の文字の太さです。';
						}
						else if (id === 'baseFontFamily') {
								if (value) {
										sample.style.fontFamily = value;
								}
								caption.textContent = value ? '選択したフォントがない場合は代替フォントで表示します。' :
										'プレイヤーの標準フォントで表示します。';
						}
						else if (id === 'baseChatScale') {
								sample.style.fontSize = (24 * Math.min(2, Math.max(.5, Number(value) || 1))) + 'px';
								caption.textContent = '現在の倍率：' + value + '倍（比率を示す見本です）。';
						}
				}
		}
		_createVisibilityIcon(id, descriptor = this.model.descriptor(id)) {
				const glyph = descriptor?.icon;
				if (!glyph) {
						return null;
				}
				const icon = this.doc.createElement('span');
				icon.className = 'zw-modern-visibility-icon';
				icon.dataset.zwVisibilityIcon = id;
				icon.setAttribute('aria-hidden', 'true');
				const paths = {
						'comments-video': 'M3 5h18v14H3z M6 9h8 M9 13h9',
						'comments-list': 'M5 3h14v18H5z M8 7h1 M11 7h5 M8 12h1 M11 12h5 M8 17h1 M11 17h5',
						'comments-preview': 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z M9 10h6 M9 14h6',
						'comment-heatmap': 'M3 18h18 M4 16v-3 M8 16V8 M12 16V4 M16 16V9 M20 16v-4',
						'seek-thumbnail': 'M4 3h16v13H4z M6 13l4-5 4 4 2-2 2 3 M3 21h18 M12 19v4',
						'scene-filmstrip': 'M2 5h20v14H2z M8 5v14 M16 5v14 M2 8h20 M2 16h20',
						'ad-crown': 'M3 7l5 4 4-7 4 7 5-4-2 12H5z M6 22h12'
				};
				if (paths[glyph]) {
						icon.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="' + paths[glyph] + '"/></svg>';
				}
				else if (glyph === 'shield-ng') {
						icon.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 2.5 19 5v5.5c0 4.6-2.8 8.4-7 10.8-4.2-2.4-7-6.2-7-10.8V5l7-2.5Z"/><path d="m8 8 8 8"/></svg>';
				}
				else if (glyph === 'filter-sparkle') {
						icon.innerHTML = '<svg viewBox="0 0 36 36"><path d="M15 10Q15 19 24 19Q15 19 15 28Q15 19 6 19Q15 19 15 10ZM26 5.5Q26 10 30.5 10Q26 10 26 14.5Q26 10 21.5 10Q26 10 26 5.5Z"/></svg>';
				}
				else {
						icon.textContent = glyph === 'related-menu' ? '関連メニュー ▾' :
								glyph === 'comment-input' ? 'コメント入力(C)' : glyph;
						if (id === 'ui.bar.speed' || id === 'ui.bar.time') {
								icon.classList.add('is-compact-glyph');
						}
						else if (id === 'ui.bar.volume' || id === 'ui.info.credits') {
								icon.classList.add('is-pair-glyph');
						}
						if (glyph === 'related-menu') {
								icon.classList.add('is-related');
						}
						if (glyph === 'comment-input') {
								icon.classList.add('is-comment-input');
						}
						if (id === 'ui.hover.like') {
								icon.classList.add('is-like');
						}
						if (id === 'ui.hover.tweet') {
								icon.classList.add('is-tweet');
						}
						if (id === 'ui.hover.mylist') {
								icon.classList.add('is-mylist');
						}
						if (id === 'ui.hover.comments') {
								icon.classList.add('is-comment');
						}
				}
				return icon;
		}
		_createCard(descriptor) {
				const card = this.doc.createElement('article');
				card.className = 'zw-modern-card';
				card.dataset.zwId = descriptor.id;
				const seekDescriptor = descriptor.type === 'shortcut' ?
						this.model.descriptor('PARAM_' + descriptor.actionId) : null;
				if (descriptor.type === 'boolean' ||
						(descriptor.type === 'shortcut' && !seekDescriptor)) {
						card.classList.add('is-inline');
				}
				if (this.model.isDifferentFromDefault(descriptor.id) ||
						(descriptor.type === 'related-order' &&
								(this.model.isDifferentFromDefault('relatedMenu.hiddenItems') ||
										this.model.isDifferentFromDefault('relatedMenu.builtinOptions'))) ||
						(seekDescriptor && this.model.isDifferentFromDefault(seekDescriptor.id))) {
						card.classList.add('is-modified');
				}
				if (descriptor.dependsOn) {
						card.classList.add('is-child');
				}
				if (!this.model.isEnabled(descriptor.id)) {
						card.classList.add('is-disabled');
				}
				const head = this.doc.createElement('div');
				head.className = 'zw-modern-cardhead';
				const title = this.doc.createElement('strong');
				title.textContent = descriptor.label;
				const icon = this._createVisibilityIcon(descriptor.id, descriptor);
				if (icon) {
						head.append(icon);
				}
				head.append(title);
				if (descriptor.sharedWith) {
						const shared = this.doc.createElement('small');
						shared.dataset.zwSharedSetting = descriptor.id;
						shared.textContent = '共通設定';
						shared.title = descriptor.sharedWith + ' と同じ設定値です。';
						head.append(shared);
				}
				if (descriptor.description) {
						const help = this._button('?', 'data-zw-help', descriptor.id, 'zw-modern-plainbtn');
						help.setAttribute('aria-label', descriptor.label + 'の説明を表示');
						head.append(help);
				}
				const reset = this._button('↺', 'data-zw-reset-item', descriptor.id, 'zw-modern-plainbtn');
				reset.title = 'この項目を初期値に戻す';
				head.append(reset);
				card.append(head);
				const controls = this.doc.createElement('div');
				controls.className = 'zw-modern-cardcontrols';
				if (descriptor.type === 'shortcut') {
						const key = this.doc.createElement('span');
						key.dataset.zwKeyDisplay = '';
						key.textContent = this.formatKeyCombo(this.model.get(descriptor.id));
						controls.append(key, this._button('変更', 'data-zw-record', descriptor.id, 'zw-modern-plainbtn'), this._button('解除', 'data-zw-clear-key', descriptor.id, 'zw-modern-plainbtn'));
						const seek = this.model.descriptor('PARAM_' + descriptor.actionId);
						if (seek) {
								const raw = Number(this.model.get(seek.id)) || 0;
								const sign = this._seekDirections.get(seek.id) || (raw > 0 ? 1 : -1);
								const group = this.doc.createElement('div');
								group.className = 'zw-modern-seek-editor';
								const direction = this.doc.createElement('select');
								direction.dataset.zwSeekDirection = seek.id;
								direction.setAttribute('aria-label', 'シーク方向');
								for (const [value, label] of [['-1', '戻る'], ['1', '進む']]) {
										const option = this.doc.createElement('option');
										option.value = value;
										option.textContent = label;
										direction.append(option);
								}
								direction.value = String(sign);
								const magnitude = this.doc.createElement('input');
								magnitude.type = 'number';
								magnitude.min = '0';
								magnitude.step = '0.1';
								magnitude.value = String(Math.abs(raw));
								magnitude.dataset.zwSeekMagnitude = seek.id;
								magnitude.setAttribute('aria-label', 'シーク秒数');
								group.append(direction, magnitude);
								const unit = this.doc.createElement('span');
								unit.textContent = '秒';
								group.append(unit);
								controls.append(group);
								const slot = Number((descriptor.actionId || '').match(/CUSTOM_SEEK_(\d+)/)?.[1]);
								if (Number.isInteger(slot)) {
										const remove = this._button('削除', 'data-zw-remove-seek', String(slot), 'zw-modern-plainbtn');
										remove.title = 'この枠のキーと秒数を初期値に戻す（保存前はキャンセル可能）';
										controls.append(remove);
								}
						}
						const warns = this.model.keyConflicts(this.model.get(descriptor.id));
						if (warns.length > 1) {
								const warning = this.doc.createElement('span');
								warning.className = 'zw-modern-warning';
								warning.textContent = '⚠ キー重複：' + warns.join('、');
								controls.append(warning);
						}
				}
				else if (descriptor.type === 'composite-ng') {
						const host = this.doc.createElement('div');
						host.className = 'zw-composite-ng-host';
						host.style.cssText = 'width:100%;min-width:0;';
						controls.append(host);
						if (typeof NgCompositeRuleEditor !== 'undefined') {
								this._ngCompositeEditor = new NgCompositeRuleEditor(host, this.model.get(descriptor.id), draft => {
										this.model.set(descriptor.id, draft);
										this._refreshFooter();
								});
						}
						else {
								host.textContent = '複合NGエディターを読み込めませんでした。';
						}
				}
				else if (descriptor.type === 'related-order') {
						controls.append(this._renderRelatedOrderControls());
				}
				else if (descriptor.type === 'related-links') {
						if (this.relatedEditor) {
								this.relatedEditor.showList();
								const editor = this.relatedEditor.container;
								editor.querySelector('[data-rl-save]').hidden = true;
								editor.querySelector('[data-rl-cancel]').hidden = true;
								const toolbar = editor.querySelector('.rl-toolbar');
								if (toolbar) {
										toolbar.setAttribute('aria-label', '変更は設定画面の下部から保存します');
								}
								controls.append(editor);
						}
						else {
								const info = this.doc.createElement('span');
								info.textContent = 'カスタムリンクの編集を利用できません。';
								controls.append(info);
						}
				}
				else if (descriptor.type === 'regex-flags') {
						const box = this.doc.createElement('div');
						box.className = 'zw-modern-regex-editor';
						const flags = String(this.model.get(descriptor.id) || '');
						const choices = [
								['i', '大文字・小文字を区別しない（おすすめ）'],
								['m', '^ と $ を行ごとに判定する'],
								['s', '「.」を改行にも一致させる'],
								['u', '日本語などのUnicode文字を正しく扱う']
						];
						for (const [flag, label] of choices) {
								const line = this.doc.createElement('label');
								const check = this.doc.createElement('input');
								check.type = 'checkbox';
								check.dataset.zwRegexFlag = flag;
								check.dataset.zwRegexId = descriptor.id;
								check.checked = flags.includes(flag);
								check.disabled = !this.model.isEnabled(descriptor.id);
								line.append(check, this.doc.createTextNode(label));
								box.append(line);
						}
						const current = this.doc.createElement('div');
						current.className = 'zw-modern-regex-current';
						current.textContent = '現在のフラグ: ';
						const value = this.doc.createElement('code');
						value.dataset.zwRegexValue = '';
						value.textContent = flags || '（なし）';
						current.append(value);
						box.append(current);
						const toggle = this._button('詳細：フラグを直接入力', 'data-zw-regex-advanced-toggle', descriptor.id, 'zw-modern-plainbtn');
						toggle.setAttribute('aria-expanded', 'false');
						box.append(toggle);
						const advanced = this.doc.createElement('div');
						advanced.dataset.zwRegexAdvancedPanel = '';
						advanced.hidden = true;
						const raw = this.doc.createElement('input');
						raw.type = 'text';
						raw.dataset.settingName = descriptor.id;
						raw.dataset.zwRegexRaw = '';
						raw.value = flags;
						raw.setAttribute('aria-label', '正規表現のフラグを直接入力');
						raw.disabled = !this.model.isEnabled(descriptor.id);
						const caution = this.doc.createElement('small');
						caution.textContent = 'g・yなどのフラグはNG判定の結果が変化する場合があります。初心者は通常iだけで十分です。';
						advanced.append(raw, caution);
						box.append(advanced);
						controls.append(box);
				}
				else if (descriptor.type === 'font-picker') {
						const box = this.doc.createElement('div');
						box.className = 'zw-modern-font-editor';
						const preset = this.doc.createElement('select');
						preset.dataset.zwFontPreset = descriptor.id;
						preset.setAttribute('aria-label', 'フォントの候補から選択');
						for (const entry of descriptor.options) {
								const option = this.doc.createElement('option');
								option.value = entry.value;
								option.textContent = entry.label;
								preset.append(option);
						}
						const free = this.doc.createElement('option');
						free.value = '__custom__';
						free.textContent = 'その他（自由入力）';
						preset.append(free);
						const value = String(this.model.get(descriptor.id) ?? '');
						preset.value = descriptor.options.some(o => o.value === value) ? value : '__custom__';
						const custom = this.doc.createElement('input');
						custom.type = 'text';
						custom.dataset.settingName = descriptor.id;
						custom.dataset.zwFontCustom = descriptor.id;
						custom.value = value;
						custom.placeholder = "'好きなフォント名', sans-serif";
						custom.setAttribute('aria-label', 'フォント名を自由に入力');
						custom.hidden = preset.value !== '__custom__';
						custom.disabled = !this.model.isEnabled(descriptor.id);
						preset.disabled = !this.model.isEnabled(descriptor.id);
						box.append(preset, custom);
						controls.append(box);
				}
				else if (descriptor.type === 'color') {
						controls.append(this._createColorEditor(descriptor));
				}
				else if (descriptor.type === 'slider') {
						const holder = this.doc.createElement('div');
						holder.className = 'zw-modern-slider';
						const value = this.model.get(descriptor.id);
						const makeInput = (type) => {
								const input = this.doc.createElement('input');
								input.type = type;
								input.dataset.settingName = descriptor.id;
								input.min = String(descriptor.min);
								input.max = String(descriptor.max);
								input.step = String(descriptor.step || 1);
								input.value = String(value);
								input.disabled = !this.model.isEnabled(descriptor.id);
								input.setAttribute('aria-label', descriptor.label + (type === 'number' ? 'の数値入力' : 'のスライダー'));
								return input;
						};
						holder.append(makeInput('range'), makeInput('number'));
						if (descriptor.unit) {
								const unit = this.doc.createElement('span');
								unit.textContent = descriptor.unit;
								holder.append(unit);
						}
						controls.append(holder);
				}
				else if (descriptor.type === 'select' && descriptor.presentation === 'dropdown') {
						const select = this.doc.createElement('select');
						select.dataset.settingName = descriptor.id;
						select.setAttribute('aria-label', descriptor.label);
						select.disabled = !this.model.isEnabled(descriptor.id);
						for (const choice of descriptor.options || []) {
								const option = this.doc.createElement('option');
								option.value = String(choice.value);
								option.textContent = choice.label;
								select.append(option);
						}
						const value = String(this.model.get(descriptor.id));
						if (!Array.from(select.options).some(option => option.value === value)) {
								const option = this.doc.createElement('option');
								option.value = value;
								option.textContent = '従来の設定値：' + value;
								select.append(option);
						}
						select.value = value;
						controls.append(select);
				}
				else if (descriptor.type === 'select' && descriptor.options.length > 0) {
						const segments = this.doc.createElement('div');
						segments.className = 'zw-modern-segments';
						for (const option of descriptor.options) {
								const b = this._button(option.label, 'data-zw-choice', descriptor.id);
								b.dataset.zwValue = String(option.value);
								b.disabled = !this.model.isEnabled(descriptor.id);
								if (String(this.model.get(descriptor.id)) === String(option.value)) {
										b.classList.add('is-selected');
								}
								segments.append(b);
						}
						const existingValue = String(this.model.get(descriptor.id) ?? '');
						if (!descriptor.options.some(o => String(o.value) === existingValue)) {
								const legacy = this._button('従来の設定値：' + existingValue, 'data-zw-choice', descriptor.id);
								legacy.dataset.zwValue = existingValue;
								legacy.classList.add('is-selected');
								legacy.disabled = true;
								legacy.title = '旧バージョンの値を保持しています。変更しなければそのまま保存されます。';
								segments.append(legacy);
						}
						controls.append(segments);
				}
				else {
						const original = descriptor.input;
						if (original) {
								if (!this._moved.has(original)) {
										this._moved.set(original, { parent: original.parentNode, next: original.nextSibling });
								}
								original.disabled = !this.model.isEnabled(descriptor.id);
								original.setAttribute('aria-label', descriptor.label);
								if (original.type === 'checkbox') {
										original.checked = !!this.model.get(descriptor.id);
								}
								else {
										const value = this.model.get(descriptor.id);
										original.value = descriptor.id === 'userIdFilter' ?
												ModernAdvancedSettingsUI._formatNgUserIds(value) : (value ?? '');
								}
								controls.append(original);
						}
						else {
								const input = this.doc.createElement(descriptor.type === 'textarea' ? 'textarea' : 'input');
								if (input.tagName === 'INPUT') {
										input.type = descriptor.type === 'boolean' ? 'checkbox' :
												['number', 'seconds'].includes(descriptor.type) ? 'number' : 'text';
								}
								if (input.type === 'checkbox') {
										input.checked = !!this.model.get(descriptor.id);
								}
								else {
										const value = this.model.get(descriptor.id);
										input.value = descriptor.id === 'userIdFilter' ?
												ModernAdvancedSettingsUI._formatNgUserIds(value) : String(value ?? '');
								}
								input.dataset.settingName = descriptor.id;
								input.setAttribute('aria-label', descriptor.label);
								input.disabled = !this.model.isEnabled(descriptor.id);
								controls.append(input);
						}
				}
				if (descriptor.id === 'screenshot.prefix') {
						const presets = this.doc.createElement('div');
						presets.className = 'zw-modern-prefix-presets';
						const prompt = this.doc.createElement('span');
						prompt.textContent = '先頭の文字をすぐ設定：';
						presets.append(prompt);
						for (const [label, value] of [
								['追加しない', ''], ['スクショ_', 'スクショ_'],
								['Zenza_', 'Zenza_'], ['clip_', 'clip_'],
								['保存日_', '{date}_'], ['動画ID_', '{watchId}_']
						]) {
								const button = this._button(label, 'data-zw-screenshot-prefix', value, 'zw-modern-plainbtn');
								button.disabled = !this.model.isEnabled(descriptor.id);
								if (String(this.model.get(descriptor.id) ?? '') === value) {
										button.classList.add('is-selected');
								}
								presets.append(button);
						}
						controls.append(presets);
						const help = this.doc.createElement('p');
						help.className = 'zw-modern-prefix-hint';
						help.textContent = '先頭に付ける文字には {date}（保存日）、{watchId}（動画ID）、{time}（再生位置）が使えます。ファイル名の残りの構成は下の設定で変更できます。';
						controls.append(help);
						const text = controls.querySelector('[data-setting-name="screenshot.prefix"]');
						if (text) {
								text.setAttribute('placeholder', '例：スクショ_{date}_');
						}
				}
				if (descriptor.id === 'screenshot.filenameTemplate') {
						const presets = this.doc.createElement('div');
						presets.className = 'zw-modern-prefix-presets';
						for (const entry of (this.screenshotFileName?.PRESETS || [
								{ name: '従来どおり（標準）', value: '' }
						])) {
								const button = this._button(entry.name, 'data-zw-filename-template', entry.value, 'zw-modern-plainbtn');
								if (this.model.get(descriptor.id) === entry.value) {
										button.classList.add('is-selected');
								}
								presets.append(button);
						}
						controls.append(presets);
						const hint = this.doc.createElement('p');
						hint.className = 'zw-modern-prefix-hint';
						hint.textContent = '下の変数を組み合わせて順番・区切りを自由に指定できます。空欄なら元の保存形式を維持します。';
						controls.append(hint);
						const tokens = this.doc.createElement('div');
						tokens.className = 'zw-modern-prefix-presets';
						const labels = { title: '動画タイトル', watchId: '視聴ID', videoId: '動画ID',
								uploader: '投稿者名', time: '再生位置', date: '保存日', datetime: '保存日時',
								suffix: 'コメント付き記号' };
						for (const key of (this.screenshotFileName?.TOKENS || Object.keys(labels))) {
								const button = this._button('＋ ' + labels[key], 'data-zw-filename-token', key, 'zw-modern-plainbtn');
								button.title = '{' + key + '} を挿入';
								tokens.append(button);
						}
						controls.append(tokens);
				}
				card.append(controls);
				if (descriptor.id === 'commandFilter') {
						const guide = this.doc.createElement('section');
						guide.className = 'zw-modern-command-assist';
						guide.dataset.zwCommandGuide = '';
						const intro = this.doc.createElement('p');
						intro.textContent = 'コマンド＝投稿時に指定された色・文字サイズ・表示位置です。下のボタンでNGコマンドを追加できます。1行に1つ記入し、1つでもコマンド欄に含まれるとそのコメントを非表示にします。';
						const warning = this.doc.createElement('p');
						warning.textContent = '注意：NGワードや別のNGコマンドとは「どれか1つで除外」です。red と big を別行に書いても「赤かつ大文字」にはなりません。本文・色・サイズの組み合わせは別途複合ルールで設定します。';
						guide.append(intro, warning);
						const entries = [
								['文字色', [['red', '赤'], ['blue', '青'], ['green', '緑'], ['yellow', '黄'],
												['pink', 'ピンク'], ['cyan', '水色'], ['black', '黒']]],
								['文字サイズ', [['big', '大きい'], ['small', '小さい']]],
								['表示位置', [['ue', '画面上部'], ['shita', '画面下部']]]
						];
						const activeCommands = new Set(String(this.model.get('commandFilter') ?? '')
								.split(/\r?\n/).map(c => c.trim().toLowerCase()).filter(Boolean));
						for (const [name, items] of entries) {
								const group = this.doc.createElement('div');
								group.className = 'zw-modern-command-group';
								const heading = this.doc.createElement('strong');
								heading.textContent = name;
								group.append(heading);
								for (const [token, meaning] of items) {
										const button = this._button(token + '（' + meaning + '）', 'data-zw-command-preset', token);
										button.title = meaning + 'のコマンドをNG一覧に追加';
										button.setAttribute('aria-label', 'NGコマンドに' + token + '（' + meaning + '）を追加');
										button.disabled = !this.model.isEnabled('commandFilter') || activeCommands.has(token);
										group.append(button);
								}
								guide.append(group);
						}
						card.append(guide);
				}
				const example = this._makeVisualExample(descriptor);
				if (example) {
						card.append(example);
				}
				if (descriptor.description) {
						const note = this.doc.createElement('p');
						note.className = 'zw-modern-note';
						note.textContent = descriptor.description;
						note.hidden = true;
						card.append(note);
				}
				return card;
		}
		_renderDataPanel() {
				this.root.querySelector('[data-zw-title]').textContent = 'データ管理';
				this.root.querySelector('[data-zw-path]').textContent = 'プレイリスト・検索 / データ管理';
				this.root.querySelector('[data-zw-subtitle]').textContent = '既存の設定JSONとプレイリストの保存・復元';
				this.root.querySelector('[data-zw-reset-category]').hidden = true;
				this.cards.innerHTML = [
						'<section class="zw-modern-card zw-modern-backup">',
						'<h4>設定JSONのバックアップ</h4>',
						'<p>バックアップを取り込む操作は通常の下書き保存とは別です。確認後に即時反映し、画面を再読み込みします。</p>',
						'<textarea data-zw-backup-json spellcheck="false" aria-label="設定JSON"></textarea>',
						'<div class="zw-modern-actions">',
						'<button type="button" class="zw-modern-plainbtn" data-zw-backup-export>現在の設定JSONを表示</button>',
						'<button type="button" class="zw-modern-plainbtn" data-zw-backup-import>設定JSONを取り込む</button>',
						'</div>',
						'<h4>プレイリストデータ</h4>',
						'<textarea data-zw-playlist-json spellcheck="false" aria-label="プレイリストJSON"></textarea>',
						'<div class="zw-modern-actions">',
						'<button type="button" class="zw-modern-plainbtn" data-zw-playlist-export>プレイリストを表示</button>',
						'<button type="button" class="zw-modern-plainbtn" data-zw-playlist-import>プレイリストを取り込む</button>',
						'</div>',
						'<p data-zw-backup-status role="status" aria-live="polite"></p>',
						'</section>'
				].join('');
				this.cards.querySelectorAll('[data-zw-playlist-export],[data-zw-playlist-import]')
						.forEach(button => { button.disabled = !this.playlist; });
		}
		_onCustomMenuDraft(value) {
				const before = (this.model.get('relatedMenu.customLinks') || []);
				this.model.set('relatedMenu.customLinks', value);
				if (!this.root) {
						return;
				}
				const structure = JSON.stringify(before.map(x => x?.id)) !== JSON.stringify(value.map(x => x?.id));
				const keysChanged = JSON.stringify(before.map(x => x?.shortcutKey)) !== JSON.stringify(value.map(x => x?.shortcutKey));
				if (structure) {
						const added = value.filter(x => x && !before.some(old => old?.id === x.id)).at(-1);
						const selected = [...this._expandedRelatedOptions][0];
						if (added) {
								this._expandedRelatedOptions = new Set(['link:' + added.id]);
						}
						else if (selected?.startsWith('link:') && !value.some(x => 'link:' + x?.id === selected)) {
								this._expandedRelatedOptions = new Set(['builtin:official']);
						}
				}
				if (structure || keysChanged) {
						this._refreshRelatedOrderList();
				}
				else {
						for (const row of this.root.querySelectorAll('[data-zw-order-key]')) {
								const item = value.find(x => 'link:' + x?.id === row.dataset.zwOrderKey);
								if (item) {
										row.querySelector('.zw-order-name').textContent = item.label || item.id;
								}
						}
						const title = this.root.querySelector('[data-zw-order-detail-title]');
						const selected = [...this._expandedRelatedOptions][0];
						const item = value.find(x => 'link:' + x?.id === selected);
						if (title && item) {
								title.textContent = item.label || item.id;
						}
				}
				this._refreshFooter();
		}
		_relatedOrderEntries() {
				if (!this.relatedOrder || !this.model.descriptor('relatedMenu.order')) {
						return [];
				}
				const links = (this.model.get('relatedMenu.customLinks') || []);
				const actions = this.relatedActions?.getActions?.({}) || [];
				return this.relatedOrder.entries(links, actions, this.model.get('relatedMenu.order'));
		}
		_renderRelatedOrderControls() {
				const holder = this.doc.createElement('div');
				holder.className = 'zw-modern-order-editor zw-modern-order-compact';
				if (!this.relatedOrder) {
						holder.textContent = '関連メニューの並び替えを利用できません。';
						return holder;
				}
				const guide = this.doc.createElement('p');
				guide.className = 'zw-order-hint';
				guide.textContent = '左の一覧を並べ替え、右側で選択した項目を編集します。⠿をドラッグ（スマホは長押し）／Alt＋↑↓／上下ボタン。変更は下部の保存で確定します。';
				holder.append(guide);
				const toolbar = this.doc.createElement('div');
				toolbar.className = 'zw-order-toolbar';
				const refresh = this._button('一覧を更新', 'data-zw-order-refresh', '', 'zw-modern-plainbtn');
				refresh.title = '追加リンクや外部登録アクションを再読み込み（保存はしません）';
				toolbar.append(refresh);
				for (const [attr, label, kind] of [['data-zw-order-add-link', '＋ リンク', 'link'], ['data-zw-order-add-copy', '＋ コピー', 'copy']]) {
						const button = this._button(label, attr, kind, 'zw-modern-plainbtn');
						button.disabled = !this.relatedEditor || this.relatedEditor.original === null || this.relatedEditor.draft.length >= 40;
						toolbar.append(button);
				}
				toolbar.append(this._button('カスタム項目を初期値に戻す', 'data-zw-reset-item', 'relatedMenu.customLinks', 'zw-modern-plainbtn'));
				holder.append(toolbar);
				const workspace = this.doc.createElement('div');
				workspace.className = 'zw-order-workspace';
				const pane = this.doc.createElement('aside');
				pane.className = 'zw-order-inspector';
				pane.dataset.zwOrderDetailPane = '';
				pane.setAttribute('aria-label', '選択項目の詳細設定');
				const list = this.doc.createElement('ol');
				list.className = 'zw-modern-order-list';
				list.setAttribute('aria-label', '関連メニューの全項目');
				const entries = this._relatedOrderEntries();
				const prefs = (this.model.get(this.relatedOrder.OPTIONS_KEY) || {});
				this._expandedRelatedOptions = this._expandedRelatedOptions || new Set();
				const selected = entries.find(item => item.present && this._expandedRelatedOptions.has(item.key)) ||
						entries.find(item => item.present);
				this._expandedRelatedOptions = new Set(selected ? [selected.key] : []);
				const descriptions = {
						official: '公式視聴ページを開きます。ZenzaWatchの横取りを防ぐ識別子は自動で付けられます。',
						ad: 'ニコニ広告の宣伝画面を開きます。既定は小さな別ウィンドウです。',
						twitter: '動画IDを含むX（Twitter）の投稿を検索します。必要ならURLテンプレートを変更できます。',
						original: 'コミュニティ動画・マイメモリーの場合だけ元の動画へ移動します。',
						tree: '親作品・コンテンツツリーを開きます。動画によっては利用できません。',
						'tree-playlist': '親作品・子作品のリストを現在のプレイリストへ追加します。',
						'copy-url': '現在の動画からURL・動画IDなどをコピーします。'
				};
				const variableNames = {
						videoId: '動画ID（例: sm9）', watchId: '視聴ID（例: sm9）',
						videoUrl: '動画URL', videoTitle: '動画タイトル',
						uploaderUserId: '投稿者のユーザーID', uploaderChannelId: '投稿者のチャンネルID',
						uploaderName: '投稿者名', currentTime: '現在の再生位置（秒）'
				};
				const addField = (parent, label, control, desc = '') => {
						const field = this.doc.createElement('label');
						field.className = 'zw-order-field';
						const name = this.doc.createElement('span');
						name.textContent = label;
						field.append(name, control);
						if (desc) {
								const note = this.doc.createElement('small');
								note.textContent = desc;
								field.append(note);
						}
						parent.append(field);
						return control;
				};
				for (const [index, item] of entries.entries()) {
						const row = this.doc.createElement('li');
						row.className = 'zw-modern-order-row';
						if (!item.present) {
								row.classList.add('is-missing');
						}
						row.dataset.zwOrderKey = item.key;
						const grip = this._button('⠿', 'data-zw-order-grip', item.key, 'zw-modern-plainbtn zw-order-grip');
						grip.draggable = true;
						grip.title = 'ドラッグ・長押し、またはAlt＋上下キーで移動';
						grip.setAttribute('aria-label', item.label + 'を並べ替え');
						row.append(grip);
						const builtinId = item.type === 'builtin' ? item.key.slice(8) : null;
						const opts = builtinId ? this.relatedOrder.getOption(prefs, builtinId) : {};
						const label = opts.label || item.label;
						const name = this._button(label, 'data-zw-order-edit', item.key, 'zw-order-name');
						name.disabled = !item.present;
						row.classList.toggle('is-selected', selected?.key === item.key);
						row.append(name);
						const shortcutId = builtinId && this.relatedOrder.SHORTCUT_ACTION_IDS[builtinId];
						const keyId = shortcutId ? 'KEY_' + shortcutId : null;
						const shortcutValue = keyId ? Number(this.model.get(keyId)) || 0 :
								item.type === 'link' ? Number((this.model.get('relatedMenu.customLinks') || [])
										.find(link => 'link:' + link.id === item.key)?.shortcutKey) || 0 : 0;
						const keyBadge = this.doc.createElement('small');
						keyBadge.className = 'zw-order-key-preview';
						keyBadge.textContent = shortcutValue ? this.formatKeyCombo(shortcutValue) : 'キー未設定';
						keyBadge.hidden = !shortcutValue;
						if (shortcutValue) {
								const warnings = this.model.keyConflicts(shortcutValue);
								if (warnings.length > 1) {
										keyBadge.classList.add('is-conflict');
										keyBadge.title = '⚠ ショートカットの重複: ' + warnings.join('、');
										keyBadge.textContent += ' ⚠重複';
								}
						}
						row.append(keyBadge);
						const visible = this.doc.createElement('label');
						visible.className = 'zw-order-visible';
						const checkbox = this.doc.createElement('input');
						checkbox.type = 'checkbox';
						checkbox.dataset.zwOrderVisible = item.key;
						checkbox.checked = !(this.model.get('relatedMenu.hiddenItems') || []).includes(item.key);
						visible.append(checkbox, this.doc.createTextNode('表示'));
						row.append(visible);
						const edit = this._button(this._expandedRelatedOptions.has(item.key) ? '編集中' : '編集', 'data-zw-order-edit', item.key, 'zw-modern-plainbtn');
						edit.disabled = !item.present;
						edit.setAttribute('aria-expanded', String(this._expandedRelatedOptions.has(item.key)));
						row.append(edit);
						const up = this._button('↑', 'data-zw-order-up', item.key, 'zw-modern-plainbtn');
						const down = this._button('↓', 'data-zw-order-down', item.key, 'zw-modern-plainbtn');
						up.disabled = index === 0;
						down.disabled = index === entries.length - 1;
						up.title = '1つ上へ';
						down.title = '1つ下へ';
						row.append(up, down);
						if (this._expandedRelatedOptions.has(item.key)) {
								const details = this.doc.createElement('section');
								details.className = 'zw-order-details';
								details.dataset.zwOrderDetails = item.key;
								const heading = this.doc.createElement('h3');
								heading.dataset.zwOrderDetailTitle = '';
								heading.textContent = label;
								details.append(heading);
								const help = this.doc.createElement('p');
								help.textContent = builtinId ? descriptions[builtinId] :
										item.type === 'link' ? 'この項目の動作・内容・ショートカットを編集します。変更は保存するまで下書きです。' :
												'外部スクリプトが登録した機能です。名称・動作の変更は登録元で行います。';
								details.append(help);
								if (builtinId) {
										const title = this.doc.createElement('input');
										title.type = 'text';
										title.maxLength = 80;
										title.value = opts.label || '';
										title.placeholder = '標準名を使用: ' + item.label;
										title.dataset.zwBuiltinField = 'label';
										title.dataset.zwBuiltinId = builtinId;
										addField(details, 'メニューに表示する名前', title, '空欄に戻すと標準の名前を使用します。');
										if (keyId && this.model.descriptor(keyId)) {
												const line = this.doc.createElement('div');
												line.className = 'zw-order-shortcut-editor';
												const caption = this.doc.createElement('span');
												caption.textContent = 'ショートカット: ' + (shortcutValue ? this.formatKeyCombo(shortcutValue) : '(未設定)');
												line.append(caption, this._button('変更', 'data-zw-record', keyId, 'zw-modern-plainbtn'), this._button('解除', 'data-zw-clear-key', keyId, 'zw-modern-plainbtn'));
												details.append(line);
												const warning = this.model.keyConflicts(shortcutValue);
												if (shortcutValue && warning.length > 1) {
														const alert = this.doc.createElement('p');
														alert.className = 'zw-order-warning';
														alert.textContent = '⚠ キーが重複しています: ' + warning.join('、') + '（既存割り当ては自動解除しません）';
														details.append(alert);
												}
												const sync = this.doc.createElement('small');
												sync.textContent = '「ショートカット」欄と同じ設定値を編集します。変更は保存するまで確定しません。';
												details.append(sync);
										}
										if (['official', 'ad', 'twitter', 'tree'].includes(builtinId)) {
												const select = this.doc.createElement('select');
												select.dataset.zwBuiltinField = 'openMode';
												select.dataset.zwBuiltinId = builtinId;
												for (const [val, text] of [['default', '既定の動作'], ['same-tab', '現在のタブで開く'],
														['new-tab', '新しいタブで開く'], ['new-window', '新しいウィンドウを要求']]) {
														const option = this.doc.createElement('option');
														option.value = val;
														option.textContent = text;
														select.append(option);
												}
												select.value = opts.openMode || 'default';
												addField(details, 'リンクの開き方', select, '新規ウィンドウはブラウザの設定によってタブになる場合があります。');
												if (select.value === 'new-window') {
														const sizes = this.doc.createElement('div');
														sizes.className = 'zw-order-sizes';
														for (const [field, label, defaultSize] of [
																['popupWidth', '横幅', builtinId === 'ad' ? 428 : 760],
																['popupHeight', '高さ', builtinId === 'ad' ? 600 : 650]
														]) {
																const box = this.doc.createElement('input');
																box.type = 'number';
																box.min = '250';
																box.max = '1800';
																box.step = '1';
																box.value = String(opts[field] || defaultSize);
																box.dataset.zwBuiltinField = field;
																box.dataset.zwBuiltinId = builtinId;
																addField(sizes, label + '（px）', box);
														}
														details.append(sizes);
												}
										}
										if (builtinId === 'official') {
												const box = this.doc.createElement('input');
												box.type = 'checkbox';
												box.checked = opts.includePosition !== false;
												box.dataset.zwBuiltinField = 'includePosition';
												box.dataset.zwBuiltinId = builtinId;
												addField(details, '現在の再生位置を公式プレイヤーへ引き継ぐ', box);
										}
										if (builtinId === 'copy-url') {
												const select = this.doc.createElement('select');
												select.dataset.zwBuiltinField = 'copyFormat';
												select.dataset.zwBuiltinId = builtinId;
												for (const [val, text] of [['url', '動画URL（従来どおり）'], ['id', '動画IDのみ'],
														['position', '再生位置付き動画URL'], ['title-url', '動画タイトル＋URL'],
														['markdown', 'Markdown形式のリンク']]) {
														const option = this.doc.createElement('option');
														option.value = val;
														option.textContent = text;
														select.append(option);
												}
												select.value = opts.copyFormat || 'url';
												addField(details, 'コピーする形式', select, '「動画IDのみ」では sm9 のような識別子だけをコピーします。');
										}
										if (['twitter', 'tree'].includes(builtinId)) {
												const input = this.doc.createElement('input');
												input.type = 'text';
												input.value = opts.urlTemplate || '';
												input.placeholder = '未入力なら既存の公式URLを使用';
												input.maxLength = 2048;
												input.dataset.zwBuiltinField = 'urlTemplate';
												input.dataset.zwBuiltinId = builtinId;
												addField(details, 'URLテンプレート（任意）', input, 'https:// から始めてください。空欄なら従来のリンクを使用します。');
												const palette = this.doc.createElement('div');
												palette.className = 'zw-order-variable-palette';
												const intro = this.doc.createElement('p');
												intro.textContent = '変数を挿入：動画ごとに自動で値を置き換えます。使える変数は8種類すべて表示しています。';
												palette.append(intro);
												for (const token of this.relatedActions?.VARIABLES || Object.keys(variableNames)) {
														const button = this._button('{' + token + '}', 'data-zw-builtin-insert', token, 'zw-modern-plainbtn');
														button.dataset.zwBuiltinId = builtinId;
														button.title = variableNames[token] || token;
														palette.append(button);
												}
												const explains = this.doc.createElement('small');
												explains.textContent = Object.entries(variableNames).map(([v, label]) => '{' + v + '} = ' + label).join(' / ');
												palette.append(explains);
												details.append(palette);
										}
										const reset = this._button('この項目の詳細だけ初期値に戻す', 'data-zw-builtin-reset', builtinId, 'zw-modern-plainbtn');
										details.append(reset);
								}
								pane.append(details);
						}
						list.append(row);
				}
				if (this.relatedEditor) {
						const editor = this.relatedEditor.container;
						editor.querySelector('[data-rl-save]').hidden = true;
						editor.querySelector('[data-rl-cancel]').hidden = true;
						editor.hidden = selected?.type !== 'link';
						this.relatedEditor.showDetail(selected?.type === 'link' ? selected.key.slice(5) : null);
						pane.append(editor);
				}
				workspace.append(list, pane);
				holder.append(workspace);
				const status = this.doc.createElement('p');
				status.dataset.zwOrderStatus = '';
				status.setAttribute('role', 'status');
				status.setAttribute('aria-live', 'polite');
				status.textContent = this._orderAnnouncement || '';
				holder.append(status);
				return holder;
		}
		_refreshRelatedOrderList() {
				if (!this.root) {
						return;
				}
				this._clearTouchOrder();
				const card = this.root.querySelector('[data-zw-id="relatedMenu.order"]');
				const controls = card?.querySelector('.zw-modern-cardcontrols');
				if (controls) {
						controls.replaceChildren(this._renderRelatedOrderControls());
				}
				card?.classList.toggle('is-modified', this.model.isDifferentFromDefault('relatedMenu.order') ||
						this.model.isDifferentFromDefault('relatedMenu.hiddenItems') ||
						this.model.isDifferentFromDefault('relatedMenu.builtinOptions'));
		}
		_moveRelatedOrder(fromKey, toKey, after = false) {
				const entries = this._relatedOrderEntries();
				const keys = entries.map(entry => entry.key);
				const from = keys.indexOf(fromKey), to = keys.indexOf(toKey);
				if (from < 0 || to < 0) {
						return false;
				}
				const insertion = to + (after ? 1 : 0);
				const position = from < insertion ? insertion - 1 : insertion;
				if (position === from) {
						return false;
				}
				keys.splice(position, 0, keys.splice(from, 1)[0]);
				this.model.set('relatedMenu.order', keys);
				this._orderAnnouncement = '「' + (entries[from]?.label || fromKey) + '」を' +
						(position + 1) + '番目に移動しました。保存前ならキャンセルできます。';
				this._renderCards();
				this._refreshFooter();
				return true;
		}
		_clearRelatedOrderDrag() {
				this._orderDragKey = null;
				this._orderDropKey = null;
				this._orderDropAfter = false;
				this.root.querySelectorAll('.zw-modern-order-row.is-dragging,.zw-modern-order-row.is-drop-before,.zw-modern-order-row.is-drop-after')
						.forEach(row => row.classList.remove('is-dragging', 'is-drop-before', 'is-drop-after'));
		}
		_onOrderDragStart(e) {
				const grip = e.target.closest?.('[data-zw-order-grip]');
				if (!grip || !this.root.contains(grip)) {
						return;
				}
				this._orderDragKey = grip.dataset.zwOrderGrip;
				grip.closest('.zw-modern-order-row')?.classList.add('is-dragging');
				if (e.dataTransfer) {
						e.dataTransfer.effectAllowed = 'move';
						e.dataTransfer.setData('text/plain', this._orderDragKey);
				}
		}
		_onOrderDragOver(e) {
				if (!this._orderDragKey) {
						return;
				}
				const row = e.target.closest?.('.zw-modern-order-row');
				if (!row || !this.root.contains(row)) {
						return;
				}
				e.preventDefault();
				if (e.dataTransfer) {
						e.dataTransfer.dropEffect = 'move';
				}
				const rect = row.getBoundingClientRect();
				const keys = this._relatedOrderEntries().map(entry => entry.key);
				this._orderDropAfter = rect.height > 0 ?
						e.clientY > rect.top + rect.height / 2 :
						keys.indexOf(this._orderDragKey) < keys.indexOf(row.dataset.zwOrderKey);
				this._orderDropKey = row.dataset.zwOrderKey;
				this.root.querySelectorAll('.zw-modern-order-row.is-drop-before,.zw-modern-order-row.is-drop-after')
						.forEach(item => item.classList.remove('is-drop-before', 'is-drop-after'));
				row.classList.add(this._orderDropAfter ? 'is-drop-after' : 'is-drop-before');
		}
		_onOrderDrop(e) {
				if (!this._orderDragKey) {
						return;
				}
				e.preventDefault();
				const from = this._orderDragKey, to = this._orderDropKey, after = this._orderDropAfter;
				this._clearRelatedOrderDrag();
				if (to) {
						this._moveRelatedOrder(from, to, after);
				}
		}
		_onOrderDragEnd() { this._clearRelatedOrderDrag(); }
		_onTouchOrderDown(e) {
				if (e.pointerType !== 'touch' || this._touchOrder) {
						return;
				}
				const grip = e.target.closest?.('[data-zw-order-grip]');
				if (!grip || !this.root.contains(grip)) {
						return;
				}
				const key = grip.dataset.zwOrderGrip;
				if (!this._relatedOrderEntries().some(item => item.key === key)) {
						return;
				}
				const state = { id: e.pointerId, key, grip, active: false, dropKey: null, after: false, timer: null };
				this._touchOrder = state;
				state.timer = this.win.setTimeout(() => {
						if (this._touchOrder !== state) {
								return;
						}
						if (!this.root.contains(grip)) {
								this._clearTouchOrder();
								return;
						}
						try {
								grip.setPointerCapture?.(e.pointerId);
						}
						catch (_) {
								this._clearTouchOrder();
								return;
						}
						state.active = true;
						grip.closest('.zw-modern-order-row')?.classList.add('is-touch-dragging');
				}, 260);
		}
		_onTouchOrderMove(e) {
				const state = this._touchOrder;
				if (!state || state.id !== e.pointerId || !state.active) {
						return;
				}
				e.preventDefault();
				const hit = this.doc.elementFromPoint?.(e.clientX, e.clientY) || e.target;
				const row = hit?.closest?.('[data-zw-order-key]');
				if (!row || !this.root.contains(row)) {
						return;
				}
				state.dropKey = row.dataset.zwOrderKey;
				const bounds = row.getBoundingClientRect();
				state.after = bounds.height > 0 ? e.clientY > bounds.top + bounds.height / 2 :
						this._relatedOrderEntries().findIndex(i => i.key === state.key) <
								this._relatedOrderEntries().findIndex(i => i.key === state.dropKey);
				this.root.querySelectorAll('.zw-modern-order-row.is-drop-before,.zw-modern-order-row.is-drop-after')
						.forEach(el => el.classList.remove('is-drop-before', 'is-drop-after'));
				row.classList.add(state.after ? 'is-drop-after' : 'is-drop-before');
		}
		_onTouchOrderUp(e) {
				const state = this._touchOrder;
				if (!state || state.id !== e.pointerId) {
						return;
				}
				const shouldMove = state.active && state.dropKey && state.dropKey !== state.key;
				const from = state.key, to = state.dropKey, after = state.after;
				this._clearTouchOrder();
				if (shouldMove) {
						this._moveRelatedOrder(from, to, after);
				}
		}
		_clearTouchOrder() {
				const state = this._touchOrder;
				if (!state) {
						return;
				}
				this._touchOrder = null;
				this.win.clearTimeout(state.timer);
				try {
						state.grip.releasePointerCapture?.(state.id);
				}
				catch (_) { }
				state.grip.closest('.zw-modern-order-row')?.classList.remove('is-touch-dragging');
				this.root.querySelectorAll('.zw-modern-order-row.is-drop-before,.zw-modern-order-row.is-drop-after')
						.forEach(el => el.classList.remove('is-drop-before', 'is-drop-after'));
		}
		_customSeekSlots() {
				return Array.from({ length: 10 }, (_, n) => n + 1).filter(n => this.model.descriptor('KEY_CUSTOM_SEEK_' + n) &&
						this.model.descriptor('PARAM_CUSTOM_SEEK_' + n));
		}
		_usedCustomSeekSlots() {
				return this._customSeekSlots().filter(n => this._visibleSeekSlots.has(n) ||
						Number(this.model.get('KEY_CUSTOM_SEEK_' + n)) !== 0 ||
						Number(this.model.get('PARAM_CUSTOM_SEEK_' + n)) !== 0);
		}
		_createSceneLayoutPicker() {
				const wrap = this.doc.createElement('section');
				wrap.className = 'zw-scui-picker';
				wrap.dataset.zwSceneLayoutGallery = '';
				wrap.setAttribute('aria-label', 'シーンサーチの表示方式');
				const mode = this._sceneLayoutTab;
				const key = 'sceneSearch.presentation.' + mode;
				const current = String(this.model.get(key) || 'follow');
				const linked = mode === 'fullscreen' && this.model.get('sceneSearch.layout.linkFullscreen') === true;
				wrap.classList.toggle('is-modified', this.model.isDifferentFromDefault(key));
				const header = this.doc.createElement('div');
				header.className = 'zw-scui-pickerhead';
				const heading = this.doc.createElement('strong');
				heading.textContent = 'プレビューの表示方式';
				const tabs = this.doc.createElement('div');
				tabs.className = 'zw-scui-tabs';
				tabs.setAttribute('role', 'group');
				tabs.setAttribute('aria-label', '設定する画面');
				for (const [value, label] of [['normal', '通常表示'], ['fullscreen', '全画面']]) {
						const b = this._button(label, 'data-zw-scene-layout-mode', value);
						b.setAttribute('aria-pressed', String(mode === value));
						tabs.append(b);
				}
				header.append(heading, tabs);
				wrap.append(header);
				this._sceneMainLayouts = this._sceneMainLayouts || {};
				if (current !== 'legacy') {
						this._sceneMainLayouts[mode] = current;
				}
				const grid = this.doc.createElement('div');
				grid.className = 'zw-scui-layout-grid';
				grid.setAttribute('role', 'group');
				grid.setAttribute('aria-label', 'プレビューの3つの表示方式');
				for (const [value, label, description] of [
						['follow', 'シーク位置に追従', 'シーク先の上に表示。端では画面内に収めます。'],
						['fixed', '位置を固定', '同じ場所で確認。小画面ではシークバー付近の空き領域を使います。'],
						['legacy', '従来表示', 'コメントボタンで画像とコメントプレビューを切り替えます。']
				]) {
						const b = this._button('', 'data-zw-scene-layout', value, 'zw-scui-layout-option');
						b.dataset.zwSceneLayoutMode = mode;
						b.disabled = linked || !this.model.isEnabled(key);
						b.setAttribute('aria-pressed', String(current === value));
						b.setAttribute('aria-label', label);
						const mini = this.doc.createElement('span');
						mini.className = 'zw-scui-mini';
						mini.dataset.layout = value;
						mini.innerHTML = '<i><span>☁</span></i><b>☰</b><em></em>';
						const factor = Math.min(1.5, Math.max(.5, Number(this.model.get('sceneSearch.thumbnailScale') || 100) / 100));
						const imageWidth = 28 * factor, left = (100 - imageWidth - 38) / 2;
						Object.assign(mini.querySelector('i').style, { left: left + '%', width: imageWidth + '%', height: 24 * factor + 'px' });
						Object.assign(mini.querySelector('i span').style, { fontSize: 9 * factor + 'px', lineHeight: 24 * factor + 'px' });
						mini.querySelector('b').style.left = (left + imageWidth + 2) + '%';
						const master = this.model.get('sceneSearch.commentPreviewVisible') !== false;
						mini.querySelector('i span').hidden = !master || this.model.get('sceneSearch.miniCommentVisible') === false;
						mini.querySelector('b').style.opacity = master && this.model.get('sceneSearch.commentListVisible') !== false ? '1' : '.25';
						mini.querySelector('b').style.backgroundColor = 'rgba(0,0,0,' + (Number(this.model.get('sceneSearch.commentListBackgroundOpacity') ?? 90) / 100) + ')';
						const title = this.doc.createElement('strong');
						title.textContent = label;
						const detail = this.doc.createElement('small');
						detail.textContent = description;
						b.append(mini, title, detail);
						grid.append(b);
				}
				wrap.append(grid);
				const note = this.doc.createElement('small');
				note.className = 'zw-scui-note';
				note.textContent = linked ? '通常表示の方式を使用します。全画面用の選択は保持しています。' :
						'中央のコメントボタンで開閉します。変更は「変更を保存」で反映します。';
				wrap.append(note);
				const config = this.model.config;
				const migration = config.resolveSceneSearch?.()?.migration || [];
				if (migration.length && config.getValue?.('sceneSearch.presentation.migrationAcknowledged') !== true) {
						const info = this.doc.createElement('aside');
						info.dataset.zwSceneMigration = '';
						info.className = 'zw-scui-note';
						const names = { follow: 'シーク位置に追従', fixed: '位置を固定', legacy: '従来表示' };
						info.append('表示方式を整理しました。');
						for (const item of migration) {
								const old = this.model.descriptor(item.key.replace('presentation', 'layout'))?.options?.find(o => o.value === item.oldValue)?.label || item.oldValue;
								const line = this.doc.createElement('div');
								line.textContent = old + ' → ' + names[item.newValue];
								info.append(line);
						}
						info.append(this._button('確認した', 'data-zw-scene-migration-ack', ''));
						wrap.append(info);
				}
				return wrap;
		}
		_createPopupColorPanel(rows) {
				const section = this.doc.createElement('section');
				section.className = 'zw-popup-settings';
				const controls = this.doc.createElement('div');
				controls.className = 'zw-popup-settings-controls';
				controls.append(...rows);
				const preview = this.doc.createElement('aside');
				preview.className = 'zw-popup-preview';
				preview.setAttribute('aria-label', '通知の色のプレビュー');
				const title = this.doc.createElement('h4');
				title.textContent = '通知のプレビュー';
				const note = this.doc.createElement('p');
				note.textContent = '変更はこの見本にすぐ反映されます。実際のプレイヤーへの反映は「変更を保存」の後です。';
				preview.append(title, note);
				for (const [key, label, example] of [
						['popup.notifyColor', '通常・成功通知', '✓ 保存しました'],
						['popup.alertColor', 'エラー通知', '! コメントの取得に失敗しました']
				]) {
						const labelNode = this.doc.createElement('p');
						labelNode.textContent = label;
						const sample = this.doc.createElement('div');
						sample.className = 'zw-popup-sample';
						sample.dataset.zwPopupColorSample = key;
						sample.textContent = example;
						preview.append(labelNode, sample);
				}
				const percent = this.doc.createElement('p');
				percent.dataset.zwPopupTransparencyLabel = '';
				preview.append(percent);
				const warning = this.doc.createElement('p');
				warning.textContent = '背景だけを透過します。通知の文字色は従来どおり白です。背景を透明にしすぎると動画によっては読みにくくなる場合があります。';
				preview.append(warning);
				section.append(controls, preview);
				return section;
		}
		_updatePopupColorPreview() {
				const rawTransparency = Number(this.model.get('popup.backgroundTransparency'));
				const transparency = Number.isFinite(rawTransparency) ? Math.max(0, Math.min(100, rawTransparency)) : 0;
				const label = this.cards.querySelector('[data-zw-popup-transparency-label]');
				if (label) {
						label.textContent = '背景の透明度 ' + transparency + '%（0% = 不透明、100% = 完全透明）';
				}
				for (const sample of this.cards.querySelectorAll('[data-zw-popup-color-sample]')) {
						const id = sample.dataset.zwPopupColorSample;
						const raw = String(this.model.get(id) ?? '');
						if (/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(raw)) {
								sample.dataset.zwPopupLastColor = ModernAdvancedSettingsUI._hexColor(raw);
						}
						const fallback = String(this.model.config.default[id] || '#333333');
						const hex = sample.dataset.zwPopupLastColor || ModernAdvancedSettingsUI._hexColor(fallback) || '#333333';
						if (transparency === 0) {
								sample.style.backgroundColor = hex;
								continue;
						}
						const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
						sample.style.backgroundColor = 'rgba(' + r + ', ' + g + ', ' + b + ', ' + (1 - transparency / 100) + ')';
				}
		}
		_renderCards() {
				this._clearTouchOrder();
				this._ngCompositeEditor?.dispose();
				this._ngCompositeEditor = null;
				if (!this.searchTerm && this.selected.category === 'プレイリスト・検索' &&
						this.selected.subcategory === 'データ管理') {
						this._renderDataPanel();
						return;
				}
				const hits = this.searchTerm ? this.model.search(this.searchTerm) :
						this.model.sectionDescriptors(this.selected.category, this.selected.subcategory);
				const title = this.root.querySelector('[data-zw-title]');
				const sectionLabel = this.selected.subcategory === '関連メニュー › カスタムリンク' ?
						'関連メニュー（全項目）' : this.selected.subcategory;
				title.textContent = this.searchTerm ? '検索結果' : sectionLabel;
				this.root.querySelector('[data-zw-path]').textContent = this.searchTerm ?
						'全カテゴリ横断検索' : this.selected.category + ' / ' + sectionLabel;
				this.root.querySelector('[data-zw-subtitle]').textContent = this.searchTerm ?
						hits.length + '件の設定が見つかりました' : '関連する設定をまとめて表示しています。';
				this.root.querySelector('[data-zw-reset-category]').hidden = !!this.searchTerm;
				const seen = new Set();
				const entries = [];
				for (let descriptor of hits) {
						if (descriptor.type === 'seconds') {
								descriptor = this.model.descriptor('KEY_' + descriptor.actionId) || descriptor;
						}
						if (!seen.has(descriptor.id)) {
								seen.add(descriptor.id);
								entries.push(descriptor);
						}
				}
				const seekSection = !this.searchTerm && this.selected.category === 'ショートカット' &&
						this.selected.subcategory === 'シーク';
				const used = seekSection ? this._usedCustomSeekSlots() : [];
				const visibleEntries = seekSection ? entries.filter(d => {
						const n = Number((d.actionId || '').match(/^CUSTOM_SEEK_(\d+)$/)?.[1]);
						return !n || used.includes(n);
				}) : entries.filter(d => d.type !== 'related-builtin-options' &&
						(d.type !== 'related-links' || !entries.some(item => item.type === 'related-order')));
				const rows = [];
				const visibilityMode = !this.searchTerm && this.selected.category === '画面・映像' &&
						this.selected.subcategory === '表示・非表示';
				const sceneSection = !this.searchTerm && this.selected.category === '画面・映像' &&
						this.selected.subcategory === 'シーンサーチ';
				const popupSection = !this.searchTerm && this.selected.category === '画面・映像' &&
						this.selected.subcategory === '通知・ポップアップ';
				const groupNames = {
						hover: '動画の上に重なるボタン', related: '関連メニュー', comment: 'コメント入力',
						scene: 'シーンサーチの操作ボタン', 'scene-comments': 'シーンサーチの表示',
						bar: '再生操作バー', info: '動画情報パネル', header: '動画上部のヘッダー',
						shared: 'コメント・補助表示（元の設定画面と共通）'
				};
				let lastScope = null;
				for (const d of visibleEntries.filter(item => !item.hidden && item.type !== 'related-visibility')) {
						if (sceneSection && ['sceneSearch.layout.normal', 'sceneSearch.layout.fullscreen', 'sceneSearch.presentation.normal', 'sceneSearch.presentation.fullscreen'].includes(d.id)) {
								continue; // One canonical draft; the visual gallery replaces redundant select cards.
						}
						if (visibilityMode && d.visibilityScope && d.visibilityScope !== lastScope) {
								const heading = this.doc.createElement('h4');
								heading.className = 'zw-modern-visibility-group';
								heading.dataset.zwVisibilityGroup = d.visibilityScope;
								heading.textContent = groupNames[d.visibilityScope] || 'その他';
								rows.push(heading);
								lastScope = d.visibilityScope;
						}
						rows.push(this._createCard(d));
				}
				if (sceneSection) {
						rows.splice(0, rows.length, this._createSceneSettingsPanel(rows));
				}
				if (!this.searchTerm && this.selected.category === 'プレイリスト・検索' &&
						this.selected.subcategory === '検索') {
						const guide = this.doc.createElement('section');
						guide.className = 'zw-modern-search-guide';
						guide.setAttribute('aria-label', '検索設定の違い');
						guide.innerHTML = [
								'<strong>検索で何が通信されるの？</strong>',
								'<p><b>① タグ候補・動画の予測：</b>検索欄に入力したときの候補表示。件数表示をOFFにしてもこの機能は使えます。</p>',
								'<p><b>② ヒット件数：</b>「〇件」という参考数字だけを調べる追加通信。下の設定で取得タイミングを選べます。</p>',
								'<p><b>③ プレイリストの読み込み：</b>検索を実行して動画を一覧へ追加する処理。最大件数は別の設定です。</p>'
						].join('');
						rows.unshift(guide);
				}
				if (!this.searchTerm && this.selected.category === '画面・映像' &&
						this.selected.subcategory === '表示・非表示') {
						const guide = this.doc.createElement('section');
						guide.className = 'zw-modern-search-guide';
						guide.setAttribute('aria-label', '表示・非表示の設定');
						guide.innerHTML = [
								'<strong>プレイヤーの表示を自分好みに整理</strong>',
								'<p>動画上・操作バー・動画情報・ヘッダーごとに項目をまとめました。OFFでも再生機能やショートカットは削除されません。</p>',
								'<p>再生・停止、シークバー、閉じる、エラー復旧は残ります。歯車を隠した場合も、マイページの上級者設定から再表示できます。</p>',
								'<p>共通設定の' + ModernAdvancedSettingsModel.SHARED_VISIBILITY.length + '項目は元の場所と同じ値です。変更・キャンセル・初期値への復帰も両方に反映されます。</p>',
								'<p>変更は画面下部の「変更を保存」で確定します。いつでも表示に戻せます。</p>'
						].join('');
						rows.unshift(guide);
				}
				if (seekSection) {
						const toolbar = this.doc.createElement('div');
						toolbar.className = 'zw-modern-seek-toolbar';
						const count = this.doc.createElement('span');
						count.dataset.zwSeekCount = '';
						count.textContent = 'カスタムシーク ' + used.length + ' / ' + this._customSeekSlots().length + ' 枠';
						const button = this._button('＋ カスタムシークを追加', 'data-zw-add-seek', '', 'zw-modern-plainbtn');
						button.disabled = used.length === this._customSeekSlots().length;
						toolbar.append(count, button);
						this.cards.replaceChildren(toolbar, ...rows);
				}
				else if (popupSection) {
						this.cards.replaceChildren(this._createPopupColorPanel(rows));
				}
				else {
						this.cards.replaceChildren(...rows);
				}
				this._updateSceneSettingsPreview();
				this._updatePopupColorPreview();
		}
		_applyRelatedDraftFromModel() {
				if (!this.relatedEditor) {
						return;
				}
				const value = this.model.get('relatedMenu.customLinks');
				this.relatedEditor.replaceDraftFromParent(value);
		}
		_syncRelatedDraft() {
				if (!this.relatedEditor) {
						return;
				}
				const editor = this.relatedEditor;
				this.model.set('relatedMenu.customLinks', editor.draft);
		}
		_relatedErrors() {
				if (!this.relatedEditor) {
						return [];
				}
				const editor = this.relatedEditor;
				const validation = editor.actions.validateLinks(editor.draft);
				const errs = editor.draft.map((link, index) => editor._rowError(link, index)).filter(Boolean);
				return validation.valid && errs.length === 0 ? [] : errs.length ? errs : ['リンクの入力に不正があります'];
		}
		_onRelatedBubble(event) {
				if (!this.relatedEditor ||
						!this.relatedEditor.container.contains(event.target)) {
						return;
				}
				this._syncRelatedDraft();
				this._refreshFooter();
		}
		hasPendingEdits() {
				return this.model.isDirty() || this._visibleSeekSlots.size > 0;
		}
		discardChanges() {
				if (this._recordCleanup) {
						this._recordCleanup();
				}
				this.model.cancel();
				this._visibleSeekSlots.clear();
				this._seekDirections.clear();
				this._orderAnnouncement = '';
				if (this.relatedEditor) {
						this.relatedEditor._load();
				}
				this._renderCards();
				this._refreshFooter();
		}
		_refreshFooter() {
				const changed = this.model.changes().length;
				const pendingSeek = this._visibleSeekSlots.size;
				this.root.querySelector('[data-zw-dirty]').textContent = changed ?
						'● 未保存の変更 ' + changed + '件' :
						pendingSeek ? '● カスタムシークの追加枠 ' + pendingSeek + '件（未設定）' : '保存済み';
				this.root.querySelector('[data-zw-cancel]').disabled = !changed && !pendingSeek;
				this.root.querySelector('[data-zw-save]').disabled = !changed ||
						this.model.validate().length > 0 || this._relatedErrors().length > 0;
		}
		_refreshCards() {
				const errors = new Map(this.model.validate().map(e => [e.id, e.message]));
				for (const card of this.cards.querySelectorAll('[data-zw-id]')) {
						const id = card.dataset.zwId, d = this.model.descriptor(id);
						const seek = d.type === 'shortcut' ? this.model.descriptor('PARAM_' + d.actionId) : null;
						card.classList.toggle('is-modified', (this.model.isDifferentFromDefault(id) ||
								(d.type === 'related-order' &&
										this.model.isDifferentFromDefault('relatedMenu.hiddenItems')) ||
								(seek && this.model.isDifferentFromDefault(seek.id))));
						const active = this.model.isEnabled(id);
						card.classList.toggle('is-disabled', !active);
						const input = card.querySelector('[data-setting-name]');
						if (input) {
								input.disabled = !active;
						}
						if (id === 'commandFilter') {
								const current = new Set(String(this.model.get(id) ?? '')
										.split(/\r?\n/).map(value => value.trim().toLowerCase()).filter(Boolean));
								card.querySelectorAll('[data-zw-command-preset]').forEach(button => {
										button.disabled = !active || current.has(button.dataset.zwCommandPreset);
								});
						}
						card.querySelectorAll('[data-zw-choice]').forEach(button => {
								button.disabled = !active;
						});
						if (d.type === 'regex-flags') {
								const flags = String(this.model.get(id) || '');
								card.querySelectorAll('[data-zw-regex-flag]').forEach(checkbox => {
										checkbox.checked = flags.includes(checkbox.dataset.zwRegexFlag);
										checkbox.disabled = !active;
								});
								const field = card.querySelector('[data-zw-regex-raw]');
								if (field) {
										field.disabled = !active;
										if (field !== this.doc.activeElement) {
												field.value = flags;
										}
								}
								const display = card.querySelector('[data-zw-regex-value]');
								if (display) {
										display.textContent = flags || '（なし）';
								}
						}
						if (d.type === 'slider') {
								card.querySelectorAll('input[data-setting-name]').forEach(element => {
										element.disabled = !active;
										if (element !== this.doc.activeElement || element.type !== 'number') {
												element.value = String(this.model.get(id));
										}
								});
						}
						if (d.type === 'font-picker') {
								const select = card.querySelector('[data-zw-font-preset]');
								const custom = card.querySelector('[data-zw-font-custom]');
								const value = String(this.model.get(id) ?? '');
								const preset = d.options.some(item => item.value === value) ? value : '__custom__';
								const editing = custom === this.doc.activeElement && !custom.hidden;
								if (select) {
										select.disabled = !active;
										if (!editing) {
												select.value = preset;
										}
								}
								if (custom) {
										custom.disabled = !active;
										if (!editing) {
												custom.value = value;
												custom.hidden = preset !== '__custom__';
										}
								}
						}
						if (d.type === 'color') {
								this._refreshColorEditor(card, d, active);
						}
						const example = card.querySelector('[data-zw-preview-for]');
						if (example) {
								this._updateVisualExample(example, id);
						}
						let alert = card.querySelector('.zw-modern-validation-error');
						if (errors.has(id)) {
								if (!alert) {
										alert = this.doc.createElement('span');
										alert.className = 'zw-modern-warning zw-modern-validation-error';
										card.append(alert);
								}
								alert.textContent = errors.get(id);
						}
						else if (alert) {
								alert.remove();
						}
						if (seek) {
								const value = Number(this.model.get(seek.id)) || 0;
								const direction = card.querySelector('[data-zw-seek-direction]');
								const magnitude = card.querySelector('[data-zw-seek-magnitude]');
								const sign = this._seekDirections.get(seek.id) || (value > 0 ? 1 : -1);
								if (direction) {
										direction.value = String(sign);
								}
								if (magnitude && magnitude !== this.doc.activeElement) {
										magnitude.value = String(Math.abs(value));
								}
						}
						if (d.type === 'shortcut') {
								const text = card.querySelector('[data-zw-key-display]');
								if (text) {
										text.textContent = this.formatKeyCombo(this.model.get(id));
								}
						}
				}
				this._updateSceneSettingsPreview();
				this._updatePopupColorPreview();
				this._refreshFooter();
		}
		_interceptValue(e) {
				const el = e.target;
				if (el?.dataset?.zwRegexFlag && this.root.contains(el)) {
						e.stopPropagation();
						e.stopImmediatePropagation?.();
						const id = el.dataset.zwRegexId;
						const flag = el.dataset.zwRegexFlag;
						const current = String(this.model.get(id) || '');
						const flags = new Set(current);
						if (el.checked) {
								flags.add(flag);
						}
						else {
								flags.delete(flag);
						}
						const order = 'dgimsuvy';
						const next = [...order].filter(f => flags.has(f)).join('') +
								[...flags].filter(f => !order.includes(f)).join('');
						this.model.set(id, next);
						this._refreshCards();
						return true;
				}
				if (el?.dataset?.zwColorPicker && this.root.contains(el)) {
						e.stopPropagation();
						e.stopImmediatePropagation?.();
						this.model.set(el.dataset.zwColorPicker, el.value);
						this._refreshCards();
						return true;
				}
				if (el?.dataset?.zwFontPreset && this.root.contains(el)) {
						e.stopPropagation();
						e.stopImmediatePropagation?.();
						const id = el.dataset.zwFontPreset;
						const custom = el.closest('.zw-modern-font-editor')
								?.querySelector('[data-zw-font-custom]');
						if (el.value === '__custom__') {
								if (custom) {
										custom.hidden = false;
										custom.focus();
								}
						}
						else {
								this.model.set(id, el.value);
								if (custom) {
										custom.hidden = true;
								}
								this._refreshCards();
						}
						return true;
				}
				if (el && el.dataset && this.root.contains(el) &&
						(el.dataset.zwSeekDirection || el.dataset.zwSeekMagnitude)) {
						e.stopPropagation();
						e.stopImmediatePropagation?.();
						const id = el.dataset.zwSeekDirection || el.dataset.zwSeekMagnitude;
						const old = Number(this.model.get(id)) || 0;
						if (el.dataset.zwSeekDirection) {
								const direction = Number(el.value) < 0 ? -1 : 1;
								this._seekDirections.set(id, direction);
								this.model.set(id, direction * Math.abs(old));
						}
						else {
								const input = el.value.trim();
								const number = input === '' ? NaN : Number(input);
								const direction = this._seekDirections.get(id) || (old > 0 ? 1 : -1);
								this.model.set(id, Number.isFinite(number) && number >= 0 ? direction * number : NaN);
						}
						this._refreshCards();
						return true;
				}
				if (!el || !el.dataset || !el.dataset.settingName || !this.root.contains(el)) {
						return false;
				}
				e.stopPropagation();
				if (typeof e.stopImmediatePropagation === 'function') {
						e.stopImmediatePropagation();
				}
				const key = el.dataset.settingName;
				const value = el.type === 'checkbox' ? el.checked : el.value;
				try {
						this.model.set(key, key === 'userIdFilter' ?
								ModernAdvancedSettingsUI._formatNgUserIds(value) : value);
				}
				catch (error) {
						this.win.console?.warn?.('Advanced settings input rejected', error);
				}
				if (key === 'sceneSearch.layout.linkFullscreen') {
						this._renderCards();
						this._refreshFooter();
				}
				else {
						this._refreshCards();
				}
				return true;
		}
		_setBuiltinOptionDraft(id, field, value) {
				if (!this.relatedOrder?.STANDARD.some(item => item.id === id)) {
						return;
				}
				const key = this.relatedOrder.OPTIONS_KEY;
				if (!this.model.descriptor(key)) {
						return;
				}
				const all = (this.model.get(key) || {});
				const options = { ...this.relatedOrder.getOption(all, id) };
				if (field === 'popupWidth' || field === 'popupHeight') {
						options[field] = value === '' ? 0 : Number(value);
				}
				else if (field === 'includePosition') {
						options[field] = !!value;
				}
				else if (value === '' || (field === 'openMode' && value === 'default') ||
						(field === 'copyFormat' && value === 'url')) {
						delete options[field];
				}
				else {
						options[field] = value;
				}
				const next = { ...all };
				if (Object.keys(options).length) {
						next[id] = options;
				}
				else {
						delete next[id];
				}
				this.model.set(key, next);
				this._refreshFooter();
		}
		_onValue(e) {
				const builtin = e.target.closest?.('[data-zw-builtin-field]');
				if (builtin && this.root.contains(builtin)) {
						e.stopPropagation();
						this._setBuiltinOptionDraft(builtin.dataset.zwBuiltinId, builtin.dataset.zwBuiltinField, builtin.type === 'checkbox' ? builtin.checked : builtin.value);
						if (['openMode', 'copyFormat'].includes(builtin.dataset.zwBuiltinField)) {
								this._refreshRelatedOrderList();
						}
						return;
				}
				const visible = e.target.closest?.('[data-zw-order-visible]');
				if (visible && this.root.contains(visible)) {
						e.stopPropagation();
						const key = visible.dataset.zwOrderVisible;
						if (!this.relatedOrder?.isValidKey(key)) {
								return;
						}
						const hidden = new Set((this.model.get('relatedMenu.hiddenItems') || []));
						if (visible.checked) {
								hidden.delete(key);
						}
						else {
								hidden.add(key);
						}
						this.model.set('relatedMenu.hiddenItems', [...hidden]);
						this._orderAnnouncement = '表示設定を変更しました。画面下部の「変更を保存」で確定します。';
						this._refreshRelatedOrderList();
						this._refreshFooter();
						return;
				}
				this._interceptValue(e);
		}
		_onInput(e) {
				const builtin = e.target.closest?.('[data-zw-builtin-field]');
				if (builtin && this.root.contains(builtin)) {
						e.stopPropagation();
						this._setBuiltinOptionDraft(builtin.dataset.zwBuiltinId, builtin.dataset.zwBuiltinField, builtin.type === 'checkbox' ? builtin.checked : builtin.value);
						if (builtin.dataset.zwBuiltinField === 'label') {
								const row = this.root.querySelector('[data-zw-order-key="builtin:' + builtin.dataset.zwBuiltinId + '"]');
								const display = row?.querySelector('.zw-order-name');
								if (display) {
										const original = this.relatedOrder.STANDARD.find(item => item.id === builtin.dataset.zwBuiltinId)?.label || '';
										display.textContent = builtin.value.trim() || original;
								}
						}
						return;
				}
				if (e.target.matches('[data-zw-search]')) {
						this.searchTerm = e.target.value.trim();
						this._renderCards();
						this._refreshFooter();
						return;
				}
				this._interceptValue(e);
		}
		_onClick(e) {
				if (e.target.closest?.('[data-zw-drawer-dismiss]')) {
						this.root.classList.remove('is-drawer-open');
						return;
				}
				const button = e.target.closest('button');
				if (!button || !this.root.contains(button) || button.disabled) {
						return;
				}
				if (button.hasAttribute('data-zw-scene-migration-ack')) {
						try {
								this.model.config.persistSceneSearchSelection?.({ 'sceneSearch.presentation.migrationAcknowledged': true });
								this._renderCards();
						}
						catch (error) {
								const info = button.closest('[data-zw-scene-migration]');
								if (info) {
										const note = this.doc.createElement('span');
										note.setAttribute('role', 'alert');
										note.textContent = '保存できませんでした。もう一度お試しください。';
										info.append(note);
								}
						}
						return;
				}
				if (button.hasAttribute('data-zw-scene-layout-mode') &&
						!button.hasAttribute('data-zw-scene-layout')) {
						const mode = button.dataset.zwSceneLayoutMode;
						if (['normal', 'fullscreen'].includes(mode)) {
								this._sceneLayoutTab = mode;
								this._renderCards();
								this._refreshFooter();
						}
						return;
				}
				if (button.hasAttribute('data-zw-scene-layout')) {
						const id = button.dataset.zwSceneLayout;
						const mode = button.dataset.zwSceneLayoutMode;
						if (!['follow', 'fixed', 'legacy'].includes(id) || !['normal', 'fullscreen'].includes(mode) ||
								mode !== this._sceneLayoutTab) {
								return;
						}
						if (mode === 'fullscreen' && this.model.get('sceneSearch.layout.linkFullscreen')) {
								return;
						}
						this.model.set('sceneSearch.presentation.' + mode, id);
						this._renderCards();
						this._refreshFooter();
						return;
				}
				if (button.hasAttribute('data-zw-order-add-link') || button.hasAttribute('data-zw-order-add-copy')) {
						const kind = button.hasAttribute('data-zw-order-add-copy') ? 'copy' : 'link';
						const id = this.relatedEditor?.addItem(kind);
						if (id) {
								this._expandedRelatedOptions = new Set(['link:' + id]);
								this._refreshRelatedOrderList();
						}
						this._refreshFooter();
						return;
				}
				if (button.hasAttribute('data-zw-order-edit')) {
						const key = button.dataset.zwOrderEdit;
						this._expandedRelatedOptions = new Set([key]);
						this._refreshRelatedOrderList();
						this.root.querySelector('[data-zw-order-edit="' + key + '"]')?.focus();
						return;
				}
				if (button.hasAttribute('data-zw-builtin-reset')) {
						const id = button.dataset.zwBuiltinReset;
						const key = this.relatedOrder?.OPTIONS_KEY;
						if (!key || !this.model.descriptor(key)) {
								return;
						}
						const options = { ...(this.model.get(key) || {}) };
						delete options[id];
						this.model.set(key, options);
						this._refreshRelatedOrderList();
						this._refreshFooter();
						return;
				}
				if (button.hasAttribute('data-zw-builtin-insert')) {
						const id = button.dataset.zwBuiltinId;
						const token = button.dataset.zwBuiltinInsert;
						if (!this.relatedActions?.VARIABLES?.includes(token)) {
								return;
						}
						const field = this.root.querySelector('[data-zw-builtin-field="urlTemplate"][data-zw-builtin-id="' + id + '"]');
						if (!field) {
								return;
						}
						const at = typeof field.selectionStart === 'number' ? field.selectionStart : field.value.length;
						const end = typeof field.selectionEnd === 'number' ? field.selectionEnd : at;
						field.setRangeText('{' + token + '}', at, end, 'end');
						this._setBuiltinOptionDraft(id, 'urlTemplate', field.value);
						field.focus();
						return;
				}
				if (button.hasAttribute('data-zw-open-link-editor')) {
						const id = button.dataset.zwOpenLinkEditor.slice(5);
						const links = (this.model.get('relatedMenu.customLinks') || []);
						const index = links.findIndex(item => item.id === id);
						if (index >= 0 && this.relatedEditor) {
								const card = this.relatedEditor.container.querySelector('[data-rl-row="' + index + '"]');
								const expand = card?.querySelector('[data-rl-expand]');
								if (expand?.getAttribute('aria-expanded') === 'false') {
										expand.click();
								}
								card?.scrollIntoView?.({ block: 'nearest' });
								expand?.focus?.();
						}
						return;
				}
				if (button.hasAttribute('data-zw-order-refresh')) {
						this._refreshRelatedOrderList();
						return;
				}
				if (button.hasAttribute('data-zw-order-up') || button.hasAttribute('data-zw-order-down')) {
						const upward = button.hasAttribute('data-zw-order-up');
						const key = upward ? button.dataset.zwOrderUp : button.dataset.zwOrderDown;
						const keys = this._relatedOrderEntries().map(item => item.key);
						const index = keys.indexOf(key), target = index + (upward ? -1 : 1);
						if (index >= 0 && target >= 0 && target < keys.length) {
								this._moveRelatedOrder(key, keys[target], !upward);
						}
						return;
				}
				if (button.hasAttribute('data-zw-backup-export')) {
						try {
								this.root.querySelector('[data-zw-backup-json]').value =
										this.model.config.exportJson();
								this.root.querySelector('[data-zw-backup-status]').textContent = '';
						}
						catch (error) {
								this.root.querySelector('[data-zw-backup-status]').textContent =
										'設定の書き出しに失敗しました: ' + (error.message || error);
						}
						return;
				}
				if (button.hasAttribute('data-zw-backup-import')) {
						const status = this.root.querySelector('[data-zw-backup-status]');
						try {
								const data = JSON.parse(this.root.querySelector('[data-zw-backup-json]').value);
								if (!data || typeof data !== 'object' || Array.isArray(data)) {
										throw new Error('JSONオブジェクトを指定してください');
								}
								if (this.model.isDirty() && !this.confirm('未保存の編集内容を破棄してバックアップを読み込みますか？')) {
										return;
								}
								if (!this.confirm('バックアップを取り込んで設定を上書きしますか？')) {
										return;
								}
								this.model.config.import(data);
								this.model.cancel();
								if (this.relatedEditor) {
										this.relatedEditor._load();
								}
								status.textContent = '設定を取り込みました。再読み込みします。';
								this.reload();
						}
						catch (error) {
								status.textContent = '設定を読み込めませんでした: ' + (error.message || error);
						}
						return;
				}
				if (button.hasAttribute('data-zw-playlist-export')) {
						try {
								this.root.querySelector('[data-zw-playlist-json]').value =
										JSON.stringify(this.playlist.export(), null, 2);
								this.root.querySelector('[data-zw-backup-status]').textContent = '';
						}
						catch (error) {
								this.root.querySelector('[data-zw-backup-status]').textContent =
										'プレイリストの書き出しに失敗しました: ' + (error.message || error);
						}
						return;
				}
				if (button.hasAttribute('data-zw-playlist-import')) {
						const status = this.root.querySelector('[data-zw-backup-status]');
						try {
								const data = JSON.parse(this.root.querySelector('[data-zw-playlist-json]').value);
								if (!this.confirm('プレイリストデータを上書きしますか？')) {
										return;
								}
								this.playlist.import(data);
								status.textContent = 'プレイリストを取り込みました。再読み込みします。';
								this.reload();
						}
						catch (error) {
								status.textContent = 'プレイリストを読み込めませんでした: ' + (error.message || error);
						}
						return;
				}
				if (button.hasAttribute('data-zw-major')) {
						const major = button.dataset.zwMajor;
						if (this.expanded.has(major)) {
								this.expanded.delete(major);
						}
						else {
								this.expanded.add(major);
						}
						this._saveStored();
						this._renderNavigation();
						return;
				}
				if (button.hasAttribute('data-zw-sub')) {
						const val = button.dataset.zwSub;
						const sep = val.indexOf('|');
						this.selected = { category: val.slice(0, sep), subcategory: val.slice(sep + 1) };
						this.searchTerm = '';
						this.root.querySelector('[data-zw-search]').value = '';
						this._saveStored();
						this.root.classList.remove('is-drawer-open');
						this._renderNavigation();
						this._renderCards();
						this._refreshFooter();
						return;
				}
				if (button.hasAttribute('data-zw-sidebar')) {
						if (this.win.innerWidth <= 760) {
								this.root.classList.toggle('is-drawer-open');
						}
						else {
								this.root.classList.toggle('is-sidebar-collapsed');
						}
						return;
				}
				if (button.hasAttribute('data-zw-close')) {
						if (this.hasPendingEdits() && !this.confirm('未保存の設定変更を破棄して閉じますか？')) {
								return;
						}
						this.discardChanges();
						this.onClose();
						return;
				}
				if (button.hasAttribute('data-zw-command-preset')) {
						if (!this.model.isEnabled('commandFilter')) {
								return;
						}
						const token = button.dataset.zwCommandPreset;
						if (!['red', 'blue', 'green', 'yellow', 'pink', 'cyan', 'black',
								'big', 'small', 'ue', 'shita'].includes(token)) {
								return;
						}
						const old = String(this.model.get('commandFilter') ?? '');
						const existing = new Set(old.split(/\r?\n/)
								.map(value => value.trim().toLowerCase()).filter(Boolean));
						if (existing.has(token)) {
								return;
						}
						this.model.set('commandFilter', old.replace(/[\r\n]+$/, '') +
								(old.trim() ? '\n' : '') + token);
						this._renderCards();
						this._refreshFooter();
						return;
				}
				if (button.hasAttribute('data-zw-regex-advanced-toggle')) {
						const holder = button.closest('.zw-modern-regex-editor');
						const panel = holder?.querySelector('[data-zw-regex-advanced-panel]');
						if (panel) {
								panel.hidden = !panel.hidden;
								button.setAttribute('aria-expanded', String(!panel.hidden));
						}
						return;
				}
				if (button.hasAttribute('data-zw-screenshot-prefix')) {
						this.model.set('screenshot.prefix', button.dataset.zwScreenshotPrefix);
						this._renderCards();
						this._refreshFooter();
						return;
				}
				if (button.hasAttribute('data-zw-filename-template')) {
						this.model.set('screenshot.filenameTemplate', button.dataset.zwFilenameTemplate);
						this._renderCards();
						this._refreshFooter();
						return;
				}
				if (button.hasAttribute('data-zw-filename-token')) {
						const token = button.dataset.zwFilenameToken;
						if (!this.screenshotFileName?.TOKENS.includes(token)) {
								return;
						}
						const id = 'screenshot.filenameTemplate';
						this.model.set(id, String(this.model.get(id) || '') + '{' + token + '}');
						this._renderCards();
						this._refreshFooter();
						return;
				}
				if (button.hasAttribute('data-zw-help')) {
						const card = button.closest('.zw-modern-card');
						const note = card?.querySelector('.zw-modern-note');
						if (note) {
								note.hidden = !note.hidden;
						}
						return;
				}
				if (button.hasAttribute('data-zw-add-seek')) {
						const available = this._customSeekSlots().find(n => !this._usedCustomSeekSlots().includes(n));
						if (available !== undefined) {
								this._visibleSeekSlots.add(available);
								this._renderCards();
								this._refreshFooter();
								this.cards.querySelector('[data-zw-id="KEY_CUSTOM_SEEK_' + available + '"]')
										?.scrollIntoView?.({ block: 'nearest' });
						}
						return;
				}
				if (button.hasAttribute('data-zw-remove-seek')) {
						const n = Number(button.dataset.zwRemoveSeek);
						if (!this._customSeekSlots().includes(n)) {
								return;
						}
						this.model.resetItem('KEY_CUSTOM_SEEK_' + n);
						this.model.resetItem('PARAM_CUSTOM_SEEK_' + n);
						this._visibleSeekSlots.delete(n);
						this._seekDirections.delete('PARAM_CUSTOM_SEEK_' + n);
						this._renderCards();
						this._refreshFooter();
						return;
				}
				if (button.hasAttribute('data-zw-reset-item')) {
						this.model.resetItem(button.dataset.zwResetItem);
						if (button.dataset.zwResetItem === 'relatedMenu.customLinks') {
								this._applyRelatedDraftFromModel();
						}
						this._renderCards();
						this._refreshFooter();
						return;
				}
				if (button.hasAttribute('data-zw-reset-category')) {
						const { category, subcategory } = this.selected;
						const count = this.model.sectionDescriptors(category, subcategory).length;
						if (this.confirm(category + ' / ' + subcategory + ' の' + count +
								'項目だけを初期値に戻しますか？（保存前ならキャンセル可能）')) {
								this.model.resetSubcategory(category, subcategory);
								if (subcategory === '関連メニュー › カスタムリンク') {
										this._applyRelatedDraftFromModel();
								}
								this._renderCards();
								this._refreshFooter();
						}
						return;
				}
				if (button.hasAttribute('data-zw-cancel')) {
						this.discardChanges();
						return;
				}
				if (button.hasAttribute('data-zw-save')) {
						try {
								if (this._relatedErrors().length > 0) {
										throw new Error('カスタムリンクに不正な入力があります');
								}
								this._syncRelatedDraft();
								const changedKeys = this.model.changes().map(change => change.id);
								const historyKeys = changedKeys.filter(key => key.startsWith('commentHistory.'));
								this.model.save();
								if (changedKeys.length && this.win.CustomEvent) {
										this.win.dispatchEvent(new this.win.CustomEvent('ZenzaWatch-advanced-settings-saved', { detail: { keys: changedKeys } }));
								}
								this._visibleSeekSlots.clear();
								this._seekDirections.clear();
								this._orderAnnouncement = '';
								if (historyKeys.length && this.win.CustomEvent) {
										this.win.dispatchEvent(new this.win.CustomEvent('ZenzaWatch-comment-history-settings', { detail: { keys: historyKeys } }));
								}
								if (this.relatedEditor) {
										this.relatedEditor._load();
								}
								this._renderCards();
								this._refreshFooter();
						}
						catch (error) {
								this.win.alert?.(String(error.message || error));
						}
						return;
				}
				if (button.hasAttribute('data-zw-record')) {
						this._beginRecording(button.dataset.zwRecord, button);
						return;
				}
				if (button.hasAttribute('data-zw-clear-key')) {
						this.model.set(button.dataset.zwClearKey, 0);
						this._renderCards();
						this.relatedEditor?._refresh?.();
						this._refreshFooter();
						return;
				}
				if (button.hasAttribute('data-zw-choice')) {
						this.model.set(button.dataset.zwChoice, button.dataset.zwValue);
						this._renderCards();
						this._refreshFooter();
				}
		}
		openDrawer() { this.root.classList.add('is-drawer-open'); }
		_onDocumentKeyDown(e) {
				if (this._recordCleanup) {
						return;
				}
				const grip = e.target.closest?.('[data-zw-order-grip]');
				if (grip && e.altKey && ['ArrowUp', 'ArrowDown'].includes(e.key)) {
						const key = grip.dataset.zwOrderGrip;
						const keys = this._relatedOrderEntries().map(item => item.key);
						const index = keys.indexOf(key);
						const target = index + (e.key === 'ArrowUp' ? -1 : 1);
						if (index >= 0 && target >= 0 && target < keys.length) {
								e.preventDefault();
								this._moveRelatedOrder(key, keys[target], e.key === 'ArrowDown');
								this.root.querySelector('[data-zw-order-grip="' + key + '"]')?.focus();
						}
						return;
				}
				if (e.key === 'Escape' || e.keyCode === 27) {
						if (this.root.classList.contains('is-drawer-open')) {
								this.root.classList.remove('is-drawer-open');
								e.preventDefault();
						}
				}
		}
		_beginRecording(id, button) {
				if (this._recordCleanup) {
						this._recordCleanup();
				}
				const original = button.textContent;
				button.textContent = 'キーを押してください（Escで中止）';
				const handler = (e) => {
						e.preventDefault();
						e.stopPropagation();
						e.stopImmediatePropagation?.();
						if ([16, 17, 18, 91, 92, 93, 224].includes(e.keyCode)) {
								return;
						}
						if (e.keyCode === 27 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
								cleanup();
								return;
						}
						const code = this.encodeKeyCombo(e);
						cleanup();
						if (Number.isSafeInteger(code) && code > 0 && code < 90000000) {
								this.model.set(id, code);
								this._renderCards();
								this.relatedEditor?._refresh?.();
								this._refreshFooter();
						}
				};
				const cleanup = () => {
						this.doc.removeEventListener('keydown', handler, true);
						button.textContent = original;
						this._recordCleanup = null;
				};
				this._recordCleanup = cleanup;
				this.doc.addEventListener('keydown', handler, true);
		}
		dispose() {
				this._ngCompositeEditor?.dispose();
				this._ngCompositeEditor = null;
				this.setModalVisible(false);
				if (this._recordCleanup) {
						this._recordCleanup();
				}
				this.doc.removeEventListener('keydown', this._onKeyDownBound, true);
				this.root.removeEventListener('click', this._onClickBound, true);
				this.root.removeEventListener('change', this._onValueBound, true);
				this.root.removeEventListener('input', this._onInputBound, true);
				this.root.removeEventListener('dragstart', this._onOrderDragStartBound);
				this.root.removeEventListener('dragover', this._onOrderDragOverBound);
				this.root.removeEventListener('drop', this._onOrderDropBound);
				this.root.removeEventListener('dragend', this._onOrderDragEndBound);
				this._clearTouchOrder();
				this.root.removeEventListener('pointerdown', this._onTouchOrderDownBound);
				this.root.removeEventListener('pointermove', this._onTouchOrderMoveBound);
				this.root.removeEventListener('pointerup', this._onTouchOrderUpBound);
				this.root.removeEventListener('pointercancel', this._onTouchOrderCancelBound);
				this._unwatchRelatedActions?.();
				this.model.config.offkey?.('backComment', this._onBackCommentConfigUpdate);
				this.root.removeEventListener('click', this._onRelatedClickBound);
				this.root.removeEventListener('change', this._onRelatedChangeBound);
				this.root.removeEventListener('input', this._onRelatedInputBound);
				if (this.relatedEditor && this._relatedOrigin?.parent) {
						const { parent, next } = this._relatedOrigin;
						const editor = this.relatedEditor.container;
						if (next && next.parentNode === parent) {
								parent.insertBefore(editor, next);
						}
						else {
								parent.appendChild(editor);
						}
						editor.querySelector('[data-rl-save]').hidden = false;
						editor.querySelector('[data-rl-cancel]').hidden = false;
						this.relatedEditor.embedded = false;
						this.relatedEditor.onDraftChange = null;
						this.relatedEditor.getDraftShortcutValue = null;
						this.relatedEditor.getDraftShortcutConflicts = null;
				}
				for (const [node, { parent, next }] of this._moved) {
						if (!parent) {
								continue;
						}
						if (next && next.parentNode === parent) {
								parent.insertBefore(node, next);
						}
						else {
								parent.appendChild(node);
						}
				}
				this.root.remove();
				this.panel.classList.remove('zw-modern-active');
		}
}
class NgCompositeRuleEditor {
	constructor(host,saved,onChange){
		this.host=host;
		this.onChange=onChange;
		this.doc=host.ownerDocument;
		this.shadow=host.shadowRoot||host.attachShadow({mode:'open'});
		this.invalidSaved=false;
		try{this.rules=NgCompositeRuleEditor.prepareDraft(saved||[]);}
		catch(_){this.rules=[];this.invalidSaved=true;}
		this.selected=this.rules[0]?.id||'';
		this.serial=0;
		this.sample={text:'中国の話ｗｗｗ',cmd:'red big ue',userId:'nvc:sample',nicoru:0,score:0,vpos:1500,videoId:'sm9',fork:0};
		this._makeFrame();
		this.render();
	}
	static copy(v){return JSON.parse(JSON.stringify(v||[]));}
	static prepareDraft(value){
		const rules=NgCompositeRuleEditor.copy(value),ids=new Set();let count=0;
		const fail=()=>{throw new TypeError('複合NGの構造または識別子が不正です。元の設定は保持しました。');};
		const id=(value,seen)=>{
			if(typeof value!=='string'||!value.trim()||value.length>80||seen.has(value))fail();seen.add(value);
		};
		if(!Array.isArray(rules)||rules.length>NgCompositeRules.MAX_RULES)fail();
		for(const r of rules){
			if(!r||typeof r!=='object')fail();id(r.id,ids);
			for(const key of ['name','scope','phase','action','pattern','replacement','flags','normalizeColor','normalizeSize','mask','unknownPolicy']){
				if(typeof r[key]!=='string'||r[key].length>8192)fail();
			}
			if(!Array.isArray(r.strip)||r.strip.length>40||r.strip.some(x=>typeof x!=='string'))fail();
			for(const key of ['enabled','stopOnMatch','exemptNicoru','keepProtectedOnAuthorHide','regexReplace'])if(typeof r[key]!=='boolean')fail();
			const nodeIds=new Set();
			const walk=(n,depth)=>{
				if(!n||typeof n!=='object'||++count>350)fail();id(n.id,nodeIds);
				if(n.kind==='group'){
					if(depth>=3||!['all','any'].includes(n.mode)||!Array.isArray(n.nodes)||n.nodes.length>45||n.not===true)fail();
					n.nodes.forEach(child=>walk(child,depth+1));
				}else if(Object.prototype.hasOwnProperty.call(n,'nodes')||!NgCompositeRules.FIELDS.includes(n.field)||typeof n.value!=='string'||typeof n.cmp!=='string'||typeof n.not!=='boolean')fail();
			};
			if(r.conditions?.kind!=='group')fail();walk(r.conditions,0);
		}
		return rules;
	}
	static freshId(used=new Set()){
		let id;do{id='ng-'+Date.now().toString(36)+'-'+((this._idSequence=(this._idSequence||0)+1).toString(36));}while(used.has(id));
		used.add(id);return id;
	}
	usedIds(){
		const ids=new Set();
		for(const r of this.rules){ids.add(r.id);const walk=n=>{ids.add(n.id);n.nodes?.forEach(walk);};walk(r.conditions);}
		return ids;
	}
	nextId(){return NgCompositeRuleEditor.freshId(this.usedIds());}
	static get fields(){return [['text','本文（部分一致）'],['regex','本文（正規表現）'],
		['cmd','コマンド文字列'],['color','コマンド文字色'],['size','文字サイズ'],
		['user','ユーザーID'],['nicoru','ニコる数'],['position','表示位置'],
		['fork','コメント種別'],['score','NG共有スコア'],['vpos','動画内秒数'],['video','動画ID']];}
	static get colors(){return [['white','白'],['red','赤'],['pink','ピンク'],['orange','オレンジ'],
		['yellow','黄'],['green','緑'],['cyan','水色'],['blue','青'],['purple','紫'],
		['black','黒'],['white2','ニコニコホワイト'],['niconicowhite','ニコニコホワイト（別名）'],
		['red2','濃い赤'],['truered','濃い赤（別名）'],['pink2','ピンク2'],
		['orange2','オレンジ2'],['passionorange','パッションオレンジ'],['yellow2','濃い黄'],
		['madyellow','濃い黄（別名）'],['green2','深緑'],['elementalgreen','深緑（別名）'],
		['cyan2','濃い水色'],['blue2','明るい青'],['marineblue','明るい青（別名）'],
		['purple2','濃い紫'],['nobleviolet','濃い紫（別名）'],['black2','灰色']];}
	static newRule(used=new Set()){
		const id=()=>NgCompositeRuleEditor.freshId(used);
		return {id:id(),name:'新しい複合ルール',enabled:false,scope:'normal',
			phase:'after',stopOnMatch:true,conditions:{id:id(),kind:'group',mode:'all',
				nodes:[{id:id(),field:'text',cmp:'contains',value:'',not:false}]},
			exemptNicoru:false,nicoruMin:1,unknownPolicy:'evaluate',keepProtectedOnAuthorHide:true,
			action:'hide',pattern:'',replacement:'',regexReplace:false,flags:'g',
			strip:['red','big'],normalizeColor:'white',normalizeSize:'medium',dim:30,mask:'［置換済み］'};
	}
	esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
	opt(options,value){return options.map(([id,label])=>
		'<option value="'+this.esc(id)+'"'+(String(id)===String(value)?' selected':'')+'>'+this.esc(label)+'</option>').join('');}
	colorSelect(current,key){
		const pairs=[['keep','変更しない'],...NgCompositeRuleEditor.colors];
		const items=key==='normalizeColor'?pairs:NgCompositeRuleEditor.colors;
		if(NgCompositeRules.color(current)&&!items.some(([value])=>value===current))items.push([current,'指定した色']);
		return '<span class="ng-color"><span class="ng-dot" style="background:'+
			this.esc(NgCompositeRules.color(current)||'#8493a4')+'"></span><select data-'+
			(key==='normalizeColor'?'rule':'node-value')+'="'+this.esc(key==='normalizeColor'?key:key)+'">'+
			this.opt(items.map(([id,name])=>[id,'● '+name+'（'+id+' / '+(NgCompositeRules.color(id)||'')+'）']),current)+
			'</select></span>';
	}
	current(){return this.rules.find(x=>x.id===this.selected)||null;}
	find(id,node=this.current()?.conditions){
		if(!node)return null;
		if(node.id===id)return node;
		for(const child of node.nodes||[]){const v=this.find(id,child);if(v)return v;}
		return null;
	}
	parent(id,node=this.current()?.conditions){
		if(!node||!node.nodes)return null;
		for(const child of node.nodes){
			if(child.id===id)return node;
			const inner=this.parent(id,child);if(inner)return inner;
		}
		return null;
	}
	_makeFrame(){
		const style=this.doc.createElement('style');
		style.textContent=`
			:host{display:block;min-width:0;max-width:100%;font:13px/1.5 system-ui,"Yu Gothic",Meiryo,sans-serif;color:#edf4ff}
			*,*::before,*::after{box-sizing:border-box}button,input,select,textarea{font:inherit}
			button{cursor:pointer;color:#edf4ff;background:#22354a;border:1px solid #4e6989;border-radius:5px;padding:6px 9px}
			button:hover{border-color:#90c5fc}button:disabled{opacity:.48;cursor:default}
			input[type=text],input[type=number],select,textarea{max-width:100%;min-width:0;background:#101927;border:1px solid #435c7a;border-radius:5px;color:#edf4ff;padding:7px}
			input[type=checkbox]{appearance:checkbox;-webkit-appearance:checkbox;width:17px;height:17px;accent-color:#82bfff;vertical-align:middle;margin:0}
			[hidden]{display:none!important}
			h4{font-size:15px;margin:0 0 10px}p{margin:6px 0 10px}.ng-sub{color:#acbfd2;font-size:12px}
			.ng-box{background:#233449;border:1px solid #39506b;border-radius:5px;padding:13px;margin:0 0 12px}
			.ng-help summary{cursor:pointer;color:#a6ceff;font-weight:650}
			.ng-help details{margin:12px 0 6px}.ng-help p{line-height:1.75;padding:3px}
			.ng-layout{display:grid;grid-template-columns:minmax(200px,31%) minmax(0,1fr);gap:12px;min-width:0}
			.ng-side{background:#132136;border:1px solid #38516b;border-radius:5px;padding:12px;min-width:0}
			.ng-list{display:grid;gap:6px;margin:10px 0}.ng-line{display:flex;align-items:center;gap:5px;flex-wrap:wrap}
			.ng-rule{display:flex;align-items:center;gap:4px;border:1px solid #45617f;border-radius:5px;padding:6px;margin:7px 0}
			.ng-rule.selected{border-color:#92c5ff;background:#2b4360}
			.ng-rule .ng-pick{flex:1;min-width:95px;text-align:left;overflow-wrap:anywhere}
			.ng-rule small{display:block;color:#abc4d9}.ng-rule button{padding:4px 6px}
			.ng-field{display:grid;gap:4px;margin:7px 0}.ng-flex{display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin:8px 0}
			.ng-flex label{display:inline-flex;align-items:center;gap:6px;flex-wrap:wrap}
			.ng-wide{flex:1;min-width:155px}.ng-wide input{width:100%}
			.ng-group{margin:8px 0;border-left:3px solid #7baddf;padding:8px;background:#14263b}
			.ng-condition{display:flex;align-items:center;gap:5px;flex-wrap:wrap;margin:8px 0;padding:7px;border:1px solid #47627d;border-radius:5px;background:#253950}
			.ng-condition select,.ng-condition input{flex:1 1 120px}.ng-condition label{display:inline-flex;align-items:center;gap:5px}
			.ng-group-head{display:flex;align-items:center;gap:6px;flex-wrap:wrap}.ng-group-head strong{flex:1}
			.ng-color{display:inline-flex;align-items:center;gap:6px;flex:1 1 180px}
			.ng-dot{width:18px;height:18px;border-radius:50%;border:1px solid #8290a5;flex:none}
			.ng-color select{flex:1;min-width:100px}
			.ng-preview{display:grid;grid-template-columns:1fr 1fr;gap:8px}
			.ng-preview article{background:#101d2d;padding:12px;border:1px solid #425c79;border-radius:5px;min-height:73px}
			.ng-preview p{white-space:pre-wrap;overflow-wrap:anywhere}
			.ng-error{color:#ffc986}.ng-ok{color:#9ed8bf}
			@media(max-width:980px){.ng-layout{grid-template-columns:1fr}.ng-side{max-height:400px;overflow:auto}}
			@media(max-width:550px){.ng-preview{grid-template-columns:1fr}}
		`;
		const el=this.doc.createElement('div');
		el.className='ng-root';
		el.innerHTML='<h4>複合NGルール（上級者向け）</h4>'+
			'<p class="ng-sub">複数条件でコメントの非表示・置換・装飾解除を設定できます。変更は画面下部で保存するまで反映しません。</p>'+
			this.helpHtml()+
			'<div class="ng-layout"><aside class="ng-side"><strong>ルール一覧（ドラッグ・上下移動可）</strong>'+
			'<div data-ng-list class="ng-list"></div><button data-ng-act="add">＋新規ルール</button> '+
			'<button data-ng-act="duplicate">選択ルールを複製</button></aside>'+
			'<div><section class="ng-box" data-ng-detail></section>'+
			'<section class="ng-box"><h4>プレビュー（下書きのまま試せます）</h4><div data-ng-sample></div>'+
			'<div data-ng-result></div></section></div></div>';
		this.shadow.replaceChildren(style,el);
		this.root=el;
		el.addEventListener('click',e=>this.click(e));
		el.addEventListener('input',e=>this.input(e));
		el.addEventListener('change',e=>this.input(e));
		el.addEventListener('dragstart',e=>{const row=e.target.closest('[data-ng-drag]');if(row)this.dragId=row.dataset.ngDrag;});
		el.addEventListener('dragover',e=>{if(this.dragId&&e.target.closest('[data-ng-drag]'))e.preventDefault();});
		el.addEventListener('drop',e=>{
			const row=e.target.closest('[data-ng-drag]');if(!row||!this.dragId)return;
			e.preventDefault();this.move(this.dragId,row.dataset.ngDrag);this.dragId=null;
		});
	}
	helpHtml(){
		return '<details class="ng-box ng-help"><summary>はじめて使う方へ：3つの手順（クリックで詳しく表示）</summary>'+
			'<p><b>1．ルールを追加：</b>「＋新規ルール」で作成し、名前を付けます。新規ルールは最初は無効なので、条件と処理を確認したあとに有効にします。</p>'+
			'<p><b>2．条件を指定：</b>「＋条件」で本文、色、文字サイズ、ユーザーID、ニコる数などを指定します。ANDならすべて、ORならどれかに一致すれば対象です。「＋グループ」で条件をまとめられます。</p>'+
			'<p><b>3．一致したときの処理：</b>非表示、投稿者全コメントを非表示、本文置換、装飾解除などを選びます。ニコる優先保護も設定でき、最後にプレビューと保存を行います。</p>'+
			'<details><summary>AND・OR・NOT・保護についてさらに詳しく</summary>'+
			'<p><b>AND：</b>「中国」を含む＋「赤文字」＋「big」なら3条件すべてが必要です。<b>OR：</b>どれか1つで一致します。</p>'+
			'<p><b>NOT：</b>その条件だけを反転します。OR内の別条件に一致することがあるため、全ルールからの保護にはなりません。</p>'+
			'<p><b>ニコる数で優先保護：</b>ニコるが指定数以上なら、そのルールをスキップします。保護する数の初期値は1件です。未取得なら通常判定かスキップを選べます。</p>'+
			'<p><b>投稿者一括NG：</b>一致した投稿者IDの同一動画中のコメントをまとめて非表示にします。永続NGユーザーIDには登録しません。</p>'+
			'<p><b>既存NGとの関係：</b>従来のNGワード・NGユーザー・共有NGは引き続き有効です。複合ルールの保護は従来のNGを解除しません。</p>'+
			'<p><b>正規表現と安全性：</b>多数のコメントに適用されるため、複雑すぎる正規表現には制限があります。元の投稿データは変更しません。</p></details></details>';
	}
	ruleList(){
		const target=this.root.querySelector('[data-ng-list]');
		target.innerHTML=this.rules.length?this.rules.map((r,i)=>
			'<div class="ng-rule'+(r.id===this.selected?' selected':'')+'" draggable="true" data-ng-drag="'+this.esc(r.id)+'">'+
			'<button class="ng-pick" data-ng-act="select" data-id="'+this.esc(r.id)+'">'+this.esc(r.name||'（無題）')+
			'<small>'+(r.enabled?'有効':'無効')+' / '+this.esc(r.action)+'</small></button>'+
			'<button data-ng-act="up" data-id="'+this.esc(r.id)+'"'+(i===0?' disabled':'')+'>↑</button>'+
			'<button data-ng-act="down" data-id="'+this.esc(r.id)+'"'+(i===this.rules.length-1?' disabled':'')+'>↓</button></div>').join(''):
			'<p class="ng-sub">まだルールはありません。左下の「＋新規ルール」から作成してください。</p>';
	}
	conditionHtml(c){
		const f=c.field;
		const num=['nicoru','score','vpos'].includes(f);
		const op=num?[['equals','＝'],['gte','以上'],['lte','以下']]:
			[['contains','含む'],['equals','一致する'],['notEquals','一致しない'],
			['starts','先頭一致'],['ends','末尾一致'],['regex','正規表現']];
		const select=f==='color'?this.colorSelect(c.value,c.id):
			f==='size'?'<select data-node-value="'+this.esc(c.id)+'">'+this.opt([['big','大文字（big）'],['medium','標準'],['small','小文字（small）']],c.value)+'</select>':
			f==='position'?'<select data-node-value="'+this.esc(c.id)+'">'+this.opt([['ue','上固定'],['naka','通常（流れる）'],['shita','下固定']],c.value)+'</select>':
			f==='fork'?'<select data-node-value="'+this.esc(c.id)+'">'+this.opt([['normal','通常'],['owner','投稿者'],['easy','かんたん'],['other','その他']],c.value)+'</select>':
			'<input type="'+(num?'number':'text')+'" data-node-value="'+this.esc(c.id)+'" value="'+this.esc(c.value)+'" placeholder="'+(num?'0':'入力してください')+'">';
		return '<div class="ng-condition"><label><input type="checkbox" data-node-not="'+this.esc(c.id)+'"'+(c.not?' checked':'')+'>NOT</label>'+
			'<select data-node-field="'+this.esc(c.id)+'">'+this.opt(NgCompositeRuleEditor.fields,f)+'</select>'+
			'<select data-node-cmp="'+this.esc(c.id)+'">'+this.opt(op,c.cmp)+'</select>'+
			select+'<button data-ng-act="remove-node" data-id="'+this.esc(c.id)+'" title="削除">×</button></div>';
	}
	groupHtml(g,depth=0){
		let html='<div class="ng-group"><div class="ng-group-head"><strong>'+(depth?'条件グループ':'全体の条件')+'</strong>'+
			'<select data-group-mode="'+this.esc(g.id)+'">'+this.opt([['all','AND／すべて'],['any','OR／どれか']],g.mode)+'</select>'+
			'<button data-ng-act="add-node" data-parent="'+this.esc(g.id)+'">＋条件</button>'+
			'<button data-ng-act="add-group" data-parent="'+this.esc(g.id)+'"'+(depth>=2?' disabled':'')+'>＋グループ</button></div>';
		for(const node of g.nodes){
			html+=node.kind==='group'?this.groupHtml(node,depth+1):this.conditionHtml(node);
		}
		return html+'</div>';
	}
	detail(){
		const area=this.root.querySelector('[data-ng-detail]'),r=this.current();
		if(!r){area.innerHTML='<p>左の「＋新規ルール」を押して開始してください。</p>';return;}
		const chk=k=>r[k]?' checked':'';
		const actions=[['hide','コメントを非表示'],['hideAuthor','NG一致投稿者のコメントをすべて非表示'],
			['replace','本文の置換'],['mask','本文を別の文字列にする'],['strip','指定されたコマンドを解除'],
			['normalize','色・大きさを標準化'],['dim','薄く表示する']];
		let extra='';
		if(r.action==='replace')extra='<div class="ng-flex"><label class="ng-wide">検索文字列<input type="text" data-rule="pattern" value="'+this.esc(r.pattern)+'"></label>'+
			'<label class="ng-wide">置換後の文字<input type="text" data-rule="replacement" value="'+this.esc(r.replacement)+'"></label></div>'+
			'<div class="ng-flex"><label><input type="checkbox" data-rule="regexReplace"'+chk('regexReplace')+'>正規表現で置換</label>'+
			'<label>フラグ<input type="text" data-rule="flags" value="'+this.esc(r.flags)+'" style="width:80px"></label></div>';
		if(r.action==='mask')extra='<label class="ng-wide">置換する本文<input type="text" data-rule="mask" value="'+this.esc(r.mask)+'"></label>';
		if(r.action==='strip')extra='<label class="ng-wide">解除するコマンド（カンマで区切る）<input type="text" data-rule="strip" value="'+this.esc(r.strip.join(', '))+'"></label>'+
			'<p class="ng-sub">現在は色とサイズのコマンドだけ解除できます。例：red, big。画面上部・下部の位置指定はそのまま保持します。</p>';
		if(r.action==='normalize')extra='<div class="ng-flex"><label>色を選ぶ'+this.colorSelect(r.normalizeColor,'normalizeColor')+'</label>'+
			'<label>文字サイズ<select data-rule="normalizeSize">'+this.opt([['keep','変更しない'],['medium','標準'],['big','big'],['small','small']],r.normalizeSize)+'</select></label></div>';
		if(r.action==='dim')extra='<label>表示透明度<input type="number" data-rule="dim" min="5" max="100" value="'+this.esc(r.dim)+'">％</label>';
		area.innerHTML='<h4>ルールの編集</h4>'+
			'<div class="ng-flex"><label class="ng-wide">名前<input data-rule="name" type="text" value="'+this.esc(r.name)+'"></label>'+
			'<label><input type="checkbox" data-rule="enabled"'+chk('enabled')+'>ルールを有効にする</label></div>'+
			'<div class="ng-flex"><label>対象<select data-rule="scope">'+this.opt([['normal','通常コメント'],['any','すべて'],['owner','投稿者コメント'],['easy','かんたんコメント']],r.scope)+'</select></label>'+
			'<label>適用順<select data-rule="phase">'+this.opt([['after','従来のNGより後'],['before','従来のNGより前']],r.phase)+'</select></label></div>'+
			'<div class="ng-box"><h4>一致条件</h4>'+this.groupHtml(r.conditions)+'</div>'+
			'<div class="ng-box"><h4>ニコる数による優先保護（NG除外）</h4>'+
			'<div class="ng-flex"><label><input type="checkbox" data-rule="exemptNicoru"'+chk('exemptNicoru')+'>指定数以上ならこのルールを適用しない</label></div>'+
			'<div class="ng-flex"><label>保護するニコる数<input type="number" min="1" max="10000000" data-rule="nicoruMin" value="'+this.esc(r.nicoruMin)+'">件以上</label>'+
			'<label>未取得の場合<select data-rule="unknownPolicy">'+this.opt([['evaluate','通常どおり判定'],['skip','このルールをスキップ']],r.unknownPolicy)+'</select></label></div>'+
			'<p class="ng-sub">ORでも優先保護を適用できます。従来のNGからは保護しません。</p></div>'+
			'<div class="ng-box"><h4>一致したときの動作</h4>'+
			'<label>動作<select data-rule="action">'+this.opt(actions,r.action)+'</select></label>'+
			'<div class="ng-flex">'+extra+'</div>'+
			(r.action==='hideAuthor'?'<label><input type="checkbox" data-rule="keepProtectedOnAuthorHide"'+chk('keepProtectedOnAuthorHide')+'>同じ投稿者でもニコる保護コメントは残す</label><p class="ng-sub">現在の動画内だけ。恒久NGユーザーIDには追加しません。</p>':'')+
			'<div class="ng-flex"><label><input type="checkbox" data-rule="stopOnMatch"'+chk('stopOnMatch')+'>一致後は後続のルールを適用しない</label></div></div>'+
			'<button data-ng-act="delete">選択ルールを削除</button>'+
			(!NgCompositeRules.validate(this.rules)?'<p class="ng-error">入力途中または不正な条件があります。保存前に確認してください。</p>':'');
	}
	demoFields(){
		this.root.querySelector('[data-ng-sample]').innerHTML='<div class="ng-flex">'+
			'<label class="ng-wide">サンプル本文<input type="text" data-example="text" value="'+this.esc(this.sample.text)+'"></label>'+
			'<label>コマンド<input type="text" data-example="cmd" value="'+this.esc(this.sample.cmd)+'"></label>'+
			'<label>ニコる数<input type="number" min="0" data-example="nicoru" value="'+this.esc(this.sample.nicoru)+'"></label>'+
			'<label>ユーザーID<input type="text" data-example="userId" value="'+this.esc(this.sample.userId)+'"></label></div>';
	}
	preview(){
		const ex=this.sample;
		const chat={...ex,color:NgCompositeRules.commandColor(ex.cmd),opacity:1,
			size:ex.cmd.includes('big')?'big':ex.cmd.includes('small')?'small':'medium',
			type:ex.cmd.includes('ue')?'ue':ex.cmd.includes('shita')?'shita':'naka'};
		const valid=NgCompositeRules.validate(this.rules);
		const projected=valid?NgCompositeRules.project([chat],this.rules,()=>true,ex.videoId):null;
		const result=projected?.get(chat);
		this.root.querySelector('[data-ng-result]').innerHTML='<div class="ng-preview">'+
			'<article><small>変更前</small><p>'+this.esc(chat.text)+'</p><small>'+this.esc(chat.cmd)+'</small></article>'+
			'<article><small>変更後</small><p>'+this.esc(!valid?'不正なルールがあります':!result?'（変更なし）':
				!result.visible?'［非表示］':result.text)+'</p><small>'+this.esc(result?.cmd||chat.cmd)+'</small></article></div>'+
			'<p class="'+(valid?'ng-ok':'ng-error')+'">'+(valid?'プレビューは現在の全ルールによる結果です。':'入力内容を修正してください。')+'</p>';
	}
	render(){
		this.ruleList();this.detail();this.demoFields();this.preview();
		if(this.invalidSaved){
			this.root.querySelector('[data-ng-detail]').innerHTML='<p class="ng-error" data-ng-invalid-saved>保存データの構造が不正です。元のデータは上書きしていません。バックアップを確認してから復元してください。</p>';
			this.root.querySelectorAll('button,input,select').forEach(el=>{el.disabled=true;});
		}
	}
	changed(rebuild){if(this.invalidSaved)return;this.onChange(NgCompositeRuleEditor.copy(this.rules));if(rebuild)this.render();else this.preview();}
	move(id,destination){
		const a=this.rules.findIndex(r=>r.id===id),b=this.rules.findIndex(r=>r.id===destination);
		if(a<0||b<0||a===b)return;
		const item=this.rules.splice(a,1)[0];this.rules.splice(b,0,item);this.changed(true);
	}
	click(e){
		const b=e.target.closest('button[data-ng-act]');if(!b||b.disabled)return;
		const act=b.dataset.ngAct,id=b.dataset.id;
		if(act==='add'){if(this.rules.length>=NgCompositeRules.MAX_RULES)return;
			const r=NgCompositeRuleEditor.newRule(this.usedIds());this.rules.push(r);this.selected=r.id;}
		else if(act==='duplicate'){const r=this.current();if(!r||this.rules.length>=NgCompositeRules.MAX_RULES)return;
			const copy=NgCompositeRuleEditor.copy(r),used=this.usedIds();copy.id=NgCompositeRuleEditor.freshId(used);
			const rekey=n=>{n.id=NgCompositeRuleEditor.freshId(used);n.nodes?.forEach(rekey);};rekey(copy.conditions);
			copy.name=copy.name.slice(0,85)+'（コピー）';this.rules.push(copy);this.selected=copy.id;}
		else if(act==='select'){this.selected=id;this.render();return;}
		else if(act==='delete'){this.rules=this.rules.filter(r=>r.id!==this.selected);this.selected=this.rules[0]?.id||'';}
		else if(act==='up'||act==='down'){const i=this.rules.findIndex(r=>r.id===id),j=i+(act==='up'?-1:1);
			if(i<0||j<0||j>=this.rules.length)return;
			const item=this.rules.splice(i,1)[0];this.rules.splice(j,0,item);}
		else if(act==='add-node'||act==='add-group'){
			const parent=this.find(b.dataset.parent);if(!parent||!parent.nodes||parent.nodes.length>=45)return;
			parent.nodes.push(act==='add-node'?{id:this.nextId(),field:'text',cmp:'contains',value:'',not:false}:
				{id:this.nextId(),kind:'group',mode:'all',nodes:[]});
		}else if(act==='remove-node'){
			const parent=this.parent(id);if(!parent)return;parent.nodes=parent.nodes.filter(n=>n.id!==id);
		}else return;
		this.changed(true);
	}
	input(e){
		const el=e.target,r=this.current();
		if(!this.root.contains(el))return;
		if(el.dataset.example){
			this.sample[el.dataset.example]=el.type==='number'?Number(el.value):el.value;this.preview();return;
		}
		if(!r)return;
		const key=el.dataset.rule;
		if(key){
			if(['enabled','stopOnMatch','exemptNicoru','keepProtectedOnAuthorHide','regexReplace'].includes(key))r[key]=el.checked;
			else if(['nicoruMin','dim'].includes(key))r[key]=Number(el.value);
			else if(key==='strip')r.strip=el.value.split(',').map(v=>v.trim()).filter(Boolean);
			else r[key]=el.value;
			this.changed(key==='action'||key==='normalizeColor');return;
		}
		if(el.dataset.groupMode){const n=this.find(el.dataset.groupMode);if(n)n.mode=el.value;this.changed(false);return;}
		const nodeId=el.dataset.nodeField||el.dataset.nodeCmp||el.dataset.nodeValue||el.dataset.nodeNot;
		if(!nodeId)return;
		const n=this.find(nodeId);if(!n)return;
		if(el.dataset.nodeField){
			n.field=el.value;n.value=['nicoru','score','vpos'].includes(n.field)?'1':
				n.field==='color'?'red':n.field==='size'?'big':n.field==='position'?'ue':
				n.field==='fork'?'normal':'';
			n.cmp=['nicoru','score','vpos'].includes(n.field)?'gte':
				n.field==='regex'?'regex':['text','cmd'].includes(n.field)?'contains':'equals';
			this.changed(true);
		}else if(el.dataset.nodeCmp){n.cmp=el.value;this.changed(false);}
		else if(el.dataset.nodeValue){n.value=el.value;this.changed(false);}
		else if(el.dataset.nodeNot){n.not=el.checked;this.changed(false);}
	}
	getDraft(){return NgCompositeRuleEditor.copy(this.rules);}
	replaceDraft(value){
		const next=NgCompositeRuleEditor.prepareDraft(value);
		this.rules=next;this.invalidSaved=false;this.selected=this.rules[0]?.id||'';this.render();
	}
	dispose(){this.shadow?.replaceChildren();}
}
        window.ZenzaAdvancedSettings = {
            config: Config,
            version: '0.3.82-task976'
        };
        const global = {
            PRODUCT
        };
        let panel;
        const __tpl__ = (`
      <button class="openZenzaAdvancedSettingPanel">ZenzaWatch上級者設定</button>
    `).trim();
        const __css__ = (`
      .openZenzaAdvancedSettingPanel {
        font-size: 12px;
        border-radius: 4px;
        -webkit-box-pack: justify;
        -ms-flex-pack: justify;
        justify-content: space-between;
        -webkit-box-align: center;
        -ms-flex-align: center;
        align-items: center;
        padding: 0 6px;
        color: #555;
        font-weight: 600;
        text-align: right;
        letter-spacing: .5px;
        cursor: pointer;
      }
      .openZenzaAdvancedSettingPanel:hover {
        background: #eee;
      }

      .openZenzaAdvancedSettingPanel:active {
        background: #ccc;
      }


      .summer2017Area {
        display: none !important;
      }
    `).trim();
        // Task 059: ショートカットキー設定UI。
        const escapeShortcutHtml = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' }[c]));
        // Task 065: カスタムシークスロット(CUSTOM_SEEK_1〜10)のうち、
        // キーも秒数も既定値(未設定)のままの行は初期状態では隠す
        // (.slotHidden)。ユーザーが以前に使っていた分(キーか秒数のどちらかを
        // 設定済み)は、パネルを開くたびに毎回隠れてしまうと不便なので
        // 常に表示する。
        const isCustomSeekSlotUnset = (action) => {
            if (!action.customSeekSlot) {
                return false;
            }
            const key = parseInt(Config.props['KEY_' + action.id], 10) || 0;
            const seconds = parseFloat(Config.props['PARAM_' + action.id]) || 0;
            return !key && !seconds;
        };
        const renderShortcutKeySettingsHtml = () => {
            const groups = groupShortcutActionsByCategory();
            return groups.map(group => `
        <div class="shortcutCategory">
          <p class="caption sub">${escapeShortcutHtml(group.category)}</p>
          ${group.actions.map(action => {
                const isCustomSeek = !!action.customSeekSlot;
                const rowClass = isCustomSeek ?
                    `shortcutRow customSeekSlotRow${isCustomSeekSlotUnset(action) ? ' slotHidden' : ''}` :
                    'shortcutRow';
                const secondsInputHtml = isCustomSeek ? `
              <input type="text" class="shortcutSecondsInput" inputmode="numeric"
                data-setting-name="PARAM_${action.id}"
                title="秒数を入力(マイナスで戻る・プラスで進む)"
                placeholder="秒数 例:-10">` : '';
                return `
            <div class="${rowClass}" data-action-id="${action.id}">
              <span class="shortcutLabel">${escapeShortcutHtml(action.label)}</span>
              <span class="shortcutKeyDisplay">${escapeShortcutHtml(formatKeyCombo(Config.props['KEY_' + action.id]))}</span>
              <button type="button" class="shortcutRecordBtn" data-action-id="${action.id}">変更</button>
              <button type="button" class="shortcutClearBtn" data-action-id="${action.id}">未設定にする</button>
              <button type="button" class="shortcutResetBtn" data-action-id="${action.id}">既定に戻す(${escapeShortcutHtml(formatKeyCombo(action.defaultKey))})</button>
              ${secondsInputHtml}
              <span class="shortcutConflictWarning"></span>
            </div>
          `;
            }).join('')}
          ${group.category === 'シーク' ? `
          <div class="customSeekAddRow">
            <button type="button" class="customSeekAddBtn">＋ カスタムシークのスロットを追加(最大10個)</button>
          </div>
          ` : ''}
        </div>
      `).join('');
        };
        // Task 077: 画面フィルターの設定欄。項目と説明文は ScreenFilter.PARAMS から作る
        // （プレイヤー内の専用パネルと同じ文言。項目を足す時は ScreenFilter.js だけ直せばよい）。
        const renderScreenFilterSettingsHtml = () => {
            const esc = escapeShortcutHtml;
            const rows = ScreenFilter.PARAMS.map(p => {
                const name = ScreenFilter.PREFIX + p.key;
                if (p.type === 'boolean') {
                    return `
          <div class="screenFilterRow control toggle">
            <label>
              <input type="checkbox" class="checkbox" data-setting-name="${name}">
              ${esc(p.label)}
            </label>
            <div class="settingNote">${esc(p.desc)}</div>
          </div>`;
                }
                if (p.type === 'select') {
                    return `
          <div class="screenFilterRow control toggle">
            <label>
              ${esc(p.label)}
              <select data-setting-name="${name}">
                ${p.options.map(([v, label]) => `<option value="${v}">${esc(label)}</option>`).join('')}
              </select>
            </label>
            <div class="settingNote">${esc(p.desc)}</div>
          </div>`;
                }
                const range = `${p.min}〜${p.max}${p.unit || ''}、標準は ${ScreenFilter.formatValue(p.key, p.def)}`;
                return `
          <div class="screenFilterRow control toggle">
            <label>
              ${esc(p.label)}${p.heavy ? '（やや重い）' : ''}
              <input type="text" class="screenFilterNumberInput" inputmode="decimal" data-setting-name="${name}">
              <span class="screenFilterRange">${esc(range)}</span>
            </label>
            <div class="settingNote">${esc(p.desc)}</div>
          </div>`;
            }).join('');
            const presets = ScreenFilter.PRESETS.map(p => `<button type="button" class="screenFilterPresetBtn" data-preset="${p.id}" title="${esc(p.desc)}">${esc(p.label)}</button>`).join('');
            return `
        <p class="caption">画面フィルター（映像の明るさ・色・反転）</p>
        <div class="settingNote">
          動画の映像だけに明るさ・コントラスト・ガンマなどの補正を掛けます（コメントやボタンには掛かりません）。
          設定は全部の動画で共通で、次に開いた時も残ります。
          動画を見ながら調整したい時は、再生画面の下のバーにある「きらめき（✦）」のボタンから専用パネルを開けます。
        </div>
        <div class="settingNote">
          プリセット「標準」の時がOFF（何も処理しません）で、それ以外を選ぶと自動でONになります。
        </div>
        <div class="control">
          <div>かんたん設定（プリセット）: 押すと下の値がまとめて切り替わります</div>
          <div class="screenFilterPresets">${presets}</div>
        </div>
        ${rows}
        <div class="control toggle">
          <label>
            <input type="checkbox" class="checkbox" data-setting-name="screenFilter.applyToScreenshot">
            スクリーンショットにも画面フィルターを反映する
          </label>
          <label>
            <input type="checkbox" class="checkbox" data-setting-name="screenFilter.applyToCommentPip">
            P in P(コメント付き) にも画面フィルターを反映する
          </label>
          <div class="settingNote">
            通常の P in P は、ブラウザが動画をそのまま小窓に出す仕組みのため、フィルターは反映されません。
            左右反転・上下反転は、再生画面の右クリックメニューか専用パネルで切り替えます（ページを開き直すと元に戻ります）。
          </div>
        </div>
      `;
        };
        class SettingPanel {
            constructor(...args) {
                this.initialize(...args);
            }
            initialize(params) {
                this._playerConfig = params.playerConfig;
                this._$container = params.$container;
                this._update$rawData = _.debounce(this._update$rawData.bind(this), 500);
                this._playerConfig.on('update', this._onPlayerConfigUpdate.bind(this));
            }
            _initializeDom() {
                if (this._$panel) {
                    return;
                }
                const $container = this._$container;
                const config = this._playerConfig;
                cssUtil.addStyle(SettingPanel.__css__);
                $container.append(uq.html(SettingPanel.__tpl__));
                const $panel = this._$panel = $container.find('.zenzaAdvancedSettingPanel');
                this._$view =
                    $container.find('.zenzaAdvancedSettingPanel');
                this._$view.on('click', (e) => e.stopPropagation());
                this._$rawData = $panel.find('.zenzaAdvancedSetting-rawData');
                this._$rawData.val(config.exportJson());
                this._$rawData.on('change', () => {
                    let val = this._$rawData.val();
                    let data;
                    if (val === '') {
                        val = '{}';
                    }
                    try {
                        data = JSON.parse(val);
                    }
                    catch (e) {
                        alert(e);
                        return;
                    }
                    if (confirm('設定データを直接書き換えしますか？')) {
                        try {
                            config.import(data);
                            location.reload();
                        }
                        catch (error) {
                            alert(`設定を読み込めませんでした: ${error.message}`);
                        }
                    }
                });
                this._$playlistData = $panel.find('.zenzaAdvancedSetting-playlistData');
                this._$playlistData.val(JSON.stringify(window.ZenzaWatch.external.playlist.export(), null, 2));
                this._$playlistData.on('change', () => {
                    let val = this._$playlistData.val();
                    let data;
                    if (val === '') {
                        val = '{}';
                    }
                    try {
                        data = JSON.parse(val);
                    }
                    catch (e) {
                        alert(e);
                        return;
                    }
                    if (confirm('プレイリストデータを直接書き換えしますか？')) {
                        window.ZenzaWatch.external.playlist.import(data);
                        location.reload();
                    }
                });
                const onInputItemChange = this._onInputItemChange.bind(this);
                const $check = $panel.find('input[type=checkbox]');
                $check.forEach((check) => {
                    const { settingName } = check.dataset;
                    const val = !!config.props[settingName];
                    check.checked = val;
                    check.closest('.control').classList.toggle('checked', val);
                });
                $check.on('change', this._onToggleItemChange.bind(this));
                const $input = $panel.find('input[type=text], select, .textAreaInput');
                $input.forEach((input) => {
                    const { settingName } = input.dataset;
                    const val = config.props[settingName];
                    input.value = val;
                });
                $input.on('change', onInputItemChange);
                // Task 059: ショートカットキー設定の初期化。
                this._$shortcutContainer = $panel.find('.shortcutKeySettingsContainer');
                $panel.find('.shortcutRecordBtn').on('click', (e) => {
                    e.stopPropagation();
                    this._onShortcutRecordClick(e);
                });
                $panel.find('.shortcutClearBtn').on('click', (e) => {
                    e.stopPropagation();
                    this._onShortcutClearClick(e);
                });
                $panel.find('.shortcutResetBtn').on('click', (e) => {
                    e.stopPropagation();
                    this._onShortcutResetClick(e);
                });
                this._refreshAllShortcutRows();
                // Task 065: カスタムシークの「追加」ボタン。押すたびに、隠れている
                // (未設定の)スロットのうち一番若い番号のものを1つだけ表示する。
                // 10個すべて表示し終えたらボタン自体を無効化する。
                this._$customSeekAddBtn = $panel.find('.customSeekAddBtn');
                this._$customSeekAddBtn.on('click', (e) => {
                    e.stopPropagation();
                    this._onCustomSeekAddClick();
                });
                this._refreshCustomSeekAddButton();
                // Task 077: 画面フィルターのプリセットボタン。値をまとめて書き換えて、入力欄にも反映する
                $panel.find('.screenFilterPresetBtn').on('click', (e) => {
                    e.stopPropagation();
                    const preset = ScreenFilter.PRESETS.find(p => p.id === e.target.dataset.preset);
                    if (!preset) {
                        return;
                    }
                    ScreenFilter.PARAMS.forEach(p => {
                        const name = ScreenFilter.PREFIX + p.key;
                        const v = preset.values[p.key] !== undefined ? preset.values[p.key] : p.def;
                        config.props[name] = v;
                        const input = $panel.find(`[data-setting-name="${name}"]`)[0];
                        if (!input) {
                            return;
                        }
                        if (input.type === 'checkbox') {
                            input.checked = !!v;
                            input.closest('.control').classList.toggle('checked', !!v);
                        }
                        else {
                            input.value = v;
                        }
                    });
                });
                $panel.find('.zenzaAdvancedSetting-close').on('mousedown', (e) => {
                    e.stopPropagation();
                    this.hide();
                });
                // Task200: attach after legacy input handlers, avoiding double saves.
                this._historyPreferences = ZenzaCommentHistorySettings.createBrowserHistoryPreferences({ window, config });
                this._historySettings = ZenzaCommentHistorySettings.mountHistorySettings($panel.find('.commentHistorySettingsContainer')[0], { preferences: this._historyPreferences });
                // Task314: mount only after legacy input/checkbox handlers have scanned their inputs.
                // The custom link editor owns its draft; unrelated settings keep their old handlers.
                this._relatedMenuLinks = RelatedMenuSettings.mount($panel.find('.relatedMenuCustomLinksContainer')[0], { config, actions: RelatedMenuActions,
                    shortcuts: { encodeKeyCombo, formatKeyCombo, actions: SHORTCUT_ACTIONS } });
                $panel.toggleClass('debug', config.props.debug);
                // Task318: mount the new full-viewport settings only after all legacy
                // adapters have registered. Existing data sources remain authoritative.
                const legacyRoot = $panel.find('.settingPanelInner')[0];
                this._modernModel = new ModernAdvancedSettingsModel({
                    config, legacyRoot, actions: SHORTCUT_ACTIONS,
                    screenFilterParams: ScreenFilter.PARAMS,
                    historySchema: ZenzaCommentHistorySettings.SETTINGS_SCHEMA
                });
                this._modernUI = new ModernAdvancedSettingsUI({
                    panel: $panel[0], legacyRoot, model: this._modernModel,
                    relatedEditor: this._relatedMenuLinks,
                    relatedOrder: RelatedMenuOrder,
                    relatedActions: RelatedMenuActions,
                    screenshotFileName: ScreenshotFileName,
                    playlist: window.ZenzaWatch?.external?.playlist,
                    storage: window.localStorage,
                    formatKeyCombo, encodeKeyCombo,
                    onClose: () => {
                        this._modernModel.cancel();
                        this._relatedMenuLinks._load();
                        this.hide();
                    },
                    confirm: (message) => window.confirm(message)
                });
            }
            _onPlayerConfigUpdate(key, value) {
                switch (key) {
                    case 'debug':
                        this._$panel.toggleClass('debug', value);
                        break;
                    case 'wordRegFilter':
                    case 'wordRegFilterFlags':
                        this._$panel.find('.' + key + 'Input').val(value);
                        break;
                    case 'enableFullScreenOnDoubleClick':
                    case 'autoCloseFullScreen':
                    case 'continueNextPage':
                    case 'smallModeAspectLock':
                        this._$panel
                            .find('.' + key + 'Control').toggleClass('checked', value)
                            .find('input[type=checkbox]').prop('checked', value);
                        break;
                }
                this._update$rawData();
            }
            _update$rawData() {
                this._$rawData.val(this._playerConfig.exportJson());
            }
            _onToggleItemChange(e) {
                const { settingName } = e.target.dataset;
                const val = !!e.target.checked;
                this._playerConfig.props[settingName] = val;
                e.target.closest('.control').classList.toggle('checked', val);
            }
            _onInputItemChange(e) {
                const $target = $(e.target);
                const { settingName } = e.target.dataset;
                const val = e.target.value;
                window.setTimeout(() => $target.removeClass('update error'), 300);
                window.console.log('onInputItemChange', settingName, val);
                switch (settingName) {
                    case 'wordRegFilter':
                        try {
                            const reg = new RegExp(val, this._playerConfig.props.wordRegFilterFlags);
                            $target.addClass('update');
                        }
                        catch (err) {
                            $target.addClass('error');
                            //alert('正規表現にエラーがあります');
                            return;
                        }
                        break;
                    case 'wordRegFilterFlags':
                        {
                            try {
                                const reg = new RegExp(this._playerConfig.props.wordRegFilter, val);
                                $target.addClass('update');
                            }
                            catch (err) {
                                $target.addClass('error');
                                //alert('正規表現にエラーがあります');
                                return;
                            }
                        }
                        break;
                    default:
                        $target.addClass('update');
                        break;
                }
                // Task 077: 画面フィルターの数値は範囲内に丸めて数値として保存する
                if (typeof settingName === 'string' && settingName.startsWith(ScreenFilter.PREFIX)) {
                    const key = settingName.slice(ScreenFilter.PREFIX.length);
                    if (ScreenFilter.PARAM_MAP[key]) {
                        const v = ScreenFilter.normalize(key, val);
                        this._playerConfig.props[settingName] = v;
                        e.target.value = v;
                        return;
                    }
                }
                // Task 206: 同時表示上限は選択肢の数値として保存する（文字列のまま保存しない）
                if (settingName === CommentDisplayBudget.CONFIG_KEY) {
                    this._playerConfig.props[settingName] = CommentDisplayBudget.normalizeLimit(val);
                    return;
                }
                this._playerConfig.props[settingName] = val;
                // Task 065: カスタムシーク秒数の入力欄。キーも秒数も未設定に
                // 戻ったら、行を「追加」前の状態(非表示)に戻しておく
                // (常に表示したままだと、使っていないスロットが増えて
                // 一覧が長くなり続けてしまうため)。
                if (typeof settingName === 'string' && settingName.startsWith('PARAM_CUSTOM_SEEK_')) {
                    this._hideCustomSeekSlotIfUnset(settingName.replace(/^PARAM_/, ''));
                }
            }
            // Task 065: 指定したカスタムシークのアクションIDが、キー・秒数とも
            // 未設定に戻っていたら行を隠し、「追加」ボタンの状態も更新する。
            _hideCustomSeekSlotIfUnset(actionId) {
                if (!this._$shortcutContainer) {
                    return;
                }
                const key = parseInt(this._playerConfig.props['KEY_' + actionId], 10) || 0;
                const seconds = parseFloat(this._playerConfig.props['PARAM_' + actionId]) || 0;
                if (key || seconds) {
                    return;
                }
                this._$shortcutContainer
                    .find(`.customSeekSlotRow[data-action-id="${actionId}"]`)
                    .addClass('slotHidden');
                this._refreshCustomSeekAddButton();
            }
            // ---- Task 059: ショートカットキー設定 ----
            _refreshShortcutRow(actionId) {
                if (!this._$shortcutContainer) {
                    return;
                }
                const val = this._playerConfig.props['KEY_' + actionId];
                this._$shortcutContainer
                    .find(`.shortcutRow[data-action-id="${actionId}"] .shortcutKeyDisplay`)
                    .text(formatKeyCombo(val));
            }
            _refreshAllShortcutRows() {
                if (!this._$shortcutContainer) {
                    return;
                }
                SHORTCUT_ACTIONS.forEach(action => this._refreshShortcutRow(action.id));
                this._refreshShortcutConflictWarnings();
            }
            _refreshShortcutConflictWarnings() {
                if (!this._$shortcutContainer) {
                    return;
                }
                const config = this._playerConfig;
                const byKeyValue = {};
                SHORTCUT_ACTIONS.forEach(action => {
                    const val = parseInt(config.props['KEY_' + action.id], 10) || 0;
                    if (!val || val >= 90000000) {
                        return;
                    }
                    (byKeyValue[val] = byKeyValue[val] || []).push(action);
                });
                SHORTCUT_ACTIONS.forEach(action => {
                    const val = parseInt(config.props['KEY_' + action.id], 10) || 0;
                    const dupes = (byKeyValue[val] || []).filter(a => a.id !== action.id);
                    const $warn = this._$shortcutContainer
                        .find(`.shortcutRow[data-action-id="${action.id}"] .shortcutConflictWarning`);
                    if (val && dupes.length) {
                        $warn.text('⚠ 「' + dupes.map(a => a.label).join('」「') + '」と重複しています')
                            .addClass('show');
                    }
                    else {
                        $warn.text('').removeClass('show');
                    }
                });
            }
            _cancelShortcutRecording() {
                if (this._shortcutRecordingCleanup) {
                    this._shortcutRecordingCleanup();
                }
            }
            _onShortcutRecordClick(e) {
                const actionId = e.target.dataset.actionId;
                this._cancelShortcutRecording();
                const $btn = $(e.target);
                const $row = $btn.closest('.shortcutRow');
                const originalLabel = $btn.text();
                $btn.text('キーを押してください (Escでキャンセル)');
                $row.addClass('recording');
                // 修飾キー単体(Shift/Ctrl/Alt/Meta)の押下だけでは確定しない。
                // 実際のキーが押されるまで待つ。単体のEscはキャンセル扱い。
                const MODIFIER_ONLY_KEYCODES = [16, 17, 18, 91, 92, 93, 224];
                const onKeyDown = (evt) => {
                    evt.preventDefault();
                    evt.stopPropagation();
                    if (MODIFIER_ONLY_KEYCODES.includes(evt.keyCode)) {
                        return;
                    }
                    if (evt.keyCode === 27 &&
                        !evt.shiftKey && !evt.ctrlKey && !evt.altKey && !evt.metaKey) {
                        cleanup();
                        return;
                    }
                    const combo = encodeKeyCombo(evt);
                    this._playerConfig.props['KEY_' + actionId] = combo;
                    cleanup();
                    this._refreshAllShortcutRows();
                };
                const cleanup = () => {
                    document.removeEventListener('keydown', onKeyDown, true);
                    $btn.text(originalLabel);
                    $row.removeClass('recording');
                    this._shortcutRecordingCleanup = null;
                };
                this._shortcutRecordingCleanup = cleanup;
                document.addEventListener('keydown', onKeyDown, true);
            }
            _onShortcutClearClick(e) {
                const actionId = e.target.dataset.actionId;
                this._cancelShortcutRecording();
                this._playerConfig.props['KEY_' + actionId] = 0;
                this._refreshAllShortcutRows();
                this._hideCustomSeekSlotIfUnset(actionId);
            }
            _onShortcutResetClick(e) {
                const actionId = e.target.dataset.actionId;
                this._cancelShortcutRecording();
                const key = 'KEY_' + actionId;
                // Publish the effective default before removing the persisted override.
                // deleteValue resets internal data but does not emit a live update.
                this._playerConfig.props[key] = this._playerConfig.default[key];
                this._playerConfig.deleteValue(key);
                this._refreshAllShortcutRows();
                this._hideCustomSeekSlotIfUnset(actionId);
            }
            // Task 065: カスタムシークスロットの「追加」ボタン。
            // 隠れているスロット行(.customSeekSlotRow.slotHidden)のうち、
            // 配列(= CUSTOM_SEEK_1〜10、DOM上も番号順)で一番先頭のものだけを
            // 表示状態に切り替える。全部表示し終えたらボタンを無効化する。
            _onCustomSeekAddClick() {
                if (!this._$shortcutContainer) {
                    return;
                }
                const hiddenRows = this._$shortcutContainer.find('.customSeekSlotRow.slotHidden');
                if (hiddenRows.length) {
                    $(hiddenRows[0]).removeClass('slotHidden');
                }
                this._refreshCustomSeekAddButton();
            }
            _refreshCustomSeekAddButton() {
                if (!this._$shortcutContainer || !this._$customSeekAddBtn) {
                    return;
                }
                const hiddenRows = this._$shortcutContainer.find('.customSeekSlotRow.slotHidden');
                const isFull = hiddenRows.length === 0;
                this._$customSeekAddBtn.prop('disabled', isFull);
                this._$customSeekAddBtn.text(isFull ? 'これ以上は追加できません(最大10個)' : '＋ カスタムシークのスロットを追加(最大10個)');
            }
            _beforeShow() {
                if (this._$playlistData) {
                    this._$playlistData.val(JSON.stringify(window.ZenzaWatch.external.playlist.export(), null, 2));
                }
            }
            toggle(v) {
                this._initializeDom();
                const willShow = typeof v === 'boolean' ? v : !this._$view.hasClass('show');
                if (!willShow) {
                    if (this._modernUI.hasPendingEdits() &&
                        !window.confirm('未保存の変更を破棄して閉じますか？')) {
                        return;
                    }
                    // A newly opened empty seek slot is UI-only but must also be discarded.
                    this._cancelShortcutRecording();
                    this._modernUI.discardChanges();
                }
                else if (!this._modernUI.hasPendingEdits()) {
                    // Import, browser sync and external userscripts can update Config.
                    // Start each opening from the latest committed values.
                    this._modernUI.discardChanges();
                }
                this._$view.toggleClass('show', willShow);
                this._modernUI.setModalVisible(willShow);
                if (willShow) {
                    this._beforeShow();
                }
            }
            show() {
                this.toggle(true);
            }
            hide() {
                this.toggle(false);
            }
        }
        SettingPanel.__css__ = (`
      .zenzaAdvancedSettingPanel {
        position: fixed;
        left: 50%;
        top: -100vh;
        pointer-events: none;
        transform: translate(-50%, -50%);
        z-index: 200000;
        width: 90vw;
        height: 90vh;
        color: #000;
        background: rgba(192, 192, 192, 1);
        transition: top 0.4s ease;
        user-select: none;
        -webkit-user-select: none;
        -moz-user-select: none;
        overflow: hidden;
      }
      .zenzaAdvancedSettingPanel.show {
        opacity: 1;
        top: 50%;
      }

      .zenzaAdvancedSettingPanel.show {
        border: 2px outset #fff;
        box-shadow: 6px 6px 6px rgba(0, 0, 0, 0.5);
        pointer-events: auto;
      }

      .zenzaAdvancedSettingPanel .settingPanelInner {
        box-sizing: border-box;
        margin: 8px;
        padding: 8px;
        overflow: auto;
        height: calc(100% - 86px);
        overscroll-behavior: contain;
        border: 1px inset;
      }
      .zenzaAdvancedSettingPanel .caption {
        background: #333;
        font-size: 20px;
        padding: 4px 8px;
        color: #fff;
      }

      .zenzaAdvancedSettingPanel .caption.sub {
        margin: 8px;
        font-size: 16px;
      }

      .zenzaAdvancedSettingPanel .example {
        display: inline-block;
        margin: 0 16px;
        font-family: sans-serif;
      }

      .zenzaAdvancedSettingPanel label {
        display: inline-block;
        box-sizing: border-box;
        width: 100%;
        height: 100%;
        padding: 4px 8px;
        cursor: pointer;
      }

      .zenzaAdvancedSettingPanel .control {
        border-radius: 4px;
        background: rgba(88, 88, 88, 0.3);
        padding: 8px;
        margin: 16px 4px;
      }

      /* Task 077: 画面フィルター */
      .zenzaAdvancedSettingPanel .screenFilterNumberInput {
        width: 80px;
        margin: 0 8px;
      }
      .zenzaAdvancedSettingPanel .screenFilterRange {
        font-size: 12px;
        color: #999;
      }
      .zenzaAdvancedSettingPanel .screenFilterPresets {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        margin-top: 6px;
      }

      /* Task 073: 設定項目の補足説明 */
      .zenzaAdvancedSettingPanel .settingNote {
        padding: 4px 8px 0;
        font-size: 12px;
        line-height: 1.6;
        color: #bbb;
      }

      .zenzaAdvancedSettingPanel .control:hover {
        background: rgba(88, 88, 128, 0.3);
      }

      .zenzaAdvancedSettingPanel button {
        font-size: 10pt;
        padding: 4px 8px;
        background: #888;
        border-radius: 4px;
        border: solid 1px;
        cursor: pointer;
      }

      .zenzaAdvancedSettingPanel input[type=checkbox] {
        transform: scale(2);
        margin-left: 8px;
        margin-right: 16px;
        cursor: pointer;
      }

      .zenzaAdvancedSettingPanel .control.checked {
      }

      .zenzaAdvancedSettingPanel input[type=text] {
        font-size: 24px;
        background: #ccc;
        color: #000;
        width: 90%;
        margin: 0 5%;
        padding: 8px;
        border-radius: 8px;
      }
      .zenzaAdvancedSettingPanel input[type=text].update {
        color: #003;
        background: #fff;
        box-shadow: 0 0 8px #ff9;
      }
      .zenzaAdvancedSettingPanel input[type=text].update:before {
        content: 'ok';
        position: absolute;
        left: 0;
        z-index: 100;
        color: blue;
      }

      .zenzaAdvancedSettingPanel input[type=text].error {
        color: #300;
        background: #f00;
      }

      .zenzaAdvancedSettingPanel select {
        font-size:24px;
        margin: 0 5%;
        border-radius: 8px;
       }

      .zenzaAdvancedSetting-close {
        position: absolute;
        width: 50%;
        left: 50%;
        bottom: 8px;
        transform: translate(-50%);
        z-index: 160000;
        padding: 8px 16px;
        cursor: pointer;
        box-sizing: border-box;
        text-align: center;
        line-height: 30px;
        font-size: 24px;
        border: outset 2px;
        box-shadow: 0 0 4px #000;
        transition:
          opacity 0.4s ease,
          transform 0.2s ease,
          background 0.2s ease,
          box-shadow 0.2s ease
            ;
        pointer-events: auto;
        transform-origin: center center;
      }

      .textAreaInput {
        width: 90%;
        height: 200px;
        margin: 0 5%;
        word-break: break-all;
        overflow: scroll;
      }

      .zenzaAdvancedSetting-rawData,
      .zenzaAdvancedSetting-playlistData {
        width: 90%;
        height: 300px;
        margin: 0 5%;
        word-break: break-all;
        overflow: scroll;
      }

      .zenzaAdvancedSetting-close:active {
        box-shadow: none;
        border: inset 2px;
        transform: scale(0.8);
      }

      .zenzaAdvancedSettingPanel:not(.debug) .debugOnly {
        display: none !important;
      }


      .example code {
        font-family: monospace;
        display: inline-block;
        margin: 4px;
        padding: 4px 8px;
        background: #333;
        color: #fe8;
        border-radius: 4px;
      }

      .shortcutKeySettingsContainer {
        margin: 8px;
        padding: 8px;
        background: rgba(255, 255, 255, 0.3);
        border-radius: 4px;
      }
      .shortcutCategory {
        margin-bottom: 12px;
      }
      .shortcutCategory .caption.sub {
        margin: 8px 0 4px;
      }
      .shortcutRow {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px;
        padding: 6px 8px;
        border-radius: 4px;
        background: rgba(255, 255, 255, 0.35);
        margin-bottom: 4px;
      }
      .shortcutRow.recording {
        background: #ffe680;
        box-shadow: 0 0 6px #f90;
      }
      .shortcutLabel {
        flex: 1 1 260px;
        font-size: 13px;
      }
      .shortcutKeyDisplay {
        flex: 0 0 auto;
        min-width: 110px;
        text-align: center;
        font-family: monospace;
        font-size: 13px;
        background: #222;
        color: #9f9;
        padding: 2px 8px;
        border-radius: 4px;
      }
      .shortcutRow button {
        font-size: 11px;
        padding: 3px 6px;
      }
      .shortcutConflictWarning {
        flex-basis: 100%;
        font-size: 11px;
        color: #a00;
        display: none;
      }
      .shortcutConflictWarning.show {
        display: block;
      }

      /* Task 065: カスタムシークスロット(CUSTOM_SEEK_1〜10)専用。
         秒数を自由入力できるテキスト欄。汎用の
         .zenzaAdvancedSettingPanel input[type=text] (幅90%)は
         このshortcutRow内では大きすぎるため、幅を個別に上書きする。 */
      .shortcutRow .shortcutSecondsInput {
        width: 90px;
        min-width: 90px;
        margin: 0;
        font-size: 13px;
        padding: 3px 6px;
      }
      .shortcutSecondsInput::placeholder {
        color: #666;
      }
      /* 「未設定(=キーも秒数も既定値のまま)」のスロットは、「追加」ボタンで
         明示的に表示するまで隠す。 */
      .customSeekSlotRow.slotHidden {
        display: none;
      }
      .customSeekAddRow {
        padding: 4px 8px 12px;
      }
      .customSeekAddBtn {
        font-size: 12px;
      }
      .customSeekAddBtn:disabled {
        opacity: 0.5;
        cursor: default;
      }

    `).trim();
        const commands = (`
      <option value="">なし</option>
      <option value="togglePlay">再生/停止</option>
      <option value="fullScreen">フルスクリーン ON/OFF</option>
      <option value="toggle-mute">ミュート ON/OFF</option>
      <option value="toggle-showComment">コメント表示 ON/OFF</option>
      <option value="toggle-backComment">コメントを画面全体に流す ON/OFF</option>
      <option value="toggle-loop">ループ ON/OFF</option>
      <option value="toggle-enableFilter">NG設定 ON/OFF</option>
      <option value="screenShot">スクリーンショット</option>
      <option value="deflistAdd">あとで見る</option>
      <option value="picture-in-picture">picture-in-picture</option>
      <option value="picture-in-picture-comment">picture-in-picture(コメント付き)</option>
      <option value="toggle-screenFilter.enable">エフェクト ON/OFF（今の設定 ⇔ 標準）</option>
      <option value="toggle-screenFilter.split">エフェクトを左右で見比べる ON/OFF</option>
      <option value="toggle-supporterCredit.enable">動画の最後の提供画面 ON/OFF</option>
      <option value="toggle-screenFilterPanel">画面フィルターのパネルを開く/閉じる</option>
    `).trim();
        SettingPanel.__tpl__ = (`
      <div class="zenzaAdvancedSettingPanel zen-family">
        <div class="settingPanelInner">
          <div class="enableFullScreenOnDoubleClickControl control toggle">
            <label>
              <input type="checkbox" class="checkbox" data-setting-name="enableFullScreenOnDoubleClick">
              画面ダブルクリックでフルスクリーン切り換え
            </label>
          </div>

          <div class="autoCloseFullScreenControl control toggle">
            <label>
              <input type="checkbox" class="checkbox" data-setting-name="autoCloseFullScreen">
              再生終了時に自動でフルスクリーン解除

            </label>
          </div>

          <div class="continueNextPageControl control toggle">
            <label>
              <input type="checkbox" class="checkbox" data-setting-name="continueNextPage">
              再生中にページを切り換えても続きから再開する
            </label>
          </div>

          <div class="enableDblclickClose control toggle">
            <label>
              <input type="checkbox" class="checkbox" data-setting-name="enableDblclickClose">
              背景のダブルクリックでプレイヤーを閉じる
            </label>
          </div>

          <div class="smallModeAspectLockControl control toggle">
            <label>
              <input type="checkbox" class="checkbox" data-setting-name="smallModeAspectLock">
              画面モード「小」のリサイズ時にアスペクト比を固定する
            </label>
          </div>

          <div class="autoDisableNew control toggle">
            <label>
              <input type="checkbox" class="checkbox" data-setting-name="autoDisableNew">
              旧システムのほうが画質が良さそうな時は旧システムにする。(旧システム側が1280x720を超える時)
            </label>
          </div>

          <div class="autoZenTube control toggle">
            <label>
              <input type="checkbox" class="checkbox" data-setting-name="autoZenTube">
              自動ZenTube (ZenTubeから戻す時は動画を右クリックからリロード または 右下の「画」)
            </label>
          </div>

          <div class="enableAdDecorationControl control toggle">
            <label>
              <input type="checkbox" class="checkbox" data-setting-name="enableAdDecoration">
              プレイリストに広告の金冠・銀冠枠を表示する
            </label>
          </div>

          <div class="enableCommentPanelControl control toggle">
            <label>
              <input type="checkbox" class="checkbox" data-setting-name="enableCommentPanel">
              動画情報パネルに「コメント」タブ(コメント一覧)を表示する
            </label>
          </div>
          <!-- Task 065: この項目はTask 063でショートカット
            (コメントパネル表示ON/OFF)としてのみ追加されたが、既定では
            キー未割り当て・チェックボックスも無く、押す手段が事実上無い
            状態になっていた(ユーザー報告により発覚)。他の同種の項目
            (プレイリストの広告表示など)と同じ、チェックボックスでの
            直接切り替えをここに追加した。ショートカット自体も
            引き続きショートカットキー設定パネルから利用できる。 -->

          <div class="videoHeaderPositionControl control toggle">
            <label>
              動画ヘッダー（タイトル・タグ欄）の表示位置（通常・大モード）
              <select data-setting-name="videoHeader.position">
                <option value="auto">自動（収まらない時は動画に重ねて自動で隠す・従来通り）</option>
                <option value="outside">常に動画の外に表示（はみ出す時は画面上端に合わせる・隠さない）</option>
                <option value="overlay">常に動画に重ねる（マウスを動かした時だけ表示）</option>
                <option value="overlay-visible">常に動画に重ねる（隠さない）</option>
              </select>
            </label>
          </div>

          <div class="videoIdSuggestModeControl control toggle">
            <label>
              検索欄に動画ID(sm〜)を入力した時のタグ予測の表示
              <select data-setting-name="videoSearch.videoIdSuggestMode">
                <option value="merged">A: 1つの一覧にまとめる（検索→タグ予測→動画）</option>
                <option value="side">B: タグ予測と動画を左右に並べる</option>
                <option value="delayed">C: タグ予測を先に出し、入力が止まってから動画を表示</option>
              </select>
            </label>
          </div>

          <div class="audioAutoAdjustControl control toggle">
            <label>
              <input type="checkbox" class="checkbox" data-setting-name="audio.autoAdjust"
                data-command="toggle-audio.autoAdjust">
              音声の自動調整（動画ごとの音量差を小さくする・本家と同じ）
            </label>
            <div class="settingNote">
              ニコニコが動画ごとに測った音の大きさをもとに、音が大きい動画だけ音量を下げます（音量を上げる方向には働きません）。
              OFFにすると動画の音をそのまま再生します。
            </div>
          </div>

          <div class="supporterCreditControl control toggle">
            <label>
              <input type="checkbox" class="checkbox" data-setting-name="supporterCredit.enable">
              動画の最後に「提供」画面（ニコニ広告・ギフトの支援者）を表示する
            </label>
            <div class="settingNote">
              本家と同じく、動画が最後まで再生されたあとに提供音声の長さ（約10秒）だけ表示し、
              その間もコメントは流れ続けます。一時停止・シークもできます（シークすると動画に戻ります）。
              右下の「スキップ」で飛ばせます。リピート再生中は表示しません。
            </div>
          </div>
          <div class="supporterCreditControl control toggle">
            <label>
              <input type="checkbox" class="checkbox" data-setting-name="supporterCredit.voice">
              提供画面の音声（提供読み上げ）を鳴らす
            </label>
          </div>
          <div class="supporterCreditControl control toggle">
            <label>
              <input type="checkbox" class="checkbox" data-setting-name="supporterCredit.gift">
              提供画面でギフトが落ちてくる演出を表示する
            </label>
          </div>
          <div class="supporterCreditControl control toggle">
            <label>
              <input type="checkbox" class="checkbox" data-setting-name="supporterCredit.skipInPlaylist">
              連続再生中は提供画面を表示しない（すぐ次の動画へ進む）
            </label>
          </div>

          <div class="relatedMenuCustomLinksContainer"></div>

          <div class="screenFilterSettingsContainer">${renderScreenFilterSettingsHtml()}</div>
          <div class="commentHistorySettingsContainer"></div>

          <div class="playlistRetentionControl control toggle">
            <label>連続再生で増えるプレイリストの保持上限
              <select data-setting-name="playlist.maxItems">
                ${Array.from({ length: 10 }, (_, i) => (i + 1) * 1000).map(n => `<option value="${n}">${n}件${n === 3000 ? '（初期値・推奨）' : n >= 8000 ? '（高負荷）' : ''}</option>`).join('')}
              </select>
            </label>
            <div class="settingNote">検索・マイリスト・シリーズ等から取得した動画は、設定値より多くても最大1万件まで保持します。8千～1万件は表示・並べ替え・保存の負荷が大きくなり、保存容量により復元件数が減る場合があります。</div>
          </div>
          <div class="searchLimitControl control toggle">
            <label>検索1回で取得する最大動画数（初期値:1000件）
              <input type="number" min="1" max="5000" step="1" data-setting-name="search.limit">
            </label>
            <div class="settingNote">
              1～5000件を指定できます。連続再生の保持上限とは別の設定です。
              多いほど読み込み時間と通信量が増えます。検索方式によって取得可能件数は異なります。
              リロード時はブラウザの保存容量に入った分を復元します。大きな一覧は書き出しも併用してください。
            </div>
          </div>

          <div class="maxDisplayCommentControl control toggle">
            <label>
              同時に表示するコメント数の上限
              <select data-setting-name="commentLayer.maxDisplayComment">
                ${CommentDisplayBudget.CHOICES.map((n) => `<option value="${n}">${n}件${n === CommentDisplayBudget.DEFAULT ? '（初期値）' : n === 40 ? '（本家ZenzaWatchと同じ）' : n >= 800 ? '（重い）' : ''}</option>`).join('')}
              </select>
            </label>
            <div class="settingNote">
              画面に同時に流せるコメントの数です（取得するコメント数とは別の設定です）。
              一度流れ始めたコメントは上限を超えても最後まで流れ、上限を超えた分は流れ始める前に見送ります。
              見送るときは、投稿者コメントと自分の投稿は必ず表示し、通常のコメント → かんたんコメント → AIコメント → 増量で追加した過去のコメントの順に優先します。
              多くするほど密集した場面で負荷が上がります。
            </div>
          </div>

          <div class="commentArtProtectionControl control toggle">
            <label><input type="checkbox" class="checkbox" data-setting-name="commentLayer.protectCA">コメントアートの配置を保護する</label>
            <div class="settingNote">推定したアートを別の衝突レイヤーへ分け、同時に始まる部品はまとめて表示可否を判断します。元コメント・取得済みデータは削除しません。NGや取得範囲で欠けた部品、フォント差まで復元する機能ではありません。</div>
          </div>

          <div class="enableSlotLayoutEmulation control toggle">
            <label>
              <input type="checkbox" class="checkbox" data-setting-name="commentLayer.enableSlotLayoutEmulation">
              Flash版のコメントスロット処理をエミュレーションする
            </label>
          </div>

          <div class="touch-tap2command control toggle">
            <label>
              2本指タッチ
              <select data-setting-name="touch.tap2command">
                ${commands}
              </select>
            </label>
          </div>

          <div class="touch-tap3command control toggle">
            <label>
              3本指タッチ
              <select data-setting-name="touch.tap3command">
                ${commands}
              </select>
            </label>
          </div>

          <div class="touch-tap3command control toggle">
            <label>
              4本指タッチ
              <select data-setting-name="touch.tap4command">
                ${commands}
              </select>
            </label>
          </div>

          <div class="touch-tap5command control toggle">
            <label>
              5本指タッチ
              <select data-setting-name="touch.tap5command">
                ${commands}
              </select>
            </label>
          </div>


          <p class="caption">ショートカットキー設定</p>
          <span class="example">「変更」を押してからキーを押すと割り当てられます。Escキー単体でキャンセルできます。同じキーが複数の項目に割り当てられている場合は警告が表示されます(動作は先勝ちですが、混乱を避けるため重複しないようにすることを推奨します)。</span>
          <div class="shortcutKeySettingsContainer">${renderShortcutKeySettingsHtml()}</div>

          <p class="caption sub">NGワード正規表現</p>
          <span class="example">入力例: <code>([wWｗＷ]+$|^ん[？\?]$|洗った？$)</code> 文法エラーがある時は更新されません</span>
          <input type="text" class="textInput wordRegFilterInput"
            data-setting-name="wordRegFilter">

          <p class="caption sub">NGワード正規表現フラグ</p>
          <span class="example">入力例: <code>i</code></span>
          <input type="text" class="textInput wordRegFilterFlagsInput"
            data-setting-name="wordRegFilterFlags">

          <p class="caption sub">NG tag</p>
          <span class="example">連続再生中にこのタグのある動画があったらスキップ</span>
          <textarea class="videoTagFilter textAreaInput"
            data-setting-name="videoTagFilter"></textarea>

          <p class="caption sub">NG owner</p>
          <span class="example">連続再生中にこの投稿者IDがあったらスキップ。 チャンネルの場合はchをつける 数字の後に 入力例<code>2525 #コメント</code></span>
          <textarea class="videoOwnerFilter textAreaInput"
            data-setting-name="videoOwnerFilter"></textarea>

          <div class="debugControl control toggle">
            <label>
              <input type="checkbox" class="checkbox" data-setting-name="debug">
              デバッグモード
            </label>
          </div>

          <div class="debugOnly">
            <div class="debugCheckAdDecorationControl control toggle">
              <label>
                <input type="checkbox" class="checkbox" data-setting-name="debugCheckAdDecoration">
                【重い処理】広告装飾(金冠・銀冠)のズレを全件チェックしてコンソールに出力する
              </label>
            </div>
            <span class="example">プレイリスト・関連動画の一覧が変わるたび、表示中の全動画についてキャッシュを使わずサーバーへ再確認し、Zenzaの表示とズレていないかコンソールへ出力する。動画数が多いと通信が増えるため、確認が終わったらOFFに戻すことを推奨。</span>

            <p class="caption sub">生データ(ZenzaWatch設定)</p>
            <span class="example">丸ごとコピペで保存/復元可能。 ここを消すと設定がリセットされます。</span>
            <textarea class="zenzaAdvancedSetting-rawData"></textarea>

            <p class="caption sub">生データ(プレイリスト)</p>
            <span class="example">丸ごとコピペで保存/復元可能。 編集は自己責任で</span>
            <textarea class="zenzaAdvancedSetting-playlistData"></textarea>

          </div>

        </div>
        <div class="zenzaAdvancedSetting-close">閉じる</div>
      </div>
    `).trim();
        const initializePanel = () => {
            // Config.watch();
            if (panel == null) {
                panel = new SettingPanel({
                    playerConfig: Config,
                    $container: $('body')
                });
            }
        };
        const initialize = () => {
            const $button = $(__tpl__);
            cssUtil.addStyle(__css__);
            document.querySelector('#js-initial-userpage-data') ?
                $('.Dropdown-button').before($button) :
                $('.accountEdit').after($button);
            $button.on('click', (e) => {
                initializePanel();
                panel.toggle();
            });
        };
        initialize();
    };
    const loadGM = () => {
        const script = document.createElement('script');
        script.id = 'ZenzaWatchAdvancedSettingsLoader';
        script.setAttribute('type', 'text/javascript');
        script.setAttribute('charset', 'UTF-8');
        script.append(`(${monkey})('${PRODUCT}');`);
        document.body.append(script);
    };
const ZenzaDetector = (() => {
	const promise =
		(window.ZenzaWatch && window.ZenzaWatch.ready) ?
			Promise.resolve(window.ZenzaWatch) :
			new Promise(resolve => {
				[window, (document.body || document.documentElement)]
					.forEach(e => e.addEventListener('ZenzaWatchInitialize', () => {
						resolve(window.ZenzaWatch);
					}));
			});
	return {detect: () => promise};
})();
    ZenzaDetector.detect().then(() => loadGM());
})(globalThis ? globalThis.window : window);
