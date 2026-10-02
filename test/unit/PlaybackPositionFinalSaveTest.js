// Task178 (Watch V4 audit F10): the shared 1-second throttle must not drop the final
// resume-position save (ended -> 0, close, switching video). Ordinary saves stay throttled.
const assert = require('assert');
const {read} = require('../helpers/extractSource');
const {createDialogHarness} = require('../helpers/dialogHarness');

function dialog({duration = 300, contextWatchId = 'sm9', videoId = 'sm9'} = {}) {
  const h = createDialogHarness();
  const calls = [];
  h.context.PlaybackPosition = {record: async (...a) => { calls.push(a.slice(0, 2)); }};
  Object.defineProperty(h.dialog, 'duration', {value: duration, configurable: true});
  h.dialog._videoInfo = {contextWatchId, videoId, msgInfo: {frontendId: 6, frontendVersion: 0}};
  // Same binding as the constructor (real lodash throttle, 1000ms, trailing:false),
  // applied to the real prototype method (the harness stubs it on the instance).
  delete h.dialog._savePlaybackPosition;
  h.Dialog.prototype._bindPlaybackPositionSavers.call(h.dialog);
  return {h, d: h.dialog, calls};
}

describe('Task178 final resume-position save is not throttled away (Watch V4 audit F10)', () => {
  it('pause at 75s then ended within one second still sends 0', () => {
    const {d, calls} = dialog();
    d._savePlaybackPosition('sm9', 75);
    d._saveFinalPlaybackPosition('sm9', 0);
    assert.deepStrictEqual(calls, [['sm9', 75], ['sm9', 0]]);
  });

  it('the pause fired at the very end (skipped as near-end) does not swallow the ended 0', () => {
    const {d, calls} = dialog();
    d._savePlaybackPosition('sm9', 299);   // near the end: not sent, but used to consume the window
    d._saveFinalPlaybackPosition('sm9', 0);
    assert.deepStrictEqual(calls, [['sm9', 0]]);
  });

  it('ordinary repeated saves are still throttled', () => {
    const {d, calls} = dialog();
    d._savePlaybackPosition('sm9', 70);
    d._savePlaybackPosition('sm9', 71);
    assert.deepStrictEqual(calls, [['sm9', 70]]);
  });

  it('a final save keeps the video it was requested for and the existing policy', () => {
    const {d, calls} = dialog();
    d._saveFinalPlaybackPosition('smOther', 0);         // not the current video
    const short = dialog({duration: 119});
    short.d._saveFinalPlaybackPosition('sm9', 0);        // short videos are not saved (policy)
    assert.deepStrictEqual(calls, []);
    assert.deepStrictEqual(short.calls, []);
  });

  it('ended, close and switching use the unthrottled final save; pause stays throttled', () => {
    const text = read('src/NicoVideoPlayerDialog.js');
    const dialogText = text.slice(text.indexOf('class NicoVideoPlayerDialog extends'));
    const body = name => {
      const start = dialogText.indexOf(`\n  ${name}(`);
      return dialogText.slice(start, dialogText.indexOf('\n  }', start + 1));
    };
    assert(/_saveFinalPlaybackPosition\(this\._videoInfo\.contextWatchId, 0\)/.test(body('_onVideoEnded')));
    assert(/_saveFinalPlaybackPosition\(this\._watchId, this\.currentTime\)/.test(body('close')));
    assert(/_savePlaybackPosition\(this\._videoInfo\.contextWatchId, this\.currentTime\)/.test(body('_onVideoPause')));
    assert(/_saveFinalPlaybackPosition\(this\._videoInfo\.contextWatchId, this\.currentTime\);\s*\}\s*nicoVideoPlayer\.close\(\);/.test(text));
  });
});
