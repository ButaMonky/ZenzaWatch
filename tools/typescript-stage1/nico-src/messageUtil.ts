/**
 * Canonical TypeScript source for packages/lib/src/message/messageUtil.js (Task789).
 * WindowMessageEmitter receives window messages (blog parts and known windows);
 * BroadcastEmitter talks to other ZenzaWatch windows over BroadcastChannel,
 * localStorage events or the cross-domain gate.
 */

/**
 * Message bodies are raw structured-clone / JSON data from other windows; this one
 * documented loose alias covers them.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = Record<string, any>;
type Settle = (value?: unknown) => void;

/** The part of Emitter (packages/lib/src/Emitter.js) used here. */
declare class Emitter {
  emit(name: string, ...args: unknown[]): unknown;
  emitAsync(name: string, ...args: unknown[]): unknown;
  promise(name: string, callback?: (resolve: Settle, reject: Settle) => unknown): Promise<unknown>;
  emitReject(name: string, ...args: unknown[]): unknown;
  resetPromise(name: string): void;
}
/** The parts of global, Config and NicoVideoApi used here. */
declare const global: {
  config: {props: Loose};
  external: {sendOrExecCommand(command: string, param: unknown): unknown; execCommand(command: string, param: unknown): unknown};
  debug: Loose;
};
declare const PRODUCT: string;
declare const Config: {setValue(key: string, value: unknown): unknown};
declare const NicoVideoApi: {sendMessage?(body: Loose, needResult: boolean, sessionId: string | null): Promise<unknown>} | undefined;

export type WindowMessageEmitterType = Emitter & {addKnownSource(win: unknown): number};
export interface PingOptions {timeout?: number | undefined; force?: boolean | undefined}
export type BroadcastEmitterType = Emitter & {
  windowId: string;
  sendExecCommand(body: Loose): Promise<unknown>;
  sendMessage(body: Loose, sessionId?: string | null): Promise<unknown> | void;
  sendMessagePromise(body: Loose, timeout?: number): Promise<unknown>;
  pong(result: unknown): unknown;
  hello(message?: string): Promise<unknown>;
  ping(options?: PingOptions): Promise<unknown>;
  sendOpen(watchId: string, params?: Loose): void;
  notifyClose(): unknown;
  notifyOpen(playerId: string): unknown;
};

const messageUtil = {} as {WindowMessageEmitter: WindowMessageEmitterType; BroadcastEmitter: BroadcastEmitterType};
// WindowMessageEmitter 親子ウィンドウ間
// BroadcastEmitter 複数ウィンドウ間. CrossDomainGate を経由してドメインの壁を超える

const WindowMessageEmitter = messageUtil.WindowMessageEmitter = ((safeOrigins: string[] = []) => {
  const emitter = new Emitter() as WindowMessageEmitterType;
  const knownSource: unknown[] = [];

  const onMessage = (e: MessageEvent) => {
    if (!knownSource.includes(e.source) && !safeOrigins.includes(e.origin)
    ) {
      return;
    }
    try {
      const data: Loose = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
      const {id, type, body, sessionId} = data;
      if (id !== PRODUCT) {
        return;
      }
      const message = body.params;
      if (type === 'blogParts') { // 互換のための対応
        const command = global.config.props.enableSingleton ?
          (message.command === 'send' ? 'open' : 'send') : message.command;

        if (command === 'send') {
          global.external.sendOrExecCommand('open', message.params.watchId);
        } else {
          global.external.execCommand('open', message.params.watchId);
        }
        return;
      } else if (body.command !== 'message' || !body.params.command) {
        return;
      }
      emitter.emit('message', message, type, sessionId);
    } catch (err) {
      console.error(
        '%cNicoCommentLayer.Error: window.onMessage  - ',
        'color: red; background: yellow',
        err,
        e
      );
      console.error('%corigin: ', 'background: yellow;', e.origin);
      console.error('%cdata: ', 'background: yellow;', e.data);
      console.trace();
    }
  };

  emitter.addKnownSource = win => knownSource.push(win);

  window.addEventListener('message', onMessage);

  return emitter;
})(['http://ext.nicovideo.jp', 'https://ext.nicovideo.jp']);

