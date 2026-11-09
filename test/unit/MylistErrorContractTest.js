'use strict';

const assert = require('assert');
const {beginSection, read, createContext, run} = require('../helpers/extractSource');

function loadLoader(rel = 'packages/lib/src/nico/MylistApiLoader.js') {
  class CacheStorage {
    constructor() { this.map = new Map(); }
    getItem(key) { return this.map.get(key); }
    setItem(key, value) { this.map.set(key, value); }
    removeItem(key) { this.map.delete(key); }
  }
  class Emitter {
    on() {}
    emitAsync() {}
  }
  const fetches = [];
  const netUtil = {
    fetch: async (...args) => {
      fetches.push(args);
      throw new Error('fetch not stubbed');
    }
  };
  const context = createContext({
    CacheStorage,
    Emitter,
    emitter: new Emitter(),
    netUtil,
    sessionStorage: {},
    DOMParser: class {},
    window: {ZenzaWatch: null},
    console: {log() {}, warn() {}, error() {}}
  });

  if (rel === 'packages/lib/src/nico/MylistApiLoader.js') {
    run(beginSection(rel) + ';globalThis.Subject=MylistApiLoader;', context);
  } else {
    const text = read(rel);
    const start = text.indexOf('const MylistApiLoader = (() => {');
    let end = text.indexOf('\nconst NicoRssLoader =', start);
    if (start >= 0 && end < 0) {
      const close = text.indexOf('\n})();', start);
      if (close >= 0) {
        end = close + '\n})();'.length;
      }
    }
    if (start < 0 || end < 0) {
      throw new Error('generated MylistApiLoader block not found');
    }
    run(text.slice(start, end) + ';globalThis.Subject=MylistApiLoader;', context);
  }
  return {loader: context.Subject, netUtil, fetches};
}

function response(json) {
  return {json: async () => json};
}

