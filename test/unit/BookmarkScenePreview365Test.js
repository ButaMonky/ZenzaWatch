'use strict';
const assert=require('assert');
const fs=require('fs');
const vm=require('vm');
const {stripTypeScriptTypes}=require('node:module');
const {JSDOM}=require('jsdom');
function fixture(cache){
 const doc=new JSDOM('<div id="one"></div><div id="two"></div>').window.document;
 const calls={gets:[],urls:0,revokes:[]};
 const context=vm.createContext({exports:{},document:doc,console,Blob,ArrayBuffer,Map,Set,SeekBarThumbnail:{},StoryboardWorker:{},
  URL:{createObjectURL(){return 'blob:test-'+ ++calls.urls;},revokeObjectURL(x){calls.revokes.push(x);}},
  Emitter:class{emit(){}},global:{debug:{}},StoryboardCacheDb:{async get(key){calls.gets.push(key);return cache;}}});
 for(const name of ['StoryboardInfoModel','Storyboard']){
  const source=fs.readFileSync('tools/typescript-stage1/nico-src/'+name+'.ts','utf8');
  const js=stripTypeScriptTypes(source).replace(/export \{([^}]+)\};/g,(_,names)=>names.split(',').map(n=>'exports.'+n.trim()+'='+n.trim()+';').join(''));
  vm.runInContext(js,context);
 }
 const board=Object.create(context.exports.Storyboard.prototype);board.config={props:{enableStoryboard:true}};board.model={isAvailable:false};
 return {doc,calls,board};
}
const info=()=>({status:'ok',watchId:'sm9',duration:30,format:'domand',storyboard:{thumbnail:{width:160,height:90},rows:2,columns:3,interval:5000,count:6,images:[{url:'https://example.invalid/sheet',buffer:new ArrayBuffer(8)}]}});
const flush=async()=>{for(let i=0;i<15;i++)await Promise.resolve();};
describe('Saved bookmark scene preview leases',()=>{
 it('coalesces historical cache reads and shares one sheet object URL',async()=>{
  const h=fixture(info()),a=h.doc.getElementById('one'),b=h.doc.getElementById('two');
  const offA=h.board.createSavedPreview(a,'sm9',7),offB=h.board.createSavedPreview(b,'sm9',17);await flush();
  assert.deepStrictEqual(h.calls.gets,['sm9_domand']);assert.equal(h.calls.urls,1);
  assert.equal(a.querySelector('img').style.left,'-100%');assert.equal(b.querySelector('img').style.top,'-100%');
  offA();assert.equal(h.calls.revokes.length,0);offB();assert.equal(h.calls.revokes.length,1);
 });
 it('never uses a remote historical URL when cached bytes are missing',async()=>{
  const raw=info();delete raw.storyboard.images[0].buffer;const h=fixture(raw),host=h.doc.getElementById('one');
  h.board.createSavedPreview(host,'sm9',7);await flush();assert.equal(host.querySelector('img'),null);assert.equal(h.calls.urls,0);
 });
 it('disposal prevents delayed cache results from mounting',async()=>{
  const h=fixture(info()),host=h.doc.getElementById('one');const off=h.board.createSavedPreview(host,'sm9',7);off();await flush();assert.equal(host.querySelector('img'),null);assert.equal(h.calls.urls,0);
 });
 it('rejects another video cache and invalid time',async()=>{
  const h=fixture(info()),host=h.doc.getElementById('one');h.board.createSavedPreview(host,'sm10',7);await flush();assert.equal(host.querySelector('img'),null);
  h.board.createSavedPreview(host,'sm9',NaN);await flush();assert.equal(host.querySelector('img'),null);
 });
 it('reuses current metadata without a cache lookup and respects master-off',async()=>{
  const raw=info();delete raw.storyboard.images[0].buffer;
  const h=fixture(null),host=h.doc.getElementById('one');h.board._currentVideoWatchId='sm9';h.board.model={isAvailable:true,rawData:raw};
  const release=h.board.createSavedPreview(host,'sm9',29);await flush();assert.equal(h.calls.gets.length,0);assert.equal(host.querySelector('img').style.left,'-200%');release();
  h.board.config.props.enableStoryboard=false;h.board.createSavedPreview(host,'sm9',29);await flush();assert.equal(host.querySelector('img'),null);assert.equal(h.calls.gets.length,0);
 });
});
