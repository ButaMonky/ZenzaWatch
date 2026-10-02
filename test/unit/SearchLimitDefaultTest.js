// Task193: the number of search results loaded into the playlist starts at 1000 on a new
// install (Config default 'search.limit'). A value the user already chose is kept, and the
// advanced-settings wording is unchanged.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {extract, createContext, run} = require('../helpers/extractSource');
const read = rel => fs.readFileSync(path.join(__dirname, '../..', rel), 'utf-8');

describe('Task193 default search limit is 1000', () => {
  it('the Config default for search.limit is 1000', () => {
    const m = /'search\.limit':\s*(\d+)\s*,/.exec(read('src/Config.js'));
    assert(m, 'search.limit default found');
    assert.strictEqual(Number(m[1]), 1000);
  });

  it('the playlist fallback matches the default, and explicit choices are kept', () => {
    const c = createContext({VideoList: class {}});
    run(`${extract('packages/zenza/src/Playlist/PlayList.js', 'PlayList')};` +
      read('packages/zenza/src/Playlist/PlayList.js').split('\n').filter(l => /^PlayList\.SEARCH_LIMIT_/.test(l)).join('\n') +
      ';globalThis.P=PlayList;', c);
    assert.strictEqual(c.P.SEARCH_LIMIT_DEFAULT, 1000);
    assert.strictEqual(c.P.normalizeSearchLimit(undefined), 1000);
    assert.strictEqual(c.P.normalizeSearchLimit('broken'), 1000);
    assert.strictEqual(c.P.normalizeSearchLimit(300), 300, 'a user who chose 300 keeps 300');
    assert.strictEqual(c.P.normalizeSearchLimit(5000), 5000);
  });

  it('the advanced settings wording is unchanged', () => {
    const s = read('src/_setting.js');
    assert(s.includes('<option value="300">300件（標準・初期値）</option>'));
    assert(s.includes('<option value="1000">1000件（推奨の上限）</option>'));
  });
});
