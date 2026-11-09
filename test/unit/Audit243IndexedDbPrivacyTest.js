'use strict';
const assert = require('assert');
const {beginSection, createContext, run} = require('../helpers/extractSource');

function workerHarness() {
  let workerFunc;
  const warnings = [];
  const context = createContext({
    workerUtil: {createCrossMessageWorker(func) {
      workerFunc = func;
      return {post: async () => 'ok'};
    }},
    console: {warn: (...parts) => warnings.push(parts)}
  });
  run(beginSection('packages/lib/src/infra/IndexedDbStorage.js') +
    '\nglobalThis.testSubject = IndexedDbStorage;', context);
  return {
    setup: async () => {
      await context.testSubject.open({name: 'synthetic', ver: 1, stores: [{name: 'cache', definition: {keyPath: 'id'}}]});
      const self = {};
      workerFunc(self);
      return self;
    },
    warnings
  };
}

describe('AUD #243 IndexedDB Worker failure diagnostics', () => {
  it('rejects a failed update but logs only a known command name', async () => {
    const h = workerHarness();
    const self = await h.setup();
    const secret = 'demo1';
    const params = {
      name: 'synthetic',
      storeName: 'cache',
      data: {key: 'sm1', patch: {
        videoInfo: {signedUrl: secret}, comment: {text: secret}
      }}
    };
    await assert.rejects(self.onmessage({command: 'update', params}));
    // The original Worker dispatch returns async controller Promises directly;
    // an asynchronous reject is propagated without entering its synchronous catch.
    // It must not log the sensitive request payload in either path.
    assert.strictEqual(h.warnings.length, 0);
    assert(!JSON.stringify(h.warnings).includes(secret));
    assert(!JSON.stringify(h.warnings).includes('sm1'));
    assert(!JSON.stringify(h.warnings).includes('signedUrl'));
  });

  it('never renders unknown commands or parameters into diagnostics', async () => {
    const h = workerHarness();
    const self = await h.setup();
    const secret = 'demo2';
    await assert.rejects(self.onmessage({
      command: secret, params: {name: secret, data: {token: secret}}
    }));
    assert.deepStrictEqual(h.warnings[0], ['IndexedDB command failed:', 'unknown']);
    assert(!JSON.stringify(h.warnings).includes(secret));
  });
});
