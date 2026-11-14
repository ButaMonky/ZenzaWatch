import test from 'node:test';
import assert from 'node:assert/strict';
import {HlsPrefetch, PrefetchError, chooseStartVariant, isAllowedPrefetchUrl} from '../.generated/prefetch/hls-src/HlsStartupPrefetch.js';
import {PlaylistPreloader} from '../.generated/prefetch/hls-src/PlaylistPreloader.js';
import {createPlaylistStartupPreparer, describeError, sessionExpiresAt} from '../.generated/prefetch/nico-src/PlaylistStartupPreparer.js';
import {createPrefetchReporter, codeValue, describeFailure} from '../.generated/prefetch/nico-src/PrefetchReporter.js';

const D = 'https://delivery.domand.nicovideo.jp/hlsbid/abc/playlists';
const A = 'https://asset.domand.nicovideo.jp/xyz';
const MASTER = `${D}/variants/sm1.m3u8?session=1`;
const master = [
  '#EXTM3U',
  '#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio-aac-128kbps",NAME="Main",DEFAULT=YES,URI="' + D + '/media/audio-aac-128kbps.m3u8?s=1"',
  '#EXT-X-STREAM-INF:BANDWIDTH=3000000,AUDIO="audio-aac-128kbps"', D + '/media/video-h264-720p.m3u8?s=1',
  '#EXT-X-STREAM-INF:BANDWIDTH=600000,AUDIO="audio-aac-128kbps"', D + '/media/video-h264-360p.m3u8?s=1',
  '#EXT-X-STREAM-INF:BANDWIDTH=1200000,AUDIO="audio-aac-128kbps"', D + '/media/video-h264-480p.m3u8?s=1',
  ''
].join('\n');
const mediaPlaylist = (kind) => [
  '#EXTM3U', '#EXT-X-VERSION:6', '#EXT-X-TARGETDURATION:6',
  `#EXT-X-MAP:URI="${A}/${kind}/init01.cmfv?sig=1"`,
  `#EXT-X-KEY:METHOD=AES-128,URI="${D.replace('/playlists', '')}/keys/${kind}.key?s=1",IV=0x00`,
  '#EXTINF:6.0,', `${A}/${kind}/01.cmfv?sig=1`,
  '#EXTINF:6.0,', `${A}/${kind}/02.cmfv?sig=1`,
  '#EXT-X-ENDLIST', ''
].join('\n');

const makeFetcher = (overrides = {}) => {
  const calls = [];
  const fetcher = async (url, init) => {
    calls.push({url, init});
    if (overrides[url]) return overrides[url]();
    let body;
    if (url === MASTER) body = master;
    else if (url.includes('/media/audio')) body = mediaPlaylist('audio');
    else if (url.includes('/media/video-h264-')) body = mediaPlaylist('video-' + url.match(/h264-(\d+p)/)[1]);
    else body = new Uint8Array(1000);
    return new Response(body, {status: 200});
  };
  return {fetcher, calls};
};
const hosts = (calls) => calls.map(c => new URL(c.url).hostname);

test('domand: delivery と asset の別ホスト構成で先頭データを取得できる（旧版はここで失敗）', async () => {
  const {fetcher, calls} = makeFetcher();
  const prepared = await HlsPrefetch.prepare(MASTER, new AbortController().signal, {fetcher});
  assert.ok(hosts(calls).includes('asset.domand.nicovideo.jp'));
  assert.deepEqual(prepared.stages, ['master', 'audio-playlist', 'audio-key', 'audio-init', 'audio-segment',
    'video-playlist', 'video-key', 'video-init', 'video-segment']);
  assert.ok(prepared.entries.has(`${A}/video-360p/01.cmfv?sig=1`));
  assert.ok(prepared.entries.has(`${A}/audio/init01.cmfv?sig=1`));
  assert.ok(!prepared.entries.has(`${A}/video-360p/02.cmfv?sig=1`), '取得は先頭1セグメントだけ');
  assert.equal(prepared.startLevel, 0);
  assert.ok(calls.every(c => c.init.credentials === 'include' && c.init.priority === 'low'));
});

