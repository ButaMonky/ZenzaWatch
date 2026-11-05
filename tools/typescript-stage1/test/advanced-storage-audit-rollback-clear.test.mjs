import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {loadSource,flush} from './nonvisual-audit-source-harness.mjs';
const {JSDOM}=createRequire(import.meta.url)('jsdom');
function storageConfig(storage,defaults){
 const DataStorage=loadSource('../../packages/lib/src/infra/DataStorage.js','DataStorage',{window:{console:{error(){}}}});
 const config=Object.create(DataStorage.prototype);
 Object.assign(config,{storage,default:defaults,_data:{...defaults},prefix:'SC_',readonly:false,silently:false,_changed:new Map(),_onChange(){}});
 return config;
}
function modelFixture(t,{initial={},rollbackFailure=false}={}){
 const dom=new JSDOM('',{url:'https://www.nicovideo.jp/'});t.after(()=>dom.window.close());
 const underlying=dom.window.localStorage;Object.assign(underlying,initial);
 let failed=false;
 const storage=new Proxy(underlying,{set(object,key,value){
  if(key==='SC_volume'&&value==='0.9'){failed=true;throw Error('synthetic quota');}
  if(rollbackFailure&&failed&&key==='SC_sceneSearch.enabled')throw Error('synthetic rollback failure');
  object[key]=value;return true;
 },deleteProperty(object,key){if(rollbackFailure&&failed&&key==='SC_sceneSearch.enabled')throw Error('synthetic rollback failure');return delete object[key];}});
 const config=storageConfig(storage,{'sceneSearch.enabled':true,volume:0.5});config._data['sceneSearch.enabled']=false;
 const Model=loadSource('advanced-src/ModernAdvancedSettingsModel.ts','ModernAdvancedSettingsModel',{UiVisibilityRegistry:{}});
 const model=Object.create(Model.prototype);
 Object.assign(model,{config,saved:{'sceneSearch.enabled':false,volume:0.5},draft:{'sceneSearch.enabled':true,volume:0.9},
  validate:()=>[],changes:()=>[{id:'sceneSearch.enabled',value:true},{id:'volume',value:0.9}]});
 return {model,config,storage,underlying};
}
for(const raw of [undefined,' false '])test('AUD71 restores original raw key presence/value '+String(raw),t=>{
 const initial=raw===undefined?{}:{'SC_sceneSearch.enabled':raw};const h=modelFixture(t,{initial});
 assert.throws(()=>h.model.save());assert.equal(h.storage['SC_sceneSearch.enabled'],raw);
 assert.equal(h.config.getValue('sceneSearch.enabled'),false);assert.equal(h.model.draft['sceneSearch.enabled'],true);
});
test('AUD71 separately reports rollback failure and retains the save error',t=>{
 const h=modelFixture(t,{rollbackFailure:true});let caught;try{h.model.save();}catch(error){caught=error;}
 assert.equal(caught?.name,'AggregateError');assert(caught.errors.length>=2);assert(caught.cause);
 assert.equal(h.model.draft.volume,0.9);
});

function registryFixture(t){
 const dom=new JSDOM('<!doctype html><div id="root"><button class="settingPanelSwitch"></button></div>',{url:'https://www.nicovideo.jp/'});t.after(()=>dom.window.close());
 const w=dom.window,root=w.document.querySelector('#root'),storage=w.localStorage;
 const Registry=loadSource('advanced-src/UiVisibilityRegistry.ts','UiVisibilityRegistry');
 const defaults={...Registry.defaults(),showComment:true,KEY_TEST:0};
 const config=storageConfig(storage,defaults);config._data['ui.bar.settings']=false;config._data.showComment=false;config._data.KEY_TEST=23;
 const updates=[];config.onkey=()=>{};config.offkey=()=>{};config.emit=(...args)=>updates.push(args);config.emitAsync=config.emit;
 const connection=Registry.connect(config,root,'bar');
 const clear=(area=storage)=>w.dispatchEvent(new w.StorageEvent('storage',{key:null,storageArea:area,url:w.location.href}));
 return {dom,w,root,storage,config,updates,connection,clear};
}
test('AUD72 bulk clear refreshes owned defaults without storage writes and only changed shared notifications',async t=>{
 const h=registryFixture(t);assert.equal(h.root.querySelector('button').hidden,true);h.clear();await flush();
 assert.equal(h.root.querySelector('button').hidden,false);assert.equal(h.config.getValue('showComment'),true);assert.equal(h.config.getValue('KEY_TEST'),0);assert.equal(h.storage.length,0);
 assert.equal(h.updates.filter(e=>e[0]==='update').length,2);h.clear();await flush();assert.equal(h.updates.filter(e=>e[0]==='update').length,2);
});
test('AUD72 ignores another storage area and disposal',async t=>{
 const h=registryFixture(t);h.clear(h.w.sessionStorage);await flush();assert.equal(h.config.getValue('showComment'),false);
 h.connection.dispose();h.clear();await flush();assert.equal(h.config.getValue('showComment'),false);assert.equal(h.storage.length,0);
});
