'use strict';
const assert = require('assert');
const {loadClass, createContext} = require('../helpers/extractSource');

function makeWrapper(artifact, options = {}) {
  let actual;
  let onReady;
  let readyCount = 0;
  const context = createContext({
    Emitter: class {emit() {}},
    _: {debounce: fn => fn},
    window: {console}
  });
  const YouTubeWrapper = loadClass(artifact, 'YouTubeWrapper', context);
  const subject = new YouTubeWrapper({parentNode: {id: 'player-container'}, ...options});
  subject._initYT = async () => ({Player: class {
    constructor(node, opts) {
      actual = {node, opts};
      onReady = opts.events.onReady;
    }
  }});
  subject._onPlayerReady = () => { readyCount++; };
  return {subject, get actual() {return actual;},
    get readyCount() {return readyCount;},
    finish: () => {assert.strictEqual(typeof onReady, 'function'); onReady();}};
}

for (const artifact of ['packages/zenza/src/videoPlayer/YouTubeWrapper.js',
  'dist/ZenzaWatch-dev.user.js']) {
  describe('Task365 AUD-36 YouTube autoplay policy: ' + artifact, function() {
    for (const [label, opts, expected] of [
      ['explicit true', {autoplay: true}, 1],
      ['explicit false', {autoplay: false}, 0],
      ['default true', {}, 1],
      ['private setting takes precedence', {autoplay: false}, 0]
    ]) {
      it(label + ' forwards intended autoplay policy to iframe playerVars', async () => {
        const fixture = makeWrapper(artifact, opts);
        if (label === 'private setting takes precedence') {
          fixture.subject.autoplay = true; // accidental public field must not reverse intent
        }
        const loading = fixture.subject._initPlayer('video-id', 13);
        for (let i = 0; i < 5 && !fixture.actual; i++) {
          await new Promise(resolve => setImmediate(resolve));
        }
        assert(fixture.actual, 'YouTube iframe player should have been created');
        assert.strictEqual(fixture.actual.opts.videoId, 'video-id');
        assert.strictEqual(fixture.actual.opts.playerVars.autoplay, expected);
        assert.strictEqual(fixture.actual.opts.playerVars.start, 13);
        assert.strictEqual(fixture.actual.opts.playerVars.loop, 0);
        fixture.finish();
        await loading;
        assert.strictEqual(fixture.readyCount, 1);
      });
    }
  });
}
