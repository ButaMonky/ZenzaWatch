/**
 * Canonical TypeScript source for packages/lib/src/infra/CrossDomainGate.js (Task784).
 * Talks to a hidden same-site loader iframe over a MessageChannel. The loader must
 * answer with this product id, gate type and token before its port is accepted.
 * Requests are sessions with a timeout/abort; a reconnect starts a new generation so
 * replies from an older connection are dropped.
 */

/**
 * Gate replies and config payloads are raw structured-clone data, and ports get
 * listeners attached; this one documented loose alias covers them.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = Record<string, any>;
type Session = Promise<unknown> & {
  resolve(value: unknown): unknown;
  reject(reason: unknown): unknown;
  command: string;
  cleanup: () => void;
};
export interface GateParams {baseUrl: string; origin?: string; type: string; suffix?: string; name?: string}
export interface GateControl {signal?: AbortSignal | undefined; timeout?: number | undefined; generation?: number}
export interface GateConfig {
  getKeys(): string[];
  props: Record<string, unknown>;
  on(name: string, callback: (key: string, value: unknown) => void): unknown;
  off(name: string, callback: (key: string, value: unknown) => void): unknown;
}

/** The part of Emitter (packages/lib/src/Emitter.js) used here. */
declare class Emitter {
  promise(name: string, callback?: unknown): Promise<unknown>;
  resetPromise(name: string): void;
  emitResolve(name: string, ...args: unknown[]): unknown;
  emitReject(name: string, ...args: unknown[]): unknown;
}
declare const PromiseHandler: new () => Session;
declare const BroadcastEmitter: {emitAsync(name: string, ...args: unknown[]): unknown};
declare const PRODUCT: string;
declare const TOKEN: string;

class CrossDomainGate extends Emitter {
  declare _baseUrl: string;
  declare _origin: string;
  declare _type: string;
  declare _suffix: string;
  declare name: string;
  declare _sessions: Record<string, Session>;
  declare _initializeStatus: string;
  declare _generation: number;
  declare _disposed: boolean;
  declare loaderFrame: HTMLIFrameElement | null | undefined;
  declare _initializeTimer: ReturnType<typeof setTimeout> | undefined;
  declare _pageHide: (() => void) | null | undefined;
  declare _initialListener: ((event: MessageEvent) => void) | null | undefined;
  declare _frameObserver: MutationObserver | null | undefined;
  declare port: MessagePort | null | undefined;
  declare _portListener: (event: MessageEvent) => void;
  declare _portError: () => void;
  declare _loaderWindow: Window | null | undefined;
  declare _config: GateConfig;
  declare _configListener: ((key: string, value: unknown) => void) | null | undefined;