test('開始画質: 推定回線速度・固定 startLevel に合わせる（旧版は常に最低画質）', async () => {
  const {fetcher, calls} = makeFetcher();
  const prepared = await HlsPrefetch.prepare(MASTER, new AbortController().signal, {fetcher, bandwidthEstimate: 2e6});
  assert.equal(prepared.startLevel, 1); // 1.2Mbps(480p) <= 2Mbps*0.8
  assert.ok(calls.some(c => c.url.includes('video-h264-480p')));
  const v = [{bandwidth: 3, index: 0}, {bandwidth: 1, index: 1}, {bandwidth: 2, index: 2}];
  assert.deepEqual(chooseStartVariant(v, 2), {variant: v[0], level: 2});
  assert.deepEqual(chooseStartVariant(v, 99), {variant: v[0], level: 2});
  assert.deepEqual(chooseStartVariant(v, -1, 0.5), {variant: v[1], level: 0});
});

test('nicovideo.jp 外・http・ポート付きは拒否し、理由とホストを返す', async () => {
  const src = new URL(MASTER).hostname;
  assert.equal(isAllowedPrefetchUrl(new URL('https://evil.example/x'), src), false);
  assert.equal(isAllowedPrefetchUrl(new URL('http://asset.domand.nicovideo.jp/x'), src), false);
  assert.equal(isAllowedPrefetchUrl(new URL('https://asset.domand.nicovideo.jp:8443/x'), src), false);
  assert.equal(isAllowedPrefetchUrl(new URL('https://evilnicovideo.jp/x'), src), false);
  const bad = master.replace(D + '/media/video-h264-360p.m3u8?s=1', 'https://evil.example/v.m3u8');
  const {fetcher} = makeFetcher({[MASTER]: () => new Response(bad)});
  await assert.rejects(HlsPrefetch.prepare(MASTER, new AbortController().signal, {fetcher}), (e) =>
    e instanceof PrefetchError && e.detail.stage === 'master' && e.detail.reason === 'unsupported URL' && e.detail.host === 'evil.example');
});

test('HTTP エラーは段階・ステータス・ホスト付きで失敗する', async () => {
  const {fetcher} = makeFetcher({[`${A}/video-360p/init01.cmfv?sig=1`]: () => new Response('no', {status: 403})});
  await assert.rejects(HlsPrefetch.prepare(MASTER, new AbortController().signal, {fetcher}), (e) =>
    e.detail.stage === 'video-init' && e.detail.status === 403 && e.detail.host === 'asset.domand.nicovideo.jp');
});

test('通信例外（CORS など）は network error として記録する', async () => {
  const {fetcher} = makeFetcher({[`${A}/audio/01.cmfv?sig=1`]: () => { throw new TypeError('Failed to fetch'); }});
  await assert.rejects(HlsPrefetch.prepare(MASTER, new AbortController().signal, {fetcher}), (e) =>
    e.detail.stage === 'audio-segment' && e.detail.reason === 'network error' && e.detail.message === 'Failed to fetch');
});

test('容量上限を超えたら止める', async () => {
  const {fetcher} = makeFetcher({[`${A}/video-360p/01.cmfv?sig=1`]: () => new Response(new Uint8Array(5000))});
  await assert.rejects(HlsPrefetch.prepare(MASTER, new AbortController().signal, {fetcher, maxBytes: 4000}), (e) =>
    e.detail.reason === 'size limit' && e.detail.bytes > 0);
});

test('中止すると即座に止まる', async () => {
  const c = new AbortController();
  const {fetcher} = makeFetcher({[`${D}/media/audio-aac-128kbps.m3u8?s=1`]: () => { c.abort(); return new Response(mediaPlaylist('audio')); }});
  await assert.rejects(HlsPrefetch.prepare(MASTER, c.signal, {fetcher}), /canceled/);
});

