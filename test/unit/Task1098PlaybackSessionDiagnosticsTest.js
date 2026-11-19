'use strict';

const assert = require('assert');
const {beginSection, createContext, extract, run} = require('../helpers/extractSource');

const signed = 'https://media.example.invalid/video/master.m3u8?private=SIGNED_SECRET';
const response = (status, body) => ({status, json: async () => body});
const domand = (url = signed) => ({meta: {status: 201}, data: {contentUrl: url}});
const dmc = () => ({data: {session: {
  id: 'session', content_uri: signed,
  content_src_id_sets: [{content_src_ids: [{src_id_to_mux: {audio_src_ids: ['a'], video_src_ids: ['v']}}]}]
}}});

function harness() {
  const events = [], fetches = [], intervals = [];
  const queue = [];
  const workerUtil = {createCrossMessageWorker(func, {inject}) {
    const replies = new Map();
    let requestId = 0;
    const self = {postMessage(reply) {replies.set(reply.sessionId, structuredClone(reply));}};
    const worker = createContext({
      self, PID: 'fixture', NAME: 'VideoSessionWorker', location: {origin: 'https://www.nicovideo.jp'}, AbortController,
      fetch(url) {fetches.push(url); return queue.shift()();},
      setInterval(callback) { intervals.push(callback); return 1; }, clearInterval() {},
      console: {time() {}, timeEnd() {}, debug() {}, error() {}}
    });
    const wrapper = extract('packages/lib/src/infra/workerUtil.js', 'messageWrapper', 'var');
    run(inject + '\n(' + func.toString() + ')(self); (' + wrapper + ')(self)', worker);
    return {async post(body) {
      const sessionId = ++requestId;
      await self.onmessage({data: {body: structuredClone(body), sessionId}});
      const reply = replies.get(sessionId);
      replies.delete(sessionId);
      if (reply.status !== 'ok') {throw new Error(reply.body.params.result);}
      return reply.body.params.result;
    }};
  }};
  const context = createContext({workerUtil, events});
  run(beginSection('packages/lib/src/infra/RequestDiagnostics.js') +
    '\nRequestDiagnostics.setSink(event => events.push(event));\n' +
    beginSection('packages/lib/src/nico/VideoSessionWorker.js') +
    '\nglobalThis.client = VideoSessionWorker;', context);
  const mediaInfo = {watchId: 'sm99999', actionTrackId: 'TRACK_SECRET',
    domandInfo: {videoId: 'sm99999', accessRightKey: 'KEY_SECRET', availableVideoIds: ['v'],
      availableAudioIds: ['a'], availableVideos: [{id: 'v', label: '720p'}]},
    dmcInfo: {urls: [{url: 'https://dmc.example.invalid/sessions'}], protocols: ['hls'],
      availableVideoIds: ['v'], availableAudioIds: ['a'], authTypes: {}, heartbeatLifetime: 30000,
      availableVideos: [{id: 'v', metadata: {label: '720p'}}]}};
  const create = (serverType = 'domand', extra = {}) => context.client.create({
    videoInfo: {toJSON: () => mediaInfo}, serverType, useHLS: true, ...extra
  });
  return {context, events, queue, intervals, fetches, create};
}