const BroadcastEmitter = messageUtil.BroadcastEmitter = (() => {
  const bcast = new Emitter() as BroadcastEmitterType;
  bcast.windowId = `${PRODUCT}-${Math.random()}`;
  // const promises = bcast.promises = {};

  const channel =
    (self.BroadcastChannel && location.host === 'www.nicovideo.jp') ?
      (new self.BroadcastChannel(PRODUCT)) : null;

  const onStorage = (e: StorageEvent) => {
    let command = e.key;
    if (e.type !== 'storage' || typeof command !== 'string' || !command.startsWith(`${PRODUCT}_`)) {
      return;
    }

    command = command.slice(`${PRODUCT}_`.length);
    let oldValue = e.oldValue;
    let newValue = e.newValue;
    if (newValue === null || oldValue === newValue) {
      return;
    }

    switch (command) {
      case 'message': {
        let data: Loose;
        try {
          data = JSON.parse(newValue);
        } catch (err) {
          return;
        }
        if (!data || typeof data !== 'object' || Array.isArray(data)) { return; }
        const {body} = data;
        if (!body || typeof body !== 'object' || Array.isArray(body) ||
            typeof body.command !== 'string' || !body.command) { return; }
        bcast.emitAsync('message', body, 'broadcast');
        break;
      }
    }
  };

  const onBroadcastMessage = (e: MessageEvent) => {
    console.log('%cbcast.onBroadcastMessage', 'background: cyan;', e.data);
    // Task790 (MSGUTIL-BCAST-GUARD-001): malformed channel data used to throw inside the
    // listener; drop it like the storage path does.
    let data: Loose;
    try {
      data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
    } catch (err) {
      return;
    }
    if (!data || typeof data !== 'object') { return; }
    const {body, sessionId} = data;
    if (!body || typeof body !== 'object' ||
        body.command !== 'message' || !body.params || !body.params.command) {
      console.warn('unknown broadcast format', body);
      return;
    }
    return bcast.emitAsync('message', body.params, 'broadcast', sessionId);
  };

  bcast.sendExecCommand = body =>
    bcast.sendMessagePromise({command: 'sendExecCommand', params: body});

  bcast.sendMessage = (body, sessionId = null): Promise<unknown> | void => {
    const requestId = `request-${Math.random()}`;
    Object.assign(body, {requestId, windowId: bcast.windowId, now: Date.now()});
    const req = {id: PRODUCT, body: {command: 'message', params: body}, sessionId};
    if (channel) {
      channel.postMessage(req);
    } else if (location.host === 'www.nicovideo.jp') {
      Config.setValue('message', {body, sessionId});
    } else if (location.host !== 'www.nicovideo.jp' &&
      NicoVideoApi && NicoVideoApi.sendMessage) {
      return NicoVideoApi.sendMessage(body, !!sessionId, sessionId);
    }
  };
  bcast.sendMessagePromise = (body, timeout = 60000) => {
    const sessionId = `sendMessage-${PRODUCT}-${Math.random()}`;
    let timer: ReturnType<typeof setTimeout> | null | void = null;
    return bcast.promise(sessionId, async (resolve, reject): Promise<void> => {
      const result = bcast.sendMessage(body, sessionId);
      // window.console.log('bcast.sendMessagePromise', {body, result, sessionId});
      timer = setTimeout(() => {
        if (!timer) { return; }
        return reject(`timeout ${timeout}msec. command: ${body.command}`);
      }, timeout);
      if (result instanceof Promise) {
        return resolve(await result);
      }
    }).catch(err => bcast.emitReject(sessionId, err))
      .finally(() => {
        timer = clearTimeout(timer as ReturnType<typeof setTimeout>);
        bcast.resetPromise(sessionId);
      });
  };

  bcast.pong = result => bcast.sendMessage({command: 'pong', params: result});

  bcast.hello = (message = 'こんにちはこんにちは！') => bcast.sendMessagePromise(
    {command: 'hello', params: {
        message, from: document.title, url: location.href, now: Date.now(),
        ssid: `hello-${Math.random()}`, windowId: bcast.windowId
      }
    });

  bcast.ping = ({timeout, force} = {}) => {
    timeout = timeout || 500;
    return new Promise((resolve, reject) => {
      // Task790 (MSGUTIL-PING-UNHANDLED-001): also pass the inner rejection on. Without it,
      // the 60 s timeout of an unanswered ping was an unhandled rejection; by then this
      // promise has already settled on the `timeout`ms timer, so the reject is a no-op.
      bcast.sendMessagePromise(
        {command: 'ping', params: {timeout, force, now: Date.now()}}).then(resolve, reject);
      window.setTimeout(() => reject(`timeout ${timeout}ms`), timeout);
    });
  };

  bcast.sendOpen = (watchId, params) => {
    bcast.sendMessage({
      command: 'openVideo', params: Object.assign({watchId, eventType: 'click'}, params)});
  };

  bcast.notifyClose = () => bcast.sendMessage({command: 'notifyClose'});
  bcast.notifyOpen = playerId => bcast.sendMessage({command: 'notifyOpen', params: {playerId}});

  global.debug.hello = bcast.hello;
  global.debug.ping = ({timeout, force}: PingOptions = {}) => {
    window.console.time('ping');
    return bcast.ping({timeout, force}).then(result => {
      window.console.timeEnd('ping');
      window.console.info('ping result: ok', result);
      return result;
    }).catch(result => {
      window.console.timeEnd('ping');
      window.console.error('ping fail: ', result);
      return result;
    });
  };

  if (location.host === 'www.nicovideo.jp') {
    if (channel) {
      channel.addEventListener('message', onBroadcastMessage);
    } else {
      window.addEventListener('storage', onStorage);
    }
  }

  return bcast;
})();

export {messageUtil, BroadcastEmitter, WindowMessageEmitter};
