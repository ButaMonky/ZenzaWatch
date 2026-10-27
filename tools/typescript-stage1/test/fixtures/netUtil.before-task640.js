// import * as jQuery from 'jQuery';
// const $ = jQuery.default;
const NicoVideoApi = {ajax: () => {}};

//===BEGIN===
const netUtil = {
  ajax: params => {
    if (location.host !== 'www.nicovideo.jp') {
      return NicoVideoApi.ajax(params);
    }
    return $.ajax(params);
  },
  abortableFetch: async (url, params = {}) => {
    params = params || {};
    const options = {...params};
    const callerSignal = options.signal;
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const abortReason = () => callerSignal.reason !== undefined ? callerSignal.reason :
      Object.assign(new Error('The operation was aborted'), {name: 'AbortError'});
    const timeout = (typeof params.timeout === 'number' && !isNaN(params.timeout)) ? params.timeout : 30 * 1000;
    const racers = [];
    let timer;
    let onAbort;
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
      racers.push(fetch(url, options));
      return await Promise.race(racers);
    } finally {
      if (timer !== undefined) { clearTimeout(timer); }
      if (callerSignal && onAbort) { callerSignal.removeEventListener('abort', onAbort); }
    }
  },
  fetch(url, params) {
    if (location.host !== 'www.nicovideo.jp') {
      return NicoVideoApi.fetch(url, params);
    }
    return this.abortableFetch(url, params);
  },
  jsonp: (() => {
    let callbackId = 0;
    const getFuncName = () => `JsonpCallback${callbackId++}`;

    let cw = null;
    const getFrame = () => {
      if (cw) { return cw; }
      return new Promise(resolve => {
        const iframe = document.createElement('iframe');
        iframe.srcdoc = `
          <html><head></head></html>
        `.trim();
        iframe.sandbox = 'allow-same-origin allow-scripts';
        Object.assign(iframe.style, {
          width: '32px', height: '32px', position: 'fixed', left: '-100vw', top: '-100vh',
          pointerEvents: 'none', overflow: 'hidden'
        });
        iframe.onload = () => {
          cw = iframe.contentWindow;
          resolve(cw);
        };
        (document.body || document.documentElement).append(iframe);
      });
    };

    const createFunc = async (url, funcName) => {
      let timeoutTimer = null;
      const win = await getFrame();
      const doc = win.document;
      const script = doc.createElement('script');
      return new Promise((resolve, reject) => {
        win[funcName] = result => {
          win.clearTimeout(timeoutTimer);
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

    return (url, funcName) => {
      if (!funcName) {
        funcName = getFuncName();
      }
      url = `${url}${url.includes('?') ? '&' : '?'}callback=${funcName}`;
      return createFunc(url, funcName);
    };
  })()
};

//===END===

export {netUtil};