//===BEGIN===
/*
 * Task 088（監査v2 ZW-056）: 通常のログ（console）に、キー・トークン・Cookie・投稿本文・ユーザーID を出さないための道具。
 * logSafe.redact(値) は、オブジェクト・配列・JSON の文字列を再帰的にたどり、
 * 秘密の値や個人の情報に当たるキーの値を '[REDACTED]' に置き換えた「写し」を返す（元の値は変えない）。
 * ログに出してよいのは、処理の段階・動画ID・スレッドID・状態コード・エラーコード等だけ。
 */
const logSafe = (() => {
  // 秘密の値: キー・トークン・Cookie・認証
  const SECRET_KEY = /(token|key$|keys$|cookie|authorization|password|passwd|secret|csrf|credential|signature|session)/i;
  // 個人の情報・投稿の中身
  const PERSONAL_KEY = /^(body|text|content|comment|comments|mail|email|userid|user_id|nickname|username|user_name)$/i;
  const MASK = '[REDACTED]';
  const MAX_DEPTH = 8;

  const isSecretKey = key => SECRET_KEY.test(String(key)) || PERSONAL_KEY.test(String(key));

  const redact = (value, depth = 0, seen = new WeakSet()) => {
    if (value === null || value === undefined) {
      return value;
    }
    if (typeof value === 'string') {
      const t = value.trim();
      if ((t.startsWith('{') && t.endsWith('}')) || (t.startsWith('[') && t.endsWith(']'))) {
        try {
          return JSON.stringify(redact(JSON.parse(t), depth + 1, seen));
        } catch (e) {
          return value;
        }
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
      return value.toString();
    }
    if (value instanceof Error) {
      return {name: value.name, message: value.message};
    }
    if (Array.isArray(value)) {
      return value.map(v => redact(v, depth + 1, seen));
    }
    const out = {};
    for (const key of Object.keys(value)) {
      out[key] = isSecretKey(key) ? MASK : redact(value[key], depth + 1, seen);
    }
    return out;
  };

  return {redact, isSecretKey, MASK};
})();
//===END===

export {logSafe};
