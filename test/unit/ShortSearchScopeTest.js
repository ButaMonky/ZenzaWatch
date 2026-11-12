'use strict';
// #245: no real NicoNico API calls; every request is a deterministic synthetic fake.
const assert=require('node:assert/strict');
const {beginSection,createContext,run,loadClass}=require('../helpers/extractSource');
const {describe,it}=typeof global.describe==='function'?global:require('node:test');
const tick=async()=>{await new Promise(r=>setImmediate(r));await new Promise(r=>setImmediate(r));};
const resp=(body)=>({
  status:200,headers:{get:()=>null},json:async()=>body,text:async()=>JSON.stringify(body)
});
const page=(n,total=1500)=>({meta:{status:200},data:{
  items:Array.from({length:100},(_,i)=>({id:'sm'+(n*100+i),duration:100})),
  totalCount:total,hasNext:true}});
const snapItem=(i)=>({contentId:'sm'+i,title:'Synthetic '+i,description:'',
  startTime:'2026-01-01T00:00:00+09:00',thumbnailUrl:'https://invalid.example/'+i,
  lengthSeconds:90,commentCounter:0,mylistCounter:0,viewCounter:0,likeCounter:0});
function harness(){
  const calls=[],gateCalls=[],pendingSleep=[],quiet={log(){},info(){},warn(){},error(){}};
  let netRoute=async()=>resp(page(1)),gateRoute=async()=>resp({
    meta:{status:200,totalCount:500},data:Array.from({length:100},(_,i)=>snapItem(i))});
  const ctx=createContext({
    URL,URLSearchParams,
    window:{console:quiet},console:quiet,sessionStorage:{},WindowMessageEmitter:{},
    textUtil:{dateToString:date=>date.toISOString()},
    netUtil:{fetch:(url)=>{calls.push(url);return netRoute(url);}},
    sleep:()=>new Promise(r=>pendingSleep.push(r)),
    CrossDomainGate:class{fetch(url){gateCalls.push(url);return gateRoute(url);}},
    CacheStorage:class{getItem(){return null}setItem(){}}
  });
  run(beginSection('packages/lib/src/nico/VideoSearch.js')+
    '\nglobalThis.__loader=NicoSearchApiV2Loader;',ctx);
  return {loader:ctx.__loader,calls,gateCalls,pendingSleep,
    routeNet:fn=>{netRoute=fn},routeGate:fn=>{gateRoute=fn}};
}


describe('Short search scope',()=>{
 for(const method of ['search','searchMore']){
  it(method+' sends short scope and keeps returned ss IDs',async()=>{
   const h=harness();
   h.routeNet(async()=>resp({meta:{status:200},data:{items:[{id:'ss9',duration:10}],totalCount:1,hasNext:false}}));
   const result=await h.loader[method]('test',{selectContentType:'short',searchType:'tag'});
   assert.equal(new URL(h.calls[0]).searchParams.get('selectContentType'),'short');
   assert.equal(new URL(h.calls[0]).searchParams.get('tag'),'test');
   assert.equal(result.list[0].id,'ss9');
  });
  it(method+' never falls back to regular video results on failure',async()=>{
   const h=harness();h.routeNet(async()=>{throw Error('synthetic failure');});
   await assert.rejects(h.loader[method]('test',{selectContentType:'short'}));
   assert.equal(h.gateCalls.length,0);
  });
  it(method+' rejects unsupported owner filtering without a request',async()=>{
   const h=harness();
   await assert.rejects(h.loader[method]('test',{selectContentType:'short',userId:'1'}));
   assert.equal(h.calls.length,0);assert.equal(h.gateCalls.length,0);
  });
 }
 it('passes the UI selection to search and disables owner-only while preserving its value',()=>{
  const {JSDOM}=require('jsdom');
  const ctx=createContext({Emitter:class{}});
  const Form=loadClass('src/VideoInfoPanel.js','VideoSearchForm',ctx);
  const dom=new JSDOM('<form><input type="radio" name="selectContentType" value="long" checked><input type="radio" name="selectContentType" value="short"><label><input name="ownerOnly" type="checkbox" checked></label></form>');
  const form=dom.window.document.querySelector('form');
  for(const name of ['f_range','l_range','genre'])form[name]={value:name==='genre'?'all':'0'};
  const view=Object.create(Form.prototype);view._form=form;
  const select=form.elements.namedItem('selectContentType'),owner=form.elements.namedItem('ownerOnly');
  select.value='short';view._syncContentTypeControls();
  assert.equal(view.filterOptions.selectContentType,'short');assert.equal(view.isOwnerOnly,false);
  assert.equal(owner.checked,true);assert.equal(owner.disabled,true);
  select.value='long';view._syncContentTypeControls();
  assert.equal(view.filterOptions.selectContentType,'long');assert.equal(view.isOwnerOnly,true);
  dom.window.close();
 });
});

describe('Explicit search scope wins over the opening URL',()=>{
 for(const selected of ['long','short'])it(selected+' survives conflicting watch options',()=>{
  const Dialog=loadClass('src/NicoVideoPlayerDialog.js','NicoVideoPlayerDialog',createContext({Emitter:class{}}));
  const view=Object.create(Dialog.prototype);
  let received;
  const playlist={isEnable:false,loadSearchVideo(word,option){received=option;return new Promise(()=>{});}};
  Object.assign(view,{_playlist:playlist,_watchId:'sm9',_state:{},
   _capturePlaylistLoadOwner:()=>({playlist}),
   _playerConfig:{props:{'search.limit':100}},
   _videoWatchOptions:{query:{selectContentType:selected==='long'?'short':'long'}}});
  view._onPlaylistSetSearchVideo({word:'test',option:{selectContentType:selected}});
  assert.equal(received.selectContentType,selected);
 });
});
