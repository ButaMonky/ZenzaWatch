'use strict';
const assert = require('assert');
const {extract, createContext, run} = require('../helpers/extractSource');
describe('Task638: comment PiP teardown bridge', () => {
  it('restores the original page even if the hidden PiP video is detached', () => {
    let params, stopCount = 0;
    const ctx = createContext({
      document: {},
      ZenzaWatch: {state: {player: {}}},
      PlayerConfig: {getInstance: () => ({on(){}})},
      PipPageThumbnail: {initialize(){}, stop(){stopCount++;}},
      CommentPictureInPicture: {
        isSupported: () => true, stop(){},
        toggle: p => { params = p; return Promise.resolve(); }
      },
      PopupMessage: {alert(){}}
    });
    run('const RootDispatcher=' + extract('src/RootDispatcher.js',
      'RootDispatcher', 'var') + ';this.Dispatcher=RootDispatcher;', ctx);
    const dialog = {_nicoVideoPlayer: {drawableVideoElement: {}, commentViewModel: {}},
      on(){}, execCommand(){}};
    ctx.Dispatcher.initialize(dialog);
    ctx.Dispatcher.toggleCommentPictureInPicture();
    assert.strictEqual(typeof params.onEnd, 'function');
    params.onEnd();
    assert.strictEqual(stopCount, 1);
  });
});
