'use strict';

const assert = require('assert');
const {extract, createContext, run} = require('../helpers/extractSource');

function loadVideoList(rel = 'packages/zenza/src/Playlist/VideoList.js') {
  class Emitter {}
  const context = createContext({Emitter});
  run(
    `${extract(rel, 'VideoList')}; globalThis.Subject = VideoList;`,
    context
  );
  return context.Subject;
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return {promise, resolve, reject};
}

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
}

function makeHarness(VideoList, initialItem) {
  const request = deferred();
  const list = Object.create(VideoList.prototype);
  let current = initialItem;

  list._isAdDecorationEnabled = true;
  list._adDecorationRequested = new Set();
  list._adDecorationLoader = {
    load(watchIds) {
      assert.deepStrictEqual(Array.from(watchIds), [initialItem.watchId]);
      return request.promise;
    }
  };
  list.model = {
    items: [initialItem],
    findByWatchId(watchId) {
      return current && current.watchId === watchId ? current : undefined;
    }
  };

  return {
    list,
    request,
    setCurrent(item) {
      current = item;
      list.model.items = item ? [item] : [];
    }
  };
}

describe('Task258 ad decoration item ownership', () => {
  it('applies a completed request to the current item with the same watchId', async () => {
    const VideoList = loadVideoList();
    const oldItem = {watchId: 'sm1', adDecoration: null};
    const newItem = {watchId: 'sm1', adDecoration: null};
    const {list, request, setCurrent} = makeHarness(VideoList, oldItem);

    list._onAdDecorationCheck();
    setCurrent(newItem);
    request.resolve(new Map([['sm1', 'gold']]));
    await flush();

    assert.strictEqual(newItem.adDecoration, 'gold');
    assert.strictEqual(oldItem.adDecoration, null);
    assert.strictEqual(list._adDecorationRequested.has('sm1'), false);
  });

  it('does not mutate a detached item when the watchId no longer exists', async () => {
    const VideoList = loadVideoList();
    const oldItem = {watchId: 'sm2', adDecoration: null};
    const {list, request, setCurrent} = makeHarness(VideoList, oldItem);

    list._onAdDecorationCheck();
    setCurrent(null);
    request.resolve(new Map([['sm2', 'silver']]));
    await flush();

    assert.strictEqual(oldItem.adDecoration, null);
    assert.strictEqual(list._adDecorationRequested.has('sm2'), false);
  });

  it('keeps the ordinary same-item success path unchanged', async () => {
    const VideoList = loadVideoList();
    const item = {watchId: 'sm3', adDecoration: null};
    const {list, request} = makeHarness(VideoList, item);

    list._onAdDecorationCheck();
    request.resolve(new Map([['sm3', 'gold']]));
    await flush();

    assert.strictEqual(item.adDecoration, 'gold');
    assert.strictEqual(list._adDecorationRequested.has('sm3'), false);
  });

  it('keeps generated dev dist current-item ownership in parity with source', async () => {
    const VideoList = loadVideoList('dist/ZenzaWatch-dev.user.js');
    const oldItem = {watchId: 'sm4', adDecoration: null};
    const newItem = {watchId: 'sm4', adDecoration: null};
    const {list, request, setCurrent} = makeHarness(VideoList, oldItem);

    list._onAdDecorationCheck();
    setCurrent(newItem);
    request.resolve(new Map([['sm4', 'silver']]));
    await flush();

    assert.strictEqual(newItem.adDecoration, 'silver');
    assert.strictEqual(oldItem.adDecoration, null);
    assert.strictEqual(list._adDecorationRequested.has('sm4'), false);
  });
});
