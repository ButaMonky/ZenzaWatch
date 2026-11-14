// GENERATED FROM tools/typescript-stage1/hls-src/HlsStartupPrefetch.ts (Task997). Edit TypeScript and run npm run hls:sync.
//===BEGIN===
class PrefetchError extends Error {
    detail;
    constructor(detail) {
        super('prefetch ' + detail.reason);
        this.name = 'PrefetchError';
        this.detail = detail;
    }
}
const MAX_PREFETCH_BYTES = 16 * 1024 * 1024;
const MAX_TEXT_BYTES = 256 * 1024;
const MAX_REQUESTS = 12;
/** hls.js の abrBandWidthFactor 相当。推定速度に余裕を持たせて選ぶ。 */
const BANDWIDTH_FACTOR = 0.8;
const DOMAND_HOSTS = new Set(['delivery.domand.nicovideo.jp', 'asset.domand.nicovideo.jp']);
const isAllowedPrefetchUrl = (u, sourceHost) => u.protocol === 'https:' && !u.port && !u.username && !u.password &&
    DOMAND_HOSTS.has(sourceHost) && DOMAND_HOSTS.has(u.hostname);
const parseAttributes = (line) => {
    const out = {};
    for (const m of line.matchAll(/([A-Z0-9-]+)=("[^"]*"|[^,]*)/g)) {
        const key = m[1], value = m[2];
        if (key !== undefined && value !== undefined)
            out[key] = value.replace(/^"|"$/g, '');
    }
    return out;
};
/** hls.js はレベルをビットレート昇順に並べるので、同じ並びでのインデックスを返す。 */
const chooseStartVariant = (variants, startLevel, bandwidthEstimate) => {
    const sorted = variants.slice().sort((a, b) => a.bandwidth - b.bandwidth || a.index - b.index);
    if (!sorted.length)
        return null;
    let level = 0;
    if (typeof startLevel === 'number' && Number.isFinite(startLevel) && startLevel >= 0) {
        level = Math.min(Math.round(startLevel), sorted.length - 1);
    }
    else if (typeof bandwidthEstimate === 'number' && bandwidthEstimate > 0) {
        const budget = bandwidthEstimate * BANDWIDTH_FACTOR;
        for (let i = 0; i < sorted.length; i++) {
            const v = sorted[i];
            if (v && Number.isFinite(v.bandwidth) && v.bandwidth <= budget)
                level = i;
        }
    }
    const variant = sorted[level];
    return variant ? { variant, level } : null;
};
const HlsPrefetch = (() => {
    let active = null;
    let expires;
    const clear = () => {
        active?.dispose();
        active = null;
        clearTimeout(expires);
        expires = undefined;
    };
    const prepare = async (source, signal, options = {}) => {
        const fetcher = options.fetcher ?? ((url, init) => fetch(url, init));
        const now = options.now ?? (() => performance.now());
        const maxBytes = options.maxBytes ?? MAX_PREFETCH_BYTES;
        const sourceHost = new URL(source).hostname;
        const entries = new Map();
        const stages = [];
        let bytes = 0, requests = 0, stage = 'master';
        const fail = (reason, extra = {}) => new PrefetchError({ stage, reason, ...extra });
        const check = () => { if (signal.aborted)
            throw new Error('prefetch canceled'); };
        const resolve = (uri, base) => {
            let u;
            try {
                u = new URL(uri, base);
            }
            catch (_) {
                throw fail('invalid URL');
            }
            if (!isAllowedPrefetchUrl(u, sourceHost))
                throw fail('unsupported URL', { host: u.hostname });
            return u.href;
        };
        const get = async (url, text, aliases = []) => {
            check();
            const prior = entries.get(url);
            if (prior)
                return prior.data;
            if (++requests > MAX_REQUESTS)
                throw fail('request limit');
            const target = resolve(url, source);
            const host = new URL(target).hostname;
            const begin = now();
            let response;
            try {
                response = await fetcher(target, { credentials: 'include', signal, cache: 'no-store', priority: 'low', redirect: 'error' });
            }
            catch (error) {
                check();
                throw fail('network error', { host, message: String(error?.message ?? error) });
            }
            check();
            if (response.url)
                resolve(response.url, source);
            if (!response.ok || response.status === 206) {
                void response.body?.cancel().catch(() => { });
                throw fail('HTTP error', { host, status: response.status });
            }
            const limit = text ? MAX_TEXT_BYTES : maxBytes - bytes;
            const length = Number(response.headers.get('content-length'));
            if (length > limit) {
                void response.body?.cancel().catch(() => { });
                throw fail('size limit', { host, bytes: length });
            }
            if (!response.body)
                throw fail('streaming unavailable', { host });
            const reader = response.body.getReader();
            const chunks = [];
            let size = 0;
            const abort = () => { void reader.cancel().catch(() => { }); };
            signal.addEventListener('abort', abort, { once: true });
            try {
                for (;;) {
                    check();
                    const part = await reader.read();
                    check();
                    if (part.done)
                        break;
                    size += part.value.byteLength;
                    if (size > limit || bytes + size > maxBytes) {
                        await reader.cancel().catch(() => { });
                        throw fail('size limit', { host, bytes: size });
                    }
                    chunks.push(part.value);
                }
            }
            finally {
                signal.removeEventListener('abort', abort);
                try {
                    reader.releaseLock();
                }
                catch (_) { /* already released */ }
            }
            const data = new Uint8Array(size);
            let offset = 0;
            for (const chunk of chunks) {
                data.set(chunk, offset);
                offset += chunk.byteLength;
            }
            bytes += size;
            const entry = { data: data.buffer, url: response.url || target, elapsed: Math.max(1, now() - begin) };
            for (const key of new Set([url, target, ...aliases]))
                entries.set(key, entry);
            stages.push(stage);
            return entry.data;
        };
        const getText = async (url) => new TextDecoder().decode(await get(url, true));
        const media = async (url, kind) => {
            stage = `${kind}-playlist`;
            const text = await getText(url);
            if (!text.startsWith('#EXTM3U') || !text.includes('#EXT-X-ENDLIST') || /#EXT-X-(?:BYTERANGE|PART|SESSION-KEY)/.test(text))
                throw fail('unsupported media playlist');
            let map = null;
            let key = null;
            let segment = null;
            for (const raw of text.split(/\r?\n/)) {
                const line = raw.trim();
                if (line.startsWith('#EXT-X-MAP:')) {
                    const a = parseAttributes(line);
                    if (a.BYTERANGE || !a.URI)
                        throw fail('unsupported init range');
                    map = { href: resolve(a.URI, url), raw: a.URI };
                }
                else if (line.startsWith('#EXT-X-KEY:')) {
                    const a = parseAttributes(line);
                    if (a.METHOD === 'NONE') {
                        key = null;
                        continue;
                    }
                    if (a.METHOD !== 'AES-128' || !a.URI || (a.KEYFORMAT && a.KEYFORMAT !== 'identity'))
                        throw fail('unsupported encryption');
                    key = { href: resolve(a.URI, url), raw: a.URI };
                }
                else if (line && !line.startsWith('#')) {
                    segment = { href: resolve(line, url), raw: line };
                    break;
                }
            }
            if (!segment)
                throw fail('missing startup segment');
            // hls.js の context.url は絶対URLならプレイリストの文字列そのまま。正規化後と両方で引けるようにする。
            const alias = (r) => /^https:\/\//i.test(r.raw) ? [r.raw] : [];
            if (key) {
                stage = `${kind}-key`;
                await get(key.href, false, alias(key));
            }
            if (map) {
                stage = `${kind}-init`;
                await get(map.href, false, alias(map));
            }
            stage = `${kind}-segment`;
            await get(segment.href, false, alias(segment));
        };
        try {
            stage = 'master';
            const master = await getText(source);
            if (!master.startsWith('#EXTM3U'))
                throw fail('invalid playlist');
            if (master.includes('#EXT-X-SESSION-KEY'))
                throw fail('unsupported session key');
            const lines = master.split(/\r?\n/).map(s => s.trim());
            const variants = [];
            const audio = [];
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i] ?? '';
                if (line.startsWith('#EXT-X-MEDIA:'))
                    audio.push(parseAttributes(line));
                if (line.startsWith('#EXT-X-STREAM-INF:')) {
                    const a = parseAttributes(line), uri = lines[i + 1];
                    if (!uri || uri.startsWith('#'))
                        throw fail('invalid variant');
                    const v = { uri: resolve(uri, source), bandwidth: Number(a.BANDWIDTH) || Infinity, index: variants.length };
                    if (a.AUDIO)
                        v.audio = a.AUDIO;
                    variants.push(v);
                }
            }
            let startLevel = 0;
            if (!variants.length) {
                await media(source, 'media');
            }
            else {
                const choice = chooseStartVariant(variants, options.startLevel, options.bandwidthEstimate);
                if (!choice)
                    throw fail('invalid variant');
                startLevel = choice.level;
                const chosen = choice.variant;
                if (chosen.audio) {
                    const tracks = audio.filter(a => a.TYPE === 'AUDIO' && a['GROUP-ID'] === chosen.audio);
                    const track = tracks.find(a => a.DEFAULT === 'YES') ?? tracks[0];
                    if (!track)
                        throw fail('missing audio group');
                    if (track.URI)
                        await media(resolve(track.URI, source), 'audio');
                }
                await media(chosen.uri, 'video');
            }
            check();
            return { source, entries, bytes, startLevel, stages, hits: 0, dispose() { entries.clear(); } };
        }
        catch (error) {
            entries.clear();
            throw error;
        }
    };
    /** hls.js のローダーを包み、先読み済みURLはネットワークに出ずに即応答する。 */
    const wrapLoader = (Base) => {
        const Wrapped = class StartupLoader extends Base {
            cached = false;
            canceled = false;
            load(context, config, callbacks) {
                const hit = !context.rangeStart && !context.rangeEnd ? active?.entries.get(context.url) : undefined;
                if (!hit) {
                    super.load(context, config, callbacks);
                    return;
                }
                this.cached = true;
                if (active)
                    active.hits++;
                this.context = context;
                const data = context.responseType === 'arraybuffer' ? hit.data.slice(0) : new TextDecoder().decode(hit.data);
                const t = performance.now();
                Object.assign(this.stats, { aborted: false, loaded: hit.data.byteLength, total: hit.data.byteLength, retry: 0,
                    bwEstimate: hit.data.byteLength * 8000 / hit.elapsed });
                Object.assign(this.stats.loading, { start: t - hit.elapsed, first: t - hit.elapsed, end: t });
                queueMicrotask(() => {
                    if (this.canceled)
                        return;
                    callbacks.onSuccess({ url: hit.url, data, code: 200 }, this.stats, context, null);
                });
            }
            abort() { this.canceled = true; if (this.cached)
                this.stats.aborted = true; super.abort(); }
            destroy() { this.canceled = true; super.destroy(); }
        };
        return Wrapped;
    };
    return {
        prepare, wrapLoader, clear,
        /** 次動画の再生開始時に呼ぶ。45秒で自動破棄（長時間メモリに残さない）。 */
        activate(value) { clear(); active = value; expires = setTimeout(clear, 45000); },
        startLevel(source) { return active?.source === source ? active.startLevel : undefined; },
        /** 診断用: 再生開始時に、先読みデータが実際に hls.js から引かれたかを返す。 */
        hits(source) { return active?.source === source ? active.hits : 0; }
    };
})();
//===END===
export {HlsPrefetch};
