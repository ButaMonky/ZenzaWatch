// Task 092: MylistPocket の QueueLoader（NG・お気に入りの判定のための動画情報の読み込み）が、
// 同時に6件より多く通信しないことの回帰テスト。
// 修正前は MAX_LOAD = 6 の配列の Promise.race で待っていたため、完了時間がばらつくと
// 「どれか1つが終わった」ことで同時に多くの要求が動き始め、6件を超えていた（事前の再現で最大13〜15件）。
// 通信は代わりのもの（完了時間を乱数で決める）で、実際のニコニコへの通信ではない。
import assert from 'power-assert';

const {queueLoader} = require('../helpers/pocketHarness');

// 決まった順の乱数（テストを毎回同じにする）
const rng = seed => () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };

function fakeLoader({durations, failAt = new Set()}) {
  const state = {active: 0, maxActive: 0, started: [], finished: []};
  let i = 0;
  const load = watchId => {
    const n = i++;
    state.active++;
    state.maxActive = Math.max(state.maxActive, state.active);
    state.started.push(watchId);
    return new Promise((resolve, reject) => setTimeout(() => {
      state.active--;
      state.finished.push(watchId);
      if (failAt.has(watchId)) { reject(new Error(`fail ${watchId}`)); }
      else { resolve({watchId, fromCache: false}); }
    }, durations(n)));
  };
  return {load, state};
}

// 待ち時間（成功後50ms・失敗後1000ms）を短くした版（テスト時間を短くするため。並列数の検査には影響しない）
const quickSleep = ms => r => new Promise(res => setTimeout(() => res(r), Math.min(ms, 5)));

describe('MylistPocket QueueLoader の同時実行数（Task 092）', function() {
  this.timeout(60000);

  for (const seed of [1, 7, 42, 2026]) {
    it(`ランダムな完了時間で 120 件を一度に入れても、同時に動くのは6件以下で、全件が終わる（seed ${seed}）`, async function() {
      const r = rng(seed);
      const {load, state} = fakeLoader({durations: () => Math.floor(r() * 40)});
      const q = queueLoader({load, sleep: quickSleep});
      const ids = Array.from({length: 120}, (_, i) => `sm${i + 1}`);
      const results = await Promise.all(ids.map(id => q.load(id)));
      assert.ok(state.maxActive <= 6, `同時に ${state.maxActive} 件動いた`);
      assert.equal(state.maxActive, 6, '6件までは同時に動く（遅くしすぎない）');
      assert.equal(state.finished.length, 120);
      assert.deepEqual(results.map(x => x.watchId), ids);
    });
  }

  it('時間差で少しずつ入れても6件以下', async function() {
    const r = rng(3);
    const {load, state} = fakeLoader({durations: () => 5 + Math.floor(r() * 60)});
    const q = queueLoader({load, sleep: quickSleep});
    const all = [];
    for (let i = 0; i < 60; i++) {
      all.push(q.load(`sm${i}`));
      await new Promise(res => setTimeout(res, Math.floor(r() * 8)));
    }
    await Promise.all(all);
    assert.ok(state.maxActive <= 6, `同時に ${state.maxActive} 件動いた`);
    assert.equal(state.finished.length, 60);
  });

  it('要求した順に始まる（待っている要求が後回しにされ続けない）', async function() {
    const r = rng(11);
    const {load, state} = fakeLoader({durations: () => Math.floor(r() * 30)});
    const q = queueLoader({load, sleep: quickSleep});
    const ids = Array.from({length: 40}, (_, i) => `sm${i}`);
    await Promise.all(ids.map(id => q.load(id)));
    assert.deepEqual(state.started, ids);
  });

  it('1件が失敗しても、残りは止まらずに全部終わる（失敗した分は以前と同じく失敗の値で終わる）', async function() {
    const {load, state} = fakeLoader({durations: n => (n % 5) * 3, failAt: new Set(['sm3', 'sm10'])});
    const q = queueLoader({load, sleep: quickSleep});
    const ids = Array.from({length: 20}, (_, i) => `sm${i}`);
    const results = await Promise.all(ids.map(id => q.load(id)));
    assert.equal(state.finished.length, 20);
    assert.ok(results[3] instanceof Error);
    assert.ok(results[10] instanceof Error);
    assert.equal(results[4].watchId, 'sm4');
    assert.ok(state.maxActive <= 6);
  });

  it('読み込みが同期的に例外を投げても、枠が戻って後続が動く', async function() {
    let n = 0;
    const {load: inner, state} = fakeLoader({durations: () => 2});
    const load = id => { if (n++ === 2) { throw new Error('sync'); } return inner(id); };
    const q = queueLoader({load, sleep: quickSleep});
    const settled = await Promise.all(Array.from({length: 15}, (_, i) =>
      q.load(`sm${i}`).then(v => ({ok: true, v}), e => ({ok: false, e}))));
    assert.equal(settled.filter(x => x.ok).length, 14);
    assert.equal(state.finished.length, 14);
  });

  it('item を渡すと、読み込みの開始時に is-ng-current・成功時に data-watch-id・data-thumb-info が付く（以前と同じ）', async function() {
    const {load} = fakeLoader({durations: () => 1});
    const q = queueLoader({load, sleep: quickSleep});
    const attrs = {}, classes = new Set();
    const item = {setAttribute: (k, v) => { attrs[k] = v; }, classList: {add: c => classes.add(c)}};
    await q.load('sm1', item);
    assert.ok(classes.has('is-ng-current'));
    assert.equal(attrs['data-watch-id'], 'sm1');
    assert.equal(JSON.parse(attrs['data-thumb-info']).watchId, 'sm1');
  });
});
