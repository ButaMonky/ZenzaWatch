'use strict';
const assert=require('assert');
const path=require('path');
const {pathToFileURL}=require('url');
let select;
before(async()=>{
 const file=path.resolve('packages/zenza/src/resume/AutoResumePolicy.js');
 ({selectAutoResume:select}=await new Function('url','return import(url)')(pathToFileURL(file).href));
});
const videoId='sm123';
const duration=300;
const row=(time,now,video=videoId)=>({time,now,videoId:video});
const server=(time,updatedAt,video=videoId)=>
 ({time,...(updatedAt===undefined?{}:{updatedAt}),videoId:video});
const query=(rest={})=>({videoId,duration,...rest});
describe('P12-01 one automatic resume, no persistence side effects',()=>{
 it('selects the valid server position first, returns only one typed point',()=>{
  const v=select(query({server:server(155),local:[row(80,200),row(55,300)]}));
  assert.deepStrictEqual(v,{kind:'automatic',source:'server',time:155,videoId});
  assert(Object.isFrozen(v));
 });
 it('takes the latest valid local timestamp, not just array insertion order',()=>{
  assert.deepStrictEqual(select(query({local:[row(70,100),row(95,300),row(40,200)]})),
    {kind:'automatic',source:'local',time:95,recordedAt:300,videoId});
 });
 it('has stable first-item precedence on equal newest timestamps',()=>{
  assert.strictEqual(select(query({local:[row(37,300),row(51,300)]})).time,37);
 });
 it('does not mutate or sort caller history',()=>{
  const local=Object.freeze([Object.freeze(row(77,100)),Object.freeze(row(54,200))]);
  const before=JSON.stringify(local);
  assert.strictEqual(select(query({local})).time,54);
  assert.strictEqual(JSON.stringify(local),before);
 });
 it('rejects malformed, edge-clipped, infinite, coerced and oversized values',()=>{
  for(const time of [-1,0,10,290,300,301,NaN,Infinity,'65',null,undefined]){
    assert.strictEqual(select(query({server:server(time),local:[]})),null,String(time));
  }
  assert.strictEqual(select(query({server:server(11),duration:20})),null);
  assert.strictEqual(select(query({server:server(11),duration:Infinity})),null);
 });
 it('rejects stale local values but may accept a good server position',()=>{
  const r=select(query({server:server(90),local:[row(95,2),row(250,'bad'),
    row(20,NaN),row(35,-1),row(25,1)]}));
  assert.strictEqual(r.source,'server');
 });
 it('isolates video IDs for both input sources',()=>{
  assert.strictEqual(select(query({server:server(70,undefined,'sm999'),
    local:[row(60,20,'sm999')]})),null);
 });
 it('cleared completion hides old server without timestamp and old local history',()=>{
  assert.strictEqual(select(query({server:server(120),local:[row(60,100)],
    clear:{at:200,reason:'completed',videoId}})),null);
 });
 it('manual deletion hides old history too, without mutating the original',()=>{
  const data={server:server(120),local:[row(60,100)],
    clear:{at:200,reason:'deleted',videoId}};
  assert.strictEqual(select(query(data)),null);
  assert.strictEqual(data.local.length,1);
 });
 it('accepts a new local point after clear but never resurrects an unknown-age server',()=>{
  const v=select(query({server:server(120),local:[row(70,90),row(80,240)],
    clear:{at:200,reason:'deleted',videoId}}));
  assert.strictEqual(v.source,'local');
  assert.strictEqual(v.time,80);
 });
 it('accepts only a proven post-clear server timestamp',()=>{
  assert.strictEqual(select(query({server:server(110,200),
    clear:{at:200,reason:'completed',videoId}})),null);
  const v=select(query({server:server(110,201),
    clear:{at:200,reason:'completed',videoId}}));
  assert.strictEqual(v.source,'server');
  assert.strictEqual(v.recordedAt,201);
 });
 it('invalid clear marker fails closed, not by falling back to old history',()=>{
  assert.strictEqual(select(query({server:server(123),local:[row(55,100)],
    clear:{at:'invalid',reason:'deleted'}})),null);
 });
 it('never leaks a clear barrier from another video',()=>{
  assert.strictEqual(select(query({server:server(123),
    clear:{at:200,reason:'completed',videoId:'sm999'}})),null);
 });
 it('returns no point for an empty video ID or no valid sources',()=>{
  assert.strictEqual(select({videoId:'',duration,local:[row(70,100)]}),null);
  assert.strictEqual(select(query({local:[],server:null})),null);
 });
});
