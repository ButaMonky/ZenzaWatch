'use strict';
const assert=require('assert');
const fs=require('fs');
const path=require('path');
const {JSDOM}=require('jsdom');
const {loadClass,createContext}=require('../helpers/extractSource');
function emitter(){
 const map=new Map();
 return {on(k,f){if(!map.has(k))map.set(k,new Set());map.get(k).add(f);},
 off(k,f){map.get(k)?.delete(f);},emit(k,...a){for(const f of [...map.get(k)||[]])f(...a);},
 count(){return [...map.values()].reduce((n,s)=>n+s.size,0);}};
}
function fixture(){
 const file='packages/zenza/src/sceneSearch/SceneSearchPlayerBinding.js';
 assert(fs.existsSync(path.resolve(__dirname,'../..',file)),
   'player binding must exist, not just isolated layout providers');
 const Binding=loadClass(file,'SceneSearchPlayerBinding',createContext());
 const dom=new JSDOM('<!doctype html><html><body><div id="host"></div></body></html>');
 const dialog=Object.assign(emitter(),{isOpen:false});
 const events=emitter(),created=[],failures=[];
 let full=false,fail=false;
 class Adapter {
  constructor(options){this.options=options;this.disposed=false;created.push(this);
    this.bridge={handleShortcut:command=>command==='sceneSearch-togglePin'};}
  start(mode){this.mode=mode;if(fail)throw Error('test failure');return this.bridge;}
  screenModeChanged(mode){this.mode=mode;}
  dispose(){this.disposed=true;}
 }
 const binding=new Binding({view:{videoControlBar:{}},dialog,
  document:dom.window.document,container:dom.window.document.getElementById('host'),
  events,isFullscreen:()=>full,Adapter,Bridge:class {},classes:{},
  createRegistry:()=>({}),onError:code=>failures.push(code)});
 return {binding,dialog,events,created,failures,dom,
  setFull(v){full=v;},failNext(){fail=true;},close(){binding.dispose();dom.window.close();}};
}
describe('SCUI-18 actual player binding lifecycle',()=>{
 it('mounts on video open, disposes on close, reopens without duplicate owners',()=>{
  const h=fixture();h.binding.attach();h.binding.attach();
  assert.equal(h.created.length,0);
  h.dialog.isOpen=true;h.dialog.emit('open','sm9');
  assert.equal(h.created.length,1);assert.equal(h.created[0].mode,'normal');
  h.dialog.emit('open','sm10');assert.equal(h.created.length,1);
  h.dialog.isOpen=false;h.dialog.emit('close');assert(h.created[0].disposed);
  h.dialog.isOpen=true;h.dialog.emit('open','sm11');assert.equal(h.created.length,2);
  h.close();assert.equal(h.dialog.count(),0);assert.equal(h.events.count(),0);
 });
 it('attaches to an already open player and routes mode and shortcut events',()=>{
  const h=fixture();h.dialog.isOpen=true;h.binding.attach();
  assert.equal(h.created.length,1);h.setFull(true);h.events.emit('fullscreenStatusChange');
  assert.equal(h.created[0].mode,'fullscreen');h.setFull(false);
  h.dialog.emit('screenModeChange','normal');assert.equal(h.created[0].mode,'normal');
  assert.equal(h.binding.handleShortcut('sceneSearch-togglePin'),true);
  assert.equal(h.binding.handleShortcut('volumeUp'),false);h.close();
 });
 it('contains start failures and does not retain a half-mounted adapter',()=>{
  const h=fixture();h.failNext();h.binding.attach();h.dialog.isOpen=true;
  assert.doesNotThrow(()=>h.dialog.emit('open','sm9'));
  assert.equal(h.created.length,1);assert(h.created[0].disposed);
  assert.equal(h.binding.adapter,null);assert.equal(h.failures.length,1);
  assert(!JSON.stringify(h.failures).includes('test failure'));h.close();
 });
 it('does not resurrect a disposed binding from late lifecycle events',()=>{
  const h=fixture();h.binding.attach();h.binding.dispose();
  h.dialog.isOpen=true;h.dialog.emit('open','sm9');h.events.emit('fullscreenStatusChange');
  assert.equal(h.created.length,0);assert.equal(h.binding.handleShortcut('sceneSearch-togglePin'),false);
  h.close();
 });
 it('is connected by the actual dialog source, not an unused helper',()=>{
  const source=fs.readFileSync(path.resolve(__dirname,'../../src/NicoVideoPlayerDialog.js'),'utf8');
  assert(source.includes("import {SceneSearchPlayerBinding}"),'dialog must import the runtime binding');
  assert(source.includes('this.sceneSearchBinding = new SceneSearchPlayerBinding('));
  assert(source.includes('this.sceneSearchBinding.attach()'));
  assert(source.includes('this._view?.sceneSearchBinding?.handleShortcut(command)'));
 });
});
