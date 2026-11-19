'use strict';
// Task1072: 動画を開いていない時（videoInfo が null）にツイートの命令が来ても、例外にならず何もしない。
// 動画があれば今までどおり 共有画面に動画情報を渡す。
const assert = require('assert');
const {createContext, beginSection, run} = require('../helpers/extractSource');

const setup = (videoInfo, watchId = videoInfo?.watchId, backend = 'native') => {
  const tweets = [];
  const handlers = {};
  const thumbnails = [], previewReaders = [];
  const storyboard = {createClipPreviewSource(id) { previewReaders.push(id); return (host,time) => { thumbnails.push([host,id,time]); return () => {}; }; }};
  class VideoElement {}
  const video = new VideoElement();
  video.currentSrc = "https://example.test/sample.mp4";
  const displayed = backend === 'hls' ? {drawableElement:video, currentTime:0} : backend === 'iframe' ? {} : video;
  const viewModel = {};
  let capture;
  const ctx = createContext({
    HTMLVideoElement:VideoElement, Blob,
    ZenzaWatch: {state: {player: {videoInfo}}, api: {}},
    PlayerConfig: {getInstance: () => ({on() {}, props: {}, getValue() {}, setValue() {}})},
    PipPageThumbnail: {initialize() {},stop(){}},
    VideoSharePanel: {open(info, time, getVideo, context) { tweets.push(info); capture = {getVideo, context}; }, close() {}},
    document: {}, CommentPictureInPicture:{stop(){}},
  });
  run(beginSection('src/RootDispatcher.js') + ';globalThis.dispatcher=RootDispatcher;', ctx);
  ctx.dispatcher.initialize({watchId, _view:{videoControlBar:{storyboard}}, _nicoVideoPlayer:{_videoPlayer:{videoElement:video}, drawableVideoElement:displayed, commentViewModel:viewModel}, on: (name, fn) => { handlers[name] = fn; }});
  return {ctx, thumbnails, previewReaders, tweets, video, displayed, viewModel, handlers, capture:() => capture};
};

describe('Task1072 RootDispatcher tweet', () => {
  it('動画が無い時は例外にならず何もしない', () => {
    const {ctx, tweets} = setup(null);
    assert.doesNotThrow(() => ctx.dispatcher.execCommand('tweet'));
    assert.deepStrictEqual(tweets, []);
  });
  it('別の動画を読み込み中は前の動画を共有しない', () => {
    const {ctx, tweets} = setup({watchId:'sm9'}, 'sm10');
    ctx.dispatcher.execCommand('tweet');
    assert.deepStrictEqual(tweets, []);
  });
  it('別の投稿者の動画も選べるが、次の動画へ切り替えた後は古い描画対象を使わない', () => {
    const env = setup({watchId:'sm9', isOwnUpload:false});
    env.ctx.dispatcher.execCommand('tweet');
    const {getVideo, context} = env.capture();
    assert.equal(getVideo(), env.video);
    assert.equal(context.getCurrentFileSource(env.video), env.video.currentSrc);
    assert.equal(context.getViewModel(), env.viewModel);
    const host = {};
    assert.equal(typeof context.getThumbnail(host, 7), 'function');
    assert.deepEqual(env.thumbnails, [[host, 'sm9', 7]]);
    env.ctx.dispatcher.execCommand('tweet');
    env.capture().context.getThumbnail(host,8);
    assert.deepEqual(env.previewReaders,['sm9']);
    env.handlers.open();
    assert.equal(context.getThumbnail(host, 7), undefined);
    assert.equal(env.thumbnails.length, 2);
    env.ctx.dispatcher.execCommand('tweet');
    env.capture().context.getThumbnail(host,8);
    assert.deepEqual(env.previewReaders,['sm9','sm9']);
    const beforeClose=env.capture().context;
    env.handlers.close();
    assert.equal(beforeClose.getThumbnail(host,9),undefined);
    env.ctx.dispatcher.execCommand('tweet');
    env.capture().context.getThumbnail(host,9);
    assert.deepEqual(env.previewReaders,['sm9','sm9','sm9']);
    assert.equal(getVideo(), null);
    assert.equal(context.getCurrentFileSource(env.video), undefined);
    assert.equal(context.getViewModel(), null);
  });
  it('HLSでは実映像を取得し、区間指定はプレイヤー経由で行う', () => {
    const env = setup({watchId:'sm9'}, 'sm9', 'hls');
    env.ctx.dispatcher.execCommand('tweet');
    const {getVideo, context} = env.capture();
    assert.equal(getVideo(), env.video);
    assert.equal(context.getCurrentFileSource(env.video), undefined);
    assert.equal(context.seekCurrentVideo(env.video, 12), true);
    assert.equal(env.displayed.currentTime, 12);
    env.handlers.open();
    assert.equal(context.seekCurrentVideo(env.video, 0), false);
    assert.equal(env.displayed.currentTime, 12);
  });
  it('外部埋め込みのダミー動画を録画対象にしない', () => {
    const env = setup({watchId:'sm9'}, 'sm9', 'iframe');
    env.ctx.dispatcher.execCommand('tweet');
    assert.equal(env.capture().getVideo(), null);
  });
  it('動画がある時は動画情報を渡す', () => {
    const info = {watchId: 'sm9', title: 't', duration: 1};
    const {ctx, tweets} = setup(info);
    ctx.dispatcher.execCommand('tweet');
    assert.strictEqual(tweets.length, 1);
    assert.strictEqual(tweets[0], info);
  });
});
