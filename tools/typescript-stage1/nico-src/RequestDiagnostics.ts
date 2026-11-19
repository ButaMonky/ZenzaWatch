/** Safe, optional request observer. Never reads bodies, retries, or displays popups. */
export type DiagnosticOperation = 'video-info' | 'comment-read' | 'comment-history-read' | 'comment-key' |
  'video-session' | 'session-state' | 'storyboard' | 'search' | 'mylist' |
  'playback-position' | 'mylist-add' | 'mylist-remove' | 'watch-later-add' | 'watch-later-remove' |
  'tag-add' | 'tag-remove' | 'playlist' | 'like' | 'tags' | 'nico-api' | 'tag-suggest' | 'tag-key' |
  'advertising' | 'ad-decoration' | 'supporters' | 'gifts' | 'dictionary' | 'recommend' | 'owner' | 'owner-videos' |
  'comment-post' | 'nicoru' | 'comment-delete' | 'nicoad-end' |
  'clip-permission' | 'clip-license' | 'clip-create' | 'clip-status' | 'clip-post' | 'clip-post-status' | 'clip-delete' | 'clip-library';
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
  apiStatus?: number;
  errorCode?: string;
  /** Task1036: 読めなかった項目・欠けていた値の場所（値そのものは含めない）。 */
  missing?: string;
  /** Task1036: スクリプトエラーの種類（TypeError など）。 */
  errorName?: string;
  /** Task1036: 修正箇所の目安（TypeScript 正本のファイル）。 */
  module?: string;
  /** Task1036: 仕様変更の疑いを出したときの、別々の対象の件数。 */
  distinctTargets?: number;
}
export interface DiagnosticTicket {
  success(): void;
  failure(error: unknown): void;
  response(response: {status?: number}): void;
}

