import {PopupMessage} from '../ui/PopupMessage';
import {sleep} from '../infra/sleep';
import {netUtil} from '../../../lib/src/infra/netUtil';
import {logSafe} from '../infra/logSafe';
import {CommentPostWire} from './CommentPostWire';
import {CommentReadAdapter} from './CommentReadAdapter';

const debug = {};

// GENERATED FROM tools/typescript-stage1/nico-src/ThreadLoader.ts (Task648). Edit the .ts and run npm run nico:sync.
//===BEGIN===

// Task 088（監査v2 ZW-056）: 送信内容・キー・本文・ユーザーID をログに出す時は logSafe.redact を通す
//@require logSafe
//@require CommentPostWire
//@require CommentReadAdapter

const { ThreadLoader } = (() => {
    const FRONT_ID = '6';
    const FRONT_VER = '0';
    const FORK_LABEL = {
        0: 'main',
        1: 'owner',
        2: 'easy',
        3: 'ai',
    };
    const challengeFailure = (reason, message) => ({ status: 'fail', reason, outcome: 'not-sent', message });
    let turnstileLoader = null;
    let challengeBusy = false;
    const loadTurnstile = () => {
        const client = window.turnstile;
        if (client && typeof client.render === 'function') {
            return Promise.resolve(client);
        }
        if (turnstileLoader) {
            return turnstileLoader;
        }
        turnstileLoader = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
            script.async = true;
            script.setAttribute('data-zenza-comment-challenge', '1');
            let done = false;
            const cleanup = () => {
                clearTimeout(loadTimer);
                script.onload = null;
                script.onerror = null;
            };
            const fail = () => {
                if (done) {
                    return;
                }
                done = true;
                cleanup();
                script.remove();
                reject(challengeFailure('challenge-unavailable', '追加認証の読み込みに失敗しました。公式プレイヤーから投稿してください'));
            };
            const loadTimer = setTimeout(fail, 15000);
            script.onerror = fail;
            script.onload = () => {
                if (done) {
                    return;
                }
                done = true;
                cleanup();
                const api = window.turnstile;
                if (!api || typeof api.render !== 'function') {
                    failAfterLoad();
                    return;
                }
                resolve(api);
            };
            const failAfterLoad = () => {
                script.remove();
                reject(challengeFailure('challenge-unavailable', '追加認証を開始できませんでした。公式プレイヤーから投稿してください'));
            };
            (document.head || document.body).appendChild(script);
        }).catch(error => { turnstileLoader = null; throw error; });
        return turnstileLoader;
    };
    const requestChallengeToken = (siteKey) => {
        if (challengeBusy) {
            return Promise.reject(challengeFailure('challenge-busy', '別のコメント認証が処理中です。完了後に投稿してください'));
        }
        if (typeof window === 'undefined' || typeof document === 'undefined' ||
            !document.body || !document.head) {
            return Promise.reject(challengeFailure('challenge-unavailable', '追加認証を表示できません。公式プレイヤーから投稿してください'));
        }
        // The browser hides regular page DOM behind a fullscreen <video>. Do not
        // create an inaccessible challenge or keep the user stuck until timeout.
        if (document.fullscreenElement?.tagName === 'VIDEO') {
            return Promise.reject(challengeFailure('challenge-unavailable', '動画そのものが全画面表示中です。全画面を解除してから、もう一度投稿してください（コメントは未送信です）'));
        }
        challengeBusy = true;
        const pending = new Promise((resolve, reject) => {
            const overlay = document.createElement('div');
            overlay.setAttribute('role', 'dialog');
            overlay.setAttribute('aria-modal', 'true');
            overlay.setAttribute('aria-label', 'コメント投稿の追加認証');
            overlay.setAttribute('data-zenza-comment-challenge', 'active');
            overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.78);display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box;';
            const panel = document.createElement('div');
            panel.style.cssText = 'width:360px;max-width:100%;box-sizing:border-box;border-radius:12px;padding:18px;color:#fff;background:#24262c;box-shadow:0 12px 40px rgba(0,0,0,.6);font:14px/1.6 sans-serif;';
            const heading = document.createElement('strong');
            heading.textContent = 'コメント投稿の本人確認';
            const info = document.createElement('p');
            info.textContent = 'ニコニコ動画から追加認証が要求されました。確認が完了すると元のコメントを1回だけ送信します。';
            const widget = document.createElement('div');
            widget.setAttribute('data-zenza-challenge-widget', '1');
            widget.style.cssText = 'min-height:66px;display:flex;justify-content:center;';
            const cancel = document.createElement('button');
            cancel.type = 'button';
            cancel.textContent = '中止（コメントは残します）';
            cancel.style.cssText = 'display:block;margin:12px auto 0;padding:7px 14px;border:1px solid #999;border-radius:6px;background:#353941;color:white;cursor:pointer;';
            panel.append(heading, info, widget, cancel);
            overlay.appendChild(panel);
            const fullscreen = document.fullscreenElement;
            const host = fullscreen && fullscreen.tagName !== 'VIDEO' ? fullscreen : document.body;
            host.appendChild(overlay);
            const previousFocus = document.activeElement;
            let finished = false;
            let api = null;
            let widgetId;
            const complete = (token, reason, message) => {
                if (finished) {
                    return;
                }
                finished = true;
                clearTimeout(challengeTimer);
                if (widgetId && api) {
                    try {
                        api.remove(widgetId);
                    }
                    catch (_error) { /* best-effort own widget cleanup */ }
                }
                overlay.remove();
                if (previousFocus && typeof previousFocus.focus === 'function') {
                    previousFocus.focus();
                }
                if (token !== null) {
                    resolve(token);
                }
                else {
                    reject(challengeFailure(reason, message));
                }
            };
            cancel.addEventListener('click', () => complete(null, 'challenge-cancelled', '追加認証を中止しました。コメントは送信していません'));
            // Task946: keyboard events within the authentication dialog belong to
            // the user/Turnstile. Do not let them reach Zenza's body-level playback
            // shortcuts; allow normal Tab and widget inputs (only Escape is handled).
            overlay.addEventListener('keydown', (event) => {
                event.stopPropagation();
                if (event.key === 'Escape') {
                    event.preventDefault();
                    complete(null, 'challenge-cancelled', '追加認証を中止しました。コメントは送信していません');
                }
            });
            overlay.addEventListener('keyup', event => event.stopPropagation());
            const challengeTimer = setTimeout(() => complete(null, 'challenge-timeout', '追加認証の待ち時間を超えました。コメントは送信していません'), 180000);
            cancel.focus();
            void loadTurnstile().then(client => {
                if (finished) {
                    return;
                }
                api = client;
                const id = client.render(widget, {
                    sitekey: siteKey,
                    callback: token => {
                        if (typeof token !== 'string' || !token.trim() || token.length > 2048) {
                            complete(null, 'challenge-unavailable', '追加認証の応答が無効です。公式プレイヤーから投稿してください');
                            return;
                        }
                        complete(token, 'challenge-unavailable', '');
                    },
                    'error-callback': () => complete(null, 'challenge-unavailable', '追加認証に失敗しました。公式プレイヤーから投稿してください'),
                    'expired-callback': () => complete(null, 'challenge-expired', '追加認証が期限切れになりました。もう一度投稿してください'),
                    'timeout-callback': () => complete(null, 'challenge-timeout', '追加認証が時間切れになりました。もう一度投稿してください')
                });
                widgetId = id;
                if (finished && id) {
                    try {
                        client.remove(id);
                    }
                    catch (_error) { /* best effort */ }
                }
                else if (!finished && (typeof id !== 'string' || !id)) {
                    complete(null, 'challenge-unavailable', '追加認証を表示できませんでした。公式プレイヤーから投稿してください');
                }
            }).catch(() => complete(null, 'challenge-unavailable', '追加認証の読み込みに失敗しました。公式プレイヤーから投稿してください'));
        });
        return pending.finally(() => { challengeBusy = false; });
    };
    // NICOCOMPAT-04 / Task452: validate a read response before changing any
    // current-video state. Never invent an empty list when the schema changes.
    // Error objects contain only stable codes, never the raw response or keys.
    const commentSchemaError = (reason) => ({ kind: 'schema', errorCode: 'RESPONSE_SCHEMA', reason });
    // Task498: type-checked external read adapter, loaded before ThreadLoader.
    // Task478: posting's header/body deadline is implemented in CommentPostWire.
    // No retries occur inside the transport, including unknown-acceptance outcomes.
    // Task215: privacy-safe, structured diagnostics for intermittent comment-post failures.
    // Keep enough information to reconstruct the failing phase from a copied console log,
    // but never log comment bodies, user IDs, cookies, keys, tokens or credentials.
    let commentPostDiagnosticSeq = 0;
    const safeStatusCode = (value) => {
        const status = Number(value);
        return Number.isInteger(status) && status >= 100 && status <= 599 ? status : undefined;
    };
    const safeErrorCode = (value) => typeof value === 'string' && /^[A-Z0-9_]{1,80}$/.test(value) ? value : undefined;
    const safeKind = (value) => typeof value === 'string' && /^[A-Za-z0-9_-]{1,80}$/.test(value) ? value : undefined;
    const getCommentPostFailureDetails = (error) => {
        const result = error && error.result !== undefined ? error.result : error;
        const details = {};
        const statusCode = safeStatusCode(result && (result.status !== undefined ? result.status : result.httpStatus));
        const errorCode = safeErrorCode(result && result.errorCode);
        const kind = safeKind((error && error.kind) || (result && result.kind));
        const errorName = safeKind(result && result.name);
        const retryAfterMs = Number(result && result.retryAfterMs);
        if (statusCode !== undefined) {
            details.statusCode = statusCode;
        }
        if (errorCode !== undefined) {
            details.errorCode = errorCode;
        }
        if (kind !== undefined) {
            details.kind = kind;
        }
        if (errorName !== undefined && errorName !== kind) {
            details.errorName = errorName;
        }
        if (Number.isFinite(retryAfterMs) && retryAfterMs >= 0) {
            details.retryAfterMs = retryAfterMs;
        }
        return details;
    };
    const createCommentPostDiagnostic = (msgInfo) => {
        const threadInfo = msgInfo && msgInfo.threadInfo || {};
        return {
            id: `cp-${++commentPostDiagnosticSeq}`,
            attempt: 1,
            videoId: threadInfo.videoId || (msgInfo && msgInfo.videoId) || null,
            threadId: threadInfo.threadId === undefined ? null : threadInfo.threadId,
            language: threadInfo.language || null
        };
    };
    const logCommentPostDiagnostic = (diagnostic, phase, event, details = {}) => {
        const safe = logSafe.redact({ ...diagnostic, phase, event, ...details });
        // Chrome's "Copy console message" collapses object arguments to "Object".
        // Add a flat JSON string built only from approved diagnostic fields.
        const copyable = {};
        for (const key of [
            'id', 'attempt', 'videoId', 'threadId', 'language', 'phase', 'event',
            'statusCode', 'errorCode', 'kind', 'errorName', 'reason', 'outcome',
            'retryScheduled', 'retryAfterMs', 'delayMs', 'nextAttempt',
            'postKeyPresent', 'challengeRequired', 'commandCount',
            'ackType', 'hasNo', 'hasId', 'postedNo'
        ]) {
            if (safe[key] !== undefined) {
                copyable[key] = safe[key];
            }
        }
        window.console.log('[ZenzaWatch][CommentPost]', safe, JSON.stringify(copyable));
    };
    const summarizeCommentPostAck = (ack) => {
        if (ack === null) {
            return { ackType: 'null' };
        }
        if (Array.isArray(ack)) {
            return { ackType: 'array', ackLength: ack.length };
        }
        if (typeof ack !== 'object') {
            return { ackType: typeof ack };
        }
        return {
            ackType: 'object',
            ackKeys: Object.keys(ack).slice(0, 20).sort(),
            hasNo: Object.prototype.hasOwnProperty.call(ack, 'no'),
            noType: typeof ack.no,
            hasId: Object.prototype.hasOwnProperty.call(ack, 'id')
        };
    };
    const fetchJsonWithin = (...args) => CommentPostWire.fetchJsonWithin(...args);
    const abortReason = (signal) => signal.reason !== undefined ? signal.reason :
        Object.assign(new Error('Comment load aborted'), { name: 'AbortError' });
    const checkAbort = (signal) => { if (signal && signal.aborted) {
        throw abortReason(signal);
    } };
    const withSignal = async (operation, signal) => {
        checkAbort(signal);
        if (!signal) {
            return operation();
        }
        let onAbort;
        try {
            const aborted = new Promise((resolve, reject) => {
                onAbort = () => reject(abortReason(signal));
                signal.addEventListener('abort', onAbort, { once: true });
            });
            return await Promise.race([aborted, operation()]);
        }
        finally {
            signal.removeEventListener('abort', onAbort);
        }
    };
    const waitForRetry = async (ms, signal) => {
        if (!signal) {
            return sleep(ms);
        }
        let timer;
        try {
            await withSignal(() => new Promise(resolve => { timer = setTimeout(resolve, ms); }), signal);
        }
        finally {
            if (timer !== undefined) {
                clearTimeout(timer);
            }
        }
        return undefined;
    };
    const readJson = (url, options) => withSignal(async () => {
        const response = await netUtil.fetch(url, options);
        checkAbort(options.signal);
        const header = response.headers && response.headers.get('Retry-After');
        let retryAfterMs;
        if (typeof header === 'string') {
            const value = header.trim();
            if (/^\d+$/.test(value)) {
                retryAfterMs = Number(value) * 1000;
            }
            else if (/^[A-Za-z]{3},/.test(value)) {
                const date = Date.parse(value);
                if (Number.isFinite(date)) {
                    retryAfterMs = Math.max(0, date - Date.now());
                }
            }
        }
        let body;
        try {
            body = await response.json();
        }
        catch (error) {
            if (response.status >= 400) {
                throw { status: response.status, retryAfterMs };
            }
            throw error;
        }
        checkAbort(options.signal);
        const apiStatus = body?.meta?.status;
        if (Number.isInteger(response?.status) && response.status >= 400 &&
            (!Number.isInteger(apiStatus) || apiStatus < 300)) {
            const failure = { status: response.status };
            throw retryAfterMs === undefined ? failure : { ...failure, retryAfterMs };
        }
        if (!Number.isInteger(apiStatus) || apiStatus < 200) {
            throw commentSchemaError('invalid-api-meta');
        }
        if (apiStatus >= 300) {
            const failure = body.meta;
            throw retryAfterMs === undefined ? failure : { ...failure, retryAfterMs };
        }
        return body;
    }, options.signal);
    class ThreadLoader {
        constructor() {
            this._threadKeys = {};
        }
        async getThreadKey(videoId, options = {}) {
            let url = `https://nvapi.nicovideo.jp/v1/comment/keys/thread?videoId=${videoId}`;
            console.log('getThreadKey url: ', url);
            try {
                const { meta, data } = await readJson(url, {
                    headers: {
                        'X-Frontend-Id': FRONT_ID,
                        'X-Frontend-Version': FRONT_VER,
                    },
                    signal: options.signal,
                    credentials: 'include'
                });
                if (meta.status >= 300) {
                    throw meta;
                }
                checkAbort(options.signal);
                // A malformed key response must never replace the last known good key.
                const validData = CommentReadAdapter.threadKey(data);
                this._threadKeys[videoId] = validData.threadKey;
                return validData;
            }
            catch (result) {
                throw { result, message: `ThreadKeyの取得失敗 ${videoId}` };
            }
        }
        async getPostKey(threadId, options = {}) {
            const url = `https://nvapi.nicovideo.jp/v1/comment/keys/post?threadId=${threadId}`;
            console.log('getPostKey url: ', url);
            const postKeyLanguage = options.language || 'ja-jp';
            try {
                // Task490: TypeScript owns post-key GET request headers and response validation.
                return await CommentPostWire.getPostKey(threadId, postKeyLanguage);
            }
            catch (result) {
                throw { result, message: `PostKeyの取得失敗 ${threadId}` };
            }
        }
        async _delete(url, body, options = {}) {
            try {
                const { meta } = await netUtil.fetch(url, {
                    method: 'PUT',
                    headers: {
                        'X-Frontend-Id': FRONT_ID,
                        'X-Frontend-Version': FRONT_VER,
                        'Content-Type': 'text/plain; charset=UTF-8'
                    },
                    body
                }).then(res => res.json());
                if (meta.status >= 300) {
                    throw meta;
                }
            }
            catch (result) {
                throw {
                    result,
                    message: `コメントの通信失敗`
                };
            }
        }
        async _post(url, body, options = {}) {
            try {
                // Task491: the TypeScript client owns the exact POST wire request.
                return await CommentPostWire.postComment(url, body);
            }
            catch (result) {
                throw {
                    result,
                    // Task185 (F11): network / header-timeout / body-timeout (undefined for API errors)
                    kind: result && result.kind,
                    message: `コメントの通信失敗`
                };
            }
        }
        async _load(msgInfo, options = {}) {
            checkAbort(options.signal);
            const { params, server, threadKey } = msgInfo.nvComment;
            // params は msgInfo.nvComment.params への参照そのもの。
            // ここで書き換えると msgInfo.nvComment.params 自体が汚染され、
            // 同じ msgInfo を使う次のリトライや reloadComment() にまで影響してしまうため、
            // 必ずコピーしてから使う（Task B-5）。
            const packet = {
                additionals: {},
                params: { ...params },
                threadKey
            };
            if (options.retrying) {
                const info = await this.getThreadKey(msgInfo.videoId, options);
                console.log('threadKey (retry): ', msgInfo.videoId, logSafe.redact(info));
                packet.threadKey = info.threadKey;
            }
            // ユーザーが選択している言語(en-us/zh-tw等)にコメントスレッドが
            // 対応していない動画に対して送ると errorCode=INVALID_PARAMETER で
            // 拒否される。この場合は同じ言語を送る限り何度リトライしても失敗し
            // 続けるため、直前の失敗が言語指定によるものだった場合は
            // サーバーが最初に返してきた既定言語(packet.params.language、
            // 通常は "ja-jp")にフォールバックする（Task B-5 追加調査）。
            if (!options.useServerDefaultLanguage && msgInfo.language && msgInfo.language !== packet.params.language) {
                packet.params.language = msgInfo.language;
            }
            if (msgInfo.when > 0) {
                packet.additionals.when = msgInfo.when;
            }
            const url = new URL('/v1/threads', server);
            console.log('load threads...', url, logSafe.redact(packet));
            try {
                const { meta, data } = await readJson(url, {
                    method: 'POST',
                    signal: options.signal,
                    headers: {
                        'X-Frontend-Id': FRONT_ID,
                        'X-Frontend-Version': FRONT_VER,
                        'Content-Type': 'text/plain; charset=UTF-8'
                    },
                    body: JSON.stringify(packet)
                });
                if (meta.status >= 300) {
                    throw meta;
                }
                checkAbort(options.signal);
                // Fail before changing the current video or accepting a foreign thread.
                // Unknown shapes are not retried as transient network failures.
                const validData = CommentReadAdapter.threads(data, msgInfo);
                // 実際にサーバーへ送った言語をload()側に伝え、フォールバックが
                // 発生した場合に msgInfo.language / threadInfo.language を
                // 実態に合わせて更新できるようにする（Task B-5 追加調査）。
                validData.__usedLanguage = packet.params.language;
                return validData;
            }
            catch (result) {
                checkAbort(options.signal);
                // 400/INVALID_TOKEN 等が起きた時にすぐ切り分けられるよう、
                // ネストせず1行で status / errorCode を出す（Task B-5）。
                window.console.error(`_load threads fail: videoId=${msgInfo.videoId} status=${result && result.status} errorCode=${result && result.errorCode}`, logSafe.redact(result));
                throw {
                    result,
                    message: `コメントの通信失敗`
                };
            }
        }
        async load(msgInfo, options = {}) {
            checkAbort(options.signal);
            const { videoId, userId } = msgInfo;
            const timeKey = `loadComment videoId: ${videoId}`;
            console.time(timeKey);
            // 動画を素早く切り替えた直後などは、サーバー側の一時的な不整合や
            // レート制限で400が続けて返ることがある。3秒1回だけのリトライでは
            // 足りないケースが報告された(Task B-5)ため、間隔を空けて2回リトライする。
            const RETRY_DELAYS_MS = [3000, 6000];
            // Only an EXPLICIT button-triggered reload refreshes the saved thread key
            // before its first POST. Checking msgInfo.threadInfo is insufficient:
            // the post-token recovery path also calls load() after a successful read.
            // First loads and internal posting retries retain their original behavior.
            const isReload = options.manualReload === true;
            let result;
            let lastError;
            for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
                const isRetry = attempt > 0;
                const loadOptions = isRetry || isReload ?
                    { ...options, retrying: true } : options;
                // 直前の失敗が「言語指定が対象動画で無効」(INVALID_PARAMETER)による
                // ものだった場合、同じ言語で再試行しても必ず同じ結果になるため、
                // 今回のリトライではユーザー設定の言語指定をやめてサーバー既定の
                // 言語(ja-jp)にフォールバックする（Task B-5 追加調査）。
                if (isRetry && lastError && lastError.result && lastError.result.errorCode === 'INVALID_PARAMETER') {
                    loadOptions.useServerDefaultLanguage = true;
                }
                try {
                    if (isRetry) {
                        console.time(timeKey);
                    }
                    result = await this._load(msgInfo, loadOptions);
                    checkAbort(options.signal);
                    lastError = null;
                    break;
                }
                catch (caught) {
                    const e = caught;
                    checkAbort(options.signal);
                    lastError = e;
                    console.timeEnd(timeKey);
                    const failure = e && e.result || e;
                    if (failure && failure.name === 'AbortError') {
                        throw failure;
                    }
                    if (failure && failure.kind === 'schema') {
                        break;
                    }
                    const status = Number(failure && failure.status);
                    const invalidLanguage = failure && failure.errorCode === 'INVALID_PARAMETER';
                    const serverLanguage = msgInfo.nvComment && msgInfo.nvComment.params && msgInfo.nvComment.params.language;
                    const canFallback = invalidLanguage && !loadOptions.useServerDefaultLanguage &&
                        serverLanguage && msgInfo.language && msgInfo.language !== serverLanguage;
                    if (!canFallback && (invalidLanguage ||
                        (status > 400 && status < 500 && status !== 408 && status !== 429))) {
                        break;
                    }
                    const label = isRetry ? `リトライ${attempt}回目` : '1回目';
                    window.console.error(`loadComment fail (${label}): `, logSafe.redact(e));
                    let delay = RETRY_DELAYS_MS[attempt];
                    if (delay != null && failure && failure.retryAfterMs >= 0) {
                        // Do not shorten a server-requested delay just to fit our retry budget.
                        if (failure.retryAfterMs > 120000) {
                            break;
                        }
                        delay = Math.max(delay, failure.retryAfterMs);
                    }
                    if (delay != null) {
                        PopupMessage.alert(`コメントの取得失敗: ${delay / 1000}秒後にリトライ`);
                        await waitForRetry(delay, options.signal);
                    }
                }
            }
            if (lastError) {
                window.console.error('loadComment fail finally: ', logSafe.redact(lastError));
                const failure = lastError.result || lastError;
                const status = Number(failure && failure.status);
                const code = typeof failure?.errorCode === 'string' && /^[A-Z0-9_]{1,60}$/.test(failure.errorCode) ? failure.errorCode : '';
                const detail = [Number.isInteger(status) && status >= 100 && status <= 599 ? 'HTTP ' + status : '', code].filter(Boolean).join(' / ');
                throw {
                    message: msgInfo.when > 0 ?
                        '過去ログの取得に失敗しました' + (detail ? '（' + detail + '）' : '') :
                        isReload ? 'コメントの再取得に失敗しました' + (detail ? '（' + detail + '）' : '') :
                            'コメントサーバーの通信失敗',
                    result: lastError.result,
                    // For existing first loads, preserve the legacy error shape.
                    // On explicit reloads, expose only safe diagnostics for the journal.
                    ...(isReload ? {
                        statusCode: Number.isInteger(status) && status >= 100 && status <= 599 ? status : undefined,
                        errorCode: code || undefined
                    } : {})
                };
            }
            const loaded = result;
            console.timeEnd(timeKey);
            debug.lastMessageServerResult = loaded;
            // 選択言語が対象動画で使えず、既定言語にフォールバックして
            // 成功した場合は、以降 threadInfo や次回の再取得(reloadComment等)が
            // 実態と食い違わないよう msgInfo.language 自体を書き換える
            // （Task B-5 追加調査）。
            if (loaded.__usedLanguage && msgInfo.language && loaded.__usedLanguage !== msgInfo.language) {
                window.console.warn(`loadComment: 言語 "${msgInfo.language}" は videoId=${videoId} のスレッドで使用できないため、"${loaded.__usedLanguage}" にフォールバックしました`);
                PopupMessage.alert('この動画は選択中のコメント言語に対応していないため、既定の言語で表示します');
                msgInfo.language = loaded.__usedLanguage;
            }
            let totalResCount = loaded.globalComments.reduce((count, current) => (count + current.count), 0);
            for (const thread of loaded.threads) {
                const fork = thread.fork;
                thread.info = msgInfo.threads.find(({ id, forkLabel }) => `${id}` === thread.id && forkLabel === fork);
                // 投稿者コメントはGlobalにカウントされていない
                if (fork === 'easy') {
                    // かんたんコメントをカウントしていない挙動に合わせる。不要？
                    const resCount = thread.commentCount;
                    totalResCount -= resCount;
                }
            }
            const threadInfo = {
                userId,
                videoId,
                threadId: msgInfo.threadId,
                // Task183 (F07): no default post target -> not postable (no null dereference).
                is184Forced: msgInfo.defaultThread?.is184Forced === true,
                canPost: msgInfo.canPost !== false && msgInfo.threadId != null,
                totalResCount,
                language: msgInfo.language,
                when: msgInfo.when,
                isWaybackMode: !!msgInfo.when
            };
            msgInfo.threadInfo = threadInfo;
            console.log('threadInfo: ', logSafe.redact(threadInfo));
            return { threadInfo, body: loaded, format: 'threads' };
        }
        async getChallengeToken(siteKey) {
            return requestChallengeToken(siteKey);
        }
        async postChat(msgInfo, text, cmd, vpos, isOriginalVideo) {
            return this._postChat(msgInfo, text, cmd, vpos, false, createCommentPostDiagnostic(msgInfo), isOriginalVideo);
        }
        async _postChat(msgInfo, text, cmd, vpos, retrying = false, diagnostic = null, isOriginalVideo) {
            diagnostic = diagnostic || createCommentPostDiagnostic(msgInfo);
            const { videoId, threadId, language, is184Forced } = msgInfo.threadInfo;
            logCommentPostDiagnostic(diagnostic, 'precheck', 'start', {
                canPost: msgInfo.threadInfo.canPost !== false,
                is184Forced: is184Forced === true
            });
            // Task183 (F07): without a post target nothing is sent (no key, no POST).
            if (threadId === null || threadId === undefined || threadId === '' || msgInfo.threadInfo.canPost === false) {
                logCommentPostDiagnostic(diagnostic, 'precheck', 'rejected', {
                    reason: 'no-post-target',
                    outcome: 'not-sent'
                });
                throw { status: 'fail', reason: 'no-post-target', message: 'この動画ではコメントを投稿できません（投稿先のスレッドがありません）' };
            }
            const url = new URL(`/v1/threads/${threadId}/comments`, msgInfo.nvComment.server);
            let postKeyData;
            logCommentPostDiagnostic(diagnostic, 'post-key', 'start');
            try {
                postKeyData = (await this.getPostKey(threadId, { language: language })) || {};
            }
            catch (error) {
                logCommentPostDiagnostic(diagnostic, 'post-key', 'failure', {
                    ...getCommentPostFailureDetails(error),
                    outcome: 'not-sent'
                });
                throw error;
            }
            const postKey = CommentPostWire.readPostKey(postKeyData);
            const challenge = CommentPostWire.readChallenge(postKeyData);
            logCommentPostDiagnostic(diagnostic, 'post-key', 'success', {
                postKeyPresent: postKey !== null,
                challengeRequired: challenge.required === true,
                challengeSiteKeyPresent: challenge.siteKey !== null
            });
            // Task186 (F12): never POST without a usable post key.
            if (postKey === null) {
                logCommentPostDiagnostic(diagnostic, 'post-key', 'failure', {
                    reason: 'post-key-missing',
                    outcome: 'not-sent'
                });
                throw { status: 'fail', reason: 'post-key-missing', message: '投稿キーを取得できませんでした（コメントは送信していません）' };
            }
            // Task780 / AUD-02: honor the server's challenge before the first POST.
            // Only a real, user-completed Turnstile response can be sent as challengeToken.
            let challengeToken;
            if (challenge.required === null) {
                logCommentPostDiagnostic(diagnostic, 'challenge', 'failure', {
                    reason: 'challenge-unavailable', outcome: 'not-sent'
                });
                throw challengeFailure('challenge-unavailable', 'コメント投稿の追加認証情報が不正です。公式プレイヤーから投稿してください（未送信です）');
            }
            if (challenge.required === true) {
                const siteKey = challenge.siteKey;
                logCommentPostDiagnostic(diagnostic, 'challenge', 'start', {
                    reason: 'challenge-required',
                    outcome: 'not-sent'
                });
                if (!siteKey) {
                    logCommentPostDiagnostic(diagnostic, 'challenge', 'failure', {
                        reason: 'challenge-unavailable',
                        outcome: 'not-sent'
                    });
                    throw challengeFailure('challenge-unavailable', '追加認証の設定を取得できませんでした。公式プレイヤーから投稿してください（コメントは未送信です）');
                }
                // Keep normal immediate posting compatible with Task090, but discard an
                // authentication-gated request after the initiating video has changed.
                const stillOriginal = () => {
                    try {
                        return !isOriginalVideo || isOriginalVideo() === true;
                    }
                    catch (_error) {
                        return false;
                    }
                };
                if (!stillOriginal()) {
                    logCommentPostDiagnostic(diagnostic, 'challenge', 'failure', {
                        reason: 'challenge-stale-video', outcome: 'not-sent'
                    });
                    throw challengeFailure('challenge-stale-video', '認証中に動画が切り替わったため投稿していません。');
                }
                try {
                    const token = await this.getChallengeToken(siteKey);
                    if (typeof token !== 'string' || !token.trim() || token.length > 2048) {
                        throw challengeFailure('challenge-unavailable', '追加認証の応答が無効です。公式プレイヤーから投稿してください');
                    }
                    if (!stillOriginal()) {
                        throw challengeFailure('challenge-stale-video', '認証中に動画が切り替わったため投稿していません。');
                    }
                    challengeToken = token;
                    logCommentPostDiagnostic(diagnostic, 'challenge', 'success', {
                        reason: 'challenge-complete',
                        outcome: 'not-sent'
                    });
                }
                catch (failure) {
                    const raw = failure?.reason;
                    const reason = raw === 'challenge-cancelled' || raw === 'challenge-expired' ||
                        raw === 'challenge-timeout' || raw === 'challenge-busy' ||
                        raw === 'challenge-stale-video' ? raw : 'challenge-unavailable';
                    logCommentPostDiagnostic(diagnostic, 'challenge', 'failure', { reason, outcome: 'not-sent' });
                    const messages = {
                        'challenge-unavailable': '追加認証を完了できませんでした。公式プレイヤーから投稿してください',
                        'challenge-cancelled': '追加認証を中止しました。コメントは送信していません',
                        'challenge-expired': '追加認証が期限切れになりました。もう一度投稿してください',
                        'challenge-timeout': '追加認証が時間切れになりました。もう一度投稿してください',
                        'challenge-busy': '別のコメント認証が処理中です。完了後に投稿してください',
                        'challenge-stale-video': '認証中に動画が切り替わったため投稿していません。'
                    };
                    throw challengeFailure(reason, messages[reason]);
                }
            }
            // Task487: typed packet serialization preserves legacy body and command order.
            const { packet, commandCount, hasBlankCommand } = CommentPostWire.buildPacket({ text, cmd, vpos, postKey, videoId, challengeToken });
            logCommentPostDiagnostic(diagnostic, 'post', 'start', {
                commandCount,
                hasBlankCommand,
                is184Forced: is184Forced === true
            });
            // Do not log the raw packet: command strings are user input too. The structured
            // diagnostic above contains only counts/booleans plus public identifiers.
            try {
                const ack = await this._post(url, packet);
                // Task186 (F12): Zenza needs the comment number to show the posted comment.
                // An acknowledgement without a numeric `no` is not a confirmed success.
                // (`id` is passed through but not required: its contract is unconfirmed.)
                // Task483: validate unknown JSON in the typed wire boundary, without coercing
                // booleans/arrays/whitespace into successful comment numbers.
                const accepted = CommentPostWire.parseAcknowledgement(ack);
                if (!accepted) {
                    logCommentPostDiagnostic(diagnostic, 'ack', 'failure', {
                        reason: 'ack-incomplete',
                        outcome: 'unknown',
                        ...summarizeCommentPostAck(ack)
                    });
                    throw { ackIncomplete: true };
                }
                const { no, id } = accepted;
                logCommentPostDiagnostic(diagnostic, 'complete', 'success', {
                    outcome: 'accepted',
                    postedNo: no
                });
                return {
                    status: 'ok',
                    no,
                    id,
                    message: 'コメント投稿成功'
                };
            }
            catch (caught) {
                const error = caught;
                if (error && error.ackIncomplete) {
                    // The server may have accepted it: outcome unknown, never re-posted.
                    throw {
                        status: 'fail',
                        reason: 'ack-incomplete',
                        outcome: 'unknown',
                        message: 'コメント投稿の結果を確認できませんでした（応答に投稿番号がありません。自動では再投稿しません）'
                    };
                }
                // Task492: TypeScript owns retry eligibility, not the POST side effects.
                const { statusCode, errorCode, action } = CommentPostWire.classifyPostFailure(error, retrying);
                const failureDetails = getCommentPostFailureDetails(error);
                if (action === 'unknown') {
                    // Task185 (F11): after the POST was sent, a lost/late response means the
                    // outcome is unknown. It is not retried automatically (no double post).
                    logCommentPostDiagnostic(diagnostic, 'post', 'failure', {
                        ...failureDetails,
                        outcome: 'unknown'
                    });
                    throw {
                        status: 'fail',
                        reason: error.kind || 'network',
                        outcome: 'unknown',
                        message: error.kind === 'body-timeout' || error.kind === 'header-timeout' ?
                            'コメント投稿の結果を確認できませんでした（応答の待ち時間を超えました。自動では再投稿しません）' :
                            `コメント投稿失敗`
                    };
                }
                if (action === 'retry-token') {
                    logCommentPostDiagnostic(diagnostic, 'post', 'failure', {
                        ...failureDetails,
                        outcome: 'rejected',
                        retryScheduled: true
                    });
                    logCommentPostDiagnostic(diagnostic, 'retry-refresh', 'start', { reason: errorCode });
                    try {
                        await this.load(msgInfo);
                        logCommentPostDiagnostic(diagnostic, 'retry-refresh', 'success', { reason: errorCode });
                    }
                    catch (refreshError) {
                        logCommentPostDiagnostic(diagnostic, 'retry-refresh', 'failure', {
                            ...getCommentPostFailureDetails(refreshError),
                            reason: errorCode,
                            outcome: 'not-sent'
                        });
                        throw refreshError;
                    }
                }
                else {
                    logCommentPostDiagnostic(diagnostic, 'post', 'failure', {
                        ...failureDetails,
                        outcome: 'rejected',
                        retryScheduled: false
                    });
                    const challengeRejected = errorCode === 'INVALID_CHALLENGE_TOKEN';
                    throw {
                        status: 'fail',
                        statusCode,
                        ...(challengeRejected ? {
                            reason: 'challenge-rejected',
                            outcome: 'rejected'
                        } : {}),
                        message: challengeRejected ?
                            '追加認証が確認できずコメント投稿が拒否されました。公式プレイヤーで投稿してください（INVALID_CHALLENGE_TOKEN・入力内容は保持されます）' :
                            (errorCode ? `コメント投稿失敗 ${errorCode}` : 'コメント投稿失敗')
                    };
                }
                logCommentPostDiagnostic(diagnostic, 'retry', 'wait', {
                    reason: errorCode,
                    delayMs: 3000,
                    nextAttempt: diagnostic.attempt + 1
                });
                await sleep(3000);
                return await this._postChat(msgInfo, text, cmd, vpos, true, {
                    ...diagnostic,
                    attempt: diagnostic.attempt + 1
                }, isOriginalVideo);
            }
        }
        async getDeleteKey(threadId, options = {}) {
            const url = `https://nvapi.nicovideo.jp/v1/comment/keys/delete?threadId=${threadId}&fork=${options.fork || 'main'}`;
            // Task650 (TL-LOG-001): this log was labelled getNicoruKey.
            console.log('getDeleteKey url: ', url);
            try {
                const { meta, data } = await netUtil.fetch(url, {
                    headers: {
                        'X-Frontend-Id': FRONT_ID,
                        'X-Frontend-Version': FRONT_VER,
                        'X-Niconico-Language': options.language || 'ja-jp'
                    },
                    credentials: 'include'
                }).then(res => res.json());
                if (meta.status >= 300) {
                    throw meta;
                }
                return data;
            }
            catch (result) {
                throw { result, message: `DeleteKeyの取得失敗 ${threadId}` };
            }
        }
        async deleteChat(msgInfo, chat) {
            const { videoId, threadId, language } = msgInfo.threadInfo;
            const url = new URL(`/v1/threads/${threadId}/comment-comment-owner-deletions`, msgInfo.nvComment.server);
            const fork = FORK_LABEL[chat.fork || 0];
            const { deleteKey } = await this.getDeleteKey(threadId, { language: language, fork });
            const packet = JSON.stringify({
                deleteKey,
                fork,
                language,
                targets: [{
                        no: chat.no,
                        operation: 'DELETE'
                    }],
                videoId,
            });
            console.log('put packet: ', logSafe.redact(packet));
            try {
                await this._delete(url, packet);
                return {
                    status: 'ok',
                    message: 'コメント削除成功'
                };
            }
            catch (error) {
                const { result: { status: statusCode, errorCode } } = error;
                throw {
                    status: 'fail',
                    statusCode,
                    message: errorCode ? `コメント削除失敗 ${errorCode}` : 'コメント削除失敗'
                };
            }
        }
        async getNicoruKey(threadId, options = {}) {
            const url = `https://nvapi.nicovideo.jp/v1/comment/keys/nicoru?threadId=${threadId}`;
            console.log('getNicoruKey url: ', url);
            try {
                const { meta, data } = await netUtil.fetch(url, {
                    headers: {
                        'X-Frontend-Id': FRONT_ID,
                        'X-Frontend-Version': FRONT_VER,
                        'X-Niconico-Language': options.language || 'ja-jp'
                    },
                    credentials: 'include'
                }).then(res => res.json());
                if (meta.status >= 300) {
                    throw meta;
                }
                return data;
            }
            catch (result) {
                throw { result, message: `NicoruKeyの取得失敗 ${threadId}` };
            }
        }
        async nicoru(msgInfo, chat) {
            const { videoId, threadId, language } = msgInfo.threadInfo;
            const url = new URL(`/v1/threads/${threadId}/nicorus`, msgInfo.nvComment.server);
            const { nicoruKey } = await this.getNicoruKey(threadId, { language: language });
            const packet = JSON.stringify({
                content: chat.text,
                fork: FORK_LABEL[chat.fork || 0],
                no: chat.no,
                nicoruKey,
                videoId,
            });
            console.log('post packet: ', logSafe.redact(packet));
            try {
                const { nicoruId, nicoruCount } = await this._post(url, packet);
                return {
                    status: 'ok',
                    id: nicoruId,
                    count: nicoruCount,
                    message: 'ニコれた'
                };
            }
            catch (error) {
                const { result: { status: statusCode, errorCode } } = error;
                throw {
                    status: 'fail',
                    statusCode,
                    message: errorCode ? `ニコれなかった＞＜ ${errorCode}` : 'ニコれなかった＞＜'
                };
            }
        }
    }
    return { ThreadLoader: new ThreadLoader };
})();
//===END===
export {
  ThreadLoader
};
