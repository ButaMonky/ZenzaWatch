/**
 * Canonical TypeScript source for packages/lib/src/infra/netUtil.js (Task640).
 * Shared transport for every NicoNico API client: fetch with timeout and
 * caller abort, www-origin delegation through NicoVideoApi and JSONP.
 * Task641: the unused `ajax` (NETUTIL-AJAX-001, threw off www because the gate
 * has no ajax) was removed together with its jQuery dependency.
 */
import type {NetFetchOptions} from './NicoApiTypes';

/** In the bundle this is the real NicoVideoApi gate (Task477). */
declare const NicoVideoApi: {
  fetch(url: string, params?: NetFetchOptions | null): Promise<Response>;
};

export interface NetUtilClient {
  /**
   * fetch with a timeout (default 30s; 0 or negative disables) and caller
   * AbortSignal propagation. Rejects with the caller's abort reason, an
   * AbortError, a `{name: 'timeout'}` Error, or the fetch error.
   */
  abortableFetch(url: string, params?: NetFetchOptions | null): Promise<Response>;
  /** www.nicovideo.jp: abortableFetch; other hosts: the cross-domain gate. */
  fetch(url: string, params?: NetFetchOptions | null): Promise<Response>;
  /** Loads `url&callback=<name>` in a sandboxed iframe; resolves the callback argument. */
  jsonp(url: string, funcName?: string): Promise<unknown>;
}

type CallbackWindow = Window & Record<string, unknown>;

const netUtil: NetUtilClient = {
  abortableFetch: async (url: string, params: NetFetchOptions | null = {}): Promise<Response> => {
    params = params || {};
    const options: NetFetchOptions = {...params};
    const callerSignal = options.signal;
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const abortReason = (): unknown => (callerSignal as AbortSignal).reason !== undefined ? (callerSignal as AbortSignal).reason :
      Object.assign(new Error('The operation was aborted'), {name: 'AbortError'});
    const timeout = (typeof params.timeout === 'number' && !isNaN(params.timeout)) ? params.timeout : 30 * 1000;
    const racers: Promise<Response>[] = [];
    let timer: number | undefined;
    let onAbort: (() => void) | undefined;
    try {
      if (callerSignal && callerSignal.aborted) { throw abortReason(); }
      if (controller) { options.signal = controller.signal; }
      if (callerSignal) {
        racers.push(new Promise<Response>((resolve, reject) => {
          onAbort = () => {
            const reason = abortReason();
            reject(reason);
            if (controller) { controller.abort(reason); }
          };
          callerSignal.addEventListener('abort', onAbort, {once: true});
        }));
      }
      if (timeout > 0) {
        racers.push(new Promise<Response>((resolve, reject) => {
          timer = setTimeout(() => {
            const error = Object.assign(new Error('timeout'), {name: 'timeout'});
            reject(error);
            if (controller) { controller.abort(error); }
          }, timeout);
        }));
      }
      // `timeout` and numeric header values are passed through as before.
      racers.push(fetch(url, options as RequestInit));
      return await Promise.race(racers);
    } finally {
      if (timer !== undefined) { clearTimeout(timer); }
      if (callerSignal && onAbort) { callerSignal.removeEventListener('abort', onAbort); }
    }
  },
  fetch(url: string, params?: NetFetchOptions | null): Promise<Response> {
    // Task647 (NETUTIL-POCKET-002): MylistPocket's bundle has no NicoVideoApi gate,
    // so off www it threw a ReferenceError. Without the gate, fetch directly
    // (works where the API allows the page origin, fails normally elsewhere).
    if (location.host !== 'www.nicovideo.jp' && typeof NicoVideoApi !== 'undefined') {
      return NicoVideoApi.fetch(url, params);
    }
    return this.abortableFetch(url, params);
  },
  jsonp: ((): ((url: string, funcName?: string) => Promise<unknown>) => {
    let callbackId = 0;
    const getFuncName = (): string => `JsonpCallback${callbackId++}`;

    let cw: Window | null = null;
    const getFrame = (): Window | Promise<Window> => {
      if (cw) { return cw; }
      return new Promise<Window>(resolve => {
        const iframe = document.createElement('iframe');
        iframe.srcdoc = `
          <html><head></head></html>
        `.trim();
        (iframe as unknown as {sandbox: string}).sandbox = 'allow-same-origin allow-scripts';
        Object.assign(iframe.style, {
          width: '32px', height: '32px', position: 'fixed', left: '-100vw', top: '-100vh',
          pointerEvents: 'none', overflow: 'hidden'
        });
        iframe.onload = () => {
          cw = iframe.contentWindow;
          resolve(cw as Window);
        };
        (document.body || document.documentElement).append(iframe);
      });
    };

    const createFunc = async (url: string, funcName: string): Promise<unknown> => {
      let timeoutTimer: number | null = null;
      const win = await getFrame() as CallbackWindow;
      const doc = win.document;
      const script = doc.createElement('script');
      return new Promise((resolve, reject) => {
        win[funcName] = (result: unknown) => {
          win.clearTimeout(timeoutTimer as number);
          timeoutTimer = null;
          script.remove();
          delete win[funcName];

          resolve(result);
        };
        timeoutTimer = win.setTimeout(() => {
          script.remove();
          delete win[funcName];
          if (timeoutTimer) {
            reject(new Error(`jsonp timeout ${url}`));
          }
        }, 30000);
        script.src = url;
        doc.head.append(script);
      });
    };

    return (url: string, funcName?: string): Promise<unknown> => {
      if (!funcName) {
        funcName = getFuncName();
      }
      url = `${url}${url.includes('?') ? '&' : '?'}callback=${funcName}`;
      return createFunc(url, funcName);
    };
  })()
};

export {netUtil};
