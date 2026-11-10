// GENERATED FROM tools/typescript-stage1/nico-src/RequestDiagnostics.ts (Task991). Edit the .ts and run npm run nico:sync.
//===BEGIN===
const RequestDiagnostics = (() => {
    const labels = {
        'video-info': '動画情報', 'comment-read': 'コメント取得', 'comment-key': 'コメント取得キー',
        'video-session': '再生セッション', 'session-state': '再生セッションの維持',
        storyboard: '場面画像の情報', search: '検索', mylist: 'マイリスト', playlist: 'プレイリスト',
        like: 'いいね', tags: 'タグ', 'nico-api': 'ニコニコAPI'
    };
    const states = new Map();
    let serial = 0;
    let sink;
    const noop = { success() { }, failure() { }, response() { } };
    // Only this ephemeral scope digest is retained. URLs, queries and bodies are
    // never forwarded to the sink, used in messages, or saved by the journal.
    const scopeId = (value) => {
        let a = 2166136261, b = 5381;
        for (let i = 0; i < value.length; i++) {
            a = Math.imul(a ^ value.charCodeAt(i), 16777619);
            b = Math.imul(b, 33) ^ value.charCodeAt(i);
        }
        return (a >>> 0).toString(36) + '-' + (b >>> 0).toString(36);
    };
    const classify = (error) => {
        const outer = error && typeof error === 'object' ? error : {};
        const e = outer.result && typeof outer.result === 'object' ? outer.result : outer;
        const status = e.statusCode ?? e.status ?? e.httpStatus;
        const fields = typeof status === 'number' && Number.isInteger(status) && status >= 100 && status <= 599 ? { statusCode: status } : {};
        if (e.name === 'AbortError') {
            return { reason: 'cancelled' };
        }
        if (e.name === 'timeout' || e.name === 'TimeoutError' || e.kind === 'timeout') {
            return { reason: 'timeout', ...fields };
        }
        if (status === 404 || e.reason === 'not found') {
            return { reason: 'not-found', ...fields };
        }
        if (status === 401 || status === 403 || e.reason === 'forbidden') {
            return { reason: 'permission', ...fields };
        }
        if (e.kind === 'schema' || e.name === 'SyntaxError' ||
            ['WATCH_SCHEMA', 'WATCH_PAGE_SCHEMA', 'WATCH_PAGE_META_MISSING', 'RESPONSE_SCHEMA', 'STORYBOARD_SCHEMA'].includes(String(e.errorCode))) {
            return { reason: 'schema', ...fields };
        }
        if (fields.statusCode) {
            return { reason: 'http', ...fields };
        }
        return { reason: 'network' };
    };
    const begin = (operation, scope, phase, active = () => true) => {
        if (!Object.prototype.hasOwnProperty.call(labels, operation)) {
            return noop;
        }
        const started = Date.now();
        const key = 'diag-' + operation + '-' + phase + '-' + scopeId(scope);
        const previous = states.get(key);
        const state = { serial: ++serial, failed: !!previous?.failed && started - previous.seen < 600000, seen: started };
        states.delete(key);
        states.set(key, state);
        while (states.size > 100) {
            states.delete(states.keys().next().value);
        }
        let finished = false;
        const emit = (outcome, failure) => {
            if (finished) {
                return;
            }
            finished = true;
            try {
                if (!active() || states.get(key) !== state || failure.reason === 'cancelled') {
                    return;
                }
                if (outcome === 'recovered' && !state.failed) {
                    return;
                }
                state.failed = outcome === 'failed';
                const reasonLabels = {
                    timeout: '時間切れ', 'not-found': '対象が見つかりません', permission: '権限・ログイン状態を要確認',
                    schema: '応答の形式を読み取れません', http: 'サーバーからエラー応答', network: '処理に失敗しました'
                };
                sink?.({ key, operation, phase, outcome, ...failure,
                    message: labels[operation] + (outcome === 'recovered' ? '：復旧しました' : '：' + reasonLabels[failure.reason]),
                    elapsedMs: Math.max(0, Math.min(86400000, Date.now() - started)) });
            }
            catch (_) { /* Diagnostic observers must never change playback. */ }
        };
        const failure = (error) => {
            try {
                emit('failed', classify(error));
            }
            catch (_) { /* untrusted error properties */ }
        };
        return {
            success: () => emit('recovered', { reason: 'recovered' }), failure,
            response: response => {
                if (typeof response?.status === 'number' && response.status >= 400) {
                    failure({ status: response.status });
                }
                else {
                    emit('recovered', { reason: 'recovered' });
                }
            }
        };
    };
    const operationFor = (value) => {
        try {
            const url = new URL(String(value), 'https://www.nicovideo.jp');
            if (!/(^|\.)nicovideo\.jp$/.test(url.hostname)) {
                return null;
            }
            const p = url.pathname;
            if (/\/watch\//.test(p)) {
                return 'video-info';
            }
            if (/\/comment\/keys\/thread/.test(p)) {
                return 'comment-key';
            }
            if (/\/threads(?:\/|$)/.test(p)) {
                return 'comment-read';
            }
            if (/\/access-rights\//.test(p)) {
                return 'video-session';
            }
            if (/storyboard/.test(p)) {
                return 'storyboard';
            }
            if (/\/search(?:\/|$)/.test(p)) {
                return 'search';
            }
            if (/mylist/.test(p)) {
                return 'mylist';
            }
            if (/playlist/.test(p)) {
                return 'playlist';
            }
            if (/\/likes(?:\/|$)/.test(p)) {
                return 'like';
            }
            if (/\/tags(?:\/|$)/.test(p)) {
                return 'tags';
            }
            if (/\/videos(?:\/|$)/.test(p)) {
                return 'video-info';
            }
            return url.hostname === 'nvapi.nicovideo.jp' || /(^|\/)api(\/|$)/.test(p) ? 'nico-api' : null;
        }
        catch (_) {
            return null;
        }
    };
    const startRequest = (url, signal) => {
        const operation = operationFor(url);
        return operation ? begin(operation, String(url), 'transport', () => !signal?.aborted) : noop;
    };
    const setSink = (next) => { sink = next; };
    return { begin, startRequest, setSink };
})();
//===END===
export {RequestDiagnostics};
