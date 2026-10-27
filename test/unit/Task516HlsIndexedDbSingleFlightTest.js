// Task516: HLS cache connection establishment must be single-flight.
// The HLS fragment cache is opt-in. All tests use synthetic IndexedDB requests;
// no real IndexedDB, network, user data, or browser profile is accessed.
'use strict';
const assert=require('assert');
const {loadClass,createContext}=require('../helpers/extractSource');
const VARIANTS=[
  ['source','src/_hls.js'],
  ['dev-dist','dist/ZenzaHLS.user.js']
];
function harness(file){
  const pending=[],opened=[],closed=[];
  let throwNext=null;
  let number=0;
  const connections=[];
  const ctx=createContext({
    indexedDB:{
      open(name,version){
        if(throwNext){
          const err=throwNext;throwNext=null;throw err;
        }
        const req={};
        opened.push({name,version,req});
        pending.push(req);
        return req;
      }
    }
  });
  const Cache=loadClass(file,'IndexDBStorage',ctx);
  const completeNext=()=>{
    const req=pending.shift();
    assert(req,'no uncompleted IndexedDB.open request');
    const id=++number;
    const store={};
    const db={
      id,
      close(){closed.push(id);},
      transaction(){return {objectStore:()=>store};}
    };
    connections.push(db);
    assert.equal(typeof req.onsuccess,'function');
    req.onsuccess({target:{result:db}});
    return db;
  };
  const failNext=(err=new Error('synthetic IDB open failure'))=>{
    const req=pending.shift();
    assert(req,'no uncompleted IndexedDB.open request');
    assert.equal(typeof req.onerror,'function');
    req.onerror(err);
    return err;
  };
  return {
    Cache,opened,pending,closed,connections,
    completeNext,failNext,
    get opens(){return opened.length;},
    failSynchronouslyOnce(error){throwNext=error;}
  };
}
for(const [variant,file] of VARIANTS){
  describe('Task516 HLS IndexedDB connection single-flight / '+variant,()=>{
    it('starts only one open for 25 simultaneous initialization attempts',async()=>{
      const h=harness(file);
      const calls=Array.from({length:25},()=>h.Cache.init());
      const observed=h.opens;
      for(const req of [...h.pending])h.completeNext();
      const databases=await Promise.all(calls);
      assert.equal(observed,1,'simultaneous callers should share one IDBOpenDBRequest');
      assert(databases.every(db=>db===databases[0]),
        'all callers must receive the identical connection');
      assert.equal(h.opened[0].name,'zenza_hls');
      assert.equal(h.opened[0].version,4);
    });
    it('single-flights 20 concurrent getStore() calls',async()=>{
      const h=harness(file),cache=new h.Cache();
      const calls=Array.from({length:20},()=>cache.getStore({mode:'readonly'}));
      const count=h.opens;
      for(const req of [...h.pending])h.completeNext();
      const results=await Promise.all(calls);
      assert.equal(count,1,'getStore callers must not open 20 connections');
      assert(results.every(result=>result.store===results[0].store));
    });
    it('reuses an opened connection until explicit close, then opens anew',async()=>{
      const h=harness(file);
      const first=h.Cache.init();const db1=h.completeNext();
      assert.strictEqual(await first,db1);
      assert.strictEqual(await h.Cache.init(),db1);
      assert.equal(h.opens,1);
      h.Cache.close();
      assert.deepStrictEqual(h.closed,[db1.id]);
      const reopened=h.Cache.init();const db2=h.completeNext();
      assert.strictEqual(await reopened,db2);
      assert.notStrictEqual(db2,db1);
      assert.equal(h.opens,2);
    });
    it('clears failed in-flight initialization to allow retry',async()=>{
      const h=harness(file);
      const calls=Array.from({length:5},()=>h.Cache.init());
      const started=h.opens;
      const expected=h.failNext();
      for(const req of [...h.pending])req.onerror(expected);
      await Promise.all(calls.map(p=>assert.rejects(p)));
      assert.equal(started,1,'failing concurrent opens should still be coalesced');
      const next=h.Cache.init();
      const fixed=h.completeNext();
      assert.strictEqual(await next,fixed);
      assert.equal(h.opens,2);
    });
    it('retries after indexedDB.open throws synchronously',async()=>{
      const h=harness(file);
      h.failSynchronouslyOnce(new Error('synthetic security restriction'));
      await assert.rejects(h.Cache.init(),/synthetic security restriction/);
      const next=h.Cache.init();
      const db=h.completeNext();
      assert.strictEqual(await next,db);
      assert.equal(h.opens,1);
    });
    it('retains a healthy cached DB even when multiple requests settle later',async()=>{
      const h=harness(file);
      const initial=h.Cache.init();
      const later=h.Cache.init();
      const db=h.completeNext();
      const [first,second]=await Promise.all([initial,later]);
      assert.strictEqual(first,db);
      assert.strictEqual(second,db);
      for(let i=0;i<10;i++){
        const current=await h.Cache.init();
        assert.strictEqual(current,db);
      }
      assert.equal(h.opens,1);
    });
  });
}