describe('再生許可から配信URLを受け取る段階の診断', () => {
  it('Domandの応答不備と権限を区別し、有効なURLで復旧する', async () => {
    const h = harness(), session = await h.create();
    const malformedJson = {status: 200, json: async () => {throw new SyntaxError('BODY_SECRET');}};
    for (const [reply, reason, missing, statusCode, apiStatus] of [
      [response(200, {meta: {status: 201}, data: {}}), 'schema', 'data.contentUrl', 200],
      [response(200, domand('javascript:SIGNED_SECRET')), 'schema', 'data.contentUrl', 200],
      [response(200, {data: {contentUrl: signed}}), 'schema', 'meta.status', 200],
      [malformedJson, 'schema', 'response.json', 200],
      [{status: 403, json: () => assert.fail('HTTP rejection body must not be read')}, 'permission', undefined, 403],
      [response(200, {meta: {status: 401, errorMessage: 'BODY_SECRET'}, data: {contentUrl: signed}}),
        'permission', undefined, 200, 401],
      [response(200, {meta: {status: 404}}), 'not-found', undefined, 200, 404],
      [response(201, {meta: {status: 503}}), 'service', undefined, 201, 503]
    ]) {
      h.queue.push(() => reply);
      await assert.rejects(session.connect());
      const event = h.events.at(-1);
      assert.deepStrictEqual([event.operation, event.phase, event.reason, event.missing, event.statusCode, event.apiStatus],
        ['video-session', 'session', reason, missing, statusCode, apiStatus]);
    }
    h.queue.push(() => response(200, domand()));
    assert.equal((await session.connect()).url, signed);
    assert.equal(h.events.at(-1).outcome, 'recovered');
    assert.equal(h.fetches.length, 9);
    assert(!/SECRET|sm99999|https?:/.test(JSON.stringify(h.events)));
  });

  it('HTTP 200のAPI 401を実際の通知履歴に保存し、二つの状態を別々にコピーする', async () => {
    const {JSDOM} = require('jsdom');
    const dom = new JSDOM('<div id="root" class="activeTab"></div>');
    try {
      const {context, queue, create} = harness();
      Object.assign(context, {document: dom.window.document, window: dom.window, indexedDB: undefined});
      for (const name of ['NotificationJournalPolicy', 'NotificationJournalStore']) {
        run(beginSection('packages/zenza/src/notification/' + name + '.js'), context);
      }
      run(beginSection('src/NotificationJournal.js'), context);
      const record = extract('src/initializer.js', 'recordRequestDiagnostic', 'var');
      run('RequestDiagnostics.setSink(' + record + ');', context);
      const session = await create();
      queue.push(() => response(200, {meta: {status: 401, errorMessage: 'BODY_SECRET'}}));
      await assert.rejects(session.connect());
      const [entry] = await run('NotificationJournal.list()', context);
      assert.deepStrictEqual([entry.details.statusCode, entry.details.apiStatus, entry.details.reason],
        [200, 401, 'permission']);
      run(beginSection('src/NotificationHistoryPanel.js') +
        '\nNotificationHistoryPanel.mount(document.querySelector("#root"));', context);
      await new Promise(resolve => setImmediate(resolve));
      const page = dom.window.document;
      page.querySelector('[data-entry-id]').click();
      const detail = page.querySelector('.znh-detail');
      const pairs = [...detail.querySelectorAll('dt')].map(term => [term.textContent, term.nextElementSibling.textContent]);
      assert.equal(Object.fromEntries(pairs)['HTTP状態'], '200');
      assert.equal(Object.fromEntries(pairs)['API状態（meta.status）'], '401');
      detail.querySelector('[data-history-action="copy"]').click();
      await new Promise(resolve => setImmediate(resolve));
      const report = detail.querySelector('textarea').value;
      assert(report.includes('HTTP状態　200\nAPI状態（meta.status）　401'));
      assert(!/SECRET|sm99999|HTTP状態　401/.test(report));
    } finally { dom.window.close(); }
  });

  it('旧DMC形式の配信URLを検証してからハートビートを開始する', async () => {
    const h = harness(), session = await h.create('dmc');
    const invalid = dmc();
    delete invalid.data.session.content_uri;
    h.queue.push(() => response(200, invalid), () => response(200, dmc()));
    await assert.rejects(session.connect());
    assert.equal(h.events[0].missing, 'data.session.content_uri');
    assert.equal(h.intervals.length, 0);
    assert.equal((await session.connect()).url, signed);
    assert.equal(h.intervals.length, 1);
    assert.equal(h.events[1].outcome, 'recovered');
  });

  it('同じ動画の先読みで現在の再生許可の診断を上書きしない', async () => {
    const h = harness(), active = await h.create();
    let release;
    h.queue.push(() => new Promise(resolve => {release = resolve;}));
    const pending = active.connect();
    const prefetch = await h.create('domand', {prefetch: true});
    h.queue.push(() => response(200, domand()));
    await prefetch.connect();
    release(response(403, {}));
    await assert.rejects(pending);
    assert.deepStrictEqual(h.events.map(event => event.reason), ['permission']);
  });

  it('Workerの準備失敗は動画情報の失敗に流さず、再生セッションとして扱う', async () => {
    const {createDialogHarness} = require('../helpers/dialogHarness');
    const h = createDialogHarness(), calls = [];
    h.dialog._requestId = 'current';
    h.dialog._onVideoSessionFail = (serverType, error) => calls.push([serverType, error]);
    const loading = h.dialog._onVideoInfoLoaderLoad('current', [h.videoData('sm9'), {}]);
    await h.flush();
    const error = new Error('worker unavailable');
    h.sessionCreate.calls[0].reject(error);
    await loading;
    assert.deepStrictEqual(calls, [['domand', error]]);
    assert(!h.log.some(step => step.startsWith('setVideo:')));
  });

  it('取消・動画切替後に届いた失敗は履歴に入れない', async () => {
    const h = harness();
    let current = true, session = await h.create('domand', {diagnosticActive: () => current});
    let resolve;
    h.queue.push(() => new Promise(done => {resolve = done;}));
    const stale = session.connect();
    current = false;
    resolve(response(403, {}));
    await assert.rejects(stale);
    session = await h.create();
    h.queue.push(() => Promise.reject(Object.assign(new Error('cancelled'), {name: 'AbortError'})));
    await assert.rejects(session.connect());
    assert.equal(h.events.length, 0);
  });
});
