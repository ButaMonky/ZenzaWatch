'use strict';
// P12-02 atomic per-video auto resume clearing; never delete watch metadata.
const {assert,ticks,observe,deferred,eventTarget,controllerFixture,adapterFixture}=
  require('../helpers/idbRecoveryFixture');

function fakeStore(initial){
 let record=initial?{...initial}:null;
 const requests=[];
 let deletes=0,reads=0;
 const store={
  async update(data){
   requests.push(data);
   if(data.onlyExisting&&!record)return null;
   const updated={...(record||{})};
   for(const [key,value]of Object.entries(data.defaults||{})){
    if(!updated[key])updated[key]=value;
   }
   Object.assign(updated,data.patch||{});
   for(const [key,values]of Object.entries(data.prepend||{}))
    updated[key]=values.concat(Array.isArray(updated[key])?updated[key]:[]);
   for(const [key,limit]of Object.entries(data.limits||{}))
    if(Array.isArray(updated[key]))updated[key]=updated[key].slice(0,limit);
   record=updated;
   return {...record};
  },
  updateTime(){reads++;return Promise.resolve(record);},
  delete(){deletes++;throw Error('WHOLE_RECORD_DELETE_FORBIDDEN');}
 };
 return {store,requests,get record(){return record;},get deletes(){return deletes;},
  get reads(){return reads;}};
}

