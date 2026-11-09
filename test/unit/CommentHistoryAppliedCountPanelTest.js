'use strict';
// Task207: the C-3 panel shows "取得済み / 適用中" and lets the applied additional count go down (including 0)
// without touching the fetch step select or Task206's simultaneous display limit.
const assert=require('assert');
const {JSDOM}=require('jsdom');
const {beginSection,createContext,run}=require('../helpers/extractSource');
function setup(state={}){
 const dom=new JSDOM('<!doctype html><html><head></head><body><button class="commentHistorySwitch"></button></body></html>',{url:'https://www.nicovideo.jp/watch/sm9'});
 const win=dom.window;const c=createContext({window:win,document:win.document,CustomEvent:win.CustomEvent,AbortController:win.AbortController,console});
 run(beginSection('packages/comment-history/src/generated/ZenzaCommentHistoryCore.generated.js')+'; globalThis.__history=ZenzaCommentHistoryCore;',c);
 const H=c.__history;const listeners=new Set();const calls=[];
 let s=Object.assign({enabled:true,phase:'ready',videoId:'sm9',goal:15000,additionalCount:15000,cachedAdditional:15000,appliedAdditional:15000,appliedTarget:15000,
  cacheAvailable:true,normalCount:1000,pages:15,reason:'comment_limit',canContinue:true},state);
 const controller={get state(){return JSON.parse(JSON.stringify(s));},subscribe(fn){listeners.add(fn);fn(this.state);return()=>listeners.delete(fn);},
  setCachedCount(n){calls.push(n);s={...s,appliedTarget:n,appliedAdditional:Math.min(n,s.cachedAdditional)};for(const f of listeners)f(this.state);return Promise.resolve(this.state);},
  setEnabled(){},stop(){},more(){calls.push('more');},restart(){calls.push('restart');}};
 const prefs={get:()=>({valid:true,enabled:true,settings:{maxAdditionalComments:5000,includeEasy:false}}),subscribe:()=>()=>{},patch(){calls.push('patch');}};
 const panel=new H.CommentHistoryPanel({controller,preferences:prefs,window:win,anchor:()=>win.document.querySelector('.commentHistorySwitch')});
 panel.open();
 const q=sel=>win.document.querySelector('.zenzaCommentHistoryPanel '+sel);
 const update=next=>{s={...s,...next};for(const f of listeners)f(controller.state);};
 return {H,win,panel,q,calls,update,close(){panel.dispose();dom.window.close();}};
}
describe('Compact comment-history percentage panel in the generated runtime',function(){
 this.timeout(15000);
 it('keeps fetch presets but uses a bounded percentage range for additional comments',function(){
  const r=setup();try{
   assert.deepStrictEqual([...r.q('[data-ch-quota]').options].map(o=>Number(o.value)),[1000,2500,5000,7500,10000,15000,20000]);
   const slider=r.q('[data-ch-applied-target]');assert.equal(slider.type,'range');assert.equal(slider.min,'0');assert.equal(slider.max,'100');
   assert.equal(slider.getAttribute('aria-label'),'追加コメント数');assert.equal(r.q('[data-ch-quota]').getAttribute('aria-label'),'読み込むコメント数');
  }finally{r.close();}
 });
 it('previews the count while dragging and commits cached comments only on release',function(){
  const r=setup({appliedTarget:2500,appliedAdditional:2500});try{
   const slider=r.q('[data-ch-applied-target]');assert.equal(slider.value,'50');
   assert.equal(r.q('[data-ch-apply-summary]').textContent,'2,500 / 5,000 件（50%）');
   slider.value='37';slider.dispatchEvent(new r.win.Event('input',{bubbles:true}));assert.deepStrictEqual(r.calls,[]);
   assert.equal(r.q('[data-ch-apply-summary]').textContent,'1,850 / 5,000 件（37%）');
   slider.dispatchEvent(new r.win.Event('change',{bubbles:true}));assert.deepStrictEqual(r.calls,[1850]);
   slider.value='0';slider.dispatchEvent(new r.win.Event('change',{bubbles:true}));assert.deepStrictEqual(r.calls,[1850,0]);
   assert.equal(r.q('[data-ch-enabled]').checked,true);assert.equal(r.q('[data-ch-cached]').textContent,'15,000');
  }finally{r.close();}
 });
 it('disables the range while running, OFF or empty and keeps the idle panel compact',function(){
  const r=setup();try{
   const slider=r.q('[data-ch-applied-target]');assert(!slider.disabled);assert(r.q('.ch-progress').hidden);assert.equal(r.q('.ch-counter'),null);
   r.update({phase:'fetching'});assert(slider.disabled);assert(!r.q('.ch-progress').hidden);
   r.update({phase:'ready',enabled:false,cacheAvailable:false,cachedAdditional:0,appliedAdditional:0,appliedTarget:0});assert(slider.disabled);
   assert.equal(r.q('[data-ch-apply-summary]').textContent,'0 / 0 件（0%）');
   r.update({enabled:true,phase:'idle'});assert(slider.disabled);
  }finally{r.close();}
 });
 it('uses actual partial-cache size as the 100 percent maximum',function(){
  const r=setup({cachedAdditional:4321,additionalCount:4321,appliedAdditional:4321,appliedTarget:15000,phase:'partial',reason:'api_error'});try{
   assert.equal(r.q('[data-ch-applied-target]').value,'100');assert.equal(r.q('[data-ch-apply-summary]').textContent,'4,321 / 4,321 件（100%）');
   r.update({appliedTarget:2160,appliedAdditional:2160});assert.equal(r.q('[data-ch-applied-target]').value,'50');
   assert.equal(r.q('[data-ch-apply-summary]').textContent,'2,160 / 4,321 件（50%）');
  }finally{r.close();}
 });
});
