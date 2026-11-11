'use strict';
const assert = require('assert');
const {controllerFixture, adapterFixture, gateFixture, ticks, quiet} =
  require('../helpers/idbRecoveryFixture');

const rows = () => new Map([
  ['sm101', {
    watchId: 'sm101', videoId: 'sm101', ownerId: 'user/42',
    updatedAt: 1234, postedAt: 123, watchCount: 7, threadInfo: {thread: 2},
    resume: [{now: 1, time: 52}], resumeOverride: 56, resumeClearedAt: 999,
    resumeClearReason: 'deleted', heatMap: [1, 2], comment: [{text: 'TEST_ONLY_COMMENT'}],
    videoInfo: {
      videoId: 'sm101', title: 'TEST_ONLY_TITLE', duration: 111,
      count: {comment: 5, view: 123, secretToken: 'TEST_ONLY_COUNT_SECRET'},
      owner: {name: 'TEST_ONLY_OWNER', id: 42, accessToken: 'demo1'},
      genre: {key: 'game', label: 'Game', signature: 'TEST_ONLY_GENRE_SECRET'},
      csrfToken: 'TEST_ONLY_CSRF', watchAuthKey: 'TEST_ONLY_WATCH_AUTH',
      playlistToken: 'TEST_ONLY_PLAYLIST',
      domandInfo: {accessRightKey: 'TEST_ONLY_DOMAND'},
      dmcInfo: {movie: {session: {signature: 'TEST_ONLY_DMC_SIG'}}}
    }
  }],
  ['sm102', {
    watchId: 'sm102', watchCount: 3, resume: [{now: 2, time: 5}],
    videoInfo: {videoId: 'sm102', title: 'already public', count: {view: 2}}
  }],
  ['sm103', {watchId: 'sm103', resume: [{now: 3, time: 12}], comment: ['TEST_ONLY_EXISTING'], videoInfo: null}]
]);

async function harness() {
  const records = rows();
  const h = controllerFixture({
    IDBKeyRange: {only: x => x, upperBound: x => x,
      lowerBound: (key, open) => ({key, open})}
  });
  await h.ready({transaction() {throw Error('transaction stub should be overridden');}});
  let updateCalls = 0;
  h.controller._write = async ({name, storeName}, operation) => {
    assert.strictEqual(name, 'watch-info');
    assert.strictEqual(storeName, 'cache');
    return new Promise((resolve, reject) => {
      let resultValue;
      const store = {
        openCursor(range) {
          const filtered = [...records.keys()].sort().filter(key =>
            !range || key > range.key);
          let index = 0;
          const request = {};
          const advance = () => queueMicrotask(() => {
            const key = filtered[index];
            if (!key) { request.result = null; request.onsuccess(); return; }
            request.result = {
              primaryKey: key, value: records.get(key),
              continue() { index++; advance(); },
              update(value) {
                updateCalls++;
                records.set(key, value);
                const response = {};
                queueMicrotask(() => response.onsuccess?.());
                return response;
              }
            };
            request.onsuccess();
          });
          advance();
          return request;
        }
      };
      try {
        operation(store, value => { resultValue = value; queueMicrotask(() => resolve(resultValue)); }, reject);
      } catch (error) { reject(error); }
    });
  };
  return {controller:h.controller, records, get updateCalls() {return updateCalls;}};
}

