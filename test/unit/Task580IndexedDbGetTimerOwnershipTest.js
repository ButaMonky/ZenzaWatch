// Task580: IndexedDbStorage.get must release settled read timers and never
// include private storage keys in timeout exceptions (source and generated JS).
// Synthetic IndexedDB fixture only; no actual user data or network calls.
'use strict';
const assert = require('assert');
const {extract,createContext,run,eventTarget,ticks} = require('../helpers/idbRecoveryFixture');

const VARIANTS = [
  ['source', 'packages/lib/src/infra/IndexedDbStorage.js'],
  ['dev-dist', 'dist/ZenzaWatch-dev.user.js'],
  ['MylistPocket-dist', 'dist/MylistPocket.user.js']
];
const SECRET_KEY = 'SYNTHETIC_PRIVATE_STORED_KEY_DO_NOT_LOG';

function fixture(file, {throwGet = false} = {}) {
  const timers = new Map();
  const clears = [], schedules = [], opens = [], gets = [];
  let timerId = 0;
  const ctx = createContext({
    setTimeout(fn, ms) {
      const id = ++timerId;
      schedules.push({id, ms});
      timers.set(id, fn);
      return id;
    },
    clearTimeout(id) {
      clears.push(id);
      timers.delete(id);
    },
    indexedDB: {
      open() {
        const req = eventTarget();
        opens.push(req);
        return req;
      }
    }
  });
  run('globalThis.__controller=(' + extract(file,'workerFunc','var') + ')(self);',ctx);
  const controller = ctx.__controller;
  let connection;
  async function ready() {
    const initial = controller.init({name:'fixture',ver:1,stores:[]});
    assert.equal(opens.length,1);
    connection={
      version:1,
      close() {},
      transaction() {
        const store={
          get(key) {
            if(throwGet)throw Error('synthetic get failed synchronously');
            const request=eventTarget();
            gets.push({key,request,index:undefined});
            return request;
          },
          index(indexName) {
            return {
              get(key) {
                if(throwGet)throw Error('synthetic index get failed');
                const request=eventTarget();
                gets.push({key,request,index:indexName});
                return request;
              }
            };
          }
        };
        return {objectStore:()=>store};
      }
    };
    opens[0].result=connection;
    opens[0].fire('success');
    await initial;
    assert.equal(timers.size,0,'IndexedDbStorage.init cleared its own 30s open timeout');
    return controller;
  }
  function begin({key=SECRET_KEY,index,timeout=2000}={}) {
    return controller.get({
      name:'fixture',storeName:'cache',data:{key,index,timeout}
    });
  }
  async function waitRequest() {
    await ticks();
    assert(gets.length>0,'expected IndexedDB request after ready connection');
    return gets[gets.length-1].request;
  }
  function fireTimeout() {
    assert.equal(timers.size,1);
    const [id,fn]=[...timers.entries()][0];
    timers.delete(id);
    fn();
  }
  return {controller,ctx,ready,begin,waitRequest,fireTimeout,
    timers,clears,schedules,opens,gets};
}

for (const [variant,file] of VARIANTS) {
  describe('Task580 IndexedDbStorage.get timeout cleanup / '+variant,()=>{
    it('clears the timer on successful direct get without changing record value',async()=>{
      const f=fixture(file);await f.ready();
      const pending=f.begin();
      const req=await f.waitRequest();
      assert.equal(f.timers.size,1);
      assert.equal(f.schedules.at(-1).ms,2000);
      const record={watchId:'sm9',cached:true};
      req.result=record;
      req.fire('success');
      assert.strictEqual(await pending,record);
      assert.equal(f.timers.size,0,'completed request left an active timer');
      assert.strictEqual(req.onsuccess,null,'detach the old success callback');
      assert.strictEqual(req.onerror,null,'detach the old error callback');
    });
    it('clears timer when an index get succeeds, preserving index selection',async()=>{
      const f=fixture(file);await f.ready();
      const pending=f.begin({index:'updatedAt'});
      const req=await f.waitRequest();
      req.result='indexed';
      req.fire('success');
      assert.strictEqual(await pending,'indexed');
      assert.equal(f.gets[0].index,'updatedAt');
      assert.equal(f.timers.size,0);
    });
    it('clears timer on failed get and propagates original request error',async()=>{
      const f=fixture(file);await f.ready();
      const pending=f.begin();
      const req=await f.waitRequest();
      const fault=Error('synthetic IndexedDB request error');
      req.fire('error',{marker:fault});
      await assert.rejects(pending,e=>e.marker===fault);
      assert.equal(f.timers.size,0);
      assert.strictEqual(req.onerror,null);
      assert.strictEqual(req.onsuccess,null);
    });
    it('still times out a genuinely stalled read, without exposing its key',async()=>{
      const f=fixture(file);await f.ready();
      const pending=f.begin();
      const req=await f.waitRequest();
      assert.equal(f.timers.size,1);
      f.fireTimeout();
      await assert.rejects(pending,e=>{
        const text=String(e && e.message ? e.message : e);
        assert(/timed? out|timeout/i.test(text),'preserve timeout classification');
        assert(!text.includes(SECRET_KEY),'never expose cache key in an error');
        return true;
      });
      assert.equal(f.timers.size,0);
      assert.strictEqual(req.onsuccess,null);
      assert.strictEqual(req.onerror,null);
      req.result={late:true};
      assert.doesNotThrow(()=>req.fire('success'));
    });
    it('a missing timeout must not allocate timers',async()=>{
      const f=fixture(file);await f.ready();
      const pending=f.begin({timeout:0});
      const req=await f.waitRequest();
      assert.equal(f.timers.size,0);
      req.result='no-timer';
      req.fire('success');
      assert.equal(await pending,'no-timer');
    });
    it('100 consecutive successful reads leave no timer callbacks',async()=>{
      const f=fixture(file);await f.ready();
      for(let i=0;i<100;i++){
        const pending=f.begin({key:'item'+i,timeout:4000});
        const req=await f.waitRequest();
        req.result=i;
        req.fire('success');
        assert.equal(await pending,i);
      }
      assert.equal(f.gets.length,100);
      assert.equal(f.timers.size,0,'stale timer callbacks grow with every read');
    });
    it('clearing one request cannot cancel a different concurrent read',async()=>{
      const f=fixture(file);await f.ready();
      const a=f.begin({key:'A',timeout:1111});
      const b=f.begin({key:'B',timeout:2222});
      await ticks();
      assert.equal(f.gets.length,2);
      assert.equal(f.timers.size,2);
      const x=f.gets[0].request, y=f.gets[1].request;
      x.result=1;x.fire('success');
      assert.equal(await a,1);
      assert.equal(f.timers.size,1,'other request timer must remain armed');
      y.result=2;y.fire('success');
      assert.equal(await b,2);
      assert.equal(f.timers.size,0);
    });
    it('synchronous store.get exceptions do not create timeout handles',async()=>{
      const f=fixture(file,{throwGet:true});await f.ready();
      await assert.rejects(f.begin(),/synthetic get failed synchronously/);
      assert.equal(f.timers.size,0);
    });
  });
}
