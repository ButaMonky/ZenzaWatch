import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as policy from '../p12-src/ManualBookmarkPolicy.ts';
import {ManualBookmarkRepository} from '../p12-src/ManualBookmarkStore.ts';
import {ManualBookmarkSession} from '../p12-src/ManualBookmarkSession.ts';
const point={id:'a',videoId:'sm9',time:10,label:'point',createdAt:1,updatedAt:1};
test('ranges preserve legacy points, enforce creation bounds and preserve stored ranges after shrink',()=>{
 const items=policy.addManualBookmark([point],{id:'b',videoId:'sm9',time:20,endTime:30,now:2},30);
 assert.equal(items[1].endTime,30);
 assert.deepEqual(policy.normalizeManualBookmarks(items,'sm9',5),items);
 assert.equal('endTime' in items[0],false);
 for(const endTime of [20,20.1,31,Infinity,NaN])assert.throws(()=>policy.addManualBookmark([],{id:'b',videoId:'sm9',time:20,endTime,now:2},30));
 assert.equal(policy.normalizeManualBookmarks([{...point,endTime:9},point],'sm9',30).length,1);
});
test('atomic edit preserves IDs/timestamps, converts ranges to points, rejects vanished IDs',()=>{
 const result=policy.updateManualBookmark([point],'sm9','a',{time:20,endTime:30,label:' range '},0,30);
 assert.deepEqual(result,[{...point,time:20,endTime:30,label:'range'}]);
 assert.equal('endTime' in policy.updateManualBookmark(result,'sm9','a',{time:15,label:'point'},4,30)[0],false);
 assert.throws(()=>policy.updateManualBookmark(result,'sm9','missing',{time:15,label:'x'},4,30));
 assert.throws(()=>policy.updateManualBookmark(result,'sm9','a',{time:15,endTime:15.1,label:'x'},4,30));
});
function backend(initial=[point]){
 let rows=initial,writes=0,chain=Promise.resolve();
 return {read:async()=>rows,close(){},list:async()=>[{videoId:'sm9',items:rows}],
 update(_id,change){chain=chain.then(()=>{rows=change(rows);writes++;});return chain;},
 get writes(){return writes;},get rows(){return rows;}};
}
test('repository edits latest atomic rows and enumeration never writes or erases corruption',async()=>{
 const b=backend(),repo=new ManualBookmarkRepository(b);
 await Promise.all([repo.add({id:'b',videoId:'sm9',time:25,now:2},30),
 repo.update('sm9','a',{time:20,endTime:30,label:'range'},3,30)]);
 assert.equal(b.rows.length,2);assert.equal(b.rows[0].endTime,30);
 assert.deepEqual(await repo.list(),[{videoId:'sm9',items:b.rows}]);assert.equal(b.writes,2);
 const broken=backend([point,{...point,id:'bad',endTime:NaN}]);
 const library=await new ManualBookmarkRepository(broken).list();
 assert.deepEqual(library,[{videoId:'sm9',items:[point]}]);
 assert.equal(broken.rows.length,2);assert.equal(broken.writes,0);
});
test('session add/edit and refresh includes endTime; old mocks fail gracefully',async()=>{
 let rows=[point];
 const repo={load:async()=>rows,add:async draft=>rows=[{...draft,createdAt:draft.now,updatedAt:draft.now}],
 update:async(_video,_id,changes)=>rows=[{...point,...changes}],close(){},
 rename:async()=>rows,remove:async()=>rows};
 const session=new ManualBookmarkSession(repo);await session.activate('sm9',30);
 assert.equal((await session.add('a',10,2,'range',20)).snapshot.bookmarks[0].endTime,20);
 assert.equal((await session.update('a',{time:10,endTime:30,label:'r'},3)).status,'applied');
 const before=session.snapshot;rows=[{...rows[0],endTime:25}];await session.refreshIfIdle();
 assert.notEqual(session.snapshot,before);assert.equal(session.snapshot.bookmarks[0].endTime,25);
 delete repo.update;
 assert.equal((await session.update('a',{time:10,label:'x'},4)).status,'error');
 assert.equal(session.snapshot.bookmarks[0].endTime,25);session.dispose();
});

test('native enumeration uses a readonly cursor and settles only on transaction completion',async()=>{
 const {IndexedDbManualBookmarkBackend}=await import('../p12-src/ManualBookmarkStore.ts');
 let mode,openRequest,cursorRequest,tx,puts=0;
 const db={objectStoreNames:{contains:()=>true},close(){},transaction(_store,m){
   mode=m;tx={objectStore:()=>({openCursor(){return cursorRequest={};},put(){puts++;}})};return tx;
 }};
 const factory={open(){openRequest={};queueMicrotask(()=>{openRequest.result=db;openRequest.onsuccess();});return openRequest;}};
 const native=new IndexedDbManualBookmarkBackend(factory);
 let settled=false;const pending=native.list().then(rows=>{settled=true;return rows;});
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(mode,'readonly');
 cursorRequest.result={value:{videoId:'sm9',items:[point]},continue(){cursorRequest.result=null;cursorRequest.onsuccess();}};
 cursorRequest.onsuccess();await Promise.resolve();assert.equal(settled,false);
 tx.oncomplete();assert.deepEqual(await pending,[{videoId:'sm9',items:[point]}]);assert.equal(puts,0);
 native.close();
});
test('late edit after video switch never overwrites the new owner',async()=>{
 let finish;
 const repo={load:async()=>[],update:()=>new Promise(resolve=>{finish=resolve;}),close(){}};
 const session=new ManualBookmarkSession(repo);await session.activate('sm9',30);
 const pending=session.update('a',{time:10,endTime:20,label:'r'},2);
 await session.activate('sm10',30);finish([{...point,endTime:20}]);
 assert.equal((await pending).status,'stale');assert.equal(session.snapshot.videoId,'sm10');
 assert.deepEqual(session.snapshot.bookmarks,[]);session.dispose();
});
