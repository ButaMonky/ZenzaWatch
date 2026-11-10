// GENERATED FROM tools/typescript-stage1/nico-src/RequestDiagnostics.ts (Task991). Edit the .ts and run npm run nico:sync.
//===BEGIN===
const RequestDiagnostics = (() => {
    const labels = {
        'video-info': '動画情報', 'comment-read': 'コメント取得', 'comment-key': 'コメント取得キー',
        'video-session': '再生セッション', 'session-state': '再生セッションの維持',
        storyboard: '場面画像の情報', search: '検索', mylist: 'マイリスト', playlist: 'プレイリスト',
        like: 'いいね', tags: 'タグ', 'nico-api': 'ニコニコAPI'
    };
    const activeTickets = new Map();
    const failures = new Map();
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
        const codes = ['WATCH_SCHEMA', 'WATCH_PAGE_SCHEMA', 'WATCH_PAGE_META_MISSING', 'RESPONSE_SCHEMA', 'STORYBOARD_SCHEMA',
            'BAD_REQUEST', 'INVALID_PARAMETER', 'EXPIRED_TOKEN', 'FORBIDDEN', 'NOT_FOUND', 'TOO_MANY_REQUESTS', 'INTERNAL_SERVER_ERROR', 'UNAUTHORIZED'];
        const fields = {
            ...(typeof status === 'number' && Number.isInteger(status) && status >= 100 && status <= 599 ? { statusCode: status } : {}),
            ...(typeof e.errorCode === 'string' ? { errorCode: codes.includes(e.errorCode) ? e.errorCode : 'OTHER' } : {})
        };
        if (e.name === 'AbortError' || e.reason === 'cancelled') {
            return { reason: 'cancelled' };
        }
        if (e.reason === 'session-closed') {
            return { reason: 'session-closed' };
        }
        if (e.name === 'timeout' || e.name === 'TimeoutError' || e.kind === 'timeout') {
            return { reason: 'timeout', ...fields };
        }
        if (status === 404 || e.reason === 'not found') {
            return { reason: 'not-found', ...fields };
        }
        if (status === 401 || status === 403 || ['forbidden', 'need payment', 'premium only', 'member only'].includes(String(e.reason))) {
            return { reason: 'permission', ...fields };
        }
        if (e.reason === 'not supported') {
            return { reason: 'unavailable', ...fields };
        }
        if (e.kind === 'schema' || e.name === 'SyntaxError' || e.reason === 'watch api' ||
            ['WATCH_SCHEMA', 'WATCH_PAGE_SCHEMA', 'WATCH_PAGE_META_MISSING', 'RESPONSE_SCHEMA', 'STORYBOARD_SCHEMA'].includes(String(e.errorCode))) {
            return { reason: 'schema', ...fields };
        }
        if (fields.statusCode) {
            return { reason: 'http', ...fields };
        }
        return { reason: 'network' };
    };
    const begin = (operation, scope, phase, active = () => true) => {
        if (!Object.prototype.hasOwnProperty.call(labels, operation) || !['transport', 'response', 'session'].includes(phase)) {
            return noop;
        }
        const started = Date.now();
        const key = 'diag-' + operation + '-' + phase + '-' + scopeId(scope);
        const previous = activeTickets.get(key);
        if (previous) {
            previous.superseded = true;
        }
        const state = { superseded: false };
        activeTickets.set(key, state);
        let finished = false;
        const emit = (outcome, failure) => {
            if (finished) {
                return;
            }
            finished = true;
            if (activeTickets.get(key) === state) {
                activeTickets.delete(key);
            }
            try {
                if (!active() || state.superseded || failure.reason === 'cancelled') {
                    return;
                }
                if (outcome === 'recovered') {
                    const seen = failures.get(key);
                    failures.delete(key);
                    if (seen === undefined || started - seen >= 600000) {
                        return;
                    }
                }
                else {
                    failures.delete(key);
                    failures.set(key, Date.now());
                    while (failures.size > 100) {
                        failures.delete(failures.keys().next().value);
                    }
                }
                const reasonLabels = {
                    timeout: '時間切れ', 'not-found': '対象が見つかりません', permission: '権限・ログイン状態を要確認',
                    schema: '応答の形式を読み取れません', http: 'サーバーからエラー応答', network: '処理に失敗しました',
                    'session-closed': 'セッションが異常終了しました', unavailable: 'この動画の再生方式には未対応です'
                };
                sink?.({ key, operation, phase, outcome, ...failure,
                    message: labels[operation] + '（' + (phase === 'transport' ? '通信' : phase === 'response' ? '応答の確認' : '処理') + '）' +
                        (outcome === 'recovered' ? '：復旧しました' : '：' + reasonLabels[failure.reason]),
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
            return /^(nvapi|api|public\.api)\./.test(url.hostname) || /(^|\/)api(\/|$)/.test(p) ? 'nico-api' : null;
        }
        catch (_) {
            return null;
        }
    };
    const startRequest = (url, signal, active = () => true) => {
        const operation = operationFor(url);
        return operation ? begin(operation, String(url), 'transport', () => !signal?.aborted && active()) : noop;
    };
    const setSink = (next) => { sink = next; };
    return { begin, startRequest, setSink };
})();
//===END===
export {RequestDiagnostics};