test('wrapLoader: 先読み済みURLはキャッシュから応答し、使用回数を数える', async () => {
  const {fetcher} = makeFetcher();
  const prepared = await HlsPrefetch.prepare(MASTER, new AbortController().signal, {fetcher});
  class Base {
    constructor() { this.stats = {loading: {}}; this.network = 0; }
    load() { this.network++; } abort() {} destroy() {}
  }
  const Loader = HlsPrefetch.wrapLoader(Base);
  HlsPrefetch.activate(prepared);
  const hit = new Loader({});
  const got = await new Promise(r => hit.load({url: `${A}/video-360p/01.cmfv?sig=1`, responseType: 'arraybuffer'}, {}, {onSuccess: r}));
  assert.equal(got.data.byteLength, 1000);
  const text = await new Promise(r => new Loader({}).load({url: MASTER, responseType: 'text'}, {}, {onSuccess: r}));
  assert.ok(text.data.startsWith('#EXTM3U'));
  const miss = new Loader({});
  miss.load({url: `${A}/video-360p/02.cmfv?sig=1`, responseType: 'arraybuffer'}, {}, {onSuccess() {}});
  assert.equal(miss.network, 1);
  assert.equal(HlsPrefetch.hits(MASTER), 2);
  assert.equal(HlsPrefetch.startLevel(MASTER), 0);
  HlsPrefetch.clear();
  assert.equal(HlsPrefetch.startLevel(MASTER), undefined);
});

// ---- PlaylistPreloader（複数動画対応） ----
const sample = (o = {}) => ({settings: 'k', candidates: ['sm2', 'sm3', 'sm4'], currentId: 'sm1', enabled: true,
  playing: true, seeking: false, waiting: false, currentTime: 100, duration: 600, bufferEnd: 130, rate: 1,
  ended: false, windowCount: 2, maxStoreBytes: 1e9, pacingMs: 0, ...o});
const flush = () => new Promise(r => setTimeout(r, 0));
const deferred = () => { let resolve, reject; const p = new Promise((a2, b2) => { resolve = a2; reject = b2; }); return {p, resolve, reject}; };
const mk = (opts = {}) => {
  const t = {value: 1000};
  const events = [];
  const pre = new PlaylistPreloader(
    opts.prepare ?? (async (id) => ({id, bytes: opts.bytes ?? 100, dispose() { this.disposed = true; }})),
    () => t.value, opts.onReady, e => events.push(e),
    v => v.bytes ?? 0, opts.expiresOf ?? (() => undefined), opts.random ?? (() => 0), opts.timeoutMs);
  return {pre, t, events};
};
const types = (events) => events.map(e => e.type);

test('Preloader: 初期設定では待機なしで、ウィンドウ本数ぶんを順に準備する', async () => {
  const {pre, t, events} = mk();
  pre.update(sample());
  await flush();
  pre.update(sample());
  await flush();
  assert.deepEqual(types(events), ['start', 'ready', 'start', 'ready']);
  assert.deepEqual(pre.readyIds(), ['sm2', 'sm3']);
  pre.update(sample());
  assert.equal(types(events).filter(x => x === 'start').length, 2, 'windowCount=2 なので sm4 は準備しない');
  pre.reset();
});

test('Preloader: 待機時間を設定すると、設定値の1〜2倍の乱数で待つ', async () => {
  const {pre, t, events} = mk({random: () => 1});
  const s = () => sample({pacingMs: 1000});
  pre.update(s());
  await flush();
  pre.update(s());
  assert.equal(types(events).filter(x => x === 'start').length, 1, '待機中は次を始めない');
  t.value += 2000 - 1; // 1000 + 1.0*1000
  pre.update(s());
  assert.equal(types(events).filter(x => x === 'start').length, 1);
  t.value += 1;
  pre.update(s());
  assert.equal(types(events).filter(x => x === 'start').length, 2);
  pre.reset();
});

test('Preloader: 候補から外れても破棄せず、どの動画でも take できる', async () => {
  const {pre, t} = mk();
  pre.update(sample());
  await flush();
  t.value += 4000;
  pre.update(sample({candidates: ['sm9', 'sm10'], windowCount: 1}));
  assert.equal(pre.readyIds().includes('sm2'), true);
  assert.ok(pre.take('sm2'), '候補外でもキャッシュから使える');
  pre.reset();
});

test('Preloader: 格納上限を超えたら古い順に破棄（LRU）', async () => {
  const {pre, t, events} = mk({bytes: 600});
  const s = () => sample({windowCount: 3, maxStoreBytes: 1300});
  for (let i = 0; i < 3; i++) { pre.update(s()); await flush(); t.value += 12000; }
  assert.deepEqual(pre.readyIds(), ['sm3', 'sm4'], 'sm2 が追い出される');
  assert.equal(types(events).filter(x => x === 'evicted').length, 1);
  assert.equal(pre.totalBytes(), 1200);
  pre.reset();
});

