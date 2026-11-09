'use strict';
const assert = require('assert');
const {beginSection, createContext, run} = require('../helpers/extractSource');

function goodItem() {
  const fields = {
    link: {textContent: 'https://www.nicovideo.jp/watch/sm123'},
    guid: {textContent: 'item,2026-11-07:abcdef'},
    description: {textContent: 'description html'},
    title: {textContent: 'Good video'}
  };
  return {querySelector: key => fields[key] || null};
}
function makeParser(entries) {
  return class FakeDomParser {
    parseFromString(content, kind) {
      if (kind === 'application/xml') {
        return {querySelectorAll: selector => selector === 'item' ? entries : []};
      }
      const parts = {
        '.nico-info-length': {textContent: '1:23'},
        '.nico-info-date': {textContent: '12:34:56'},
        '.nico-thumbnail img': {src: 'https://example.invalid/123.jpg'},
        '.nico-description': {textContent: 'description'}
      };
      return {querySelector: selector => parts[selector] || null};
    }
  };
}
function harness(entries) {
  const warnings = [];
  const c = createContext({
    DOMParser: makeParser(entries),
    netUtil: {fetch: async () => ({text: async () => '<rss/>'})},
    textUtil: {dateToString: d => d.toISOString()},
    console: {warn: (...args) => warnings.push(args)}
  });
  run(beginSection('packages/lib/src/nico/NicoRssLoader.js') +
    '\nglobalThis.loader = NicoRssLoader;', c);
  return {loader: c.loader, warnings};
}
describe('AUD #263 malformed RSS item isolation', () => {
  it('keeps a valid video when another RSS item is malformed', async () => {
    const h = harness([goodItem(), {querySelector: () => null}]);
    const items = await h.loader.load('https://example.invalid/rss');
    assert.strictEqual(items.length, 1);
    assert.strictEqual(items[0].id, 'sm123');
    assert.strictEqual(h.warnings.length, 1);
    assert.strictEqual(h.warnings[0][1], 1);
  });
  it('still reports failure when all entries are unparseable', async () => {
    const h = harness([{querySelector: () => null}]);
    await assert.rejects(h.loader.load('https://example.invalid/rss'),
      error => /RSS/.test(error.message));
  });
  it('accepts truly empty valid RSS without claiming malformed entries', async () => {
    const h = harness([]);
    const items = await h.loader.load('https://example.invalid/rss');
    assert.strictEqual(items.length, 0);
    assert.strictEqual(h.warnings.length, 0);
  });
});
