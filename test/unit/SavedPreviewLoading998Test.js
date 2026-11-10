'use strict';
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const {stripTypeScriptTypes} = require('node:module');
const {JSDOM} = require('jsdom');
const tick = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => {let resolve,reject;const promise = new Promise((r,j) => {resolve=r;reject=j;});return {promise,resolve,reject};};
function fixture({live=true, fetch=false}={}) {
  const dom = new JSDOM('<div id="preview"></div>');
  const host=dom.window.document.getElementById('preview'), cache=deferred(), fetched=deferred(), events=new Map();
  const raw={watchId:'sm1',status:'ok',storyboard:{images:[{url:'https://example.test/scene.jpg'}]}};
  const source=stripTypeScriptTypes(fs.readFileSync('tools/typescript-stage1/nico-src/Storyboard.ts','utf8'));
  const start=source.indexOf('  createSavedPreview('),end=source.indexOf('\n  }',start)+4;
  const context=vm.createContext({Map,URL,Blob,Promise,StoryboardCacheDb:{getPreview:()=>cache.promise},StoryboardInfoModel:class {
    constructor(){Object.assign(this,{isAvailable:true,cellCount:1,duration:60,pageWidth:160,pageHeight:90,cols:1,rows:1,cellWidth:160,cellHeight:90});}
    getThumbnailPosition(){return {page:0,col:0,row:0};}
  }});
  const create=vm.runInContext('({'+source.slice(start,end)+'}).createSavedPreview',context);
  const board={config:{props:{savedSceneFetch:fetch}},_currentVideoWatchId:live?'sm1':'sm2',model:{isAvailable:true,rawData:raw},
    on:(name,fn)=>events.set(name,fn),off:(name)=>events.delete(name),savedScenes:()=>({acquire:()=>({promise:fetched.promise,release(){}})})};
  return {host,cache,fetched,raw,events,board,dom,create:()=>create.call(board,host,'sm1',5)};
}
describe('Task998 saved preview loading state',()=>{
  it('stays visibly busy until the image loads, then clears the spinner',()=>{
    const f=fixture(),cleanup=f.create();
    assert.equal(f.host.getAttribute('aria-busy'),'true');
    assert(f.host.classList.contains('zw-scene-loading'));
    f.host.querySelector('img').onload();
    assert.equal(f.host.getAttribute('aria-busy'),'false');
    assert(!f.host.classList.contains('zw-scene-loading'));
    assert.equal(f.host.getAttribute('aria-label'),'保存時刻付近の場面画像');
    cleanup();f.dom.window.close();
  });
  it('shows pending cache reads and settles missing images without a permanent spinner',async()=>{
    const f=fixture({live:false}),cleanup=f.create();
    assert.equal(f.host.getAttribute('aria-busy'),'true');
    f.cache.resolve(null);await tick();
    assert.equal(f.host.getAttribute('aria-busy'),'false');
    assert.equal(f.host.textContent,'画像なし');
    cleanup();f.dom.window.close();
  });
  it('settles image errors and ignores older image callbacks after redraw',()=>{
    const f=fixture(),cleanup=f.create(),old=f.host.querySelector('img');
    f.events.get('update')();const current=f.host.querySelector('img');
    old.onload();old.onerror();
    assert.equal(f.host.getAttribute('aria-busy'),'true');
    assert.strictEqual(f.host.querySelector('img'),current);
    current.onerror();
    assert.equal(f.host.getAttribute('aria-busy'),'false');
    assert.equal(f.host.textContent,'画像なし');
    cleanup();f.dom.window.close();
  });
  it('cleans up loading state and ignores cache completion after disposal',async()=>{
    const f=fixture({live:false}),cleanup=f.create();cleanup();f.cache.resolve(null);await tick();
    assert(!f.host.classList.contains('zw-scene-loading'));
    assert.notEqual(f.host.getAttribute('aria-busy'),'true');
    assert.equal(f.host.childNodes.length,0);
    assert.equal(f.events.size,0);f.dom.window.close();
  });
  it('continues loading during on-demand fetch and settles rejected fetches',async()=>{
    const f=fixture({live:false,fetch:true}),cleanup=f.create();f.cache.resolve(null);await tick();
    assert.equal(f.host.getAttribute('aria-busy'),'true');
    f.fetched.reject(Error('fetch unavailable'));await tick();
    assert.equal(f.host.getAttribute('aria-busy'),'false');assert.equal(f.host.textContent,'画像なし');
    cleanup();f.dom.window.close();
  });
  it('does not let an older cached read clear a newer live image loading state',async()=>{
    const f=fixture({live:false}),cleanup=f.create();
    f.board._currentVideoWatchId='sm1';f.events.get('update')();const current=f.host.querySelector('img');
    f.cache.resolve(null);await tick();
    assert.equal(f.host.getAttribute('aria-busy'),'true');assert.strictEqual(f.host.querySelector('img'),current);
    current.onload();assert.equal(f.host.getAttribute('aria-busy'),'false');cleanup();f.dom.window.close();
  });
});
