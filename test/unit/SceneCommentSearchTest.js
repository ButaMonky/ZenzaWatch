'use strict';
const assert=require('assert');
const {JSDOM}=require('jsdom');
const {loadClass,createContext}=require('../helpers/extractSource');
function harness(chats=[],video='sm9',limit=100){
 const state={chats,video,seeks:[],emissions:[]};
 const C=loadClass('packages/zenza/src/sceneSearch/SceneCommentSearch.js','SceneCommentSearch',createContext());
 const search=new C({getChats:()=>state.chats,getVideoId:()=>state.video,
   seekTo:(time,hit)=>state.seeks.push({time,hit}),
   onResults:result=>state.emissions.push(result),limit});
 return {state,search};
}
function chat(text,vpos,more={}){return {text,vpos,no:7,uniqNo:17,...more};}
describe('SCUI-06 loaded-comment search engine',()=>{
 it('matches Unicode NFKC without modifying loaded comments',()=>{
   const chats=[chat('ＡＢＣ こんにちは',1200),chat('other',5000),chat('abc追加',3000)];
   const h=harness(chats),r=h.search.search('abc');
   assert.strictEqual(r.total,2);
   assert.deepStrictEqual(Array.from(r.hits,x=>Number(x.time)),[12,30]);
   assert.strictEqual(chats[0].text,'ＡＢＣ こんにちは');
   assert.strictEqual(h.search.select(0),true);
   assert.strictEqual(h.state.seeks[0].time,12);
   assert.strictEqual(h.state.seeks[0].hit.uniqNo,17);
 });
 it('ignores invalid entries and never requests external APIs',()=>{
   const chats=[null,{},chat('hello',NaN),chat('hello',-20),
     chat('HELLO',300),chat('hello',500)];
   const h=harness(chats),r=h.search.search('hel');
   assert.strictEqual(r.total,2);
   assert.strictEqual(r.truncated,false);
   assert.strictEqual(h.search.select(-1),false);
   assert.strictEqual(h.search.select(2),false);
   assert.strictEqual(h.search.select(1),true);
   assert.strictEqual(h.state.seeks[0].time,5);
 });
 it('limits retained hits but reports true total',()=>{
   const h=harness(Array.from({length:600},(_,i)=>chat('hot',i*100)), 'sm9',20);
   const r=h.search.search('hot');
   assert.strictEqual(r.total,600);
   assert.strictEqual(r.hits.length,20);
   assert.strictEqual(r.truncated,true);
   assert.strictEqual(h.search.select(200),false);
 });
 it('video switch invalidates stale results before selection',()=>{
   const h=harness([chat('alpha',100)],'sm9');
   h.search.search('alpha');
   h.state.video='sm10';
   assert.strictEqual(h.search.select(0),false);
   const r=h.search.search('alpha');
   assert.strictEqual(r.videoId,'sm10');
   h.state.chats=[];
   assert.strictEqual(h.search.search('alpha').total,0);
   h.search.reset();
   assert.strictEqual(h.search.state.query,'');
   h.search.dispose();
   h.search.search('alpha');
   assert.strictEqual(h.search.state.total,0);
 });
 it('truncates an excessive query and handles empty searches safely',()=>{
   const h=harness([chat('a'.repeat(200),1)]);
   assert.strictEqual(h.search.search('a'.repeat(200)).query.length,128);
   assert.strictEqual(h.search.search('   ').total,0);
   h.state.video=null;
   assert.strictEqual(h.search.search('a').total,0);
 });
});
describe('SCUI-06 isolated accessible search panel',()=>{
 function panelHarness(){
  const dom=new JSDOM('<!doctype html><html><body><main id="mount"></main></body></html>');
  const h=harness([chat('あいうえお',300),chat('かきくけこ',340)]);
  const Panel=loadClass('packages/zenza/src/sceneSearch/SceneCommentSearchPanel.js',
    'SceneCommentSearchPanel',createContext({document:dom.window.document}));
  const panel=new Panel({document:dom.window.document,search:h.search});
  panel.mount(dom.window.document.getElementById('mount'));
  return {...h,dom,panel,root:panel.root};
 }
 it('opens search and renders results as text, not HTML',()=>{
  const h=panelHarness();
  assert.strictEqual(h.root.hidden,true);h.panel.open();
  assert.strictEqual(h.root.hidden,false);
  const field=h.root.querySelector('[data-scui="query"]');
  field.value='あいう';
  field.dispatchEvent(new h.dom.window.Event('input',{bubbles:true}));
  const li=h.root.querySelectorAll('li');
  assert.strictEqual(li.length,1);
  assert(li[0].textContent.includes('0:03'));
  li[0].querySelector('button').click();
  assert.strictEqual(h.state.seeks[0].time,3);
  assert.strictEqual(h.root.hidden,true);
  h.panel.dispose();h.dom.window.close();
 });
 it('uses textContent for malicious comment text and limits results',()=>{
  const h=panelHarness();
  h.state.chats=[chat('<img src=x onerror=alert(1)> ABC',150)];
  h.panel.open();const field=h.root.querySelector('[data-scui="query"]');
  field.value='ABC';field.dispatchEvent(new h.dom.window.Event('input',{bubbles:true}));
  assert.strictEqual(h.root.querySelector('img'),null);
  assert(h.root.textContent.includes('<img src=x onerror=alert(1)>'));
  h.panel.reset();
  assert.strictEqual(field.value,'');
  h.panel.dispose();h.dom.window.close();
 });
 it('Escape closes and disposal detaches events',()=>{
  const h=panelHarness();h.panel.open();
  const input=h.root.querySelector('input');
  input.dispatchEvent(new h.dom.window.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
  assert.strictEqual(h.root.hidden,true);
  h.panel.dispose();
  assert.strictEqual(h.dom.window.document.querySelector('.zenzaSceneCommentSearch'),null);
  h.dom.window.close();
 });
 it('ignores a non-element click target without throwing or seeking',()=>{
  const h=panelHarness();h.panel.open();
  assert.doesNotThrow(()=>h.panel._handleClick({target:h.dom.window.document.createTextNode('comment')}));
  assert.strictEqual(h.state.seeks.length,0);
  h.panel.dispose();h.dom.window.close();
 });
});
