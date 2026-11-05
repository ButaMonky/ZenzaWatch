import test from 'node:test';
import assert from 'node:assert/strict';
import {ManualBookmarkRepository,IndexedDbManualBookmarkBackend}
  from '../p12-src/ManualBookmarkStore.ts';

const videoId='sm9',duration=300;
const draft=(id,time,now=100)=>({id,videoId,time,now,label:'??????'});
class AtomicFakeBackend{
 constructor(){this.rows=new Map();this.queue=Promise.resolve();this.closed=false;this.fail=false;}
 async read(id){if(this.fail)throw Error('local disk read failed');return this.rows.get(id)??[];}
 update(id,change){
  const attempt=this.queue.then(async()=>{
   if(this.fail)throw Error('local disk write failed');
   const previous=this.rows.get(id)??[];
   // callback is evaluated at commit time, not from a stale snapshot.
   const next=change(previous);
   await Promise.resolve();
   this.rows.set(id,next);
  });
  this.queue=attempt.catch(()=>{});
  return attempt;
 }
 close(){this.closed=true;}
}
function makeFakeIndexedDB({deferOpen=false}={}){
 const records=new Map(),pending=[],opens=[],requests=[];
 const db={
  objectStoreNames:{contains:name=>name==='bookmarks'},
  createObjectStore(){throw Error('should not upgrade an existing test store');},
  close(){db.closed=true;},
  transaction(name,mode){
   assert.equal(name,'bookmarks');
   const tx={mode,read:null,proposed:null,oncomplete:null,onabort:null,onerror:null};
   tx.objectStore=()=>({
    get(key){tx.key=key;const req={result:undefined,onsuccess:null,onerror:null};tx.read=req;return req;},
    put(row){tx.proposed=row;return {onerror:null};}
   });
   tx.abort=()=>tx.onabort?.();
   pending.push(tx);
   return tx;
  }
 };
 const factory={open(name,version){
  opens.push([name,version]);
  const req={onupgradeneeded:null,onsuccess:null,onerror:null,onblocked:null,result:db};
  requests.push(req);
  if(!deferOpen)queueMicrotask(()=>req.onsuccess?.());
  return req;
 }};
 return {factory,pending,opens,requests,records,db,
  fireRead(tx){assert(tx?.read);tx.read.result=records.get(tx.key);tx.read.onsuccess?.();},
  commit(tx){if(tx.proposed)records.set(tx.key,tx.proposed);tx.oncomplete?.();}
 };
}
const tick=async()=>{for(let i=0;i<15;i++)await Promise.resolve();};
test('manual bookmark CRUD remains separate and survives automatic resume clearing',async()=>{
 const b=new AtomicFakeBackend(),repo=new ManualBookmarkRepository(b);
 await repo.add(draft('B1',68),duration);
 await repo.add(draft('B2',80,200),duration);
 const prior=await repo.load(videoId,duration);
 assert.equal(prior.length,2);
 const unrelatedAutoResume={resume:[],resumeClearedAt:300,reason:'completed'};
 assert.equal(unrelatedAutoResume.resume.length,0);
 assert.deepEqual((await repo.load(videoId,duration)).map(x=>x.id),['B1','B2']);
 await repo.rename(videoId,'B1','??',500,duration);
 const result=await repo.remove(videoId,'B2',duration);
 assert.deepEqual(result.map(x=>[x.id,x.label]),[['B1','??']]);
 assert.equal(prior[0].label,'??????','frozen previous values remain untouched');
 repo.close();assert.equal(b.closed,true);
});
test('two concurrent adds serialize atomic writes, losing no bookmark',async()=>{
 const b=new AtomicFakeBackend(),repo=new ManualBookmarkRepository(b);
 await Promise.all([repo.add(draft('B1',40),duration),
   repo.add(draft('B2',55,101),duration)]);
 assert.deepEqual((await repo.load(videoId,duration)).map(x=>x.id),['B1','B2']);
});
test('duplicate ID rejection does not corrupt a previous committed manual record',async()=>{
 const b=new AtomicFakeBackend(),repo=new ManualBookmarkRepository(b);
 await repo.add(draft('B1',60),duration);
 await assert.rejects(repo.add(draft('B1',80),duration),/Duplicate/);
 assert.equal((await repo.load(videoId,duration))[0].time,60);
});
test('corrupt or different-video stored data fails closed without a destructive update',async()=>{
 const b=new AtomicFakeBackend(),repo=new ManualBookmarkRepository(b);
 b.rows.set(videoId,[{id:'B1',videoId:'smAnother',time:40,
  label:'unexpected',createdAt:0,updatedAt:0}]);
 await assert.rejects(repo.add(draft('B2',90),duration),/Corrupted bookmark record/);
 assert.equal(b.rows.get(videoId).length,1);
});
test('storage failures propagate, never claim a successful write',async()=>{
 const b=new AtomicFakeBackend(),repo=new ManualBookmarkRepository(b);
 b.fail=true;
 await assert.rejects(repo.add(draft('B1',50),duration),/disk write failed/);
 await assert.rejects(repo.load(videoId,duration),/disk read failed/);
 assert.equal(b.rows.size,0);
});
test('different videos remain separate and cannot be renamed across keys',async()=>{
 const b=new AtomicFakeBackend(),repo=new ManualBookmarkRepository(b);
 await repo.add(draft('B1',50),duration);
 const other={...draft('B1',60),videoId:'smOther'};
 await repo.add(other,duration);
 assert.deepEqual((await repo.load('smOther',duration)).map(x=>x.time),[60]);
 assert.deepEqual((await repo.load(videoId,duration)).map(x=>x.time),[50]);
 await assert.rejects(repo.rename('smOther','../','x',300,duration),/Invalid bookmark update/);
});
test('native IndexedDB read uses separate database and waits for transaction commit',async()=>{
 const db=makeFakeIndexedDB();
 const owner=new IndexedDbManualBookmarkBackend(db.factory);
 const promise=owner.read(videoId);
 await tick();
 assert.deepEqual(db.opens,[['zenzawatch-manual-bookmarks',1]]);
 assert.equal(db.pending.length,1);
 assert.equal(db.pending[0].mode,'readonly');
 let done=false;promise.then(()=>done=true);
 db.fireRead(db.pending[0]);
 await tick();assert.equal(done,false);
 db.commit(db.pending[0]);await tick();
 assert.deepEqual(await promise,[]);
 owner.close();assert.equal(db.db.closed,true);
});
test('native IndexedDB write is atomic and resolves only after transaction commit',async()=>{
 const db=makeFakeIndexedDB(),backend=new IndexedDbManualBookmarkBackend(db.factory);
 const owner=new ManualBookmarkRepository(backend);
 const promise=owner.add(draft('B1',80),duration);
 await tick();const tx=db.pending[0];assert.equal(tx.mode,'readwrite');
 db.fireRead(tx);
 await tick();assert.deepEqual(tx.proposed.items.map(x=>x.id),['B1']);
 let done=false;promise.then(()=>done=true);
 await tick();assert.equal(done,false,'request success must not be mistaken for commit');
 db.commit(tx);await tick();assert.equal(done,true);
 assert.equal((await promise)[0].time,80);
 owner.close();
});
test('native IndexedDB abort rejects; no committed bookmark is claimed',async()=>{
 const db=makeFakeIndexedDB(),backend=new IndexedDbManualBookmarkBackend(db.factory);
 const owner=new ManualBookmarkRepository(backend);
 const promise=owner.add(draft('B1',80),duration);
 await tick();const tx=db.pending[0];db.fireRead(tx);await tick();
 tx.onerror?.();tx.onabort?.();
 await assert.rejects(promise,/Bookmark update failed|Bookmark update aborted/);
 assert.equal(db.records.size,0);
 owner.close();
});

