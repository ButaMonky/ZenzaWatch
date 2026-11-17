'use strict';
// Task1072: 動画を開いていない時（videoInfo が null）にツイートの命令が来ても、例外にならず何もしない。
// 動画があれば今までどおり openTweetWindow に動画情報を渡す。
const assert = require('assert');
const {createContext, beginSection, run} = require('../helpers/extractSource');

const setup = videoInfo => {
  const tweets = [];
  const handlers = {};
  const ctx = createContext({
    ZenzaWatch: {state: {player: {videoInfo}}, api: {}},
    PlayerConfig: {getInstance: () => ({on() {}, props: {}, getValue() {}, setValue() {}})},
    PipPageThumbnail: {initialize() {}},
    nicoUtil: {openTweetWindow: info => tweets.push(info)},
    document: {},
  });
  run(beginSection('src/RootDispatcher.js') + ';globalThis.dispatcher=RootDispatcher;', ctx);
  ctx.dispatcher.initialize({on: (name, fn) => { handlers[name] = fn; }});
  return {ctx, tweets};
};

describe('Task1072 RootDispatcher tweet', () => {
  it('動画が無い時は例外にならず何もしない', () => {
    const {ctx, tweets} = setup(null);
    assert.doesNotThrow(() => ctx.dispatcher.execCommand('tweet'));
    assert.deepStrictEqual(tweets, []);
  });
  it('動画がある時は動画情報を渡す', () => {
    const info = {watchId: 'sm9', title: 't', duration: 1};
    const {ctx, tweets} = setup(info);
    ctx.dispatcher.execCommand('tweet');
    assert.strictEqual(tweets.length, 1);
    assert.strictEqual(tweets[0], info);
  });
});