test('Preloader: take は該当の1本だけ取り出し、他は残す', async () => {
  const {pre, t, events} = mk();
  pre.update(sample());
  await flush();
  t.value += 4000;
  pre.update(sample());
  await flush();
  assert.ok(pre.take('sm2'));
  assert.deepEqual(pre.readyIds(), ['sm3']);
  assert.equal(pre.take('sm9'), null);
  assert.deepEqual(events.at(-1), {type: 'take-miss', id: 'sm9', reason: 'none'});
  pre.reset();
});

test('Preloader: 一時停止・バッファ不足では通信だけ止め、回復後に再挑戦する', async () => {
  const runs = [];
  const {pre, t, events} = mk({prepare: (id, signal) => { const d = deferred(); runs.push({d, signal}); return d.p; }});
  pre.update(sample());
  pre.update(sample({waiting: true}));
  assert.equal(runs[0].signal.aborted, true);
  assert.deepEqual(types(events), ['start', 'paused']);
  runs[0].d.reject(new Error('prefetch canceled'));
  await flush();
  t.value += 12000;
  pre.update(sample());
  assert.equal(runs.length, 2, '条件が戻ったら同じ候補で再挑戦');
  runs[1].d.resolve({dispose() {}});
  await flush();
  pre.reset();
});

test('Preloader: 失敗は乱数込みの間隔を空けて1回だけ再試行する', async () => {
  let calls = 0;
  const {pre, t, events} = mk({prepare: async () => { calls++; throw new Error('x'); }, random: () => 0.5});
  pre.update(sample({windowCount: 1, candidates: ['sm2']}));
  await flush();
  t.value += 9000;
  pre.update(sample({windowCount: 1, candidates: ['sm2']}));
  await flush();
  t.value += 60000;
  pre.update(sample({windowCount: 1, candidates: ['sm2']}));
  await flush();
  assert.equal(calls, 2, 'MAX_FAILURES=2 でそれ以上は試さない');
  assert.deepEqual(types(events), ['start', 'failed', 'start', 'failed']);
  assert.equal(events[1].willRetry, true);
  assert.equal(events[3].willRetry, false);
  pre.reset();
});

test('Preloader: 失敗した動画の待ち時間中は、次の候補を先に準備する', async () => {
  const rand = [1, 0]; // retryAt は +6秒
  const {pre, t, events} = mk({prepare: async (id) => { if (id === 'sm2') throw new Error('x'); return {id, bytes: 1, dispose() {}}; },
    random: () => rand.shift() ?? 0});
  pre.update(sample());
  await flush();
  t.value += 4000; // ペーシングは明けたが sm2 の retryAt はまだ
  pre.update(sample());
  await flush();
  const starts = events.filter(e => e.type === 'start');
  assert.deepEqual(starts.map(e => e.id), ['sm2', 'sm3']);
  pre.reset();
});

test('Preloader: セッション期限の60秒手前で破棄し、ウィンドウ内なら作り直す', async () => {
  const {pre, t, events} = mk({expiresOf: () => 1000 + 90 * 1000});
  pre.update(sample({windowCount: 1, candidates: ['sm2']}));
  await flush();
  t.value = 30999; // deadline = 91000 - 60000 = 31000
  pre.update(sample({windowCount: 1, candidates: ['sm2']}));
  assert.deepEqual(pre.readyIds(), ['sm2']);
  t.value = 31000;
  pre.update(sample({windowCount: 1, candidates: ['sm2']}));
  assert.equal(pre.readyIds().length, 0, '期限で破棄');
  assert.ok(types(events).includes('expired'));
  await flush();
  assert.equal(types(events).filter(x => x === 'start').length, 2, '自動で作り直す');
  pre.reset();
});

test('Preloader: 設定キーが変わったら全部作り直す', async () => {
  const {pre, t} = mk();
  pre.update(sample());
  await flush();
  t.value += 12000;
  pre.update(sample({settings: 'k2'}));
  assert.equal(pre.readyIds().length, 0);
  pre.reset();
});

test('Preloader: 再生終了直後は何もしないが、準備済みは残す', async () => {
  const {pre, t} = mk();
  pre.update(sample());
  await flush();
  t.value += 12000;
  pre.update(sample({ended: true, playing: false}));
  assert.deepEqual(pre.readyIds(), ['sm2']);
  assert.ok(pre.take('sm2'));
  pre.reset();
});


