// Task507: storyboard cache lookups/evictions must not retain their timeout
// timer when IndexedDB already answered. The actual two-second cutoff stays.
// Only synthetic timers, cache and Worker fixtures; no real network calls.
'use strict';
const assert = require('assert');
const {extract, run, createContext} = require('../helpers/extractSource');
const fixtures = [
  ['source', 'packages/lib/src/nico/VideoSessionWorker.js'],
  ['dev-dist', 'dist/ZenzaWatch-dev.user.js']
];
const goodCache = () => ({
  status:'ok', watchId:'sm9',format:'domand',duration:120,
  storyboard:{interval:10000,count:12,rows:2,columns:3,
    thumbnail:{width:160,height:90},
    images:[{url:'https://example.invalid/one.jpg',buffer:new ArrayBuffer(8)},
      {url:'https://example.invalid/two.jpg',buffer:new ArrayBuffer(8)}]}
});
function harness(path,{cache=null,pendingLookup=false,pendingDelete=false,
  failLookup=false,failDelete=false}={}) {
  const active=new Map(),cleared=[],created=[],posts=[],deletes=[],lookups=[];
  let next=0;
  const timers={
    set(fn,delay) {
      const id=++next;
      assert.equal(delay,2000,'keep the original two-second cache timeout');
      created.push({id,delay});
      active.set(id,fn);
      return id;
    },
    clear(id) {
      cleared.push(id);
      active.delete(id);
    },
    fireOne() {
      const first=active.entries().next().value;
      assert(first,'expected a pending timeout');
      active.delete(first[0]);
      first[1]();
    },
    get count() {return active.size;}
  };
  const h={
    timers,created,cleared,posts,deletes,lookups,
    async load() {return ctx.__storyboard.storyboard({
      type:'domand',info:{toJSON:()=>({watchId:'sm9',duration:120})}
    });}
  };
  const db={
    get(key) {
      lookups.push(key);
      if(failLookup)return Promise.reject(new Error('synthetic db unavailable'));
      if(pendingLookup)return new Promise(()=>{});
      return Promise.resolve(cache);
    },
    delete(key) {
      deletes.push(key);
      if(failDelete)return Promise.reject(new Error('synthetic delete failed'));
      if(pendingDelete)return new Promise(()=>{});
      return Promise.resolve();
    },
    async put() {return undefined;}
  };
  const ctx=createContext({
    setTimeout:(fn,delay)=>timers.set(fn,delay),
    clearTimeout:id=>timers.clear(id),
    StoryboardCacheDb:db,
    workerUtil:{createCrossMessageWorker:()=>({
      async post({command}) {
        posts.push(command);
        if(command==='storyboard')return {status:'fail',watchId:'sm9'};
        throw Error('unexpected post command');
      }
    })},
    URL,console:{warn(){},log(){},error(){}}
  });
  run('const createStoryboardClasses=' +
    extract(path,'createStoryboardClasses','var') + ';' +
    'const VideoSessionWorker=' + extract(path,'VideoSessionWorker','var') +
    ';globalThis.__storyboard=VideoSessionWorker;',ctx);
  return h;
}
async function flush() {
  for(let n=0;n<12;n++)await Promise.resolve();
}
for(const [variant,path] of fixtures) {
  describe('Task507 storyboard IndexedDB timer ownership / '+variant,()=>{
    it('releases the cache-read timer immediately on a valid cache hit',async()=>{
      const h=harness(path,{cache:goodCache()});
      const result=await h.load();
      assert.equal(result.fromCache,true);
      assert.deepStrictEqual(h.lookups,['sm9_domand']);
      assert.deepStrictEqual(h.posts,[]);
      assert.equal(h.created.length,1);
      assert.equal(h.timers.count,0,'no two-second timer after an immediate cache hit');
      assert.equal(h.cleared.length,1);
    });
    it('releases the timer on a normal cache miss and starts Worker request',async()=>{
      const h=harness(path);
      const result=await h.load();
      assert.equal(result.status,'fail');
      assert.deepStrictEqual(h.posts,['storyboard']);
      assert.equal(h.created.length,1);
      assert.equal(h.timers.count,0,'cache miss must cancel redundant timer');
      assert.equal(h.cleared.length,1);
    });
    it('releases both lookup and eviction timers for corrupted cache data',async()=>{
      const bad=goodCache();bad.watchId='smWRONG';
      const h=harness(path,{cache:bad});
      const result=await h.load();
      assert.equal(result.status,'fail');
      assert.deepStrictEqual(h.deletes,['sm9_domand']);
      assert.deepStrictEqual(h.posts,['storyboard']);
      assert.equal(h.created.length,2);
      assert.equal(h.timers.count,0,'read and cleanup timers must be cleared');
      assert.equal(h.cleared.length,2);
    });
    it('cleans up the timer after an IndexedDB rejection',async()=>{
      const h=harness(path,{failLookup:true});
      const result=await h.load();
      assert.equal(result.status,'fail');
      assert.deepStrictEqual(h.posts,['storyboard']);
      assert.equal(h.timers.count,0);
      assert.equal(h.cleared.length,1);
    });
    it('cleans up even when cache deletion itself rejects',async()=>{
      const bad=goodCache();bad.format='dmc';
      const h=harness(path,{cache:bad,failDelete:true});
      const result=await h.load();
      assert.equal(result.status,'fail');
      assert.deepStrictEqual(h.deletes,['sm9_domand']);
      assert.equal(h.timers.count,0);
      assert.equal(h.cleared.length,2);
    });
    it('preserves the real timeout path if cache lookup never settles',async()=>{
      const h=harness(path,{pendingLookup:true});
      const waiting=h.load();
      await flush();
      assert.equal(h.timers.count,1);
      h.timers.fireOne();
      const result=await waiting;
      assert.equal(result.status,'fail');
      assert.deepStrictEqual(h.posts,['storyboard']);
      assert.equal(h.timers.count,0);
    });
    it('preserves the timeout path when invalid-cache eviction hangs',async()=>{
      const bad=goodCache();bad.watchId='another';
      const h=harness(path,{cache:bad,pendingDelete:true});
      const waiting=h.load();
      await flush();
      assert.equal(h.timers.count,1,'only eviction timer remains after immediate read');
      h.timers.fireOne();
      const result=await waiting;
      assert.equal(result.status,'fail');
      assert.deepStrictEqual(h.deletes,['sm9_domand']);
      assert.deepStrictEqual(h.posts,['storyboard']);
      assert.equal(h.timers.count,0);
    });
  });
}