for(const action of ['read','update']){
 test('database versionchange aborts a pending native '+action+' transaction',async()=>{
  const h=makeFakeIndexedDB(),backend=new IndexedDbManualBookmarkBackend(h.factory);
  const operation=action==='read'?backend.read(videoId):
    backend.update(videoId,()=>[{id:'B1',videoId,time:12,label:'mark',
      createdAt:100,updatedAt:100}]);
  await tick();
  assert.equal(h.pending.length,1);
  const tx=h.pending[0];
  if(action==='update'){
   h.fireRead(tx);
   await tick();
   assert(tx.proposed,'write should be pending before versionchange');
  }
  let outcome='pending';
  const observed=operation.then(()=>{outcome='resolved';},()=>{outcome='rejected';});
  h.db.onversionchange?.();
  await tick();
  try{
   assert.equal(outcome,'rejected',
    'a versionchange must not allow an in-flight '+action+' to finish');
   assert.equal(h.db.closed,true);
   assert.equal(h.records.size,0,'no uncommitted write should persist');
  }finally{
   if(outcome==='pending')tx.onabort?.();
   await observed;
   backend.close();
  }
 });
}

for(const action of ['read','update']){
 test('close aborts an already started native '+action+' transaction',async()=>{
  const h=makeFakeIndexedDB(),backend=new IndexedDbManualBookmarkBackend(h.factory);
  const owner=new ManualBookmarkRepository(backend);
  const operation=action==='read'?owner.load(videoId,duration):
    owner.add(draft('B1',80),duration);
  await tick();
  assert.equal(h.pending.length,1,'the transaction must exist before close');
  const tx=h.pending[0];
  if(action==='update'){
   h.fireRead(tx);
   await tick();
   assert.deepEqual(tx.proposed.items.map(entry=>entry.id),['B1']);
  }
  let outcome='pending';
  const observed=operation.then(()=>{outcome='resolved';},()=>{outcome='rejected';});
  backend.close();
  await tick();
  assert.equal(outcome,'rejected',
   'a disposed bookmark backend must reject in-flight '+action+' transactions');
  assert.equal(h.db.closed,true);
  assert.equal(h.records.size,0,'a closed owner must not persist uncommitted changes');
  await observed;
 });
}

