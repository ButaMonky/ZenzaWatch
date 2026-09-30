const assert = require('assert');
const {beginSection, createContext, run} = require('../helpers/extractSource');
function subject() {
  const c = createContext();
  run(beginSection('packages/lib/src/Emitter.js') + ';globalThis.subject = {Handler, Emitter};', c);
  return c.subject;
}
describe('Handler dispatch mutation (Task152 / ZW-036 related)', function() {
  it('nested emit consuming once never repeats an ordinary callback in its outer dispatch', function() {
    const {Emitter} = subject(), e = new Emitter(), calls = [];
    let nested = false;
    e.on('ready', () => { calls.push('first'); if (!nested) { nested = true; e.emit('ready'); } });
    e.once('ready', () => calls.push('once'));
    e.on('ready', () => calls.push('last'));
    e.emit('ready');
    assert.deepStrictEqual(calls, ['first', 'first', 'once', 'last', 'last']);
  });
  [false, true].forEach(method => {
    const label = method ? 'execMethod' : 'exec';
    const wrap = callback => method ? {next: callback} : callback;
    const fire = h => method ? h.execMethod('next', 7) : h.exec(7);
    it(`${label}: removal before delivery skips that member without repeating an earlier one`, function() {
      const {Handler} = subject(), h = new Handler(), seen = [];
      const last = wrap(() => seen.push('last'));
      const middle = wrap(() => seen.push('removed'));
      h.add(wrap(value => { assert.strictEqual(value, 7); seen.push('first'); h.remove(middle); }));
      h.add(middle); h.add(last); fire(h);
      assert.deepStrictEqual(seen, ['first', 'last']);
    });
    it(`${label}: additions wait for the next dispatch and preserve registration order`, function() {
      const {Handler} = subject(), h = new Handler(), seen = [];
      const added = wrap(() => seen.push('added'));
      h.add(wrap(() => { seen.push('first'); h.add(added); }));
      h.add(wrap(() => seen.push('last')));
      fire(h); assert.deepStrictEqual(seen, ['first', 'last']);
      fire(h); assert.deepStrictEqual(seen, ['first', 'last', 'first', 'last', 'added']);
    });
    it(`${label}: clearing within delivery skips pending members`, function() {
      const {Handler} = subject(), h = new Handler(), seen = [];
      h.add(wrap(() => { seen.push('first'); h.clear(); }));
      h.add(wrap(() => seen.push('last')));
      assert.doesNotThrow(() => fire(h));
      assert.deepStrictEqual(seen, ['first']);
    });
    it(`${label}: errors still propagate immediately`, function() {
      const {Handler} = subject(), h = new Handler(), error = new Error('expected');
      let later = false;
      h.add(wrap(() => { throw error; })); h.add(wrap(() => { later = true; }));
      assert.throws(() => fire(h), value => value === error);
      assert.strictEqual(later, false);
    });
  });
  it('execMethod preserves the member as method receiver', function() {
    const {Handler} = subject(), h = new Handler(), member = {count: 0, next(v) { this.count += v; }};
    h.add(member); h.execMethod('next', 7); assert.strictEqual(member.count, 7);
  });
  it('exec retains the current member list as its existing callback receiver', function() {
    const {Handler} = subject(), h = new Handler();
    let receiver;
    h.add(function() { receiver = this; }); h.exec();
    assert.strictEqual(receiver, h._list);
  });
});
