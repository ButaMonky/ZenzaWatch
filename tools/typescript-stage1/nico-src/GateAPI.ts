/**
 * Canonical TypeScript source for packages/lib/src/nico/GateAPI.js (Task481).
 * The receiving side of the cross-domain gates: hidden iframes on www (robots.txt),
 * ext, smile-*, snapshot.search and dic hosts. Token checks, host/path allowlists,
 * config sync, IndexedDB bridge and message formats are unchanged.
 */

/** Defined outside the legacy build section (`const PRODUCT = 'ZenzaWatch';`). */
declare const PRODUCT: string;

/** A request from the parent window, after JSON decoding. */
export interface GateParams {
  url?: string;
  options?: {expireTime?: number; credentials?: unknown; [key: string]: unknown};
  keys?: string[];
  prefix?: string;
  command?: string;
  key?: string;
  value?: unknown;
  params?: GateDbParams;
  path?: string;
  title?: string;
  now?: number;
  src?: string;
  sec?: number;
  [key: string]: unknown;
}
export interface GateDbParams {
  name: string;
  ver?: unknown;
  stores?: unknown;
  storeName: string;
  transfer?: unknown;
  data: {key?: unknown; index?: unknown; timeout?: unknown; expireTime?: unknown; [key: string]: unknown};
}
export interface GateMessage {
  body: {command: string; params: GateParams};
  sessionId?: string;
  token?: unknown;
}
export interface GatePort {
  addEventListener(type: 'message', listener: (e: MessageEvent) => unknown): void;
}
export interface GateInit {
  port: GatePort;
  TOKEN: unknown;
  PID?: unknown;
  type?: string;
}
/** packages/lib/src/message/gate.js */
export interface GateTools {
  post(body: unknown, options?: {sessionId?: unknown}): unknown;
  parseUrl(url: string | undefined): {hostname: string; pathname: string};
  xFetch(params: GateParams, sessionId?: unknown): unknown;
  uFetch(params: GateParams): Promise<Response>;
  init(options: {prefix: string; type: string}): GateInit;
}
declare const gate: () => GateTools;

export interface ThumbInfoLike {
  status?: unknown;
  [key: string]: unknown;
}
interface ThumbCacheEntry {
  thumbInfo: ThumbInfoLike;
  updatedAt: number;
}
interface ThumbCacheDb {
  get(watchId: string): Promise<ThumbCacheEntry | null | undefined>;
  put(xmlText: string, thumbInfo: ThumbInfoLike): Promise<unknown>;
}
declare const ThumbInfoCacheDb: {open(): Promise<ThumbCacheDb>};

interface IdbStore {
  close(): Promise<unknown>;
  put(data: unknown, transfer?: unknown): Promise<unknown>;
  get(query: {key?: unknown; index?: unknown; timeout?: unknown}): Promise<unknown>;
  update(data: unknown): Promise<unknown>;
  updateTime(query: {key?: unknown; index?: unknown; timeout?: unknown}): Promise<unknown>;
  delete(query: {key?: unknown; index?: unknown; timeout?: unknown}): Promise<unknown>;
  gc(expireTime: unknown, index: unknown): Promise<unknown>;
}
type IdbDatabase = Record<string, IdbStore>;
/** window.ZenzaLib as read here (legacy: must exist when the bundle evaluates). */
interface ZenzaLibShape {
  dimport?: unknown;
  Handler?: unknown;
  PromiseHandler?: unknown;
  Emitter?: unknown;
  EmitterInitFunc?: unknown;
  workerUtil?: unknown;
  parseThumbInfo: (xmlText: string) => ThumbInfoLike;
  IndexedDbStorage: {open(options: {name: string; ver: unknown; stores: unknown}): Promise<IdbDatabase>};
}
type ZenzaWindow = Window & {ZenzaLib?: ZenzaLibShape};
interface KvsStorage {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): unknown;
}
interface BroadcastData {
  body?: {command?: string; params?: {command?: string; key?: unknown; value?: unknown; [key: string]: unknown}};
  sessionId?: unknown;
}

export interface GateAPIClient {
  thumbInfo(): Promise<void>;
  nicovideo(): void;
  smile(): void;
  search(): void;
  nicodic(): void;
}

