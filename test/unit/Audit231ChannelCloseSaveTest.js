'use strict';
const assert = require('assert');
const {createContext, loadClass} = require('../helpers/extractSource');

describe('Issue #231 close final save uses server context watch ID', () => {
  for (const file of ['src/NicoVideoPlayerDialog.js', 'dist/ZenzaWatch-dev.user.js']) {
    for (const [watchId, contextId] of [
      ['so123', '98765'], ['sm7', 'sm7'], ['sm8', null], ['so999', null]
    ]) {
      it(file + ' uses context or legacy fallback for ' + watchId, () => {
        const writes = [], local = [];
        const ctx = createContext({Emitter: class {},
          WatchInfoCacheDb: {putBestEffort: (...args) => local.push(args)},
          Fullscreen: {now: () => false}, global: {emitter: {emitAsync() {}}}});
        const Dialog = loadClass(file, 'NicoVideoPlayerDialog', ctx);
        const d = Object.create(Dialog.prototype);
        d._view = {manualBookmarkDock: {deactivate() {}}};
        d._state = {isEnded: false};
        d._videoInfo = contextId == null ? {} : {contextWatchId: contextId};
        d._watchId = watchId;
        Object.defineProperty(d, 'isPlaying', {configurable: true, value: true});
        Object.defineProperty(d, 'currentTime', {configurable: true, value: 56});
        d._isAutoResumeSaveSuppressed = () => false;
        d._saveFinalPlaybackPosition = (...args) => writes.push(args);
        for (const name of ['pause', 'hide', '_cancelCommentLoad', '_abortCommonsTreeJob',
          '_clearVideoTimers', '_refresh', 'emit']) d[name] = () => {};
        d.close();
        assert.deepStrictEqual(writes, [[contextId || watchId, 56]]);
        assert.strictEqual(local[0][0], watchId);
      });
    }
  }
});