describe('Task264 Mylist/Watch-Later error contract', () => {
  it('distinguishes watch-later not-found from list retrieval failure', async () => {
    const {loader} = loadLoader();

    loader._getDeflistItems = async () => [];
    await assert.rejects(
      () => loader.findDeflistItemByWatchId('sm404'),
      err => err && err.code === 'NOT_FOUND' && err.status === 'not_found'
    );

    const retrieval = Object.assign(new Error('network down'), {
      status: 'fail',
      code: 'NETWORK',
      result: {stage: 'watch-later-list'}
    });
    loader._getDeflistItems = async () => { throw retrieval; };
    await assert.rejects(
      () => loader.findDeflistItemByWatchId('sm404'),
      err => err === retrieval
    );
  });

  it('distinguishes mylist not-found from list retrieval failure', async () => {
    const {loader} = loadLoader();

    loader._getMylistItems = async () => [];
    await assert.rejects(
      () => loader.findMylistItemByWatchId('sm404', 7),
      err => err && err.code === 'NOT_FOUND' && err.status === 'not_found'
    );

    const retrieval = Object.assign(new Error('mylist network down'), {
      status: 'fail',
      code: 'NETWORK',
      result: {stage: 'mylist-items'}
    });
    loader._getMylistItems = async () => { throw retrieval; };
    await assert.rejects(
      () => loader.findMylistItemByWatchId('sm404', 7),
      err => err === retrieval
    );
  });

  it('preserves status/result/code when watch-later removal API fails', async () => {
    const {loader, netUtil} = loadLoader();
    loader.findDeflistItemByWatchId = async () => ({watchId: 'sm1', itemId: 10});
    const result = {
      meta: {status: 400},
      error: {description: 'remove denied', code: 'REMOVE_DENIED'}
    };
    netUtil.fetch = async () => response(result);

    await assert.rejects(
      () => loader.removeDeflistItem('sm1'),
      err => err &&
        err.message === 'remove denied' &&
        err.status === 'fail' &&
        err.result === result &&
        err.code === 'REMOVE_DENIED'
    );
  });

  for (const file of ['packages/lib/src/nico/MylistApiLoader.js',
    'dist/ZenzaWatch-dev.user.js', 'dist/MylistPocket.user.js']) {
    it('audit #240 does not DELETE an already saved watch-later entry ('+file+')', async()=>{
      const {loader,netUtil,fetches}=loadLoader(file);
      const conflict={meta:{status:409},error:{description:'exists',code:'CONFLICT'}};
      let deletes=0;
      loader.removeDeflistItem=async()=>{deletes++;throw Error('must not delete');};
      netUtil.fetch=async (...args)=>{fetches.push(args);return response(conflict);};
      const out=await loader.addDeflistItem('sm1','keep');
      assert.strictEqual(out.status,'ok');
      assert.match(out.message,/登録済み/);
      assert.strictEqual(out.result,conflict);
      assert.strictEqual(deletes,0);
      assert.strictEqual(fetches.length,1);
      assert.strictEqual(fetches[0][1].method,'POST');
    });
  }

  it('keeps ordinary watch-later add success unchanged', async () => {
    const {loader, netUtil} = loadLoader();
    const result = {meta: {status: 201}, data: {ok: true}};
    netUtil.fetch = async () => response(result);

    const out = await loader.addDeflistItem('sm1', 'memo');

    assert.strictEqual(out.status, 'ok');
    assert.strictEqual(out.message, 'あとで見る登録');
    assert.strictEqual(out.result, result);
  });

  it('uses the resolved mylist itemId for DELETE instead of the watchId', async () => {
    const {loader, netUtil, fetches} = loadLoader();
    loader.findMylistItemByWatchId = async () => ({watchId: 'sm999', itemId: 123});
    netUtil.fetch = async (...args) => {
      fetches.push(args);
      return response({meta: {status: 200}});
    };

    await loader.removeMylistItem('sm999', 7);

    assert.strictEqual(fetches.length, 1);
    assert.match(fetches[0][0], /\/mylists\/7\/items\?itemIds=123$/);
    assert.ok(!fetches[0][0].includes('itemIds=sm999'));
  });

  it('keeps generated dev dist mylist DELETE itemId behavior in parity', async () => {
    const {loader, netUtil, fetches} = loadLoader('dist/ZenzaWatch-dev.user.js');
    loader.findMylistItemByWatchId = async () => ({watchId: 'sm999', itemId: 123});
    netUtil.fetch = async (...args) => {
      fetches.push(args);
      return response({meta: {status: 200}});
    };

    await loader.removeMylistItem('sm999', 7);

    assert.strictEqual(fetches.length, 1);
    assert.match(fetches[0][0], /\/mylists\/7\/items\?itemIds=123$/);
    assert.ok(!fetches[0][0].includes('itemIds=sm999'));
  });

  it('keeps MylistPocket dist mylist DELETE itemId behavior in parity', async () => {
    const {loader, netUtil, fetches} = loadLoader('dist/MylistPocket.user.js');
    loader.findMylistItemByWatchId = async () => ({watchId: 'sm999', itemId: 123});
    netUtil.fetch = async (...args) => {
      fetches.push(args);
      return response({meta: {status: 200}});
    };

    await loader.removeMylistItem('sm999', 7);

    assert.strictEqual(fetches.length, 1);
    assert.match(fetches[0][0], /\/mylists\/7\/items\?itemIds=123$/);
    assert.ok(!fetches[0][0].includes('itemIds=sm999'));
  });

  it('keeps generated dev dist not-found/retrieval error behavior in parity', async () => {
    const {loader} = loadLoader('dist/ZenzaWatch-dev.user.js');

    loader._getDeflistItems = async () => [];
    await assert.rejects(
      () => loader.findDeflistItemByWatchId('sm404'),
      err => err && err.code === 'NOT_FOUND' && err.status === 'not_found'
    );

    const retrieval = Object.assign(new Error('dist network down'), {
      status: 'fail',
      code: 'NETWORK'
    });
    loader._getDeflistItems = async () => { throw retrieval; };
    await assert.rejects(
      () => loader.findDeflistItemByWatchId('sm404'),
      err => err === retrieval
    );
  });
});
