// Task 090（監査v2 R04 ZW-013）: VideoSessionWorker の中で、古い動画のセッションIDで送った connect・getState・close が、
// 新しい動画のセッションを操作しないことの回帰テスト。
// 修正前は、呼び出し側が sessionId を送っても Worker の中は「今のセッション」を無条件に操作していたため、
// create A → create B → close A で B が閉じられた（監査の SESSION-01）。
// Worker の中の関数（func）を Worker を使わずにそのまま呼ぶ（監査のプローブと同じ方法）。通信はしない。
import assert from 'power-assert';

const {extract, createContext, run} = require('../helpers/extractSource');

function subject() {
  const fetchCalls = [];
  const c = createContext({
    createStoryboardClasses: () => ({}),
    location: {origin: 'https://www.nicovideo.jp', href: 'https://www.nicovideo.jp/'},
    fetch: (...a) => { fetchCalls.push(a); return Promise.reject(new Error('network is not available in tests')); }
  });
  const func = run(`(${extract('packages/lib/src/nico/VideoSessionWorker.js', 'func', 'var')})`, c);
  const target = {};
  func(target);
  const send = (command, params) => target.onmessage({command, params});
  const params = {serverType: 'domand', videoInfo: {domandInfo: {}}, videoQuality: 'auto', useHLS: true};
  return {send, params, fetchCalls};
}

const settle = p => p.then(v => ({ok: true, v}), e => ({ok: false, e}));

describe('動画のセッションの所有（ZW-013）', function() {
  this.timeout(10000);

  it('SESSION-01: create A → create B → close A の後も、B の状態は残る', async function() {
    const s = subject();
    const a = await s.send('create', s.params);
    const b = await s.send('create', s.params);
    await s.send('close', {sessionId: a.sessionId});
    const state = await s.send('getState', {sessionId: b.sessionId});
    assert.equal(state.sessionId, b.sessionId);
    assert.equal(state.isDomand, true);
  });

  it('古いセッションの getState は、新しいセッションの状態を返さない', async function() {
    const s = subject();
    const a = await s.send('create', s.params);
    const b = await s.send('create', s.params);
    const stale = await s.send('getState', {sessionId: a.sessionId});
    assert.notEqual(stale.sessionId, b.sessionId);
    assert.equal(stale.sessionId, undefined);
  });

  it('古いセッションの connect は、新しいセッションへ接続せずに失敗する（通信もしない）', async function() {
    const s = subject();
    const a = await s.send('create', s.params);
    await s.send('create', s.params);
    const r = await settle(s.send('connect', {sessionId: a.sessionId}));
    assert.equal(r.ok, false);
    assert.ok(/session/i.test(String(r.e && r.e.message)), String(r.e && r.e.message));
    assert.equal(s.fetchCalls.length, 0);
  });

  it('close は何度呼んでも同じ（2回目・知らないIDは何もしない）。閉じた後の getState は空', async function() {
    const s = subject();
    const a = await s.send('create', s.params);
    await s.send('close', {sessionId: a.sessionId});
    await s.send('close', {sessionId: a.sessionId});
    await s.send('close', {sessionId: 'session_999'});
    const state = await s.send('getState', {sessionId: a.sessionId});
    assert.equal(state.sessionId, undefined);
  });

  it('create を2つ続けて送った（前の完了を待たない）時も、後の方だけが今のセッションになる', async function() {
    const s = subject();
    const pa = s.send('create', s.params);
    const pb = s.send('create', s.params);
    const [a, b] = await Promise.all([settle(pa), settle(pb)]);
    assert.ok(b.ok);
    const bs = b.v.sessionId;
    const state = await s.send('getState', {sessionId: bs});
    assert.equal(state.sessionId, bs);
    if (a.ok) {
      const stale = await s.send('getState', {sessionId: a.v.sessionId});
      assert.equal(stale.sessionId, undefined, '前の create は今のセッションではない');
    }
  });

  it('正常: 今のセッションの getState・close は今までどおり', async function() {
    const s = subject();
    const a = await s.send('create', s.params);
    const state = await s.send('getState', {sessionId: a.sessionId});
    assert.equal(state.sessionId, a.sessionId);
    await s.send('close', {sessionId: a.sessionId});
    assert.equal((await s.send('getState', {sessionId: a.sessionId})).sessionId, undefined);
  });
});
