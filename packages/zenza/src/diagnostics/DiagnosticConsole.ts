// Task 1052: 上級者設定「診断（上級者向け）」の詳細ログ。
// 不具合の調査用に、エラー・起動・再生・通信・通知・設定・内部イベント・負荷の情報を
// ブラウザのコンソールへ大量に出す。初期設定はすべて OFF。
// ZenzaWatch の他のモジュールには依存しない（受け取るのは install() の引数だけ）。
// 正本はこの .ts。DiagnosticConsole.js は tools/generate-ts-runtimes.cjs が型を取り除いて作る。
//===BEGIN===
type DiagLevel = 'debug' | 'info' | 'warn' | 'error';
type DiagCategory = 'errors' | 'startup' | 'player' | 'network' | 'notifications' | 'settings' | 'events' | 'performance';
interface DiagConfig {
  getValue(key: string): unknown;
  on?(name: string, listener: (...args: unknown[]) => void): unknown;
  off?(name: string, listener: (...args: unknown[]) => void): unknown;
}
interface DiagEmitter { emit(name: string, ...args: unknown[]): unknown }
interface DiagJournal { subscribe(listener: () => void): () => void; list(limit?: number): Promise<unknown[]> }
interface DiagInstallOptions {
  window: Window & typeof globalThis;
  config: DiagConfig;
  version: string;
  build?: string;
  emitter?: DiagEmitter;
  journal?: DiagJournal;
  debugRoot?: Record<string, unknown>;
}
interface DiagEntry { time: string; elapsedMs: number; category: DiagCategory | 'diagnostics'; level: DiagLevel; message: string; data?: unknown }

const DIAG_KEYS = {
  enabled: 'diagnostics.console.enabled',
  errors: 'diagnostics.console.errors',
  startup: 'diagnostics.console.startup',
  player: 'diagnostics.console.player',
  network: 'diagnostics.console.network',
  notifications: 'diagnostics.console.notifications',
  settings: 'diagnostics.console.settings',
  events: 'diagnostics.console.events',
  performance: 'diagnostics.console.performance',
  interval: 'diagnostics.console.intervalSec'
} as const;
const DIAG_CATEGORY_LABEL: Record<DiagCategory | 'diagnostics', string> = {
  errors: 'エラー', startup: '起動', player: '再生', network: '通信', notifications: '通知',
  settings: '設定', events: 'イベント', performance: '負荷', diagnostics: '診断'
};
const DIAG_STYLE: Record<DiagLevel, string> = {
  debug: 'color:#888;', info: 'color:#2a7;font-weight:bold;',
  warn: 'color:#c60;font-weight:bold;', error: 'color:#fff;background:#c00;font-weight:bold;padding:0 4px;'
};
// 値を出すと危険なキー（トークン・Cookie・本文・ユーザーID など）。logSafe と同じ考え方。
const DIAG_SECRET_KEY = /(token|key$|keys$|cookie|authorization|password|passwd|secret|csrf|credential|signature|session|ticket|policy|^body$|^text$|^content$|^comment$|^comments$|^mail$|^email$|^userid$|^user_id$|nickname|username|user_name)/i;
const DIAG_MAX_ENTRIES = 2000;
const DIAG_MEDIA_EVENTS = ['loadstart', 'durationchange', 'loadedmetadata', 'loadeddata', 'canplay', 'canplaythrough',
  'play', 'playing', 'pause', 'seeking', 'seeked', 'waiting', 'stalled', 'suspend', 'emptied', 'abort', 'error',
  'ended', 'ratechange', 'volumechange', 'resize', 'enterpictureinpicture', 'leavepictureinpicture'];
const DIAG_NOISY_EVENTS = /^(timeupdate|progress|mousemove|pointermove|scroll|resize|heatMapUpdate|commentLayer.*Render)$/i;
// 通信の監視対象（ニコニコ関係のホストだけ。広告・解析などページ側の他社の通信は出さない）。
const DIAG_HOST = /(^|\.)(nicovideo\.jp|nimg\.jp|dmc\.nico|nicoad\.nicovideo\.jp|smilevideo\.jp|nicolive\.jp|domand\.nicovideo\.jp)$/i;
const DIAG_SEGMENT = /\.(ts|m4s|cmfv|cmfa|aac|mp4)$|\/segments?\//i;
// Task1056: 失敗に見えるが正常な応答。ニコニ広告は「広告されていない動画」で 404 を返す。
const DIAG_EXPECTED_FAILURES: Array<{host: RegExp; path: RegExp; status: number; note: string}> = [
  {host: /(^|\.)nicoad\.nicovideo\.jp$/i, path: /\/(pickup_supporters|thanks|ranking|histories)\b/, status: 404,
    note: 'ニコニ広告の情報なし（広告されていない動画では 404 が正常）'}
];
// Task1056: 広告・計測用の読み込み。広告ブロック拡張が止めると「読み込み失敗」になるが ZenzaWatch とは無関係。
const DIAG_AD_RESOURCE = /(^|[./])(ads?\d*|nicoad|clarity|googletag|doubleclick|googlesyndication|log)\b|loadScript-|\/(log|beacon)\.gif/i;
// 起動時に値を出してよい設定（個人情報・本文・NGワードを含まないもの）。
// 起動時に値を出してよい設定（個人情報・本文・NGワードを含まないもの）。
const DIAG_SAFE_CONFIG = ['screenMode', 'autoPlay', 'autoFullScreen', 'loop', 'playbackRate', 'volume', 'mute',
  'enableFilter', 'sharedNgLevel', 'commentLayer.enable', 'enableCommentPanel', 'enableStoryboard',
  'enableStoryboardBar', 'sceneSearch.enabled', 'commentHistory.enabled', 'notificationHistory.enabled',
  'uaa.enable', 'supporterCredit.enable', 'externalLinks.enabled', 'videoHeader.position', 'smallMode'];

