'use strict';
const assert = require('assert');
const {loadClass, createContext} = require('../helpers/extractSource');

const flush = async () => {
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));
};
function fixture(path) {
  const commands = [], inserted = [], searchEvents = [], scrolls = [], timers = [];
  let settle;
  const pending = new Promise(resolve => {settle = resolve;});
  const ctx = createContext({
    Emitter: class {},
    window: {setTimeout:fn => timers.push(fn), console: {warn() {}}},
    global: {emitter: {emitAsync: (...args) => searchEvents.push(args)}}
  });
  const Dialog = loadClass(path, 'NicoVideoPlayerDialog', ctx);
  const dialog = Object.create(Dialog.prototype);
  dialog._watchId = 'smSeed';
  dialog._videoInfo = {watchId: 'smSeed', msgInfo: {id: 'original'}, owner: {id:'1'}};
  dialog._state = {currentTab: 'videoInfoTab'};
  dialog._playerConfig = {props: {'search.limit': 100}};
  dialog._videoWatchOptions = {query: {}};
  dialog._playlist = {
    isEnable: false,
    load: () => pending,
    loadSearchVideo: () => pending,
    insertCurrentVideo: item => inserted.push(item),
    scrollToActiveItem: () => scrolls.push(true)
  };
  dialog.execCommand = (...args) => commands.push(args);
  return {dialog,settle,commands,inserted,searchEvents,scrolls,timers};
}
const methods = [
  ['mylist', d => d._onPlaylistSetMylist('123')],
  ['uploaded', d => d._onPlaylistSetUploadedVideo('123')],
  ['search', d => d._onPlaylistSetSearchVideo({word:'test',option:{}})],
  ['series', d => d._onPlaylistSetSeriesVideo('123')]
];
for (const path of ['src/NicoVideoPlayerDialog.js',
  'dist/ZenzaWatch-dev.user.js']) {
  describe('Task384 playlist superseded load does not trigger dialog success UI: ' + path, () => {
    for (const [name, start] of methods) {
      it('skips stale success handling for ' + name, async () => {
        const h = fixture(path);
        start(h.dialog);
        h.settle({status: 'superseded', message: ''});
        await flush();
        assert.deepStrictEqual(h.commands, []);
        assert.deepStrictEqual(h.inserted, []);
        assert.deepStrictEqual(h.searchEvents, []);
        assert.deepStrictEqual(h.scrolls, []);
        assert.deepStrictEqual(h.timers, []);
      });
      it('preserves ordinary success handling for ' + name, async () => {
        const h = fixture(path);
        start(h.dialog);
        h.settle({status: 'ok', message: 'loaded'});
        await flush();
        assert.ok(h.commands.some(cmd => cmd[0] === 'notify' && cmd[1] === 'loaded'));
        assert.strictEqual(h.inserted.length, 1);
        if (name === 'search') {
          assert.strictEqual(h.searchEvents.length, 1);
          assert.strictEqual(h.timers.length, 1);
        }
        if (name === 'series') { assert.strictEqual(h.timers.length, 1); }
      });
    }
  });
}
