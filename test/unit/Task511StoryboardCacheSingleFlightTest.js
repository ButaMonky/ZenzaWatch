// Task511: concurrent storyboard cache callers share a single asynchronous
// IndexedDB/bridge initialization, one cache facade and one initial GC pass.
// Offline synthetic async mocks; no real browser data is read or modified.
'use strict';
const assert=require('assert');
const {extract,createContext,run}=require('../helpers/extractSource');
const SOURCE='packages/lib/src/nico/StoryboardCacheDb.js';
const VARIANTS=[['source',SOURCE],['dev-dist','dist/ZenzaWatch-dev.user.js']];
const good=()=>({status:'ok',watchId:'sm9',storyboard:{images:[]}});
function deferred(){
  let resolve,reject;
  const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});
  return {promise,resolve,reject};
}
function fixture({host='www.nicovideo.jp',delay=false,failFirst=false,source=SOURCE}={}){
  const calls={opens:0,bridges:0,gc:[],gets:[],writes:[],deletes:[],warn:[]};
  const pending=[];
  const store={
    async updateTime({key}) {calls.gets.push(key);return {sbInfo:good()};},
    async put(record) {calls.writes.push(record);return record;},
    async delete({key}) {calls.deletes.push(key);return undefined;},
    async gc(duration) {calls.gc.push(duration);return undefined;},
    close() {}
  };
  const backend={cache:store};
  const connect=kind=>{
    if(kind==='bridge')calls.bridges++;else calls.opens++;
    const total=calls.opens+calls.bridges;
    if(failFirst&&total===1)return Promise.reject(Error('synthetic db temporarily unavailable'));
    if(delay){
      const d=deferred();pending.push(d);
      return d.promise;
    }
    return Promise.resolve(backend);
  };
  const ctx=createContext({
    IndexedDbStorage:{open:async()=>connect('local')},
    location:{host},
    console:{warn:(...args)=>calls.warn.push(args),log(){},error(){}}
  });
  run('const StoryboardCacheDb='+extract(source,'StoryboardCacheDb','var')+
    ';globalThis.__cache=StoryboardCacheDb;',ctx);
  const db=ctx.__cache;
  if(host!=='www.nicovideo.jp'){
    db.api({bridgeDb:async()=>connect('bridge')});
  }
  return {
    db,calls,pending,backend,
    completeAll(){
      for(const d of pending.splice(0))d.resolve(backend);
    }
  };
}
const finish=async()=>{for(let i=0;i<14;i++)await Promise.resolve();};
for(const [variant,source] of VARIANTS){
describe('Task511 storyboard IndexedDB cache single-flight / '+variant,()=>{
  const f=options=>fixture({...options,source});
  it('coalesces simultaneous get/put/open into one database connection and GC',async()=>{
    const h=f({delay:true});
    const original=good();
    const a=h.db.get('sm9');
    const b=h.db.get('sm10');
    const c=h.db.put('sm11',original);
    const d=h.db.open();
    await finish();
    assert.equal(h.calls.opens,1,'only one IndexedDB.open must be in flight');
    assert.equal(h.pending.length,1);
    h.completeAll();
    const [first,second,record,facade]=await Promise.all([a,b,c,d]);
    assert.equal(first.status,'ok');
    assert.equal(second.status,'ok');
    assert.strictEqual(record.sbInfo,original);
    assert.deepStrictEqual(h.calls.gets,['sm9','sm10']);
    assert.deepStrictEqual(h.calls.writes.map(x=>x.watchId),['sm11']);
    assert.deepStrictEqual(h.calls.gc,[7*24*60*60*1000],
      'only one initial garbage collection may be scheduled');
    assert.strictEqual(await h.db.open(),facade);
    assert.equal(h.calls.opens,1);
  });
  it('coalesces direct initWorker calls and concurrent open',async()=>{
    const h=f({delay:true});
    const first=h.db.initWorker();
    const second=h.db.initWorker();
    const opening=h.db.open();
    await finish();
    assert.equal(h.calls.opens,1);
    assert.equal(h.pending.length,1);
    h.completeAll();
    const [a,b,facade]=await Promise.all([first,second,opening]);
    assert.strictEqual(a,h.backend);
    assert.strictEqual(b,h.backend);
    assert.equal(typeof facade.get,'function');
    assert.deepStrictEqual(h.calls.gc,[7*24*60*60*1000]);
  });
  it('retries after the first connection open rejects instead of poisoning future calls',async()=>{
    const h=f({failFirst:true});
    await assert.rejects(h.db.get('sm9'),/synthetic db temporarily unavailable/);
    assert.equal(h.calls.opens,1);
    const result=await h.db.get('sm9');
    assert.equal(result.status,'ok');
    assert.equal(h.calls.opens,2,'the failed pending connection was released');
    assert.equal(h.calls.gc.length,1);
  });
  it('returns the same facade when simultaneous callers first hit a completed init',async()=>{
    const h=f();
    const p1=h.db.open(),p2=h.db.open(),p3=h.db.open();
    const [a,b,c]=await Promise.all([p1,p2,p3]);
    assert.strictEqual(a,b);
    assert.strictEqual(b,c);
    assert.equal(h.calls.opens,1);
    assert.equal(h.calls.gc.length,1);
    assert.strictEqual(await h.db.open(),a);
  });
  it('single-flights a bridged cache connection from an embedded domain',async()=>{
    const h=f({host:'ext.nicovideo.jp',delay:true});
    const a=h.db.get('sm9');
    const b=h.db.open();
    await finish();
    assert.equal(h.calls.bridges,1);
    assert.equal(h.calls.opens,0);
    h.completeAll();
    assert.equal((await a).status,'ok');
    assert.equal(typeof (await b).get,'function');
    assert.equal(h.calls.gc.length,1);
  });
  it('does not duplicate initialization when put/delete/gc overlap',async()=>{
    const h=f({delay:true});
    const a=h.db.put('sm1',good());
    const b=h.db.delete('sm2');
    const c=h.db.gc(1234);
    await finish();
    assert.equal(h.calls.opens,1);
    h.completeAll();
    await Promise.all([a,b,c]);
    assert.deepStrictEqual(h.calls.deletes,['sm2']);
    assert.deepStrictEqual(h.calls.gc,[7*24*60*60*1000,1234]);
    assert.equal(h.calls.opens,1);
  });
});
}
