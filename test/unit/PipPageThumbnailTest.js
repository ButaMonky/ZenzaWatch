'use strict';
const assert = require('assert');
const {JSDOM} = require('jsdom');
const {extract, createContext, run} = require('../helpers/extractSource');
const SOURCE = 'packages/zenza/src/videoPlayer/PipPageThumbnail.js';

function emitter() {
  const callbacks = new Map();
  return {
    on(name, fn) {
      if (!callbacks.has(name)) { callbacks.set(name, new Set()); }
      callbacks.get(name).add(fn);
    },
    off(name, fn) { callbacks.get(name)?.delete(fn); },
    emit(name) { for (const fn of callbacks.get(name) || []) { fn(); } },
    count(name) { return callbacks.get(name)?.size || 0; }
  };
}
function setup(thumb = 'https://nicovideo.cdn.nimg.jp/thumbnails/2049295/2049295') {
  const dom = new JSDOM('<html><body>' +
    '<div class="videoPlayer" id="ZenzaWatchVideoPlayerContainer">' +
    '<video class="zenzaWatchVideoElement"></video></div></body></html>',
  {url: 'https://www.nicovideo.jp/my/watchlater'});
  const document = dom.window.document;
  const root = document.getElementById('ZenzaWatchVideoPlayerContainer');
  const video = root.querySelector('video');
  let currentVideo = video;
  const state = Object.assign(emitter(), {videoInfo: {thumbnail: thumb}, thumbnail: ''});
  const config = Object.assign(emitter(), {props: {pipPageThumbnail: true}});
  const context = createContext({document});
  run('const ThumbnailSourcePolicy = '+extract('packages/lib/src/nico/ThumbnailSourcePolicy.js','ThumbnailSourcePolicy','var')+';',context);
  run('const PipPageThumbnail = ' + extract(SOURCE, 'PipPageThumbnail', 'var') +
    ';this.PipPageThumbnail = PipPageThumbnail;', context);
  const controller = context.PipPageThumbnail.initialize({
    document, state, config, getContainer: () => root, getVideo: () => currentVideo
  });
  const fire = (target, event) =>
    target.dispatchEvent(new dom.window.Event(event, {bubbles: false}));
  const getImage = () => root.querySelector('.zenzaPipPageThumbnail img');
  const cleanup = () => { controller.dispose(); dom.window.close(); };
  return {dom, document, root, video, state, config, controller, fire, getImage, cleanup,
    setCurrentVideo: next => { currentVideo = next; }};
}

