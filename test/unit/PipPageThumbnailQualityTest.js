'use strict';
const assert = require('assert');
const {JSDOM} = require('jsdom');
const {extract, createContext, run} = require('../helpers/extractSource');

function setup() {
  const dom = new JSDOM('<html><body><div class="videoPlayer">' +
    '<video class="zenzaWatchVideoElement"></video></div></body></html>',
  {url: 'https://www.nicovideo.jp/my'});
  const document = dom.window.document;
  const root = document.querySelector('.videoPlayer');
  const video = root.querySelector('video');
  const listeners = new Map();
  const state = {videoInfo: {
    thumbnail: 'https://cdn.example/small.jpg',
    _rawData: {_data: {video: {thumbnail: {
      url: 'https://cdn.example/small.jpg',
      largeUrl: 'https://cdn.example/large.jpg',
      player: 'https://cdn.example/player.jpg',
      ogp: 'https://cdn.example/ogp.jpg'
    }}}},
    _videoDetail: {largeThumbnail: 'https://cdn.example/player.jpg'}
  }, on(name, fn) { listeners.set(name, fn); },
    off(name) { listeners.delete(name); }};
  const config = {props: {}, on() {}, off() {}};
  const c = createContext({document});
  run('const PipPageThumbnail = ' +
    extract('packages/zenza/src/videoPlayer/PipPageThumbnail.js',
      'PipPageThumbnail','var') + ';this.api=PipPageThumbnail;', c);
  const controller = c.api.initialize({
    document, state, config, getContainer:()=>root, getVideo:()=>video
  });
  const image = () => root.querySelector('.zenzaPipPageThumbnail img');
  const fire = (target, type) =>
    target.dispatchEvent(new dom.window.Event(type, {bubbles:false}));
  const cleanup = () => {controller.dispose(); dom.window.close();};
  return {dom,document,root,video,state,c,controller,image,fire,cleanup,
    changed: () => listeners.get('update-videoInfo')()};
}

describe('Task711 PiP thumbnail quality and native ownership', () => {
  let h;
  afterEach(() => {if(h){h.cleanup();h=null;}});

  it('prefers API ogp, player, large, and finally small if images fail', () => {
    h=setup();
    h.fire(h.video,'enterpictureinpicture');
    assert.strictEqual(h.image().src,'https://cdn.example/ogp.jpg');
    h.fire(h.image(),'error');
    assert.strictEqual(h.image().src,'https://cdn.example/player.jpg');
    h.fire(h.image(),'error');
    assert.strictEqual(h.image().src,'https://cdn.example/large.jpg');
    h.fire(h.image(),'error');
    assert.strictEqual(h.image().src,'https://cdn.example/small.jpg');
    h.fire(h.image(),'error');
    assert.strictEqual(h.image(),null);
  });
  it('uses the watch detail player thumbnail when OGP is absent', () => {
    h=setup();
    const thumb = h.state.videoInfo._rawData._data.video.thumbnail;
    delete thumb.ogp;
    delete thumb.player;
    h.fire(h.video,'enterpictureinpicture');
    assert.strictEqual(h.image().src,'https://cdn.example/player.jpg');
  });

  it('does not fabricate a high-resolution URL for old videos', () => {
    h=setup();
    h.state.videoInfo={thumbnail:'https://cdn.example/small.jpg'};
    h.fire(h.video,'enterpictureinpicture');
    assert.strictEqual(h.image().src,'https://cdn.example/small.jpg');
  });

  it('rejects an invalid HQ URL and uses the valid next source', () => {
    h=setup();
    const thumb=h.state.videoInfo._rawData._data.video.thumbnail;
    thumb.ogp='javascript:alert(1)';
    thumb.player='data:image/png;base64,QUFB';
    h.fire(h.video,'enterpictureinpicture');
    assert.strictEqual(h.image().src,'https://cdn.example/player.jpg');
    h.fire(h.image(),'error');
    assert.strictEqual(h.image().src,'https://cdn.example/large.jpg');
  });

  it('allows explicit activation without an enter event and detaches on leave', () => {
    h=setup();
    assert.strictEqual(h.image(),null);
    assert.strictEqual(h.c.api.activate(h.video),true);
    assert(h.image());
    h.video.remove();
    h.fire(h.video,'leavepictureinpicture');
    assert.strictEqual(h.image(),null);
  });
  it('accepts a currently owned DOM video if the wrapper reference differs', () => {
    h=setup();
    const other=h.document.createElement('video');
    // Test a DOM source still inside the active player wrapper.
    h.root.appendChild(other);
    other.className='zenzaWatchVideoElement';
    assert.strictEqual(h.c.api.activate(other),true);
    assert(h.image());
    h.fire(other,'leavepictureinpicture');
    assert.strictEqual(h.image(),null);
  });

  it('does not let a stale candidate error remove the current video image', () => {
    h=setup();
    h.c.api.activate(h.video);
    const old=h.image();
    h.state.videoInfo={thumbnail:'https://cdn.example/new.jpg'};
    h.changed();
    assert.strictEqual(h.image().src,'https://cdn.example/new.jpg');
    h.fire(old,'error');
    assert.strictEqual(h.image().src,'https://cdn.example/new.jpg');
  });
});
