const {test}=require('node:test'),assert=require('node:assert/strict');
const {JSDOM}=require('jsdom');
const {createPreflight,classifyWatchPage}=require('./generated/preflight');
const Parser=new JSDOM('').window.DOMParser;
const html=data=>'<meta name="server-response" content="'+JSON.stringify({data:{response:data}}).replaceAll('&','&amp;').replaceAll('"','&quot;')+'">';
const ready=html({client:{watchId:'sm9'},video:{id:'sm9'},media:{domand:{accessRightKey:'not-retained'}}});
test('preflight distinguishes explicit unavailable, metadata available and uncertainty',()=>{
 assert.equal(classifyWatchPage(ready,200,Parser),'available');
 assert.equal(classifyWatchPage(html({errorCode:'NOT_FOUND'}),200,Parser),'unavailable');
 assert.equal(classifyWatchPage(html({errorCode:'FORBIDDEN'}),200,Parser),'unavailable');
 for(const body of ['login','<meta name="server-response" content="bad">',html({video:{id:'sm9'}})])assert.equal(classifyWatchPage(body,200,Parser),'unknown');
 assert.equal(classifyWatchPage(ready,503,Parser),'unknown');
});
test('preflight deduplicates, caps concurrency, caches statuses and expires',async()=>{
 let count=0,active=0,max=0,clock=0;const release=[];
 const api=createPreflight(async(url,options)=>{count++;active++;max=Math.max(max,active);assert.equal(options.credentials,'include');assert(url.startsWith('https://www.nicovideo.jp/watch/'));await new Promise(r=>release.push(r));active--;return {status:200,text:async()=>ready};},Parser,()=>clock);
 const a=api.check('sm9'),again=api.check('sm9'),b=api.check('sm10'),c=api.check('sm11');assert.equal(count,2);assert.equal(a,again);
 release.shift()();await a;assert.equal(count,3);release.splice(0).forEach(r=>r());await Promise.all([b,c]);assert.equal(max,2);
 await api.check('sm9');assert.equal(count,3);clock=300001;const next=api.check('sm9');assert.equal(count,4);release.shift()();await next;api.dispose();assert.equal(await api.check('sm12'),'unknown');
});
test('preflight cancels active and queued checks without retrying or retaining transport',async()=>{
 let aborted=0,count=0;const api=createPreflight((url,{signal})=>{count++;return new Promise((resolve,reject)=>signal.addEventListener('abort',()=>{aborted++;reject(Error('abort'));}));},Parser);
 const jobs=[api.check('sm1'),api.check('sm2'),api.check('sm3')];api.dispose();assert.deepEqual(await Promise.all(jobs),['unknown','unknown','unknown']);assert.equal(aborted,2);assert.equal(count,2);
});
