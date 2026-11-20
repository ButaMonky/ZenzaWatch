'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const {splitOptionalPanels, panelLoader} = require('./optional-panels.cjs');

test('the ordinary script retains its dependencies and both optional panels use the latest values', async () => {
  const original = [
    'let shared = 2;',
    'function createAdvancedSettingsPanel(x) { return "settings:" + (shared + x); }',
    'const createVideoSharePanel = ({shared: local}) => "share:" + (shared * local);',
    'shared = 3;',
    'return Promise.all([createAdvancedSettingsPanel(5), createVideoSharePanel({shared: 4})]);'
  ].join('\n');
  const split = splitOptionalPanels(original);
  assert.doesNotMatch(split.runtime, /"settings:"|"share:"/);
  const factories = vm.runInNewContext('(' + split.factories + ')');
  const result = await vm.runInNewContext('(async () => {' + split.runtime + '})()', {
    loadOptionalPanel: async name => factories[name]
  });
  assert.deepEqual(Array.from(result), ['settings:8', 'share:12']);
});

test('requests for the same panel share a single result', async () => {
  const doc = new EventTarget();
  const loader = panelLoader(doc, 'local-');
  const factory = () => {};
  let requests = 0;
  doc.addEventListener('local-example', () => {
    requests++;
    const response = Object.assign(new Event('local-example:ready'), {detail: factory});
    queueMicrotask(() => doc.dispatchEvent(response));
  });
  const pending = loader('example');
  assert.equal(loader('example'), pending);
  assert.equal(await pending, factory);
  assert.equal(await loader('example'), factory);
  assert.equal(requests, 1);
});