for(const action of ['read','update']){
 test('close during pending native open cancels '+action+' and releases late connection',async()=>{
  const h=makeFakeIndexedDB({deferOpen:true});
  const backend=new IndexedDbManualBookmarkBackend(h.factory);
  let changes=0,outcome='pending';
  const pending=action==='read'?backend.read(videoId):
    backend.update(videoId,()=>{changes++;return [];});
  const observed=pending.then(()=>{outcome='resolved';},()=>{outcome='rejected';});
  backend.close();
  await tick();
  h.requests[0].onsuccess?.();
  await tick();
  assert.equal(h.db.closed,true,'a late connection must be closed after its owner exits');
  assert.equal(h.pending.length,0,'an abandoned open must start no transaction');
  assert.equal(changes,0,'a cancelled update must not mutate bookmark records');
  assert.equal(outcome,'rejected','the cancelled operation must settle without a DB transaction');
  await observed;
 });
}

test('close during native open aborts a late upgrade before schema changes',async()=>{
 const h=makeFakeIndexedDB({deferOpen:true});
 const backend=new IndexedDbManualBookmarkBackend(h.factory);
 const observed=backend.read(videoId).catch(()=>{});
 let upgrades=0,aborts=0;
 h.db.objectStoreNames.contains=()=>false;
 h.db.createObjectStore=()=>{upgrades++;return {};};
 backend.close();
 h.requests[0].transaction={abort(){aborts++;}};
 h.requests[0].onupgradeneeded?.();
 h.requests[0].onsuccess?.();
 await tick();
 assert.equal(upgrades,0,'an abandoned open must not upgrade the database');
 assert.equal(aborts,1,'the pending upgrade must be aborted');
 assert.equal(h.db.closed,true);
 assert.equal(h.pending.length,0);
 await observed;
});

test('closing an opening attempt allows a fresh open without late-owner interference',async()=>{
 const first=makeFakeIndexedDB({deferOpen:true}),second=makeFakeIndexedDB({deferOpen:true});
 let opens=0;
 const backend=new IndexedDbManualBookmarkBackend({open(...args){
  return (++opens===1?first:second).factory.open(...args);
 }});
 const abandoned=backend.read(videoId).catch(()=>{});
 backend.close();
 const active=backend.read(videoId);
 await tick();
 const shared=backend.read(videoId);
 assert.equal(opens,2,'fresh callers must share the new pending open, not the abandoned one');
 assert.equal(second.requests.length,1);
 first.requests[0].onsuccess?.();
 second.requests[0].onsuccess?.();
 await tick();
 assert.equal(first.db.closed,true,'the abandoned handle must not become the cached owner');
 assert.equal(first.pending.length,0);
 assert.equal(second.pending.length,2);
 for(const tx of second.pending){second.fireRead(tx);second.commit(tx);}
 assert.deepEqual(await active,[]);
 assert.deepEqual(await shared,[]);
 await abandoned;
 backend.close();
 assert.equal(second.db.closed,true);
});

test('close aborts an already-started native database upgrade',async()=>{
 const h=makeFakeIndexedDB({deferOpen:true});
 const backend=new IndexedDbManualBookmarkBackend(h.factory);
 let outcome='pending',upgrades=0,aborts=0;
 const observed=backend.read(videoId).then(
  ()=>{outcome='resolved';},()=>{outcome='rejected';});
 h.db.objectStoreNames.contains=()=>false;
 h.db.createObjectStore=()=>{upgrades++;return {};};
 h.requests[0].transaction={abort(){aborts++;}};
 h.requests[0].onupgradeneeded?.();
 assert.equal(upgrades,1,'the upgrade must have started before close');
 backend.close();
 await tick();
 assert.equal(aborts,1,'close must abort a still-pending upgrade');
 assert.equal(outcome,'rejected','cancellation must settle without waiting for IDB');
 assert.equal(h.pending.length,0);
 h.requests[0].onsuccess?.();
 await tick();
 assert.equal(h.db.closed,true);
 await observed;
});
