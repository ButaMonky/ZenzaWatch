'use strict';
const assert = require('assert');
const {extract, createContext, run} = require('../helpers/extractSource');
function subject(addModule) {
  const revoked = [], created = [];
  const c = createContext({CSS: {paintWorklet: {addModule}}, Blob: class {},
    URL: {createObjectURL() { const url = 'blob:' + created.length; created.push(url); return url; },
      revokeObjectURL(url) { revoked.push(url); }}, throttle: {raf: fn => fn}});
  run(`globalThis.subject = ${extract('packages/lib/src/css/css.js', 'css', 'var')}`, c);
  return {css: c.subject, revoked, created};
}
async function rejectsSame(promise, error) {
  let caught;
  try { await promise; } catch (e) { caught = e; }
  assert.strictEqual(caught, error);
}
describe('Task301 paint worklet retry and URL ownership', () => {
  it('releases the URL after success and avoids duplicate registration', async () => {
    let calls = 0; const {css, created, revoked} = subject(async () => { calls++; });
    const fn = () => {};
    assert.strictEqual(await css.addModule(fn), true);
    await css.addModule(fn);
    assert.strictEqual(calls, 1); assert.deepStrictEqual(revoked, created);
  });
  for (const synchronous of [false, true]) {
    it(`releases failure URLs and permits retry (synchronous=${synchronous})`, async () => {
      const error = new Error('registration failed'); let calls = 0;
      const {css, created, revoked} = subject(() => {
        if (++calls === 1) { if (synchronous) { throw error; } return Promise.reject(error); }
        return Promise.resolve();
      });
      const fn = () => {};
      await rejectsSame(css.addModule(fn), error);
      assert.deepStrictEqual(revoked, created);
      assert.strictEqual(await css.addModule(fn), true);
      assert.strictEqual(calls, 2); assert.deepStrictEqual(revoked, created);
    });
  }
  it('keeps one registration in flight and permits retry after failure', async () => {
    let fail, calls = 0;
    const {css, revoked} = subject(() => { calls++; return new Promise((resolve, reject) => { fail = reject; }); });
    const fn = () => {}, error = new Error('pending failure');
    const first = css.addModule(fn); const checked = rejectsSame(first, error);
    let settled = false;
    const second = css.addModule(fn);
    const secondChecked = rejectsSame(second, error).then(() => { settled = true; });
    await Promise.resolve(); await Promise.resolve();
    assert.strictEqual(settled, false);
    assert.strictEqual(calls, 1); assert.strictEqual(revoked.length, 0);
    fail(error); await Promise.all([checked, secondChecked]);
    assert.strictEqual(revoked.length, 1);
  });
});
