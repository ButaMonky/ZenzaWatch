// Task 090（監査v2 R04 ZW-019・ZW-020）: 古い API（メソッド形式）の再生速度・自動再生が、通常の経路と同じ状態になることの回帰テスト。
// ZW-019: NicoVideoPlayer.setPlaybackRate が、コメントのプレイヤーの存在しないメソッド setPlaybackRate を呼んで TypeError（監査の PLAYER-02）。
// ZW-020: VideoPlayer.setIsAutoPlay が綴り違いの isAutoplay へ代入し、getter も video.autoPlay を読んでいた（監査の PLAYER-03）。
// 通常の速度の UI（プレイヤーの状態 playbackRate）はもともと動いている。ここでは古い API とその収束だけを確かめる。
// jsdom・実ブラウザの <video> ではなく、代わりのオブジェクトでの確認。
import assert from 'power-assert';

const {beginSection, createContext, run, loadClass} = require('../helpers/extractSource');

function classes() {
  const c = createContext({});
  run(beginSection('packages/lib/src/Emitter.js'), c);
  const NicoVideoPlayer = loadClass('src/NicoVideoPlayer.js', 'NicoVideoPlayer', c);
  const VideoPlayer = loadClass('src/NicoVideoPlayer.js', 'VideoPlayer', c);
  const NicoCommentPlayer = loadClass('src/CommentPlayer.js', 'NicoCommentPlayer', c);
  return {NicoVideoPlayer, VideoPlayer, NicoCommentPlayer};
}

// 通常の経路: プレイヤーの状態（playbackRate）を変えると _onPlayerStateUpdate で動画とコメントへ反映される
function playerWithState() {
  const {NicoVideoPlayer, NicoCommentPlayer} = classes();
  const o = Object.create(NicoVideoPlayer.prototype);
  o._videoPlayer = {playbackRate: 1};
  o._commentPlayer = Object.create(NicoCommentPlayer.prototype);
  o._commentPlayer._view = {playbackRate: 1};
  const state = {_rate: 1};
  Object.defineProperty(state, 'playbackRate', {
    get() { return this._rate; },
    set(v) {
      if (this._rate === v) { return; }
      this._rate = v;
      NicoVideoPlayer.prototype._onPlayerStateUpdate.call(o, 'playbackRate', v);
    }
  });
  o._state = state;
  const snapshot = () => ({state: state.playbackRate, video: o._videoPlayer.playbackRate, comment: o._commentPlayer.playbackRate});
  return {o, state, snapshot};
}

describe('古い API の再生速度（ZW-019）', function() {
  it('PLAYER-02: setPlaybackRate(2) が例外にならず、動画とコメントの速度が2になる（状態が無い古い呼び方）', function() {
    const {NicoVideoPlayer, NicoCommentPlayer} = classes();
    const o = Object.create(NicoVideoPlayer.prototype);
    o._videoPlayer = {playbackRate: 1};
    o._commentPlayer = Object.create(NicoCommentPlayer.prototype);
    o._commentPlayer._view = {playbackRate: 1};
    o.setPlaybackRate(2);
    assert.equal(o._videoPlayer.playbackRate, 2);
    assert.equal(o._commentPlayer.playbackRate, 2);
  });

  it('UI（状態）と古いメソッドが同じ速度の状態へ収束する', function() {
    const {o, state, snapshot} = playerWithState();
    state.playbackRate = 1.5;
    assert.deepEqual(snapshot(), {state: 1.5, video: 1.5, comment: 1.5});
    o.setPlaybackRate(0.5);
    assert.deepEqual(snapshot(), {state: 0.5, video: 0.5, comment: 0.5}, '古いメソッドでも状態（UIの表示）まで変わる');
    state.playbackRate = 2;
    assert.deepEqual(snapshot(), {state: 2, video: 2, comment: 2});
  });

  it('不正な値（NaN・0・負・Infinity・文字）では何も変えない。10倍より速い値は10倍にする', function() {
    const {o, snapshot} = playerWithState();
    o.setPlaybackRate(1.25);
    for (const bad of [NaN, 0, -1, Infinity, 'abc', undefined, null]) {
      o.setPlaybackRate(bad);
      assert.deepEqual(snapshot(), {state: 1.25, video: 1.25, comment: 1.25}, String(bad));
    }
    o.setPlaybackRate(40);
    assert.deepEqual(snapshot(), {state: 10, video: 10, comment: 10});
    o.setPlaybackRate('1.75');
    assert.deepEqual(snapshot(), {state: 1.75, video: 1.75, comment: 1.75});
  });
});

describe('古い API の自動再生（ZW-020）', function() {
  it('PLAYER-03: setIsAutoPlay(true/false) で <video> の autoplay が変わり、getIsAutoPlay・isAutoPlay も同じ値を返す', function() {
    const {VideoPlayer} = classes();
    const o = Object.create(VideoPlayer.prototype);
    o._video = {autoplay: false};
    o.setIsAutoPlay(true);
    assert.equal(o._video.autoplay, true);
    assert.equal(o.getIsAutoPlay(), true);
    assert.equal(o.isAutoPlay, true);
    assert.equal(Object.prototype.hasOwnProperty.call(o, 'isAutoplay'), false, '綴り違いのプロパティを作らない');
    o.setIsAutoPlay(false);
    assert.equal(o._video.autoplay, false);
    assert.equal(o.getIsAutoPlay(), false);
  });

  it('通常の経路（isAutoPlay の setter）と古いメソッドが同じ状態を返す', function() {
    const {VideoPlayer} = classes();
    const o = Object.create(VideoPlayer.prototype);
    o._video = {autoplay: false};
    o.isAutoPlay = true;
    assert.equal(o.getIsAutoPlay(), true);
    assert.equal(o.isAutoPlay, true);
    o.setIsAutoPlay(0);
    assert.equal(o._video.autoplay, false, '真偽値にそろえる');
    assert.equal(o.isAutoPlay, false);
  });
});
