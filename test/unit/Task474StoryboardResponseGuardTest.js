// Task474 NICOCOMPAT-04: malformed storyboard data must never be treated as ready.
// All fixtures are synthetic, with no NicoNico traffic, auth, or production UI interaction.
'use strict';
const assert = require('assert');
const {loadClass, createContext} = require('../helpers/extractSource');

const good = () => ({
  status: 'ok', format: 'domand', duration: 120, watchId: 'sm9',
  storyboard: {
    version: '1', thumbnail: {width: 160, height: 90},
    columns: 3, rows: 2, interval: 10000, count: 12,
    images: [{url: 'page-0'}, {url: 'page-1'}]
  }
});
const variants = [
  ['source', 'packages/zenza/src/storyboard/StoryboardInfoModel.js',
    'packages/zenza/src/storyboard/Storyboard.js'],
  ['dev-dist', 'dist/ZenzaWatch-dev.user.js', 'dist/ZenzaWatch-dev.user.js']
];

function harness(modelFile, boardFile, data = good()) {
  const emits = [];
  const ctx = createContext({Emitter: class {emit(...x) {emits.push(x);}},
    console: {log() {}, warn() {}}});
  const Model = loadClass(modelFile, 'StoryboardInfoModel', ctx);
  const Board = loadClass(boardFile, 'Storyboard', ctx);
  return {ctx, Model, Board, model: new Model(data), emits};
}
function caseData(modify) {
  const data = good(); modify(data); return data;
}
const invalid = [
  ['no storyboard', d => {delete d.storyboard;}],
  ['null storyboard', d => {d.storyboard = null;}],
  ['missing thumbnail', d => {delete d.storyboard.thumbnail;}],
  ['wrong thumbnail', d => {d.storyboard.thumbnail = [];}],
  ['zero width', d => {d.storyboard.thumbnail.width = 0;}],
  ['negative height', d => {d.storyboard.thumbnail.height = -10;}],
  ['invalid columns', d => {d.storyboard.columns = 0;}],
  ['invalid rows', d => {d.storyboard.rows = -1;}],
  ['bad interval', d => {d.storyboard.interval = -1;}],
  ['NaN interval', d => {d.storyboard.interval = NaN;}],
  ['negative cell count', d => {d.storyboard.count = -1;}],
  ['fractional cell count', d => {d.storyboard.count = 1.5;}],
  ['no image array', d => {d.storyboard.images = null;}],
  ['no pages', d => {d.storyboard.images = [];}],
  ['null image', d => {d.storyboard.images[0] = null;}],
  ['blank image url', d => {d.storyboard.images[0].url = '';}],
  ['missing image url', d => {delete d.storyboard.images[0].url;}],
  ['non-numeric duration', d => {d.duration = 'bad';}],
  ['infinite duration', d => {d.duration = Infinity;}],
  ['negative duration', d => {d.duration = -1;}],
  ['excessive canvas allocation', d => {
    d.storyboard.thumbnail.width = 4000; d.storyboard.thumbnail.height = 3000;
    d.storyboard.rows = 100; d.storyboard.columns = 100;
  }],
  ['count exceeds image grid capacity', d => {d.storyboard.count = 13;}]
];

for (const [variant, modelFile, boardFile] of variants) {
  describe('Task474 storyboard payload guard ' + variant, () => {
    it('preserves an available valid storyboard and timing math', () => {
      const data = good(), original = JSON.stringify(data);
      const h = harness(modelFile, boardFile, data);
      assert.strictEqual(h.model.isAvailable, true);
      assert.strictEqual(h.model.duration, 120);
      assert.strictEqual(h.model.pageCount, 2);
      assert.strictEqual(h.model.cellCount, 12);
      assert.strictEqual(h.model.getIndex(40000), 4);
      assert.deepStrictEqual(Array.from(h.model.urls), ['page-0', 'page-1']);
      assert.strictEqual(JSON.stringify(data), original, 'input is untouched');
    });
    it('rejects malformed success payloads as unavailable, never as live storyboard', () => {
      const h = harness(modelFile, boardFile);
      for (const [name, alter] of invalid) {
        const data = caseData(alter);
        assert.doesNotThrow(() => h.model.update(data), name);
        assert.strictEqual(h.model.isAvailable, false, name);
        assert.strictEqual(h.model.status, 'fail', name);
        assert.strictEqual(h.model.pageCount, 1, name);
        assert.strictEqual(h.model.primary, h.model.rawData.storyboard, name);
        assert.strictEqual(h.model.getPage(0), 'https://example.com', name);
      }
    });
    it('accepts legitimate zero cells and invalid-zero-interval ratio fallback', () => {
      const h = harness(modelFile, boardFile);
      const zeroCount = caseData(d => {d.storyboard.count = 0;});
      h.model.update(zeroCount);
      assert.strictEqual(h.model.isAvailable, true);
      assert.strictEqual(h.model.getIndex(120000), 0);
      const legacy = caseData(d => {d.storyboard.interval = 0;});
      h.model.update(legacy);
      assert.strictEqual(h.model.isAvailable, true, 'legacy invalid interval remains representable');
      assert.strictEqual(h.model.getIndex(110000), 11, 'existing ratio fallback');
      assert(Number.isFinite(h.model.cellIntervalMs) && h.model.cellIntervalMs > 0,
        'worker width never uses an infinite interval ratio');
    });
    it('reset removes the previous page ownership instead of leaving an old primary', () => {
      const h = harness(modelFile, boardFile);
      const old = h.model.primary;
      h.model.reset();
      assert.strictEqual(h.model.isAvailable, false);
      assert.notStrictEqual(h.model.primary, old);
      assert.strictEqual(h.model.primary, h.model.rawData.storyboard);
      assert.strictEqual(h.model.pageCount, 1);
    });
    it('failed response cannot enable the player storyboard or pin the retry owner', () => {
      const h = harness(modelFile, boardFile);
      const ctrl = Object.create(h.Board.prototype);
      ctrl.model = h.model;
      ctrl.state = {isStoryboardAvailable: false};
      ctrl._requestId = 'current';
      ctrl._loadingWatchId = 'sm9';
      const signals = [];
      ctrl.emit = (...args) => signals.push(args);
      ctrl._onStoryboardInfoLoad('current', caseData(d => {
        d.storyboard.images = [null];
      }));
      assert.strictEqual(h.model.isAvailable, false);
      assert.strictEqual(ctrl.state.isStoryboardAvailable, false);
      assert.strictEqual(ctrl._loadingWatchId, null);
      assert.strictEqual(signals.filter(([name]) => name === 'update').length, 1);
    });
    it('valid current and stale responses retain the normal owner semantics', () => {
      const h = harness(modelFile, boardFile);
      const ctrl = Object.create(h.Board.prototype);
      ctrl.model = h.model;
      ctrl.state = {isStoryboardAvailable: false};
      ctrl._requestId = 'current'; ctrl._loadingWatchId = 'sm9';
      ctrl.emit = (...args) => h.emits.push(args);
      ctrl._onStoryboardInfoLoad('old', caseData(d => {d.storyboard = null;}));
      assert.strictEqual(ctrl._loadingWatchId, 'sm9');
      assert.strictEqual(ctrl.state.isStoryboardAvailable, false);
      ctrl._onStoryboardInfoLoad('current', good());
      assert.strictEqual(ctrl.state.isStoryboardAvailable, true);
      assert.strictEqual(h.model.isAvailable, true);
    });
  });
}
