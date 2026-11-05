// GENERATED FROM tools/typescript-stage1/nico-src/logSafe.ts (Task782). Edit the .ts and run npm run nico:sync.
//===BEGIN===
/**
 * Task 088（監査v2 ZW-056）: 通常のログ（console）に、キー・トークン・Cookie・投稿本文・ユーザーID を出さないための道具。
 * logSafe.redact(値) は、オブジェクト・配列・JSON の文字列を再帰的にたどり、
 * 秘密の値や個人の情報に当たるキーの値を '[REDACTED]' に置き換えた「写し」を返す（元の値は変えない）。
 * ログに出してよいのは、処理の段階・動画ID・スレッドID・状態コード・エラーコード等だけ。
 * Canonical TypeScript source: tools/typescript-stage1/nico-src/logSafe.ts (Task726).
 */
const logSafe = (() => {
    // 秘密の値: キー・トークン・Cookie・認証
    const SECRET_KEY = /(token|key$|keys$|cookie|authorization|password|passwd|secret|csrf|credential|signature|session)/i;
    // 個人の情報・投稿の中身
    const PERSONAL_KEY = /^(body|text|content|comment|comments|mail|email|userid|user_id|nickname|username|user_name)$/i;
    const MASK = '[REDACTED]';
    const MAX_DEPTH = 8;
    const isSecretKey = (key) => SECRET_KEY.test(String(key)) || PERSONAL_KEY.test(String(key));
    const redact = (value, depth = 0, seen = new WeakSet()) => {
        if (value === null || value === undefined) {
            return value;
        }
        if (typeof value === 'string') {
            const t = value.trim();
            if ((t.startsWith('{') && t.endsWith('}')) || (t.startsWith('[') && t.endsWith(']'))) {
                try {
                    return JSON.stringify(redact(JSON.parse(t), depth + 1, seen));
                }
                catch (_ignored) {
                    // Malformed JSON is still checked for URL-shaped sensitive text below.
                }
            }
            if (/(?:[a-z][a-z0-9+.-]*:\/\/|blob:|data:|\/\/)[^\s"'<>]*/i.test(t)) {
                return MASK;
            }
            return value;
        }
        if (typeof value !== 'object') {
            return value;
        }
        if (depth > MAX_DEPTH) {
            return '[…]';
        }
        if (seen.has(value)) {
            return '[循環]';
        }
        seen.add(value);
        if (typeof URL !== 'undefined' && value instanceof URL) {
            // A URL may carry opaque path/query/signature fragments. Do not stringify it.
            return MASK;
        }
        if (value instanceof Error) {
            // Read only an own data descriptor, never a user-provided name/message getter.
            const descriptor = Object.getOwnPropertyDescriptor(value, 'name');
            const name = descriptor && typeof descriptor.value === 'string' &&
                /^(?:Error|[A-Za-z]{1,32}Error)$/.test(descriptor.value) ? descriptor.value : 'Error';
            return Object.prototype.hasOwnProperty.call(value, 'cause') ?
                { name, message: MASK, cause: MASK } : { name, message: MASK };
        }
        if (Array.isArray(value)) {
            const out = new Array(value.length);
            for (let i = 0; i < value.length; i++) {
                const descriptor = Object.getOwnPropertyDescriptor(value, String(i));
                if (descriptor) {
                    out[i] = Object.prototype.hasOwnProperty.call(descriptor, 'value') ?
                        redact(descriptor.value, depth + 1, seen) : MASK;
                }
            }
            return out;
        }
        const out = {};
        for (const key of Object.keys(value)) {
            const descriptor = Object.getOwnPropertyDescriptor(value, key);
            out[key] = isSecretKey(key) || !descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value') ?
                MASK : redact(descriptor.value, depth + 1, seen);
        }
        return out;
    };
    return { redact, isSecretKey, MASK };
})();
//===END===
export {logSafe};
