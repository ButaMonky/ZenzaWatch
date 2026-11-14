// GENERATED FROM tools/typescript-stage1/nico-src/PrefetchReporter.ts (Task997). Edit TypeScript and run npm run hls:sync.
//===BEGIN===
/** Journal の details 値はコード形式のみ許可されるため、それ以外を落とす。 */
const codeValue = (value) => {
    if (typeof value !== 'string')
        return undefined;
    const normalized = value.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
    return normalized || undefined;
};
const errorDetail = (described) => (described.detail && typeof described.detail === 'object' ? described.detail : described);
/** 失敗内容を人が読める一行にする（例: "video-init / HTTP error 403 / asset.domand.nicovideo.jp"）。 */
const describeFailure = (described) => {
    const d = errorDetail(described);
    const parts = [];
    if (typeof d.stage === 'string')
        parts.push(d.stage);
    const reason = typeof d.reason === 'string' ? d.reason : typeof described.message === 'string' ? described.message : '';
    if (reason)
        parts.push(typeof d.status === 'number' ? `${reason} ${d.status}` : reason);
    if (typeof d.host === 'string')
        parts.push(d.host);
    return parts.join(' / ') || '原因不明';
};
const createPrefetchReporter = (deps) => {
    const log = (name, payload) => {
        try {
            if (deps.diagnostics())
                deps.console(name, payload);
        }
        catch (_) { /* 診断は再生に影響させない */ }
    };
    const mode = () => {
        try {
            const value = deps.notifyMode();
            return value === 'off' || value === 'popup' ? value : 'journal';
        }
        catch (_) {
            return 'journal';
        }
    };
    const record = (entry) => {
        if (mode() === 'off')
            return;
        try {
            deps.record(entry);
        }
        catch (_) { /* 記録失敗は無視する */ }
    };
    const notifiedFinalFailure = new Set();
    const failureDetails = (described, attempt, willRetry) => {
        const d = errorDetail(described);
        const details = { operation: 'playlist', event: 'prefetch-failed', retryScheduled: willRetry };
        const phase = codeValue(d.stage);
        if (phase)
            details.phase = phase;
        const kind = codeValue(d.reason);
        if (kind)
            details.kind = kind;
        if (typeof d.status === 'number')
            details.httpStatus = d.status;
        if (typeof attempt === 'number')
            details.attempt = attempt;
        const errorName = codeValue(described.name);
        if (errorName)
            details.errorName = errorName;
        return details;
    };
    return {
        /** PlaylistStartupPreparer の log コールバックを接続する。 */
        prepareLog(event, payload) {
            log('ZENZA_PREFETCH_PREPARE', { event, ...payload });
            if (event !== 'prepared')
                return;
            const videoId = String(payload.videoId ?? '');
            const bytes = typeof payload.bytes === 'number' ? payload.bytes : 0;
            const seconds = typeof payload.seconds === 'number' ? payload.seconds : 0;
            const details = { operation: 'playlist', event: 'prefetch-ready' };
            if (bytes > 0)
                details.count = bytes;
            if (seconds > 0)
                details.elapsedMs = Math.round(seconds * 1000);
            const expiresInSec = typeof payload.expiresInSec === 'number' && Number.isFinite(payload.expiresInSec) ? payload.expiresInSec : -1;
            const expiryText = expiresInSec >= 0 ? `・有効期限あと${Math.round(expiresInSec / 60)}分` : '・有効期限不明';
            record({ category: 'player', level: 'info', videoId, source: 'prefetch', details,
                message: `次の動画の先頭部分を先読みしました（${videoId}${bytes ? '・' + (bytes / 1024 / 1024).toFixed(1) + 'MB' : ''}${expiryText}）` });
        },
        /** PlaylistPreloader の onEvent を接続する。 */
        schedulerEvent(event) {
            if (event.type !== 'ready') {
                const payload = { event: event.type, videoId: event.id };
                if (event.reason !== undefined)
                    payload.reason = event.reason;
                if (event.readyId !== undefined)
                    payload.readyId = event.readyId;
                if (event.attempt !== undefined)
                    payload.attempt = event.attempt;
                if (event.willRetry !== undefined)
                    payload.willRetry = event.willRetry;
                if (event.error !== undefined)
                    payload.error = deps.describe(event.error);
                log('ZENZA_PREFETCH_EVENT', payload);
            }
            if (event.type === 'timeout') {
                record({ category: 'player', level: 'warning', videoId: event.id, source: 'prefetch',
                    message: `次の動画の先読みが時間内に終わりませんでした（${event.id}）。通常の読み込みで再生します`,
                    details: { operation: 'playlist', event: 'prefetch-timeout' } });
                return;
            }
            if (event.type !== 'failed')
                return;
            const described = deps.describe(event.error);
            const failure = describeFailure(described);
            const willRetry = event.willRetry === true;
            record({ category: 'player', level: willRetry ? 'warning' : 'error', videoId: event.id, source: 'prefetch',
                message: willRetry ?
                    `次の動画の先読みに失敗しました（${event.id}・${failure}）。少し待って再試行します` :
                    `次の動画の先読みに失敗しました（${event.id}・${failure}）。通常の読み込みで再生します`,
                details: failureDetails(described, event.attempt, willRetry) });
            if (!willRetry && mode() === 'popup' && !notifiedFinalFailure.has(event.id)) {
                notifiedFinalFailure.add(event.id);
                if (notifiedFinalFailure.size > 32)
                    notifiedFinalFailure.delete(notifiedFinalFailure.values().next().value);
                try {
                    deps.warning(`次の動画の先読みに失敗しました（${event.id}）。通常の読み込みで再生します`);
                }
                catch (_) { /* 通知失敗は無視する */ }
            }
        },
        /** 準備完了（検証版ではポップアップ、通常版ではコンソールのみ）。 */
        ready(videoId, popup = false) {
            log('ZENZA_PREFETCH_READY', { videoId, event: 'startup-ready' });
            if (!(popup || deps.diagnostics()) || mode() === 'off')
                return;
            try {
                deps.notify(`次の動画の先読みが完了しました（${videoId}）`);
            }
            catch (_) { /* 通知失敗は再生に影響させない */ }
        },
        /**
         * 先読み済みデータで再生できたときの通知。
         * cacheHits が 0 のときは冒頭データを使えていないので文言を分ける。
         * popup が false、または通知設定が off のときは画面に出さない。
         */
        hit(videoId, seconds, cacheHits, popup) {
            const shown = Number.isFinite(seconds) && seconds > 0 ? seconds.toFixed(2) : '?';
            const text = cacheHits > 0 ?
                `先読みが効きました（${shown}秒で再生開始）` :
                `先読み（準備のみ）で再生しました（${shown}秒で再生開始）`;
            const details = { operation: 'playlist', event: 'prefetch-hit' };
            if (Number.isFinite(seconds) && seconds > 0)
                details.elapsedMs = Math.round(seconds * 1000);
            if (cacheHits > 0)
                details.count = cacheHits;
            record({ category: 'player', level: 'info', videoId, source: 'prefetch', details,
                message: `${text}（${videoId}）` });
            if (!popup || mode() === 'off')
                return;
            try {
                deps.notify(text);
            }
            catch (_) { /* 通知失敗は再生に影響させない */ }
        },
        /** 先読みを使わずに再生したときの秒数通知（比較用。設定がONのときだけ画面に出す）。 */
        miss(videoId, seconds, popup) {
            const shown = Number.isFinite(seconds) && seconds > 0 ? seconds.toFixed(2) : '?';
            const text = `先読みなしで再生しました（${shown}秒で再生開始）`;
            const details = { operation: 'playlist', event: 'prefetch-miss' };
            if (Number.isFinite(seconds) && seconds > 0)
                details.elapsedMs = Math.round(seconds * 1000);
            record({ category: 'player', level: 'info', videoId, source: 'prefetch', details,
                message: `${text}（${videoId}）` });
            if (!popup || mode() === 'off')
                return;
            try {
                deps.notify(text);
            }
            catch (_) { /* 通知失敗は再生に影響させない */ }
        },
        /** Prepared session close to expiry is rejected before playback adoption. */
        staleAdoption(videoId) {
            log('ZENZA_PREFETCH_EVENT', { event: 'stale-adoption', videoId });
            record({ category: 'player', level: 'warning', videoId, source: 'prefetch',
                message: `先読みデータの期限が近いか切れているため、通常の読み込みで再生します（${videoId}）`,
                details: { operation: 'playlist', event: 'prefetch-stale' } });
        },
        /** 再生開始時の計測（検証版のみ）。 */
        timing(payload) {
            log('ZENZA_PREFETCH_TIMING', payload);
        }
    };
};
//===END===
export {createPrefetchReporter};
