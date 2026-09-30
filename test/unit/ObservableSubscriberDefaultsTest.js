const assert = require('assert');
const {beginSection, createContext, run, loadClass} = require('../helpers/extractSource');
function subject() {
  const handlers = new Map();
  const window = {addEventListener: (name, fn) => handlers.set(name, fn), removeEventListener: name => handlers.delete(name)};
  const c = createContext({window});
  run('const nop = () => {};', c);
  const Subscriber = loadClass('packages/lib/src/infra/Observable.js', 'Subscriber', c);
  run(beginSection('packages/lib/src/Emitter.js'), c);
  run(beginSection('packages/lib/src/infra/Observable.js') + '\nglobalThis.O = Observable;', c);
  return {Subscriber, O: c.O, handlers, window};
}
describe('ZW037 partial Subscriber callback defaults', () => {
  it('supports next-only fromEvent subscribers', () => {
    const h = subject(), values = [], event = {type: 'custom'};
    const sub = h.O.fromEvent(h.window, 'custom').subscribe(value => values.push(value));
    h.handlers.get('custom')(event); assert.deepStrictEqual(values, [event]); sub.unsubscribe();
  });
  it('allows omitted error, complete and start callbacks in function form', () => {
    const {Subscriber} = subject(), values = [];
    const subscriber = Subscriber.create(value => values.push(value));
    assert.doesNotThrow(() => { subscriber.start({}); subscriber.next(7); subscriber.error(new Error('ignored')); subscriber.complete(); });
    assert.deepStrictEqual(values, [7]);
  });
  it('allows optional callbacks in observer-object and empty forms', () => {
    const {Subscriber} = subject(); let completed = 0;
    const observer = Subscriber.create({complete() { completed++; }});
    assert.doesNotThrow(() => { observer.start({}); observer.next(1); observer.error(new Error('ignored')); observer.complete(); });
    assert.strictEqual(completed, 1);
    const empty = Subscriber.create(); assert.doesNotThrow(() => { empty.start(); empty.next(); empty.error(); empty.complete(); });
  });
  it('reads the supplied closed callback and defaults to false', () => {
    const {Subscriber} = subject(); let closed = false;
    const subscriber = Subscriber.create({closed: () => closed});
    assert.strictEqual(subscriber.closed, false); closed = true; assert.strictEqual(subscriber.closed, true);
    assert.strictEqual(Subscriber.create().closed, false);
  });
});
