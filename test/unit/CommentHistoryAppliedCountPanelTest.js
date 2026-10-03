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
  setAppliedCount(n){calls.push(n);s={...s,appliedTarget:n,appliedAdditional:Math.min(n,s.cachedAdditional)};for(const f of listeners)f(this.state);return Promise.resolve(this.state);},
  setEnabled(){},stop(){},more(){calls.push('more');},restart(){calls.push('restart');}};
 const prefs={get:()=>({valid:true,enabled:true,settings:{maxAdditionalComments:5000,includeEasy:false}}),subscribe:()=>()=>{},patch(){calls.push('patch');}};
 const panel=new H.CommentHistoryPanel({controller,preferences:prefs,window:win,anchor:()=>win.document.querySelector('.commentHistorySwitch')});
 panel.open();
 const q=sel=>win.document.querySelector('.zenzaCommentHistoryPanel '+sel);
 const update=next=>{s={...s,...next};for(const f of listeners)f(controller.state);};
 return {H,win,panel,q,calls,update,close(){panel.dispose();dom.window.close();}};
}
describe('Task207 comment-history applied count panel',function(){
 this.timeout(15000);
 it('offers 0 (before increase) to 20,000 including 7,500 and 15,000 for both fetch step and applied count',function(){
  const r=setup();try{
   const values=sel=>[...r.q(sel).options].map(o=>Number(o.value));
   assert.deepStrictEqual(values('[data-ch-quota]'),[1000,2500,5000,7500,10000,15000,20000]);
   assert.deepStrictEqual(values('[data-ch-applied-target]'),[0,1000,2500,5000,7500,10000,15000,20000]);
   assert(/増量前/.test(r.q('[data-ch-applied-target] option[value="0"]').textContent));
  }finally{r.close();}
 });
 it('shows fetched and applied separately and changes only the applied count',function(){
  const r=setup();try{
   const select=r.q('[data-ch-applied-target]');assert.strictEqual(select.disabled,false);
   assert.strictEqual(r.q('[data-ch-apply-summary]').textContent,'取得済み 15,000 件 · 適用中 15,000 件');
   select.value='7500';select.dispatchEvent(new r.win.Event('change',{bubbles:true}));
   assert.deepStrictEqual(r.calls,[7500]);
   assert.strictEqual(r.q('[data-ch-apply-summary]').textContent,'取得済み 15,000 件 · 適用中 7,500 件');
   assert.strictEqual(r.q('[data-ch-cached]').textContent,'15,000');assert.strictEqual(r.q('[data-ch-applied]').textContent,'7,500');
   assert(/一部を適用中/.test(r.q('[data-ch-status]').textContent));
   select.value='0';select.dispatchEvent(new r.win.Event('change',{bubbles:true}));
   assert.deepStrictEqual(r.calls,[7500,0]);assert(/増量前の表示/.test(r.q('[data-ch-status]').textContent));
   assert.strictEqual(r.q('[data-ch-enabled]').checked,true,'applied 0 keeps the feature ON');
   assert.strictEqual(r.q('[data-ch-quota]').value,'5000','fetch step is untouched');
  }finally{r.close();}
 });
 it('is disabled while fetching, while OFF and before any cache exists',function(){
  const r=setup();try{
   const select=r.q('[data-ch-applied-target]');
   r.update({phase:'fetching'});assert.strictEqual(select.disabled,true);
   r.update({phase:'ready',enabled:false,cacheAvailable:false,cachedAdditional:0,appliedAdditional:0,appliedTarget:0});assert.strictEqual(select.disabled,true);
   assert.strictEqual(r.q('[data-ch-apply-summary]').textContent,'');
   r.update({enabled:true,phase:'idle'});assert.strictEqual(select.disabled,true);
  }finally{r.close();}
 });
 it('shows a non-preset applied target (partial fetch) without losing the value',function(){
  const r=setup({cachedAdditional:12000,additionalCount:12000,appliedAdditional:12000,appliedTarget:15000,phase:'partial',reason:'api_error'});try{
   assert.strictEqual(r.q('[data-ch-applied-target]').value,'15000');
   assert.strictEqual(r.q('[data-ch-apply-summary]').textContent,'取得済み 12,000 件 · 適用中 12,000 件');
   r.update({appliedTarget:4321,appliedAdditional:4321});assert.strictEqual(r.q('[data-ch-applied-target]').value,'4321');
  }finally{r.close();}
 });
});
