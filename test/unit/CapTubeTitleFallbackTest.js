'use strict';
// Task966 QA: real owner selectors changed; screenshot naming must never throw.
const assert = require('assert');
const {extract, createContext, run} = require('../helpers/extractSource');

const targets = ['src/_captube.js', 'dist/CapTube.user.js'];
function fixture(target, elements, options = {}) {
  const seen = [];
  const context = createContext({
    document: {
      title: 'Document title - YouTube',
      querySelector(selector) { seen.push(selector); return elements[selector] || null; }
    },
    localStorage: {'CapTube-prefix': options.prefix || ''},
    location: {search: '?v=jNQXAC9IVRw'}
  });
  const src = ['toSafeName', 'getVideoId', 'getVideoTitle']
    .map(name => 'const ' + name + ' = ' + extract(target, name, 'var') + ';').join('\n');
  run(src + '\nglobalThis.videoTitle = getVideoTitle;', context);
  return {getTitle: context.videoTitle, seen};
}

for (const target of targets) {
  describe('CapTube owner metadata screenshot filename ' + target, function() {
    it('uses the current YouTube owner anchor when the old selector is absent', function() {
      const f = fixture(target, {
        '.title yt-formatted-string': {textContent: 'Me at the zoo'},
        'ytd-video-owner-renderer #channel-name a': {textContent: ' jawed '}
      });
      assert.strictEqual(f.getTitle(), 'Me at the zoo - by jawed (v=jNQXAC9IVRw)');
    });
    it('keeps the legacy owner selector as a fallback', function() {
      const f = fixture(target, {
        '.watch-title': {textContent: 'Older video'},
        '#owner-container yt-formatted-string': {textContent: 'Legacy channel'}
      });
      assert.strictEqual(f.getTitle(), 'Older video - by Legacy channel (v=jNQXAC9IVRw)');
    });
    it('falls back to structured metadata if neither owner element exists', function() {
      const f = fixture(target, {
        'link[itemprop="name"]': {getAttribute: name => name === 'content' ? 'Metadata creator' : null}
      });
      assert.strictEqual(f.getTitle(), 'Document title - YouTube - by Metadata creator (v=jNQXAC9IVRw)');
    });
    it('still produces a safe file name when uploader and title nodes are unavailable', function() {
      const f = fixture(target, {});
      assert.doesNotThrow(() => f.getTitle());
      assert.strictEqual(f.getTitle(), 'Document title - YouTube - by  (v=jNQXAC9IVRw)');
    });
    it('preserves explicit iframe metadata and sanitizes forbidden filename characters', function() {
      const f = fixture(target, {
        'ytd-video-owner-renderer #channel-name a': {textContent: 'wrong name'}
      }, {prefix:'QA-'});
      assert.strictEqual(f.getTitle({author:'First/Author', title:'A?B:C', videoId:'sm9'}),
        'QA-A？B：C - by First／Author (v=sm9)');
    });
  });
}