// ---- PlaylistStartupPreparer ----
const preparerDeps = (over = {}) => {
  const logs = [];
  const closed = [];
  const deps = {
    loadVideoInfo: async () => ({id: 'data'}),
    createModel: () => ({isDomandAvailable: true, isDomandOnly: true}),
    isNgVideo: () => false,
    getConfig: (k) => ({domandVideoQuality: 'auto', videoServerType: 'domand', autoDisableNew: false})[k],
    createSession: async () => ({connect: async () => ({url: MASTER, lastResponse: {data: {expireTime: '2026-11-13T12:00:00+09:00'}}}), close: () => closed.push(1)}),
    prepareBytes: async () => ({bytes: 3000, startLevel: 0, stages: ['master'], dispose() {}}),
    settingsKey: () => 'k',
    log: (event, payload) => logs.push({event, ...payload}),
    ...over
  };
  return {deps, logs, closed};
};

test('Preparer: 成功時はセッション期限付きのオブジェクトを返し、未採用で破棄するとセッションを閉じる', async () => {
  const {deps, logs, closed} = preparerDeps();
  const prepared = await createPlaylistStartupPreparer(deps)('sm2', new AbortController().signal);
  assert.equal(prepared.sessionInfo.url, MASTER);
  assert.equal(prepared.expiresAt, Date.parse('2026-11-13T12:00:00+09:00'));
  assert.deepEqual(logs.map(l => l.event), ['start', 'prepared']);
  prepared.dispose();
  await flush();
  assert.equal(closed.length, 1);
  prepared.adopted = true;
});

test('sessionExpiresAt: 期限が読めない形式では undefined', () => {
  assert.equal(sessionExpiresAt({}), undefined);
  assert.equal(sessionExpiresAt(null), undefined);
  assert.equal(sessionExpiresAt({lastResponse: {data: {expireTime: 'not a date'}}}), undefined);
  assert.equal(sessionExpiresAt({lastResponse: {data: {expireTime: 1700000000000}}}), 1700000000000);
});

test('Preparer: 失敗時は段階と理由をログに残し、セッションを閉じる', async () => {
  const {deps, logs, closed} = preparerDeps({prepareBytes: async () => { throw new PrefetchError({stage: 'video-init', reason: 'HTTP error', status: 403, host: 'asset.domand.nicovideo.jp'}); }});
  await assert.rejects(createPlaylistStartupPreparer(deps)('sm2', new AbortController().signal));
  await flush();
  const failed = logs.find(l => l.event === 'failed');
  assert.equal(failed.stage, 'startup-media');
  assert.deepEqual(failed.error.detail, {stage: 'video-init', reason: 'HTTP error', status: 403, host: 'asset.domand.nicovideo.jp'});
  assert.equal(closed.length, 1);
});

test('Preparer: dmc 優先設定や NG 動画は先読みしない', async () => {
  const {deps, logs} = preparerDeps({createModel: () => ({isDomandAvailable: true, isDomandOnly: false}),
    getConfig: (k) => ({videoServerType: 'dmc'})[k]});
  await assert.rejects(createPlaylistStartupPreparer(deps)('sm2', new AbortController().signal), /dmc preferred/);
  assert.equal(logs.at(-1).stage, 'eligibility');
});

test('describeError: URL の署名部分をログに出さない', () => {
  const d = describeError(new Error('bad https://asset.domand.nicovideo.jp/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/x.cmfv?sig=SECRET'));
  assert.ok(!d.message.includes('SECRET'));
  assert.ok(!d.message.includes('aaaaaaaaaaaaaaaaaaaaaaaa'));
});

// ---- PrefetchReporter ----
const reporterHarness = (diagnostics = true, notifyMode = 'popup') => {
  const out = {consoles: [], records: [], warnings: [], notifies: []};
  const reporter = createPrefetchReporter({
    diagnostics: () => diagnostics,
    notifyMode: () => notifyMode,
    console: (name, payload) => out.consoles.push({name, ...payload}),
    record: (entry) => out.records.push(entry),
    warning: (m) => out.warnings.push(m),
    notify: (m) => out.notifies.push(m),
    describe: describeError
  });
  return {reporter, out};
};

