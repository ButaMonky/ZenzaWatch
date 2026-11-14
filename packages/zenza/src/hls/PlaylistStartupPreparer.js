// GENERATED FROM tools/typescript-stage1/nico-src/PlaylistStartupPreparer.ts (Task997). Edit TypeScript and run npm run hls:sync.
//===BEGIN===
/** セッション接続結果から期限（epoch ms）を読み取る。形式が違っても失敗しない。 */
const sessionExpiresAt = (sessionInfo) => {
    const info = sessionInfo;
    const raw = info?.lastResponse?.data?.expireTime;
    if (typeof raw !== 'string' && typeof raw !== 'number')
        return undefined;
    const t = typeof raw === 'number' ? raw : Date.parse(raw);
    return Number.isFinite(t) && t > 0 ? t : undefined;
};
class PrepareFailure extends Error {
    stage;
    cause;
    constructor(stage, message, cause) {
        super(message);
        this.name = 'PrepareFailure';
        this.stage = stage;
        this.cause = cause;
    }
}
/** Secure diagnostics: include only allowlisted fields, never raw nested request data. */
const describeError = (error) => {
    const seen = new WeakSet();
    const sanitize = (value, limit = 300) => String(value ?? '').replace(/https?:\/\/[^\s"']+/gi, (value) => {
        try {
            const url = new URL(value);
            // Tokens can occur in either path or query; always discard the query.
            return url.origin + url.pathname.replace(/[^/]{24,}/g, '…');
        }
        catch (_) {
            return '[url]';
        }
    }).slice(0, limit);
    const summarize = (value, depth) => {
        if (value !== null && typeof value === 'object') {
            if (seen.has(value) || depth > 3)
                return { name: 'Error', message: 'nested error omitted' };
            seen.add(value);
        }
        const e = value;
        const safeName = typeof e?.name === 'string' && /^[a-z0-9_-]{1,80}$/i.test(e.name) ? e.name : 'Error';
        const out = { name: safeName, message: sanitize(e?.message ?? value) };
        if (typeof e?.stage === 'string' && /^[a-z][a-z0-9-]{0,60}$/i.test(e.stage))
            out.stage = e.stage;
        if (e?.detail !== null && typeof e?.detail === 'object' && !Array.isArray(e.detail)) {
            const raw = e.detail;
            const detail = {};
            if (typeof raw.stage === 'string' && /^[a-z][a-z0-9-]{0,60}$/i.test(raw.stage))
                detail.stage = raw.stage;
            if (typeof raw.reason === 'string')
                detail.reason = sanitize(raw.reason, 100);
            if (typeof raw.host === 'string' && /^[a-z0-9.-]{1,120}$/i.test(raw.host))
                detail.host = raw.host;
            if (typeof raw.status === 'number' && Number.isInteger(raw.status) && raw.status >= 100 && raw.status <= 599)
                detail.status = raw.status;
            if (typeof raw.bytes === 'number' && Number.isFinite(raw.bytes) && raw.bytes >= 0)
                detail.bytes = raw.bytes;
            if (typeof raw.message === 'string')
                detail.message = sanitize(raw.message);
            if (Object.keys(detail).length)
                out.detail = detail;
        }
        if (e?.cause && depth < 3)
            out.cause = summarize(e.cause, depth + 1);
        return out;
    };
    return summarize(error, 0);
};
const createPlaylistStartupPreparer = (deps) => {
    const now = deps.now ?? (() => performance.now());
    return async (watchId, signal) => {
        const settings = deps.settingsKey();
        const started = now();
        let stage = 'metadata';
        const seconds = () => Number(((now() - started) / 1000).toFixed(3));
        const report = (event, extra = {}) => {
            try {
                deps.log?.(event, { videoId: watchId, stage, seconds: seconds(), ...extra });
            }
            catch (_) { /* ignore */ }
        };
        const check = () => { if (signal.aborted)
            throw new Error('Prefetch canceled'); };
        report('start');
        try {
            check();
            const data = await deps.loadVideoInfo(watchId, signal);
            check();
            stage = 'eligibility';
            const info = deps.createModel(data);
            const serverType = deps.getConfig('videoServerType');
            const autoDisableNew = !!deps.getConfig('autoDisableNew');
            if (!info.isDomandAvailable)
                throw new PrepareFailure(stage, 'domand unavailable');
            if (deps.isNgVideo(info))
                throw new PrepareFailure(stage, 'ng video');
            if (!info.isDomandOnly && (serverType === 'dmc' || (autoDisableNew && info.maybeBetterQualityServerType === 'dmc')))
                throw new PrepareFailure(stage, 'dmc preferred');
            stage = 'session';
            const session = await deps.createSession(info, deps.getConfig('domandVideoQuality'));
            let closed = false;
            let bytes = null;
            const close = () => {
                if (!closed) {
                    closed = true;
                    void Promise.resolve().then(() => session.close()).catch(() => { });
                }
                bytes?.dispose();
            };
            const abort = () => close();
            signal.addEventListener('abort', abort, { once: true });
            try {
                check();
                stage = 'connect';
                const sessionInfo = await session.connect();
                check();
                stage = 'startup-media';
                bytes = await deps.prepareBytes(sessionInfo.url, signal);
                check();
                const preparedBytes = bytes;
                let companions = null;
                if (deps.prepareCompanions) {
                    try {
                        companions = await deps.prepareCompanions(info, signal);
                    }
                    catch (error) {
                        check();
                        report('companions-failed', { error: describeError(error) });
                    }
                }
                check();
                // Only expose the bounded remaining lifetime, never the signed session URL.
                const expiresAt = sessionExpiresAt(sessionInfo);
                const expiresInSec = typeof expiresAt === 'number' ? Math.round((expiresAt - Date.now()) / 1000) : -1;
                report('prepared', { bytes: preparedBytes.bytes, startLevel: preparedBytes.startLevel, stages: preparedBytes.stages,
                    companions: companions ? Object.keys(companions).join(',') : '', expiresInSec });
                const prepared = { watchId, data, session, sessionInfo, bytes: preparedBytes, settings,
                    expiresAt, companions, adopted: false,
                    dispose() { if (!this.adopted)
                        close(); } };
                return prepared;
            }
            catch (error) {
                close();
                throw error;
            }
            finally {
                signal.removeEventListener('abort', abort);
            }
        }
        catch (error) {
            report(signal.aborted ? 'canceled' : 'failed', signal.aborted ? {} : { error: describeError(error) });
            throw error;
        }
    };
};
//===END===
export {createPlaylistStartupPreparer,describeError};
