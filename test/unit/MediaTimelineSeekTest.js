// Task 090（監査v2 R04 ZW-022）: 短いシークの後に、MediaTimeline の補間の時計（Web Animations の時計）が動画の時刻を上書きしないことの回帰テスト。
// 修正前は、時計を合わせ直すのが「差が1秒を超える時」だけだったため、0.5秒のシークの後の onRaf で、時刻が古い時計の値へ戻った（監査の CLOCK-01）。
// 主な利用先はシークバーのサムネイル（StoryboardView）の共有時刻。これだけで通常のコメントが止まる原因とは断定しない（監査の scope のとおり）。
// 実ブラウザの <video>・Web Animations ではなく、時間を手で進める代わりのもので確かめる。
import assert from 'power-assert';

const {beginSection, createContext, run} = require('../helpers/extractSource');

function subject() {
  const anime = {
    currentTime: 0, playbackRate: 1, paused: true,
    pause() { this.paused = true; }, play() { this.paused = false; }
  };
  const rafs = new Map();
  let rafSeq = 0;
  const c = createContext({
    self: {},
    document: {createElement: () => ({animate: () => anime}), documentElement: {animate() {}}},
    objUtil: {toMap: o => new Map(Object.entries(o))},
    sleep: {resolve: Promise.resolve()},
    requestAnimationFrame: f => { const id = ++rafSeq; rafs.set(id, f); return id; },
    cancelAnimationFrame: id => { rafs.delete(id); return null; },
    setInterval: () => 1, clearInterval: () => {},
    performance: {now: () => 0},
    Atomics
  });
  run(`${beginSection('packages/lib/src/dom/MediaTimeline.js')}; globalThis.MediaTimeline = MediaTimeline;`, c);
  const listeners = new Map();
  const media = {
    currentTime: 10, duration: 100, paused: false, playbackRate: 1,
    addEventListener(n, f) { listeners.set(n, f); },
    removeEventListener(n) { listeners.delete(n); }
  };
  const fire = name => listeners.has(name) && listeners.get(name)({type: name});
  // 時間を進める（動画も時計も、それぞれの速度で進む）
  const advance = ms => {
    if (!media.paused) { media.currentTime += ms / 1000 * media.playbackRate; }
    if (!anime.paused) { anime.currentTime += ms * anime.playbackRate; }
  };
  const seek = t => { media.currentTime = t; fire('seeking'); fire('seeked'); };
  return {MT: c.MediaTimeline, anime, media, fire, advance, seek, rafs, listeners};
}

// onRaf は再生中、次の rAF の予約を非同期で行う（その間の onRaf は何もしない）ので、1回ごとに待つ
const raf = async t => { t.onRaf(); for (let i = 0; i < 3; i++) { await Promise.resolve(); } };
const near = (a, b, label) => assert.ok(Math.abs(a - b) < 1e-3, `${label}: ${a} != ${b}`);

describe('MediaTimeline の短いシーク（ZW-022）', function() {
  it('CLOCK-01: 時計が10秒・動画が10.5秒で seeked → onRaf すると、10.5秒になる', function() {
    const s = subject();
    const t = new s.MT();
    t.media = {currentTime: 10.5, duration: 100, paused: true};
    s.anime.currentTime = 10000;
    t.eventMap.get('seeked')();
    t.onRaf();
    near(t.currentTime, 10.5, 'timeline');
  });

  it('±0.1・0.5・1・5・30秒のシークを、0.5・1・2・4倍速で: シークの後の onRaf の時刻が動画の時刻と同じ', async function() {
    for (const rate of [0.5, 1, 2, 4]) {
      for (const delta of [0.1, -0.1, 0.5, -0.5, 1, -1, 5, -5, 30, -30]) {
        const s = subject();
        s.media.playbackRate = rate;
        s.media.currentTime = 40;
        const t = new s.MT({media: s.media});
        await raf(t);
        s.advance(1000);
        await raf(t);
        s.seek(s.media.currentTime + delta);
        await raf(t);
        near(t.currentTime, s.media.currentTime, `rate ${rate} delta ${delta}`);
        s.advance(250);
        await raf(t);
        near(t.currentTime, s.media.currentTime, `rate ${rate} delta ${delta} +250ms`);
      }
    }
  });

  it('続けてシークしても、最後の位置になる', async function() {
    const s = subject();
    const t = new s.MT({media: s.media});
    for (const to of [20.2, 20.4, 20.6, 20.1]) { s.seek(to); }
    await raf(t);
    near(t.currentTime, 20.1, 'after seeks');
  });

  it('止めている時のシークでも、動画の時刻と同じになる', async function() {
    const s = subject();
    s.media.paused = true;
    const t = new s.MT({media: s.media});
    s.seek(10.4);
    near(t.currentTime, 10.4, 'paused seek');
    await raf(t);
    near(t.currentTime, 10.4, 'paused seek after onRaf');
  });

  it('速度を変えた後も、進み方が動画と同じ', async function() {
    const s = subject();
    const t = new s.MT({media: s.media});
    s.media.playbackRate = 2;
    s.fire('ratechange');
    s.advance(500);
    await raf(t);
    near(t.currentTime, s.media.currentTime, 'rate 2');
  });

  it('動画の長さが後から分かった時（durationchange）に、duration を更新する', function() {
    const s = subject();
    s.media.duration = NaN;
    const t = new s.MT({media: s.media});
    s.media.duration = 123;
    s.fire('durationchange');
    assert.equal(t.duration, 123);
  });

  it('本体の VideoPlayer が知らせる durationChange（大文字の C）でも duration を更新する', function() {
    const s = subject();
    s.media.duration = NaN;
    const t = new s.MT({media: s.media});
    s.media.duration = 45;
    s.fire('durationChange');
    assert.equal(t.duration, 45);
  });

  it('detach で予約中の rAF を取り消し、取り消し前に動いた rAF も例外にならない', function() {
    const s = subject();
    const t = new s.MT({media: s.media});
    t.paused = false;
    const pending = [...s.rafs.values()];
    assert.ok(pending.length > 0 || t.raf, 'rAF が予約されている');
    t.detach();
    assert.equal(s.rafs.size, 0, '予約中の rAF が残っていない');
    assert.doesNotThrow(() => pending.forEach(f => f()));
  });
});