test('Reporter: 最終失敗は通知履歴に error で残し、「画面にも表示」ではポップアップを動画ごとに1回だけ', () => {
  const {reporter, out} = reporterHarness(false, 'popup');
  const error = new PrefetchError({stage: 'video-init', reason: 'HTTP error', status: 403, host: 'asset.domand.nicovideo.jp'});
  reporter.schedulerEvent({type: 'failed', id: 'sm2', attempt: 2, willRetry: false, error});
  reporter.schedulerEvent({type: 'failed', id: 'sm2', attempt: 2, willRetry: false, error});
  assert.equal(out.records.length, 2);
  const r = out.records[0];
  assert.equal(r.level, 'error');
  assert.equal(r.category, 'player');
  assert.ok(r.message.includes('video-init / HTTP error 403 / asset.domand.nicovideo.jp'));
  assert.deepEqual(r.details, {operation: 'playlist', event: 'prefetch-failed', retryScheduled: false,
    phase: 'video-init', kind: 'http-error', httpStatus: 403, attempt: 2, errorName: 'prefetcherror'});
  assert.equal(out.warnings.length, 1, 'ポップアップは1回だけ');
  assert.equal(out.consoles.length, 0, '通常版ではコンソール診断を出さない');
});

test('Reporter: 「通知履歴にのみ記録」では最終失敗でもポップアップを出さない', () => {
  const {reporter, out} = reporterHarness(true, 'journal');
  reporter.schedulerEvent({type: 'failed', id: 'sm2', attempt: 2, willRetry: false, error: new Error('x')});
  assert.equal(out.records.length, 1);
  assert.equal(out.warnings.length, 0);
});

test('Reporter: 「通知しない」では通知履歴にも残さない（診断コンソールは出る）', () => {
  const {reporter, out} = reporterHarness(true, 'off');
  reporter.schedulerEvent({type: 'failed', id: 'sm2', attempt: 2, willRetry: false, error: new Error('x')});
  reporter.prepareLog('prepared', {videoId: 'sm2', seconds: 1, bytes: 100});
  assert.equal(out.records.length, 0);
  assert.equal(out.warnings.length, 0);
  assert.ok(out.consoles.length >= 2);
});

test('Reporter: 再試行する失敗は warning で記録し、ポップアップは出さない', () => {
  const {reporter, out} = reporterHarness(true, 'popup');
  reporter.schedulerEvent({type: 'failed', id: 'sm2', attempt: 1, willRetry: true, error: new Error('x')});
  assert.equal(out.records[0].level, 'warning');
  assert.equal(out.records[0].details.retryScheduled, true);
  assert.equal(out.warnings.length, 0);
  assert.equal(out.consoles.length, 1);
});

test('Reporter: 準備成功は info で記録する。完了ポップアップは検証版のみ', () => {
  const a = reporterHarness(true, 'journal');
  a.reporter.prepareLog('prepared', {videoId: 'sm2', stage: 'startup-media', seconds: 1.135, bytes: 1460191, startLevel: 3});
  assert.equal(a.out.records[0].level, 'info');
  assert.deepEqual(a.out.records[0].details, {operation: 'playlist', event: 'prefetch-ready', count: 1460191, elapsedMs: 1135});
  a.reporter.ready('sm2');
  assert.equal(a.out.notifies.length, 1);
  const b = reporterHarness(false, 'journal');
  b.reporter.prepareLog('start', {videoId: 'sm2'});
  b.reporter.ready('sm2');
  assert.equal(b.out.notifies.length, 0);
  assert.equal(b.out.consoles.length, 0);
  assert.equal(b.out.records.length, 0, 'start は記録しない');
});

test('Reporter: timeout は warning で記録する。take-miss/paused は記録しない', () => {
  const {reporter, out} = reporterHarness(true, 'journal');
  reporter.schedulerEvent({type: 'timeout', id: 'sm2'});
  reporter.schedulerEvent({type: 'take-miss', id: 'sm3', reason: 'none'});
  reporter.schedulerEvent({type: 'paused', id: 'sm2', reason: 'waiting'});
  assert.equal(out.records.length, 1);
  assert.equal(out.records[0].details.event, 'prefetch-timeout');
  assert.deepEqual(out.consoles.map(c => c.event), ['timeout', 'take-miss', 'paused']);
});

