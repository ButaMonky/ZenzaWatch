'use strict';
const assert = require('assert');
const {extract, createContext, run} = require('../helpers/extractSource');
const targets = [
  ['source', 'packages/lib/src/text/textUtil.js', 'packages/lib/src/nico/nicoUtil.js'],
  ['dist', 'dist/ZenzaWatch-dev.user.js', 'dist/ZenzaWatch-dev.user.js']
];
for (const [label, textFile, nicoFile] of targets) {
  const query = value => {
    const c = createContext();
    run(`globalThis.subject = ${extract(textFile, 'textUtil', 'var')}`, c);
    return c.subject.parseQuery(value);
  };
  const history = cookie => {
    const c = createContext({document: {cookie}});
    run(`globalThis.subject = ${extract(nicoFile, 'nicoUtil', 'var')}`, c);
    return c.subject.getNicoHistory;
  };
  describe(`Task301 startup decode robustness (${label})`, () => {
    it('skips malformed pairs and preserves valid siblings', () => {
      const result = query('ok=1&broken=%&%ZZ=x&last=2');
      assert.deepStrictEqual(JSON.parse(JSON.stringify(result)), {ok: '1', last: '2'});
    });
    it('preserves Japanese, plus, equals and repeated-key semantics', () => {
      assert.strictEqual(query('q=%E3%83%86%E3%82%B9%E3%83%88').q, '\u30c6\u30b9\u30c8');
      assert.strictEqual(query('?q=a+b&q=c+d&playlist=abc%3D%3D').q, 'c+d');
      assert.strictEqual(query('playlist=abc==').playlist, 'abc==');
    });
    it('ignores unrelated malformed cookies', () => {
      assert.strictEqual(history('foo=ok; other=%'), '');
      assert.strictEqual(history('nicohistory=sm9; other=%'), 'sm9');
    });
    it('returns empty history for absent or malformed exact cookie', () => {
      assert.strictEqual(history('prefixnicohistory=sm9'), '');
      assert.strictEqual(history('nicohistory=%'), '');
      assert.strictEqual(history('nicohistory=%E0%A4%A'), '');
    });
    it('decodes only the exact history value', () => {
      assert.strictEqual(history('a=1; nicohistory=sm9%2Csm10; b=2'), 'sm9,sm10');
    });
  });
}
