// Task207: separate fetch target / cached additional / applied additional.
// Terms: goal = fetch target, cachedAdditional = fetched+deduplicated history kept in memory for this video,
// appliedAdditional = how many of the cache are applied to Zenza, appliedTarget = requested applied count.
// Task206's simultaneous display limit (commentLayer.maxDisplayComment) is a different, unrelated setting.
import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs';
import {HistorySession} from '../src/session.mjs';import {RequestCoordinator} from '../src/coordinator.mjs';
import {LayeredCommentStore} from '../src/layers.mjs';import {normalizeWatch} from '../src/core.mjs';
import {DEFAULT_SETTINGS} from '../src/settings.mjs';import {watch,comment} from './fixtures.mjs';
import {HISTORY_PRESETS,APPLIED_PRESETS} from '../src/browser-preferences.mjs';
import {CommentHistoryController} from '../src/controller.mjs';

const NOW=1800000000;
function preferences(enabled=true,settings={}){let state={enabled,settings:{...DEFAULT_SETTINGS,...settings}};const listeners=new Set();
 return {get:()=>state,subscribe:f=>(listeners.add(f),()=>listeners.delete(f)),setEnabled:v=>{state={...state,enabled:v};for(const f of listeners)f(state);},
  patch:c=>{state={...state,settings:{...state.settings,...c}};for(const f of listeners)f(state);return state;}};}
function normal(videoId='sm1'){const nv=watch(videoId).data.response.$watchV4.data.comment.nvComment;return {generation:'play-'+videoId,videoInfo:{videoId,contextWatchId:videoId,duration:100,msgInfo:{videoId,nvComment:nv,threads:[{id:'10',fork:1,forkLabel:'owner',label:'owner',layer:{index:0}},{id:'10',fork:0,forkLabel:'main',label:'default',layer:{index:0}}]}},result:{format:'threads',threadInfo:{videoId,threadId:'10',language:'ja-jp',isWaybackMode:false},body:{threads:[{id:'10',fork:'owner',commentCount:0,comments:[]},{id:'10',fork:'main',commentCount:50,comments:[comment(1,NOW-1)]}]}}};}
// A server with 1000 comments per page going back in time from the cursor: page(when) holds when-1 ... when-1000.
function server({failAfterPages=Infinity}={}){
 const calls=[];
 const fetchPage=async(context,{when})=>{
  calls.push(when);if(calls.length>failAfterPages)throw Object.assign(new Error('synthetic'),{code:'API_ERROR'});
  const comments=Array.from({length:1000},(_,i)=>{const sec=when-1-i;return comment(NOW-sec+10,sec);});
  return [{id:'10',fork:'main',commentCount:999999,comments}];
 };
 return {calls,fetchPage};
}
function make({settings={maxAdditionalComments:5000},failAfterPages}={}){
 const srv=server({failAfterPages});const renders=[],clears=[],notices=[];const prefs=preferences(true,settings);let clock=0;
 const controller=new CommentHistoryController({preferences:prefs,
  render:async data=>{const ids=data.threads.flatMap(t=>t.comments.map(c=>c.id));renders.push(ids);return {additionalCount:ids.length};},
  clearRender:()=>clears.push(1),notify:m=>notices.push(m),
  createSession:(context,o)=>new HistorySession(context,{...o,coordinator:new RequestCoordinator({settings:o.settings,now:()=>clock,sleep:async n=>{clock+=n;}}),fetchPage:srv.fetchPage})});
 return {controller,srv,renders,clears,notices,prefs,last:()=>renders.at(-1)};
}
const start=async h=>{await h.controller.normalReady(normal());await h.controller.whenIdle();};

