// GENERATED FROM tools/typescript-stage1/hls-src/HlsLibrary.ts (Task997). Edit TypeScript and run npm run hls:sync.
//===BEGIN===
const HlsLibrary = (() => {
    const version = '1.7.3';
    const url = 'https://cdn.jsdelivr.net/npm/hls.js@1.7.3';
    let pending = null;
    const load = (timeoutMs = 15000) => {
        if (window.Hls && typeof window.Hls.isSupported === 'function')
            return Promise.resolve(window.Hls);
        if (pending)
            return pending;
        const script = document.createElement('script');
        script.id = 'ZenzaWatchIntegratedHlsLibrary';
        script.src = url;
        const request = new Promise((resolve, reject) => {
            let done = false;
            const finish = (error) => {
                if (done)
                    return;
                done = true;
                clearTimeout(timer);
                script.onload = script.onerror = null;
                if (error) {
                    script.remove();
                    reject(error);
                }
                else
                    resolve(window.Hls);
            };
            const timer = setTimeout(() => finish(new Error('HLS library loading timed out')), timeoutMs);
            script.onload = () => finish(window.Hls && typeof window.Hls.isSupported === 'function' ? undefined : new Error('HLS library unavailable'));
            script.onerror = () => finish(new Error('HLS library loading failed'));
            try {
                (document.head || document.documentElement).append(script);
            }
            catch (_) {
                finish(new Error('HLS library loading failed'));
            }
        });
        pending = request;
        void request.catch(() => { if (pending === request)
            pending = null; });
        return request;
    };
    return { version, url, load };
})();
//===END===
export {HlsLibrary};
