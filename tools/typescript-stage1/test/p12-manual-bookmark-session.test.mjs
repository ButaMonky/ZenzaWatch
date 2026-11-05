import test from 'node:test';
import assert from 'node:assert/strict';
import {ManualBookmarkSession} from '../p12-src/ManualBookmarkSession.ts';
import {addManualBookmark,renameManualBookmark,removeManualBookmark}
  from '../p12-src/ManualBookmarkPolicy.ts';
const duration=300;
const deferred=()=>{
 let resolve,reject;
 const promise=new Promise((res,rej)=>{resolve=res;reject=rej;});
 return {promise,resolve,reject};
};
class FakeRepository{
 constructor(){this.data=new Map();this.calls=[];this.closed=0;
   this.loadOverride=null;this.addOverride=null;this.failWrite=false;}
 async load(id,dur){
  this.calls.push(['load',id,dur]);
  if(this.loadOverride)return this.loadOverride(id,dur);
  return this.data.get(id)||[];
 }
 async add(draft,dur){
  this.calls.push(['add',draft.videoId,draft.id]);
  if(this.failWrite)throw Error('sensitive disk path');
  if(this.addOverride)return this.addOverride(draft,dur);
  const rows=addManualBookmark(this.data.get(draft.videoId)||[],draft,dur);
  this.data.set(draft.videoId,rows);return rows;
 }
 async rename(id,bookmarkId,label,now,dur){
  this.calls.push(['rename',id,bookmarkId]);
  const rows=renameManualBookmark(this.data.get(id)||[],id,bookmarkId,label,now);
  this.data.set(id,rows);return rows;
 }
 async remove(id,bookmarkId,dur){
  this.calls.push(['remove',id,bookmarkId]);
  const rows=removeManualBookmark(this.data.get(id)||[],id,bookmarkId);
  this.data.set(id,rows);return rows;
 }
 close(){this.closed++;}
}
test('initial state and successful load notify immutable one-video snapshots',async()=>{
 const repo=new FakeRepository(),session=new ManualBookmarkSession(repo),states=[];
 const unsubscribe=session.subscribe(s=>states.push(s));
 assert.equal(session.snapshot.status,'idle');
 const result=await session.activate('sm1',duration);
 assert.equal(result.status,'applied');assert.equal(session.snapshot.status,'ready');
 assert.deepEqual(states.map(s=>s.status),['idle','loading','ready']);
 assert(Object.isFrozen(session.snapshot)&&Object.isFrozen(session.snapshot.bookmarks));
 unsubscribe();session.dispose();assert.equal(repo.closed,1);
});
test('stale delayed load after a video switch cannot overwrite the new video',async()=>{
 const repo=new FakeRepository(),old=deferred();
 repo.loadOverride=id=>id==='smOld'?old.promise:[];
 const session=new ManualBookmarkSession(repo);
 const first=session.activate('smOld',duration);
 const second=await session.activate('smNew',duration);
 assert.equal(second.status,'applied');
 old.resolve([{id:'B1',videoId:'smOld',time:40,label:'X',createdAt:1,updatedAt:1}]);
 const returned=await first;
 assert.equal(returned.status,'stale');
 assert.equal(session.snapshot.videoId,'smNew');
 assert.equal(session.snapshot.bookmarks.length,0);
 session.dispose();
});
test('delayed old-video add may finish storage but never mutates new video display',async()=>{
 const repo=new FakeRepository(),hold=deferred();
 repo.addOverride=()=>hold.promise;
 const session=new ManualBookmarkSession(repo);
 await session.activate('smOld',duration);
 const adding=session.add('B1',60,100);
 await session.activate('smNew',duration);
 hold.resolve([{id:'B1',videoId:'smOld',time:60,label:'keep',createdAt:100,updatedAt:100}]);
 const result=await adding;
 assert.equal(result.status,'stale');
 assert.equal(session.snapshot.videoId,'smNew');
 assert.equal(session.snapshot.bookmarks.length,0);
 session.dispose();
});
test('duplicate same-video notification does not invalidate an in-flight bookmark add',async()=>{
 const repo=new FakeRepository(),hold=deferred();
 repo.addOverride=async(draft,dur)=>{
  await hold.promise;
  const rows=addManualBookmark(repo.data.get(draft.videoId)||[],draft,dur);
  repo.data.set(draft.videoId,rows);return rows;
 };
 const session=new ManualBookmarkSession(repo);
 await session.activate('sm1',duration);
 const pending=session.add('B1',50,100);
 const duplicate=await session.activate('sm1',duration);
 assert.equal(duplicate.status,'applied');
 assert.equal(repo.calls.filter(call=>call[0]==='load').length,1,
  'the current video notification must not reload the manual bookmark session');
 hold.resolve();
 assert.equal((await pending).status,'applied',
  'an existing write should retain its session generation');
 assert.deepEqual(session.snapshot.bookmarks.map(x=>x.id),['B1']);
 session.dispose();
});
test('duplicate activation during the same pending read shares one load result',async()=>{
 const repo=new FakeRepository(),hold=deferred();
 repo.loadOverride=()=>hold.promise;
 const session=new ManualBookmarkSession(repo),events=[];
 session.subscribe(s=>events.push(s.status));
 const first=session.activate('sm1',duration);
 const duplicate=session.activate('sm1',duration);
 assert.equal(repo.calls.filter(call=>call[0]==='load').length,1);
 hold.resolve([{id:'B1',videoId:'sm1',time:50,label:'saved',createdAt:1,updatedAt:1}]);
 const [a,b]=await Promise.all([first,duplicate]);
 assert.equal(a.status,'applied');assert.equal(b.status,'applied');
 assert.deepEqual(events,['idle','loading','ready']);
 assert.deepEqual(session.snapshot.bookmarks.map(x=>x.id),['B1']);
 session.dispose();
});
test('duplicate ready video preserves snapshot and new duration still reloads',async()=>{
 const repo=new FakeRepository(),session=new ManualBookmarkSession(repo);
 await session.activate('sm1',duration);
 await session.add('B1',50,100);
 const before=session.snapshot;
 const repeated=await session.activate('sm1',duration);
 assert.equal(repeated.status,'applied');
 assert.strictEqual(session.snapshot,before,'repeated info must not rebuild the panel');
 assert.equal(repo.calls.filter(call=>call[0]==='load').length,1);
 await session.activate('sm1',duration+1);
 assert.equal(repo.calls.filter(call=>call[0]==='load').length,2,
  'a real duration change must still refresh the owner');
 session.dispose();
});
test('reentrant same-video loading observer joins the in-flight activation',async()=>{
 const repo=new FakeRepository(),hold=deferred();
 repo.loadOverride=()=>hold.promise;
 const session=new ManualBookmarkSession(repo);
 let duplicate;
 session.subscribe(s=>{
  if(s.status==='loading'&&s.videoId==='sm1')duplicate=session.activate('sm1',duration);
 });
 const first=session.activate('sm1',duration);
 assert.strictEqual(duplicate,first,'reentrant loading observer must not claim early success');
 hold.resolve([]);
 assert.equal((await duplicate).status,'applied');
 assert.equal((await first).status,'applied');
 session.dispose();
});
test('reentrant video switch cannot replace the new activation with stale old load',async()=>{
 const repo=new FakeRepository(),oldHold=deferred();
 repo.loadOverride=id=>id==='smOld'?oldHold.promise:[];
 const session=new ManualBookmarkSession(repo);
 let switched;
 session.subscribe(s=>{
  if(s.status==='loading'&&s.videoId==='smOld')
   switched=session.activate('smNew',duration);
 });
 const original=session.activate('smOld',duration);
 const duplicateNew=session.activate('smNew',duration);
 assert.strictEqual(duplicateNew,switched,'current video must own its loading promise');
 oldHold.resolve([]);
 assert.equal((await original).status,'stale');
 assert.equal((await switched).status,'applied');
 assert.equal(session.snapshot.videoId,'smNew');
 session.dispose();
});
test('ordinary add, rename and delete never depend on automatic resume position',async()=>{
 const repo=new FakeRepository(),session=new ManualBookmarkSession(repo);
 await session.activate('sm1',duration);
 assert.equal((await session.add('B1',0,101,'First')).status,'applied');
 assert.equal((await session.add('B2',299,102,'Near end')).status,'applied');
 assert.deepEqual(session.snapshot.bookmarks.map(r=>r.time),[0,299]);
 assert.equal((await session.rename('B1','Scene',200)).status,'applied');
 assert.equal(session.snapshot.bookmarks[0].label,'Scene');
 assert.equal((await session.remove('B2')).status,'applied');
 assert.deepEqual(session.snapshot.bookmarks.map(r=>r.id),['B1']);
 session.dispose();
});
test('an unsuccessful write reports error without discarding previously loaded items',async()=>{
 const repo=new FakeRepository(),session=new ManualBookmarkSession(repo);
 await session.activate('sm1',duration);
 await session.add('B1',50,1);
 const earlier=session.snapshot.bookmarks[0];
 repo.failWrite=true;
 const result=await session.add('B2',70,2);
 assert.equal(result.status,'error');
 assert.equal(session.snapshot.status,'error');
 assert.equal(session.snapshot.bookmarks[0].id,earlier.id);
 assert(!JSON.stringify(result).includes('sensitive disk path'));
 session.dispose();
});
test('an error from stale load does not alter the newer video',async()=>{
 const repo=new FakeRepository(),hold=deferred();
 repo.loadOverride=id=>id==='smOld'?hold.promise:[];
 const session=new ManualBookmarkSession(repo);
 const first=session.activate('smOld',duration);
 await session.activate('smNew',duration);
 hold.reject(Error('private path'));
 assert.equal((await first).status,'stale');
 assert.equal(session.snapshot.status,'ready');
 session.dispose();
});
test('a newly started edit beats a stale pending load for the same video',async()=>{
 const repo=new FakeRepository(),hold=deferred();
 repo.loadOverride=()=>hold.promise;
 const session=new ManualBookmarkSession(repo);
 const load=session.activate('sm1',duration);
 const add=await session.add('B1',60,100);
 assert.equal(add.status,'applied');
 hold.resolve([]);
 assert.equal((await load).status,'stale');
 assert.equal(session.snapshot.bookmarks.length,1);
 session.dispose();
});
test('deactivate blocks late responses, clears UI only, keeps persistent bookmarks',async()=>{
 const repo=new FakeRepository(),session=new ManualBookmarkSession(repo);
 await session.activate('sm1',duration);
 await session.add('B1',90,100);
 assert.equal(session.snapshot.bookmarks.length,1);
 session.deactivate();
 assert.equal(session.snapshot.status,'idle');
 assert.equal(session.snapshot.videoId,null);
 assert.equal(repo.data.get('sm1').length,1);
 await session.activate('sm1',duration);
 assert.equal(session.snapshot.bookmarks.length,1);
 session.dispose();
});
test('subscribe release prevents further updates and dispose closes backend once',async()=>{
 const repo=new FakeRepository(),session=new ManualBookmarkSession(repo);
 const events=[];const off=session.subscribe(s=>events.push(s.status));
 off();await session.activate('sm1',duration);
 assert.deepEqual(events,['idle']);
 session.dispose();session.dispose();assert.equal(repo.closed,1);
 assert.throws(()=>session.subscribe(()=>{}),/disposed/);
 await assert.rejects(session.activate('sm1',duration),/disposed/);
});
test('rejects invalid video activation or action without an active video',async()=>{
 const repo=new FakeRepository(),session=new ManualBookmarkSession(repo);
 await assert.rejects(session.activate('',duration),/Invalid bookmark video session/);
 await assert.rejects(session.activate('sm1',0),/Invalid bookmark video session/);
 await assert.rejects(session.add('B1',30,1),/No active bookmark video/);
 session.dispose();
});
test('manual session never calls WatchInfoCacheDb or touches an auto-resume barrier',async()=>{
 const repo=new FakeRepository(),session=new ManualBookmarkSession(repo);
 const auto={resume:[{time:95}],resumeClearedAt:200};
 const before=JSON.stringify(auto);
 await session.activate('sm1',duration);
 await session.add('B1',85,201);
 assert.equal(JSON.stringify(auto),before);
 assert.equal(repo.calls.every(([action])=>['load','add','rename','remove'].includes(action)),true);
 session.dispose();
});