test('presets: fetch steps gain 7,500 and 15,000; applied choices include 0 (not OFF) and keep the 20,000 maximum',()=>{
 assert.deepEqual([...HISTORY_PRESETS],[1000,2500,5000,7500,10000,15000,20000]);
 assert.deepEqual([...APPLIED_PRESETS],[0,1000,2500,5000,7500,10000,15000,20000]);
});
test('cached15000/applied15000 -> applied7500: cache stays 15000 and no network request',async()=>{
 const h=make({settings:{maxAdditionalComments:15000}});await start(h);
 let s=h.controller.state;assert.equal(s.cachedAdditional,15000);assert.equal(s.appliedAdditional,15000);
 const requests=h.srv.calls.length;const full=h.last();
 await h.controller.setAppliedCount(7500);s=h.controller.state;
 assert.equal(h.srv.calls.length,requests);assert.equal(s.cachedAdditional,15000);assert.equal(s.additionalCount,15000);
 assert.equal(s.appliedAdditional,7500);assert.equal(s.appliedTarget,7500);assert.equal(s.goal,15000,'fetch target is unchanged');
 // Same set as fetching only 7,500 first: the 7,500 closest to normal comments (fetch order).
 const seven=new Set(h.last());assert.equal(seven.size,7500);
 // The fetch goes back in time, so the fetch-order prefix = the 7,500 newest (smallest synthetic no).
 // (Comparing with a second controller is time dependent: its startWhen may fall in another second.)
 const no=id=>Number(id.slice('synthetic-id-'.length));
 const newest=[...full].sort((a,b)=>no(a)-no(b)).slice(0,7500);
 assert.deepEqual([...seven].sort(),newest.sort());
 const fresh=make({settings:{maxAdditionalComments:7500}});await start(fresh);
 assert.equal(fresh.last().length,7500);assert.equal(fresh.srv.calls.length,8);
 assert(full.length===15000&&[...seven].every(id=>full.includes(id)));
});
test('applied7500 -> applied0: normal only, cache kept, feature stays ON; 0 -> 15000 restores from cache without network',async()=>{
 const h=make({settings:{maxAdditionalComments:15000}});await start(h);const first=h.last();const clears=h.clears.length;
 await h.controller.setAppliedCount(7500);await h.controller.setAppliedCount(0);
 let s=h.controller.state;assert.equal(s.appliedAdditional,0);assert.equal(h.last().length,0);
 assert.equal(s.cachedAdditional,15000);assert.equal(s.enabled,true);assert.equal(h.clears.length,clears,'0 is not OFF');
 const requests=h.srv.calls.length;
 await h.controller.setAppliedCount(15000);s=h.controller.state;
 assert.equal(h.srv.calls.length,requests);assert.equal(s.appliedAdditional,15000);assert.deepEqual([...h.last()].sort(),[...first].sort());
});
test('cached5000 -> applied15000 fetches only the missing part from the saved cursor',async()=>{
 const h=make({settings:{maxAdditionalComments:5000}});await start(h);
 assert.equal(h.srv.calls.length,5);const before=new Set(h.srv.calls);const firstFive=h.last();
 await h.controller.setAppliedCount(15000);const s=h.controller.state;
 assert.equal(h.srv.calls.length,15,'10 more pages only');
 assert(h.srv.calls.slice(5).every(w=>!before.has(w)),'no already fetched cursor is requested again');
 assert.equal(s.cachedAdditional,15000);assert.equal(s.appliedAdditional,15000);assert.equal(s.goal,15000);
 assert(firstFive.every(id=>h.last().includes(id)));
});
test('5000 -> 15000 -> 7500 -> 5000 -> 15000 keeps the same first 5,000 and the same ordered prefix, without duplicates',async()=>{
 const h=make({settings:{maxAdditionalComments:5000}});await start(h);const five=h.last();
 await h.controller.setAppliedCount(15000);const all=h.last();
 await h.controller.setAppliedCount(7500);const seven=h.last();
 await h.controller.setAppliedCount(5000);const fiveAgain=h.last();
 await h.controller.setAppliedCount(15000);const allAgain=h.last();
 assert.deepEqual([...fiveAgain].sort(),[...five].sort());
 assert(five.every(id=>seven.includes(id)));assert.deepEqual([...allAgain].sort(),[...all].sort());
 for(const ids of [five,all,seven,fiveAgain,allAgain])assert.equal(new Set(ids).size,ids.length,'no duplicate comment');
 assert.equal(h.srv.calls.length,15);
});
test('a partial fetch never claims more than the cache: failure at 12,000 gives cached12000/applied12000',async()=>{
 const h=make({settings:{maxAdditionalComments:5000},failAfterPages:12});await start(h);
 await h.controller.setAppliedCount(15000);const s=h.controller.state;
 assert.equal(s.cachedAdditional,12000);assert.equal(s.appliedAdditional,12000);assert(s.appliedAdditional<=s.cachedAdditional);
 assert.equal(s.phase,'partial');assert.equal(s.appliedTarget,15000);
});
test('applied target above the cache when nothing more can be fetched applies everything without network',async()=>{
 const h=make({settings:{maxAdditionalComments:5000},failAfterPages:5});await start(h);
 await h.controller.setAppliedCount(10000);const requests=h.srv.calls.length;// the failing continuation
 await h.controller.setAppliedCount(2500);assert.equal(h.controller.state.appliedAdditional,2500);
 assert.equal(h.srv.calls.length,requests);
});
test('OFF releases the cache (existing rule); 0 and OFF are different states',async()=>{
 const h=make({settings:{maxAdditionalComments:5000}});await start(h);await h.controller.setAppliedCount(0);
 assert.equal(h.controller.state.cachedAdditional,5000);const clears=h.clears.length;
 h.prefs.setEnabled(false);const s=h.controller.state;
 assert.equal(s.enabled,false);assert.equal(s.cachedAdditional,0);assert.equal(s.appliedAdditional,0);assert.equal(s.cacheAvailable,false);assert.equal(h.clears.length,clears+1);
 await h.controller.setAppliedCount(5000);assert.equal(h.srv.calls.length,5,'no fetch while OFF');
});
test('switching video releases the previous cache and never mixes it into the next video',async()=>{
 const h=make({settings:{maxAdditionalComments:5000}});await start(h);await h.controller.setAppliedCount(1000);
 h.controller.invalidate();let s=h.controller.state;assert.equal(s.cachedAdditional,0);assert.equal(s.cacheAvailable,false);
 await h.controller.normalReady(normal('sm2'));await h.controller.whenIdle();s=h.controller.state;
 assert.equal(s.videoId,'sm2');assert.equal(s.cachedAdditional,5000);assert.equal(s.appliedTarget,5000);
});
test('more() after reducing still fetches the next quota and applies the new fetch target',async()=>{
 const h=make({settings:{maxAdditionalComments:5000}});await start(h);await h.controller.setAppliedCount(1000);
 await h.controller.more();const s=h.controller.state;assert.equal(s.goal,10000);assert.equal(s.cachedAdditional,10000);assert.equal(s.appliedAdditional,10000);
});
test('invalid applied counts are rejected without changing state',async()=>{
 const h=make();await start(h);const before=JSON.stringify(h.controller.state);
 for(const v of [-1,20001,1.5,NaN,'abc'])assert.throws(()=>h.controller.setAppliedCount(v),TypeError);
 assert.equal(JSON.stringify(h.controller.state),before);
});
test('the history store keeps a deterministic fetch order across continuation (resume) for subsets',()=>{
 const context=normalizeWatch(watch(),'sm1');const s=new LayeredCommentStore(context);
 const page=(from,n)=>[{id:'10',fork:'main',commentCount:9,comments:Array.from({length:n},(_,i)=>comment(from+i,NOW-(from+i)))}];
 s.addNormal(page(1,1));s.addHistory(page(50,3));s.addHistory(page(10,3));s.addHistory(page(1,2));// 1 overlaps normal
 const ids=snap=>snap.flatMap(t=>t.comments.map(c=>c.no));
 assert.deepEqual(ids(s.snapshot({historyOnly:true,historyLimit:4})).sort((a,b)=>a-b),[10,50,51,52]);
 assert.deepEqual(s.additionalOrder().length,7);
 const restored=new LayeredCommentStore(context);restored.addNormal(page(1,1));restored.addHistory(s.historySnapshot());restored.restoreAdditionalOrder(s.additionalOrder());
 assert.deepEqual(ids(restored.snapshot({historyOnly:true,historyLimit:4})).sort((a,b)=>a-b),[10,50,51,52]);
 assert.deepEqual(ids(s.snapshot({historyOnly:true,historyLimit:0})),[]);
});
test('display preparation source does not depend on Task206 simultaneous display limit',()=>{
 for(const f of ['controller.mjs','panel.mjs','renderer.mjs','layers.mjs','session.mjs'])
  assert(!fs.readFileSync(new URL('../src/'+f,import.meta.url),'utf8').includes('maxDisplayComment'),f);
});
