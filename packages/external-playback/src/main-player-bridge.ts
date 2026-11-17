import {validVideoId} from './targets';

// This channel exists only inside the static Nico player frame. External
// parents never receive API responses, credentials, fetch methods or ports.
const protocol = 'zenza-main-player-v1';
interface Session {
  open(id: string, event: {isTrusted: boolean}): Promise<void>;
  close(): boolean | void;
  setStageListener(listener: (stage: string) => void): void;
}
interface ClientOptions {
  timeoutMs?: number; retryMs?: number;
  onClosing?: () => void; onClosed?: () => void;
  snapshot?: () => unknown; onSettings?: (values: unknown) => void;
  /** Task1032: 調査用の記録（コンソール出力の設定がONのときだけ出す側が判断する）。 */
  onDiag?: (event: string, data?: Record<string, unknown>) => void;
}
function eligible(w: Window): boolean {
  return w !== w.top && w.name === 'ZenzaWatchExternalTrialPlayer' &&
    w.location.origin === 'https://www.nicovideo.jp' && w.location.pathname === '/robots.txt';
}
/**
 * Task1032: 送り主が「この枠自身」かの判定。
 * Tampermonkey などはスクリプトごとに window を包んで渡すことがあり、その場合は同じ枠からの
 * メッセージでも event.source === w が成り立たない（実機で本体が hello を一度も受け取れなかった原因）。
 * 包みがあっても判定できるよう、同一オブジェクトでなければ「同じ文書・同じ名前・同じURL」の窓かを確かめる。
 * 送り主の origin が www.nicovideo.jp であることは別途確かめているので、外部サイトの親は通らない。
 * 子の枠（API用など）は名前とURLが違うので通らない。
 */
function sameFrame(w: Window, source: MessageEventSource | null): boolean {
  if (!source) return false;
  if (source === w) return true;
  try {
    const s = source as Window;
    return s.document === w.document && s.name === w.name && s.location.href === w.location.href;
  } catch (_) { return false; }
}
function rejectReason(w: Window, event: MessageEvent): string | null {
  if (event.data?.protocol !== protocol) return 'protocol';
  if (event.origin !== w.location.origin) return 'origin';
  if (!sameFrame(w, event.source)) return 'source';
  return null;
}

