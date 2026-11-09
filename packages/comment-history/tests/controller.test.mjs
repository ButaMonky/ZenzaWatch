import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs';
import {HistorySession} from '../src/session.mjs';import {RequestCoordinator} from '../src/coordinator.mjs';
import {DEFAULT_SETTINGS} from '../src/settings.mjs';import {watch,comment,KEY} from './fixtures.mjs';
const file=new URL('../src/controller.mjs',import.meta.url);
const module=fs.existsSync(file)?await import(file):{};
function preferences(enabled=true,settings={}){let state={enabled,settings:{...DEFAULT_SETTINGS,maxAdditionalComments:2,...settings}};const listeners=new Set();return {get:()=>state,subscribe:f=>(listeners.add(f),()=>listeners.delete(f)),setEnabled:v=>{state={...state,enabled:v};for(const f of listeners)f(state);}};}
function normal(videoId='sm1') {const nv=watch(videoId).data.response.$watchV4.data.comment.nvComment;return {generation:'play-'+videoId,videoInfo:{videoId,contextWatchId:videoId,duration:100,msgInfo:{videoId,nvComment:nv,threads:[{id:'10',fork:1,forkLabel:'owner',label:'owner',layer:{index:0}},{id:'10',fork:0,forkLabel:'main',label:'default',layer:{index:0}}]}},result:{format:'threads',threadInfo:{videoId,threadId:'10',language:'ja-jp',isWaybackMode:false},body:{threads:[{id:'10',fork:'owner',commentCount:0,comments:[]},{id:'10',fork:'main',commentCount:50,comments:[comment(9,1700000009)]}]}}};}
function make(options={}){assert.equal(typeof module.CommentHistoryController,'function');const calls=[],clears=[],notices=[],prefs=options.preferences??preferences();let clock=0;
 const controller=new module.CommentHistoryController({preferences:prefs,render:async(data,o)=>{assert(o.isCurrent());calls.push(data);return {additionalCount:data.threads.reduce((n,t)=>n+t.comments.length,0)};},clearRender:()=>clears.push(1),notify:m=>notices.push(m),createSession:(context,o)=>new HistorySession(context,{...o,coordinator:new RequestCoordinator({settings:o.settings,now:()=>clock,sleep:async n=>{clock+=n;}}),fetchPage:options.fetchPage??(async()=>[{id:'10',fork:'main',commentCount:50,comments:[comment(1,1700000001),comment(2,1700000002),comment(3,1700000003),comment(4,1700000004)]}])}),...options});return {controller,calls,clears,notices,prefs};}
test('disabled stays idle; enabling automatically starts after a normal load',async()=>{const h=make({preferences:preferences(false)});await h.controller.normalReady(normal());assert.equal(h.calls.length,0);h.prefs.setEnabled(true);await h.controller.whenIdle();assert.equal(h.calls.length,1);assert.equal(h.controller.state.phase,'ready');assert.equal(h.controller.state.additionalCount,2);});
test('completed history is applied once, and continuation increases the total by the configured step',async()=>{const h=make();await h.controller.normalReady(normal());assert.equal(h.calls.length,1);await h.controller.more();assert.equal(h.calls.length,2);assert.equal(h.controller.state.additionalCount,4);assert.equal(h.controller.state.goal,4);});
test('automatic continuation across videos clears old data and waits for new normal metadata',async()=>{const h=make();await h.controller.normalReady(normal('sm1'));h.controller.invalidate();assert.equal(h.controller.state.additionalCount,0);await h.controller.normalReady(normal('sm2'));assert.equal(h.calls.length,2);assert.equal(h.controller.state.videoId,'sm2');assert.equal(h.controller.state.enabled,true);});
test('OFF cancels obsolete work and late completion cannot reapply it',async()=>{let release;const h=make({fetchPage:()=>new Promise(r=>release=r)});const pending=h.controller.normalReady(normal());await new Promise(r=>setImmediate(r));h.prefs.setEnabled(false);release([{id:'10',fork:'main',commentCount:0,comments:[]}]);await pending;assert.equal(h.calls.length,0);assert.equal(h.controller.state.enabled,false);assert.equal(h.controller.state.additionalCount,0);});
test('manual stop keeps successful partial pages and leaves next-video auto mode enabled',async()=>{let count=0,release;const h=make({preferences:preferences(true,{maxAdditionalComments:5}),fetchPage:async()=>++count===1?[{id:'10',fork:'main',commentCount:10,comments:[comment(3,1700000003),comment(4,1700000004)]}]:new Promise(r=>release=r)});const pending=h.controller.normalReady(normal());while(!release)await new Promise(r=>setImmediate(r));h.controller.stop();await pending;assert.equal(h.calls.length,1);assert.equal(h.controller.state.additionalCount,2);assert.equal(h.controller.state.enabled,true);assert.equal(h.controller.state.phase,'partial');assert.equal(h.notices.length,0);release([]);});
test('failure uses valid partial result once and emits one notification',async()=>{let n=0;const h=make({preferences:preferences(true,{maxAdditionalComments:5}),fetchPage:async()=>{if(n++)throw Object.assign(new Error('sensitive'),{code:'API_ERROR'});return [{id:'10',fork:'main',commentCount:10,comments:[comment(3,1700000003),comment(4,1700000004)]}];}});await h.controller.normalReady(normal());assert.equal(h.calls.length,1);assert.equal(h.notices.length,1);assert.equal(h.controller.state.phase,'partial');const diagnostic=JSON.stringify(h.controller.state);for(const secret of [KEY,'SYNTHETIC_BODY','SYNTHETIC_USER','sensitive'])assert(!diagnostic.includes(secret));});
test('acquisition failures notify once without leaking the original error',async()=>{const h=make({acquire:async()=>{throw new Error('private lock failure');}});await h.controller.normalReady(normal());assert.equal(h.controller.state.reason,'operation_failed');assert.equal(h.notices.length,1);assert(!JSON.stringify(h.controller.state).includes('private lock failure'));});

