"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.classifyWatchPage = classifyWatchPage;
exports.createPreflight = createPreflight;
const targets_1 = require("./targets");
// Keep only status + expiry. Never retain watch responses, auth keys or account data.
function classifyWatchPage(html, status, Parser) {
    if (status >= 500 || html.length > 5000000)
        return 'unknown';
    try {
        const meta = html.match(/<meta\b[^>]*\bname\s*=\s*(["'])server-response\1[^>]*>/i)?.[0];
        if (!meta)
            return 'unknown';
        const raw = new Parser().parseFromString(meta, 'text/html').querySelector('meta[name="server-response"]')?.getAttribute('content');
        if (!raw)
            return 'unknown';
        const response = JSON.parse(raw)?.data?.response, data = response?.$watchV4?.data || response;
        const code = response?.errorCode || data?.errorCode;
        if (code === 'NOT_FOUND' || code === 'FORBIDDEN')
            return 'unavailable';
        if (code || !data?.video || !data?.client)
            return 'unknown';
        const media = data.media;
        if (response?.$watchV4 ? media?.accessRightKey && Array.isArray(media?.contents?.videos) && media.contents.videos.length : media?.domand?.accessRightKey)
            return 'available';
    }
    catch { }
    return 'unknown';
}
function createPreflight(fetcher, Parser, now = Date.now) {
    const cache = new Map(), pending = new Map();
    const queue = [], controllers = new Set();
    let active = 0, disposed = false;
    function pump() {
        while (!disposed && active < 2 && queue.length) {
            const task = queue.shift(), controller = new AbortController();
            active++;
            controllers.add(controller);
            void (async () => {
                let result = 'unknown';
                try {
                    const r = await fetcher('https://www.nicovideo.jp/watch/' + encodeURIComponent(task.id), { credentials: 'include', timeout: 8000, signal: controller.signal });
                    result = classifyWatchPage(await r.text(), r.status, Parser);
                }
                catch { }
                controllers.delete(controller);
                active--;
                pending.delete(task.id);
                if (!disposed) {
                    cache.delete(task.id);
                    cache.set(task.id, { result, until: now() + (result === 'unknown' ? 15000 : 300000) });
                    while (cache.size > 100)
                        cache.delete(cache.keys().next().value);
                }
                task.resolve(disposed ? 'unknown' : result);
                pump();
            })();
        }
    }
    return { check(id) {
            if (disposed || !(0, targets_1.validVideoId)(id))
                return Promise.resolve('unknown');
            const hit = cache.get(id);
            if (hit && hit.until > now())
                return Promise.resolve(hit.result);
            const running = pending.get(id);
            if (running)
                return running;
            if (pending.size >= 100)
                return Promise.resolve('unknown');
            let resolve;
            const promise = new Promise(r => resolve = r);
            pending.set(id, promise);
            queue.push({ id, resolve });
            pump();
            return promise;
        }, dispose() { disposed = true; for (const c of controllers)
            c.abort(); for (const task of queue)
            task.resolve('unknown'); queue.length = 0; pending.clear(); cache.clear(); } };
}