test('Reporter: codeValue は Journal の形式に収まる値だけ返す', () => {
  assert.equal(codeValue('HTTP error'), 'http-error');
  assert.equal(codeValue('video-init'), 'video-init');
  assert.equal(codeValue('asset.domand.nicovideo.jp'), 'asset-domand-nicovideo-jp');
  assert.equal(codeValue(''), undefined);
  assert.equal(codeValue(42), undefined);
  assert.equal(describeFailure(describeError(new Error('ただのエラー'))).length > 0, true);
});

test('Prefetch security: arbitrary nicovideo subdomains and redirect requests are not accepted', async () => {
  const delivery = 'delivery.domand.nicovideo.jp';
  assert.equal(isAllowedPrefetchUrl(new URL('https://asset.domand.nicovideo.jp/asset'), delivery), true);
  assert.equal(isAllowedPrefetchUrl(new URL('https://account.nicovideo.jp/private'), delivery), false);
  assert.equal(isAllowedPrefetchUrl(new URL('https://www.nicovideo.jp/watch/sm1'), delivery), false);
  assert.equal(isAllowedPrefetchUrl(new URL('https://delivery.domand.nicovideo.jp/x'), 'www.nicovideo.jp'), false);
  const {fetcher, calls} = makeFetcher();
  const value = await HlsPrefetch.prepare(MASTER, new AbortController().signal, {fetcher});
  assert.ok(calls.length > 0);
  assert.ok(calls.every(call => call.init.redirect === 'error'));
  value.dispose();
});

test('Preloader: empty candidate window aborts in-flight work without clearing completed entries', async () => {
  const pending = deferred();
  const disposed = [];
  let pendingSignal;
  const {pre} = mk({prepare: (id, signal) => {
    if (id === 'sm2') return Promise.resolve({bytes: 100, dispose() { disposed.push(id); }});
    pendingSignal = signal;
    return pending.p;
  }});
  pre.update(sample());
  await flush();
  assert.deepEqual(pre.readyIds(), ['sm2']);
  pre.update(sample());
  assert.equal(pendingSignal?.aborted, false, 'the next candidate has started');
  pre.update(sample({candidates: []}));
  assert.equal(pendingSignal.aborted, true, 'no candidates must stop the pending request');
  assert.deepEqual(pre.readyIds(), ['sm2'], 'an already prepared entry survives');
  pending.resolve({bytes: 100, dispose() { disposed.push('sm3'); }});
  await flush();
  assert.deepEqual(pre.readyIds(), ['sm2'], 'late resolution must not repopulate abandoned work');
  assert.ok(disposed.includes('sm3'));
  pre.reset();
  assert.ok(disposed.includes('sm2'));
});
test('Preloader: a canceled unresolved prepare must not block a newer request or release its owner', async () => {
  const first = deferred(), second = deferred();
  const requests = [], disposed = [];
  const {pre} = mk({prepare: (id, signal) => {
    requests.push({id, signal});
    return id === 'sm2' ? first.p : second.p;
  }});
  const state = (id) => sample({candidates: [id], windowCount: 1});
  try {
    pre.update(state('sm2'));
    assert.deepEqual(requests.map(x => x.id), ['sm2']);
    pre.update(state('sm3'));
    assert.equal(requests[0].signal.aborted, true);
    assert.deepEqual(requests.map(x => x.id), ['sm2', 'sm3'], 'an aborted hanging request must not block the successor');
    first.resolve({bytes: 1, dispose() { disposed.push('sm2'); }});
    await flush();
    assert.equal(pre.busy, true, 'a stale finally must not release the newer request');
    second.resolve({bytes: 1, dispose() { disposed.push('sm3'); }});
    await flush();
    assert.deepEqual(pre.readyIds(), ['sm3']);
    assert.ok(disposed.includes('sm2'), 'late result must be discarded');
  } finally {
    first.resolve({bytes: 1, dispose() {}});
    second.resolve({bytes: 1, dispose() {}});
    pre.reset();
    await flush();
  }
});
test('Preloader: stalled request timeout backs off so the next playlist candidate can prepare', async () => {
  const held = deferred();
  const {pre,events} = mk({timeoutMs: 10, prepare: id => id === 'sm2' ? held.p :
    Promise.resolve({id, bytes: 123, dispose() {}})});
  const s = sample({candidates: ['sm2','sm3'],windowCount: 2});
  try {
    pre.update(s);
    await new Promise(resolve => setTimeout(resolve, 75));
    assert.equal(events.filter(e => e.type === 'timeout' && e.id === 'sm2').length, 1,
      'a stalled request must stop after its timeout');
    assert.equal(pre.failures.get('sm2')?.count,1,'timeout is one failed attempt');
    pre.update(s);
    await flush();
    assert.ok(pre.readyIds().includes('sm3'), 'the next candidate can proceed during retry backoff');
    assert.equal(events.filter(e => e.type === 'start' && e.id === 'sm2').length,1,
      'the stalled candidate is not immediately restarted');
  } finally {
    pre.reset();
    held.resolve({bytes: 123, dispose() {}});
    await flush();
  }
});
test('describeError: sanitize nested HLS network exception details including signed URLs',()=>{
  const secret='SIGNATURE_TOP_SECRET_87263';
  const u='https://asset.domand.nicovideo.jp/segment.m4s?sig='+secret;
  const error=Object.assign(new Error('Failed to fetch '+u),{detail:{
    stage:'video-segment',reason:'network error',status:403,
    host:'asset.domand.nicovideo.jp',message:'Network error at '+u,
    url:u,credentials:'SHOULD_NOT_BE_LOGGED'
  }});
  const safe=describeError(error);
  const printed=JSON.stringify(safe);
  assert.equal(printed.includes(secret),false,'no signed URL query value in nested diagnostics');
  assert.equal(printed.includes('SHOULD_NOT_BE_LOGGED'),false,'unapproved fields never logged');
  assert.equal(safe.detail?.stage,'video-segment');
  assert.equal(safe.detail?.status,403);
  assert.equal(safe.detail?.host,'asset.domand.nicovideo.jp');
});

