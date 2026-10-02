// Task187 (Watch V4 audit F13): a heatmap that finishes rendering after the video changed
// is discarded, every notification carries the watchId it was made for, and only a
// notification for the current video may be written to the watch-info cache (IndexedDB).
// The real HeatMap code is used with a fake canvas whose toDataURL is controlled by the test.
const assert = require('assert');
const {beginSection, createContext, run} = require('../helpers/extractSource');

const flush = async () => { for (let i = 0; i < 10; i++) { await Promise.resolve(); } };

function setup(offscreen = false) {
  const emits = [], pending = [], posts = [];
  const ctx2d = {fillRect() {}, beginPath() {}, set fillStyle(v) {}};
  const canvas = {
    width: 200, height: 10, getContext: () => ctx2d,
    toDataURL() { return new Promise(resolve => pending.push(resolve)); }
  };
  const context = createContext({
    HTMLCanvasElement: {prototype: offscreen ? {transferControlToOffscreen() {}} : {}},
    workerUtil: {createCrossMessageWorker: () => ({post: async msg => { posts.push(msg); return {status: 'ok'}; }})},
    global: {emitter: {emit: (name, data) => emits.push({name, data})}},
    console: {time() {}, timeEnd() {}, log() {}, warn() {}, error() {}}
  });
  run(beginSection('packages/zenza/src/heatMap/HeatMapWorker.js') +
    ';globalThis.HeatMapInitFunc=HeatMapInitFunc;globalThis.HeatMapWorker=HeatMapWorker;' +
    'globalThis.heatMapCacheEntry=typeof heatMapCacheEntry==="function"?heatMapCacheEntry:null;', context);
  const HeatMap = context.HeatMapInitFunc({emit: (name, data) => emits.push({name, data})});
  return {context, HeatMap, canvas, emits, pending, posts};
}
const chats = n => ({top: [], bottom: [], naka: Array.from({length: n}, (_, i) => ({vpos: i * 1000, fork: 0}))});

describe('Task187 heatmap generation and watchId ownership (Watch V4 audit F13)', () => {
  it('a render that completes after reset is not announced (P26)', async () => {
    const {HeatMap, canvas, emits, pending} = setup();
    const hm = new HeatMap({canvas});
    hm.reset({watchId: 'sm1'});
    hm.duration = 120;
    hm.chatList = chats(30);
    assert.strictEqual(pending.length, 1);
    hm.reset({watchId: 'sm2'});
    pending[0]('data:A');
    await flush();
    assert.strictEqual(emits.length, 0, 'stale heatmap is discarded');
  });

  it('A then B: only B is announced, tagged with B and B\'s own map', async () => {
    const {HeatMap, canvas, emits, pending} = setup();
    const hm = new HeatMap({canvas});
    hm.reset({watchId: 'sm1'});
    hm.duration = 120;
    hm.chatList = chats(30);
    hm.reset({watchId: 'sm2'});
    hm.duration = 60;
    hm.chatList = chats(5);
    pending[1]('data:B');
    pending[0]('data:A');
    await flush();
    assert.strictEqual(emits.length, 1);
    const p = emits[0].data;
    assert.strictEqual(p.watchId, 'sm2');
    assert.strictEqual(p.duration, 60);
    assert.strictEqual(p.dataURL, 'data:B');
    assert.strictEqual(p.map.length, 60);
  });

  it('within one video only the latest render is announced', async () => {
    const {HeatMap, canvas, emits, pending} = setup();
    const hm = new HeatMap({canvas});
    hm.reset({watchId: 'so9'});
    hm.duration = 100;
    hm.chatList = chats(3);
    hm.chatList = chats(50);
    pending[0]('data:old');
    pending[1]('data:new');
    await flush();
    assert.deepStrictEqual(emits.map(e => e.data.dataURL), ['data:new']);
    assert.strictEqual(emits[0].data.watchId, 'so9');
  });

  it('a heatmap is saved only under the matching current watchId', () => {
    const {context} = setup();
    const entry = context.heatMapCacheEntry;
    assert.strictEqual(typeof entry, 'function');
    const p = {watchId: 'sm1', map: [1, 2], duration: 10, dataURL: 'data:x'};
    assert.strictEqual(entry(p, 'sm2'), null, 'another video is never written');
    assert.strictEqual(entry({...p, watchId: null}, 'sm1'), null, 'unknown owner is not written');
    assert.strictEqual(entry({...p, map: null}, 'sm1'), null);
    assert.strictEqual(entry(null, 'sm1'), null);
    const ok = entry(p, 'sm1');
    assert.strictEqual(ok.watchId, 'sm1');
    assert.deepStrictEqual(JSON.parse(JSON.stringify(ok.heatMap)), {map: [1, 2], duration: 10, dataURL: 'data:x'});
  });

  it('the worker proxy forwards the watchId on reset', async () => {
    const {context, posts} = setup(true);
    const canvas = {transferControlToOffscreen: () => ({})};
    const hm = await context.HeatMapWorker.init({container: {querySelector: () => canvas}});
    await hm.reset({watchId: 'sm7'});
    const reset = posts.find(m => m.command === 'reset');
    assert(reset, 'reset posted');
    assert.strictEqual(reset.params.watchId, 'sm7');
  });

  it('the control bar saves through the ownership check, not the current id alone', () => {
    const src = require('fs').readFileSync(require('path').join(__dirname, '../../src/VideoControlBar.js'), 'utf-8');
    assert(!src.includes('WatchInfoCacheDb.putBestEffort(this.player.watchId, {heatMap})'));
    assert(src.includes('heatMapCacheEntry(payload, this.player.watchId)'));
    assert(src.includes('this.heatMap.reset({watchId: this._heatMapWatchId})'));
  });
});
