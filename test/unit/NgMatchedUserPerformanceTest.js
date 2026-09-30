const assert = require('assert');
const {beginSection, createContext, run} = require('../helpers/extractSource');
function context() {
  const logger = {log() {}, time() {}, timeEnd() {}};
  const c = createContext({console: logger, _: {compact: xs => xs.filter(Boolean), debounce: fn => fn},
    Config: {getValue: () => false}, textUtil: {escapeRegs: s => s}});
  run(beginSection('packages/lib/src/Emitter.js'), c);
  run(beginSection('packages/zenza/src/commentLayer/NicoChatFilter.js'), c);
  run(`function chat(no, text = 'clean', userId = 'user-' + no, fork = 0) {
    return {no, text, userId, fork, threadId: 1, threadLabel: 'default', type: 'naka', score: 0, cmd: ''};
  }`, c);
  return c;
}

describe('ZW-030 matched-user filtering', () => {
  it('preserves object identity, order, duplicates and existing fork1 behavior', () => {
    const c = context();
    run(`const filter = new NicoChatFilter({wordFilter: 'blocked', removeNgMatchedUser: true});
      const a = chat(1), bad = chat(2, 'blocked', 'bad-user'), sibling = chat(3, 'clean', 'bad-user');
      const owner = chat(4, 'blocked', 'owner', 1), ownerSibling = chat(5, 'clean', 'bad-user', 1);
      const b = chat(6);
      const input = [a, bad, sibling, a, owner, ownerSibling, b];
      globalThis.output = filter.applyFilter(input);
      globalThis.expected = [a, a, owner, b];`, c);
    assert.deepStrictEqual(Array.from(c.output), Array.from(c.expected));
  });
  it('does not propagate fork exclusion to other comments by that user', () => {
    const c = context();
    run(`const filter = new NicoChatFilter({wordFilter: 'blocked', removeNgMatchedUser: true, fork2: false});
      const denied = chat(1, 'clean', 'same', 2), kept = chat(2, 'clean', 'same');
      globalThis.kept = kept; globalThis.output = filter.applyFilter([denied, kept]);`, c);
    assert.strictEqual(c.output.length, 1); assert.strictEqual(c.output[0], c.kept);
  });
  it('keeps ordinary filtering when matched-user removal is disabled', () => {
    const c = context();
    run(`const filter = new NicoChatFilter({wordFilter: 'blocked', removeNgMatchedUser: false});
      const bad = chat(1, 'blocked', 'same'), kept = chat(2, 'clean', 'same');
      globalThis.kept = kept; globalThis.output = filter.applyFilter([bad, kept, kept]);`, c);
    assert.deepStrictEqual(Array.from(c.output), [c.kept, c.kept]);
  });
  it('bounds actual includes element probes linearly, without timing assertions', () => {
    function probes(n) {
      const c = context(); c.n = n;
      run(`globalThis.probes = 0;
        const nativeIncludes = Array.prototype.includes;
        Array.prototype.includes = function(...args) {
          const measured = new Proxy(this, {get(target, key, receiver) {
            if (typeof key === 'string' && /^\\d+$/.test(key)) { globalThis.probes++; }
            return Reflect.get(target, key, receiver);
          }});
          return nativeIncludes.apply(measured, args);
        };
        const filter = new NicoChatFilter({wordFilter: 'blocked', removeNgMatchedUser: true});
        const input = Array.from({length: n}, (_, i) => chat(i, i % 2 ? 'clean' : 'blocked'));
        globalThis.output = filter.applyFilter(input);`, c);
      assert.strictEqual(c.output.length, n / 2);
      return c.probes;
    }
    assert(probes(200) <= 200 * 20, 'includes element probes exceed linear budget at 200');
    assert(probes(400) <= 400 * 20, 'includes element probes exceed linear budget at 400');
  });
});