test('describeError: circular causes cannot block normal playback fallback',()=>{
  const error=new Error('request failed');
  error.cause=error;
  const safe=describeError(error);
  assert.ok(JSON.stringify(safe).length<1500,'bounded safe error summary');
});
test('task1028.14 expiration countdown: preparer logs remaining seconds without URL tokens',async()=>{
 const until=Date.now()+60*60*1000;
 const {deps,logs}=preparerDeps({createSession:async()=>({
  connect:async()=>({url:MASTER,lastResponse:{data:{expireTime:new Date(until).toISOString()}}}),
  close:()=>{}
 })});
 const prepared=await createPlaylistStartupPreparer(deps)('sm2',new AbortController().signal);
 const ready=logs.find(e=>e.event==='prepared');
 assert.ok(ready && Number.isFinite(ready.expiresInSec));
 assert.ok(ready.expiresInSec>=3590 && ready.expiresInSec<=3600);
 assert.equal(JSON.stringify(ready).includes('signature='),false);
 prepared.dispose();
});

test('task1028.14 expiration countdown: reporter distinguishes known and unknown expiry',()=>{
 const yes=reporterHarness(false,'journal');
 yes.reporter.prepareLog('prepared',{videoId:'sm2',bytes:1024,seconds:1,expiresInSec:3600});
 assert.match(yes.out.records[0].message,/有効期限あと60分/);
 const unknown=reporterHarness(false,'journal');
 unknown.reporter.prepareLog('prepared',{videoId:'sm2',expiresInSec:-1});
 assert.match(unknown.out.records[0].message,/有効期限不明/);
 const off=reporterHarness(false,'off');
 off.reporter.prepareLog('prepared',{videoId:'sm2',expiresInSec:3600});
 assert.equal(off.out.records.length,0);
});
test('task1028.14 stale adoption warning respects disabled journal settings',()=>{
 const yes=reporterHarness(false,'journal');
 yes.reporter.staleAdoption('sm2');
 assert.equal(yes.out.records.length,1);
 assert.equal(yes.out.records[0].level,'warning');
 assert.equal(yes.out.records[0].details.event,'prefetch-stale');
 assert.equal(yes.out.notifies.length,0);
 const off=reporterHarness(false,'off');
 off.reporter.staleAdoption('sm2');
 assert.equal(off.out.records.length,0);
});