test('hiding during fetch prevents final application without cancelling successful cache',async()=>{
 let release;const h=make({fetchPage:()=>new Promise(r=>release=r)});const pending=h.controller.normalReady(normal());
 while(!release)await new Promise(r=>setImmediate(r));
 await h.controller.setHidden(true);release([{id:'10',fork:'main',commentCount:2,comments:[comment(2,1700000002),comment(3,1700000003)]}]);await pending;
 assert.equal(h.calls.length,0);assert.equal(h.controller.state.cachedAdditional,2);assert.equal(h.controller.state.hidden,true);
 await h.controller.setHidden(false);assert.equal(h.calls.length,1);assert.equal(h.controller.state.appliedAdditional,2);
});
test('hide invalidates pending display; rapid show re-applies without an error notification',async()=>{
 let release,control,calls=0;const h=make({render:async(data,o)=>{calls++;if(calls===1){control=o;await new Promise(r=>release=r);if(!o.isCurrent())throw Error('superseded');}return {additionalCount:2};}});
 const pending=h.controller.normalReady(normal());while(!release)await new Promise(r=>setImmediate(r));
 await h.controller.setHidden(true);assert.equal(control.isCurrent(),false);
 const showing=h.controller.setHidden(false);release();await pending;await showing;
 assert.equal(h.controller.state.hidden,false);assert.equal(h.controller.state.appliedAdditional,2);assert.equal(calls,2);assert.equal(h.notices.length,0);
});

test('hide while queued keeps the eventual cache without applying it',async()=>{
 let release;const h=make({acquire:async run=>{await new Promise(r=>release=r);return run();}});
 const pending=h.controller.normalReady(normal());assert.equal(h.controller.state.phase,'queued');
 await h.controller.setHidden(true);release();await pending;
 assert.equal(h.controller.state.hidden,true);assert.equal(h.controller.state.cachedAdditional,2);assert.equal(h.controller.state.appliedAdditional,0);assert.equal(h.calls.length,0);
 await h.controller.setHidden(false);assert.equal(h.calls.length,1);assert.equal(h.controller.state.appliedAdditional,2);
});

test('display limit changed during a pending render invalidates the old result and applies new cap',async()=>{
 let cap=2,release,control;const sizes=[];
 const h=make({displayLimit:()=>cap,render:async(data,o)=>{const n=data.threads.reduce((v,t)=>v+t.comments.length,0);sizes.push(n);if(sizes.length===1){control=o;await new Promise(r=>release=r);if(!o.isCurrent())throw Error('superseded');}return {additionalCount:n};}});
 const pending=h.controller.normalReady(normal());while(!release)await new Promise(r=>setImmediate(r));
 cap=1;h.prefs.setEnabled(true);assert.equal(control.isCurrent(),false);release();await pending;
 assert.deepEqual(sizes,[2,1]);assert.equal(h.controller.state.appliedAdditional,1);assert.equal(h.notices.length,0);
});
test('cached slider requests queued behind a render keep only the latest',async()=>{
 let release,first=true;const sizes=[];const h=make({render:async(data)=>{const n=data.threads.reduce((v,t)=>v+t.comments.length,0);sizes.push(n);if(first){first=false;await new Promise(r=>release=r);}return {additionalCount:n};}});
 const initial=h.controller.normalReady(normal());while(!release)await new Promise(r=>setImmediate(r));
 const a=h.controller.setCachedCount(1),b=h.controller.setCachedCount(0);release();await initial;await a;await b;
 assert.deepEqual(sizes,[2,0]);assert.equal(h.controller.state.appliedAdditional,0);
});

test('queued slider commit cannot affect the next video',async()=>{
 let release,first=true;const sizes=[];const h=make({render:async data=>{const n=data.threads.reduce((v,t)=>v+t.comments.length,0);sizes.push(n);if(first){first=false;await new Promise(r=>release=r);}return {additionalCount:n};}});
 const old=h.controller.normalReady(normal());while(!release)await new Promise(r=>setImmediate(r));
 const queued=h.controller.setCachedCount(0);await h.controller.normalReady(normal('sm2'));release();await old;await queued;
 assert.equal(h.controller.state.videoId,'sm2');assert.equal(h.controller.state.appliedAdditional,2);assert.deepEqual(sizes,[2,2]);
});
test('loading an exhausted selection does not restart its network request',async()=>{
 let requests=0;const h=make({fetchPage:async()=>{requests++;return [];}});await h.controller.normalReady(normal());
 const before=requests;await h.controller.loadSelectedCount();assert.equal(requests,before);
});
