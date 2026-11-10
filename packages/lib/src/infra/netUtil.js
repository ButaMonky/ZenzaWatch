import {RequestDiagnostics} from './RequestDiagnostics';
// GENERATED FROM tools/typescript-stage1/nico-src/netUtil.ts (Task640). Edit the .ts and run npm run nico:sync.
//===BEGIN===
//@require RequestDiagnostics
const netUtil = {
    abortableFetch: async (url, params = {}) => {
        params = params || {};
        const options = { ...params };
        const callerSignal = options.signal;
        const diagnostic = typeof RequestDiagnostics === 'undefined' ? null : RequestDiagnostics.startRequest(url, callerSignal, options.diagnosticActive);
        delete options.diagnosticActive;
        const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
        const abortReason = () => callerSignal.reason !== undefined ? callerSignal.reason :
            Object.assign(new Error('The operation was aborted'), { name: 'AbortError' });
        const timeout = (typeof params.timeout === 'number' && !isNaN(params.timeout)) ? params.timeout : 30 * 1000;
        const racers = [];
        let timer;
        let onAbort;
        try {
            if (callerSignal && callerSignal.aborted) {
                throw abortReason();
            }
            if (controller) {
                options.signal = controller.signal;
            }
            if (callerSignal) {
                racers.push(new Promise((resolve, reject) => {
                    onAbort = () => {
                        const reason = abortReason();
                        reject(reason);
                        if (controller) {
                            controller.abort(reason);
                        }
                    };
                    callerSignal.addEventListener('abort', onAbort, { once: true });
                }));
            }
            if (timeout > 0) {
                racers.push(new Promise((resolve, reject) => {
                    timer = setTimeout(() => {
                        const error = Object.assign(new Error('timeout'), { name: 'timeout' });
                        reject(error);
                        if (controller) {
                            controller.abort(error);
                        }
                    }, timeout);
                }));
            }
            // `timeout` and numeric header values are passed through as before.
            racers.push(fetch(url, options));
            const response = await Promise.race(racers);
            diagnostic?.response(response);
            return response;
        }
        catch (error) {
            diagnostic?.failure(error);
            throw error;
        }
        finally {
            if (timer !== undefined) {
                clearTimeout(timer);
            }
            if (callerSignal && onAbort) {
                callerSignal.removeEventListener('abort', onAbort);
            }
        }
    },
    fetch(url, params) {
        // Task647 (NETUTIL-POCKET-002): MylistPocket's bundle has no NicoVideoApi gate,
        // so off www it threw a ReferenceError. Without the gate, fetch directly
        // (works where the API allows the page origin, fails normally elsewhere).
        if (location.host !== 'www.nicovideo.jp' && typeof NicoVideoApi !== 'undefined') {
            const diagnostic = typeof RequestDiagnostics === 'undefined' ? null : RequestDiagnostics.startRequest(url, params?.signal, params?.diagnosticActive);
            const gateOptions = params?.diagnosticActive ? { ...params } : params;
            if (gateOptions?.diagnosticActive) {
                delete gateOptions.diagnosticActive;
            }
            try {
                return NicoVideoApi.fetch(url, gateOptions).then(response => {
                    diagnostic?.response(response);
                    return response;
                }, error => { diagnostic?.failure(error); throw error; });
            }
            catch (error) {
                diagnostic?.failure(error);
                throw error;
            }
        }
        return this.abortableFetch(url, params);
    },
    jsonp: (() => {
        let callbackId = 0;
        const getFuncName = () => `JsonpCallback${callbackId++}`;
        let cw = null;
        const getFrame = () => {
            if (cw) {
                return cw;
            }
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
                win[funcName] = (result) => {
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
            const diagnostic = typeof RequestDiagnostics === 'undefined' ? null : RequestDiagnostics.startRequest(url);
            url = `${url}${url.includes('?') ? '&' : '?'}callback=${funcName}`;
            return createFunc(url, funcName).then(result => {
                diagnostic?.success();
                return result;
            }, error => { diagnostic?.failure(error); throw error; });
        };
    })()
};
//===END===
export {netUtil};
