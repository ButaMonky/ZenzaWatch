// ==UserScript==
// @name        CapTube
// @namespace   https://github.com/segabito/
// @description "S"キーでYouTubeのスクリーンショット保存
// @include     https://www.youtube.com/*
// @include     https://www.youtube.com/embed/*
// @include     https://youtube.com/*
// @version     0.0.16-task301
// @grant       none
// @license     public domain
// @homepageURL    https://github.com/ButaMonky/ZenzaWatch
// @supportURL     https://github.com/ButaMonky/ZenzaWatch/issues
// @downloadURL    https://github.com/ButaMonky/ZenzaWatch/raw/develop/dist/CapTube.user.js
// @updateURL      https://github.com/ButaMonky/ZenzaWatch/raw/develop/dist/CapTube.user.js
// ==/UserScript==
// build: 2026-10-08 00:05Z 5266732
/* eslint-disable */


(() => {
  const PRODUCT = 'CapTube';
  const global = {PRODUCT};
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
			if (!CSS || !('paintWorklet' in CSS)) { return; }
			if (this.modules.has(func)) { return this.modules.get(func); }
			const pending = (async () => {
				let url;
				try {
					const src = `(${func.toString()})(this, registerPaint,
						${JSON.stringify(options.config || {}, null, 2)});`;
					const blob = new Blob([src], {type: 'text/javascript'});
					url = URL.createObjectURL(blob);
					await CSS.paintWorklet.addModule(url);
					return true;
				} finally {
					if (url !== undefined) { URL.revokeObjectURL(url); }
				}
			})();
			this.modules.set(func, pending);
			try { return await pending; }
			catch (error) { this.modules.delete(func); throw error; }
		}.bind({modules: new WeakMap}),
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
const workerUtil = (() => {
	let config, TOKEN, PRODUCT = 'ZenzaWatch?', netUtil, CONSTANT, NAME = '';
	let global = null, external = null;
	const DEFAULT_REQUEST_TIMEOUT = 5 * 60 * 1000;
	const isAvailable = !!(window.Blob && window.Worker && window.URL);
	const messageWrapper = function(self) {
		const _onmessage = self.onmessage || (() => {});
		const promises = {};
		let requestSeq = 0;
		const onMessage = async function(self, type, e) {
			const {body, sessionId, status} = e.data;
			const {command, params} = body;
			try {
				let result;
				switch (command) {
					case 'commandResult':
						if (promises[sessionId]) {
							if (status === 'ok') {
								promises[sessionId].resolve(params.result);
							} else {
								promises[sessionId].reject(new Error(params.result));
							}
							delete promises[sessionId];
						}
					return;
					case 'ping':
						result = {now: Date.now(), NAME, PID, url: location.href};
						break;
					case 'port': {
						const port = e.ports[0];
						portMap[params.name] = port;
						port.addEventListener('message', onMessage.bind({}, port, params.name));
						port.start && port.start();
						bindFunc(port, 'MessageChannel');
						result = {name: params.name};
						if (params.ping) {
							console.time('ping:' + sessionId);
							port.ping().then(result => {
								console.timeEnd('ping:' + sessionId);
								console.log('ok %smec', Date.now() - params.now, params);
							}).catch(err => {
								console.timeEnd('ping:' + sessionId);
								console.warn('ping fail', {err, data: e.data});
							});
						}
					}
						break;
					case 'broadcast': {
						if (!BroadcastChannel) { return; }
						const channel = new BroadcastChannel(`${params.name}`);
						channel.addEventListener('message', onMessage.bind({}, channel, 'BroadcastChannel'));
						bindFunc(channel, 'BroadcastChannel');
						bcast[params.basename] = channel;
					}
						return;
					case 'env':
						({config, TOKEN, PRODUCT, CONSTANT} = params);
						return;
					default:
						result = await _onmessage({command, params}, type, PID);
						break;
					}
				if (sessionId === undefined || sessionId === null) { return; }
				self.postMessage({body:
					{command: 'commandResult', params:
						{command, result}}, sessionId, TYPE: type, PID, status: 'ok'
					});
			} catch(err) {
				console.error('failed', {err, command, params, sessionId, TYPE: type, PID, data: e.data});
				if (sessionId === undefined || sessionId === null) { return; }
				self.postMessage({body:
						{command: 'commandResult', params: {command, result: err.message || null}},
						sessionId, TYPE: type, PID, status: err.status || 'fail'
					});
			}
		};
		self.onmessage = onMessage.bind({}, self, self.name);
		self.onconnect = e => {
			const port = e.ports[0];
			port.onmessage = self.onmessage;
			port.start();
		};
		const bindFunc = (self, type = 'Worker') => {
			const post = function(self, body, options = {}) {
				const sessionId = `recv:${NAME}:${type}:${requestSeq++}`;
				return new Promise((resolve, reject) => {
					promises[sessionId] = {resolve, reject};
					self.postMessage({body, sessionId, PID}, options.transfer);
					if (typeof options.timeout === 'number') {
						setTimeout(() => {
							reject({status: 'fail', message: 'timeout'});
							delete promises[sessionId];
						}, options.timeout);
					}
				}).finally(() => { delete promises[sessionId]; });
			};
			const emit = function(self, eventName, data = null) {
				self.post({command: 'emit', params: {eventName, data}});
			};
			const notify = function(self, message) {
				self.post({command: 'notify', params: {message}});
			};
			const alert = function(self, message) {
				self.post({command: 'alert', params: {message}});
			};
			const ping = async function(self, options = {}) {
				const timekey = `PING "${self.name}"`;
				console.log(timekey);
				let result;
				options.timeout = options.timeout || 10000;
				try {
					console.time(timekey);
					result = await self.post({command: 'ping', params: {now: Date.now(), NAME, PID, url: location.href}}, options);
					console.timeEnd(timekey);
				} catch (e) {
					console.timeEnd(timekey);
					console.warn('ping fail', e);
				}
				return result;
			};
			self.post = post.bind({sessionId: 0}, this.port || self);
			self.emit = emit.bind({}, self);
			self.notify = notify.bind({}, self);
			self.alert = alert.bind({}, self);
			self.ping = ping.bind({}, self);
			return self;
		};
		bindFunc(self);
		self.xFetch = async (url, options = {}) => {
			options = {...options, ...{signal: null}}; // remove AbortController
			if (url.startsWith(location.origin)) {
				return fetch(url, options);
			}
			const result = await self.post({command: 'fetch', params: {url, options}});
			const {buffer, init, headers} = result;
			const _headers = new Headers();
			(headers || []).forEach(a => _headers.append(...a));
			const _init = {
				status: init.status,
				statusText: init.statusText || '',
				headers: _headers
			};
			return new Response(buffer, _init);
		};
	};
	const workerUtil = {
		isAvailable,
		js: (q, ...args) => {
			const strargs = args.map(a => typeof a === 'string' ? a : a.toString);
			return String.raw(q, ...strargs);
		},
		env: params => {
			({config, TOKEN, PRODUCT, netUtil, CONSTANT, global} =
				Object.assign({config, TOKEN, PRODUCT, netUtil, CONSTANT, global}, params));
			if (global) { ({config, TOKEN, PRODUCT, CONSTANT} = global); }
		},
		create: function(func, options = {}) {
			let cache = this.urlMap.get(func);
			const name = options.name || 'Worker';
			if (!cache) {
				const pid = `${window && window.name || 'self'}:${location.href}:${name}:${Date.now().toString(16).toUpperCase()}`;
				const src = `
				const PID = ${JSON.stringify(pid)};
				console.log('%cinit %s %s', 'font-weight: bold;', self.name || '', ${JSON.stringify(String(PRODUCT))}, location.origin);
				(${func.toString()})(self);
				`;
				const blob = new Blob([src], {type: 'text/javascript'});
				const url = URL.createObjectURL(blob);
				this.urlMap.set(func, url);
				cache = url;
			}
			if (options.type === 'SharedWorker') {
				const w = this.workerMap.get(func) || new SharedWorker(cache);
				this.workerMap.set(func, w);
				return w;
			}
			return new Worker(cache, options);
		}.bind({urlMap: new Map(), workerMap: new Map()}),
		createCrossMessageWorker: function(func, options = {}) {
			const promises = {};
			const instanceId = this.instanceSeq++;
			let requestSeq = 0;
			const name = options.name || 'Worker';
			let state = 'starting';
			const requestTimeout = typeof options.requestTimeout === 'number' ? options.requestTimeout : DEFAULT_REQUEST_TIMEOUT;
			const rpcError = (reason, message) =>
				Object.assign(new Error(message || reason), {name: 'WorkerRpcError', status: 'fail', reason, workerName: name});
			const rejectAll = (reason, message) => {
				for (const id of Object.keys(promises)) {
					const p = promises[id];
					delete promises[id];
					p.reject(rpcError(reason, message));
				}
			};
			const closables = [];
			const PID = `${window && window.name || 'self'}:${location.host}:${name}:${Date.now().toString(16).toUpperCase()}`;
			const _func = `
			function (self) {
			let config = {}, PRODUCT, TOKEN, CONSTANT, NAME = ${JSON.stringify(String(name))}, bcast = {}, portMap = {};
			const {Handler, PromiseHandler, Emitter} = (${EmitterInitFunc.toString()})();
			${options.inject ?? ''}
			(${func.toString()})(self);
			//===================================
			(${messageWrapper.toString()})(self);
			}
			`;
			const worker = workerUtil.create(_func, options);
			const self = options.type === 'SharedWorker' ? worker.port : worker;
			self.name = name;
			const onMessage = async function(self, e) {
				if (state === 'disposed') { return; }
				if (state === 'starting' || state === 'failed') { state = 'ready'; }
				const {body, sessionId, status} = e.data;
				const {command, params} = body;
				try {
					let result = 'ok';
					let transfer = null;
					switch (command) {
						case 'commandResult':
							if (promises[sessionId]) {
								if (status === 'ok') {
									promises[sessionId].resolve(params.result);
								} else {
									promises[sessionId].reject(new Error(params.result));
								}
								delete promises[sessionId];
							}
							return;
						case 'ping':
								result = {now: Date.now(), NAME, PID, url: location.href};
								console.timeLog && console.timeLog(params.NAME, 'PONG');
								break;
						case 'emit':
							global && global.emitter.emitAsync(params.eventName, params.data);
							break;
						case 'fetch':
							result = await (netUtil || window).fetch(params.url,
								Object.assign({}, params.options || {}, {_format: 'arraybuffer'}));
							transfer = [result.buffer];
							break;
						case 'notify':
							global && global.notify(params.message);
							break;
						case 'alert':
							global && global.alert(params.message);
							break;
						default:
							self.oncommand && (result = await self.oncommand({command, params}));
							break;
					}
					if (sessionId === undefined || sessionId === null) { return; }
					self.postMessage({body: {command: 'commandResult', params: {command, result}}, sessionId, status: 'ok'}, transfer);
				} catch (err) {
					console.error('failed', {err, command, params, sessionId});
					if (sessionId === undefined || sessionId === null) { return; }
					self.postMessage({body: {command: 'commandResult', params: {command, result: err.message || null}}, sessionId, status: err.status || 'fail'});
				}
			};
			const bindFunc = (self, type = 'Worker') => {
				const post = function(self, body, options = {}) {
					if (state === 'failed' || state === 'disposed') {
						return Promise.reject(rpcError(state === 'failed' ? 'failed' : 'terminated', `worker ${state}: ${name}`));
					}
					const sessionId = `send:${instanceId}:${name}:${type}:${requestSeq++}`;
					const timeout = typeof options.timeout === 'number' ? options.timeout : requestTimeout;
					let timer = null;
					return new Promise((resolve, reject) => {
							promises[sessionId] = {resolve, reject};
							self.postMessage({body, sessionId, TYPE: type, PID}, options.transfer);
							if (timeout > 0 && timeout < Infinity) {
								timer = setTimeout(() => {
									if (!promises[sessionId]) { return; }
									delete promises[sessionId];
									reject(rpcError('timeout', 'timeout'));
								}, timeout);
							}
						}).finally(() => {
							timer && clearTimeout(timer);
							delete promises[sessionId];
						});
				};
				const ping = async function(self, options = {}) {
					const timekey = `PING "${self.name}" total time`;
					window.console.log(`PING "${self.name}"...`);
					let result;
					options.timeout = options.timeout || 10000;
					try {
					window.console.time(timekey);
					result = await self.post({command: 'ping', params: {now: Date.now(), NAME: self.name, PID, url: location.href}}, options);
					window.console.timeEnd(timekey);
					} catch (e) {
						console.timeEnd(timekey);
						console.warn('ping fail', e);
					}
					return result;
				};
				self.post = post.bind({sessionId: 0}, self);
				self.send = (body, transfer) => self.postMessage({body, TYPE: type, PID}, transfer);
				self.ping = ping.bind({}, self);
				self.addEventListener('message', onMessage.bind({sessionId: 0}, self));
				self.addEventListener('messageerror', () => state !== 'disposed' && rejectAll('messageerror', `messageerror: ${name}`));
				self.start && self.start();
			};
			bindFunc(self);
			worker.addEventListener('error', e => {
				if (state === 'disposed') { return; }
				if (state === 'starting') { state = 'failed'; }
				rejectAll(state === 'failed' ? 'failed' : 'error', (e && e.message) || `worker error: ${name}`);
			});
			if (self === worker && typeof worker.terminate === 'function') {
				const terminate = worker.terminate.bind(worker);
				self.terminate = () => {
					if (state === 'disposed') { return; }
					state = 'disposed';
					rejectAll('terminated', `worker terminated: ${name}`);
					for (const c of closables.splice(0)) {
						try { c.close(); } catch (e) { /* 閉じられなくても続ける */ }
					}
					terminate();
				};
			}
			self.getRpcState = () => ({id: instanceId, name, state, pending: Object.keys(promises).length});
			if (config) {
				self.send({
					command: 'env',
					params: {config: config.export(true), TOKEN, PRODUCT, CONSTANT}
				});
			}
			self.addPort = (port, options = {}) => {
				const name = options.name || 'MessageChannel';
				return self.post({command: 'port', params: {port, name}}, {transfer: [port]});
			};
			const channel = new MessageChannel();
			self.addPort(channel.port2).catch(() => {});
			bindFunc(channel.port1, 'MessageChannel');
			closables.push(channel.port1);
			self.bridge = async (worker, options = {}) => {
				const name = options.name || 'MessageChannelBridge';
				const channel = new MessageChannel();
				await self.addPort(channel.port1, {name: worker.name || name});
				await worker.addPort(channel.port2, {name: self.name || name});
			};
			self.BroadcastChannel = basename => {
				const name = `${basename || 'Broadcast'}${TOKEN || Date.now().toString(16)}`;
				self.send({command: 'broadcast', params: {basename, name}});
				const channel = new BroadcastChannel(name);
				bindFunc(channel, 'BroadcastChannel');
				closables.push(channel);
				return name;
			};
			self.ping()
				.catch(result => console.warn('FAIL', result));
			return self;
		}.bind({
			instanceSeq: 0
		})
	};
	return workerUtil;
})();
  let previewContainer = null, meterContainer = null;

  const callOnIdle = func => {
    if (window.requestIdleCallback) {
      window.requestIdleCallback(func);
    } else {
      setTimeout(func, 0);
    }
  };

  const DataUrlConv = (() => {
    const func = function(self) {

      let canvas, ctx;
      const initCanvas = () => {
        if (canvas) { return; }
        canvas =
          ('OffscreenCanvas' in self) ?
            new OffscreenCanvas(100, 100) : document.createElement('canvas');
        ctx = canvas.getContext('2d', {alpha: false, desynchronized: true});
      };

      const fromBitmap = async ({bitmap, type, quality}) => {
        type = type || 'image/png';
        quality = quality || 1;
        initCanvas();
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        console.time('bitmap to ObjectURL');
        ctx.drawImage(bitmap, 0, 0);
        const blob = canvas.convertToBlob ?
          (await canvas.convertToBlob({type, quality})) :
          (await fetch(canvas.toDataURL(type, quality)).then(response => response.blob()));
        const url = URL.createObjectURL(blob);
        console.timeEnd('bitmap to ObjectURL');
        setTimeout(() => URL.revokeObjectURL(url), 60 * 1000);
        return {url};
      };

      const fromDataURL = async ({dataURL}) => {
        console.time('dataURL to objectURL');
        const blob = await fetch(dataURL).then(r => r.blob());
        const url = URL.createObjectURL(blob);
        console.timeEnd('dataURL to objectURL');
        setTimeout(() => URL.revokeObjectURL(url), 60 * 1000);
        return {url};
      };

      self.onmessage = async ({command, params}) => {
        switch (command) {
          case 'fromBitmap':
            return fromBitmap(params);
          case 'fromDataURL':
            return fromDataURL(params);
        }
      };
    };

    let worker;

    return {
      fromBitmap: (bitmap) => {
        worker = worker || workerUtil.createCrossMessageWorker(func);
        return worker.post({
            command: 'fromBitmap',
            params: {bitmap}
          },
          {transfer: [bitmap]}
        );
      },
      fromDataURL: (dataURL) => {
        worker = worker || workerUtil.createCrossMessageWorker(func);
        return worker.post({
            command: 'fromDataURL',
            params: {dataURL}
          }
        );
        // return new Promise(resolve => {
        //   const sessionId = 'id:' + Math.random();
        //   sessions[sessionId] = resolve;
        //   worker.postMessage({dataURL, sessionId});
        // });
      }
    };
  })();


  const __css__ = (`
    #CapTubePreviewContainer {
      position: fixed;
      padding: 16px 0 0 16px;
      width: 90%;
      bottom: 100px;
      left: 5%;
      z-index: 10000;
      pointer-events: none;
      transform: translateZ(0);
      /*background: rgba(192, 192, 192, 0.4);*/
      border: 1px solid #ccc;
      -webkit-user-select: none;
      user-select: none;
    }

    #CapTubePreviewContainer:empty {
      display: none;
    }
      #CapTubePreviewContainer canvas {
        display: inline-block;
        width: 256px;
        margin-right: 16px;
        margin-bottom: 16px;
        outline: solid 1px #ccc;
        outline-offset: 4px;
        transform: translateZ(0);
        transition:
          1s opacity      linear,
          1s margin-right linear;
      }

      #CapTubePreviewContainer canvas.is-removing {
        opacity: 0;
        margin-right: -272px;
        /*width: 0;*/
      }

    #CapTubeMeterContainer {
      pointer-events: none;
      position: fixed;
      width: 26px;
      bottom: 100px;
      left: 16px;
      z-index: 10000;
      border: 1px solid #ccc;
      transform: translateZ(0);
      -webkit-user-select: none;
      user-select: none;
     }

     #CapTubeMeterContainer::after {
       content: 'queue';
       position: absolute;
       bottom: -2px;
       left: 50%;
       transform: translate(-50%, 100%);
       color: #666;
     }

    #CapTubeMeterContainer:empty {
      display: none;
    }

      #CapTubeMeterContainer .memory {
        display: block;
        width: 24px;
        height: 8px;
        margin: 1px 0 0;
        background: darkgreen;
        opacity: 0.5;
        border: 1px solid #ccc;
      }

  `).trim();

  cssUtil.addStyle(__css__);

  const getVideoId = () => {
    let id = '';
    location.search.substring(1).split('&').forEach(item => {
      if (item.split('=')[0] === 'v') { id = item.split('=')[1]; }
    });
    return id;
  };

  const toSafeName = text => {
    return text.trim()
      .replace(/</g, '＜')
      .replace(/>/g, '＞')
      .replace(/\?/g, '？')
      .replace(/:/g, '：')
      .replace(/\|/g, '｜')
      .replace(/\//g, '／')
      .replace(/\\/g, '￥')
      .replace(/"/g, '”')
      .replace(/\./g, '．')
      ;
  };

  const getVideoTitle = (params = {}) => {
    const prefix = localStorage['CapTube-prefix']  || '';
    const videoId = params.videoId || getVideoId();
    const title = document.querySelector('.title yt-formatted-string') || document.querySelector('.watch-title') || {textContent: document.title};
    const authorName = toSafeName(
      params.author || document.querySelector('#owner-container yt-formatted-string').textContent || '');
    let titleText = toSafeName(params.title || title.textContent);
    titleText = `${prefix}${titleText} - by ${authorName} (v=${videoId})`;

    return titleText;
  };

  const createCanvasFromVideo = video => {
    console.time('createCanvasFromVideo');
    const width = video.videoWidth;
    const height = video.videoHeight;
    const {canvas, ctx} = getTransferCanvas();
    canvas.width = width;
    canvas.height = height;
    ctx.drawImage(video, 0, 0);
    const bitmap = ('transferToImageBitmap' in canvas) ?
     canvas.transferToImageBitmap() : null;


    const thumbnail = document.createElement('canvas');
    thumbnail.width = 256;
    thumbnail.height = canvas.height * (256 / canvas.width);
    thumbnail.getContext('2d', {alpha: false, desynchronized: true})
      .drawImage(bitmap || canvas, 0, 0, thumbnail.width, thumbnail.height);
    console.timeEnd('createCanvasFromVideo');

    return {canvas, thumbnail, bitmap};
  };

  const getFileName = (video, params = {}) => {
    const title = getVideoTitle(params);
    const currentTime = video.currentTime;
    const min = Math.floor(currentTime / 60);
    const sec = (currentTime % 60 + 100).toString().substr(1, 6);
    const time = `${min}_${sec}`;

    return `${title}@${time}.png`;
  };

  const createBlobLinkElementAsync = async (canvas, fileName, bitmap) => {
    let url;
    if (bitmap) {
      ({url} = await DataUrlConv.fromBitmap(bitmap));
    } else {
      console.time('canvas to DataURL');
      const dataURL = canvas.toDataURL('image/png');
      console.timeEnd('canvas to DataURL');

      ({url} = await DataUrlConv.fromDataURL(dataURL));
    }
    return Object.assign(document.createElement('a'), {
      download: fileName, href: url
    });
   };

  const saveScreenShot = (params = {}) => {
    const video = document.querySelector('.html5-main-video');
    if (!video) { return; }

    const meter = document.createElement('div');
    if (meterContainer) {
      meter.className = 'memory';
      meterContainer.append(meter);
    }

    const {canvas, thumbnail, bitmap} = createCanvasFromVideo(video);
    const fileName = getFileName(video, params);

    createBlobLinkElementAsync(canvas, fileName, bitmap).then(link => {
      document.body.append(link);
      link.click();
      setTimeout(() => {
        link.remove();
        meter.remove();
        URL.revokeObjectURL(link.href);
      }, 1000);
    });

    if (!previewContainer) { return; }
    previewContainer.append(thumbnail);
    setTimeout(() => {
      thumbnail.classList.add('is-removing');
      setTimeout(() => { thumbnail.remove(); }, 2000);
    }, 1500);
  };

  const getThumbnailDataURL = async (width, height, type) => {
    const video = document.querySelector('.html5-main-video');
    if (!video) { return; }
    const canvas = document.createElement('canvas');
    const scale = Math.min(width / video.videoWidth, height / video.videoHeight);
    const dw = video.videoWidth * scale;
    const dh = video.videoHeight * scale;
    canvas.width = dw;
    canvas.height = dh;
    canvas
      .getContext('2d', {alpha: false, desynchronized: true})
      .drawImage(video, 0, 0, dw, dh);
    return canvas.toDataURL(type);
  };

  const setPlaybackRate = v => {
    const video = document.querySelector('.html5-main-video');
    if (!video) { return; }
    video.playbackRate = v;
  };

  const togglePlay = () => {
    const video = document.querySelector('.html5-main-video');
    if (!video) { return; }

    if (video.paused) {
      video.play();
    } else {
      video.pause();
    }
  };

  const seekBy = v => {
    const video = document.querySelector('.html5-main-video');
    if (!video) { return; }

    const ct = Math.max(video.currentTime + v, 0);
    video.currentTime = ct;
  };

  let isVerySlow = false;
  const onKeyDown = e => {
    const key = e.key.toLowerCase();
    switch (key) {
      case 'd':
        setPlaybackRate(0.1);
        isVerySlow = true;
        break;
      case 's':
        saveScreenShot({});
        break;
    }
  };

  const onKeyUp = e => {
    //console.log('onKeyUp', e);
    const key = e.key.toLowerCase();
    switch (key) {
      case 'd':
        setPlaybackRate(1);
        isVerySlow = false;
        break;
    }
  };

  const onKeyPress = e => {
    const key = e.key.toLowerCase();
    switch (key) {
      case 'w':
        togglePlay();
        break;
      case 'a':
        seekBy(isVerySlow ? -0.5 : -5);
        break;
    }
  };

  const getTransferCanvas = function(width = 640, height = 480) {
    const canvas = this.canvas = this.canvas ||
      ('OffscreenCanvas' in self) ?
        new OffscreenCanvas(width, height) :
        Object.assign(document.createElement('canvas'), {width, height});
    const ctx = this.ctx =
      this.ctx || this.canvas.getContext('2d', {alpha: false, desynchronized: true});
    return {canvas, ctx};
  }.bind({canvas: null, ctx: null});

  const initDom = () => {
    const div = document.createElement('div');
    div.id = 'CapTubePreviewContainer';
    previewContainer = div;

    meterContainer = document.createElement('div');
    meterContainer.id = 'CapTubeMeterContainer';
    document.body.append(div, meterContainer);
   };

  const HOST_REG = /^[a-z0-9]*\.nicovideo\.jp$/;

  const parseUrl = url => Object.assign(document.createElement('a'), {href: url});

  const initialize = () => {
    initDom();

    window.addEventListener('keydown',  onKeyDown);
    window.addEventListener('keyup',    onKeyUp);
    window.addEventListener('keypress', onKeyPress);
  };

  const initializeEmbed = () => {
    const parentHost = parseUrl(document.referrer).hostname;
    if (!HOST_REG.test(parentHost)) {
      window.console.log('disable bridge');
      return;
    }
    const origin = document.referrer;
    console.log('%cinit embed CapTube', 'background: lightgreen;');
    window.addEventListener('message', e =>  {
      if (!HOST_REG.test(parseUrl(e.origin).hostname)) { return; }
      const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
      const {body, sessionId} = data;
      const {command, params} = body;

      switch (command || data.command) {
        case 'capTube': {
          const {title, videoId, author} = (params || data);
          saveScreenShot({ title, videoId, author });
        }
          break;
        case 'capTubeThumbnail':{
          const url = getThumbnailDataURL(params);
          const body = {
            command: 'commandResult',
            status: 'ok',
            params: {url}
          };
          const msg = {id: PRODUCT, sessionId, body};
          parent.postMessage(msg, origin);
        }
          break;
      }
    });

  };

  if (window.top !== window && location.pathname.indexOf('/embed/') === 0) {
    initializeEmbed();
  } else {
    initialize();
  }
})();
