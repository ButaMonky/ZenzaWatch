'use strict';
const assert = require('assert');
const {createContext, loadClass} = require('../helpers/extractSource');

// Offline fixtures for three separate user-reported audit candidates.
const quiet = {log() {}, info() {}, warn() {}, error() {},
  time() {}, timeEnd() {}, timeLog() {}};
function snapshotLoader(path = 'packages/lib/src/nico/VideoSearch.js') {
  const c = createContext({console: quiet, sleep: async () => {},
    NicoSearchApiV2Version: class {},
    textUtil: {dateToString: d => d.toISOString()}});
  const Loader = loadClass(path, 'NicoSearchApiV2Loader', c);
  c.NicoSearchApiV2Loader = Loader;
  return Loader;
}
const thumbnailFixture = (thumbnailUrl, contentId = 'sm123') => ({
  meta: {status: 200, totalCount: 1}, data: [{
    contentId, title: 'sample', startTime: '2026-10-01T00:00:00Z',
    thumbnailUrl, description: '', lengthSeconds: 80
  }]
});

describe('Issue #27: Snapshot thumbnail source property', () => {
  it('parses a trailing .M thumbnail without throwing or losing medium-size classification', () => {
    const result = snapshotLoader().parseResult(JSON.stringify(
      thumbnailFixture('https://example.invalid/thumb.M')));
    assert.strictEqual(result.status, 'ok');
    assert.strictEqual(result.list[0].thumbnail_url, 'https://example.invalid/thumb');
    assert.strictEqual(result.list[0].is_middle_thumbnail, true);
  });
  it('keeps ordinary thumbnail URLs and tolerates a missing URL', () => {
    for (const url of ['https://example.invalid/thumb.jpg', undefined]) {
      const result = snapshotLoader().parseResult(JSON.stringify(thumbnailFixture(url)));
      assert.strictEqual(result.list[0].thumbnail_url, url);
    }
  });
});

describe('Issue #28: Snapshot pagination does not mutate caller params', () => {
  it('fetches additional pages in order and retains the caller page', async () => {
    const Loader = snapshotLoader();
    const pages = [];
    Loader.searchBySnapshot = async (word, params) => {
      pages.push(params.page);
      return {status: 'ok', count: 250, list: [{id: 'page-' + params.page}]};
    };
    const params = {page: 1, searchType: 'tag'};
    const response = await Loader.searchMoreBySnapshot('sample', params, 300);
    assert.deepStrictEqual(pages, [1, 5, 9]);
    assert.deepStrictEqual(Array.from(response.list, x => x.id), ['page-1', 'page-5', 'page-9']);
    assert.strictEqual(params.page, 1, 'caller params.page must not be overwritten');
  });
});

function commentModel(path = 'packages/zenza/src/commentLayer/NicoComment.js') {
  const Emitter = class {emit() {}};
  const c = createContext({Emitter, console: quiet, MAX_COMMENT: 1000,
    _: {isObject: value => value !== null && typeof value === 'object',
      size: value => Object.keys(value).length},
    NicoChat: {TYPE: {TOP: 'top', NAKA: 'naka', BOTTOM: 'bottom'},
      SIZE: {SMALL: 'small'}, create: chat => Object.assign({
        date: 1, fork: 0, type: 'naka', isDeleted: false,
        isNicoScript: false, isCA: false, isPatissier: false
      }, chat)}});
  const Comment = loadClass(path, 'NicoComment', c);
  const model = Object.create(Comment.prototype);
  model.nicoScripter = {isEmpty: true, reset() {}};
  for (const name of ['topGroup', 'nakaGroup', 'bottomGroup']) {
    model[name] = {nonFilteredMembers: [], reset() {this.nonFilteredMembers = [];},
      addChatArray(items) {this.nonFilteredMembers.push(...items);}};
  }
  return model;
}

describe('Issue #29: comment time normalization stays finite', () => {
  it('sets finite time3dp for one comment and for all-identical dates', async () => {
    for (const count of [1, 3]) {
      const model = commentModel();
      const items = Array.from({length: count},
        (_, i) => ({text: String(i), date: 1700000000}));
      await model.setChats(items);
      assert.strictEqual(model.nakaGroup.nonFilteredMembers.length, count);
      for (const item of model.nakaGroup.nonFilteredMembers) {
        assert.strictEqual(item.time3d, 0);
        assert.strictEqual(item.time3dp, 0);
      }
    }
  });
  it('preserves ordinary relative timestamps and handles empty comments', async () => {
    const model = commentModel();
    await model.setChats([]);
    assert.strictEqual(model.nakaGroup.nonFilteredMembers.length, 0);
    await model.setChats([100, 150, 200].map((date, i) => ({date, text: String(i)})));
    assert.deepStrictEqual(model.nakaGroup.nonFilteredMembers.map(x => x.time3dp),
      [0, 0.5, 1]);
  });
});

describe('Issues #27-#29: generated dev userscript matches source', () => {
  it('keeps snapshot parsing, caller page and same-date comments fixed in dist', async () => {
    const dist = 'dist/ZenzaWatch-dev.user.js';
    const Loader = snapshotLoader(dist);
    const snapshot = Loader.parseResult(JSON.stringify(
      thumbnailFixture('https://example.invalid/thumb.M')));
    assert.strictEqual(snapshot.list[0].thumbnail_url, 'https://example.invalid/thumb');
    assert.strictEqual(snapshot.list[0].is_middle_thumbnail, true);
    Loader.searchBySnapshot = async (_word, params) => ({
      status: 'ok', count: 250, list: [{id: String(params.page)}]
    });
    const params = {page: 1};
    await Loader.searchMoreBySnapshot('sample', params, 300);
    assert.strictEqual(params.page, 1);
    const comment = commentModel(dist);
    await comment.setChats([{text: 'same-date', date: 1700000000}]);
    assert.strictEqual(comment.nakaGroup.nonFilteredMembers[0].time3dp, 0);
  });
});
