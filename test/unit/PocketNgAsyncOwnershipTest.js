'use strict';
const assert = require('assert');
const {extract, createContext, run} = require('../helpers/extractSource');
const paths = ['src/_pocket.js', 'dist/MylistPocket.user.js'];
const flush = async () => {
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));
};
function fixture(path, callback) {
  let onInview;
  const queue = [], classes = new Set(), attributes = {}, errors = [];
  let current = true, checked = 0, called = 0;
  const ngConfig = {props: {enable: true}};
  const checker = {isNg(info) {checked++; return !!info.ng;}};
  const favChecker = {isMatch: () => false};
  const ctx = createContext({
    window: {IntersectionObserver: class {}},
    console: {error: (...args) => errors.push(args), warn() {}},
    initIntersectionObserver: cb => {
      onInview = cb; return {disconnect() {}};
    },
    initNgDom: () => () => {},
    initNgConfig: () => ({ngConfig, favConfig: {props: {}}}),
    initNgChecker: () => ({ngChecker: checker, favChecker}),
    QueueLoader: {
      load(id, node, isCancelled) {
        let resolve, reject;
        const promise = new Promise((yes, no) => {resolve = yes; reject = no;});
        queue.push({id, node, isCancelled, resolve, reject});
        return promise;
      }
    }
  });
  const context = {ngConfig, favConfig: {props: {}},
    checkers: {ngChecker: checker, favChecker}};
  run('globalThis.initNg=' + extract(path, 'initNg', 'var'), ctx);
  const node = {
    dataset: {videoId: 'sm1'},
    href: 'https://www.nicovideo.jp/watch/sm1',
    querySelector: () => null,
    querySelectorAll: () => [],
    getAttribute: k => attributes[k],
    setAttribute(k, value) {attributes[k] = value;},
    classList: {
      add: (...xs) => xs.forEach(x => classes.add(x)),
      remove: (...xs) => xs.forEach(x => classes.delete(x)),
      toggle: (x, value) => value ? classes.add(x) : classes.delete(x),
      contains: x => classes.has(x)
    }
  };
  return {
    start: () => ctx.initNg({query: '.video', container: {}, callback},
      () => current, context),
    inview: id => onInview(node, id),
    node, queue, classes, attributes, errors,
    checked: () => checked,
    off: () => {current = false; ngConfig.props.enable = false;},
    on: () => {current = true; ngConfig.props.enable = true;},
    result: (id, ng) => ({status: 'ok', watchId: id,
      id, title: 'title:' + id, thumbnail: id + '.jpg',
      owner: {type: 'user', id: 1}, ng})
  };
}
for (const path of paths) {
  describe('AUD-19 per-card asynchronous NG ownership ' + path, () => {
    it('preserves the newer B result when old A completes last', async () => {
      const f = fixture(path);
      await f.start();
      f.inview('smA'); f.inview('smB');
      assert.strictEqual(f.queue.length, 2);
      assert.strictEqual(f.queue[0].isCancelled(), true,
        'the old same-card request should be cancelled');
      f.queue[1].resolve(f.result('smB', true));
      await flush();
      assert.strictEqual(f.node.dataset.title, 'title:smB');
      f.queue[0].resolve(f.result('smA', false));
      await flush();
      assert.strictEqual(f.node.dataset.title, 'title:smB');
      assert.strictEqual(f.classes.has('is-ng-rejected'), true);
      assert.strictEqual(f.classes.has('is-ng-resolved'), false);
    });
    it('does not remove a newer loading marker on older failure', async () => {
      const f = fixture(path);
      await f.start();
      f.inview('smA'); f.inview('smB');
      f.classes.add('is-ng-current');
      f.queue[0].reject(new Error('old-network-error'));
      await flush();
      assert.strictEqual(f.classes.has('is-ng-current'), true);
      assert.strictEqual(f.classes.has('is-ng-failed'), false);
      f.queue[1].resolve(f.result('smB', false));
      await flush();
      assert.strictEqual(f.classes.has('is-ng-current'), false);
      assert.strictEqual(f.classes.has('is-ng-resolved'), true);
    });
    it('treats an Error value as failure without running NG checker', async () => {
      const f = fixture(path);
      await f.start();
      f.inview('smX');
      f.queue[0].resolve(new Error('network-down'));
      await flush();
      assert.strictEqual(f.checked(), 0);
      assert.strictEqual(f.classes.has('is-ng-failed'), true);
      assert.strictEqual(f.classes.has('is-ng-resolved'), false);
      assert.strictEqual(f.classes.has('is-ng-rejected'), false);
    });
    it('clears stale resolved/rejected classes on a newer error', async () => {
      const f = fixture(path);
      await f.start();
      f.inview('smA');
      f.queue[0].resolve(f.result('smA', true));
      await flush();
      assert.strictEqual(f.classes.has('is-ng-rejected'), true);
      f.inview('smB');
      f.queue[1].resolve(new Error('service-failed'));
      await flush();
      assert.strictEqual(f.classes.has('is-ng-failed'), true);
      assert.strictEqual(f.classes.has('is-ng-rejected'), false);
      assert.strictEqual(f.classes.has('is-ng-resolved'), false);
    });
    it('rejects a malformed success record missing its owner', async () => {
      const f = fixture(path);
      await f.start();
      f.inview('smA');
      f.queue[0].resolve({status: 'ok', watchId: 'smA', title: 'not-complete'});
      await flush();
      assert.strictEqual(f.checked(), 0);
      assert.strictEqual(f.classes.has('is-ng-failed'), true);
    });
  });
}