  static get hostReg(): RegExp {
    return /^[a-z0-9]*\.nicovideo\.jp$/;
  }
  constructor(...args: [GateParams]) {
    super();
    this.initialize(...args);
  }
  initialize(params: GateParams): void {
    this._baseUrl = params.baseUrl;
    this._origin = params.origin || location.href;
    this._type = params.type;
    this._suffix = params.suffix || '';
    this.name = params.name || params.type;
    this._sessions = {};
    this._initializeStatus = 'none';
    this._generation = 0;
    this._disposed = false;
  }
  _initializeFrame(): Promise<unknown> {
    if (this._disposed) { return Promise.reject(new Error('Gate disposed')); }
    if (this.loaderFrame && !this.loaderFrame.parentNode) {
      this._disconnect(new Error('Gate frame removed'));
    }
    if (this._initializeStatus !== 'none') { return this.promise('initialize'); }
    this.resetPromise('initialize');
    const pending = this.promise('initialize');
    this._initializeStatus = 'initializing';
    const generation = ++this._generation;
    this._initializeTimer = setTimeout(() => {
      if (generation === this._generation) {
        this._disconnect(Object.assign(new Error('Gate initialization timeout'), {status: 'timeout'}));
      }
    }, 60000);
    if (!this._pageHide) {
      this._pageHide = () => this._disconnect(new Error('Gate page hidden'));
      window.addEventListener('pagehide', this._pageHide);
    }
    try { this._initializeCrossDomainGate(); }
    catch (error) { this._disconnect(error); }
    return pending;
  }
  _clearInitializeTimer(): void {
    if (this._initializeTimer !== undefined) { clearTimeout(this._initializeTimer); }
    this._initializeTimer = undefined;
  }
  _disconnect(error: unknown = new Error('Gate disconnected')): void {
    ++this._generation;
    this._clearInitializeTimer();
    if (this._initialListener) {
      window.removeEventListener('message', this._initialListener, {capture: true});
      this._initialListener = null;
    }
    if (this._frameObserver) { this._frameObserver.disconnect(); this._frameObserver = null; }
    if (this._initializeStatus === 'initializing') { this.emitReject('initialize', error); }
    this._initializeStatus = 'none';
    this.resetPromise('initialize');
    for (const id of Object.keys(this._sessions)) { this._settleSession(id, error); }
    if (this.port) {
      this.port.removeEventListener && this.port.removeEventListener('message', this._portListener);
      this.port.removeEventListener && this.port.removeEventListener('messageerror', this._portError);
      this.port.close && this.port.close();
    }
    this.port = null;
    this._loaderWindow = null;
    if (this.loaderFrame) { this.loaderFrame.remove(); this.loaderFrame = null; }
  }
  dispose(): void {
    this._disposed = true;
    this._disconnect(new Error('Gate disposed'));
    if (this._pageHide) { window.removeEventListener('pagehide', this._pageHide); this._pageHide = null; }
    if (this._configListener) { this._config.off('update', this._configListener); this._configListener = null; }
  }
  reconnect(): Promise<unknown> {
    this._disconnect(new Error('Gate reconnecting'));
    this._disposed = false;
    return this._initializeFrame();
  }
  _settleSession(id: string, error: unknown, result?: unknown): void {
    const session = this._sessions[id];
    if (!session) { return; }
    delete this._sessions[id];
    session.cleanup();
    if (arguments.length < 3) {
      if (session.command === 'fetch' && this.port) {
        try {
          this.port.postMessage({body: {command: 'cancelFetch', params: {sessionId: id}}, token: TOKEN});
        } catch (_) { /* The peer may already be gone. */ }
      }
      session.reject(error);
    } else { session.resolve(result); }
  }
  async _waitForInitialize(pending: Promise<unknown>, signal?: AbortSignal): Promise<unknown> {
    if (!signal) { return pending; }
    if (signal.aborted) { throw signal.reason !== undefined ? signal.reason : Object.assign(new Error('Aborted'), {name: 'AbortError'}); }
    let onAbort: (() => void) | undefined;
    try {
      return await Promise.race([pending, new Promise((resolve, reject) => {
        onAbort = () => reject(signal.reason !== undefined ? signal.reason : Object.assign(new Error('Aborted'), {name: 'AbortError'}));
        signal.addEventListener('abort', onAbort, {once: true});
      })]);
    } finally { signal.removeEventListener('abort', onAbort as () => void); }
  }
  _initializeCrossDomainGate(): void {
    // window.console.info(`%c1. CrossDomainGate open ${this.name} ${PRODUCT}`, 'background: orange; color: green; font-size: 120%');
    window.console.time(`GATE OPEN: ${this.name} ${PRODUCT}`);
    const loaderFrame = this.loaderFrame = document.createElement('iframe');
    loaderFrame.referrerPolicy = 'origin';
    (loaderFrame as unknown as Loose).sandbox = 'allow-scripts allow-same-origin';
    loaderFrame.loading = 'eager';
    loaderFrame.name = `${this._type}${PRODUCT}Loader${this._suffix ? `#${this._suffix}` : ''}`;
    loaderFrame.className = `xDomainLoaderFrame ${this._type}`;
    loaderFrame.style.cssText = `
      position: fixed; left: -100vw; pointer-events: none;user-select: none; contain: strict;`;
    (document.body || document.documentElement).append(loaderFrame);

    this._loaderWindow = loaderFrame.contentWindow;
    const generation = this._generation;
    if (typeof MutationObserver !== 'undefined') {
      this._frameObserver = new MutationObserver(() => {
        if (generation === this._generation && !loaderFrame.parentNode) {
          this._disconnect(new Error('Gate frame removed'));
        }
      });
      this._frameObserver.observe(loaderFrame.parentNode as Node, {childList: true});
    }
    const onInitialMessage = this._initialListener = (event: MessageEvent) => {
      if (generation !== this._generation || event.source !== loaderFrame.contentWindow) {
        return;
      }
      // window.console.info(`%c2. CrossDomainGate onInitialMessage [${this.name} ${PRODUCT}]`, 'background: orange; color: green; font-size: 120%');
      this._onMessage(event);
      if (this._initializeStatus === 'done') {
        window.removeEventListener('message', onInitialMessage, {capture: true});
        this._initialListener = null;
      }
    };
    window.addEventListener('message', onInitialMessage, {capture: true});
    (this._loaderWindow as Window).location.replace(this._baseUrl + '#' + TOKEN);
  }
  _onMessage(event: MessageEvent): void {
    if (this._disposed) { return; }
    let data;
    try { data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data; }
    catch (_) { return; }
    if (!data || !data.body || typeof data.body !== 'object') { return; }
    const {id, type, token, sessionId, body} = data;
    if (id !== PRODUCT || type !== this._type || token !== TOKEN) {
      // Task 088（監査v2 ZW-056）: 受け取ったトークン・自分のトークンの値はログに出さない（一致したかだけ）
      console.warn('invalid token:',
        {id, PRODUCT, type, _type: this._type, tokenMatches: token === TOKEN});
      return;
    }

    if (!this.port && body.command !== 'initialized') { return; }
    if (!this.port && body.command === 'initialized') {
      if (!event.ports || !event.ports[0]) { return; }
      const port = this.port = event.ports[0];
      const generation = this._generation;
      this._portListener = event => {
        if (generation === this._generation && this.port === port) { this._onMessage(event); }
      };
      this._portError = () => {
        if (generation === this._generation) { this._disconnect(new Error('Gate message error')); }
      };
      port.addEventListener('message', this._portListener);
      port.addEventListener('messageerror', this._portError);
      port.start();
      port.postMessage({body: {command: 'ok'}, token: TOKEN});
      // window.console.info(`%c3. CrossDomainGate MessageChannel OK [${this.name} ${PRODUCT}]`, 'background: orange; color: green; font-size: 120%');
    }
    return this._onCommand(body, sessionId);
  }
  _onCommand({command, status, params}: Loose, sessionId: string | null = null): void {
    switch (command) {
      case 'initialized':
        if (this._initializeStatus !== 'done') {
          this._initializeStatus = 'done';
          this._clearInitializeTimer();
          const originalBody = params;
          window.console.timeEnd(`GATE OPEN: ${this.name} ${PRODUCT}`);
          const result = originalBody && this._onCommand(originalBody, sessionId);
          this.emitResolve('initialize', {status: 'ok'});
          // window.console.info(`%c4. CrossDomainGate init OK [${this.name} ${PRODUCT}]`, 'background: orange; color: green; font-size: 120%');
          return result;
        }
        break;

      case 'message':
        BroadcastEmitter.emitAsync('message', params, 'broadcast', sessionId);
        break;

      default: {
        const session = this._sessions[sessionId as string];
        if (!session) {
          return;
        }
        if (status === 'ok') {
          this._settleSession(sessionId as string, null, params);
        } else {
          this._settleSession(sessionId as string, {message: status || 'fail'});
        }

      }
        break;
    }
  }
  /**
   * @deprecated fetch使え
   * @param {string} url
   * @param {object} options
   */
  load(url: string, options?: unknown): Promise<unknown> {
    return this._postMessage({command: 'loadUrl', params: {url, options}});
  }
  videoCapture(src: string, sec: number): Promise<unknown> {
    return this._postMessage({command: 'videoCapture', params: {src, sec}})
      .then(result => Promise.resolve((result as Loose).dataUrl));
  }
  _fetch(url: string, options: Loose = {}): Promise<unknown> {
    const {signal, ...transferOptions} = options;
    return this._postMessage({command: 'fetch', params: {url, options: transferOptions}}, true, '',
      {signal, timeout: options.timeout});
  }
  async fetch(resource: string | URL | Request, options: Loose = {}): Promise<unknown> {
    options = {...options};
    let url = resource;
    if (resource instanceof URL) {
      url = resource.toString();
    } else if (resource instanceof Request) {
      url = resource.url;
      options.method ??= resource.method;
      options.headers ??= resource.headers;
      options.body ??= resource.body;
      options.credentials ??= resource.credentials;
      options.signal ??= resource.signal;
    }
    const result = await this._fetch(url as string, options) as Loose;
    if (typeof result === 'string' || !result.buffer || !result.init || !result.headers) {
      return result;
    }
    const {buffer, init, headers} = result;
    const _headers = new Headers();
    (headers || []).forEach((a: [string, string]) => _headers.append(...a));
    const _init = {
      status: init.status,
      statusText: init.statusText || '',
      headers: _headers
    };
    if (options._format === 'arraybuffer') {
      return {buffer, init, headers};
    }
    return new Response(buffer, _init);
  }
  async configBridge(config: GateConfig): Promise<void> {
    const keys = config.getKeys();
    if (this._configListener) { this._config.off('update', this._configListener); this._configListener = null; }
    this._config = config;
    const configData = await this._postMessage({
      command: 'dumpConfig',
      params: { keys, url: '', prefix: PRODUCT }
    }) as Loose;
    for (const key of Object.keys(configData)) {
      config.props[key] = configData[key];
    }
    if (!(this.constructor as typeof CrossDomainGate).hostReg.test(location.host) &&
      !config.props.allowOtherDomain) {
      return;
    }
    if (this._disposed) { return; }
    this._configListener = (key, value) => {
      if (key === 'autoCloseFullScreen') {
        return;
      }

      this._postMessage({command: 'saveConfig', params: {key, value, prefix: PRODUCT}}, false).catch(() => {});
    };
    config.on('update', this._configListener);
  }
  async _postMessage(body: Loose, usePromise = true, sessionId = '', control: GateControl = {}): Promise<unknown> {
    const {signal} = control;
    const abortReason = () => (signal as AbortSignal).reason !== undefined ? (signal as AbortSignal).reason :
      Object.assign(new Error('Aborted'), {name: 'AbortError'});
    if (signal && signal.aborted) { throw abortReason(); }
    const pending = this._initializeFrame();
    const generation = this._generation;
    await this._waitForInitialize(pending, signal);
    if (signal && signal.aborted) { throw abortReason(); }
    if (this._disposed || generation !== this._generation ||
        (control.generation !== undefined && control.generation !== generation)) {
      throw new Error('Gate disconnected before send');
    }
    sessionId = sessionId || (`gate:${Math.random()}`);
    const params = body.params || {};
    if (!usePromise) {
      (this.port as MessagePort).postMessage({body, sessionId, token: TOKEN}, params.transfer);
      return;
    }
    if (this._sessions[sessionId]) { throw new Error('Duplicate gate session'); }
    const session = new PromiseHandler();
    const timeout = Number.isFinite(control.timeout) && (control.timeout as number) > 0 ?
      Math.min((control.timeout as number) + 1000, 2147483647) : 60000;
    const timer = setTimeout(() => this._settleSession(sessionId,
      Object.assign(new Error('Gate request timeout'), {status: 'timeout'})), timeout);
    const onAbort = () => this._settleSession(sessionId, abortReason());
    session.command = body.command;
    session.cleanup = () => {
      clearTimeout(timer);
      if (signal) { signal.removeEventListener('abort', onAbort); }
    };
    this._sessions[sessionId] = session;
    if (signal) { signal.addEventListener('abort', onAbort, {once: true}); }
    try { (this.port as MessagePort).postMessage({body, sessionId, token: TOKEN}, params.transfer); }
    catch (error) { this._settleSession(sessionId, error); }
    const result = await session;
    if (this._disposed || generation !== this._generation) { throw new Error('Gate disconnected after reply'); }
    return result;
  }
  postMessage(body: Loose, promise = true): Promise<unknown> {
    return this._postMessage(body, promise);
  }
  /**
   * @param {MessageBody} body
   * @param {boolean} usePromise
   * @param {string?} sessionId
   */
  sendMessage(body: unknown, usePromise = false, sessionId = ''): Promise<unknown> {
    return this._postMessage({command: 'message', params: body}, usePromise, sessionId);
  }
  pushHistory(path: string, title?: string): Promise<unknown> {
    return this._postMessage({command: 'pushHistory', params: {path, title}}, false);
  }
  async bridgeDb({name, ver, stores}: {name: string; ver?: number; stores: Array<{name: string}>}): Promise<Loose> {
    const worker = await this._postMessage(
      {command: 'bridge-db', params: {command: 'open', params: {name, ver, stores}}}
    );
    let dbGeneration = this._generation;
    let reopening: {generation: number; promise: Promise<void>} | null | undefined;
    const post = async (command: string, data: unknown, storeName: string, transfer?: unknown) => {
      await this._initializeFrame();
      const generation = this._generation;
      if (dbGeneration !== generation) {
        if (!reopening || reopening.generation !== generation) {
          const promise = this._postMessage(
            {command: 'bridge-db', params: {command: 'open', params: {name, ver, stores}}},
            true, '', {generation}
          ).then(() => { dbGeneration = generation; });
          reopening = {generation, promise};
          promise.catch(() => { if (reopening && reopening.promise === promise) { reopening = null; } });
        }
        await (reopening as {promise: Promise<void>}).promise;
      }
      const params = {data, storeName, transfer, name};
      return this._postMessage({command: 'bridge-db', params: {command, params, transfer}}, true, '', {generation});
    };
    const result: Loose = {worker};
    for (const meta of stores) {
      const storeName = meta.name;
      result[storeName] = (storeName => {
        return {
          close: (params?: unknown) => post('close', params, storeName),
          put: (record: unknown, transfer?: unknown) => post('put', record, storeName, transfer),
          update: (data: unknown) => post('update', data, storeName),
          get: ({key, index, timeout}: Loose) => post('get', {key, index, timeout}, storeName),
          updateTime: ({key, index, timeout}: Loose) => post('updateTime', {key, index, timeout}, storeName),
          delete: ({key, index, timeout}: Loose) => post('delete', {key, index, timeout}, storeName),
          gc: (expireTime = 30 * 24 * 60 * 60 * 1000, index = 'updatedAt') => post('gc', {expireTime, index}, storeName)
        };
      })(storeName);
    }
    return result;
  }
}

export {CrossDomainGate};
