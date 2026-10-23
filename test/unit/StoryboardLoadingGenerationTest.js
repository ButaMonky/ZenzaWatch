'use strict';
const assert = require('assert');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const {read, createContext, run} = require('../helpers/extractSource');

const variants = [
  ['source', 'packages/zenza/src/storyboard/StoryboardWorker.js'],
  ['generated Dev', 'dist/ZenzaWatch-dev.user.js']
];
const tick = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return {promise, resolve, reject};
};

// Avoid parsing the ~54k-line Dev userscript for every scenario. Recheck the
// entire source string so tests still notice a regenerated bundle mid-run.
const sourceCache = new Map();
function loadOuterCreateView(file) {
  const raw = read(file);
  const cached = sourceCache.get(file);
  if (cached && cached.raw === raw) { return cached.code; }
  const ast = parser.parse(raw, {sourceType:'unambiguous', plugins:['classProperties']});
  let code;
  traverse(ast, {noScope:true, VariableDeclarator(path) {
    if (path.node.id.name !== 'createView' || !path.node.init) { return; }
    const candidate = raw.slice(path.node.init.start, path.node.init.end);
    if (candidate.includes("canvas.classList.add('is-loading')")) { code = candidate; }
  }});
  if (!code) { throw new Error('outer createView not found: ' + file); }
  sourceCache.set(file, {raw, code});
  return code;
}

function harness(file, {deferredSetup=false}={}) {
  const setups = [], infos = [], commands = [];
  let nextId = 0;
  const worker = {post({command, params}) {
    commands.push({command, params});
    if (command === 'createBoard' || command === 'createThumbnail') {
      if (deferredSetup) { const d = deferred(); setups.push(d); return d.promise; }
      return Promise.resolve({id: ++nextId});
    }
    if (command === 'info') {
      const d = deferred();
      infos.push({info: params.info, ...d});
      return d.promise;
    }
    return Promise.resolve({status:'ok'});
  }};
  const ctx = createContext({
    worker, initWorker:async()=>worker,
    isOffscreenCanvasAvailable:false, window:{devicePixelRatio:1}
  });
  run('globalThis.outerCreateView = ' + loadOuterCreateView(file), ctx);
  const create = () => {
    const classes = new Set();
    const canvas = {dataset:{}, classList:{
      add(name){classes.add(name);},
      remove(name){classes.delete(name);},
      contains(name){return classes.has(name);}
    }};
    const view = ctx.outerCreateView({canvas, name:'loading-contract'}, 'board');
    return {view, canvas, loading:()=>classes.has('is-loading')};
  };
  return {create, setups, infos, commands};
}

for (const [variant, file] of variants) {
  describe('Task423 AUD-66 outer storyboard loading ownership: '+variant, function() {
    // First parse of the generated bundle depends on machine load, not Worker behavior.
    if (variant === 'generated Dev') { this.timeout(10000); }
    it('clears initial loading after a successful setup', async () => {
      const h = harness(file), v = h.create();
      assert.strictEqual(v.loading(), true);
      await tick();
      assert.strictEqual(v.loading(), false);
    });
    it('keeps B loading when older A resolves first', async () => {
      const h = harness(file), v = h.create();
      await tick();
      const a = v.view.setInfo({id:'A'});
      const b = v.view.setInfo({id:'B'});
      await tick();
      assert.strictEqual(h.infos.length, 2);
      h.infos[0].resolve({});
      await a;
      assert.strictEqual(v.loading(), true);
      h.infos[1].resolve({});
      await b;
      assert.strictEqual(v.loading(), false);
    });
    it('keeps B completed when older A resolves last', async () => {
      const h = harness(file), v = h.create();
      await tick();
      const a = v.view.setInfo({id:'A'});
      const b = v.view.setInfo({id:'B'});
      await tick();
      h.infos[1].resolve({});
      await b;
      assert.strictEqual(v.loading(), false);
      h.infos[0].resolve({});
      await a;
      assert.strictEqual(v.loading(), false);
    });
    it('does not clear B when old A rejects', async () => {
      const h = harness(file), v = h.create();
      await tick();
      const a = v.view.setInfo({id:'A'});
      const rejected = assert.rejects(a, /older failed/);
      const b = v.view.setInfo({id:'B'});
      await tick();
      h.infos[0].reject(new Error('older failed'));
      await rejected;
      assert.strictEqual(v.loading(), true);
      h.infos[1].resolve({});
      await b;
      assert.strictEqual(v.loading(), false);
    });
    it('clears latest B loading on reject while preserving its error', async () => {
      const h = harness(file), v = h.create();
      await tick();
      const a = v.view.setInfo({id:'A'});
      const b = v.view.setInfo({id:'B'});
      const rejected = assert.rejects(b, /latest failed/);
      await tick();
      h.infos[1].reject(new Error('latest failed'));
      await rejected;
      assert.strictEqual(v.loading(), false);
      h.infos[0].resolve({});
      await a;
      assert.strictEqual(v.loading(), false);
    });
    it('does not clear a requested B while initial setup resolves', async () => {
      const h = harness(file, {deferredSetup:true}), v = h.create();
      await tick();
      assert.strictEqual(h.setups.length, 1);
      const b = v.view.setInfo({id:'B'});
      h.setups[0].resolve({id:1});
      await tick();
      assert.strictEqual(h.infos.length, 1);
      assert.strictEqual(v.loading(), true);
      h.infos[0].resolve({});
      await b;
      assert.strictEqual(v.loading(), false);
    });
    it('clears loading if initial create fails and propagates failure', async () => {
      const h = harness(file, {deferredSetup:true}), v = h.create();
      await tick();
      const b = v.view.setInfo({id:'B'});
      const rejected = assert.rejects(b, /setup failed/);
      h.setups[0].reject(new Error('setup failed'));
      await rejected;
      assert.strictEqual(v.loading(), false);
      assert.strictEqual(h.infos.length, 0);
    });
    it('clears loading on dispose and ignores in-flight settlement', async () => {
      const h = harness(file), v = h.create();
      await tick();
      const a = v.view.setInfo({id:'A'});
      await tick();
      assert.strictEqual(v.loading(), true);
      v.view.dispose();
      assert.strictEqual(v.loading(), false);
      await tick();
      assert.strictEqual(h.commands.filter(c=>c.command==='dispose').length, 1);
      h.infos[0].resolve({});
      await a;
      assert.strictEqual(v.loading(), false);
    });
    it('keeps reset/new-video loading owned by the latest request', async () => {
      const h = harness(file), v = h.create();
      await tick();
      const old = v.view.setInfo({id:'video A'});
      const reset = v.view.setInfo(null);
      const next = v.view.setInfo({id:'video B'});
      await tick();
      assert.strictEqual(h.infos[1].info, null);
      h.infos[0].resolve({});
      h.infos[1].resolve({});
      await Promise.all([old, reset]);
      assert.strictEqual(v.loading(), true);
      h.infos[2].resolve({});
      await next;
      assert.strictEqual(v.loading(), false);
    });
    it('keeps the successful B result even after an older request fails', async () => {
      const h = harness(file), v = h.create();
      await tick();
      const a = v.view.setInfo({id:'A'});
      const rejected = assert.rejects(a, /old error/);
      const b = v.view.setInfo({id:'B'});
      await tick();
      h.infos[1].resolve({});
      await b;
      h.infos[0].reject(new Error('old error'));
      await rejected;
      assert.strictEqual(v.loading(), false);
    });
  });
}