describe('AUD #286 old watch history privacy migration (synthetic only)', function() {
  it('recovers after repeated failures, rescans old-writer reinsertion, and stops on close',async function(){
    const timers=new Map(),warnings=[];let id=0,calls=0,secret=true,closed=false;
    const cache={update:async()=>({}),get:async()=>null,updateTime:async()=>null,
      delete:async()=>null,gc:async()=>null,close:async()=>{closed=true;},
      scrubWatchVideoInfo:async()=>{
        calls++;if(calls<=3)throw Error('TEST_ONLY_SECRET');
        const changed=secret?1:0;secret=false;return {scanned:1,changed,nextKey:null};
      }};
    const api=adapterFixture('WatchInfoCacheDb',cache,{
      setTimeout:(fn,ms)=>{timers.set(++id,{fn,ms});return id;},
      clearTimeout:key=>timers.delete(key),console:{...quiet,warn:message=>warnings.push(message)}
    });
    const facade=await api.open();
    const next=async()=>{const item=timers.entries().next().value;assert(item,'cleanup must remain scheduled');timers.delete(item[0]);item[1].fn();await ticks();return item[1].ms;};
    await next();await next();await next();await next();
    assert.equal(calls,4);assert.equal(secret,false);
    secret=true;const delay=await next();
    assert(delay>=60000,'successful scans must not continuously churn storage');
    assert.equal(secret,false,'an older writer is cleaned on the next sweep');
    assert(!JSON.stringify(warnings).includes('TEST_ONLY_SECRET'));
    await facade.close();assert(closed);assert.equal(timers.size,0);
    const reopened=await api.open();assert.equal(timers.size,1,'reopening restarts maintenance');
    secret=true;await next();assert.equal(secret,false);
    let release,opened=false;
    cache.close=()=>new Promise(resolve=>{release=resolve;});
    const closing=reopened.close(),opening=api.open().then(value=>{opened=true;return value;});
    await ticks();assert.equal(opened,false,'reopen waits for pending close');
    assert.equal(timers.size,0);
    release();await closing;await opening;
    assert.equal(timers.size,1);
    await facade.close();assert.equal(timers.size,1,'stale facade cannot stop the new owner');
  });
  it('preserves watch state while removing legacy videoInfo authentication fields', async function() {
    const h=await harness();
    const original=h.records.get('sm101');
    const saved={
      resume: original.resume, resumeOverride: original.resumeOverride,
      resumeClearedAt: original.resumeClearedAt, resumeClearReason: original.resumeClearReason,
      watchCount: original.watchCount, threadInfo: original.threadInfo,
      heatMap: original.heatMap, comment: original.comment, updatedAt: original.updatedAt
    };
    const first=await h.controller.scrubWatchVideoInfo({
      name:'watch-info', storeName:'cache', data:{afterKey:null,maxRecords:1}
    });
    assert.strictEqual(first.scanned,1);
    assert.strictEqual(first.changed,1);
    assert.strictEqual(first.nextKey,'sm101');
    const after=h.records.get('sm101');
    assert.strictEqual(after.videoInfo.title,'TEST_ONLY_TITLE');
    assert.deepStrictEqual(Object.keys(after.videoInfo).sort(),
      ['count','duration','genre','owner','title','videoId']);
    assert.deepStrictEqual(JSON.parse(JSON.stringify(after.videoInfo.count)),{comment:5,view:123});
    assert.deepStrictEqual(JSON.parse(JSON.stringify(after.videoInfo.owner)),{name:'TEST_ONLY_OWNER',id:42});
    assert.deepStrictEqual(JSON.parse(JSON.stringify(after.videoInfo.genre)),{key:'game',label:'Game'});
    for(const [name,value] of Object.entries(saved)) assert.deepStrictEqual(after[name],value,name);
    assert(!JSON.stringify(after.videoInfo).includes('TEST_ONLY_CSRF'));
    assert(!JSON.stringify(after.videoInfo).includes('TEST_ONLY_DMC_SIG'));
    assert(!JSON.stringify(after.videoInfo).includes('TEST_ONLY_DOMAND'));
    assert(!JSON.stringify(after.videoInfo).includes('demo1'));
    const second=await h.controller.scrubWatchVideoInfo({
      name:'watch-info',storeName:'cache',data:{afterKey:first.nextKey,maxRecords:2}
    });
    assert.strictEqual(second.scanned,2);
    assert.strictEqual(second.changed,0,'already public and null snapshots need no changes');
    assert.strictEqual(second.nextKey,'sm103');
    const last=await h.controller.scrubWatchVideoInfo({
      name:'watch-info',storeName:'cache',data:{afterKey:second.nextKey,maxRecords:2}
    });
    assert.strictEqual(last.nextKey,null);
    assert.strictEqual(h.records.get('sm103').videoInfo,null,'null remains null');
    assert.strictEqual(h.records.get('sm103').resume[0].time,12);
    const again=await h.controller.scrubWatchVideoInfo({
      name:'watch-info',storeName:'cache',data:{maxRecords:64}
    });
    assert.strictEqual(again.changed,0,'already sanitized entries are not rewritten');
    assert.strictEqual(h.updateCalls,1);
  });
  it('fails closed on foreign stores and invalid pagination without modifying history', async function() {
    const h=await harness();
    const original=JSON.stringify([...h.records]);
    for(const input of [
      {name:'other',storeName:'cache',data:{}},
      {name:'watch-info',storeName:'private',data:{}},
      {name:'watch-info',storeName:'cache',data:{maxRecords:1000}},
      {name:'watch-info',storeName:'cache',data:{afterKey:{token:'SECRET_SENTINEL'}}}
    ]) {
      await assert.rejects(h.controller.scrubWatchVideoInfo(input),/restricted|Invalid/);
    }
    assert.strictEqual(JSON.stringify([...h.records]),original);
  });
  it('does not block watch-cache startup and gives generic-only warnings on scrub failure',async function(){
    const logs=[];
    let requested=0;
    const cache={
      update:async request=>({watchId:request.key,...request.patch}),
      get:async()=>null, updateTime:async()=>null, delete:async()=>null,
      close:async()=>null,gc:async()=>null,
      scrubWatchVideoInfo:async()=>{requested++;throw Error('TEST_ONLY_SECRET_PRIVATE_VALUE');}
    };
    const api=adapterFixture('WatchInfoCacheDb',cache,{
      console:{...quiet,warn:(...a)=>logs.push(a)}
    });
    const facade=await api.open();
    const result=await facade.put('sm9',{currentTime:15});
    assert.strictEqual(result.watchId,'sm9');
    await new Promise(resolve=>setTimeout(resolve,1000));
    assert.strictEqual(requested,2,'one bounded retry');
    assert.strictEqual(logs.length,2);
    assert(!JSON.stringify(logs).includes('TEST_ONLY_SECRET_PRIVATE_VALUE'));
  });
  it('keeps bridge scrub restricted and returns only bounded cursor metadata',async function(){
    const calls=[];
    const bridge=gateFixture({open:async()=>({cache:{
      scrubWatchVideoInfo:async data=>{
        calls.push(data);
        return {scanned:1,changed:1,nextKey:null};
      }
    }})});
    await bridge.send({command:'open',params:{name:'watch-info',ver:2,stores:[{name:'cache'}]}});
    await bridge.send({command:'scrubWatchVideoInfo',params:{
      name:'watch-info',storeName:'cache',data:{afterKey:null,maxRecords:64}
    }});
    assert.strictEqual(calls.length,1);
    assert.deepStrictEqual(calls[0],{afterKey:null,maxRecords:64});
    assert.strictEqual(bridge.posts[1].body.status,'ok');
    assert.deepStrictEqual(JSON.parse(JSON.stringify(bridge.posts[1].body.params)),{scanned:1,changed:1,nextKey:null});
  });
});
