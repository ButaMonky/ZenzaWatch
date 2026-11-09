import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {CommentHistoryPanel} from '../src/panel.mjs';
const {JSDOM}=createRequire(import.meta.url)('jsdom');
function setup(extra={}){
 const dom=new JSDOM('<html><head></head><body><button id="anchor"></button></body></html>');const win=dom.window;
 let state={enabled:true,hidden:false,videoId:'sm1',phase:'ready',goal:10000,additionalCount:10000,cachedAdditional:10000,appliedAdditional:2500,appliedTarget:2500,cacheAvailable:true,normalCount:1000,pages:10,canContinue:true,...extra};
 let pref={valid:true,enabled:true,settings:{maxAdditionalComments:5000,includeEasy:false}};
 const listeners=new Set(),pl=new Set(),calls=[];
 const controller={get state(){return state;},subscribe(fn){listeners.add(fn);fn(state);return()=>listeners.delete(fn);},setCachedCount(n){calls.push(n);update({appliedTarget:n,appliedAdditional:n});return Promise.resolve(state);},setHidden(v){update({hidden:v});return Promise.resolve(state);}};
 const preferences={get:()=>pref,subscribe(fn){pl.add(fn);return()=>pl.delete(fn);},patch(c){pref={...pref,settings:{...pref.settings,...c}};for(const f of pl)f(pref);}};
 const panel=new CommentHistoryPanel({controller,preferences,window:win,anchor:()=>win.document.querySelector('#anchor')});panel.open();
 const q=sel=>panel.view.querySelector(sel);
 function update(next){state={...state,...next};for(const fn of listeners)fn(state);}
 return {q,win,panel,calls,update,preferences,close(){panel.dispose();win.close();}};
}
test('compact panel keeps details closed, labels explicit and only shows progress while running',()=>{
 const h=setup();try{
  assert.equal(h.q('[data-ch-applied-target]').type,'range');assert.equal(h.q('[data-ch-applied-target]').max,'100');
  assert.equal(h.q('[data-ch-applied-target]').getAttribute('aria-label'),'追加コメント数');
  assert.equal(h.q('[data-ch-quota]').getAttribute('aria-label'),'読み込むコメント数');
  assert.equal(h.q('details').open,false);assert.equal(h.q('.ch-progress').hidden,true);
  assert.equal(h.q('.ch-counter'),null);assert.equal(h.q('[data-ch-visibility]').textContent,'非表示');
  h.update({phase:'fetching'});assert.equal(h.q('.ch-progress').hidden,false);
 }finally{h.close();}
});
test('slider previews on input and commits cached count once on release; percentage is quota bounded',()=>{
 const h=setup();try{
  const slider=h.q('[data-ch-applied-target]');assert.equal(slider.value,'50');
  slider.value='37';slider.dispatchEvent(new h.win.Event('input'));
  assert.deepEqual(h.calls,[]);assert.equal(h.q('[data-ch-apply-summary]').textContent,'1,850 / 5,000 件（37%）');
  slider.dispatchEvent(new h.win.Event('change'));assert.deepEqual(h.calls,[1850]);
  slider.value='0';slider.dispatchEvent(new h.win.Event('input'));slider.dispatchEvent(new h.win.Event('change'));assert.deepEqual(h.calls,[1850,0]);
  assert.equal(h.q('[data-ch-enabled]').checked,true);
  h.preferences.patch({maxAdditionalComments:2500});slider.value='100';slider.dispatchEvent(new h.win.Event('change'));assert.equal(h.calls.at(-1),2500);
 }finally{h.close();}
});
test('partial cache bounds the slider; zero cache disables it and reports no additional comments',()=>{
 const h=setup({additionalCount:1234,cachedAdditional:1234,appliedAdditional:1234,appliedTarget:5000});try{
  const slider=h.q('[data-ch-applied-target]');assert.equal(slider.value,'100');
  assert.equal(h.q('[data-ch-apply-summary]').textContent,'1,234 / 1,234 件（100%）');
  slider.value='50';slider.dispatchEvent(new h.win.Event('change'));assert.deepEqual(h.calls,[617]);
  h.update({additionalCount:0,cachedAdditional:0,appliedTarget:0,appliedAdditional:0});assert(slider.disabled);
  assert.equal(h.q('[data-ch-visibility-status]').textContent,'増量分なし');assert(h.q('[data-ch-visibility]').disabled);
 }finally{h.close();}
});
test('pending slider preview cannot leak across video changes or quota changes',()=>{
 const h=setup();try{
  const slider=h.q('[data-ch-applied-target]');slider.value='15';slider.dispatchEvent(new h.win.Event('input'));
  h.update({videoId:'sm2',appliedTarget:5000,appliedAdditional:5000});assert.equal(slider.value,'100');
  slider.value='30';slider.dispatchEvent(new h.win.Event('input'));h.preferences.patch({maxAdditionalComments:2500});
  assert.equal(slider.value,'100');assert.deepEqual(h.calls,[]);
 }finally{h.close();}
});

test('closing an uncommitted slider preview restores the applied count when reopened',()=>{
 const h=setup();try{
  const slider=h.q('[data-ch-applied-target]');slider.value='12';slider.dispatchEvent(new h.win.Event('input'));
  h.panel.close();h.panel.open();assert.equal(slider.value,'50');assert.deepEqual(h.calls,[]);
 }finally{h.close();}
});