describe('Task638: thumbnail stays on original page during video PiP', () => {
  let h;
  afterEach(() => { if (h) { h.cleanup(); h = null; } });

  it('only displays after native PiP begins, without changing the video element', () => {
    h = setup();
    assert.strictEqual(h.getImage(), null);
    h.fire(h.video, 'enterpictureinpicture');
    const image = h.getImage();
    assert(image);
    assert.strictEqual(image.src,
      'https://nicovideo.cdn.nimg.jp/thumbnails/2049295/2049295');
    assert(!image.hasAttribute('crossorigin'));
    assert.strictEqual(image.closest('.videoPlayer'), h.root);
    assert.strictEqual(image.parentNode.style.pointerEvents, 'none');
    assert.strictEqual(image.parentNode.style.zIndex, '6');
    assert.strictEqual(h.video.parentNode, h.root);
  });

  it('defaults ON without any stored configuration key', () => {
    h = setup();
    delete h.config.props.pipPageThumbnail;
    h.fire(h.video, 'enterpictureinpicture');
    assert(h.getImage());
  });

  it('removes the page image when native PiP closes', () => {
    h = setup();
    h.fire(h.video, 'enterpictureinpicture');
    h.fire(h.video, 'leavepictureinpicture');
    assert.strictEqual(h.getImage(), null);
  });

  it('supports the comment PiP auxiliary video too', () => {
    h = setup();
    const commentPip = h.document.createElement('video');
    commentPip.className = 'zenzaCommentPipVideo';
    h.document.body.append(commentPip);
    h.fire(commentPip, 'enterpictureinpicture');
    assert(h.getImage());
    h.fire(commentPip, 'leavepictureinpicture');
    assert.strictEqual(h.getImage(), null);
  });

  it('cleans up when the original video is replaced before native PiP leave', () => {
    h = setup();
    h.fire(h.video, 'enterpictureinpicture');
    assert(h.getImage());
    const nextVideo = h.document.createElement('video');
    nextVideo.className = 'zenzaWatchVideoElement';
    h.root.replaceChild(nextVideo, h.video);
    h.setCurrentVideo(nextVideo);
    h.state.emit('update-videoInfo');
    assert.strictEqual(h.getImage(), null);
  });

  it('ignores an unrelated video using PiP', () => {
    h = setup();
    const other = h.document.createElement('video');
    h.document.body.append(other);
    h.fire(other, 'enterpictureinpicture');
    assert.strictEqual(h.getImage(), null);
  });

  it('updates to the new thumbnail if video info changes', () => {
    h = setup();
    h.fire(h.video, 'enterpictureinpicture');
    const oldImage = h.getImage();
    h.state.videoInfo = {thumbnail: 'https://example.org/new.jpg'};
    h.state.emit('update-videoInfo');
    assert.notStrictEqual(h.getImage(), oldImage);
    assert.strictEqual(h.getImage().src, 'https://example.org/new.jpg');
  });

  it('falls back from a preferred thumbnail object to a valid URL', () => {
    h = setup();
    h.state.videoInfo.betterThumbnail = {url: 'https://example.org/object'};
    h.fire(h.video, 'enterpictureinpicture');
    assert(h.getImage());
    assert.strictEqual(h.getImage().src,
      'https://nicovideo.cdn.nimg.jp/thumbnails/2049295/2049295');
  });

  it('uses a later thumbnail when none existed at PiP start', () => {
    h = setup('');
    h.fire(h.video, 'enterpictureinpicture');
    assert.strictEqual(h.getImage(), null);
    h.state.videoInfo = {thumbnail: 'https://example.org/later.jpg'};
    h.state.emit('update-videoInfo');
    assert.strictEqual(h.getImage().src, 'https://example.org/later.jpg');
  });

  it('can be disabled and reenabled with a config update', () => {
    h = setup();
    h.fire(h.video, 'enterpictureinpicture');
    h.config.props.pipPageThumbnail = false;
    h.config.emit('update');
    assert.strictEqual(h.getImage(), null);
    h.config.props.pipPageThumbnail = true;
    h.config.emit('update');
    assert(h.getImage());
  });

  it('does not display unsafe schemes or images with no valid source', () => {
    h = setup('javascript:alert(1)');
    h.fire(h.video, 'enterpictureinpicture');
    assert.strictEqual(h.getImage(), null);
    h.state.videoInfo = {thumbnail: 'https://example.org/valid'};
    h.state.emit('update-videoInfo');
    assert(h.getImage());
  });

  it('ignores a late thumbnail error from an older video', () => {
    h = setup();
    h.fire(h.video, 'enterpictureinpicture');
    const oldImage = h.getImage();
    h.state.videoInfo = {thumbnail: 'https://example.org/next.jpg'};
    h.state.emit('update-videoInfo');
    const nextImage = h.getImage();
    assert.notStrictEqual(nextImage, oldImage);
    h.fire(oldImage, 'error');
    assert.strictEqual(h.getImage(), nextImage);
  });

  it('removes the overlay if an image fails to load', () => {
    h = setup();
    h.fire(h.video, 'enterpictureinpicture');
    h.fire(h.getImage(), 'error');
    assert.strictEqual(h.getImage(), null);
  });

  it('ignores a stale leave event for a different PiP session', () => {
    h = setup();
    h.fire(h.video, 'enterpictureinpicture');
    const comment = h.document.createElement('video');
    comment.className = 'zenzaCommentPipVideo';
    h.document.body.append(comment);
    h.fire(comment, 'enterpictureinpicture');
    h.fire(h.video, 'leavepictureinpicture');
    assert(h.getImage());
    h.fire(comment, 'leavepictureinpicture');
    assert.strictEqual(h.getImage(), null);
  });

  it('stops on player close and disposes event subscriptions', () => {
    h = setup();
    h.fire(h.video, 'enterpictureinpicture');
    h.controller.stop();
    assert.strictEqual(h.getImage(), null);
    assert.strictEqual(h.state.count('update-videoInfo'), 1);
    h.controller.dispose();
    assert.strictEqual(h.state.count('update-videoInfo'), 0);
    assert.strictEqual(h.config.count('update'), 0);
    h.fire(h.video, 'enterpictureinpicture');
    assert.strictEqual(h.getImage(), null);
  });
});
