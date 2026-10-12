'use strict';
const assert = require('assert');
const {createContext, loadClass} = require('../helpers/extractSource');
function fixture(file, item, fallback = null) {
  const timers = [], commands = [], lookups = [];
  const context = createContext({Emitter:class {}, setTimeout(fn, delay) {
    timers.push({fn, delay}); return timers.length;
  }});
  const VideoList = loadClass(file, 'VideoList', context);
  const list = Object.create(VideoList.prototype);
  list.model = {
    findByItemId(id) { lookups.push(['id', id]); return item; },
    findByWatchId(id) { lookups.push(['watch', id]); return fallback; }
  };
  list.emit = (...args) => commands.push(args);
  return {list, timers, commands, lookups};
}
for (const [label, file] of [
  ['source', 'packages/zenza/src/Playlist/VideoList.js'],
  ['generated', 'dist/ZenzaWatch-dev.user.js']
]) {
  describe('Task418 missing video-row guard (' + label + ')', () => {
    for (const [method, command] of [
      ['_onPlaylistAppend', 'playlistAppend'], ['_onDeflistAdd', 'deflistAdd']
    ]) {
      for (const missing of [null, undefined]) {
        it(command + ' preserves the command but skips the missing ' + String(missing) + ' row', () => {
          const h = fixture(file, missing);
          assert.doesNotThrow(() => h.list[method]('sm1', 'removed'));
          assert.deepStrictEqual(h.commands, [['command', command, 'sm1']]);
          assert.strictEqual(h.timers.length, 0);
        });
      }
      it(command + ' retains normal marking and its existing one-second timer', () => {
        const row = {itemId:'present', watchId:'sm1', isUpdating:false};
        const h = fixture(file, row);
        h.list[method]('sm1', 'present');
        assert.deepStrictEqual(h.commands, [['command', command, 'sm1']]);
        assert.strictEqual(row.isUpdating, true);
        assert.strictEqual(h.timers.length, 1);
        assert.strictEqual(h.timers[0].delay, 1000);
        h.timers[0].fn();
        assert.strictEqual(row.isUpdating, false);
      });
    }
    it('retains the existing playlist watch-ID fallback', () => {
      const row = {itemId:'replacement', watchId:'sm1', isUpdating:false};
      const h = fixture(file, null, row);
      h.list._onPlaylistAppend('sm1', 'removed');
      assert.strictEqual(row.isUpdating, true);
      assert.strictEqual(h.timers.length, 1);
      assert.deepStrictEqual(h.lookups, [['id','removed'], ['watch','sm1']]);
    });
    it('does not add a new deflist fallback or mutate a different row', () => {
      const row = {itemId:'replacement', watchId:'sm1', isUpdating:false};
      const h = fixture(file, null, row);
      assert.doesNotThrow(() => h.list._onDeflistAdd('sm1', 'removed'));
      assert.deepStrictEqual(h.commands, [['command', 'deflistAdd', 'sm1']]);
      assert.strictEqual(row.isUpdating, false);
      assert.strictEqual(h.timers.length, 0);
      assert.deepStrictEqual(h.lookups, [['id','removed']]);
    });
  });
}
