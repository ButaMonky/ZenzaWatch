// ==UserScript==
// @name        ZenzaWatch 上級者用設定
// @namespace   https://github.com/segabito/
// @description1 ZenzaWatchの上級者向け設定。変更する時だけ有効にすればOK
// @include     *//www.nicovideo.jp/my*
// @version     0.3.19-task080
// @author      segabito macmoto
// @license     public domain
// @grant       none
// @noframes
// @require     https://cdnjs.cloudflare.com/ajax/libs/lodash.js/4.17.11/lodash.min.js
// @homepageURL    https://github.com/ButaMonky/ZenzaWatch
// @supportURL     https://github.com/ButaMonky/ZenzaWatch/issues
// @downloadURL    https://github.com/ButaMonky/ZenzaWatch/raw/develop/dist/ZenzaAdvancedSettings.user.js
// @updateURL      https://github.com/ButaMonky/ZenzaWatch/raw/develop/dist/ZenzaAdvancedSettings.user.js
// ==/UserScript==
// build: 2026-09-19 06:22Z 7c252d9
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
		if (!this._list.length) {
			return;
		} else if (this._list.length === 1) {
			this._list[0](...args);
			return;
		}
		for (let i = this._list.length - 1; i >= 0; i--) {
			this._list[i](...args);
		}
	}
	execMethod(name, ...args) {
		if (!this._list.length) {
			return;
		} else if (this._list.length === 1) {
			this._list[0][name](...args);
			return;
		}
		for (let i = this._list.length - 1; i >= 0; i--) {
			this._list[i][name](...args);
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
				e.remove(callback);
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
				func(...args);
				this.off(name, wrapper);
				wrapper._original = null;
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
		subscribe(subscriber, onError, onCompleted) {
			return this.observable.subscribe(subscriber, onError, onCompleted)
				.filter(this._filterFunc)
				.map(this._mapFunc);
		}
		unsubscribe() {
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
		constructor({start, next, error, complete} = {start:nop, next:nop, error:nop, complete:nop}) {
			this.callbacks = {start, next, error, complete};
		}
		start(arg) {this.callbacks.start(arg);}
		next(arg) {this.callbacks.next(arg);}
		error(arg) {this.callbacks.error(arg);}
		complete(arg) {this.callbacks.complete(arg);}
		get closed() {
			return this._callbacks.closed ? this._callbacks.closed() : false;
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
			this._completed = false;
			this._cancelled = false;
			this._handlers = new Handler();
		}
		_initSubscriber() {
			if (this._subscriber) {
				return;
			}
			const handlers = this._handlers;
			this._completed = this._cancelled = false;
			return this._subscriber = new Subscriber({
				start: arg => handlers.execMethod('start', arg),
				next: arg => handlers.execMethod('next', arg),
				error: arg => handlers.execMethod('error', arg),
				complete: arg => {
					if (this._nextObservable) {
						this._nextObservable.subscribe(this._subscriber);
						this._nextObservable = this._nextObservable._nextObservable;
					} else {
						this._completed = true;
						handlers.execMethod('complete', arg);
					}
				},
				closed: () => this.closed
			});
		}
		get closed() {
			return this._completed || this._cancelled;
		}
		filter(func) {
			return this.subscribe().filter(func);
		}
		map(func) {
			return this.subscribe().map(func);
		}
		concat(arg) {
			const observable = Observable.from(arg);
			if (this._nextObservable) {
				this._nextObservable.concat(observable);
			} else {
				this._nextObservable = observable;
			}
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
			if (!this._disconnectFunction) {
				return;
			}
			this._closed = true;
			this._disconnectFunction();
			delete this._disconnectFunction;
			this._subscriber;
			this._handlers.clear();
		}
		[observableSymbol]() {
			return this;
		}
		subscribe(onNext = null, onError = null, onCompleted = null) {
			this._initSubscriber();
			const isNop = [onNext, onError, onCompleted].every(f => f === null);
			const subscriber = Subscriber.create(onNext, onError, onCompleted);
			return this._subscribe({subscriber, isNop});
		}
		_subscribe({subscriber, isNop}) {
			if (!isNop && !this._disconnectFunction) {
				this._disconnectFunction = this._subscriberFunction(this._subscriber);
			}
			!isNop && this._handlers.add(subscriber);
			return new Subscription({
				observable: this,
				subscriber,
				unsubscribe: () => {
					if (isNop) { return; }
					this._handlers.remove(subscriber);
					if (this._handlers.isEmpty) {
						this.disconnect();
					}
				},
				closed: () => this.closed
			});
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
			readonly: dataStorage.readonly
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
					delete storage[storageKey];
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
		Object.keys(this.props)
			.forEach(key => {
				const val = data.hasOwnProperty(key) ? data[key] : this.default[key];
				console.log('import data: %s=%s', key, val);
				this.setValueSilently(key, val);
		});
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
		const origin = Symbol(`${namespace}`);
		const result = {
			getValue: key => this.getValue(`${namespace}${key}`),
			setValue: (key, value) => this.setValue(`${namespace}${key}`, value),
			on: (key, func) => {
				if (key === 'update') {
					const onUpdate = (key, value) => {
						if (key.startsWith(namespace)) {
							func(key.slice(namespace.length + 1), value);
						}
					};
					onUpdate[origin] = func;
					this.on('update', onUpdate);
					return result;
				}
				return this.onkey(`${namespace}${key}`, func);
			},
			off: (key, func) => {
				if (key === 'update') {
					func = func[origin] || func;
					this.off('update', func);
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
		'search.limit': 300,
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
	return DataStorage.create(
		DEFAULT_CONFIG,
		{
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
	const blob = new Blob([json], {'type': 'text/html'});
	const url = URL.createObjectURL(blob);
	const a = Object.assign(document.createElement('a'), {
		download: `${new Date().toLocaleString().replace(/[:/]/g, '_')}_ZenzaWatch.config.json`,
		rel: 'noopener',
		href: url
	});
	a.click();
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
            config.clear();
            config.import(data);
            location.reload();
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
              const reg = new RegExp(val);
              $target.addClass('update');
            } catch(err) {
              $target.addClass('error');
              //alert('正規表現にエラーがあります');
              return;
            }
            break;
          case 'wordRegFilterFlags': {
            try {
              const reg = new RegExp(/./, val);
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
