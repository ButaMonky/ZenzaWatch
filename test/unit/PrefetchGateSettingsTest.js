'use strict';
// Task1055: 先読みは基本的にいつでも行う。止める条件（ループ中・一時停止中・データセーバー中）は
// 上級者設定で選んだ時だけ（初期値はすべて OFF）。
// Task1062: ソースの文字列（正規表現）で調べていたのを、実際の部品を動かして確かめる形に書き換えた。
const assert = require('assert');
const {createContext, loadClass} = require('../helpers/extractSource');

const KEYS = ['skipWhenLoop', 'skipWhenPaused', 'skipWhenDataSaver'].map(k => 'playlist.prefetchAhead.' + k);

// 先読みの判断（_updateNextPrefetch）を、ダイアログの本物のメソッドで動かす。
// 判断の結果は診断ログ（ZENZA_PREFETCH_GATE）に出るので、それを集める。
function makeDialog({config = {}, saveData = false, playing = true, sample = {currentTime: 30, duration: 120}} = {}) {
  const intervals = [];
  const ctx = createContext({
    Emitter: class {},
    navigator: {connection: {saveData}},
    window: {setInterval(fn, ms) { intervals.push({fn, ms, cleared: false}); return intervals.length; },
      clearInterval(id) { if (intervals[id - 1]) { intervals[id - 1].cleared = true; } }},
    global: {debug: {playlistPrefetch: {
      create: () => ({interrupt(reason) { dialog.interrupts.push(reason); }, readyIds: () => [], isBusy: () => false,
        update(input) { dialog.scheduled.push(input); }, reset() {}}),
      supported: () => true, sample: () => sample, markIds: []
    }}, emitter: {emit() {}}},
  });
  const Dialog = loadClass('src/NicoVideoPlayerDialog.js', 'NicoVideoPlayerDialog', ctx);
  const dialog = Object.create(Dialog.prototype);
  const values = {
    'playlist.prefetchAhead.enabled': true, loop: false,
    ...Object.fromEntries(KEYS.map(k => [k, false])), ...config
  };
  Object.assign(dialog, {
    gates: [], interrupts: [], scheduled: [], intervals,
    _playerConfig: {getValue: k => values[k], props: values},
    _state: {isLoading: false, isError: false, isSeeking: false, isStalled: false},
    _playlist: {length: 3, index: 0, peekNextIds: () => ['sm2', 'sm3']},
    _watchId: 'sm1', _videoInfo: {relatedVideoItems: []},
    _diagOnce(type, key, data) { if (type === 'ZENZA_PREFETCH_GATE') { this.gates.push(data.gate); } },
    _diagEnvironment() {}, _diag() {}, _diagWanted: () => false,
    _prefetchFeatureEnabled: () => true,
    _collectPrefetchCandidates: () => ['sm2', 'sm3'],
    _updatePrefetchMarks() {}, _getPrefetchReporter: () => null,
    _prefetchSettingsKey: () => 'k', _prepareNextStartup: () => Promise.resolve(),
  });
  Object.defineProperty(dialog, 'isOpen', {value: true, configurable: true});
  Object.defineProperty(dialog, 'isPlaying', {get: () => playing, configurable: true});
  dialog.setValue = (k, v) => { values[k] = v; };
  return dialog;
}

describe('Task1055 先読みを止める条件は設定で選んだ時だけ', () => {
  it('ループ中でも、設定が OFF（初期値）なら先読みする', () => {
    const d = makeDialog({config: {loop: true}});
    d._updateNextPrefetch();
    assert.deepStrictEqual(d.gates, ['open']);
  });
  it('「ループ中は先読みしない」が ON でループ中なら止める（ループでなければ止めない）', () => {
    const on = makeDialog({config: {loop: true, 'playlist.prefetchAhead.skipWhenLoop': true}});
    on._playlistPrefetch = {interrupt(reason) { on.interrupts.push(reason); }};
    on._updateNextPrefetch();
    assert.deepStrictEqual(on.gates, ['loop-on']);
    assert.ok(on.interrupts.includes('waiting'));
    const off = makeDialog({config: {loop: false, 'playlist.prefetchAhead.skipWhenLoop': true}});
    off._updateNextPrefetch();
    assert.deepStrictEqual(off.gates, ['open']);
  });
  it('データセーバー中でも、設定が OFF なら先読みし、ON なら止める', () => {
    const off = makeDialog({saveData: true});
    off._updateNextPrefetch();
    assert.deepStrictEqual(off.gates, ['open']);
    const on = makeDialog({saveData: true, config: {'playlist.prefetchAhead.skipWhenDataSaver': true}});
    on._updateNextPrefetch();
    assert.deepStrictEqual(on.gates, ['data-saver']);
  });
  it('一時停止しても、設定が OFF なら先読みを止めず、1秒ごとに判断を進める', () => {
    const d = makeDialog({playing: false});
    d._state.setPausing = () => {};
    d.emit = () => {};
    d._playlistPrefetch = {interrupt(reason) { d.interrupts.push(reason); }};
    d._onVideoPause();
    assert.deepStrictEqual(d.interrupts, [], '一時停止で先読みを止めている');
    assert.strictEqual(d.intervals.length, 1);
    assert.strictEqual(d.intervals[0].ms, 1000);
    // 再生中扱いで先読みの判断に渡す
    d._playlistPrefetch = null;
    assert.strictEqual(d._prefetchWhilePaused({currentTime: 30}), true);
  });
  it('「一時停止中は先読みしない」が ON なら、一時停止で止めてタイマーも動かさない', () => {
    const d = makeDialog({playing: false, config: {'playlist.prefetchAhead.skipWhenPaused': true}});
    d._state.setPausing = () => {};
    d.emit = () => {};
    d._playlistPrefetch = {interrupt(reason) { d.interrupts.push(reason); }};
    d._onVideoPause();
    assert.deepStrictEqual(d.interrupts, ['not-playing']);
    assert.strictEqual(d.intervals.length, 0);
    assert.strictEqual(d._prefetchWhilePaused({currentTime: 30}), false);
  });
  it('一時停止中のタイマーは、再生を始めたら止まる', () => {
    const d = makeDialog({playing: false});
    d._syncPausedPrefetchTimer();
    assert.strictEqual(d.intervals.length, 1);
    Object.defineProperty(d, 'isPlaying', {get: () => true, configurable: true});
    d._syncPausedPrefetchTimer();
    assert.strictEqual(d.intervals[0].cleared, true);
    assert.strictEqual(d._prefetchPausedTimer, 0);
  });
  it('3つの設定は上級者設定に ON/OFF の項目として並んでいる', () => {
    const ctx = createContext({});
    const Model = loadClass('src/ModernAdvancedSettingsModel.js', 'ModernAdvancedSettingsModel', ctx);
    const rows = Model.visibleExtraSettings();
    for (const key of KEYS) {
      const row = rows.find(r => r.id === key);
      assert.ok(row, key + ' が上級者設定に無い');
      assert.strictEqual(row.type, 'boolean', key);
    }
    // 初期値（保存された設定が無い時の値）は、配布物を動かす test/browser/task1062-short-viewport-layout.cjs で確かめる。
  });
});
