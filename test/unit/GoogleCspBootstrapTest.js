'use strict';
const assert = require('assert');
const {extract, createContext, run} = require('../helpers/extractSource');

function makeHarness(injection = 'fail', logger = console) {
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
    Blob: class {constructor(parts) {win.injectedCode=parts.join('');}},
    AntiPrototypeJs: async () => {},
    GateAPI: {},
    console: logger
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
  it('runs once in the ordinary Nico page realm without a second script or losing the watch query', async () => {
    const h = makeHarness('success');
    h.win.location.host = 'www.nicovideo.jp';
    const query = "word=rock'n'roll&from=search";
    await h.boot(h.monkey, 'ZenzaWatch', query, true);
    assert.deepStrictEqual(h.calls, [['run', 'ZenzaWatch', encodeURIComponent(query)]]);
    await h.boot(h.monkey, 'ZenzaWatch', query, true);
    assert.strictEqual(h.calls.length, 1);
  });
  it('reports a rejected direct startup once without retrying or printing query or error values', async () => {
    const messages = [];
    const h = makeHarness('success', {warn: (...args) => messages.push(args)});
    h.win.location.host = 'www.nicovideo.jp';
    let attempts = 0;
    const cause = Object.assign(Error('private-failure'), {stack:'Error: private-failure\n    at privateFunction (ZenzaWatchRuntime.js:20:3)'});
    await assert.rejects(h.boot(async () => { attempts++; throw cause; }, 'ZenzaWatch', 'private-query', true),
      error => error.name === 'ZenzaWatchStartupError' && error.stack.includes('ZenzaWatchRuntime.js:20:3') && !/private/.test(error.stack));
    assert.strictEqual(attempts, 1);
    assert.deepStrictEqual(h.calls, []);
    assert.deepStrictEqual(messages, [['[ZenzaWatch] 起動診断：プレイヤー本体の初期化に失敗しました。']]);
  });
  it('falls back to userscript execution after a blocked blob script', async () => {
    const h = makeHarness('fail');
    await h.boot(h.monkey, 'ZenzaWatch', 'q=test');
    await Promise.resolve();
    assert.strictEqual(h.calls.filter(x => Array.isArray(x) && x[0] === 'run').length, 1);
    assert(h.calls.includes('revoke'));
  });
  it('starts the injected player with a search term containing an apostrophe', async () => {
    const h=makeHarness('success');
    const query="keyword=rock'n'roll";
    await h.boot(function (product, encoded) {
      window.startedQuery=decodeURIComponent(encoded);
      return Promise.resolve();
    }, 'ZenzaWatch', query);
    await run(h.win.injectedCode, createContext({window:h.win, location:h.win.location, console}));
    assert.strictEqual(h.win.startedQuery,query);
  });
  it('leaves a fixed diagnostic when the main player fails before the journal opens', async () => {
    const h = makeHarness('success');
    h.win.location.host='www.nicovideo.jp';
    h.win.location.href='https://www.nicovideo.jp/search/private-search';
    await h.boot(function () { return Promise.reject(Error('private-failure')); }, 'ZenzaWatch', 'private-query');
    const messages=[];
    const context=createContext({window:h.win, location:h.win.location, console:{warn:(...args)=>messages.push(args)}});
    await assert.rejects(run(h.win.injectedCode, context), /private-failure/);
    assert.deepStrictEqual(messages,[['[ZenzaWatch] 起動診断：プレイヤー本体の初期化に失敗しました。']]);
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
