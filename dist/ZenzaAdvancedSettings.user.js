// ==UserScript==
// @name        ZenzaWatch 上級者用設定
// @namespace   https://github.com/segabito/
// @description1 ZenzaWatchの上級者向け設定。変更する時だけ有効にすればOK
// @include     *//www.nicovideo.jp/my*
// @version     0.3.32-task201
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
// build: 2026-10-02 09:07Z
/* eslint-disable */

((window) => { const self = window;
  const PRODUCT = 'ZenzaWatch';
  const monkey = async (PRODUCT) => {
    const _ = window._ ;
    const Array = window.PureArray || window.Array;
function EmitterInitFunc() {
class Handler { //extends Array {
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
			if (this._list.includes(member)) { member.apply(this._list, args); }
		}
	}
	execMethod(name, ...args) {
		const pending = this._list.slice();
		for (let i = pending.length - 1; i >= 0; i--) {
			const member = pending[i];
			if (this._list.includes(member)) { member[name](...args); }
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
Handler.nop = () => {/*     ( ˘ω˘ ) スヤァ    */};
const PromiseHandler = (() => {
	const id = function() { return `Promise${this.id++}`; }.bind({id: 0});
	class PromiseHandler extends Promise {
		constructor(callback = () => {}) {
			const key = new Object({id: id(), callback, status: 'pending'});
			const cb = function(res, rej) {
				const resolve = (...args) => { this.status = 'resolved'; this.value = args; res(...args); };
				const reject  = (...args) => { this.status = 'rejected'; this.value = args; rej(...args); };
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
		resolve(...args) {
			if (this.key.resolve) {
				this.key.resolve(...args);
			} else {
				this.key.result = Promise.resolve(...args);
			}
			return this;
		}
		reject(...args) {
			if (this.key.reject) {
				this.key.reject(...args);
			} else {
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
const {Emitter} = (() => {
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
				e = this._events.set(name, handler);
			} else {
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
				this._events.delete(name);
			} else {
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
			if (!this._promise) { return; }
			this._promise.delete(name);
		}
		hasPromise(name) {
			return this._promise && this._promise.has(name);
		}
		addEventListener(...args) { return this.on(...args); }
		removeEventListener(...args) { return this.off(...args);}
	}
	Emitter.totalCount = totalCount;
	Emitter.warnings = warnings;
	return {Emitter};
})();
	return {Handler, PromiseHandler, Emitter};
}
const {Handler, PromiseHandler, Emitter} = EmitterInitFunc();
const StorageWriter = (() => {
	const func = function(self) {
		self.onmessage = ({command, params}) => {
			const {obj, replacer, space} = params;
			return JSON.stringify(obj, replacer || null, space || 0);
		};
	};
	let worker;
	const prototypePollution = window.Prototype && Array.prototype.hasOwnProperty('toJSON');
	const toJson = async (obj, replacer = null, space = 0) => {
		if (!prototypePollution || obj === null || ['string', 'number', 'boolean'].includes(typeof obj)) {
			return JSON.stringify(obj, replacer, space);
		}
		worker = worker || workerUtil.createCrossMessageWorker(func, {name: 'ToJsonWorker'});
		return worker.post({command: 'toJson', params: {obj, replacer, space}});
	};
	const writer = Symbol('StorageWriter');
	const setItem = (storage, key, value) => {
		if (!prototypePollution || value === null || ['string', 'number', 'boolean'].includes(typeof value)) {
			storage.setItem(key, JSON.stringify(value));
		} else {
			toJson(value).then(json => storage.setItem(key, json));
		}
	};
	localStorage[writer] = (key, value) => setItem(localStorage, key, value);
	sessionStorage[writer] = (key, value) => setItem(sessionStorage, key, value);
	return { writer, toJson };
})();
const objUtil = (() => {
	const isObject = e => e !== null && e instanceof Object;
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
		mapToObj: map => {
			if (!(map instanceof Map)) {
				return map;
			}
			const obj = {};
			for (const [key, val] of map) {
				obj[key] = val;
			}
			return obj;
		},
	};
})();
const Observable = (() => {
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
const bounce = {
	origin: Symbol('origin'),
	idle(func, time) {
		let reqId = null;
		let lastArgs = null;
		let promise = new PromiseHandler();
		const [caller, canceller] =
			(time === undefined && self.requestIdleCallback) ?
				[self.requestIdleCallback, self.cancelIdleCallback] : [self.setTimeout, self.clearTimeout];
		const callback = () => {
			const lastResult = func(...lastArgs);
			promise.resolve({lastResult, lastArgs});
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
throttle.time = (func, interval = 0) => throttle(func, interval);
throttle.raf = function(func) {
	let promise;
	let cancelled = false;
	let lastArgs = [];
	const callRaf = res => requestAnimationFrame(res);
	const onRaf = () => this.req = null;
	const onCall = () => {
		if (cancelled) {
			cancelled = false;
			return;
		}
		try { func(...lastArgs); } catch (e) { console.warn(e); }
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
}.bind({req: null, count: 0, id: 0});
throttle.idle = func => {
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
		this.restore().then(() => {
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
					console.error('config parse error key:"%s" value:"%s" ', key, storage[storageKey], e);
					if (!this.options?.preserveInvalidKeys?.includes(key)) { delete storage[storageKey]; }
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
				console.error('config parse error key:"%s" value:"%s" ', key, storage[storageKey], e);
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
		this.storage.removeItem(storageKey);
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
				storage[storageKey] = JSON.stringify(value);
			} catch (e) {
				window.console.error(e);
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
					if (storage.hasOwnProperty(storageKey) || storage[storageKey] !== undefined) {
						console.log('delete storage', storageKey, storage[storageKey]);
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
const encodeKeyCombo = e => {
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
for (let i = 96; i <= 105; i++) { KEY_NAME_TABLE[i] = 'Num' + (i - 96); }
const formatKeyCombo = code => {
	code = parseInt(code, 10) || 0;
	if (!code) { return '(未設定)'; }
	if (code >= 90000000) { return '(未割り当て/カスタム値)'; }
	const mods = [];
	let rest = code;
	if (rest >= KEY_MOD.META) { mods.push('Meta'); rest -= KEY_MOD.META; }
	if (rest >= KEY_MOD.ALT) { mods.push('Alt'); rest -= KEY_MOD.ALT; }
	if (rest >= KEY_MOD.CTRL) { mods.push('Ctrl'); rest -= KEY_MOD.CTRL; }
	if (rest >= KEY_MOD.SHIFT) { mods.push('Shift'); rest -= KEY_MOD.SHIFT; }
	mods.push(KEY_NAME_TABLE[rest] || ('#' + rest));
	return mods.join(' + ');
};
// =====================================================================
// =====================================================================
const SHORTCUT_ACTIONS = [
	{id: 'CLOSE', legacy: true, category: 'プレイヤー全般', label: '閉じる',
		defaultKey: 27, command: 'close'},
	{id: 'RE_OPEN', legacy: true, category: 'プレイヤー全般',
		label: '今見ている動画を再読み込み(閉じている時は直前に見ていた動画を開く)',
		defaultKey: 27 + KEY_MOD.SHIFT, command: 'reload'},
	{id: 'HOME', legacy: true, category: 'シーク', label: '先頭へシーク',
		defaultKey: 36 + KEY_MOD.SHIFT, command: 'seekTo', param: 0},
	{id: 'SEEK_LEFT', legacy: true, category: 'シーク', label: '5秒戻る(Shift+←/←長押しでも可)',
		defaultKey: 37 + KEY_MOD.SHIFT, command: 'seekBy', param: -5},
	{id: 'SEEK_RIGHT', legacy: true, category: 'シーク', label: '5秒進む(Shift+→/→長押しでも可)',
		defaultKey: 39 + KEY_MOD.SHIFT, command: 'seekBy', param: 5},
	{id: 'SEEK_PREV_FRAME', legacy: true, category: 'シーク', label: '1コマ戻る',
		defaultKey: 188, command: 'seekPrevFrame'},
	{id: 'SEEK_NEXT_FRAME', legacy: true, category: 'シーク', label: '1コマ進む',
		defaultKey: 190, command: 'seekNextFrame'},
	{id: 'VOL_UP', legacy: true, category: '音量', label: '音量を上げる',
		defaultKey: 38 + KEY_MOD.SHIFT, command: 'volumeUp'},
	{id: 'VOL_DOWN', legacy: true, category: '音量', label: '音量を下げる',
		defaultKey: 40 + KEY_MOD.SHIFT, command: 'volumeDown'},
	{id: 'INPUT_COMMENT', legacy: true, category: 'コメント', label: 'コメント入力欄にフォーカス',
		defaultKey: 67, command: '(専用処理)'},
	{id: 'FULLSCREEN', legacy: true, category: '画面', label: 'フルスクリーン ON/OFF',
		defaultKey: 70, command: 'toggle-fullscreen'},
	{id: 'MUTE', legacy: true, category: '音量', label: 'ミュート ON/OFF',
		defaultKey: 77, command: 'toggle-mute'},
	{id: 'TOGGLE_COMMENT', legacy: true, category: 'コメント', label: 'コメント表示 ON/OFF',
		defaultKey: 86, command: 'toggle-showComment'},
	{id: 'TOGGLE_LOOP', legacy: true, category: '再生', label: 'ループ再生 ON/OFF',
		defaultKey: 82, command: 'toggle-loop'},
	{id: 'DEFLIST_ADD', legacy: true, category: 'マイリスト', label: 'とりあえずマイリストへ追加',
		defaultKey: 84, command: 'deflistAdd'},
	{id: 'DEFLIST_REMOVE', legacy: true, category: 'マイリスト', label: 'とりあえずマイリストから削除',
		defaultKey: 84 + KEY_MOD.SHIFT, command: 'deflistRemove'},
	{id: 'TOGGLE_PLAY', legacy: true, category: '再生', label: '再生 / 一時停止',
		defaultKey: 32, command: 'togglePlay'},
	{id: 'TOGGLE_PLAYLIST', legacy: true, category: 'プレイリスト', label: 'プレイリスト表示 ON/OFF',
		defaultKey: 80, command: 'togglePlaylist'},
	{id: 'SCREEN_MODE_1', legacy: true, category: '画面', label: '画面モード: 小',
		defaultKey: 49 + KEY_MOD.SHIFT, command: 'screenMode', param: 'small'},
	{id: 'SCREEN_MODE_2', legacy: true, category: '画面', label: '画面モード: サイドビュー',
		defaultKey: 50 + KEY_MOD.SHIFT, command: 'screenMode', param: 'sideView'},
	{id: 'SCREEN_MODE_3', legacy: true, category: '画面', label: '画面モード: 3D',
		defaultKey: 51 + KEY_MOD.SHIFT, command: 'screenMode', param: '3D'},
	{id: 'SCREEN_MODE_4', legacy: true, category: '画面', label: '画面モード: 通常',
		defaultKey: 52 + KEY_MOD.SHIFT, command: 'screenMode', param: 'normal'},
	{id: 'SCREEN_MODE_5', legacy: true, category: '画面', label: '画面モード: 大',
		defaultKey: 53 + KEY_MOD.SHIFT, command: 'screenMode', param: 'big'},
	{id: 'SCREEN_MODE_6', legacy: true, category: '画面', label: '画面モード: ワイド',
		defaultKey: 54 + KEY_MOD.SHIFT, command: 'screenMode', param: 'wide'},
	{id: 'SHIFT_RESET', legacy: true, category: '再生速度', label: '押している間だけ超低速再生',
		defaultKey: 49, command: 'playbackRate'},
	{id: 'SHIFT_DOWN', legacy: true, category: '再生速度', label: '再生速度を下げる',
		defaultKey: 188 + KEY_MOD.SHIFT, command: 'shiftDown'},
	{id: 'SHIFT_UP', legacy: true, category: '再生速度', label: '再生速度を上げる',
		defaultKey: 190 + KEY_MOD.SHIFT, command: 'shiftUp'},
	{id: 'NEXT_VIDEO', legacy: true, category: 'プレイリスト', label: '次の動画',
		defaultKey: 74, command: 'playNextVideo'},
	{id: 'PREV_VIDEO', legacy: true, category: 'プレイリスト', label: '前の動画',
		defaultKey: 75, command: 'playPreviousVideo'},
	{id: 'SCREEN_SHOT', legacy: true, category: 'その他', label: 'スクリーンショット',
		defaultKey: 83, command: 'screenShot'},
	{id: 'SCREEN_SHOT_WITH_COMMENT', legacy: true, category: 'その他', label: 'スクリーンショット(コメント付き)',
		defaultKey: 83 + KEY_MOD.SHIFT, command: 'screenShotWithComment'},
	{id: 'TOGGLE_LIKE', category: '再生', label: 'いいね！ ON/OFF',
		defaultKey: 0, command: 'toggle-like'},
	{id: 'PLAYLIST_SHUFFLE', category: 'プレイリスト', label: 'プレイリストをシャッフル',
		defaultKey: 0, command: 'shufflePlaylist'},
	{id: 'RELOAD_VIDEO', category: 'プレイヤー全般', label: '動画を再読み込み',
		defaultKey: 0, command: 'reload'},
	{id: 'SEEK_TO_RESUME_POINT', category: 'シーク', label: '前回の再生位置へシーク',
		defaultKey: 0, command: 'seekToResumePoint'},
	{id: 'OPEN_GINZA', category: 'プレイヤー全般', label: 'Ginza(公式プレイヤー)で開く',
		defaultKey: 0, command: 'openGinza'},
	{id: 'SAVE_MYMEMORY', category: 'その他', label: '再生位置を「おもいで」に保存',
		defaultKey: 0, command: 'saveMymemory'},
	{id: 'TOGGLE_BACK_COMMENT', category: 'コメント', label: 'コメントを動画の後ろに流す ON/OFF',
		defaultKey: 0, command: 'toggle-backComment'},
	{id: 'TOGGLE_NG_FILTER', category: 'フィルタ/NG', label: 'NGフィルタ全体 ON/OFF',
		defaultKey: 0, command: 'toggle-enableFilter'},
	{id: 'TOGGLE_DEBUG', category: 'その他', label: 'デバッグモード ON/OFF',
		defaultKey: 0, command: 'toggle-debug'},
	{id: 'TOGGLE_NICOS_JUMP', category: 'コメント', label: '@ジャンプ機能 ON/OFF',
		defaultKey: 0, command: 'toggle-enableNicosJumpVideo'},
	{id: 'TOGGLE_BEST_ZENTUBE', category: 'その他', label: 'ベストZenTube ON/OFF',
		defaultKey: 0, command: 'toggle-bestZenTube'},
	{id: 'TOGGLE_AUTO_COMMENT_SPEED', category: 'コメント', label: 'コメント速度自動調整 ON/OFF',
		defaultKey: 0, command: 'toggle-autoCommentSpeedRate'},
	{id: 'TOGGLE_STORYBOARD', category: '画面', label: 'シークバーのサムネイル(ストーリーボード) ON/OFF',
		defaultKey: 0, command: 'toggle-enableStoryboard'},
	{id: 'TOGGLE_STORYBOARD_BAR', category: '画面', label: 'シーンサーチバー ON/OFF',
		defaultKey: 0, command: 'toggle-enableStoryboardBar'},
	{id: 'TOGGLE_COMMENT_PANEL', category: 'コメント', label: 'コメントパネル表示 ON/OFF',
		defaultKey: 0, command: 'toggle-enableCommentPanel'},
	{id: 'TOGGLE_COMMENT_PANEL_AUTOSCROLL', category: 'コメント', label: 'コメントパネルの自動スクロール ON/OFF',
		defaultKey: 0, command: 'toggle-enableCommentPanelAutoScroll'},
	{id: 'TOGGLE_HEATMAP', category: '画面', label: '再生数ヒートマップ表示 ON/OFF',
		defaultKey: 0, command: 'toggle-enableHeatMap'},
	{id: 'TOGGLE_AD_DECORATION', category: 'プレイリスト', label: 'プレイリストの広告 金冠/銀冠枠 ON/OFF',
		defaultKey: 0, command: 'toggle-enableAdDecoration'},
	{id: 'TOGGLE_AUTOPLAY', category: '再生', label: '自動再生 ON/OFF',
		defaultKey: 0, command: 'toggle-autoPlay'},
	{id: 'TOGGLE_CONTINUE_NEXT_PAGE', category: '再生', label: 'ページ切り替え後の再生継続 ON/OFF',
		defaultKey: 0, command: 'toggle-continueNextPage'},
	{id: 'TOGGLE_AUTO_ZENTUBE', category: 'その他', label: '自動ZenTube ON/OFF',
		defaultKey: 0, command: 'toggle-autoZenTube'},
	{id: 'TOGGLE_DBLCLICK_CLOSE', category: 'プレイヤー全般', label: '背景ダブルクリックで閉じる ON/OFF',
		defaultKey: 0, command: 'toggle-enableDblclickClose'},
	{id: 'TOGGLE_SMALLMODE_ASPECT_LOCK', category: '画面', label: '「小」モードのアスペクト比ロック ON/OFF',
		defaultKey: 0, command: 'toggle-smallModeAspectLock'},
	{id: 'TOGGLE_FULLSCREEN_ON_DBLCLICK', category: '画面', label: '画面ダブルクリックでフルスクリーン ON/OFF',
		defaultKey: 0, command: 'toggle-enableFullScreenOnDoubleClick'},
	{id: 'TOGGLE_REMOVE_NG_MATCHED_USER', category: 'フィルタ/NG', label: 'NGマッチしたユーザーのコメントを全部消す ON/OFF',
		defaultKey: 0, command: 'toggle-removeNgMatchedUser'},
	{id: 'TOGGLE_COMMENT_PREVIEW', category: 'コメント', label: 'コメント欄プレビュー ON/OFF',
		defaultKey: 0, command: 'toggle-enableCommentPreview'},
	{id: 'OPEN_NICOAD', category: 'その他', label: 'ニコニ広告で宣伝',
		defaultKey: 0, command: 'open-uad'},
	{id: 'OPEN_TWITTER_HASH', category: 'その他', label: 'twitterの反応を見る',
		defaultKey: 0, command: 'open-twitter-hash'},
	{id: 'OPEN_PARENT_VIDEO', category: 'その他', label: '親作品・コンテンツツリーを開く',
		defaultKey: 0, command: 'open-parent-video'},
	{id: 'PLAYLIST_SET_COMMONS_TREE', category: 'プレイリスト', label: '親作品・子作品をプレイリストに追加',
		defaultKey: 0, command: 'playlistSetCommonsTree'},
	{id: 'COPY_WATCH_URL', category: 'その他', label: '動画URLをコピー',
		defaultKey: 0, command: 'copy-video-watch-url'},
	{id: 'RESET_SMALLMODE_POSITION', category: '画面', label: '「小」モードの位置とサイズを初期状態に戻す',
		defaultKey: 0, command: 'resetSmallModePosition'},
	{id: 'CUSTOM_SEEK_1', category: 'シーク', label: 'カスタムシーク1(秒数は自由入力・マイナスで戻る)',
		defaultKey: 0, command: 'seekBy', customSeekSlot: 1},
	{id: 'CUSTOM_SEEK_2', category: 'シーク', label: 'カスタムシーク2(秒数は自由入力・マイナスで戻る)',
		defaultKey: 0, command: 'seekBy', customSeekSlot: 2},
	{id: 'CUSTOM_SEEK_3', category: 'シーク', label: 'カスタムシーク3(秒数は自由入力・マイナスで戻る)',
		defaultKey: 0, command: 'seekBy', customSeekSlot: 3},
	{id: 'CUSTOM_SEEK_4', category: 'シーク', label: 'カスタムシーク4(秒数は自由入力・マイナスで戻る)',
		defaultKey: 0, command: 'seekBy', customSeekSlot: 4},
	{id: 'CUSTOM_SEEK_5', category: 'シーク', label: 'カスタムシーク5(秒数は自由入力・マイナスで戻る)',
		defaultKey: 0, command: 'seekBy', customSeekSlot: 5},
	{id: 'CUSTOM_SEEK_6', category: 'シーク', label: 'カスタムシーク6(秒数は自由入力・マイナスで戻る)',
		defaultKey: 0, command: 'seekBy', customSeekSlot: 6},
	{id: 'CUSTOM_SEEK_7', category: 'シーク', label: 'カスタムシーク7(秒数は自由入力・マイナスで戻る)',
		defaultKey: 0, command: 'seekBy', customSeekSlot: 7},
	{id: 'CUSTOM_SEEK_8', category: 'シーク', label: 'カスタムシーク8(秒数は自由入力・マイナスで戻る)',
		defaultKey: 0, command: 'seekBy', customSeekSlot: 8},
	{id: 'CUSTOM_SEEK_9', category: 'シーク', label: 'カスタムシーク9(秒数は自由入力・マイナスで戻る)',
		defaultKey: 0, command: 'seekBy', customSeekSlot: 9},
	{id: 'CUSTOM_SEEK_10', category: 'シーク', label: 'カスタムシーク10(秒数は自由入力・マイナスで戻る)',
		defaultKey: 0, command: 'seekBy', customSeekSlot: 10},
	{id: 'PICTURE_IN_PICTURE', category: 'その他', label: 'ピクチャーインピクチャー',
		defaultKey: 0, command: 'picture-in-picture'},
	{id: 'PICTURE_IN_PICTURE_COMMENT', category: 'その他', label: 'ピクチャーインピクチャー(コメント付き)',
		defaultKey: 0, command: 'picture-in-picture-comment'},
	{id: 'TOGGLE_AUDIO_AUTO_ADJUST', category: 'その他', label: '音声の自動調整のON/OFF',
		defaultKey: 0, command: 'toggle-audio.autoAdjust'},
	{id: 'TOGGLE_SUPPORTER_CREDIT', category: 'その他', label: '動画の最後の「提供」画面の表示 ON/OFF',
		defaultKey: 0, command: 'toggle-supporterCredit.enable'},
	{id: 'PLAYBACK_RATE_10', category: '再生速度', label: '再生速度: 10倍',
		defaultKey: 0, command: 'playbackRate', param: 10},
	{id: 'PLAYBACK_RATE_5', category: '再生速度', label: '再生速度: 5倍',
		defaultKey: 0, command: 'playbackRate', param: 5},
	{id: 'PLAYBACK_RATE_4', category: '再生速度', label: '再生速度: 4倍',
		defaultKey: 0, command: 'playbackRate', param: 4},
	{id: 'PLAYBACK_RATE_3', category: '再生速度', label: '再生速度: 3倍',
		defaultKey: 0, command: 'playbackRate', param: 3},
	{id: 'PLAYBACK_RATE_2', category: '再生速度', label: '再生速度: 2倍',
		defaultKey: 0, command: 'playbackRate', param: 2},
	{id: 'PLAYBACK_RATE_1_75', category: '再生速度', label: '再生速度: 1.75倍',
		defaultKey: 0, command: 'playbackRate', param: 1.75},
	{id: 'PLAYBACK_RATE_1_5', category: '再生速度', label: '再生速度: 1.5倍',
		defaultKey: 0, command: 'playbackRate', param: 1.5},
	{id: 'PLAYBACK_RATE_1_25', category: '再生速度', label: '再生速度: 1.25倍',
		defaultKey: 0, command: 'playbackRate', param: 1.25},
	{id: 'PLAYBACK_RATE_1', category: '再生速度', label: '再生速度: 標準速度(x1)',
		defaultKey: 0, command: 'playbackRate', param: 1},
	{id: 'PLAYBACK_RATE_0_75', category: '再生速度', label: '再生速度: 0.75倍',
		defaultKey: 0, command: 'playbackRate', param: 0.75},
	{id: 'PLAYBACK_RATE_0_5', category: '再生速度', label: '再生速度: 0.5倍',
		defaultKey: 0, command: 'playbackRate', param: 0.5},
	{id: 'PLAYBACK_RATE_0_25', category: '再生速度', label: '再生速度: 0.25倍',
		defaultKey: 0, command: 'playbackRate', param: 0.25},
	{id: 'PLAYBACK_RATE_0_1', category: '再生速度', label: '再生速度: 0.1倍',
		defaultKey: 0, command: 'playbackRate', param: 0.1},
	{id: 'OPEN_SCREEN_FILTER_PANEL', category: '画面フィルター', label: '画面フィルターのパネルを開く/閉じる',
		defaultKey: 0, command: 'toggle-screenFilterPanel'},
	{id: 'TOGGLE_SCREEN_FILTER', category: '画面フィルター', label: 'エフェクト ON/OFF（今の設定 ⇔ 標準）',
		defaultKey: 0, command: 'toggle-screenFilter.enable'},
	{id: 'TOGGLE_SCREEN_FILTER_SPLIT', category: '画面フィルター', label: '左右で見比べる（左半分に元の映像）ON/OFF',
		defaultKey: 0, command: 'toggle-screenFilter.split'},
	{id: 'SCREEN_FILTER_NEXT_PRESET', category: '画面フィルター', label: 'プリセットを順番に切り替える',
		defaultKey: 0, command: 'screenFilter-nextPreset'},
	{id: 'SCREEN_FILTER_RESET', category: '画面フィルター', label: 'すべて標準に戻す',
		defaultKey: 0, command: 'screenFilter-reset'},
	{id: 'SCREEN_FILTER_PRESET_DARK', category: '画面フィルター', label: 'プリセット: 暗い動画を見やすく',
		defaultKey: 0, command: 'screenFilter-preset', param: 'dark'},
	{id: 'SCREEN_FILTER_PRESET_SHARP', category: '画面フィルター', label: 'プリセット: くっきり',
		defaultKey: 0, command: 'screenFilter-preset', param: 'sharp'},
	{id: 'SCREEN_FILTER_PRESET_FADED', category: '画面フィルター', label: 'プリセット: 色あせ補正',
		defaultKey: 0, command: 'screenFilter-preset', param: 'faded'},
	{id: 'SCREEN_FILTER_PRESET_EYECARE', category: '画面フィルター', label: 'プリセット: 目に優しい（夜）',
		defaultKey: 0, command: 'screenFilter-preset', param: 'eyeCare'},
	{id: 'SCREEN_FILTER_PRESET_MONO', category: '画面フィルター', label: 'プリセット: 白黒',
		defaultKey: 0, command: 'screenFilter-preset', param: 'mono'},
	{id: 'SCREEN_FILTER_PRESET_INVERT', category: '画面フィルター', label: 'プリセット: 反転（暗転）',
		defaultKey: 0, command: 'screenFilter-preset', param: 'invert'},
	{id: 'SCREEN_FILTER_PRESET_VIVID', category: '画面フィルター', label: 'プリセット: ビビッド',
		defaultKey: 0, command: 'screenFilter-preset', param: 'vivid'},
	{id: 'SCREEN_FILTER_PRESET_CINEMA', category: '画面フィルター', label: 'プリセット: シネマ（銀残し風）',
		defaultKey: 0, command: 'screenFilter-preset', param: 'cinema'},
	{id: 'SCREEN_FILTER_PRESET_FILM', category: '画面フィルター', label: 'プリセット: フィルム（レトロ）',
		defaultKey: 0, command: 'screenFilter-preset', param: 'film'},
	{id: 'SCREEN_FILTER_PRESET_PASTEL', category: '画面フィルター', label: 'プリセット: パステル',
		defaultKey: 0, command: 'screenFilter-preset', param: 'pastel'},
	{id: 'SCREEN_FILTER_PRESET_COOL', category: '画面フィルター', label: 'プリセット: 寒色',
		defaultKey: 0, command: 'screenFilter-preset', param: 'cool'},
	{id: 'SCREEN_FILTER_PRESET_WARM', category: '画面フィルター', label: 'プリセット: 暖色',
		defaultKey: 0, command: 'screenFilter-preset', param: 'warm'},
	{id: 'SCREEN_FILTER_PRESET_GOLD', category: '画面フィルター', label: 'プリセット: ゴールド',
		defaultKey: 0, command: 'screenFilter-preset', param: 'gold'},
	{id: 'SCREEN_FILTER_PRESET_MONO_HIGH', category: '画面フィルター', label: 'プリセット: 白黒（硬調）',
		defaultKey: 0, command: 'screenFilter-preset', param: 'monoHigh'},
	{id: 'SCREEN_FILTER_TEMPERATURE_UP', category: '画面フィルター', label: '色温度を暖かく(+5)',
		defaultKey: 0, command: 'screenFilter-adjust', param: 'temperature:5'},
	{id: 'SCREEN_FILTER_TEMPERATURE_DOWN', category: '画面フィルター', label: '色温度を涼しく(-5)',
		defaultKey: 0, command: 'screenFilter-adjust', param: 'temperature:-5'},
	{id: 'SCREEN_FILTER_BLUR_UP', category: '画面フィルター', label: 'ぼかしを強く(+1px)',
		defaultKey: 0, command: 'screenFilter-adjust', param: 'blur:1'},
	{id: 'SCREEN_FILTER_BLUR_DOWN', category: '画面フィルター', label: 'ぼかしを弱く(-1px)',
		defaultKey: 0, command: 'screenFilter-adjust', param: 'blur:-1'},
	{id: 'TOGGLE_SCREEN_FILTER_AUTO_LEVELS', category: '画面フィルター', label: '自動レベル補正 ON/OFF',
		defaultKey: 0, command: 'toggle-screenFilter.autoLevels'},
	{id: 'SCREEN_FILTER_BRIGHTNESS_UP', category: '画面フィルター', label: '明るさを上げる(+5%)',
		defaultKey: 0, command: 'screenFilter-adjust', param: 'brightness:5'},
	{id: 'SCREEN_FILTER_BRIGHTNESS_DOWN', category: '画面フィルター', label: '明るさを下げる(-5%)',
		defaultKey: 0, command: 'screenFilter-adjust', param: 'brightness:-5'},
	{id: 'SCREEN_FILTER_CONTRAST_UP', category: '画面フィルター', label: 'コントラストを上げる(+5%)',
		defaultKey: 0, command: 'screenFilter-adjust', param: 'contrast:5'},
	{id: 'SCREEN_FILTER_CONTRAST_DOWN', category: '画面フィルター', label: 'コントラストを下げる(-5%)',
		defaultKey: 0, command: 'screenFilter-adjust', param: 'contrast:-5'},
	{id: 'SCREEN_FILTER_SATURATE_UP', category: '画面フィルター', label: '彩度(色の濃さ)を上げる(+5%)',
		defaultKey: 0, command: 'screenFilter-adjust', param: 'saturate:5'},
	{id: 'SCREEN_FILTER_SATURATE_DOWN', category: '画面フィルター', label: '彩度(色の濃さ)を下げる(-5%)',
		defaultKey: 0, command: 'screenFilter-adjust', param: 'saturate:-5'},
	{id: 'SCREEN_FILTER_GAMMA_UP', category: '画面フィルター', label: 'ガンマを上げる(暗い所を明るく +0.05)',
		defaultKey: 0, command: 'screenFilter-adjust', param: 'gamma:0.05'},
	{id: 'SCREEN_FILTER_GAMMA_DOWN', category: '画面フィルター', label: 'ガンマを下げる(-0.05)',
		defaultKey: 0, command: 'screenFilter-adjust', param: 'gamma:-0.05'},
	{id: 'TOGGLE_SCREEN_FILTER_INVERT', category: '画面フィルター', label: '階調反転(ネガ) ON/OFF',
		defaultKey: 0, command: 'toggle-screenFilter.invert'},
	{id: 'TOGGLE_FLIP_H', category: '画面フィルター', label: '左右反転 ON/OFF',
		defaultKey: 0, command: 'toggle-flipH'},
	{id: 'TOGGLE_FLIP_V', category: '画面フィルター', label: '上下反転 ON/OFF',
		defaultKey: 0, command: 'toggle-flipV'}
];
const buildDefaultKeyConfig = (existingDefaults = {}) => {
	const result = {};
	SHORTCUT_ACTIONS.forEach(action => {
		const propName = 'KEY_' + action.id;
		if (Object.prototype.hasOwnProperty.call(existingDefaults, propName)) { return; }
		result[propName] = action.defaultKey || 0;
	});
	return result;
};
const groupShortcutActionsByCategory = () => {
	const groups = [];
	const byCategory = {};
	SHORTCUT_ACTIONS.forEach(action => {
		if (!byCategory[action.category]) {
			byCategory[action.category] = {category: action.category, actions: []};
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
const HISTORY_PRESETS=Object.freeze([1000,2500,5000,10000,20000]);
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
return Object.freeze({HISTORY_PRESETS,HISTORY_PREFERENCE_DEFAULTS,createBrowserHistoryPreferences});
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
				if(gains)added++;
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
		this.#historyMeta.clear();this.#historyCount=0;this.#overlapCount=0;
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
	snapshot({historyEnabled=true,historyOnly=false}={}){
		const out=new Map();
		if(historyEnabled)for(const [k,t] of this.#historyMeta)out.set(k,{...t,comments:[]});
		for(const [k,t] of this.#normalMeta)out.set(k,{...t,comments:[]});
		for(const entry of this.#items.values()){
			const c=historyOnly?(entry.normal?null:entry.history):(entry.normal??(historyEnabled?entry.history:null));
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
		return {identity:resumeIdentity(this.#context),history:this.#store.historySnapshot(),
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
					if(added.limited||this.#store.counts().additionalCount>=this.#settings.maxAdditionalComments){
						state.reason='comment_limit';this.#report.reason=state.reason;stopped=true;break;
					}
					if(!summary.returnedCount){state.reason='empty_page';continue;}
					const oldest=threads[0].comments.reduce((min,c)=>Math.min(min,Date.parse(c.postedAt)/1000),Infinity);
					if(!Number.isInteger(oldest)){state.reason='subsecond_boundary_unverified';continue;}
					if(summary.oldestUnixSeconds===summary.newestUnixSeconds&&summary.returnedCount>1){
						state.reason='same_second_boundary_unverified';continue;
					}
					state.nextWhen=oldest;
					if(oldest>=cursor){state.reason='cursor_stalled';continue;}
					this.#report.historyCursorProgressed=true;
				}
			}
			if(!stopped&&states.length){
				const reasons=[...new Set(states.map(s=>s.reason))];
				this.#report.reason=reasons.length===1?reasons[0]:'target_boundaries';
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
	if (resultInfo.isWaybackMode || resultInfo.when > 0) seedError('UNSUPPORTED_WAYBACK');
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
		identity:{videoId,watchId,language,playbackGeneration,normalRevision},baseline,
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
class CommentHistoryController {
	#preferences;#render;#clear;#create;#acquire;#notify;#off;#seed;#session;#report;
	#epoch=0;#normalRevision=0;#operation;#promise=Promise.resolve();#listeners=new Set();#disposed=false;
	#state={enabled:false,phase:'idle',videoId:null,goal:0,additionalCount:0,appliedAdditional:0,normalCount:0,pages:0,reason:null,canContinue:false};
	constructor({preferences,render,clearRender,createSession=(c,o)=>new HistorySession(c,o),acquire=fn=>fn(),notify=()=>{}}={}){
		if(!preferences||[preferences.get,preferences.subscribe,render,clearRender,createSession,acquire,notify].some(f=>typeof f!=='function'))throw new TypeError('Invalid history controller dependencies');
		this.#preferences=preferences;this.#render=render;this.#clear=clearRender;this.#create=createSession;this.#acquire=acquire;this.#notify=notify;
		this.#state.enabled=preferences.get().enabled===true;
		this.#off=preferences.subscribe(snapshot=>{
			if(this.#disposed)return;
			const before=this.#state.enabled;this.#state.enabled=snapshot.enabled===true;
			if(!this.#state.enabled){this.#cancel(true);this.#emit({phase:'idle',additionalCount:0,appliedAdditional:0,pages:0,goal:0,reason:null,canContinue:false});}
			else {this.#emit({});if(!before&&this.#seed)void this.start();}
		});
	}
	get state(){return JSON.parse(JSON.stringify(this.#state));}
	subscribe(fn){this.#listeners.add(fn);fn(this.state);return()=>this.#listeners.delete(fn);}
	#emit(changes){Object.assign(this.#state,changes);for(const fn of [...this.#listeners]){try{fn(this.state);}catch{}}}
	#cancel(clear){
		this.#epoch++;this.#operation?.abort();this.#operation=null;
		this.#session?.removeHistory();this.#session=null;this.#report=null;
		if(clear){try{this.#clear();}catch{}}
	}
	invalidate(){
		this.#cancel(true);this.#seed=null;
		this.#emit({phase:'idle',videoId:null,goal:0,additionalCount:0,appliedAdditional:0,normalCount:0,pages:0,reason:null,canContinue:false});
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
	start({more=false,restart=false}={}){
		if(this.#disposed||!this.#seed||!this.#state.enabled)return Promise.resolve(this.state);
		if(this.#operation)return this.#promise;
		let settings;try{settings=normalizeSettings(this.#preferences.get().settings);}catch{this.#emit({phase:'unavailable',reason:'SETTINGS_INVALID'});return Promise.resolve(this.state);}
		if(more&&this.#state.additionalCount>=20000&&this.#state.phase!=='render-error')return Promise.resolve(this.state);
		if(more&&this.#report&&!this.#report.resumeAvailable&&this.#state.phase!=='render-error')return Promise.resolve(this.state);
		const applyOnly=this.#state.phase==='render-error'&&!restart;
		const continuing=!!(more&&!restart&&this.#session&&this.#report);
		const resume=continuing?this.#session.resumeData():undefined;
		if(continuing)settings.includeEasy=this.#report.settings.includeEasy;
		const oldGoal=this.#state.goal;
		const goal=applyOnly?oldGoal:continuing?Math.min(20000,this.#state.additionalCount<oldGoal?oldGoal:oldGoal+settings.maxAdditionalComments):settings.maxAdditionalComments;
		const epoch=++this.#epoch,operation=new AbortController();this.#operation=operation;
		const current=()=>!this.#disposed&&this.#epoch===epoch&&!operation.signal.aborted&&this.#state.enabled;
		const seed=this.#seed;
		this.#emit({phase:applyOnly?'applying':'queued',goal,reason:null,canContinue:false});
		this.#promise=(async()=>{
			try{
				if(!applyOnly){
					await this.#acquire(async()=>{
						if(!current())return;
						this.#session=this.#create(seed.context,{baseline:seed.baseline,settings:{...settings,maxAdditionalComments:goal},resume});
						const session=this.#session;
						this.#emit({phase:'fetching',pages:0});
						const report=await session.run({signal:operation.signal,startWhen:resume?.startWhen??Math.floor(Date.now()/1000),onProgress:progress=>{
							if(current())this.#emit({phase:'fetching',additionalCount:progress.counts.additionalCount,pages:progress.pages,network:progress.network,
								waitingMs:progress.event==='retry'?progress.waitMs:0});
						}});
						if(!current())return;
						this.#report=report;
					},operation.signal);
				}
				if(!current()||!this.#report||!this.#session)return;
				const report=this.#report;
				this.#emit({phase:'applying',additionalCount:report.counts.additionalCount,pages:report.pages,network:report.network,waitingMs:0});
				let applied;
				try{applied=await this.#render(toZenzaThreads(seed,this.#session.snapshot({historyOnly:true})),{isCurrent:current,signal:operation.signal});}
				catch{
					if(current()){this.#emit({phase:'render-error',reason:'render_failed',canContinue:true});this.#notify('コメント増量：取得済みデータの反映に失敗しました。パネルから再試行できます。');}
					return;
				}
				if(!current())return;
				const partial=!['comment_limit','empty_page','no_history_target'].includes(report.reason);
				this.#emit({phase:partial?'partial':'ready',reason:report.reason,appliedAdditional:applied?.additionalCount??report.counts.additionalCount,
					canContinue:report.resumeAvailable&&report.counts.additionalCount<20000});
				if(partial&&report.reason!=='cancelled')this.#notify('コメント増量：一部取得で終了しました。取得済みの正常なコメントを反映しました。');
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
const {HISTORY_PRESETS,createBrowserHistoryPreferences} = modules[3];
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
		el.innerHTML=`<header class="ch-header"><strong>コメント増量</strong><label class="ch-enable"><input type="checkbox" data-ch-enabled> ON</label><button type="button" data-ch-close aria-label="パネルを閉じる">×</button></header><div class="ch-counter"><span data-ch-count>0</span><small data-ch-goal> / 5,000 件</small></div><div class="ch-status" data-ch-status role="status" aria-live="polite"></div><progress value="0" max="5000" aria-label="追加取得の進捗"></progress><div class="ch-action-row"><label>追加する件数<select data-ch-quota aria-label="追加する件数">${HISTORY_PRESETS.map(n=>`<option value="${n}">${fmt(n)} 件</option>`).join('')}</select></label><button type="button" data-ch-primary>取得開始</button></div><p class="ch-note">ONは次の動画・再起動後も維持します。全タブが取得対象です。</p><details class="ch-details"><summary>取得条件と内訳</summary><div><div class="ch-counts"><span>通常コメント</span><span data-ch-normal></span><span>反映済みの追加分</span><span data-ch-applied></span><span>表示対象の合計</span><span data-ch-total></span></div><label><input type="checkbox" data-ch-easy> かんたんコメントも追加取得</label><p class="ch-note">取得中の条件は固定です。かんたんコメントの変更は、次の動画か「最初から取得」で使用します。NGはそのまま適用されます。</p><button type="button" data-ch-restart>最初から取得</button></div></details><footer class="ch-footer"><span class="ch-note" data-ch-pages></span><button type="button" data-ch-advanced>上級者設定</button></footer><div class="ch-advanced" hidden></div><div class="ch-setting-error" data-ch-error role="status"></div>`;
		const safe=fn=>{try{fn();this.view.querySelector('[data-ch-error]').textContent='';}catch{this.refresh(this.controller.state);this.view.querySelector('[data-ch-error]').textContent='設定を保存できませんでした。';}};
		el.querySelector('[data-ch-close]').onclick=()=>this.close(true);
		el.querySelector('[data-ch-enabled]').onchange=e=>safe(()=>this.controller.setEnabled(e.target.checked));
		el.querySelector('[data-ch-quota]').onchange=e=>safe(()=>this.preferences.patch({maxAdditionalComments:Number(e.target.value)}));
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
		q('[data-ch-normal]').textContent=fmt(state.normalCount);q('[data-ch-applied]').textContent=fmt(state.appliedAdditional);q('[data-ch-total]').textContent=fmt((state.normalCount||0)+(state.appliedAdditional||0));q('[data-ch-pages]').textContent=`${fmt(state.pages)} ページ取得`;
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
HISTORY_PREFERENCE_DEFAULTS: modules[3].HISTORY_PREFERENCE_DEFAULTS,
createBrowserHistoryPreferences: modules[3].createBrowserHistoryPreferences,
HISTORY_ICON: modules[10].HISTORY_ICON,
mountHistorySettings: modules[10].mountHistorySettings,
CommentHistoryPanel: modules[10].CommentHistoryPanel,
createHistoryFeature: modules[10].createHistoryFeature,
});
})();
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
		continueNextPage: false,   // 動画再生中にリロードやページ切り替えしたら続きから開き直す
		backComment: false,        // コメントの裏流し
		autoPauseCommentInput: true, // コメント入力時に自動停止する
		sharedNgLevel: 'MID',      // NG共有の強度 NONE, LOW, MID, HIGH, MAX
		enablePushState: true,     // ブラウザの履歴に乗せる
		enableHeatMap: true,
		enableCommentPreview: false,
		enableAutoMylistComment: false, // マイリストコメントに投稿者を入れる
		menuScale: 1.0,
		enableTogglePlayOnClick: false, // 画面クリック時に再生/一時停止するかどうか
		enableDblclickClose: true, //
		smallModeOffsetX: 0, // 画面モード「小」の位置オフセットX(px)。ドラッグで動かした位置を記憶する
		smallModeOffsetY: 0, // 画面モード「小」の位置オフセットY(px)
		smallModeWidth: 0,   // 画面モード「小」の幅(px)。0 = 既定値(SIDE_PLAYER_WIDTH)を使用
		smallModeHeight: 0,  // 画面モード「小」の高さ(px)。0 = 既定値(SIDE_PLAYER_HEIGHT)を使用
		smallModeAspectLock: false, // 画面モード「小」のリサイズ時にアスペクト比を固定するか
		enableFullScreenOnDoubleClick: true,
		enableStoryboard: true, // シークバーサムネイル関連
		enableStoryboardBar: false, // シーンサーチ
		videoInfoPanelTab: 'videoInfoTab',
		fullscreenControlBarMode: 'auto', // 'always-show' 'always-hide'
		forceEconomy: false, // 動画を強制的にエコノミーモードで開く(HoverMenu.js/initializer.jsが参照)
		enableFilter: true,
		wordFilter: '',
		wordRegFilter: '',
		wordRegFilterFlags: 'i',
		userIdFilter: '',
		commandFilter: '',
		removeNgMatchedUser: false, // NGにマッチしたユーザーのコメント全部消す
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
		'commentLayer.ownerCommentShadowColor': '#008800', // 投稿者コメントの影の色
		'commentLayer.easyCommentOpacity': 0.5, // かんたんコメントの透明度
		'commentLayer.aiCommentOpacity': 0.5, // かんたんコメントの透明度
		overrideGinza: false,     // 動画視聴ページでもGinzaの代わりに起動する
		enableGinzaSlayer: false, // まだ実験中
		lastPlayerId: '',
		playbackRate: 1.0,
		lastWatchId: 'sm9',
		message: '',
		enableVideoSession: true,
		videoServerType: 'dmc',
		autoDisableNew: true, // dmcのほうが高画質と思われる動画でdomandを無効にする
		dmcVideoQuality: 'auto',   // 優先する画質 auto, veryhigh, high, mid, low
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
		'videoHeader.position': 'auto',
		'uaa.enable': true,
		'audio.autoAdjust': false, // 既定はOFF（ONにすると音が大きい動画だけ音量が下がる）
		'supporterCredit.enable': true,       // 提供画面を表示する
		'supporterCredit.voice': true,        // 提供音声（期間ごとに変わる読み上げ）を鳴らす
		'supporterCredit.gift': true,         // ギフトが落ちてくる演出を表示する
		'supporterCredit.skipInPlaylist': false, // 連続再生中は表示しない
		'screenFilter.enable': true,
		'screenFilter.saved': '',
		'screenFilter.brightness': 100,     // 明るさ(%)
		'screenFilter.contrast': 100,       // コントラスト(%)
		'screenFilter.saturate': 100,       // 彩度(%)
		'screenFilter.sepia': 0,            // 暖色(%)
		'screenFilter.hue': 0,              // 色相(度)
		'screenFilter.blur': 0,             // ぼかし(px)
		'screenFilter.invert': false,       // 階調反転
		'screenFilter.gamma': 1.0,          // ガンマ
		'screenFilter.blackLevel': 0,       // 黒レベル（SVGフィルター）
		'screenFilter.whiteLevel': 0,       // 白レベル（SVGフィルター）
		'screenFilter.sharpen': 0,          // シャープ（SVGフィルター）
		'screenFilter.temperature': 0,      // 色温度（-100 青〜+100 橙）
		'screenFilter.tint': 0,             // 色かぶり補正（-100 緑〜+100 赤紫）
		'screenFilter.autoLevels': false,   // 自動レベル補正
		'screenFilter.vignette': 0,         // 周辺減光(%)
		'screenFilter.colorize': 'none',    // 着色（none/gold/sepia/blue/green）
		'screenFilter.flipH': false,        // 左右反転（旧 toggle-flipH。ページを開き直すとOFFに戻る）
		'screenFilter.flipV': false,        // 上下反転（旧 toggle-flipV。同上）
		'screenFilter.applyToScreenshot': true, // スクリーンショットにも反映する
		'screenFilter.applyToCommentPip': true, // P in P(コメント付き)にも反映する
		'screenshot.prefix': '', // スクリーンショットのファイル名の先頭につける文字
		'search.limit': 1000,
		'touch.enable': window.ontouchstart !== undefined,
		'touch.tap2command': '',
		'touch.tap3command': 'toggle-mute',
		'touch.tap4command': 'toggle-showComment',
		'touch.tap5command': 'screenShot',
		autoZenTube: false,
		bestZenTube: false,
		KEY_CLOSE: 27,          // ESC
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
		KEY_DEFLIST_ADD: 84,          // T
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
	Object.assign(DEFAULT_CONFIG, buildDefaultKeyConfig(DEFAULT_CONFIG));
	for (let i = 1; i <= 10; i++) {
		DEFAULT_CONFIG['PARAM_CUSTOM_SEEK_' + i] = 0;
	}
	Object.assign(DEFAULT_CONFIG, ZenzaCommentHistorySettings.HISTORY_PREFERENCE_DEFAULTS);
	return DataStorage.create(
		DEFAULT_CONFIG,
		{
			normalizeImport: (key, value) => {
				if (['videoSearch.f_range', 'videoSearch.l_range'].includes(key) &&
						typeof value === 'string' && /^[0-9]+$/.test(value)) { return Number(value); }
				return value;
			},
			validateImport: (key, value) => {
				if (key === 'commentHistory.enabled') { return typeof value === 'boolean'; }
				if (key.startsWith('commentHistory.')) {
					const descriptor = ZenzaCommentHistorySettings.SETTINGS_SCHEMA.find(item => item.key === key);
					if (!descriptor) { return false; }
					try {
						ZenzaCommentHistorySettings.normalizeSettings({[descriptor.name]: value});
						return true;
					} catch (_) { return false; }
				}
				const choices = {
					screenMode: ['normal', 'big', 'wide', 'small', 'sideView', '3D'],
					sharedNgLevel: ['NONE', 'LOW', 'MID', 'HIGH', 'MAX'],
					fullscreenControlBarMode: ['auto', 'always-show', 'always-hide'],
					'videoHeader.position': ['auto', 'outside', 'overlay', 'overlay-visible'],
					'videoSearch.videoIdSuggestMode': ['merged', 'side', 'delayed']
				};
				const name = key.startsWith('screenMode:') ? 'screenMode' : key;
				if (Object.prototype.hasOwnProperty.call(choices, name)) {
					return choices[name].includes(value);
				}
				if (key.startsWith('KEY_')) { return Number.isSafeInteger(value) && value >= 0; }
				if (key === 'search.limit') { return Number.isInteger(value) && value >= 1 && value <= 5000; }
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
		}
	);
})();
Config.exportConfig = () => Config.export();
Config.importConfig = v => Config.import(v);
Config.exportToFile = () => {
	const json = Config.exportJson();
	const blob = new Blob([json], {type: 'application/json'});
	const url = URL.createObjectURL(blob);
	try {
		const a = Object.assign(document.createElement('a'), {
			download: `${new Date().toLocaleString().replace(/[:/]/g, '_')}_ZenzaWatch.config.json`,
			rel: 'noopener',
			href: url
		});
		a.click();
	} finally {
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
	const toCamel = p => p.replace(/-./g, s => s.charAt(1).toUpperCase());
	const toSnake = p => p.replace(/[A-Z]/g, s => `-${s.charAt(1).toLowerCase()}`);
	const isStyleValue = val => ('px' in CSS) && val instanceof CSSStyleValue;
	const emitter = new Emitter();
	const UNDEF = Symbol('undefined');
	const waitForDom = resolve => {
		if (['interactive', 'complete'].includes(document.readyState)) {
			return resolve();
		}
		document.addEventListener('DOMContentLoaded', resolve, {once: true});
	};
	const waitForComplete = resolve => {
		if (['complete'].includes(document.readyState)) {
			return resolve();
		}
		window.addEventListener('load', resolve, {once: true});
	};
	const isTagLiteral = (t,...args) =>
		Array.isArray(t) &&
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
					} catch (error) {
						console.warn('Exception: ', {target, prop, index, error});
					}
				});
				const isObj = result.some(r => r instanceof Object);
				return isObj ? result.walk : result;
			};
		}
	};
	const isHTMLElement = elm => {
		return (elm instanceof HTMLElement) ||
			(elm.ownerDocument && elm instanceof elm.ownerDocument.defaultView.HTMLElement);
	};
	const isNode = elm => {
		return (elm instanceof Node) ||
			(elm.ownerDocument && elm instanceof elm.ownerDocument.defaultView.Node);
	};
	const isDocument = d => {
		return (d instanceof Document) || (d && d[Symbol.toStringTag] === 'HTMLDocument') ||
			(d.documentElement && d instanceof d.documentElement.ownerDocument.defaultView.Node);
	};
	const isEventTarget = e => {
		return (e instanceof EventTarget) ||
			(e[Symbol.toStringTag] === 'EventTarget') ||
			(e.addEventListener && e.removeEventListener && e.dispatchEvent);
	};
	const isHTMLCollection = e => {
		return e instanceof HTMLCollection || (e && e[Symbol.toStringTag] === 'HTMLCollection');
	};
	const isNodeList = e => {
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
	RafCaller.exec = throttle.raf(function() {
		const taskList = this.taskList.concat();
		this.taskList.length = 0;
		for (const [task, ...args] of taskList) {
			try {
				task(...args);
			} catch (err) {
				console.warn('RafCaller task fail', {task, args});
			}
		}
		this.promise.resolve();
		this.promise = new PromiseHandler();
	}.bind(RafCaller));
	class $Array extends Array {
		get [Symbol.toStringTag]() {
			return '$Array';
		}
		get na() /* 先頭の要素にアクセス */ {
			return this[0];
		}
		get nz() /* 末尾の要素にアクセス */ {
			return this[this.length - 1];
		}
		get walk() /* 全要素のメソッド・プロパティにアクセス */ {
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
			} else if (typeof elm === 'number') {
				this.length = elm;
			} else {
				this[0] = elm;
			}
		}
		get raf() {
			if (!this._raf) {
				this._raf = new RafCaller(this, [
					'addClass','removeClass','toggleClass','css','setAttribute','attr','data','prop',
					'val','focus','blur','insert','append','appendChild','prepend','after','before',
					'text','appendTo','prependTo','remove','show','hide'
				]);
			}
			return this._raf;
		}
		get htmls() {
			return this.filter(isHTMLElement);
		}
		*getHtmls() {
			for (const elm of this) {
				if (isHTMLElement(elm)) { yield elm; }
			}
		}
		get firstElement() {
			for (const elm of this) {
				if (isHTMLElement(elm)) { return elm; }
			}
			return null;
		}
		get nodes() {
			return this.filter(isNode);
		}
		*getNodes() {
			for (const n of this) {
				if (isNode(n)) { yield n; }
			}
		}
		get firstNode() {
			for (const n of this) {
				if (isNode(n)) { return n; }
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
			return {result, $, e};
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
			return $Array.from(h.flat());
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
			return names.every(
				name => htmls.every(elm => elm.classList.contains(name)));
		}
		_css(props) {
			const htmls = this.getHtmls();
			for (const element of htmls) {
				const style = element.style;
				const map = element.attributeStyleMap;
				for (let [key, val] of ((props instanceof Map) ? props : Object.entries(props))) {
					const isNumber = /^[0-9+.]+$/.test(val);
					if (isNumber && /(width|height|top|left)$/i.test(key)) {
						val = HAS_CSSTOM ? CSS.px(val) : `${val}px`;
					}
					try {
						if (HAS_CSSTOM && isStyleValue(val)) {
							key = toSnake(key);
							map.set(key, val);
						} else {
							key = toCamel(key);
							style[key] = val;
						}
					} catch (err) {
						console.warn('uQuery.css fail', {key, val, isNumber});
					}
				}
			}
			return this;
		}
		css(key, val = UNDEF) {
			if (typeof key === 'string') {
				if (val !== UNDEF) {
					return this._css({[key]: val});
				} else {
					const element = this.firstElement;
					if (HAS_CSSTOM) {
						return element.attributeStyleMap.get(toSnake(key));
					} else {
						return element.style[toCamel(key)];
					}
				}
			} else if (key !== null && typeof key === 'object') {
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
			if (args.length) {
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
						if (
							(!eventKey && key.startsWith(`${elementEventName}.`)) ||
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
			} else {
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
			const found = this.find(e => e.hasAttribute && e.hasAttribute(key));
			return found ? found.getAttribute(key) : null;
		}
		data(key, val = UNDEF) {
			if (typeof key === 'object') {
				for (const k of Object.keys(key)) {
					this.data(k, JSON.stringify(key[k]));
				}
				return this;
			}
			key = `data-${toSnake(key)}`;
			if (val !== UNDEF) {
				return this.setAttribute(key, JSON.stringify(val));
			}
			const found = this.find(e => e.hasAttribute && e.hasAttribute(key));
			const attr = found.getAttribute(key);
			try {
				return JSON.parse(attr);
			} catch (e) {
				return attr;
			}
		}
		prop(key, val = UNDEF) {
			if (typeof key === 'object') {
				for (const k of Object.keys(key)) {
					this.prop(k, key[k]);
				}
				return this;
			} else if (val !== UNDEF) {
				for (const elm of this) {
					elm[key] = val;
				}
				return this;
			} else {
				const found = this.find(e => e.hasOwnProperty(key));
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
				} else {
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
			} else {
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
			} else {
				const elm = this.htmls.find(e => e.textContent);
				return elm ? elm.textContent : '';
			}
			return this;
		}
		appendTo(target) {
			if (typeof target === 'string') {
				const e = document.querySelector(target);
				e && e.append(...this.nodes);
			} else {
				target.append(...this.nodes);
			}
			return this;
		}
		prependTo(target) {
			if (typeof target === 'string') {
				const e = document.querySelector(target);
				e && e.prepend(...this.nodes);
			} else {
				target.prepend(...this.nodes);
			}
			return this;
		}
		remove() {
			for (const elm of this) { elm.remove && elm.remove(); }
			return this;
		}
		show() {
			for (const elm of this) { elm.hidden = false; }
			return this;
		}
		hide() {
			for (const elm of this) { elm.hidden = true; }
			return this;
		}
		shadow(...args) {
			const elm = this.firstElement;
			if (!elm) {
				return this;
			}
			if (args.length === 0) {
				elm.shadowRoot || elm.attachShadow({mode: 'open'});
				return $Array(elm.shadowRoot);
			}
			const $d = uQuery(...args);
			if ($d instanceof $Array) {
				elm.shadowRoot || elm.attachShadow({mode: 'open'});
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
		} else if (q instanceof Window) {
			return $Array.from(q.document);
		} else if (q instanceof $Array) {
			return q.concat();
		} else if (q[Symbol.iterator]) {
			return $Array.from(q);
		} else if (isDocument(q)) {
			return $Array.from(q.documentElement);
		} else {
			return new $Array(q);
		}
	};
	Object.assign(uQuery, {
		$Array,
		createDom,
		html: (...args) => new $Array(createDom(...args).children),
		isTL: isTagLiteral,
		ready: (func = () => {}) => emitter.promise('domReady', waitForDom).then(() => func()),
		complete: (func = () => {}) => emitter.promise('domComplete', waitForComplete).then(() => func()),
		each: (arr, callback) => Array.from(arr).forEach((a, i) => callback.apply(a, [i, a])),
		proxy: (func, ...args) => func.bind(...args),
		fn: {
		}
	});
	return uQuery;
})();
const uq = uQuery;
const $ = uq;
const css = (() => {
	const setPropsTask = [];
	const applySetProps = throttle.raf(
		() => {
		const tasks = setPropsTask.concat();
		setPropsTask.length = 0;
		for (const [element, prop, value] of tasks) {
			try {
				element.style.setProperty(prop, value);
			} catch (error) {
				console.warn('element.style.setProperty fail', {element, prop, value, error});
			}
		}
	});
	const css = {
		addStyle: (styles, option, document = window.document) => {
			const elm = Object.assign(document.createElement('style'), {
				type: 'text/css'
			}, typeof option === 'string' ? {id: option} : (option || {}));
			if (typeof option === 'string') {
				elm.id = option;
			} else if (option) {
				Object.assign(elm, option);
			}
			elm.classList.add(global.PRODUCT);
			elm.append(styles.toString());
			(document.head || document.body || document.documentElement).append(elm);
			elm.disabled = option && option.disabled;
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
				} catch (err) { console.warn('CSS.registerProperty fail', definition, err); }
			}
		},
		setProps(...tasks) {
			setPropsTask.push(...tasks);
			return setPropsTask.length ? applySetProps() : Promise.resolve();
		},
		addModule: async function(func, options = {}) {
			if (!CSS || !('paintWorklet' in CSS) || this.set.has(func)) {
				return;
			}
			this.set.add(func);
			const src =
			`(${func.toString()})(
				this,
				registerPaint,
				${JSON.stringify(options.config || {}, null, 2)}
				);`;
			const blob = new Blob([src], {type: 'text/javascript'});
			const url = URL.createObjectURL(blob);
			await CSS.paintWorklet.addModule(url).then(() => URL.revokeObjectURL(url));
			return true;
		}.bind({set: new WeakSet}),
		escape:  value => CSS.escape  ? CSS.escape(value) : value.replace(/([\.#()[\]])/g, '\\$1'),
		number:  value => CSS.number  ? CSS.number(value) : value,
		s:       value => CSS.s       ? CSS.s(value) :  `${value}s`,
		ms:      value => CSS.ms      ? CSS.ms(value) : `${value}ms`,
		pt:      value => CSS.pt      ? CSS.pt(value) : `${value}pt`,
		px:      value => CSS.px      ? CSS.px(value) : `${value}px`,
		percent: value => CSS.percent ? CSS.percent(value) : `${value}%`,
		vh:      value => CSS.vh      ? CSS.vh(value) : `${value}vh`,
		vw:      value => CSS.vw      ? CSS.vw(value) : `${value}vw`,
		trans:   value => self.CSSStyleValue ? CSSStyleValue.parse('transform', value) : value,
		word:    value => self.CSSKeywordValue ? new CSSKeywordValue(value) : value,
		image:   value => self.CSSStyleValue ? CSSStyleValue.parse('background-image', value) : value,
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
		{id: 'standard', label: '標準', values: {},
			desc: 'すべて元のまま（フィルターなし）。'},
		{id: 'dark', label: '暗い動画を見やすく', values: {gamma: 1.35, blackLevel: 4, contrast: 105},
			desc: '夜のシーンや古い実況動画など、暗くて見えにくい動画向け。白飛びさせずに暗い所を持ち上げます。'},
		{id: 'sharp', label: 'くっきり', values: {contrast: 112, saturate: 110, sharpen: 30},
			desc: 'ぼやけた低画質の動画向け。輪郭とメリハリを強めます。輪郭の強調を使うので少しだけ重めです。'},
		{id: 'vivid', label: 'ビビッド', values: {saturate: 135, contrast: 108},
			desc: 'アニメやゲーム実況の色を鮮やかに。'},
		{id: 'faded', label: '色あせ補正', values: {saturate: 130, contrast: 110, autoLevels: true},
			desc: '古い動画や色の薄い動画向け。色を濃くし、明るさの範囲も自動で合わせます。'},
		{id: 'cinema', label: 'シネマ（銀残し風）', values: {saturate: 55, contrast: 120, gamma: 0.92, vignette: 35},
			desc: '映画でよく使われる「銀残し」風。色を抜いて硬めの階調にし、周りを少し暗くします。'},
		{id: 'film', label: 'フィルム（レトロ）', values: {saturate: 80, blackLevel: 7, whiteLevel: -6, temperature: 12},
			desc: '黒を少し浮かせて白を抑え、色を少し抜いた、昔のフィルムのような柔らかい見た目。'},
		{id: 'pastel', label: 'パステル', values: {saturate: 70, blackLevel: 14, contrast: 90, gamma: 1.1},
			desc: '明るく淡い色合いに。'},
		{id: 'cool', label: '寒色', values: {temperature: -35},
			desc: '青っぽく涼しい色合いに。'},
		{id: 'warm', label: '暖色', values: {temperature: 35},
			desc: 'オレンジっぽく暖かい色合いに。'},
		{id: 'eyeCare', label: '目に優しい（夜）', values: {brightness: 85, saturate: 90, temperature: 30},
			desc: '暗い部屋で見る時向け。少し暗く、暖かい色にして青い光を減らします。'},
		{id: 'gold', label: 'ゴールド', values: {colorize: 'gold', contrast: 105},
			desc: '明るさを金色のグラデーションに置き換えます（黄金質・金属質のような見た目）。'},
		{id: 'mono', label: '白黒', values: {saturate: 0},
			desc: '色を抜いて白黒にします。雰囲気づくりや、色のチカチカが気になる時に。'},
		{id: 'monoHigh', label: '白黒（硬調）', values: {saturate: 0, contrast: 135},
			desc: 'コントラストの強い白黒。'},
		{id: 'invert', label: '反転（暗転）', values: {invert: true, hue: 180},
			desc: '白い背景の資料動画などを暗い画面にします（色味はなるべく保ったまま明暗だけ反転）。'}
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
	const auto = {black: 0, white: 1, available: true, timer: null, canvas: null};
	const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
	const digitsOf = p => p.digits !== undefined ? p.digits : (String(p.step).split('.')[1] || '').length;
	const normalize = (key, value) => {
		const p = PARAM_MAP[key];
		if (!p) { return value; }
		if (p.type === 'boolean') {
			return value === true || value === 'true';
		}
		if (p.type === 'select') {
			return p.options.some(([v]) => v === value) ? value : p.def;
		}
		let v = parseFloat(value);
		if (!isFinite(v)) { v = p.def; }
		v = clamp(v, p.min, p.max);
		return parseFloat(v.toFixed(digitsOf(p)));
	};
	const prop = key => config && config.props ? config.props[PREFIX + key] : undefined;
	const setProp = (key, value) => {
		if (!config || !config.props) { return; }
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
		if (p.type === 'boolean') { return !!value === !!p.def; }
		if (p.type === 'select') { return value === p.def; }
		return Math.abs(value - p.def) < 1e-6;
	};
	const sameValue = (p, a, b) => {
		if (p.type === 'boolean') { return !!a === !!b; }
		if (p.type === 'select') { return a === b; }
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
	const saturateMatrix = s => [
		[0.213 + 0.787 * s, 0.715 - 0.715 * s, 0.072 - 0.072 * s, 0],
		[0.213 - 0.213 * s, 0.715 + 0.285 * s, 0.072 - 0.072 * s, 0],
		[0.213 - 0.213 * s, 0.715 - 0.715 * s, 0.072 + 0.928 * s, 0]
	];
	const sepiaMatrix = a => {
		const k = 1 - a;
		return [
			[0.393 + 0.607 * k, 0.769 - 0.769 * k, 0.189 - 0.189 * k, 0],
			[0.349 - 0.349 * k, 0.686 + 0.314 * k, 0.168 - 0.168 * k, 0],
			[0.272 - 0.272 * k, 0.534 - 0.534 * k, 0.131 + 0.869 * k, 0]
		];
	};
	const hueMatrix = deg => {
		const r = deg * Math.PI / 180, c = Math.cos(r), s = Math.sin(r);
		return [
			[0.213 + c * 0.787 - s * 0.213, 0.715 - c * 0.715 - s * 0.715, 0.072 - c * 0.072 + s * 0.928, 0],
			[0.213 - c * 0.213 + s * 0.143, 0.715 + c * 0.285 + s * 0.140, 0.072 - c * 0.072 - s * 0.283, 0],
			[0.213 - c * 0.213 - s * 0.787, 0.715 - c * 0.715 + s * 0.715, 0.072 + c * 0.928 + s * 0.072, 0]
		];
	};
	const LUMA = [0.2126, 0.7152, 0.0722];
	const buildColorMatrix = values => {
		let m = IDENTITY, changed = false;
		const add = x => { m = compose(m, x); changed = true; };
		if (!isDefaultValue('brightness', values.brightness)) { const b = values.brightness / 100; add(diag(b, b, b)); }
		if (!isDefaultValue('contrast', values.contrast)) { const c = values.contrast / 100; add(diag(c, c, c, 0.5 - 0.5 * c)); }
		if (!isDefaultValue('saturate', values.saturate)) { add(saturateMatrix(values.saturate / 100)); }
		if (!isDefaultValue('sepia', values.sepia)) { add(sepiaMatrix(values.sepia / 100)); }
		if (!isDefaultValue('hue', values.hue)) { add(hueMatrix(values.hue)); }
		if (values.invert) { add(diag(-1, -1, -1, 1)); }
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
		return {slope: +slope.toFixed(4), intercept: +intercept.toFixed(4)};
	};
	const TONE_TABLE_SIZE = 65;
	const lerpColor = (stops, x, ch) => {
		const pos = clamp(x, 0, 1) * (stops.length - 1);
		const i = Math.min(stops.length - 2, Math.floor(pos));
		const f = pos - i;
		return stops[i][ch] * (1 - f) + stops[i + 1][ch] * f;
	};
	const useAutoLevels = values => values.autoLevels && auto.available &&
		(auto.black > 0.004 || auto.white < 0.996);
	const buildToneTables = values => {
		const levels = !isDefaultValue('blackLevel', values.blackLevel) || !isDefaultValue('whiteLevel', values.whiteLevel);
		const gamma = !isDefaultValue('gamma', values.gamma);
		const colorize = values.colorize !== 'none' && COLORIZE_MAPS[values.colorize];
		const autoOn = useAutoLevels(values);
		if (!levels && !gamma && !colorize && !autoOn) { return null; }
		const {slope, intercept} = levelsToLinear(values.blackLevel, values.whiteLevel);
		const exponent = 1 / values.gamma;
		const tables = [[], [], []];
		for (let i = 0; i < TONE_TABLE_SIZE; i++) {
			let x = i / (TONE_TABLE_SIZE - 1);
			if (autoOn) { x = clamp((x - auto.black) / Math.max(0.05, auto.white - auto.black), 0, 1); }
			x = clamp(slope * x + intercept, 0, 1);
			x = Math.pow(x, exponent);
			for (let ch = 0; ch < 3; ch++) {
				tables[ch].push(+(colorize ? lerpColor(colorize, x, ch) : x).toFixed(4));
			}
		}
		return tables.map(t => t.join(' '));
	};
	/*
	* シャープ: アンシャープマスク。出力 = (1 + a) × 元の絵 − a × ぼかした絵。
	* a = シャープ/100 × 6（シャープ25で a=1.5。077 の3×3畳み込みと同じくらいの効き）。
	* 077b は a = シャープ/100 × 2 で、効きが弱すぎた（077c で修正）。
	*/
	const SHARPEN_GAIN = 6;
	const buildSvgFilterMarkup = values => {
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
	const ensureSvg = markup => {
		if (typeof document === 'undefined') { return; }
		if (markup === lastSvgKey && document.getElementById(SVG_ID)) { return; }
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
	const buildFilter = (values = read(), {enabled = isEnabled()} = {}) => {
		if (!enabled) { return 'none'; }
		const list = [];
		const markup = buildSvgFilterMarkup(values);
		if (markup) {
			ensureSvg(markup);
			list.push(`url(#${SVG_ID})`);
		}
		if (!isDefaultValue('blur', values.blur)) { list.push(`blur(${values.blur}px)`); }
		return list.length ? list.join(' ') : 'none';
	};
	const vignetteAlpha = (values = read()) =>
		(!isEnabled() || bypass) ? 0 : +(values.vignette / 100 * 0.85).toFixed(3);
	const vignetteBackground = alpha =>
		`radial-gradient(ellipse at center, rgba(0,0,0,0) 45%, rgba(0,0,0,${alpha}) 100%)`;
	const ensureStyle = () => {
		if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) { return; }
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
	const applyVignette = alpha => {
		if (typeof document === 'undefined') { return; }
		const key = String(alpha);
		const videos = document.querySelectorAll('.zenzaWatchVideoElement');
		videos.forEach(video => {
			const parent = video.parentNode;
			if (!parent) { return; }
			let el = parent.querySelector(`:scope > .${VIGNETTE_CLASS}`);
			if (!el) {
				if (!alpha) { return; }
				el = document.createElement('div');
				el.className = VIGNETTE_CLASS;
				video.after(el);
			}
			el.classList.toggle('is-active', alpha > 0);
			if (alpha > 0) { el.style.background = vignetteBackground(alpha); }
		});
		lastVignette = key;
	};
	const emitChange = () => {
		listeners.forEach(fn => {
			try { fn(); } catch (e) { window.console.warn('ScreenFilter listener error', e); }
		});
	};
	const apply = (values = read(), {notify = true} = {}) => {
		applyScheduled = false;
		if (typeof document === 'undefined') { return 'none'; }
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
		if (applyScheduled) { return; }
		applyScheduled = true;
		Promise.resolve().then(() => apply());
	};
	const AUTO_W = 64, AUTO_H = 36;
	const sampleAutoLevels = () => {
		if (!isEnabled() || bypass) { return; }
		const video = document.querySelector('.zenzaWatchVideoElement');
		if (!video || video.paused || video.readyState < 2 || !video.videoWidth) { return; }
		try {
			if (!auto.canvas) {
				auto.canvas = document.createElement('canvas');
				auto.canvas.width = AUTO_W;
				auto.canvas.height = AUTO_H;
				auto.ctx = auto.canvas.getContext('2d', {willReadFrequently: true});
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
			for (let i = 0; i < 256; i++) { acc += hist[i]; if (acc > cut) { low = i; break; } }
			acc = 0;
			for (let i = 255; i >= 0; i--) { acc += hist[i]; if (acc > cut) { high = i; break; } }
			let b = Math.min(low / 255, 0.25), w = Math.max(high / 255, 0.75);
			if (w - b < 0.4) { return; }
			b = auto.black * 0.7 + b * 0.3;
			w = auto.white * 0.7 + w * 0.3;
			if (Math.abs(b - auto.black) < 0.004 && Math.abs(w - auto.white) < 0.004) { return; }
			auto.black = b;
			auto.white = w;
			apply(read(), {notify: false});
		} catch (e) {
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
	const updateAutoLevelsTimer = values => {
		const want = values.autoLevels && isEnabled() && auto.available && typeof window !== 'undefined';
		if (want && !auto.timer) {
			auto.timer = setInterval(sampleAutoLevels, 500);
		} else if (!want && auto.timer) {
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
		if (!PARAM_MAP[key]) { return; }
		setProp(key, normalize(key, value));
		scheduleApply();
	};
	const preview = (key, value) => {
		const values = read();
		values[key] = normalize(key, value);
		apply(values, {notify: false});
	};
	const applyPreset = id => {
		const preset = PRESET_MAP[id];
		if (!preset) { return null; }
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
		if (!p) { return String(value); }
		if (p.type === 'boolean') { return value ? 'ON' : 'OFF'; }
		if (p.type === 'select') { const o = p.options.find(([v]) => v === value); return o ? o[1] : String(value); }
		const text = Number(value).toFixed(digitsOf(p));
		return `${p.signed && value > 0 ? '+' : ''}${text}${p.unit || ''}`;
	};
	const adjust = param => {
		const [key, deltaText] = String(param || '').split(':');
		const p = PARAM_MAP[key];
		if (!p || p.type === 'boolean' || p.type === 'select') { return null; }
		const delta = parseFloat(deltaText) || 0;
		const next = normalize(key, normalize(key, prop(key)) + delta);
		setProp(key, next);
		scheduleApply();
		return {param: p, value: next};
	};
	const onOff = v => v ? 'ON' : 'OFF';
	const isStandard = (values = read()) => PARAMS.every(p => isDefaultValue(p.key, values[p.key]));
	const saveValues = values => {
		try { setProp('saved', JSON.stringify(values)); } catch (e) { /* 保存できなくても動作は続ける */ }
	};
	const loadSaved = () => {
		const raw = prop('saved');
		if (!raw) { return null; }
		try {
			const v = typeof raw === 'string' ? JSON.parse(raw) : raw;
			return v && typeof v === 'object' ? v : null;
		} catch (e) {
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
				if (!saved) { return 'エフェクト: 標準のままです（戻す設定がありません）'; }
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
				if (!preset) { return null; }
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
				if (!result) { return null; }
				return `${result.param.label}: ${formatValue(result.param.key, result.value)}`;
			}
		}
		return null;
	};
	const isCanvasTarget = target => {
		const key = target === 'screenshot' ? 'applyToScreenshot' : 'applyToCommentPip';
		const v = prop(key);
		return v === undefined ? true : !!v;
	};
	const drawVideo = (ctx, source, dx, dy, w, h, {target = 'commentPip'} = {}) => {
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
		} else {
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
	const processCanvas = (canvas, {target = 'screenshot'} = {}) => {
		if (!isCanvasTarget(target)) { return canvas; }
		const filter = bypass ? 'none' : buildFilter();
		if (filter === 'none' && !prop('flipH') && !prop('flipV') && !vignetteAlpha()) { return canvas; }
		const out = document.createElement('canvas');
		out.width = canvas.width;
		out.height = canvas.height;
		const ctx = out.getContext('2d');
		drawVideo(ctx, canvas, 0, 0, canvas.width, canvas.height, {target});
		return out;
	};
	const SPLIT_CLASS = 'zenzaScreenFilterSplit';
	const split = {on: false, raf: 0, canvas: null, ctx: null, lastKey: ''};
	const hideSplitCanvas = () => {
		if (split.canvas) { split.canvas.style.display = 'none'; }
		split.lastKey = '';
	};
	const drawSplit = () => {
		split.raf = 0;
		if (!split.on || typeof document === 'undefined') { return; }
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
		if (!ew || !eh) { hideSplitCanvas(); return; }
		const scale = Math.min(ew / vw, eh / vh);
		const cw = vw * scale, ch = vh * scale;
		const left = video.offsetLeft + (ew - cw) / 2, top = video.offsetTop + (eh - ch) / 2;
		const flipH = !!prop('flipH'), flipV = !!prop('flipV');
		const key = [src.currentTime, left, top, cw, ch, flipH, flipV].join(',');
		if (key === split.lastKey && canvas.style.display !== 'none') { return; }
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
	const setSplit = v => {
		split.on = !!v;
		if (split.on) {
			!split.raf && (split.raf = requestAnimationFrame(drawSplit));
		} else {
			split.raf && cancelAnimationFrame(split.raf);
			split.raf = 0;
			hideSplitCanvas();
		}
		emitChange();
		return split.on;
	};
	const initialize = playerConfig => {
		if (config === playerConfig) { return; }
		config = playerConfig;
		if (prop('enable') === false) {
			const values = read();
			if (!isStandard(values)) { saveValues(values); }
			PARAMS.forEach(p => setProp(p.key, p.def));
			setProp('enable', true);
		}
		setProp('flipH', false);
		setProp('flipV', false);
		if (config && typeof config.on === 'function') {
			config.on('update', key => {
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
	const esc = s => String(s).replace(/[&<>"']/g, c => (
		{'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;'}[c]
	));
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
	const rowHtml = p => {
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
				${ScreenFilter.PRESETS.map(p =>
					`<button type="button" data-preset="${p.id}" title="${esc(p.desc)}">${esc(p.label)}</button>`).join('')}
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
		constructor({config}) {
			this.config = config;
			this.view = null;
			this._onFullscreenChange = this._onFullscreenChange.bind(this);
			this._refresh = this._refresh.bind(this);
		}
		_initializeDom() {
			if (this.view) { return; }
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
					this._updateValueLabel(key, ScreenFilter.normalize(key, e.target.value), {force: true});
				}
			});
			view.addEventListener('change', e => {
				const {param, setting, num} = e.target.dataset;
				if (num) {
					const v = ScreenFilter.normalize(num, e.target.value);
					e.target.value = v;
					ScreenFilter.set(num, v);
					const range = this.view.querySelector(`input[type=range][data-param="${num}"]`);
					range && (range.value = v);
					if (!ScreenFilter.isEnabled()) { this.config.props['screenFilter.enable'] = true; }
				} else if (param) {
					ScreenFilter.set(param, e.target.type === 'checkbox' ? e.target.checked : e.target.value);
					if (!ScreenFilter.isEnabled()) { this.config.props['screenFilter.enable'] = true; }
				} else if (setting) {
					this.config.props[`screenFilter.${setting}`] = !!e.target.checked;
				}
			});
			view.addEventListener('click', e => {
				const target = e.target.closest('button');
				if (!target) { return; }
				const {preset, reset, action} = target.dataset;
				if (preset) {
					ScreenFilter.execCommand('screenFilter-preset', preset);
				} else if (reset) {
					ScreenFilter.set(reset, ScreenFilter.PARAM_MAP[reset].def);
				} else if (action === 'reset') {
					ScreenFilter.reset();
				} else if (action === 'close') {
					this.close();
				} else if (action === 'split') {
					ScreenFilter.setSplit(!ScreenFilter.isSplit);
				}
			});
			this._onOutsidePointerDown = e => {
				if (!this.isOpen || this.view.classList.contains('is-closing')) { return; }
				const path = typeof e.composedPath === 'function' ? e.composedPath() : [e.target];
				if (path.includes(this.view)) { return; }
				if (path.some(el => el && el.classList && el.classList.contains('screenFilterSwitch'))) { return; }
				const onVideo = path.some(el => el && el.classList &&
					(el.classList.contains('videoPlayer') || el.classList.contains('commentLayerFrame')));
				this.close();
				if (onVideo) {
					const swallow = ev => { ev.stopPropagation(); ev.preventDefault(); };
					window.addEventListener('click', swallow, {capture: true, once: true});
					setTimeout(() => window.removeEventListener('click', swallow, {capture: true}), 600);
				}
			};
			ScreenFilter.onChange(this._refresh);
			document.addEventListener('fullscreenchange', this._onFullscreenChange);
			document.addEventListener('webkitfullscreenchange', this._onFullscreenChange);
		}
		_updateValueLabel(key, value, {force = false} = {}) {
			const row = this.view.querySelector(`.sfRow[data-key="${key}"]`);
			const label = row && row.querySelector('.sfValue');
			const num = label && label.querySelector('.sfNum');
			if (!num) { return; }
			if (force || document.activeElement !== num) {
				num.value = value;
			}
			label.classList.toggle('is-changed', Math.abs(value - ScreenFilter.PARAM_MAP[key].def) > 1e-6);
		}
		_refresh() {
			if (!this.view || !this.isOpen) { return; }
			const values = ScreenFilter.read();
			const props = this.config.props;
			ScreenFilter.PARAMS.forEach(p => {
				const input = this.view.querySelector(`[data-param="${p.key}"]`);
				if (!input) { return; }
				if (p.type === 'boolean') {
					input.checked = !!values[p.key];
				} else if (p.type === 'select') {
					input.value = values[p.key];
				} else {
					if (document.activeElement !== input) {
						input.value = values[p.key];
						this._updateValueLabel(p.key, values[p.key]);
					}
				}
			});
			this.view.querySelectorAll('[data-setting]').forEach(input => {
				const name = input.dataset.setting;
				const v = props[`screenFilter.${name}`];
				input.checked = v === undefined ? name !== 'flipH' && name !== 'flipV' : !!v;
			});
			const current = ScreenFilter.detectPreset(values);
			this.view.querySelectorAll('[data-preset]').forEach(button => {
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
			if (!this.view || !this.isOpen) { return; }
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
			window.addEventListener('pointerdown', this._onOutsidePointerDown, {capture: true});
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
			if (!this.view || !this.isOpen) { return; }
			window.removeEventListener('pointerdown', this._onOutsidePointerDown, {capture: true});
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
    window.ZenzaAdvancedSettings = {
      config: Config
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
    const escapeShortcutHtml = s => String(s).replace(/[&<>"']/g, c => (
      {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;'}[c]
    ));

    // Task 065: カスタムシークスロット(CUSTOM_SEEK_1〜10)のうち、
    // キーも秒数も既定値(未設定)のままの行は初期状態では隠す
    // (.slotHidden)。ユーザーが以前に使っていた分(キーか秒数のどちらかを
    // 設定済み)は、パネルを開くたびに毎回隠れてしまうと不便なので
    // 常に表示する。
    const isCustomSeekSlotUnset = action => {
      if (!action.customSeekSlot) { return false; }
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
      const presets = ScreenFilter.PRESETS.map(p =>
        `<button type="button" class="screenFilterPresetBtn" data-preset="${p.id}" title="${esc(p.desc)}">${esc(p.label)}</button>`
      ).join('');
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
        this._playerConfig     = params.playerConfig;
        this._$container       = params.$container;

        this._update$rawData = _.debounce(this._update$rawData.bind(this), 500);
        this._playerConfig.on('update', this._onPlayerConfigUpdate.bind(this));
      }
      _initializeDom() {
        if (this._$panel) { return; }
        const $container = this._$container;
        const config = this._playerConfig;

        cssUtil.addStyle(SettingPanel.__css__);
        $container.append(uq.html(SettingPanel.__tpl__));

        const $panel = this._$panel = $container.find('.zenzaAdvancedSettingPanel');
        this._$view =
          $container.find('.zenzaAdvancedSettingPanel');
        this._$view.on('click', e => e.stopPropagation());

        this._$rawData = $panel.find('.zenzaAdvancedSetting-rawData');
        this._$rawData.val(config.exportJson());
        this._$rawData.on('change', () => {
          let val = this._$rawData.val();
          let data;
          if (val === '') { val = '{}'; }

          try {
            data = JSON.parse(val);
          } catch (e) {
            alert(e);
            return;
          }

          if (confirm('設定データを直接書き換えしますか？')) {
            try {
              config.import(data);
              location.reload();
            } catch (error) {
              alert(`設定を読み込めませんでした: ${error.message}`);
            }
          }

        });

        this._$playlistData = $panel.find('.zenzaAdvancedSetting-playlistData');
        this._$playlistData.val(JSON.stringify(window.ZenzaWatch.external.playlist.export(), null, 2));
        this._$playlistData.on('change', () => {
          let val = this._$playlistData.val();
          let data;
          if (val === '') { val = '{}'; }

          try {
            data = JSON.parse(val);
          } catch (e) {
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
        $check.forEach(check => {
          const {settingName} = check.dataset;
          const val = !!config.props[settingName];
          check.checked = val;
          check.closest('.control').classList.toggle('checked', val);
        });
        $check.on('change', this._onToggleItemChange.bind(this));

        const $input = $panel.find('input[type=text], select, .textAreaInput');
        $input.forEach(input => {
          const {settingName} = input.dataset;
          const val = config.props[settingName];
          input.value = val;
        });
        $input.on('change', onInputItemChange);

        // Task 059: ショートカットキー設定の初期化。
        this._$shortcutContainer = $panel.find('.shortcutKeySettingsContainer');
        $panel.find('.shortcutRecordBtn').on('click', e => {
          e.stopPropagation();
          this._onShortcutRecordClick(e);
        });
        $panel.find('.shortcutClearBtn').on('click', e => {
          e.stopPropagation();
          this._onShortcutClearClick(e);
        });
        $panel.find('.shortcutResetBtn').on('click', e => {
          e.stopPropagation();
          this._onShortcutResetClick(e);
        });
        this._refreshAllShortcutRows();

        // Task 065: カスタムシークの「追加」ボタン。押すたびに、隠れている
        // (未設定の)スロットのうち一番若い番号のものを1つだけ表示する。
        // 10個すべて表示し終えたらボタン自体を無効化する。
        this._$customSeekAddBtn = $panel.find('.customSeekAddBtn');
        this._$customSeekAddBtn.on('click', e => {
          e.stopPropagation();
          this._onCustomSeekAddClick();
        });
        this._refreshCustomSeekAddButton();

        // Task 077: 画面フィルターのプリセットボタン。値をまとめて書き換えて、入力欄にも反映する
        $panel.find('.screenFilterPresetBtn').on('click', e => {
          e.stopPropagation();
          const preset = ScreenFilter.PRESETS.find(p => p.id === e.target.dataset.preset);
          if (!preset) { return; }
          ScreenFilter.PARAMS.forEach(p => {
            const name = ScreenFilter.PREFIX + p.key;
            const v = preset.values[p.key] !== undefined ? preset.values[p.key] : p.def;
            config.props[name] = v;
            const input = $panel.find(`[data-setting-name="${name}"]`)[0];
            if (!input) { return; }
            if (input.type === 'checkbox') {
              input.checked = !!v;
              input.closest('.control').classList.toggle('checked', !!v);
            } else {
              input.value = v;
            }
          });
        });

        $panel.find('.zenzaAdvancedSetting-close').on('mousedown', e => {
          e.stopPropagation();
          this.hide();
        });

        // Task200: attach after legacy input handlers, avoiding double saves.
        this._historyPreferences = ZenzaCommentHistorySettings.createBrowserHistoryPreferences({window, config});
        this._historySettings = ZenzaCommentHistorySettings.mountHistorySettings(
          $panel.find('.commentHistorySettingsContainer')[0], {preferences: this._historyPreferences}
        );
        $panel.toggleClass('debug', config.props.debug);
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
        const {settingName} = e.target.dataset;
        const val = !!e.target.checked;

        this._playerConfig.props[settingName] = val;
        e.target.closest('.control').classList.toggle('checked', val);
      }
      _onInputItemChange(e) {
        const $target = $(e.target);
        const {settingName} = e.target.dataset;
        const val = e.target.value;

        window.setTimeout(() => $target.removeClass('update error'), 300);

        window.console.log('onInputItemChange', settingName, val);
        switch (settingName) {
          case 'wordRegFilter':
            try {
              const reg = new RegExp(val, this._playerConfig.props.wordRegFilterFlags);
              $target.addClass('update');
            } catch(err) {
              $target.addClass('error');
              //alert('正規表現にエラーがあります');
              return;
            }
            break;
          case 'wordRegFilterFlags': {
            try {
              const reg = new RegExp(this._playerConfig.props.wordRegFilter, val);
              $target.addClass('update');
            } catch(err) {
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
        if (!this._$shortcutContainer) { return; }
        const key = parseInt(this._playerConfig.props['KEY_' + actionId], 10) || 0;
        const seconds = parseFloat(this._playerConfig.props['PARAM_' + actionId]) || 0;
        if (key || seconds) { return; }
        this._$shortcutContainer
          .find(`.customSeekSlotRow[data-action-id="${actionId}"]`)
          .addClass('slotHidden');
        this._refreshCustomSeekAddButton();
      }
      // ---- Task 059: ショートカットキー設定 ----
      _refreshShortcutRow(actionId) {
        if (!this._$shortcutContainer) { return; }
        const val = this._playerConfig.props['KEY_' + actionId];
        this._$shortcutContainer
          .find(`.shortcutRow[data-action-id="${actionId}"] .shortcutKeyDisplay`)
          .text(formatKeyCombo(val));
      }
      _refreshAllShortcutRows() {
        if (!this._$shortcutContainer) { return; }
        SHORTCUT_ACTIONS.forEach(action => this._refreshShortcutRow(action.id));
        this._refreshShortcutConflictWarnings();
      }
      _refreshShortcutConflictWarnings() {
        if (!this._$shortcutContainer) { return; }
        const config = this._playerConfig;
        const byKeyValue = {};
        SHORTCUT_ACTIONS.forEach(action => {
          const val = parseInt(config.props['KEY_' + action.id], 10) || 0;
          if (!val || val >= 90000000) { return; }
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
          } else {
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
        const onKeyDown = evt => {
          evt.preventDefault();
          evt.stopPropagation();
          if (MODIFIER_ONLY_KEYCODES.includes(evt.keyCode)) { return; }
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
        this._playerConfig.deleteValue('KEY_' + actionId);
        this._refreshAllShortcutRows();
        this._hideCustomSeekSlotIfUnset(actionId);
      }
      // Task 065: カスタムシークスロットの「追加」ボタン。
      // 隠れているスロット行(.customSeekSlotRow.slotHidden)のうち、
      // 配列(= CUSTOM_SEEK_1〜10、DOM上も番号順)で一番先頭のものだけを
      // 表示状態に切り替える。全部表示し終えたらボタンを無効化する。
      _onCustomSeekAddClick() {
        if (!this._$shortcutContainer) { return; }
        const hiddenRows = this._$shortcutContainer.find('.customSeekSlotRow.slotHidden');
        if (hiddenRows.length) {
          $(hiddenRows[0]).removeClass('slotHidden');
        }
        this._refreshCustomSeekAddButton();
      }
      _refreshCustomSeekAddButton() {
        if (!this._$shortcutContainer || !this._$customSeekAddBtn) { return; }
        const hiddenRows = this._$shortcutContainer.find('.customSeekSlotRow.slotHidden');
        const isFull = hiddenRows.length === 0;
        this._$customSeekAddBtn.prop('disabled', isFull);
        this._$customSeekAddBtn.text(
          isFull ? 'これ以上は追加できません(最大10個)' : '＋ カスタムシークのスロットを追加(最大10個)'
        );
      }
      _beforeShow() {
        if (this._$playlistData) {
          this._$playlistData.val(
            JSON.stringify(window.ZenzaWatch.external.playlist.export(), null, 2)
          );
        }
      }
      toggle(v) {
        this._initializeDom();
        // window.ZenzaWatch.external.execCommand('close');
        if (!v) {
          // Task 059: パネルを閉じる時、ショートカットキー記録中の
          // document捕捉フェーズのkeydownリスナーが残ってしまうと、
          // パネルを閉じた後もキー入力が全部食われてしまうため、
          // 必ずキャンセルしてから閉じる。
          this._cancelShortcutRecording();
        }
        this._$view.toggleClass('show', v);
        if (this._$view.hasClass('show')) { this._beforeShow(); }
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
      <option value="toggle-backComment">コメントの背面表示 ON/OFF</option>
      <option value="toggle-loop">ループ ON/OFF</option>
      <option value="toggle-enableFilter">NG設定 ON/OFF</option>
      <option value="screenShot">スクリーンショット</option>
      <option value="deflistAdd">とりあえずマイリスト</option>
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

          <div class="screenFilterSettingsContainer">${renderScreenFilterSettingsHtml()}</div>
          <div class="commentHistorySettingsContainer"></div>

          <div class="searchLimitControl control toggle">
            <label>
              検索でプレイリストに読み込む最大件数（推奨: 1000件まで）
              <select data-setting-name="search.limit">
                <option value="100">100件（軽い）</option>
                <option value="300">300件（標準・初期値）</option>
                <option value="500">500件</option>
                <option value="1000">1000件（推奨の上限）</option>
                <option value="2000">2000件（重い・読み込みに時間がかかる）</option>
                <option value="3000">3000件（重い）</option>
                <option value="5000">5000件（最大・とても重い）</option>
              </select>
            </label>
            <div class="settingNote">
              100件ごとにニコニコへ1回問い合わせるため、多いほど読み込みが遅くなり、プレイリストの表示も重くなります。
              上限はニコニコの検索の仕様で5000件です（予備の検索方式に切り替わった時は1600件まで）。
              リロード後に復元されるのは、再生中の動画の前後1000件までです。
            </div>
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

      $button.on('click', e => {
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
