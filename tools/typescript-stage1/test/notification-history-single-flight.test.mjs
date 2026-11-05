import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {loadSource,flush} from './nonvisual-audit-source-harness.mjs';
const {JSDOM}=createRequire(import.meta.url)('jsdom');
const row=message=>({id:message,timestamp:1,level:'info',category:'general',message,videoId:'',source:'',details:{}});
function fixture(t){
 const dom=new JSDOM('<!doctype html><div class="activeTab" id="root"></div>');t.after(()=>dom.window.close());
 const pending=[],listeners=new Set(),root=dom.window.document.querySelector('#root');
 const journal={list(){return new Promise((resolve,reject)=>pending.push({resolve,reject}));},subscribe(fn){listeners.add(fn);return ()=>listeners.delete(fn);}};
 const panel=loadSource('nico-src/NotificationHistoryPanel.ts','NotificationHistoryPanel',{window:dom.window,document:dom.window.document,NotificationJournal:journal});
 const dispose=panel.mount(root),notify=()=>listeners.forEach(fn=>fn());
 return {dom,root,pending,notify,dispose};
}
test('AUD70 separate-turn notification burst shares one read with one dirty follow-up',async t=>{
 const h=fixture(t);await flush();assert.equal(h.pending.length,1);
 for(let i=0;i<10;i++){h.notify();await flush();}assert.equal(h.pending.length,1,'no concurrent full-history reads');
 h.pending[0].resolve([row('obsolete')]);await flush();assert.equal(h.pending.length,2);assert(!h.root.textContent.includes('obsolete'));
 h.pending[1].resolve([row('latest')]);await flush();assert(h.root.textContent.includes('latest'));assert.equal(h.pending.length,2);
});
test('AUD70 stale rejection cannot replace the queued current view with a failure',async t=>{
 const h=fixture(t);await flush();h.notify();await flush();assert.equal(h.pending.length,1);
 h.pending[0].reject(Error('older snapshot'));await flush();assert.equal(h.pending.length,2);assert(!h.root.textContent.includes('履歴の読み込みに失敗しました'));
 h.pending[1].resolve([row('recovered')]);await flush();assert(h.root.textContent.includes('recovered'));
});
for(const action of ['hide','dispose'])test('AUD70 '+action+' stops a dirty follow-up and pending display',async t=>{
 const h=fixture(t);await flush();h.notify();if(action==='hide')h.root.classList.remove('activeTab');else h.dispose();
 h.pending[0].resolve([row('obsolete')]);await flush();assert.equal(h.pending.length,1);assert(!h.root.textContent.includes('obsolete'));
});
test('AUD70 search change during read is applied only to the current follow-up',async t=>{
 const h=fixture(t);await flush();const input=h.root.querySelector('input');input.value='needle';input.dispatchEvent(new h.dom.window.Event('input'));
 h.pending[0].resolve([row('old needle')]);await flush();assert.equal(h.pending.length,2);
 h.pending[1].resolve([row('new needle'),row('other')]);await flush();assert.equal(h.root.querySelectorAll('.znh-entry').length,1);assert(h.root.textContent.includes('new needle'));
});

test('AUD70 current failure is reported and a later notification retries',async t=>{
 const h=fixture(t);await flush();h.pending[0].reject(Error('current failure'));await flush();
 assert(h.root.textContent.includes('履歴の読み込みに失敗しました'));
 h.notify();await flush();assert.equal(h.pending.length,2);h.pending[1].resolve([row('retry ok')]);await flush();assert(h.root.textContent.includes('retry ok'));
});
