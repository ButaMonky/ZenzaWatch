'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {extract, createContext, run} = require('../helpers/extractSource');

function makeSubject({userPageMain = null, continuous = null, mypageVer = 'spa', rel = 'packages/zenza/src/init/replaceRedirectLinks.js'} = {}) {
  const observed = [];
  class MutationObserver {
    constructor(callback) { this.callback = callback; }
    observe(target, options) {
      if (!target) { throw new TypeError('observe target is null'); }
      observed.push({target, options});
    }
  }

  const document = {
    querySelector(selector) {
      if (selector === '.UserPage-main') { return userPageMain; }
      if (selector === '.ContinuousPlayButton') { return continuous; }
      if (selector === '.zenzaPlaylistShuffleStart') { return null; }
      return null;
    }
  };

  const uq = selector => {
    const items = [];
    items.find = () => items;
    items.attr = () => items;
    items.clone = () => items;
    items.text = () => items;
    items.after = () => items;
    return items;
  };
  uq.ready = async () => {};

  const context = createContext({
    document,
    MutationObserver,
    location: {host: 'www.nicovideo.jp', pathname: '/user/123', search: ''},
    nicoUtil: {getMypageVer: () => mypageVer},
    uq,
    _: {debounce: fn => fn},
    textUtil: {},
    cssUtil: {}
  });

  const source = extract(rel, 'replaceRedirectLinks', 'var');
  run(`globalThis.__subject = ${source};`, context);
  return {subject: context.__subject, observed};
}

describe('Task235 legacy MyPage shuffle bootstrap', () => {
  it('does not reject when the SPA marker remains but .UserPage-main is absent', async () => {
    const {subject, observed} = makeSubject();
    await assert.doesNotReject(() => subject());
    assert.strictEqual(observed.length, 0);
  });

  it('still observes the legacy MyPage container when it exists', async () => {
    const container = {};
    const {subject, observed} = makeSubject({userPageMain: container});
    await subject();
    assert.strictEqual(observed.length, 1);
    assert.strictEqual(observed[0].target, container);
    assert.strictEqual(observed[0].options.childList, true);
    assert.strictEqual(observed[0].options.subtree, true);
  });

  it('does not start the legacy observer outside the SPA MyPage variant', async () => {
    const {subject, observed} = makeSubject({userPageMain: {}, mypageVer: 'legacy'});
    await subject();
    assert.strictEqual(observed.length, 0);
  });

  it('failure-isolates the optional bootstrap at the initializer call site', () => {
    const initializer = fs.readFileSync(path.join(__dirname, '../../src/initializer.js'), 'utf8');
    assert(initializer.includes("replaceRedirectLinks().catch(() => console.warn('Legacy redirect-link enhancement unavailable'));"));
  });

  it('keeps generated dev dist legacy MyPage null-guard in parity with source', async () => {
    const {subject, observed} = makeSubject({rel: 'dist/ZenzaWatch-dev.user.js'});
    await assert.doesNotReject(() => subject());
    assert.strictEqual(observed.length, 0);
  });

  it('keeps generated dev dist optional bootstrap failure isolation', () => {
    const dist = fs.readFileSync(path.join(__dirname, '../../dist/ZenzaWatch-dev.user.js'), 'utf8');
    assert(dist.includes("replaceRedirectLinks().catch(() => console.warn('Legacy redirect-link enhancement unavailable'));"));
  });
});
