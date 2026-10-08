'use strict';
const assert = require('assert');
const {extract, createContext, run} = require('../helpers/extractSource');
function environment(cookieStore) {
  const container = {};
  const c = createContext({location: {host: 'www.nicovideo.jp', pathname: '/search/a'},
    document: {querySelector: () => container, querySelectorAll: () => [container]},
    waitForDom: async () => {}, cookieStore});
  run(`globalThis.subject = ${extract('src/_pocket.js', 'getNgEnv', 'var')}`, c);
  return {c, container};
}
describe('Task301 optional Pocket NG initialization isolation', () => {
  it('supports browsers without Cookie Store', async () => {
    const {c, container} = environment();
    assert.strictEqual((await c.subject()).container, container);
  });
  it('continues discovery if Cookie Store rejects', async () => {
    const {c, container} = environment({get: async () => { throw new Error('unavailable'); }});
    assert.strictEqual((await c.subject()).container, container);
  });
  it('retains explicit legacy search selection', async () => {
    const {c, container} = environment({get: async () => ({value: 'false'})});
    const result = await c.subject(); assert.strictEqual(result.container[0], container);
    assert.strictEqual(result.subtree, false);
  });
});
describe('Task301 Pocket bootstrap continuation', () => {
  it('initializes unrelated features when optional NG discovery rejects', async () => {
    let externalCalls = 0;
    const c = createContext({config: {promise: async () => {}, props: {nicoad: {hide: false}}},
      initDom() {}, initZenzaBridge() {}, createVideoInfoView: () => ({on() {}}),
      createCommandDispatcher: () => () => {}, HoverMenu: class {on() {}},
      MylistPocket: {debug: {}}, initNg: async () => { throw new Error('DOM timeout'); },
      document: {querySelector: () => null}, initExternal() { externalCalls++; },
      console: {log() {}, warn() {}}});
    run(`globalThis.init = ${extract('src/_pocket.js', 'init', 'var')}`, c);
    await c.init(); assert.strictEqual(externalCalls, 1);
  });
  it('skips missing NG containers before constructing observers', async () => {
    const c = createContext({IntersectionObserver: class {}, initNgConfig() { throw new Error('must skip'); }});
    run(`globalThis.init = ${extract('src/_pocket.js', 'initNg', 'var')}`, c);
    await c.init({query: 'x', container: null});
    await c.init({query: 'x', container: []});
  });
});
