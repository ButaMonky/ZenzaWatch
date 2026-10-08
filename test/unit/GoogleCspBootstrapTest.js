'use strict';
const assert = require('assert');
const {extract, createContext, run} = require('../helpers/extractSource');

function makeHarness(injection = 'fail') {
  const calls = [];
  const win = {name: '', location: {host: 'www.google.com', href: 'https://www.google.com/search?q=test'}};
  win.top = win;
  win.ZenzaLib = {$: {}};
  const doc = {
    createElement: () => ({remove: () => calls.push('remove')}),
    head: {
      append(script) {
        calls.push('append');
        if (injection === 'fail') { script.onerror(); }
        else if (injection === 'success') { script.onload(); }
        else { throw new Error('CSP blocked insertion'); }
      }
    }
  };
  const fakeURL = {
    createObjectURL: () => 'blob:https://www.google.com/fake',
    revokeObjectURL: () => calls.push('revoke')
  };
  win.document = doc;
  const context = createContext({
    window: win, location: win.location,
    URL: fakeURL,
    Blob: class {},
    AntiPrototypeJs: async () => {},
    GateAPI: {},
    console
  });
  run('const boot = ' + extract('src/boot.js', 'boot', 'var') +
    ';globalThis.subjectBoot=boot;', context);
  const monkey = (product, query) => {
    calls.push(['run', product, query]);
    win.ZenzaWatch = {};
  };
  return {calls, win, boot: context.subjectBoot, monkey};
}

describe('Task311 Google strict CSP startup recovery', () => {
  it('falls back to userscript execution after a blocked blob script', async () => {
    const h = makeHarness('fail');
    await h.boot(h.monkey, 'ZenzaWatch', 'q=test');
    await Promise.resolve();
    assert.strictEqual(h.calls.filter(x => Array.isArray(x) && x[0] === 'run').length, 1);
    assert(h.calls.includes('revoke'));
  });
  it('does not duplicate a successful page-script bootstrap', async () => {
    const h = makeHarness('success');
    await h.boot(h.monkey, 'ZenzaWatch', 'q=test');
    await Promise.resolve();
    assert.strictEqual(h.calls.filter(x => Array.isArray(x) && x[0] === 'run').length, 0);
    assert(h.calls.includes('revoke'));
  });
  it('recovers when script insertion itself fails', async () => {
    const h = makeHarness('throw');
    await h.boot(h.monkey, 'ZenzaWatch', 'q=test');
    await Promise.resolve();
    assert.strictEqual(h.calls.filter(x => Array.isArray(x) && x[0] === 'run').length, 1);
    assert(h.calls.includes('revoke'));
  });
});
