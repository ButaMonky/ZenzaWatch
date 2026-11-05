import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeManualBookmarks,addManualBookmark,
  renameManualBookmark,removeManualBookmark} from '../p12-src/ManualBookmarkPolicy.ts';
const videoId='sm9',duration=300;
const draft=(id,time,now=100,label='無題のしおり')=>({id,time,videoId,now,label});
const first=()=>addManualBookmark([],draft('B1',60),duration);
test('creates one manual bookmark, independently of automatic resume',()=>{
 const b=first();
 assert.deepEqual(b,[{id:'B1',videoId,time:60,label:'無題のしおり',
  createdAt:100,updatedAt:100}]);
 assert(Object.isFrozen(b)&&Object.isFrozen(b[0]));
 assert(!Object.hasOwn(b[0],'resume'));
});
test('accepts zero and near-end manual markers (automatic policy differs)',()=>{
 let b=addManualBookmark([],draft('B1',0),duration);
 b=addManualBookmark(b,draft('B2',299.9),duration);
 assert.deepEqual(b.map(x=>x.time),[0,299.9]);
});
test('does not mutate frozen callers, returns a new list',()=>{
 const b=first(),saved=JSON.stringify(b);
 const c=addManualBookmark(b,draft('B2',80),duration);
 assert.notEqual(b,c);assert.equal(JSON.stringify(b),saved);assert.equal(c.length,2);
});
test('rejects duplicate IDs and mixed video records rather than overwriting',()=>{
 const b=first();
 assert.throws(()=>addManualBookmark(b,draft('B1',80),duration),/Duplicate/);
 assert.throws(()=>addManualBookmark(b,{...draft('B2',80),videoId:'smOther'},duration),/Mixed/);
});
test('labels are text only, short and trimmed, with a safe empty default',()=>{
 const b=addManualBookmark([],draft('B1',40,1,'  scene  '),duration);
 assert.equal(b[0].label,'scene');
 const c=renameManualBookmark(b,videoId,'B1','   ',2);
 assert.equal(c[0].label,'無題のしおり');
 assert.throws(()=>renameManualBookmark(b,videoId,'B1','?'.repeat(81),2),/too long/);
});
test('delete targets only an explicit manual bookmark ID',()=>{
 let b=addManualBookmark(first(),draft('B2',110),duration);
 b=removeManualBookmark(b,videoId,'B1');
 assert.deepEqual(b.map(x=>x.id),['B2']);
 assert.deepEqual(removeManualBookmark(b,videoId,'B1'),b);
});
test('rename preserves time, original creation and other entries',()=>{
 const b=addManualBookmark(first(),draft('B2',112,105),duration);
 const c=renameManualBookmark(b,videoId,'B1','??',200);
 assert.equal(c[0].time,60);assert.equal(c[0].createdAt,100);
 assert.equal(c[0].updatedAt,200);assert.equal(c[1].label,'無題のしおり');
 assert.equal(b[0].label,'無題のしおり');
});
test('rename never rolls updatedAt backwards when the device clock moves backwards',()=>{
 const created=addManualBookmark([],draft('B1',60,100,'first'),duration);
 const firstRename=renameManualBookmark(created,videoId,'B1','second',250);
 const clockRolledBack=renameManualBookmark(firstRename,videoId,'B1','third',150);
 assert.equal(clockRolledBack[0].label,'third');
 assert.equal(clockRolledBack[0].createdAt,100);
 assert.equal(clockRolledBack[0].updatedAt,250,
  'a late rename under clock rollback must not regress persisted modification order');
 assert.equal(firstRename[0].updatedAt,250,'prior snapshots must remain immutable');
});
test('normalize discards wrong-video, malformed, duplicate and unsafe records',()=>{
 const good=first()[0];
 const raw=[good,{...good,id:'B2',videoId:'smOther'},
  {...good,id:'B1',time:88},{...good,id:'bad/ID'},
  {...good,id:'B3',time:duration},{...good,id:'B4',label:'x'.repeat(100)}];
 const b=normalizeManualBookmarks(raw,videoId,duration);
 assert.equal(b.length,1);
 assert.deepEqual(b[0],good);
});
test('invalid video/duration makes load empty without mutating storage input',()=>{
 const raw=[first()[0]];
 assert.deepEqual(normalizeManualBookmarks(raw,'',duration),[]);
 assert.deepEqual(normalizeManualBookmarks(raw,videoId,-1),[]);
 assert.equal(raw.length,1);
});
test('rejects negative/NaN/infinite times and invalid identifiers before writing',()=>{
 for(const time of [-1,Infinity,NaN,300]){
  assert.throws(()=>addManualBookmark([],draft('B1',time),duration),/Invalid bookmark draft/);
 }
 assert.throws(()=>addManualBookmark([],draft('../bad',45),duration),/Invalid bookmark draft/);
});
test('does not silently evict older manual bookmarks at 100-record limit',()=>{
 const rows=Array.from({length:100},(_,i)=>({
  id:'B'+i,videoId,time:i,label:'x',createdAt:i,updatedAt:i
 }));
 assert.throws(()=>addManualBookmark(rows,draft('B100',110),duration),/limit/);
 assert.equal(rows.length,100);
});
test('automatic completion is absent from this model: manual markers remain intact',()=>{
 const bookmarks=first();
 const autoClear={resume:[],resumeClearedAt:400,reason:'completed'};
 assert.equal(autoClear.resume.length,0);
 assert.deepEqual(bookmarks,first());
});
