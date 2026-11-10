/** Safe, optional request observer. Never reads bodies, retries, or displays popups. */
export type DiagnosticOperation = 'video-info' | 'comment-read' | 'comment-key' |
  'video-session' | 'session-state' | 'storyboard' | 'search' | 'mylist' |
  'playlist' | 'like' | 'tags' | 'nico-api' | 'tag-suggest' | 'tag-key' |
  'advertising' | 'ad-decoration' | 'supporters' | 'gifts' | 'dictionary' | 'recommend' | 'owner';
export type DiagnosticPhase = 'transport' | 'response' | 'session';
export interface DiagnosticEvent {
  key: string;
  operation: DiagnosticOperation;
  phase: DiagnosticPhase;
  outcome: 'failed' | 'recovered';
  reason: string;
  message: string;
  elapsedMs: number;
  statusCode?: number;
  errorCode?: string;
}
export interface DiagnosticTicket {
  success(): void;
  failure(error: unknown): void;
  response(response: {status?: number}): void;
}

const RequestDiagnostics = (() => {
  const labels: Record<DiagnosticOperation, string> = {
    'video-info': '動画情報', 'comment-read': 'コメント取得', 'comment-key': 'コメント取得キー',
    'video-session': '再生セッション', 'session-state': '再生セッションの維持',
    storyboard: '場面画像の情報', search: '検索', mylist: 'マイリスト', playlist: 'プレイリスト',
    like: 'いいね', tags: 'タグ', 'nico-api': 'ニコニコAPI',
    'tag-suggest': 'タグ候補', 'tag-key': 'タグ編集キー', advertising: 'ニコニ広告',
    'ad-decoration': '広告装飾', supporters: '広告・ギフトの支援者', gifts: 'ギフト',
    dictionary: '大百科', recommend: '関連動画・シリーズ', owner: '投稿者情報'
  };
  const activeTickets = new Map<string, {superseded: boolean}>();
  const failures = new Map<string, number>();
  let sink: ((event: DiagnosticEvent) => void) | undefined;
  const noop: DiagnosticTicket = {success() {}, failure() {}, response() {}};
  // Only this ephemeral scope digest is retained. URLs, queries and bodies are
  // never forwarded to the sink, used in messages, or saved by the journal.
  const scopeId = (value: string): string => {
    let a = 2166136261, b = 5381;
    for (let i = 0; i < value.length; i++) {
      a = Math.imul(a ^ value.charCodeAt(i), 16777619);
      b = Math.imul(b, 33) ^ value.charCodeAt(i);
    }
    return (a >>> 0).toString(36) + '-' + (b >>> 0).toString(36);
  };
  type Failure = {reason: string; statusCode?: number; errorCode?: string};
  const classify = (error: unknown): Failure => {
    const outer = error && typeof error === 'object' ? error as Record<string, unknown> : {};
    const e = outer.result && typeof outer.result === 'object' ? outer.result as Record<string, unknown> : outer;
    const status = e.statusCode ?? e.status ?? e.httpStatus;
    const codes = ['WATCH_SCHEMA','WATCH_PAGE_SCHEMA','WATCH_PAGE_META_MISSING','RESPONSE_SCHEMA','STORYBOARD_SCHEMA',
      'SEARCH_SCHEMA','KEY_EXPIRED','BAD_REQUEST','INVALID_PARAMETER','EXPIRED_TOKEN','FORBIDDEN','NOT_FOUND','TOO_MANY_REQUESTS','INTERNAL_SERVER_ERROR','UNAUTHORIZED', 'RESOURCE_NOT_FOUND'];
    const fields = {
      ...(typeof status === 'number' && Number.isInteger(status) && status >= 100 && status <= 599 ? {statusCode: status} : {}),
      ...(typeof e.errorCode === 'string' ? {errorCode: codes.includes(e.errorCode) ? e.errorCode : 'OTHER'} : {})
    };
    if (e.name === 'AbortError' || e.reason === 'cancelled') { return {reason: 'cancelled'}; }
    if (e.reason === 'session-closed') { return {reason: 'session-closed'}; }
    if (e.name === 'timeout' || e.name === 'TimeoutError' || e.kind === 'timeout') { return {reason: 'timeout', ...fields}; }
    if (status === 404 || e.reason === 'not found') { return {reason: 'not-found', ...fields}; }
    if (status === 401 || status === 403 || ['forbidden','need payment','premium only','member only'].includes(String(e.reason))) { return {reason: 'permission', ...fields}; }
    if (e.reason === 'not supported') { return {reason: 'unavailable', ...fields}; }
    if (e.kind === 'NO_KEY' || (e.kind === 'API' && typeof status === 'number' && status >= 200 && status < 300)) { return {reason: 'schema', ...fields}; }
    if (e.kind === 'schema' || e.name === 'SyntaxError' || e.reason === 'watch api' ||
        ['WATCH_SCHEMA','WATCH_PAGE_SCHEMA','WATCH_PAGE_META_MISSING','RESPONSE_SCHEMA','STORYBOARD_SCHEMA'].includes(String(e.errorCode))) {
      return {reason: 'schema', ...fields};
    }
    if (fields.statusCode) { return {reason: 'http', ...fields}; }
    return {reason: 'network'};
  };
  const begin = (operation: DiagnosticOperation, scope: string, phase: DiagnosticPhase,
    active: () => boolean = () => true): DiagnosticTicket => {
    if (!Object.prototype.hasOwnProperty.call(labels, operation) || !['transport','response','session'].includes(phase)) { return noop; }
    const started = Date.now();
    const key = 'diag-' + operation + '-' + phase + '-' + scopeId(scope);
    const previous = activeTickets.get(key);
    if (previous) { previous.superseded = true; }
    const state = {superseded: false};
    activeTickets.set(key, state);
    let finished = false;
    const emit = (outcome: 'failed' | 'recovered', failure: Failure): void => {
      if (finished) { return; }
      finished = true;
      if (activeTickets.get(key) === state) { activeTickets.delete(key); }
      try {
        if (!active() || state.superseded || failure.reason === 'cancelled') { return; }
        if (outcome === 'recovered') {
          const seen = failures.get(key);
          failures.delete(key);
          if (seen === undefined || started - seen >= 600000) { return; }
        } else {
          failures.delete(key); failures.set(key, Date.now());
          while (failures.size > 100) { failures.delete(failures.keys().next().value!); }
        }
        const reasonLabels: Record<string, string> = {
          timeout: '時間切れ', 'not-found': '対象が見つかりません', permission: '権限・ログイン状態を要確認',
          schema: '応答の形式を読み取れません', http: 'サーバーからエラー応答', network: '処理に失敗しました',
          'session-closed': 'セッションが異常終了しました', unavailable: 'この動画の再生方式には未対応です'
        };
        sink?.({key, operation, phase, outcome, ...failure,
          message: labels[operation] + '（' + (phase === 'transport' ? '通信' : phase === 'response' ? '応答の確認' : '処理') + '）' +
            (outcome === 'recovered' ? '：復旧しました' : '：' + reasonLabels[failure.reason]),
          elapsedMs: Math.max(0, Math.min(86400000, Date.now() - started))});
      } catch (_) { /* Diagnostic observers must never change playback. */ }
    };
    const failure = (error: unknown): void => {
      try { emit('failed', classify(error)); } catch (_) { /* untrusted error properties */ }
    };
    return {
      success: () => emit('recovered', {reason: 'recovered'}), failure,
      response: response => {
        if (typeof response?.status === 'number' && response.status >= 400) { failure({status: response.status}); }
        else { emit('recovered', {reason: 'recovered'}); }
      }
    };
  };
  const operationFor = (value: string | URL): DiagnosticOperation | null => {
    try {
      const url = new URL(String(value), 'https://www.nicovideo.jp');
      if (!/(^|\.)nicovideo\.jp$/.test(url.hostname)) { return null; }
      const p = url.pathname;
      if (url.hostname === 'sug.search.nicovideo.jp') { return 'tag-suggest'; }
      if (url.hostname === 'dic.nicovideo.jp') { return 'dictionary'; }
      if (url.hostname === 'api.nicoad.nicovideo.jp') {
        if (/pickup_supporters/.test(p)) { return 'supporters'; }
        if (/\/gift\//.test(p)) { return 'gifts'; }
        return /\/decoration$/.test(p) ? 'ad-decoration' : 'advertising';
      }
      if (/\/recommend$/.test(p)) { return 'recommend'; }
      if (/\/users\/[^/]+\/videos/.test(p)) { return 'owner'; }
      if (/\/watch-later(?:\/|$)/.test(p)) { return 'mylist'; }
      if (/\/watch\//.test(p)) { return 'video-info'; }
      if (/\/comment\/keys\/thread/.test(p)) { return 'comment-key'; }
      if (/\/threads(?:\/|$)/.test(p)) { return 'comment-read'; }
      if (/\/access-rights\//.test(p)) { return 'video-session'; }
      if (/storyboard/.test(p)) { return 'storyboard'; }
      if (/\/search(?:\/|$)/.test(p)) { return 'search'; }
      if (/mylist/.test(p)) { return 'mylist'; }
      if (/playlist/.test(p)) { return 'playlist'; }
      if (/\/likes(?:\/|$)/.test(p)) { return 'like'; }
      if (/\/tags(?:\/|$)/.test(p)) { return 'tags'; }
      if (/\/videos(?:\/|$)/.test(p)) { return 'video-info'; }
      return /^(nvapi|api|public\.api)\./.test(url.hostname) || /(^|\/)api(\/|$)/.test(p) ? 'nico-api' : null;
    } catch (_) { return null; }
  };
  const startRequest = (url: string | URL, signal?: {aborted: boolean} | null, active: () => boolean = () => true): DiagnosticTicket => {
    const operation = operationFor(url);
    return operation ? begin(operation, String(url), 'transport', () => !signal?.aborted && active()) : noop;
  };
  // Observe a caller-owned operation without changing its value, error or retry policy.
  const observe = async <T>(operation: DiagnosticOperation, scope: string,
    execute: () => Promise<T>, validate: (value: T) => boolean | {status: number} = () => true,
    active: () => boolean = () => true): Promise<T> => {
    const ticket = begin(operation, scope, 'response', active);
    let value: T;
    try { value = await execute(); }
    catch (error) { ticket.failure(error); throw error; }
    try {
      const meta = value && typeof value === 'object' ?
        (value as {meta?: {status?: unknown; errorCode?: unknown}}).meta : undefined;
      if (typeof meta?.status === 'number' && (meta.status < 200 || meta.status >= 300)) {
        ticket.failure({status: meta.status, errorCode: meta.errorCode});
      } else {
        const checked = validate(value);
        if (typeof checked === 'object') { ticket.failure(checked); }
        else if (!checked) { ticket.failure({kind: 'schema'}); }
        else { ticket.success(); }
      }
    } catch (_) { ticket.failure({name: 'AbortError'}); }
    return value;
  };
  const setSink = (next?: (event: DiagnosticEvent) => void): void => { sink = next; };
  return {begin, startRequest, observe, setSink};
})();
export { RequestDiagnostics };