const GateAPI: GateAPIClient = (() => {
  const {dimport, Handler, PromiseHandler, Emitter, EmitterInitFunc, workerUtil, parseThumbInfo} = ((window as ZenzaWindow).ZenzaLib || {}) as ZenzaLibShape;
//@require gate
  const {post, parseUrl, xFetch, uFetch, init} = gate();
  const {IndexedDbStorage} = (window as ZenzaWindow).ZenzaLib as ZenzaLibShape;
//@require ThumbInfoCacheDb
  const thumbInfo = async (): Promise<void> => {
    const {port, TOKEN} = init({prefix: `thumbInfo${PRODUCT}Loader`, type: 'thumbInfo'});
    const db: ThumbCacheDb = await ThumbInfoCacheDb.open().catch((): ThumbCacheDb => {
      console.warn('Thumbnail cache unavailable');
      return {get: async () => null, put: async () => {}};
    });

    port.addEventListener('message', async (e: MessageEvent) => {
      const data: GateMessage = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
      const {body, sessionId, token} = data;
      const {command, params} = body;
      if (command !== 'fetch') { return; }
      const p = parseUrl(params.url);
      if (TOKEN !== token ||
        p.hostname !== location.host ||
        !p.pathname.startsWith('/api/getthumbinfo/')) {
        console.log('invalid msg: ', {origin: e.origin, tokenMatches: TOKEN === token, command: body && body.command});
        return;
      }
      params.options = params.options || {};

      const watchId = (params.url as string).split('/').reverse()[0] as string;
      const expiresAt = Date.now() - (params.options.expireTime || 0);
      const cache = await db.get(watchId);
      if (cache && cache.thumbInfo.status === 'ok' && cache.updatedAt > expiresAt) {
        return post({status: 'ok', command, params: cache.thumbInfo}, {sessionId});
      }

      delete params.options.credentials;
      // return xFetch(params, sessionId);
      return uFetch(params)
      .then((res: Response): Promise<string> => res.text())
      .then(async (xmlText: string) => {
        let thumbInfo = parseThumbInfo(xmlText);
        if (thumbInfo.status === 'ok') {
          db.put(xmlText, thumbInfo).catch(() => console.warn('Thumbnail cache write failed'));
        } else if (cache && cache.thumbInfo.status === 'ok') {
          thumbInfo = cache.thumbInfo;
        }
        const result = {status: 'ok', command, params: thumbInfo};
        post(result, {sessionId});
      }).catch(({status, message}: {status?: unknown; message?: unknown}) => {
        if (cache && cache.thumbInfo.status === 'ok') {
          return post({status: 'ok', command, params: cache.thumbInfo}, {sessionId});
        }
        return post({status, message, command}, {sessionId});
      });
    });
  };

  const nicovideo = (): void => {
    const {port, type, TOKEN, PID} = init({prefix: `nicovideoApi${PRODUCT}Loader`, type: 'nicovideoApi'});
    // if (!isWhiteHost(origin) &&
    //   localStorage.ZenzaWatch_allowOtherDomain !== 'true') {
    //   console.log('disable bridge', origin);
    //   return;
    // }


    let isOk = false;

    const pushHistory = ({path, title = ''}: GateParams): void => {
      // ブラウザの既読リンクの色をつけるためにreplaceStateする
      // という目的だったのだが、iframeの中では効かないようだ。残念。
      window.history.replaceState(null, title, path);
      if (broadcastChannel) {
        broadcastChannel.postMessage({body: {
          command: 'message', params: {command: 'pushHistory', params: {path, title}}
        }});
      }
    };

    const PREFIX = PRODUCT || 'ZenzaWatch';

    // const kvs = dimport('std:kv-storage')
    //   .then(({StorageArea}) => new StorageArea(PREFIX)).catch(() => null);
    const kvs = null as KvsStorage | null;

    const dumpConfig = (params: GateParams, sessionId?: string): void => {
      if (!params.keys) {
        return;
      }
      const prefix = params.prefix || PREFIX;
      const config: Record<string, unknown> = {};
      const {keys, command} = params;
      keys.forEach(async (key: string) => {
        if (kvs) {
          const value = await kvs.get(key);
          (value !== undefined) && (config[key] = value);
          return;
        }
        const storageKey = `${prefix}_${key}`;
        if (localStorage.hasOwnProperty(storageKey) || localStorage[storageKey] !== undefined) {
          try {
            config[key] = JSON.parse(localStorage.getItem(storageKey) as string);
          } catch (e) {
            window.console.error('config parse error key:"%s" value:"%s" ', key, localStorage.getItem(storageKey), e);
          }
        }
      });
      post({status: 'ok', command, params: config}, {sessionId});
    };

    const saveConfig = (params: GateParams, sessionId?: string): void => {
      if (!params.key) {
        return;
      }
      if (kvs) {
        kvs.set(params.key, params.value);
        return;
      }
      const prefix = params.prefix || PREFIX;
      const storageKey = `${prefix}_${params.key}`;
      const val = JSON.stringify(params.value);
      if (localStorage[storageKey] !== val) {
        // window.console.log('bridge save config: %s = %s', storageKey, params.value);
        localStorage.setItem(storageKey, val);
        // Storage events are not delivered to this frame's BroadcastChannel.
        // Send the typed value only for our own configuration namespace.
        if (broadcastChannel && prefix === PREFIX && val !== undefined) {
          broadcastChannel.postMessage({id: PRODUCT,
            body: {command: 'configSync', params: {key: params.key, value: params.value}}});
        }
      }
    };

    const onStorage = (e: StorageEvent): unknown => {
      let key = e.key || '';
      if (e.type !== 'storage' || key.indexOf(`${PREFIX}_`) !== 0) {
        return;
      }

      key = key.replace(`${PREFIX}_`, '');
      const {oldValue, newValue} = e;
      if (oldValue === newValue || !isOk) {
        return;
      }
      switch (key) {
        case 'message':{
          const {body} = JSON.parse(newValue as string);
          return post({status: 'ok', command: 'message', params: body}, {sessionId: body.sessionId || ''});
        }
        default: {
          let value: unknown;
          try { value = JSON.parse(newValue as string); }
          catch (_) {
            console.warn('Ignoring malformed synchronized config', {key});
            return;
          }
          return post({status: 'ok', command: 'configSync', params: {key, value}});
        }
      }
    };

    const sendMessage = (body: GateMessage['body'], sessionId?: string): void => {
      // window.console.info('onCommandPacket', message, isOk);
      if (!isOk || !broadcastChannel) {
        return;
      }
      broadcastChannel.postMessage({
        id: PRODUCT,
        status: 'ok',
        command: 'message',
        body,
        sessionId
      });
    };

    const dbMap: Record<string, IdbDatabase> = {};
    const bridgeDb = async (params: GateParams, sessionId?: string): Promise<unknown> => {
      const {command} = params;
      if (command === 'open') {
        const {name, ver, stores} = params.params as GateDbParams;
        const db = dbMap[name] || await IndexedDbStorage.open({name, ver, stores});
        dbMap[name] = db;
        return post({status: 'ok', command: 'bridge-db-result', params: {name, ver}}, {sessionId});
      }
      const {name, storeName, transfer, data} = params.params as GateDbParams;
      const {key, index, timeout, expireTime} = data;
      const db = (dbMap[name] as IdbDatabase)[storeName] as IdbStore;
      let result: unknown = 'ok';
      switch(command) {
        case 'close':
          await db.close();
          break;
        case 'put':
          await db.put(data, transfer);
          break;
        case 'get':
          result = await db.get({key, index, timeout});
          break;
        case 'update':
          result = await db.update(data);
          break;
        case 'updateTime':
          result = await db.updateTime({key, index, timeout});
          break;
        case 'delete':
          await db.delete({key, index, timeout});
          break;
        case 'gc':
          await db.gc(expireTime, index);
          break;
      }
      return post({status: 'ok', command: 'bridge-db-result', params: result}, {sessionId});
    };

    const onBroadcastMessage = (e: MessageEvent): unknown => {
      if (!isOk) { return; }
      let data: BroadcastData | undefined;
      try { data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data; }
      catch (_) { return; }
      const body = data?.body;
      if (!body || typeof body !== 'object') { return; }
      const {sessionId} = data as BroadcastData;
      if (body.command === 'configSync') {
        const {key, value} = body.params || {};
        if (typeof key !== 'string' || !key) { return; }
        return post({status: 'ok', command: 'configSync', params: {key, value}});
      }
      if (body.command !== 'message' || !body.params?.command) {
        console.warn('unknown broadcast format', {command: body.command});
        return;
      }
      return post(body, {sessionId});
    };

    const broadcastChannel =
      window.BroadcastChannel ? (new window.BroadcastChannel(PREFIX)) : null;
    if (broadcastChannel) {
      broadcastChannel.addEventListener('message', onBroadcastMessage);
    } else {
      window.addEventListener('storage', onStorage);
    }

    port.addEventListener('message', (e: MessageEvent) => {
      const data: GateMessage = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
      const {body, sessionId, token} = data;
      const {command, params} = body;
      if (TOKEN !== token) {
        console.log('invalid msg: ', {origin: e.origin, tokenMatches: TOKEN === token, command: body && body.command});
        return;
      }
      try {
        let result: unknown;
        switch (command) {
          case 'ok':
            window.console.info('%cCrossDomainGate initialize OK!', 'color: red;');
            isOk = true;
            break;
          case 'fetch':
            return xFetch(params, sessionId);
          case 'dumpConfig':
            return dumpConfig(params, sessionId);
          case 'saveConfig':
            return saveConfig(params, sessionId);
          case 'pushHistory':
            return pushHistory(params);
          case 'bridge-db':
            return bridgeDb(params, sessionId).catch(() =>
              post({status: 'fail', command: 'bridge-db-result',
                params: {message: 'IndexedDB operation failed'}}, {sessionId}));
          case 'message':
            return sendMessage(body, sessionId);
          case 'ping':
            result = {now: Date.now(), NAME: window.name, PID, url: location.href};
            console.log('pong!: %smsec', Date.now() - (params.now as number), params);
            break;
        }
        post({status: 'ok', command: 'commandResult', params: {command, result}}, {sessionId});
      } catch(e) {
        console.error('Exception', e);
        post({status: 'fail', command, params: {message: (e as Error).message || `${type} command fail`}});
      }
      return undefined;
    });
  };


  const smile = (): void => {
    const {port, TOKEN} = init({
      prefix: `storyboard${PRODUCT}`,
      type: `storyboard${PRODUCT}_${(location.host.split('.')[0] as string).replace(/-/g, '_')}`
    });

    const videoCapture = (src: string, sec: number): Promise<HTMLCanvasElement> => {
      return new Promise((resolve, reject) => {
        const v = Object.assign(document.createElement('video'), {
          volume: 0, autoplay: false, controls: false
        });

        v.addEventListener('loadedmetadata', () => v.currentTime = sec);
        v.addEventListener('error', (err: Event) => {
          v.remove();
          console.warn('capture fail', {src, sec, err, videoError: v.error});
          reject(err);
        });

        const onSeeked = (): void => {
          const c = document.createElement('canvas');
          c.width = v.videoWidth;
          c.height = v.videoHeight;
          const ctx = c.getContext('2d') as CanvasRenderingContext2D;
          ctx.drawImage(v, 0, 0);
          v.remove();

          resolve(c);
        };

        v.addEventListener('seeked', onSeeked, {once: true});

        document.body.append(v);
        v.src = src;
        v.currentTime = sec;
      });
    };

    port.addEventListener('message', (e: MessageEvent) => {
      const data: GateMessage = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
      const {body, sessionId, token} = data;
      const {command, params} = body;
      if (command !== 'videoCapture') { return; }
      if (TOKEN !== token) {
        window.console.log('invalid msg: ', {origin: e.origin, tokenMatches: TOKEN === token, command: body && body.command});
        return;
      }

      videoCapture(params.src as string, params.sec as number).then((canvas: HTMLCanvasElement) => {
        const dataUrl = canvas.toDataURL('image/png');
        // console.info('video capture success', dataUrl.length);
        post({status: 'ok', command, params: {dataUrl}}, {sessionId});
      }).catch((err: unknown) => {
        // Task641 (GATE-CAPTURE-REJECT-002): answer the session so the caller fails
        // immediately instead of waiting for its 60s gate timeout. Covers video
        // errors and toDataURL throwing on a tainted canvas.
        const message = err instanceof Error && err.message ? err.message : 'videoCapture fail';
        post({status: 'fail', command, params: {message}}, {sessionId});
      });
    });

  };

  const search = (): void => {
    const {port, TOKEN} = init({prefix: `searchApi${PRODUCT}Loader`, type: 'searchApi'});
    port.addEventListener('message', (e: MessageEvent) => {
      const data: GateMessage = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
      const {body, sessionId, token} = data;
      const {command, params} = body;
      if (command !== 'fetch') { return; }
      const p = parseUrl(params.url);
      if (TOKEN !== token ||
        p.hostname !== location.host) {
        console.log('invalid msg: ', {origin: e.origin, tokenMatches: TOKEN === token, command: body && body.command});
        return;
      }
      params.options = params.options || {};
      delete params.options.credentials;

      xFetch(params, sessionId);
    });
  };

  /**
   * ニコニコ大百科（dic.nicovideo.jp）の記事ページへの問い合わせを代理する
   * （Task 044）。記事の有無はHTTPステータス（200/404）で判定するため、
   * 本文は使わない。仕組みはsearchゲートと同じ。
   */
  const nicodic = (): void => {
    const {port, TOKEN} = init({prefix: `nicodic${PRODUCT}Loader`, type: 'nicodic'});
    port.addEventListener('message', (e: MessageEvent) => {
      const data: GateMessage = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
      const {body, sessionId, token} = data;
      const {command, params} = body;
      if (command !== 'fetch') { return; }
      const p = parseUrl(params.url);
      // 代理するのは記事ページ(/a/...)だけに限定する
      if (TOKEN !== token ||
        p.hostname !== location.host ||
        !p.pathname.startsWith('/a/')) {
        console.log('invalid msg: ', {origin: e.origin, tokenMatches: TOKEN === token, command: body && body.command});
        return;
      }
      params.options = params.options || {};
      // 記事の有無を見るだけなのでログイン情報は送らない
      delete params.options.credentials;

      xFetch(params, sessionId);
    });
  };

  return {thumbInfo, nicovideo, smile, search, nicodic};
})();

export {GateAPI};
