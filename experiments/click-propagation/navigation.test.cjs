'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path');
const {stripTypeScriptTypes}=require('node:module');
const {JSDOM}=require('jsdom');
const code=stripTypeScriptTypes(fs.readFileSync(path.join(__dirname,'ClickNavigationTrial.ts'),'utf8'));
function setup(){
 const w=new JSDOM('<body><main><a href="/watch/sm9"><span id="hit">video</span></a></main></body>',{url:'https://www.nicovideo.jp/search/test',runScripts:'outside-only'}).window;
 const calls=[],logs=[],order=[];w.open=(...args)=>{calls.push(args);return 'original-result';};const original=w.open;
 w.navigation=new w.EventTarget();w.console.info=s=>logs.push(JSON.parse(s.slice('ZENZA_CLICK_TRIAL '.length)));
 w.eval(code+';window.Subject=ClickNavigationTrial;');
 w.document.addEventListener('click',e=>w.Subject.begin(w,e,'sm9',()=>{assert.equal(w.open,original);order.push('launch');}),true);
 w.document.body.addEventListener('click',()=>order.push('observer'));
 const click=()=>w.document.querySelector('#hit').dispatchEvent(new w.MouseEvent('click',{bubbles:true,cancelable:true,composed:true}));
 const tick=()=>new Promise(r=>w.setTimeout(r,20));
 return {w,calls,logs,order,original,click,tick};
}
test('original click reaches observers before launch; only matching video popup is blocked',async()=>{
 const f=setup();try{
  f.w.document.querySelector('main').addEventListener('click',()=>{
   assert.equal(f.w.open('/watch/sm9?ref=header','_blank'),null);
   assert.equal(f.w.open('/user/9','_blank'),'original-result');
   assert.equal(f.w.open('https://example.org/watch/sm9'),'original-result');
  });
  f.click();assert.deepEqual(f.order,['observer']);await f.tick();
  assert.deepEqual(f.order,['observer','launch']);assert.equal(f.calls.length,2);
  assert.equal(f.logs[0].windowOpenBlocked,1);assert.equal(f.logs[0].bodyReached,true);
  assert.equal(f.w.open,f.original);f.w.open('/watch/sm9');assert.equal(f.calls.length,3);
 }finally{f.w.close();}
});
test('matching cancelable navigation is stopped; other destinations are untouched',async()=>{
 const f=setup();try{
  f.w.document.querySelector('main').addEventListener('click',()=>{
   for(const [url,blocked] of [['https://www.nicovideo.jp/watch/sm9',true],['https://www.nicovideo.jp/watch/sm99',false]]){
    const e=new f.w.Event('navigate',{cancelable:true});e.destination={url};f.w.navigation.dispatchEvent(e);assert.equal(e.defaultPrevented,blocked);
   }
  });f.click();await f.tick();assert.equal(f.logs[0].navigationBlocked,1);
  const e=new f.w.Event('navigate',{cancelable:true});e.destination={url:'https://www.nicovideo.jp/watch/sm9'};f.w.navigation.dispatchEvent(e);assert.equal(e.defaultPrevented,false);
 }finally{f.w.close();}
});
test('upstream propagation stop is diagnosed rather than replaying a synthetic click',async()=>{
 const f=setup();try{
  f.w.document.querySelector('main').addEventListener('click',e=>e.stopPropagation());
  f.click();await f.tick();assert.deepEqual(f.order,['launch']);assert.equal(f.logs[0].bodyReached,false);
  assert.equal(f.logs[0].stopped,true);
 }finally{f.w.close();}
});
test('overlapping dispatches restore window.open without leaving wrappers behind',async()=>{
 const f=setup();try{f.click();f.click();await f.tick();assert.equal(f.w.open,f.original);assert.equal(f.logs.length,2);}finally{f.w.close();}
});
