/**
 * Canonical TypeScript source for packages/lib/src/message/gate.js (Task789).
 * Runs inside the cross-domain loader iframe: it opens a MessageChannel to the
 * parent window and proxies whitelisted fetches.
 */
/** Message posted to the parent / over the port. */
export interface GateMessage {id: string; type: string | null; token: string | null; url: string; sessionId: string; body: unknown}
export interface GatePostOptions {type?: string | null | undefined; token?: string | null | undefined;
  sessionId?: string | null | undefined; origin?: string | null | undefined}
type GateState = {channel: MessageChannel | null; port: MessagePort | null; origin: string | null; token: string | null; type: string | null};
export type GateFetchOptions = RequestInit & {timeout?: number};
export interface GateFetchParams {url: string; options?: GateFetchOptions; timeout?: number}
export interface GateFailure {status: string; message: string}
/** Result of xFetch: the response body and the parts of Response needed to rebuild it. */
export interface GateFetchResult {status: 'ok'; command: 'fetch'; params: {buffer: ArrayBuffer; init: Record<string, unknown>; headers: [string, string][]}}

/** The constant from the preamble and the part of workerUtil used here. */
declare const PRODUCT: string;
declare const workerUtil: {env(params: Record<string, unknown>): void} | undefined;

const gate = () => {

  const post = function(this: GateState, body: unknown, {type, token, sessionId, origin}: GatePostOptions = {}) {
    sessionId = sessionId || '';
    origin = origin || '';
    this.origin = origin = origin || this.origin || document.referrer;
    this.token = token = token || this.token;
    this.type = type = type || this.type;
    if (!this.channel) {
      this.channel = new MessageChannel;
    }
    const url = location.href;
    const id = PRODUCT;
    try {
      const msg: GateMessage = {id, type, token, url, sessionId, body};
      if (!this.port) {
        // console.info(`%c2. port connect [${window.name.split('#')[0]} ${PRODUCT}]`, 'background: #039393; color: gold; font-size: 120%;');
        msg.body = {command: 'initialized', params: msg.body};
        parent.postMessage(msg, origin, [this.channel.port2]);
        this.port = this.channel.port1;
        this.port.start();
      } else {
        this.port.postMessage(msg);
      }
    } catch (e) {
      console.error('%cError: parent.postMessage - ', 'color: red; background: yellow', e);
    }
    return this.port as MessagePort;
  }.bind({channel: null, port: null, origin: null, token: null, type: null});

  const parseUrl = (url?: string | null) => {
    url = url || 'https://unknown.example.com/';
    const a = document.createElement('a');
    a.href = url;
    return a;
  };

  const isNicoServiceHost = (url?: string | null) => {
    const host = parseUrl(url).hostname;
    return /(^[a-z0-9.-]*\.nicovideo\.jp$|^[a-z0-9.-]*\.nico(|:[0-9]+)$)/.test(host);
  };

  const isWhiteHost = (url?: string | null) => {
    const u = parseUrl(url);
    const host = u.hostname;
    if (['account.nicovideo.jp', 'point.nicovideo.jp'].includes(host)) {
      return false;
    }
    if (isNicoServiceHost(url)) {
      return true;
    }
    if (['localhost', '127.0.0.1'].includes(host)) { return true; }
    if (localStorage.ZenzaWatch_whiteHost) {
      if ((localStorage.ZenzaWatch_whiteHost as string).split(',').includes(host)) {
        return true;
      }
    }
    if (u.protocol !== 'https:') { return false; }
    return [
      'google.com',
      'www.google.com',
      'www.google.co.jp',
      'www.bing.com',
      'twitter.com',
      'friends.nico',
      'feedly.com',
      'www.youtube.com',
    ].includes(host) || host.endsWith('.slack.com');
  };

  const uFetch = async <T = Response>(params: GateFetchParams,
    consume: (response: Response) => T | Promise<T> = (response => response as unknown as T)): Promise<T> => {
    const {url, options: requestOptions = {}} = params;
    if (!isWhiteHost(url) || !isNicoServiceHost(url)) {
      return Promise.reject({status: 'fail', message: 'network error'});
    }
    const options: GateFetchOptions = {...requestOptions};
    const callerSignal = options.signal;
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const abortReason = (): unknown => (callerSignal as AbortSignal).reason !== undefined ? (callerSignal as AbortSignal).reason :
      Object.assign(new Error('The operation was aborted'), {name: 'AbortError'});
    const timeout = (typeof options.timeout === 'number' && !isNaN(options.timeout)) ? options.timeout :
      (typeof params.timeout === 'number' && !isNaN(params.timeout)) ? params.timeout : 30 * 1000;
    const racers: Promise<T>[] = [];
    let timer: ReturnType<typeof setTimeout> | undefined;
    let onAbort: (() => void) | undefined;
    try {
      if (callerSignal && callerSignal.aborted) { throw abortReason(); }
      if (controller) { options.signal = controller.signal; }
      if (callerSignal) {
        racers.push(new Promise((resolve, reject) => {
          onAbort = () => {
            const reason = abortReason();
            reject(reason);
            if (controller) { controller.abort(reason); }
          };
          callerSignal.addEventListener('abort', onAbort, {once: true});
        }));
      }
      if (timeout > 0) {
        racers.push(new Promise((resolve, reject) => {
          timer = setTimeout(() => {
            const error = Object.assign(new Error('timeout'), {name: 'timeout'});
            reject(error);
            if (controller) { controller.abort(error); }
          }, timeout);
        }));
      }
      racers.push(fetch(url, options).then(consume));
      return await Promise.race(racers);
    } catch (err) {
      throw {status: 'fail', message: err && (err as Error).name === 'timeout' ? 'timeout' : 'uFetch fail'};
    } finally {
      if (timer !== undefined) { clearTimeout(timer); }
      if (callerSignal && onAbort) { callerSignal.removeEventListener('abort', onAbort); }
    }
  };

  const fetchSessions = new Map<string | null | undefined, AbortController>();
  const xFetch = (params: GateFetchParams, sessionId: string | null = null) => {
    const command = 'fetch';
    const controller = new AbortController();
    fetchSessions.set(sessionId, controller);
    const request = {...params, options: {...params.options, signal: controller.signal}};
    return uFetch(request, async resp => {
      const buffer = await resp.arrayBuffer();
      const init = ['type', 'url', 'redirected', 'status', 'ok', 'statusText']
          .reduce((map, key) => {map[key] = (resp as unknown as Record<string, unknown>)[key]; return map;}, {} as Record<string, unknown>);
      const headers = [...(resp.headers as unknown as {entries(): Iterable<[string, string]>}).entries()];
      return {buffer, init, headers};
    }).then(({buffer, init, headers}) => {
      const result: GateFetchResult = {status: 'ok', command, params: {buffer, init, headers}};
      post(result, {sessionId});
      return result;
    }).catch(({status, message}: GateFailure) => {
      post({status, message, command}, {sessionId});
    }).finally(() => {
      if (fetchSessions.get(sessionId) === controller) { fetchSessions.delete(sessionId); }
    });
  };


  const init = ({prefix, type}: {prefix: string; type?: string}) => {
    if (!window.name.startsWith(prefix)) {
      throw new Error(`unknown name "${window.name}"`);
    }
    const PID = `${window && window.name || 'self'}:${location.host}:${name}:${Date.now().toString(16).toUpperCase()}`;
    // console.info(`%c1. port open [${window.name.split('#')[0]} ${PRODUCT}]`, 'background: #039393; color: gold; font-size: 120%;');

    type = type || window.name.replace(new RegExp(`/(${PRODUCT}|)Loader$/`), '');
    const origin = document.referrer || window.name.split('#')[1];
    console.log('%cCrossDomainPort: host:%s window:%s', 'background: lightgreen;', location.host, window.name.split('#')[0]);

    if (!isWhiteHost(origin)) {
      throw new Error(`disable bridge "${origin}"`);
    }

    const TOKEN = location.hash ? location.hash.substring(1) : null;
    window.history.replaceState(null, null as unknown as string, location.pathname);
    const port = post({status: 'ok', command: 'initialized'}, {type, token: TOKEN, origin});
    port.addEventListener('message', event => {
      let data: {token?: unknown; body?: {command?: unknown; params?: {sessionId?: string | null}}} | null;
      try { data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data; }
      catch (_) { return; }
      if (!data || data.token !== TOKEN || !data.body || data.body.command !== 'cancelFetch') { return; }
      event.stopImmediatePropagation();
      const controller = fetchSessions.get(data.body.params && data.body.params.sessionId);
      if (controller) { controller.abort(); }
    });
    workerUtil && workerUtil.env({TOKEN, PRODUCT});
    // console.info(`%c3. port init OK [${window.name.split('#')[0]} ${PRODUCT}]`, 'background: #039393; color: gold; font-size: 120%;');
    return {port, TOKEN, origin, type, PID};
  };

  return {post, parseUrl, isNicoServiceHost, isWhiteHost, uFetch, xFetch, init};
};

export {gate};
