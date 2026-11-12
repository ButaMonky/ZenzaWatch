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
}
function eligible(w: Window): boolean {
  return w !== w.top && w.name === 'ZenzaWatchExternalTrialPlayer' &&
    w.location.origin === 'https://www.nicovideo.jp' && w.location.pathname === '/robots.txt';
}
function accepts(w: Window, event: MessageEvent): boolean {
  return event.source === w && event.origin === w.location.origin &&
    event.data?.protocol === protocol;
}
export function createMainPlayerClient(w: Window, options: ClientOptions = {}) {
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
    if (disposed || !accepts(w, event) || event.data.channel !== channel) return;
    const message = event.data;
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
          timer: w.setTimeout(() => settle(Error('MAIN_PLAYER_UNAVAILABLE')), options.timeoutMs ?? 15000),
          retry: undefined as number | undefined};
        const hello = () => {
          if (pending !== task || disposed) return;
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
} = {}): () => void {
  if (!eligible(w)) return () => {};
  let channel = '', last = 0, busy = false, disposed = false, closing = false;
  const send = (data: object) => {
    if (!disposed && channel) w.postMessage({protocol, channel, ...data}, w.location.origin);
  };
  session.setStageListener(stage => {if(stage==='CLOSING'||stage==='CLOSED')closing=true;send({type:'stage', stage});});
  options.subscribeSettings?.(values=>send({type:'settings',values}));
  const receive = async (event: MessageEvent) => {
    if (disposed || !accepts(w, event)) return;
    const m = event.data;
    if (typeof m.channel !== 'string' || !/^[a-f0-9-]{36}$/i.test(m.channel)) return;
    if (m.type === 'hello') {
      if (channel && channel !== m.channel) return;
      if(!channel) options.setup?.(m.snapshot);
      channel = m.channel; send({type:'ready'}); return;
    }
    if (!channel || m.channel !== channel) return;
    if (m.type === 'settings') {options.onSettings?.(m.values);return;}
    if (m.type === 'close') {closing=true;if(!session.close()){send({type:'stage',stage:'CLOSING'});send({type:'stage',stage:'CLOSED'});} return;}
    if (m.type !== 'open' || closing || busy || !Number.isSafeInteger(m.requestId) ||
        m.requestId <= last || !validVideoId(m.id)) return;
    last = m.requestId; busy = true;
    try {await session.open(m.id, {isTrusted:true}); if(!closing)send({type:'opened', requestId:m.requestId});}
    catch (e) {const error = e as Error & {stage?: string};
      send({type:'error', requestId:m.requestId, code:error.message, stage:error.stage});}
    finally {busy = false;}
  };
  w.addEventListener('message', receive);
  const dispose = () => {disposed = true; w.removeEventListener('message', receive);};
  w.addEventListener('pagehide', dispose, {once:true});
  return dispose;
}