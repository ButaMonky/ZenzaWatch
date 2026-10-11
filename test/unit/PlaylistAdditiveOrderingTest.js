'use strict';
const assert = require('assert');
const {createPlaylistContext} = require('../helpers/playlistHarness');
const {extract, run} = require('../helpers/extractSource');

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((res, rej) => {resolve = res; reject = rej;});
  return {promise, resolve, reject};
};
const tick = async () => {
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));
};
function fixture(path) {
  const h = createPlaylistContext();
  const P = path === 'packages/zenza/src/Playlist/PlayList.js' ?
    h.PlayList : run('(' + extract(path, 'PlayList', 'class') + ')', h.c);
  for (const key of ['SEARCH_LIMIT_DEFAULT', 'SEARCH_LIMIT_MIN','SEARCH_LIMIT_MAX']) {
    P[key] = h.PlayList[key];
  }
  const p = new P();
  p.initialize({loop: false, container: null, loader: {}});
  p.view = {scrollToItem() {}, scrollTop() {}, hasFocus: false};
  p.model.setItem([h.item('smSeed'), h.item('smTail')]);
  p.setIndex(0);
  h.c.console = {log() {}, warn() {}, error() {}, time() {}, timeEnd() {}};
  const jobs = [], updates = [];
  p._playlistApiLoader = {load: (descriptor, msgInfo) => {
    const pending = deferred();
    jobs.push({kind:'load', name:descriptor.id, msgInfo, ...pending});
    return pending.promise;
  }};
  p._nicoSearchApiLoader = {searchMore: (query, options, limit) => {
    const pending = deferred();
    jobs.push({kind:'search',name:query,options,limit,...pending});
    return pending.promise;
  }};
  p.on('update', () => updates.push('update'));
  const load = (id, options = {append: true}) =>
    p.load({type:'mylist',id},{watchId:'smSeed',...options},{});
  const search = (query, options = {append: true}) =>
    p.loadSearchVideo(query,{watchId:'smSeed',...options},100);
  const complete = (index, ids) => {
    const job = jobs[index];
    const content = ids.map(id => h.raw(id));
    if (job.kind === 'search') {
      job.resolve({list: content});
    } else {
      job.resolve(content);
    }
  };
  const ids = () => Array.from(p.model.items, item => item.watchId);
  const changeModel = rows => {
    const next = new h.PlayListModel({});
    next.setItem(rows.map(id => h.item(id)));
    p.model = next;
    return next;
  };
  return {h,p,jobs,updates,ids,load,search,complete,changeModel,tick};
}
for (const path of ['packages/zenza/src/Playlist/PlayList.js',
  'dist/ZenzaWatch-dev.user.js']) {
  describe('Task386 AUD-41 queued additive playlist commits '+path, function() {
    this.timeout(12000);
    it('keeps A then B append order despite B network resolving first', async () => {
      const f = fixture(path);
      const a = f.load('A'), b = f.load('B');
      f.complete(1,['smB1','smB2']);
      await tick();
      assert.deepStrictEqual(f.ids(),['smSeed','smTail'],
        'B result must wait for earlier A before mutating the playlist');
      f.complete(0,['smA1','smA2']);
      assert.strictEqual((await a).status,'ok');
      assert.strictEqual((await b).status,'ok');
      assert.deepStrictEqual(f.ids(),['smSeed','smTail','smA1','smA2','smB1','smB2']);
    });
    it('keeps explicit last-click-next insert order despite B first response', async () => {
      const f = fixture(path);
      const a = f.load('A',{insert:true}), b = f.load('B',{insert:true});
      f.complete(1,['smB1']);
      await tick();
      assert.deepStrictEqual(f.ids(),['smSeed','smTail']);
      f.complete(0,['smA1']);
      await Promise.all([a,b]);
      assert.deepStrictEqual(f.ids(),['smSeed','smB1','smA1','smTail'],
        'latest insert should be directly after active row');
    });
    it('keeps append order across mylist then search requests', async () => {
      const f = fixture(path);
      const a = f.load('A'), b = f.search('B');
      f.complete(1,['smB']);
      await tick();
      assert.deepStrictEqual(f.ids(),['smSeed','smTail']);
      f.complete(0,['smA']);
      await Promise.all([a,b]);
      assert.deepStrictEqual(f.ids(),['smSeed','smTail','smA','smB']);
    });
    it('keeps append order across search then mylist requests', async () => {
      const f = fixture(path);
      const a = f.search('A'), b = f.load('B');
      f.complete(1,['smB']);
      await tick();
      assert.deepStrictEqual(f.ids(),['smSeed','smTail']);
      f.complete(0,['smA']);
      await Promise.all([a,b]);
      assert.deepStrictEqual(f.ids(),['smSeed','smTail','smA','smB']);
    });
    it('preserves ordinary sequential add/insert without extra waiting',async()=>{
      const f=fixture(path);
      const a=f.load('A',{append:true});
      f.complete(0,['smA']);await a;
      const b=f.load('B',{insert:true});
      f.complete(1,['smB']);await b;
      assert.deepStrictEqual(f.ids(),['smSeed','smB','smTail','smA']);
    });
    it('releases B after A fails rather than deadlocking',async()=>{
      const f=fixture(path);
      const a=f.load('A',{append:true});
      const handledA=a.then(()=>null,e=>e);
      const b=f.load('B',{append:true});
      f.complete(1,['smB']);
      await tick();
      assert.deepStrictEqual(f.ids(),['smSeed','smTail']);
      f.jobs[0].reject(new Error('network-A'));
      assert.strictEqual((await handledA).message,'network-A');
      assert.strictEqual((await b).status,'ok');
      assert.deepStrictEqual(f.ids(),['smSeed','smTail','smB']);
    });
    it('keeps A mutation but propagates an actual B failure',async()=>{
      const f=fixture(path);
      const a=f.load('A',{append:true});
      const b=f.search('B',{append:true});
      const handledB=b.then(()=>null,e=>e);
      f.jobs[1].reject(new Error('network-B'));
      f.complete(0,['smA']);
      await a;
      assert.strictEqual((await handledB).message,'network-B');
      assert.deepStrictEqual(f.ids(),['smSeed','smTail','smA']);
    });
    it('does not let a late append enter the newer manually replaced list',async()=>{
      const f=fixture(path);
      const a=f.load('A',{append:true});
      f.p.replaceItems([f.h.raw('smManual')],{});
      f.complete(0,['smA']);
      assert.strictEqual((await a).status,'superseded');
      assert.deepStrictEqual(f.ids(),['smManual']);
    });
    it('drops late additive results after a model instance swap',async()=>{
      const f=fixture(path);
      const a=f.load('A',{insert:true});
      f.changeModel(['smOther']);
      f.complete(0,['smA']);
      assert.strictEqual((await a).status,'superseded');
      assert.deepStrictEqual(f.ids(),['smOther']);
    });
    it('preserves navigation validity checks for additive mode',async()=>{
      const f=fixture(path);
      let current=true;
      const a=f.p.load({type:'mylist',id:'A'},
        {watchId:'smSeed',append:true},{},()=>current);
      current=false;f.complete(0,['smA']);
      assert.strictEqual((await a).status,'superseded');
      assert.deepStrictEqual(f.ids(),['smSeed','smTail']);
    });
    it('lets a fresh append proceed after an old append was invalidated by replacement', async()=>{
      const f=fixture(path);
      const a=f.load('A',{append:true});
      const replaced=f.load('Replace',{});
      f.complete(1,['smReplace']);
      assert.strictEqual((await replaced).status,'ok');
      const c=f.load('C',{append:true});
      f.complete(2,['smC']);
      await tick();
      assert.deepStrictEqual(f.ids(),['smReplace','smC'],
        'new append should not be blocked behind an irrelevant old request');
      f.complete(0,['smA']);
      assert.strictEqual((await a).status,'superseded');
      assert.deepStrictEqual(f.ids(),['smReplace','smC']);
      await c;
    });
    it('preserves newest replacement result when old additive finishes late',async()=>{
      const f=fixture(path);
      const a=f.search('A',{insert:true});
      const r=f.search('Replace',{});
      f.complete(1,['smNew']);
      await r;
      f.complete(0,['smOld']);
      assert.strictEqual((await a).status,'superseded');
      assert.deepStrictEqual(f.ids(),['smNew']);
    });
  });
}