export function createMainPlayerClient(w: Window, options: ClientOptions = {}) {
  const diag = (event: string, data: Record<string, unknown> = {}) => { try { options.onDiag?.(event, data); } catch (_) { /* 記録の失敗は無視 */ } };
  let helloCount = 0, clientRejected = 0;
  let disposed = false, closing = false, connected = false, seq = 0, stageListener = (_: string) => {};
  const channel = w.crypto.randomUUID();
  let pending: {id: string; seq: number; resolve: () => void; reject: (e: Error) => void;
    timer: number; retry?: number; ready?: boolean} | undefined;
  const send = (data: object) => w.postMessage({protocol, channel, ...data}, w.location.origin);
  function settle(error?: Error) {
    if (!pending) return;
    const task = pending; pending = undefined;
    w.clearTimeout(task.timer); w.clearTimeout(task.retry);
    if (error) task.reject(error); else task.resolve();
  }
  const receive = (event: MessageEvent) => {
    if (disposed) return;
    const reason = rejectReason(w, event);
    if (reason) {
      if (reason !== 'protocol' && clientRejected++ < 3) diag('client-message-rejected', {reason,
        origin: event.origin, sourceIsSelf: event.source === w, type: event.data?.type ?? null});
      return;
    }
    if (event.data.channel !== channel) return;
    const message = event.data;
    if (message.type !== 'settings') diag('client-receive', {type: message.type, stage: message.stage ?? null,
      code: message.code ?? null, requestId: message.requestId ?? null, pending: !!pending, closing});
    if(closing && message.type !== 'stage')return;
    if (message.type === 'ready' && pending) {
      connected=true;
      w.clearTimeout(pending.retry);
      if(!pending.ready){pending.ready=true;w.clearTimeout(pending.timer);pending.timer=w.setTimeout(()=>settle(Error('PLAYER_TIMEOUT')),60000);}
      send({type: 'open', id: pending.id, requestId: pending.seq});
    } else if (message.type === 'opened' && message.requestId === pending?.seq) settle();
    else if (message.type === 'error' && message.requestId === pending?.seq) {
      const allowed = ['LOGIN_REQUIRED','AUTH_FORBIDDEN','AUTH_TIMEOUT','GM_NETWORK_ERROR','PLAYER_CLOSED'];
      const error = Object.assign(Error(allowed.includes(message.code) ? message.code : 'PLAYER_START_FAILED'),
        {stage: ['BOOT','SETTINGS','AUTH','UI','VIDEO'].includes(message.stage) ? message.stage : 'BOOT'});
      settle(error);
    } else if (message.type === 'settings') options.onSettings?.(message.values);
    else if (message.type === 'stage' && typeof message.stage === 'string') {
      if (message.stage === 'CLOSING') {closing=true;settle(Error('PLAYER_CLOSED'));options.onClosing?.();}
      else if (message.stage === 'CLOSED') {settle(Error('PLAYER_CLOSED')); options.onClosed?.();}
      else if (['BOOT','SETTINGS','AUTH','UI','VIDEO','OPEN'].includes(message.stage)) stageListener(message.stage);
    }
  };
  w.addEventListener('message', receive);
  const dispose = () => {
    if (disposed) return;
    disposed = true; settle(Error('PLAYER_CLOSED')); w.removeEventListener('message', receive);
  };
  w.addEventListener('pagehide', dispose, {once:true});
  return {
    async open(id: string, event: {isTrusted: boolean}) {
      if (!event?.isTrusted) throw Error('USER_CLICK_REQUIRED');
      if (!eligible(w) || !validVideoId(id)) throw Error('INVALID_VIDEO_ID');
      if (disposed || closing) throw Error('PLAYER_CLOSED');
      if (pending) throw Error('PLAYER_BUSY');
      return new Promise<void>((resolve, reject) => {
        const task = pending = {id, seq: ++seq, resolve, reject,
          timer: w.setTimeout(() => {
            // 本体（ZenzaWatch）がこの枠で動いていない・古い・無効のときにここへ来る。
            diag('client-timeout', {reason: 'MAIN_PLAYER_UNAVAILABLE', hellos: helloCount, connected});
            // 利用者向けの手がかり（設定に関係なく1行）。
            try { (w as Window & {console: Console}).console.warn('[ZenzaBlogPartsButton] 再生用の枠で ZenzaWatch 本体が応答しません。本体がインストール・有効になっているか、Tampermonkey で本体がフレーム内（www.nicovideo.jp/robots.txt）でも動く設定かを確認してください。'); } catch (_) { /* noop */ }
            settle(Error('MAIN_PLAYER_UNAVAILABLE'));
          }, options.timeoutMs ?? 15000),
          retry: undefined as number | undefined};
        diag('client-open', {id, seq: task.seq, timeoutMs: options.timeoutMs ?? 15000});
        const hello = () => {
          if (pending !== task || disposed) return;
          helloCount++;
          if (helloCount === 1 || helloCount % 20 === 0) diag('client-hello', {count: helloCount, connected});
          send({type:'hello',snapshot:options.snapshot?.()});
          task.retry = w.setTimeout(hello, options.retryMs ?? 250);
        };
        hello();
      });
    },
    updateSettings(values: unknown) {if(!disposed)send({type:'settings',values});},
    close() {
      if(disposed)return false;
      if(closing)return true;
      closing=true;settle(Error('PLAYER_CLOSED'));
      if(connected)send({type:'close'});
      else {options.onClosing?.();options.onClosed?.();}
      return true;
    },
    setStageListener(listener: (stage: string) => void) {stageListener = listener;},
    dispose
  };
}
export function installMainPlayerProvider(w: Window, session: Session, options: {
  setup?: (snapshot: unknown) => void; onSettings?: (values: unknown) => void;
  subscribeSettings?: (send: (values: unknown) => void) => void;
  onDiag?: (event: string, data?: Record<string, unknown>) => void;
} = {}): () => void {
  const diag = (event: string, data: Record<string, unknown> = {}) => { try { options.onDiag?.(event, data); } catch (_) { /* 記録の失敗は無視 */ } };
  if (!eligible(w)) { diag('provider-not-eligible', {top: w === w.top, name: String(w.name).slice(0, 48), path: w.location.pathname}); return () => {}; }
  diag('provider-installed');
  let channel = '', last = 0, busy = false, disposed = false, closing = false;
  const send = (data: object) => {
    if (!disposed && channel) w.postMessage({protocol, channel, ...data}, w.location.origin);
  };
  session.setStageListener(stage => {if(stage==='CLOSING'||stage==='CLOSED')closing=true;send({type:'stage', stage});});
  options.subscribeSettings?.(values=>send({type:'settings',values}));
  let rejected = 0;
  const receive = async (event: MessageEvent) => {
    if (disposed) return;
    const reason = rejectReason(w, event);
    if (reason) {
      if (reason !== 'protocol' && rejected++ < 3) diag('provider-message-rejected', {reason,
        origin: event.origin, sourceIsSelf: event.source === w, type: event.data?.type ?? null});
      return;
    }
    const m = event.data;
    if (typeof m.channel !== 'string' || !/^[a-f0-9-]{36}$/i.test(m.channel)) return;
    if (m.type === 'hello') {
      if (channel && channel !== m.channel) { diag('provider-hello-other-channel'); return; }
      if (!channel) diag('provider-hello', {hasSnapshot: !!m.snapshot});
      if(!channel) options.setup?.(m.snapshot);
      channel = m.channel; send({type:'ready'}); return;
    }
    if (!channel || m.channel !== channel) return;
    if (m.type === 'settings') {options.onSettings?.(m.values);return;}
    if (m.type === 'close') {closing=true;if(!session.close()){send({type:'stage',stage:'CLOSING'});send({type:'stage',stage:'CLOSED'});} return;}
    if (m.type !== 'open' || closing || busy || !Number.isSafeInteger(m.requestId) ||
        m.requestId <= last || !validVideoId(m.id)) {
      if (m.type === 'open') diag('provider-open-ignored', {closing, busy, requestId: m.requestId, last, validId: validVideoId(m.id)});
      return;
    }
    last = m.requestId; busy = true;
    const started = Date.now();
    diag('provider-open', {id: m.id, requestId: m.requestId});
    try {await session.open(m.id, {isTrusted:true}); diag('provider-opened', {id: m.id, ms: Date.now() - started});
      if(!closing)send({type:'opened', requestId:m.requestId});}
    catch (e) {const error = e as Error & {stage?: string};
      diag('provider-open-failed', {id: m.id, ms: Date.now() - started, code: String(error?.message || error),
        stage: error?.stage ?? null, name: error?.name ?? null,
        stack: typeof error?.stack === 'string' ? error.stack.split('\n').slice(0, 8).join(' | ') : null});
      send({type:'error', requestId:m.requestId, code:error.message, stage:error.stage});}
    finally {busy = false;}
  };
  w.addEventListener('message', receive);
  const dispose = () => {disposed = true; w.removeEventListener('message', receive);};
  w.addEventListener('pagehide', dispose, {once:true});
  return dispose;
}