const DiagnosticConsole = (() => {
  let options: DiagInstallOptions | null = null;
  const entries: DiagEntry[] = [];
  // Task1054: 経過時間は時計の補正に影響されない performance.now() で測る（Date.now() だとマイナスになることがあった）。
  const startedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const nowMs = (): number => typeof performance !== 'undefined' ? performance.now() : Date.now();
  const stops = new Map<DiagCategory, () => void>();
  let restoreEmit: (() => void) | null = null;
  let onConfigUpdate: ((key: unknown, value: unknown) => void) | null = null;
  // Task1054: Config の update には 1 つだけ登録し、ここから配る（上限 10 の警告を増やさない）。
  const updateHandlers = new Set<(key: unknown, value: unknown) => void>();
  let installed = false;

  const cfg = (key: string): unknown => {
    try { return options?.config.getValue(key); } catch (_) { return undefined; }
  };
  const isOn = (category: DiagCategory): boolean => cfg(DIAG_KEYS.enabled) === true && cfg(DIAG_KEYS[category]) === true;

  // ---- 値の安全化（秘密・本文を伏せ、URL のクエリを消し、大きさを制限する）----
  const safeUrl = (raw: string): string => {
    try {
      const url = new URL(raw, options?.window.location.href);
      if (url.protocol === 'blob:' || url.protocol === 'data:') return url.protocol + '(省略)';
      const path = url.pathname.length > 120 ? url.pathname.slice(0, 117) + '...' : url.pathname;
      return url.host + path + (url.search ? '?(クエリ省略)' : '');
    } catch (_) {
      return '(URL)';
    }
  };
  const sanitize = (value: unknown, depth = 0, seen = new WeakSet<object>()): unknown => {
    if (value === null || value === undefined) return value;
    if (typeof value === 'string') {
      const t = value.length > 600 ? value.slice(0, 597) + '...' : value;
      return t.replace(/\b(?:https?:)?\/\/[^\s"'<>]+/gi, m => safeUrl(m));
    }
    if (typeof value === 'number' || typeof value === 'boolean') return value;
    if (typeof value === 'bigint') return String(value);
    if (typeof value === 'function') return '[function ' + (value.name || 'anonymous') + ']';
    if (typeof value !== 'object') return String(value);
    if (depth > 4) return '[…]';
    if (seen.has(value)) return '[循環参照]';
    seen.add(value);
    if (value instanceof Error) {
      return {name: value.name, message: sanitize(value.message, depth + 1, seen),
        stack: sanitize((value.stack || '').split('\n').slice(0, 12).join('\n'), depth + 1, seen)};
    }
    if (typeof Node !== 'undefined' && value instanceof Node) return describeNode(value);
    if (Array.isArray(value)) {
      const list = value.slice(0, 50).map(v => sanitize(v, depth + 1, seen));
      if (value.length > 50) list.push('…ほか' + (value.length - 50) + '件');
      return list;
    }
    const out: Record<string, unknown> = {};
    let count = 0;
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      if (++count > 60) { out['…'] = '項目が多いので省略'; break; }
      out[key] = DIAG_SECRET_KEY.test(key) ? '[伏せ字]' : sanitize(v, depth + 1, seen);
    }
    return out;
  };
  const describeNode = (node: Node): string => {
    if (!(node instanceof Element)) return node.nodeName;
    const id = node.id ? '#' + node.id : '';
    const cls = typeof node.className === 'string' && node.className ? '.' + node.className.trim().split(/\s+/).slice(0, 3).join('.') : '';
    return node.tagName.toLowerCase() + id + cls;
  };

  // ---- 出力 ----
  const write = (category: DiagEntry['category'], level: DiagLevel, message: string, data?: unknown): void => {
    const w = options?.window;
    if (!w) return;
    const entry: DiagEntry = {time: new Date().toISOString(), elapsedMs: Math.max(0, Math.round(nowMs() - startedAt)), category, level, message};
    if (data !== undefined) entry.data = sanitize(data);
    entries.push(entry);
    if (entries.length > DIAG_MAX_ENTRIES) entries.splice(0, entries.length - DIAG_MAX_ENTRIES);
    const c = w.console;
    // Task1054: console.warn/error は呼び出し元の一覧（write @ …）を付けて読みにくくなるので、
    // 「エラー」の種類だけに使う。他の警告は色だけ変えて info で出す。
    const fn = category === 'errors' ? (level === 'error' ? c.error : level === 'warn' ? c.warn : c.info) :
      level === 'debug' ? c.debug : c.info;
    const head = '%c[Zenza診断:' + DIAG_CATEGORY_LABEL[category] + '] +' + (entry.elapsedMs / 1000).toFixed(1) + 's ' + message;
    try {
      if (entry.data === undefined) fn.call(c, head, DIAG_STYLE[level]);
      else fn.call(c, head, DIAG_STYLE[level], entry.data);
    } catch (_) { /* console が差し替えられていても動作に影響させない */ }
  };
  const log = (category: DiagCategory, level: DiagLevel, message: string, data?: unknown): void => {
    if (isOn(category)) write(category, level, message, data);
  };

  // ---- 各カテゴリ ----
  // Task1056: ユーザースクリプトは「<UUID>:行番号」のような名前で動くため、ファイル名に zenza が入らない。
  // 診断ログ自身のスタックから自分のスクリプト名を取り出し、それを含むかで判定する（Task1059: 負荷の判定にも使う）。
  const selfScript = (() => {
    try {
      const m = String(new Error().stack || '').match(/\(?((?:[a-z-]+:\/\/[^\s()]+|[0-9a-f]{8}-[0-9a-f-]{27})):\d+:\d+\)?/i);
      return m ? m[1] : '';
    } catch (_) { return ''; }
  })();
  const isZenza = (text: string) => (!!selfScript && text.includes(selfScript)) ||
    /zenza|userscript|tampermonkey|violentmonkey|greasemonkey/i.test(text);

  const startErrors = (): (() => void) => {
    const w = options!.window;
    const isPageNode = (node: Element): boolean => {
      try { return !node.closest('[class*="zenza"],[class*="Zenza"],[id*="zenza"],[id*="Zenza"]'); }
      catch (_) { return true; }
    };
    const onError = (e: Event) => {
      if (e instanceof ErrorEvent) {
        const where = (e.filename || '') + ':' + e.lineno + ':' + e.colno;
        const stack = e.error instanceof Error ? e.error.stack || '' : '';
        log('errors', 'error', '捕捉されなかったエラー: ' + e.message, {
          where: safeUrl(e.filename || '') + ':' + e.lineno + ':' + e.colno,
          zenzaらしさ: isZenza(where + stack) ? 'ZenzaWatch の可能性が高い' : 'ページ側（ニコニコや他の拡張機能）の可能性が高い',
          error: e.error
        });
        return;
      }
      const target = e.target;
      if (target instanceof Element && target !== (w.document as unknown as Element)) {
        const src = (target as HTMLImageElement).currentSrc || target.getAttribute('src') || target.getAttribute('href') || '';
        const desc = describeNode(target);
        const ad = DIAG_AD_RESOURCE.test(desc + ' ' + src);
        const page = ad || isPageNode(target);
        log('errors', page ? 'info' : 'warn', (page ? '（ページ側）' : '') + '読み込みに失敗した要素: ' + desc, {
          src: src ? safeUrl(src) : '(なし)',
          見立て: ad ? '広告・計測用の読み込み（広告ブロック拡張で止められた可能性。ZenzaWatch とは無関係）' :
            page ? 'ニコニコのページ側の要素（ZenzaWatch の要素ではない）' : 'ZenzaWatch の要素'
        });
      }
    };
    const onRejection = (e: PromiseRejectionEvent) => {
      const reason = e.reason;
      const stack = reason instanceof Error ? reason.stack || '' : '';
      const zenza = isZenza(stack);
      const page = !zenza && /:\d+:\d+/.test(stack);
      log('errors', page ? 'info' : 'error', (page ? '（ページ側）' : '') + '処理されなかった Promise の拒否: ' +
        (reason instanceof Error ? reason.message : String(reason)), {
        zenzaらしさ: zenza ? 'ZenzaWatch の可能性が高い' :
          page ? 'ページ側（ニコニコや他の拡張機能）の可能性が高い' : '不明（スタックに手がかりなし）',
        reason
      });
    };
    const onCsp = (e: SecurityPolicyViolationEvent) => {
      log('errors', 'warn', 'CSP（セキュリティポリシー）による遮断: ' + e.violatedDirective,
        {blockedURI: safeUrl(e.blockedURI || ''), source: safeUrl(e.sourceFile || ''), line: e.lineNumber});
    };
    w.addEventListener('error', onError, true);
    w.addEventListener('unhandledrejection', onRejection);
    w.document.addEventListener('securitypolicyviolation', onCsp);
    return () => {
      w.removeEventListener('error', onError, true);
      w.removeEventListener('unhandledrejection', onRejection);
      w.document.removeEventListener('securitypolicyviolation', onCsp);
    };
  };

  const mediaIds = new WeakMap<HTMLMediaElement, number>();
  let mediaSeq = 0;
  const mediaState = (m: HTMLMediaElement): Record<string, unknown> => {
    const ranges: string[] = [];
    try {
      for (let i = Math.max(0, m.buffered.length - 3); i < m.buffered.length; i++) {
        ranges.push(m.buffered.start(i).toFixed(1) + '-' + m.buffered.end(i).toFixed(1));
      }
    } catch (_) { /* buffered が読めない状態 */ }
    const src = m.currentSrc || m.src || '';
    const state: Record<string, unknown> = {
      要素: '#' + mediaIds.get(m) + ' ' + describeNode(m),
      currentTime: Number(m.currentTime.toFixed(3)), duration: Number.isFinite(m.duration) ? Number(m.duration.toFixed(3)) : m.duration,
      paused: m.paused, ended: m.ended, seeking: m.seeking, readyState: m.readyState, networkState: m.networkState,
      buffered: ranges.join(', ') || '(なし)', playbackRate: m.playbackRate, volume: m.volume, muted: m.muted,
      srcの種類: src.startsWith('blob:') ? 'blob（HLS/MSE）' : src ? safeUrl(src) : '(なし)'
    };
    if (m.tagName === 'VIDEO') {
      const v = m as HTMLVideoElement;
      state['映像サイズ'] = v.videoWidth + 'x' + v.videoHeight;
      const q = typeof v.getVideoPlaybackQuality === 'function' ? v.getVideoPlaybackQuality() : null;
      if (q) state['コマ落ち'] = q.droppedVideoFrames + '/' + q.totalVideoFrames;
    }
    if (m.error) state['MediaError'] = {code: m.error.code, message: m.error.message};
    return state;
  };
  // Task1054: ZenzaWatch の動画要素は Shadow DOM の中や別の文書（iframe）にあることがあり、
  // メディアのイベントは composed ではないので、document への capture では届かない。
  // open な shadow root と同じオリジンの iframe もたどって video/audio を探し、要素に直接リスナーを付ける。
  const isMedia = (n: unknown): n is HTMLMediaElement =>
    !!n && typeof (n as HTMLMediaElement).canPlayType === 'function' && typeof (n as HTMLMediaElement).currentTime === 'number';
  const findMedia = (root: Document | ShadowRoot, out: HTMLMediaElement[] = [], depth = 0): HTMLMediaElement[] => {
    if (depth > 6) return out;
    let all: NodeListOf<Element>;
    try { all = root.querySelectorAll('*'); } catch (_) { return out; }
    for (const el of Array.from(all)) {
      if (isMedia(el)) out.push(el);
      const shadow = (el as Element & {shadowRoot?: ShadowRoot | null}).shadowRoot;
      if (shadow) findMedia(shadow, out, depth + 1);
      if (el.tagName === 'IFRAME') {
        try {
          const doc = (el as HTMLIFrameElement).contentDocument;
          if (doc) findMedia(doc, out, depth + 1);
        } catch (_) { /* 別オリジンの iframe は見られない */ }
      }
    }
    return out;
  };
  const startPlayer = (): (() => void) => {
    const w = options!.window;
    const watched = new Set<HTMLMediaElement>();
    // Task1055: HLS 再生用の要素は同じイベントを続けて 2 回送ることがあるので、
    // 同じ要素・同じ種類・同じ再生位置のイベントが 50ms 以内に続いたら 1 回にまとめる。
    const lastEvent = new WeakMap<HTMLMediaElement, {type: string; at: number; time: number}>();
    const onMedia = (e: Event) => {
      const m = e.target;
      if (!isMedia(m)) return;
      const now = nowMs();
      const prev = lastEvent.get(m);
      if (prev && prev.type === e.type && now - prev.at < 50 && Math.abs(prev.time - m.currentTime) < 0.05) return;
      lastEvent.set(m, {type: e.type, at: now, time: m.currentTime});
      if (!mediaIds.has(m)) mediaIds.set(m, ++mediaSeq);
      const level: DiagLevel = e.type === 'error' ? 'error' : ['waiting', 'stalled', 'abort', 'emptied'].includes(e.type) ? 'warn' : 'info';
      log('player', level, '動画要素のイベント: ' + e.type, mediaState(m));
    };
    const attach = (m: HTMLMediaElement) => {
      if (watched.has(m)) return;
      watched.add(m);
      if (!mediaIds.has(m)) mediaIds.set(m, ++mediaSeq);
      for (const name of DIAG_MEDIA_EVENTS) m.addEventListener(name, onMedia);
      log('player', 'debug', '動画要素を見つけました', mediaState(m));
    };
    // 再生中なのに再生位置が進まない状態（止まり）を見張り、新しい動画要素を探す
    const last = new WeakMap<HTMLMediaElement, {time: number; since: number; reported: boolean}>();
    const scan = () => {
      const found = findMedia(w.document);
      for (const m of found) attach(m);
      for (const m of Array.from(watched)) {
        if (!m.isConnected) {
          for (const name of DIAG_MEDIA_EVENTS) m.removeEventListener(name, onMedia);
          watched.delete(m);
          continue;
        }
        if (m.paused || m.ended || m.readyState === 0) { last.delete(m); continue; }
        const prev = last.get(m);
        const now = nowMs();
        if (!prev || prev.time !== m.currentTime) { last.set(m, {time: m.currentTime, since: now, reported: false}); continue; }
        if (!prev.reported && now - prev.since >= 3000) {
          prev.reported = true;
          log('player', 'warn', '再生中なのに再生位置が3秒以上進んでいません', mediaState(m));
        }
      }
    };
    scan();
    const timer = w.setInterval(scan, 1000);
    return () => {
      for (const m of watched) for (const name of DIAG_MEDIA_EVENTS) m.removeEventListener(name, onMedia);
      watched.clear();
      w.clearInterval(timer);
    };
  };

  const startNetwork = (): (() => void) => {
    const w = options!.window;
    if (typeof w.PerformanceObserver !== 'function') {
      log('network', 'warn', 'PerformanceObserver が無いため通信の記録はできません');
      return () => {};
    }
    // Task1054: 別ドメインの通信は、相手が Timing-Allow-Origin を返さないと状態コードが 0、転送量が 0 になる
    // （ブラウザの仕様）。0 は「失敗」ではなく「不明」として扱い、失敗は 400 以上のときだけにする。
    const segments = {count: 0, bytes: 0, bytesKnown: 0, totalMs: 0, maxMs: 0, failed: 0};
    const others = {count: 0, unknown: 0, api: 0};
    const observer = new w.PerformanceObserver(list => {
      for (const raw of list.getEntries()) {
        const e = raw as PerformanceResourceTiming & {responseStatus?: number};
        let url: URL;
        try { url = new URL(e.name); } catch (_) { continue; }
        if (!DIAG_HOST.test(url.hostname)) continue;
        const status = typeof e.responseStatus === 'number' && e.responseStatus > 0 ? e.responseStatus : undefined;
        const expected = status === undefined ? null : DIAG_EXPECTED_FAILURES.find(rule =>
          rule.status === status && rule.host.test(url.hostname) && rule.path.test(url.pathname)) || null;
        const failed = status !== undefined && status >= 400 && !expected;
        const bytes = e.transferSize > 0 ? e.transferSize : 0;
        if (DIAG_SEGMENT.test(url.pathname)) {
          if (failed) segments.failed++;
          else {
            segments.count++; segments.totalMs += e.duration; segments.maxMs = Math.max(segments.maxMs, e.duration);
            if (bytes) { segments.bytes += bytes; segments.bytesKnown++; }
          }
          if (!failed) continue;
        }
        const api = e.initiatorType === 'fetch' || e.initiatorType === 'xmlhttprequest';
        if (expected) {
          log('network', 'debug', '通信（正常な ' + status + '）: ' + safeUrl(e.name), {見立て: expected.note, 所要ms: Math.round(e.duration)});
          continue;
        }
        if (!failed && !api) { others.count++; if (status === undefined) others.unknown++; continue; }
        if (!failed) others.api++;
        log('network', failed ? 'warn' : 'debug', (failed ? '通信の失敗: ' : '通信: ') + safeUrl(e.name), {
          種類: e.initiatorType, status: status ?? '不明（別ドメインのため取得できない）', 所要ms: Math.round(e.duration),
          転送バイト: bytes || '不明', キャッシュ: e.transferSize === 0 && e.decodedBodySize > 0 ? 'あり' : '不明または無し',
          待ちms: Math.round(e.responseStart > 0 ? e.responseStart - e.startTime : 0)
        });
      }
    });
    try { observer.observe({type: 'resource', buffered: false}); } catch (_) { observer.observe({entryTypes: ['resource']}); }
    const summary = w.setInterval(() => {
      if (segments.count || segments.failed) {
        const avg = segments.count ? Math.round(segments.totalMs / segments.count) : 0;
        log('network', segments.failed ? 'warn' : 'info', '動画データ（セグメント）の受信まとめ（直近10秒）', {
          件数: segments.count, 失敗: segments.failed, 平均ms: avg, 最大ms: Math.round(segments.maxMs),
          合計KB: segments.bytesKnown ? Math.round(segments.bytes / 1024) : '不明（別ドメインのため測れない）',
          推定Mbps: segments.bytesKnown && segments.totalMs ?
            Number(((segments.bytes * 8) / (segments.totalMs / 1000) / 1e6).toFixed(2)) : '不明'
        });
      }
      if (others.count) {
        log('network', 'debug', '画像などの通信のまとめ（直近10秒）', {件数: others.count, 状態不明: others.unknown, API通信: others.api});
      }
      segments.count = segments.bytes = segments.bytesKnown = segments.totalMs = segments.maxMs = segments.failed = 0;
      others.count = others.unknown = others.api = 0;
    }, 10000);
    return () => { observer.disconnect(); w.clearInterval(summary); };
  };

  const startNotifications = (): (() => void) => {
    const journal = options!.journal;
    if (!journal) { log('notifications', 'warn', '通知履歴の仕組みが見つからないため、通知は記録できません'); return () => {}; }
    const seen = new Set<string>();
    let primed = false;
    const read = async () => {
      try {
        const list = await journal.list(50);
        for (const raw of list.slice().reverse()) {
          const item = raw as Record<string, unknown>;
          const id = typeof item['id'] === 'string' ? item['id'] : JSON.stringify(item).slice(0, 80);
          const stamp = id + ':' + String(item['count'] ?? '') + ':' + String(item['lastOccurredAt'] ?? '');
          if (seen.has(stamp)) continue;
          seen.add(stamp);
          if (!primed) continue;
          const lv = String(item['level'] ?? 'info');
          log('notifications', lv === 'error' ? 'error' : lv === 'warning' ? 'warn' : 'info',
            '通知: ' + String(item['message'] ?? ''), item);
        }
        primed = true;
      } catch (error) {
        log('notifications', 'warn', '通知履歴を読めませんでした', error);
      }
    };
    void read();
    const unsubscribe = journal.subscribe(() => { void read(); });
    return unsubscribe;
  };

  const startSettings = (): (() => void) => {
    onConfigUpdate = (key: unknown, value: unknown) => {
      const k = String(key);
      log('settings', 'info', '設定が変わりました: ' + k, {値: DIAG_SECRET_KEY.test(k) || /filter|ng/i.test(k) ? '[伏せ字]' : value});
    };
    updateHandlers.add(onConfigUpdate);
    return () => {
      if (onConfigUpdate) updateHandlers.delete(onConfigUpdate);
      onConfigUpdate = null;
    };
  };

  const startEvents = (): (() => void) => {
    const emitter = options!.emitter;
    if (!emitter || typeof emitter.emit !== 'function') return () => {};
    const original = emitter.emit;
    const lastAt = new Map<string, {at: number; skipped: number}>();
    emitter.emit = function (this: DiagEmitter, name: string, ...args: unknown[]) {
      try {
        if (!DIAG_NOISY_EVENTS.test(String(name)) && isOn('events')) {
          const now = Date.now();
          const prev = lastAt.get(name);
          if (prev && now - prev.at < 2000) prev.skipped++;
          else {
            log('events', 'debug', '内部イベント: ' + String(name) + (prev && prev.skipped ? '（直前2秒に同じイベント' + prev.skipped + '回）' : ''),
              args.length ? args.slice(0, 3) : undefined);
            lastAt.set(name, {at: now, skipped: 0});
          }
        }
      } catch (_) { /* 記録の失敗で本来の処理を止めない */ }
      return original.call(this, name, ...args);
    };
    restoreEmit = () => { emitter.emit = original; };
    return () => { restoreEmit?.(); restoreEmit = null; };
  };

  const startPerformance = (): (() => void) => {
    const w = options!.window;
    let longObserver: PerformanceObserver | null = null;
    if (typeof w.PerformanceObserver === 'function') {
      try {
        longObserver = new w.PerformanceObserver(list => {
          for (const e of list.getEntries()) {
            log('performance', e.duration >= 200 ? 'warn' : 'debug',
              '画面が固まった時間（長いタスク）: ' + Math.round(e.duration) + 'ms', {開始: Math.round(e.startTime)});
          }
        });
        longObserver.observe({type: 'longtask', buffered: false});
      } catch (_) { longObserver = null; }
    }
    // Task1059: 長いフレーム（Long Animation Frames, Chrome 123+）は「どのスクリプトのどの関数が」
    // 時間を使ったかが分かる。ZenzaWatch とページ側（ニコニコ・広告・拡張機能）と描画に分けて出す。
    let frameObserver: PerformanceObserver | null = null;
    const supported = (w.PerformanceObserver as unknown as {supportedEntryTypes?: readonly string[]}).supportedEntryTypes;
    if (typeof w.PerformanceObserver === 'function' && supported?.includes('long-animation-frame')) {
      try {
        frameObserver = new w.PerformanceObserver(list => {
          for (const raw of list.getEntries()) {
            const e = raw as PerformanceEntry & {renderStart?: number; styleAndLayoutStart?: number; blockingDuration?: number;
              scripts?: Array<{duration: number; sourceURL?: string; sourceFunctionName?: string; invoker?: string; invokerType?: string;
                forcedStyleAndLayoutDuration?: number}>};
            if (e.duration < 150) continue;
            let zenzaMs = 0, pageMs = 0, forcedLayoutMs = 0;
            const scripts = (e.scripts || []).slice().sort((a, b) => b.duration - a.duration);
            for (const sc of scripts) {
              const own = isZenza(String(sc.sourceURL || '') + ' ' + String(sc.invoker || ''));
              if (own) zenzaMs += sc.duration; else pageMs += sc.duration;
              forcedLayoutMs += sc.forcedStyleAndLayoutDuration || 0;
            }
            const renderMs = e.styleAndLayoutStart && e.styleAndLayoutStart > 0 ? e.startTime + e.duration - e.styleAndLayoutStart : 0;
            const owner = zenzaMs >= pageMs ? 'ZenzaWatch' : 'ページ側';
            log('performance', e.duration >= 300 ? 'warn' : 'info',
              '画面が固まったフレーム: ' + Math.round(e.duration) + 'ms（主な原因: ' + (zenzaMs + pageMs < renderMs ? '描画' : owner) + '）', {
                開始: Math.round(e.startTime),
                ZenzaWatchのスクリプトms: Math.round(zenzaMs),
                ページ側のスクリプトms: Math.round(pageMs),
                '描画（スタイル計算・レイアウト）ms': Math.round(renderMs),
                強制レイアウトms: Math.round(forcedLayoutMs),
                上位: scripts.slice(0, 4).map(sc => ({
                  ms: Math.round(sc.duration),
                  関数: String(sc.sourceFunctionName || '(無名)').slice(0, 60),
                  場所: (isZenza(String(sc.sourceURL || '')) ? '[ZenzaWatch] ' : '') +
                    String(sc.sourceURL || '').replace(/[?#].*$/, '').split('/').pop()!.slice(0, 60),
                  きっかけ: String(sc.invoker || sc.invokerType || '').slice(0, 60)
                }))
              });
          }
        });
        frameObserver.observe({type: 'long-animation-frame', buffered: true});
      } catch (_) { frameObserver = null; }
    }
    // イベントループの遅れ（setInterval のずれ）を測る
    let expected = Date.now() + 500;
    let worstLag = 0;
    const lagTimer = w.setInterval(() => {
      const now = Date.now();
      worstLag = Math.max(worstLag, now - expected);
      expected = now + 500;
    }, 500);
    let snapshotTimer = 0;
    const schedule = () => {
      if (snapshotTimer) w.clearInterval(snapshotTimer);
      const sec = Number(cfg(DIAG_KEYS.interval));
      snapshotTimer = sec > 0 ? w.setInterval(snapshot, Math.max(5, sec) * 1000) : 0;
    };
    const snapshot = () => {
      const perf = w.performance as Performance & {memory?: {usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number}};
      const data: Record<string, unknown> = {
        DOM要素数: w.document.getElementsByTagName('*').length,
        style要素数: w.document.getElementsByTagName('style').length,
        video要素数: findMedia(w.document).filter(m => m.tagName === 'VIDEO').length,
        iframe数: w.document.getElementsByTagName('iframe').length,
        表示状態: w.document.visibilityState,
        イベントループ最大遅れms: worstLag
      };
      if (perf.memory) {
        data['JSヒープ使用MB'] = Math.round(perf.memory.usedJSHeapSize / 1048576);
        data['JSヒープ確保MB'] = Math.round(perf.memory.totalJSHeapSize / 1048576);
      }
      const v = findMedia(w.document).find(m => m.tagName === 'VIDEO' && !(m as HTMLVideoElement).paused) as HTMLVideoElement | undefined;
      if (v && typeof v.getVideoPlaybackQuality === 'function') {
        const q = v.getVideoPlaybackQuality();
        data['コマ落ち（累計）'] = q.droppedVideoFrames + '/' + q.totalVideoFrames;
      }
      log('performance', worstLag >= 500 ? 'warn' : 'info', '負荷の定期記録', data);
      worstLag = 0;
    };
    schedule();
    const onInterval = (key: unknown) => { if (key === DIAG_KEYS.interval) schedule(); };
    updateHandlers.add(onInterval);
    return () => {
      longObserver?.disconnect();
      frameObserver?.disconnect();
      w.clearInterval(lagTimer);
      if (snapshotTimer) w.clearInterval(snapshotTimer);
      updateHandlers.delete(onInterval);
    };
  };

  const logStartup = (): void => {
    const w = options!.window;
    const nav = w.navigator as Navigator & {deviceMemory?: number; connection?: {effectiveType?: string; downlink?: number; rtt?: number; saveData?: boolean}};
    const navEntry = w.performance.getEntriesByType?.('navigation')[0] as PerformanceNavigationTiming | undefined;
    const settings: Record<string, unknown> = {};
    for (const key of DIAG_SAFE_CONFIG) {
      const v = cfg(key);
      if (v !== undefined) settings[key] = v;
    }
    log('startup', 'info', '診断ログを開始しました（ZenzaWatch ' + options!.version + '）', {
      版: options!.version, ビルド: options!.build || '(不明)', ページ: safeUrl(w.location.href),
      ブラウザ: nav.userAgent, 言語: nav.language, CPUスレッド: nav.hardwareConcurrency,
      端末メモリGB: nav.deviceMemory ?? '(不明)',
      回線: nav.connection ? {種類: nav.connection.effectiveType, 下りMbps: nav.connection.downlink, rttMs: nav.connection.rtt, 節約: nav.connection.saveData} : '(不明)',
      画面: w.screen.width + 'x' + w.screen.height + ' @' + w.devicePixelRatio + 'x', ウィンドウ: w.innerWidth + 'x' + w.innerHeight,
      ページ表示からの経過ms: Math.round(w.performance.now()),
      ページの読み込み: navEntry ? {DOM完了ms: Math.round(navEntry.domContentLoadedEventEnd), load完了ms: Math.round(navEntry.loadEventEnd), 種類: navEntry.type} : '(不明)',
      主な設定: settings
    });
    const storage = nav.storage;
    if (storage && typeof storage.estimate === 'function') {
      storage.estimate().then(est => log('startup', 'info', 'ブラウザの保存領域', {
        使用MB: Math.round((est.usage || 0) / 1048576), 上限MB: Math.round((est.quota || 0) / 1048576)
      }), () => {});
    }
  };

  const starters: Record<DiagCategory, (() => (() => void)) | null> = {
    errors: startErrors, startup: null, player: startPlayer, network: startNetwork,
    notifications: startNotifications, settings: startSettings, events: startEvents, performance: startPerformance
  };
  const refresh = (): void => {
    for (const category of Object.keys(starters) as DiagCategory[]) {
      const start = starters[category];
      if (!start) continue;
      const running = stops.has(category);
      const want = isOn(category);
      try {
        if (want && !running) stops.set(category, start());
        else if (!want && running) { stops.get(category)?.(); stops.delete(category); }
      } catch (error) {
        write('diagnostics', 'warn', DIAG_CATEGORY_LABEL[category] + 'の記録を開始できませんでした', error);
      }
    }
  };

  const install = (opts: DiagInstallOptions): void => {
    if (installed) return;
    installed = true;
    options = opts;
    const api = {
      status: () => ({enabled: cfg(DIAG_KEYS.enabled) === true, running: Array.from(stops.keys()), entries: entries.length}),
      entries: () => entries.slice(),
      dump: (limit = 200) => { options?.window.console.table(entries.slice(-limit).map(e => ({...e, data: e.data === undefined ? '' : JSON.stringify(e.data).slice(0, 300)}))); },
      copy: async () => {
        const text = JSON.stringify({version: opts.version, build: opts.build, entries}, null, 1);
        await opts.window.navigator.clipboard.writeText(text);
        return entries.length;
      },
      clear: () => { entries.length = 0; },
      mark: (name: string, data?: unknown) => log('startup', 'info', '目印: ' + name, data),
      measure: <T>(name: string, task: () => T | Promise<T>): Promise<T> => {
        const t0 = opts.window.performance.now();
        log('startup', 'debug', '開始: ' + name);
        return Promise.resolve().then(task).then(result => {
          log('startup', 'info', '完了: ' + name + '（' + Math.round(opts.window.performance.now() - t0) + 'ms）');
          return result;
        }, error => {
          log('errors', 'error', '失敗: ' + name + '（' + Math.round(opts.window.performance.now() - t0) + 'ms）', error);
          throw error;
        });
      }
    };
    if (opts.debugRoot) opts.debugRoot['diagnostics'] = api;
    const onUpdate = (key: unknown) => {
      if (typeof key !== 'string' || !key.startsWith('diagnostics.console.')) return;
      const wasOn = stops.size > 0;
      refresh();
      if (key === DIAG_KEYS.enabled && cfg(DIAG_KEYS.enabled) === true && !wasOn) logStartup();
      if (key === DIAG_KEYS.enabled && cfg(DIAG_KEYS.enabled) !== true) {
        write('diagnostics', 'info', '診断ログを停止しました（ここまでの記録は ZenzaWatch.debug.diagnostics.copy() で取り出せます）');
      }
    };
    updateHandlers.add(onUpdate);
    opts.config.on?.('update', (key: unknown, value: unknown) => {
      for (const handler of Array.from(updateHandlers)) {
        try { handler(key, value); } catch (_) { /* 記録の失敗で設定の反映を止めない */ }
      }
    });
    refresh();
    if (cfg(DIAG_KEYS.enabled) === true) {
      logStartup();
      write('diagnostics', 'info', '使い方: ZenzaWatch.debug.diagnostics.dump() で一覧、.copy() で記録をクリップボードへコピーできます');
    }
  };

  return {install, log, enabled: (category: string): boolean => category in DIAG_KEYS && isOn(category as DiagCategory), mark: (name: string, data?: unknown) => log('startup', 'info', '目印: ' + name, data),
    measure: <T>(name: string, task: () => T | Promise<T>): Promise<T> => {
      const api = options?.debugRoot?.['diagnostics'] as {measure?: (n: string, t: () => T | Promise<T>) => Promise<T>} | undefined;
      return api?.measure ? api.measure(name, task) : Promise.resolve().then(task);
    },
    KEYS: DIAG_KEYS};
})();
//===END===
export {DiagnosticConsole};
