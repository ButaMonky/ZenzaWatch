'use strict';
const assert = require('assert');
const {read, createContext, run} = require('../helpers/extractSource');

function waitForDomExpression(file) {
  const script = read(file);
  const next = script.indexOf('    const getNgEnv = async');
  const marker = '    const waitForDom = ';
  const begin = script.lastIndexOf(marker, next);
  assert(next >= 0 && begin >= 0, 'must select the Pocket NG DOM wait, not an unrelated module');
  return script.slice(begin + marker.length, next).trim().replace(/;$/, '');
}

function harness(file, query) {
  let now = 0;
  let polls = 0;
  let noisyLogs = 0;
  const context = createContext({
    Date: {now: () => now},
    document: {querySelector: () => query(++polls)},
    console: {log: () => { noisyLogs++; }},
    setTimeout: (resolve, delay) => {
      now += delay;
      Promise.resolve().then(resolve);
      return 1;
    }
  });
  run('globalThis.waitForDom = ' + waitForDomExpression(file), context);
  return {wait: context.waitForDom, polls: () => polls, logs: () => noisyLogs};
}

describe('Task319 AUD-20 optional Pocket DOM polling owns its failure', () => {
  for (const file of ['src/_pocket.js', 'dist/MylistPocket.user.js']) {
    it(file + ' does not lose async executor rejections', () => {
      const code = waitForDomExpression(file);
      assert.doesNotMatch(code, /new Promise\s*\(\s*async\b/);
    });
    it(file + ' returns an immediately discovered anchor without logs', async () => {
      const found = {id: 'initial'};
      const h = harness(file, () => found);
      assert.strictEqual(await h.wait('#anchor'), found);
      assert.strictEqual(h.polls(), 1);
      assert.strictEqual(h.logs(), 0);
    });
    it(file + ' polls until a delayed anchor arrives', async () => {
      const found = {id: 'delayed'};
      const h = harness(file, polls => polls === 3 ? found : null);
      assert.strictEqual(await h.wait('#anchor', 3500), found);
      assert.strictEqual(h.polls(), 3);
      assert.strictEqual(h.logs(), 0);
    });

    it(file + ' rejects after the configured timeout', async () => {
      const h = harness(file, () => null);
      await assert.rejects(h.wait('#missing', 2000), /timeout/);
      assert.strictEqual(h.polls(), 2);
      assert.strictEqual(h.logs(), 0);
    });
    it(file + ' rejects a late DOM query exception through the returned promise', async () => {
      const fault = new Error('detached document');
      const h = harness(file, polls => {
        if (polls === 2) { throw fault; }
        return null;
      });
      await assert.rejects(h.wait('#anchor', 4000), err => err === fault);
      assert.strictEqual(h.polls(), 2);
      assert.strictEqual(h.logs(), 0);
    });
  }
});