test('a broken UI observer cannot abort a committed bookmark write',async()=>{
 const repo=new FakeRepository(),session=new ManualBookmarkSession(repo);
 const received=[];
 session.subscribe(()=>{throw Error('private UI error');});
 session.subscribe(s=>received.push(s.status));
 await session.activate('sm1',duration);
 const result=await session.add('B1',60,101);
 assert.equal(result.status,'applied');
 assert.equal(repo.data.get('sm1').length,1);
 assert.equal(session.snapshot.bookmarks[0].id,'B1');
 assert.deepEqual(received,['idle','loading','ready','ready']);
 session.dispose();
});

test('a failed later edit reloads an earlier committed bookmark into the visible panel',async()=>{
 const repo=new FakeRepository(),hold=deferred();
 let loads=0;
 repo.loadOverride=async id=>{
  if(++loads===1)return [];
  await hold.promise;
  return repo.data.get(id)||[];
 };
 repo.addOverride=async(draft,dur)=>{
  if(draft.id==='B2')throw Error('private storage write failed');
  await hold.promise;
  const rows=addManualBookmark(repo.data.get(draft.videoId)||[],draft,dur);
  repo.data.set(draft.videoId,rows);return rows;
 };
 const session=new ManualBookmarkSession(repo);
 await session.activate('sm1',duration);
 const first=session.add('B1',75,100);
 const second=session.add('B2',95,101);
 hold.resolve();
 assert.equal((await first).status,'stale');
 assert.equal((await second).status,'error');
 assert.equal(session.snapshot.status,'error');
 assert.deepEqual(session.snapshot.bookmarks.map(x=>x.id),['B1'],
  'a committed earlier write must not disappear from the panel on later failure');
 assert(!JSON.stringify(session.snapshot).includes('private'));
 session.dispose();
});