const RequestDiagnostics = (() => {
  const labels: Record<DiagnosticOperation, string> = {
    'video-info': '動画情報', 'comment-read': 'コメント取得', 'comment-history-read': 'コメント増量（過去のコメントを追加取得）', 'comment-key': 'コメント取得キーの更新',
    'video-session': '再生セッション（映像の配信URL取得）', 'session-state': '再生セッションの維持',
    storyboard: '場面画像の情報', search: '検索', mylist: 'マイリスト', playlist: 'プレイリスト',
    'playback-position': '再生位置の保存',
    'mylist-add': 'マイリストへの追加', 'mylist-remove': 'マイリストからの削除',
    'watch-later-add': 'あとで見るへの追加', 'watch-later-remove': 'あとで見るからの削除',
    'tag-add': 'タグの追加', 'tag-remove': 'タグの削除',
    like: 'いいね', tags: 'タグ一覧', 'nico-api': 'ニコニコAPI',
    'tag-suggest': 'タグ候補', 'tag-key': 'タグ編集キー', advertising: 'ニコニ広告',
    'ad-decoration': '広告装飾', supporters: '広告・ギフトの支援者', gifts: 'ギフト',
    dictionary: '大百科', recommend: '関連動画・シリーズ', owner: '投稿者情報', 'owner-videos': '投稿者の動画一覧',
    'comment-post': 'コメント投稿', nicoru: 'ニコる', 'comment-delete': 'コメント削除',
    'nicoad-end': '動画の最後のニコニ広告',
    'clip-library': 'クリップ変換ライブラリ',
    'clip-permission': 'クリップ投稿の利用確認', 'clip-license': 'クリップの音声利用確認',
    'clip-create': 'クリップの作成', 'clip-status': 'クリップの生成状況',
    'clip-post': 'クリップのX投稿', 'clip-post-status': 'クリップのX投稿状況', 'clip-delete': 'クリップの削除'
  };
  /**
   * Task1036: 失敗したときに最初に見るべき TypeScript 正本（tools/typescript-stage1/）。
   * ニコニコ側の仕様変更で壊れたとき、どこを直せばよいかを通知履歴に出すため。
   */
  const modules: Record<DiagnosticOperation, string> = {
    'video-info': 'nico-src/VideoInfoLoader.ts', 'comment-read': 'packages/comment-history/src/core.mjs',
    'comment-history-read': 'packages/comment-history/src/core.mjs',
    'comment-key': 'packages/comment-history/src/core.mjs', 'video-session': 'nico-src/VideoSessionWorker.ts',
    'session-state': 'nico-src/VideoSessionWorker.ts', storyboard: 'nico-src/Storyboard.ts',
    search: 'nico-src/VideoSearch.ts', mylist: 'nico-src/MylistApiLoader.ts', playlist: 'nico-src/PlaylistApiLoader.ts',
    'playback-position': 'nico-src/PlaybackPosition.ts',
    'mylist-add': 'nico-src/MylistApiLoader.ts', 'mylist-remove': 'nico-src/MylistApiLoader.ts',
    'watch-later-add': 'nico-src/MylistApiLoader.ts', 'watch-later-remove': 'nico-src/MylistApiLoader.ts',
    'tag-add': 'nico-src/TagEditApi.ts', 'tag-remove': 'nico-src/TagEditApi.ts',
    like: 'nico-src/LikeApi.ts', tags: 'nico-src/TagEditApi.ts', 'nico-api': 'nico-src/RequestDiagnostics.ts',
    'tag-suggest': 'nico-src/TagSuggestLoader.ts', 'tag-key': 'nico-src/TagEditApi.ts', advertising: 'nico-src/UaaLoader.ts',
    'ad-decoration': 'nico-src/AdDecorationLoader.ts', supporters: 'nico-src/SupporterCredit.ts', gifts: 'nico-src/SupporterCredit.ts',
    dictionary: 'nico-src/NicodicArticleLoader.ts', recommend: 'nico-src/RecommendAPILoader.ts', owner: 'nico-src/OwnerSupplement.ts', 'owner-videos': 'nico-src/VideoSearch.ts',
    'comment-post': 'nico-src/CommentPostWire.ts', nicoru: 'nico-src/ThreadLoader.ts', 'comment-delete': 'nico-src/ThreadLoader.ts',
    'nicoad-end': 'nico-src/NicoVideoPlayerDialog.ts',
    'clip-library': 'src/ShareFastClip.js',
    'clip-permission': 'src/ShareOfficialClip.js', 'clip-license': 'src/ShareOfficialClip.js',
    'clip-create': 'src/ShareOfficialClip.js', 'clip-status': 'src/ShareOfficialClip.js',
    'clip-post': 'src/ShareOfficialClip.js', 'clip-post-status': 'src/ShareOfficialClip.js', 'clip-delete': 'src/ShareOfficialClip.js'
  };
  const moduleFor = (operation: DiagnosticOperation): string => modules[operation] || 'nico-src/RequestDiagnostics.ts';
  /** 項目名として安全な文字だけにする（値は持たない）。 */
  const fieldName = (value: unknown): string | undefined => {
    if (typeof value !== 'string') { return undefined; }
    const cleaned = value.replace(/[^A-Za-z0-9_.$:\[\]-]/g, '').slice(0, 100);
    return cleaned ? cleaned : undefined;
  };
  /** エラーメッセージから、undefined だった場所を取り出す（JavaScript の定型文のみ）。 */
  const missingFromMessage = (message: unknown): string | undefined => {
    if (typeof message !== 'string') { return undefined; }
    const m = /of '([^']{1,100})' as it is (?:undefined|null)/.exec(message) ||
      /Cannot read properties of (?:undefined|null) \(reading '([^']{1,100})'\)/.exec(message) ||
      /^([A-Za-z_$][\w$.]{0,99}) is not defined/.exec(message) ||
      /^([A-Za-z_$][\w$.]{0,99}) is not a function/.exec(message);
    return m ? fieldName(m[1]) : undefined;
  };
  const activeTickets = new Map<string, {superseded: boolean}>();
  /**
   * Task1036: 仕様変更の疑い。同じ機能で「形式を読み取れない」などの失敗が、別々の対象
   * （動画など）で SUSPECT_THRESHOLD 件以上、SUSPECT_WINDOW_MS 以内に起きたら1件だけ知らせる。
   * 1件だけの失敗は動画固有の事情と区別できないため。
   */
  const SUSPECT_THRESHOLD = 3, SUSPECT_WINDOW_MS = 30 * 60 * 1000;
  const suspects = new Map<string, Map<string, number>>();
  const suspectReported = new Map<string, number>();
  const suspectReason = (failure: Failure): boolean => failure.reason === 'schema' ||
    (failure.reason === 'http' && [400, 410, 422].includes(Number(failure.statusCode))) ||
    (failure.reason === 'service' && [400, 410, 422].includes(Number(failure.apiStatus))) ||
    ['BAD_REQUEST', 'INVALID_PARAMETER'].includes(String(failure.errorCode));
  const noteSuspect = (operation: DiagnosticOperation, key: string, failure: Failure, now: number): number => {
    const group = operation + '|' + failure.reason + '|' + (failure.errorCode || (failure.reason === 'service' ? failure.apiStatus : undefined) || failure.statusCode || '') +
      (operation.startsWith('clip-') || operation === 'comment-history-read' || operation === 'comment-read' || operation === 'comment-key' ||
        ['dictionary','tags','tag-key','tag-suggest','tag-add','tag-remove','playback-position',
          'watch-later-add','watch-later-remove','mylist-add','mylist-remove'].includes(operation) ? '|' + (failure.missing || '') : '');
    const seen = suspects.get(group) || new Map<string, number>();
    seen.set(key, now);
    for (const [k, at] of seen) { if (now - at > SUSPECT_WINDOW_MS) { seen.delete(k); } }
    while (seen.size > 50) { seen.delete(seen.keys().next().value!); }
    suspects.set(group, seen);
    const last = suspectReported.get(group);
    if (seen.size >= SUSPECT_THRESHOLD && (last === undefined || now - last > SUSPECT_WINDOW_MS)) {
      suspectReported.set(group, now);
      return seen.size;
    }
    return 0;
  };
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
  type Failure = {reason: string; statusCode?: number; apiStatus?: number; errorCode?: string; missing?: string; errorName?: string};
  const knownErrorCodes = new Set(['WATCH_SCHEMA','WATCH_PAGE_SCHEMA','WATCH_PAGE_META_MISSING','RESPONSE_SCHEMA','STORYBOARD_SCHEMA',
      'SEARCH_SCHEMA','KEY_EXPIRED','INVALID_CHALLENGE_TOKEN','BAD_REQUEST','INVALID_PARAMETER','EXPIRED_TOKEN','INVALID_TOKEN','FORBIDDEN','NOT_FOUND','TOO_MANY_REQUESTS','INTERNAL_SERVER_ERROR','UNAUTHORIZED', 'RESOURCE_NOT_FOUND']);
  const isKnownErrorCode = (value: unknown): value is string => typeof value === 'string' && knownErrorCodes.has(value);
  const validStatus = (value: unknown): value is number =>
    typeof value === 'number' && Number.isInteger(value) && value >= 100 && value <= 599;
  // Only project protocol facts. Each caller owns body validation, fallback and retries.
  const responseFailure = (response: unknown, meta: unknown, missing?: string): {
    httpStatus?: number; apiStatus?: number; errorCode?: string; kind?: 'schema' | 'service'; missing?: string
  } | null => {
    const wire = (response as {status?: unknown} | null)?.status;
    const header = meta as {status?: unknown; errorCode?: unknown} | null;
    const api = header?.status;
    const statuses = {
      ...(validStatus(wire) ? {httpStatus: wire} : {}),
      ...(validStatus(api) ? {apiStatus: api} : {})
    };
    const rawCode = header?.errorCode;
    const code = typeof rawCode === 'string' && rawCode ? {errorCode: isKnownErrorCode(rawCode) ? rawCode : 'OTHER'} : {};
    if ((validStatus(wire) && wire >= 300) || (validStatus(api) && api >= 300)) return {...statuses, ...code};
    if (code.errorCode) return {...statuses, ...code, kind:'service'};
    if (missing || !validStatus(api) || api < 200) {
      return {...statuses, kind:'schema', errorCode:'RESPONSE_SCHEMA', missing: missing || 'meta.status'};
    }
    return null;
  };
  const readFailure = (response: unknown, cause: unknown) => {
    const error = cause as {name?: unknown; status?: unknown} | null;
    const wire = (response as {status?: unknown} | null)?.status;
    const statuses = validStatus(wire) ? {httpStatus:wire} : {};
    if (error?.name === 'AbortError') return {name:'AbortError'};
    if (validStatus(wire) && wire >= 300) return statuses;
    if (error?.name === 'TimeoutError' || error?.name === 'timeout' || error?.status === 'timeout') {
      return {...statuses, kind:'timeout'};
    }
    if (response && error?.name === 'SyntaxError') return {...statuses, kind:'schema', errorCode:'RESPONSE_SCHEMA', missing:'json'};
    return {...statuses, kind:'network'};
  };
  const classify = (error: unknown): Failure => {
    const outer = error && typeof error === 'object' ? error as Record<string, unknown> : {};
    const ownsStatus = validStatus(outer.httpStatus) || validStatus(outer.apiStatus) ||
      ['schema','network','timeout'].includes(String(outer.kind)) || outer.name === 'AbortError';
    const e = !ownsStatus && outer.result && typeof outer.result === 'object' ? outer.result as Record<string, unknown> : outer;
    const httpStatus = e.httpStatus ?? e.statusCode ?? e.status;
    const apiStatus = validStatus(e.apiStatus) ? e.apiStatus : undefined;
    const apiRejected = apiStatus !== undefined && apiStatus >= 300 &&
      !(validStatus(httpStatus) && httpStatus >= 300);
    const status = apiRejected ? apiStatus : httpStatus;
    const fields = {
      ...(validStatus(httpStatus) ? {statusCode: httpStatus} : {}),
      ...(apiStatus !== undefined ? {apiStatus} : {}),
      ...(typeof e.errorCode === 'string' ? {errorCode: isKnownErrorCode(e.errorCode) ? e.errorCode : 'OTHER'} : {})
    };
    // Task1036: 読めなかった項目（missing/reasonCode/スキーマ失敗の理由コード）。値は持たない。
    const missing = fieldName(e.missing) ||
      (e.kind === 'schema' || /_SCHEMA$/.test(String(e.errorCode)) ? fieldName(e.reasonCode) || fieldName(e.reason) : undefined);
    if (missing) { (fields as Failure).missing = missing; }
    if (e.name === 'AbortError' || e.reason === 'cancelled') { return {reason: 'cancelled'}; }
    if (e.kind === 'network') { return {reason: 'network', ...fields}; }
    // Task1036: プログラムの不具合（TypeError など）は通信失敗と区別する。今回のコメント不具合は
    // 「Cannot destructure property 'videoId' of 'msgInfo.threadInfo'」で、通信に関係なかった。
    if (['TypeError', 'ReferenceError', 'RangeError', 'SyntaxError'].includes(String(e.name)) &&
        typeof e.message === 'string' && !/JSON|Unexpected token|Unexpected end/i.test(e.message)) {
      const where = missingFromMessage(e.message);
      return {reason: 'script', errorName: String(e.name), ...(where ? {missing: where} : {})};
    }
    if (e.kind === 'integrity') return {reason:'integrity'};
    if (e.kind === 'module-load') return {reason:'module-load'};
    if (e.reason === 'session-closed') { return {reason: 'session-closed'}; }
    if (e.kind === 'service') { return {reason: 'service', ...fields}; }
    if (e.name === 'timeout' || e.name === 'TimeoutError' || e.kind === 'timeout') { return {reason: 'timeout', ...fields}; }
    if (status === 404 || e.reason === 'not found') { return {reason: 'not-found', ...fields}; }
    if (status === 401 || status === 403 || ['forbidden','need payment','premium only','member only'].includes(String(e.reason))) { return {reason: 'permission', ...fields}; }
    if (apiRejected) { return {reason: 'service', ...fields}; }
    if (e.reason === 'not supported') { return {reason: 'unavailable', ...fields}; }
    if (e.kind === 'NO_KEY' || (e.kind === 'API' && typeof status === 'number' && status >= 200 && status < 300)) { return {reason: 'schema', ...fields}; }
    if (e.kind === 'schema' || e.name === 'SyntaxError' || e.reason === 'watch api' ||
        ['WATCH_SCHEMA','WATCH_PAGE_SCHEMA','WATCH_PAGE_META_MISSING','RESPONSE_SCHEMA','STORYBOARD_SCHEMA'].includes(String(e.errorCode))) {
      return {reason: 'schema', ...fields};
    }
    if (fields.statusCode) { return {reason: 'http', ...fields}; }
    if (apiStatus !== undefined && fields.errorCode) { return {reason: 'service', ...fields}; }
    return {reason: 'network'};
  };
  // Only fixed protocol field names, allowlisted API codes and HTTP status reach the journal.
  const classifyHistoryRead = (error: unknown, key = false): Failure => {
    const e = error && typeof error === 'object' ? error as Record<string, unknown> : {};
    const code = e.code;
    const statuses = {httpStatus: e.httpStatus, apiStatus: key ? e.apiStatus : undefined};
    if (['RESPONSE_SCHEMA','COMMENT_SCHEMA','TARGET_SCHEMA','TARGET_NOT_ALLOWED','MISSING_TARGET','INVALID_JSON'].includes(String(code)) ||
        (key && code === 'MISSING_KEY')) {
      const missing = e.missing === 'meta.status' || e.missing === (key ? 'data.threadKey' : 'data.threads') ? e.missing : undefined;
      return classify({...statuses, kind: 'schema', errorCode: 'RESPONSE_SCHEMA', ...(missing ? {missing} : {})});
    }
    if (code === 'TIMEOUT') { return {reason: 'timeout'}; }
    if (code === 'NETWORK_ERROR') { return {reason: 'network'}; }
    if (code === 'TOKEN_INVALID' || code === 'TOKEN_EXPIRED') {
      return {...classify({...statuses, errorCode: code === 'TOKEN_INVALID' ? 'INVALID_TOKEN' : 'EXPIRED_TOKEN'}), reason: 'permission'};
    }
    if (['HTTP_ERROR','API_ERROR','RATE_LIMITED'].includes(String(code))) {
      const result = classify({...statuses, errorCode: e.apiCode});
      if (result.reason === 'network' || result.reason === 'http' && Number(result.statusCode) < 400) { result.reason = 'service'; }
      return result;
    }
    // A cancelled run or a local request/time limit says nothing about the API.
    return {reason: 'cancelled'};
  };
  const classifyCommentKey = (error: unknown): Failure => {
    const outer = error && typeof error === 'object' ? error as Record<string, unknown> : {};
    if (outer.code !== undefined && (outer.name === 'HistoryError' || outer.code === 'TIMEOUT' || outer.code === 'CANCELLED')) {
      return classifyHistoryRead(outer, true);
    }
    // Only the reader knows which status came from the HTTP response and which from its body.
    const statuses = {httpStatus: outer.httpStatus ?? outer.status, apiStatus: outer.apiStatus};
    const e = outer.result && typeof outer.result === 'object' ? outer.result as Record<string, unknown> : outer;
    if (e.kind === 'schema' || e.name === 'SyntaxError') {
      const missing = e.missing === 'data.threadKey' || e.missing === 'meta.status' ? e.missing : undefined;
      return classify({...statuses, kind:'schema', errorCode:'RESPONSE_SCHEMA', ...(missing ? {missing} : {})});
    }
    // A server's meta object may contain arbitrary messages and property names.
    const result = classify({...statuses, errorCode:e.errorCode, name:e.name});
    if (e.errorCode === 'EXPIRED_TOKEN' || e.errorCode === 'INVALID_TOKEN') { result.reason = 'permission'; }
    else if (e.errorCode && (result.reason === 'network' || result.reason === 'http' && Number(result.statusCode) < 400)) {
      result.reason = 'service';
    }
    return result;
  };
  const classifyCommentAction = (error: unknown): Failure => {
    const e = error && typeof error === 'object' ? error as Record<string, unknown> : {};
    const result = e.result as Record<string, unknown> | undefined;
    // The action reader owns these fields. Its original exception can be a raw API envelope.
    if (validStatus(e.httpStatus) || validStatus(e.apiStatus) || e.missing || e.errorCode) {
      const failure = responseFailure({status:e.httpStatus}, {status:e.apiStatus, errorCode:e.errorCode},
        typeof e.missing === 'string' ? e.missing : undefined);
      if (failure) return classify(failure);
    }
    if (result?.reason === 'no-post-target' || (result?.outcome === 'not-sent' &&
        ['challenge-cancelled','challenge-stale-video','challenge-busy'].includes(String(result.reason)))) {
      return {reason:'cancelled'};
    }
    if (result?.reason === 'challenge-timeout' || ['header-timeout','body-timeout'].includes(String(result?.kind ?? result?.reason))) {
      return classify({kind:'timeout', httpStatus:e.httpStatus});
    }
    if (result?.name === 'AbortError' || result?.name === 'TimeoutError') return classify(result);
    if (result?.name === 'TypeError' && ['Failed to fetch','Load failed','NetworkError when attempting to fetch resource.'].includes(String(result.message))) {
      return classify({kind:'network', httpStatus:e.httpStatus});
    }
    return classify(result ?? error);
  };
  const begin = (operation: DiagnosticOperation, scope: string, phase: DiagnosticPhase,
    active: () => boolean = () => true, suspectTarget?: string): DiagnosticTicket => {
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
          integrity:'配布ファイルの照合に失敗しました', 'module-load':'変換ライブラリを読み込めません',
          timeout: '時間切れ', 'not-found': '対象が見つかりません', permission: '権限・ログイン状態を要確認',
          schema: '応答の形式を読み取れません', http: 'サーバーからエラー応答', network: '処理に失敗しました',
          'session-closed': 'セッションが異常終了しました', unavailable: 'この動画の再生方式には未対応です',
          script: 'プログラムの不具合（スクリプトエラー）', service: 'サービスで処理に失敗しました'
        };
        const module = moduleFor(operation);
        if (outcome === 'failed' && suspectReason(failure)) {
          const distinctTargets = noteSuspect(operation, suspectTarget === undefined ? key : scopeId(suspectTarget), failure, Date.now());
          if (distinctTargets) {
            sink?.({key: 'diag-spec-' + operation + '-' + failure.reason, operation, phase, outcome: 'failed', ...failure,
              reason: 'spec-change', module, distinctTargets,
              message: labels[operation] + '：ニコニコ側の仕様変更の可能性があります（別々の' + distinctTargets +
                '件で同じ失敗）。修正箇所の目安: ' + module,
              elapsedMs: 0});
          }
        }
        sink?.({key, operation, phase, outcome, ...failure, module,
          message: labels[operation] + '（' + (phase === 'transport' ? '通信' : phase === 'response' ? '応答の確認' : '処理') + '）' +
            (outcome === 'recovered' ? '：復旧しました' : '：' + reasonLabels[failure.reason]),
          elapsedMs: Math.max(0, Math.min(86400000, Date.now() - started))});
      } catch (_) { /* Diagnostic observers must never change playback. */ }
    };
    const failure = (error: unknown): void => {
      try {
        const result = operation === 'comment-history-read' ? classifyHistoryRead(error) :
          operation === 'comment-key' ? classifyCommentKey(error) :
          ['comment-post','nicoru','comment-delete'].includes(operation) ? classifyCommentAction(error) : classify(error);
        emit('failed', result);
      } catch (_) { /* untrusted error properties */ }
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
      // ShareOfficialClip owns transport and response as one ticket per stage/video.
      if (url.hostname === 'nvapi.nicovideo.jp' &&
          /^\/v1\/(?:videos\/[^/]+\/(?:tweet-possibility|license|clips)|clips\/[^/]+(?:\/x-post)?)\/?$/.test(p)) { return null; }
      if (url.hostname === 'sug.search.nicovideo.jp') { return 'tag-suggest'; }
      if (url.hostname === 'dic.nicovideo.jp') { return 'dictionary'; }
      if (url.hostname === 'api.nicoad.nicovideo.jp') {
        if (/pickup_supporters/.test(p)) { return 'supporters'; }
        if (/\/gift\//.test(p)) { return 'gifts'; }
        if (/^\/v1\/nicoad$/.test(p) && url.searchParams.get('frameId') === '12') { return 'nicoad-end'; }
        return /\/decoration$/.test(p) ? 'ad-decoration' : 'advertising';
      }
      if (/\/recommend$/.test(p)) { return 'recommend'; }
      if (url.hostname === 'nvapi.nicovideo.jp' && /^\/v1\/playlist\//.test(p)) { return 'playlist'; }
      if (url.hostname === 'nvapi.nicovideo.jp' && /^\/v3\/users\/[^/]+\/videos\/?$/.test(p)) {
        return url.searchParams.get('selectContentType') === 'short' ? 'playlist' : 'owner-videos';
      }
      if (url.hostname === 'nvapi.nicovideo.jp' && p === '/v2/users/me/watch/history/playback-position') return 'playback-position';
      if (/\/watch-later(?:\/|$)/.test(p)) { return 'mylist'; }
      if (/\/access-rights\/storyboard\/?$/.test(p)) { return 'storyboard'; }
      if (/\/access-rights\//.test(p)) { return 'video-session'; }
      if (/\/watch\//.test(p)) { return 'video-info'; }
      if (/\/comment\/keys\/thread/.test(p)) { return 'comment-key'; }
      if (/\/threads(?:\/|$)/.test(p)) { return 'comment-read'; }
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
    execute: () => Promise<T>, validate: (value: T) => boolean | {status?: number; httpStatus?: number; apiStatus?: number; kind?: string; missing?: string; errorCode?: string} = () => true,
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
  const labelFor = (operation: string): string | undefined =>
    Object.prototype.hasOwnProperty.call(labels, operation) ? labels[operation as DiagnosticOperation] : undefined;
  return {begin, startRequest, observe, setSink, moduleFor, missingFromMessage, labelFor, isKnownErrorCode, responseFailure, readFailure};
})();
export { RequestDiagnostics };