describe('P12-02 atomic automatic resume tombstone, metadata-safe',()=>{
 it('clears only resume, preserving video/comment/bookmark/watch-count fields',async()=>{
  const original={watchId:'sm9',videoId:'sm9',resume:[{now:9,time:45}],
   videoInfo:{title:'kept'},comment:[{text:'preserved'}],watchCount:12,
   threadInfo:{threadId:7},manualBookmarks:[{id:'B1',time:24}]};
  const h=fakeStore(original),api=adapterFixture('WatchInfoCacheDb',h.store);
  const record=await api.clearAutomaticResume('sm9','completed');
  assert.deepStrictEqual(Array.from(record.resume),[]);
  assert.strictEqual(record.resumeClearReason,'completed');
  assert(Number.isSafeInteger(record.resumeClearedAt)&&record.resumeClearedAt>=0);
  assert.strictEqual(record.videoInfo,original.videoInfo);
  assert.strictEqual(record.comment,original.comment);
  assert.strictEqual(record.manualBookmarks,original.manualBookmarks);
  assert.strictEqual(record.watchCount,12);
  assert.strictEqual(record.threadInfo,original.threadInfo);
  assert.strictEqual(h.requests.length,1);
  assert.strictEqual(h.requests[0].key,'sm9');
  assert.strictEqual(h.deletes,0);
  assert.strictEqual(h.reads,0,'one update transaction, no separate cache read');
 });
 it('creates a minimal per-video marker when no previous cache row exists',async()=>{
  const h=fakeStore(null),api=adapterFixture('WatchInfoCacheDb',h.store);
  const got=await api.clearAutomaticResume('sm11');
  assert.strictEqual(got.watchId,'sm11');
  assert.strictEqual(got.videoId,'sm11');
  assert.strictEqual(got.resumeClearReason,'deleted');
  assert.strictEqual(got.resume.length,0);
  assert.strictEqual(h.deletes,0);
  assert(!h.requests[0].onlyExisting,'missing row must still receive a marker');
 });
 it('does not modify unrelated video records',async()=>{
  const a=fakeStore({watchId:'sm2',resume:[{now:5,time:50}],comment:['other']});
  const api=adapterFixture('WatchInfoCacheDb',a.store);
  await api.clearAutomaticResume('sm2');
  assert.strictEqual(a.record.watchId,'sm2');
  assert.deepStrictEqual(a.record.comment,['other']);
  assert.strictEqual(a.requests[0].key,'sm2');
 });
 it('rejects empty ID and unsupported reason before any write',async()=>{
  const h=fakeStore(null),api=adapterFixture('WatchInfoCacheDb',h.store);
  await assert.rejects(api.clearAutomaticResume(''),/Invalid automatic resume clear request/);
  await assert.rejects(api.clearAutomaticResume('sm9','unknown'),/Invalid automatic resume clear request/);
  assert.strictEqual(h.requests.length,0);
  assert.strictEqual(h.deletes,0);
 });
 it('rejects an unacknowledged record; does not claim deletion',async()=>{
  const api=adapterFixture('WatchInfoCacheDb',{
   update(){return Promise.resolve({watchId:'sm9',resume:[{time:80}]});}
  });
  await assert.rejects(api.clearAutomaticResume('sm9'),
    /Automatic resume clear was not acknowledged/);
 });
 it('propagates storage failures; never pretends remote/local deletion succeeded',async()=>{
  const api=adapterFixture('WatchInfoCacheDb',{
   update(){return Promise.reject(new Error('disk unavailable'));}
  });
  await assert.rejects(api.clearAutomaticResume('sm9'),/disk unavailable/);
 });
 it('subsequent normal put keeps the clear marker and only prepends fresh local data',async()=>{
  const h=fakeStore({watchId:'sm9',resume:[{time:62,now:20}],
   videoInfo:{title:'untouched'},comment:['chat']});
  const api=adapterFixture('WatchInfoCacheDb',h.store);
  const cleared=await api.clearAutomaticResume('sm9','completed');
  const barrier=cleared.resumeClearedAt;
  await api.put('sm9',{currentTime:88});
  assert.strictEqual(h.record.resume.length,1);
  assert.strictEqual(h.record.resume[0].time,88);
  assert.strictEqual(h.record.resumeClearedAt,barrier);
  assert.strictEqual(h.record.resumeClearReason,'completed');
  assert.strictEqual(h.record.videoInfo.title,'untouched');
  assert.deepStrictEqual(h.record.comment,['chat']);
 });
 it('one readwrite transaction must commit before the clear Promise resolves',async()=>{
  const read=eventTarget(),write=eventTarget(),tx=eventTarget(),modes=[],puts=[];
  tx.abort=()=>{};
  tx.objectStore=()=>({get(){return read;},put(v){puts.push(v);return write;}});
  const f=controllerFixture();
  await f.ready({transaction(name,mode){modes.push(mode);return tx;}});
  const api=adapterFixture('WatchInfoCacheDb',{
   update(data){return f.controller.update({name:'fixture',storeName:'cache',data});}
  });
  const pending=observe(api.clearAutomaticResume('sm9','completed'));
  await ticks();
  read.result={watchId:'sm9',resume:[{now:10,time:60}],
   comment:['unchanged'],manualBookmarks:['B1'],watchCount:8};
  read.fire('success');await ticks();
  assert.strictEqual(pending.status,'pending');
  assert.deepStrictEqual(modes,['readwrite']);
  assert.strictEqual(puts.length,1);
  assert.deepStrictEqual(Array.from(puts[0].resume),[]);
  assert.deepStrictEqual(Array.from(puts[0].manualBookmarks),['B1']);
  write.fire('success');await ticks();
  assert.strictEqual(pending.status,'pending');
  tx.fire('complete');await ticks();
  assert.strictEqual(pending.status,'resolved');
 });
 it('rollback on transaction abort reports failure, never a success marker',async()=>{
  const read=eventTarget(),write=eventTarget(),tx=eventTarget();
  tx.abort=()=>{};
  tx.objectStore=()=>({get(){return read;},put(){return write;}});
  const f=controllerFixture();
  await f.ready({transaction(){return tx;}});
  const api=adapterFixture('WatchInfoCacheDb',{
   update(data){return f.controller.update({name:'fixture',storeName:'cache',data});}
  });
  const pending=observe(api.clearAutomaticResume('sm9'));
  await ticks();
  read.result={watchId:'sm9',resume:[{time:55,now:100}]};
  read.fire('success');await ticks();
  write.fire('success');await ticks();
  tx.error=new Error('transaction rolled back');
  tx.fire('abort');await ticks();
  assert.strictEqual(pending.status,'rejected');
  assert.match(pending.error.message,/transaction rolled back/);
 });
});