test('a pending error-recovery read cannot replace the next video snapshot',async()=>{
 const repo=new FakeRepository(),entered=deferred(),hold=deferred();
 let loads=0;
 repo.loadOverride=id=>{
  if(id==='sm1'&&++loads>1){entered.resolve();return hold.promise;}
  return Promise.resolve([]);
 };
 repo.addOverride=async()=>{throw Error('private storage error');};
 const session=new ManualBookmarkSession(repo);
 await session.activate('sm1',duration);
 const failed=session.add('B1',60,100);
 await entered.promise;
 const next=await session.activate('sm2',duration);
 assert.equal(next.status,'applied');
 hold.resolve([{id:'B1',videoId:'sm1',time:60,label:'old',
  createdAt:100,updatedAt:100}]);
 assert.equal((await failed).status,'stale');
 assert.equal(session.snapshot.videoId,'sm2');
 assert.deepEqual(session.snapshot.bookmarks,[]);
 session.dispose();
});

test('earlier delayed commit is recovered after a newer edit already failed',async()=>{
 const repo=new FakeRepository(),hold=deferred();
 repo.addOverride=async(draft,duration)=>{
  if(draft.id==='B2')throw Error('private failed write');
  await hold.promise;
  const rows=addManualBookmark(repo.data.get(draft.videoId)||[],draft,duration);
  repo.data.set(draft.videoId,rows);
  return rows;
 };
 const session=new ManualBookmarkSession(repo);
 await session.activate('sm1',duration);
 const earlier=session.add('B1',60,100);
 const newer=session.add('B2',90,101);
 assert.equal((await newer).status,'error');
 assert.deepEqual(session.snapshot.bookmarks,[]);
 hold.resolve();
 assert.equal((await earlier).status,'stale');
 assert.deepEqual(repo.data.get('sm1').map(row=>row.id),['B1']);
 assert.deepEqual(session.snapshot.bookmarks.map(row=>row.id),['B1'],
  'a late successful earlier write must not remain invisible');
 assert.equal(session.snapshot.status,'error');
 session.dispose();
});

test('late successful write wins over older failed-action readback snapshot',async()=>{
 const repo=new FakeRepository(),holdWrite=deferred(),holdRead=deferred(),entered=deferred();
 let loads=0;
 repo.loadOverride=async videoId=>{
  if(++loads===1)return [];
  if(loads===2){entered.resolve();return holdRead.promise;}
  return repo.data.get(videoId)||[];
 };
 repo.addOverride=async(draft,dur)=>{
  if(draft.id==='B2')throw Error('private failure');
  await holdWrite.promise;
  const rows=addManualBookmark(repo.data.get(draft.videoId)||[],draft,dur);
  repo.data.set(draft.videoId,rows);return rows;
 };
 const session=new ManualBookmarkSession(repo);
 await session.activate('sm1',duration);
 const earlier=session.add('B1',55,100),later=session.add('B2',70,101);
 await entered.promise;
 holdWrite.resolve();
 assert.equal((await earlier).status,'stale');
 holdRead.resolve([]);
 assert.equal((await later).status,'error');
 assert.deepEqual(session.snapshot.bookmarks.map(row=>row.id),['B1']);
 assert.equal(session.snapshot.status,'error');
 session.dispose();
});
