'use strict';
// Placement lane: dynamic obstruction geometry and frame-coalesced lifecycle.
const assert=require('assert');
const {JSDOM}=require('jsdom');
const {loadClass,createContext}=require('../helpers/extractSource');
const Binding=loadClass('packages/zenza/src/sceneSearch/SceneSearchPlayerBinding.js',
 'SceneSearchPlayerBinding',createContext());
function emitter(){
 const m=new Map();
 return {on(k,f){if(!m.has(k))m.set(k,new Set());m.get(k).add(f);},
  off(k,f){m.get(k)?.delete(f);},emit(k,v){for(const f of m.get(k)||[])f(v);}};
}
function harness(){
 const dom=new JSDOM('<!doctype html><div id="host"><div class="videoPlayer"></div>'+
 '<div class="videoControlBar"><div class="controlItemContainer right">'+
 '<div class="scalingUI"><button class="controlButton"></button></div></div></div></div>',
 {pretendToBeVisual:true});
 const d=dom.window.document,host=d.getElementById('host');
 const frames=new Map(),observers=[];let nextId=0,updates=0;
 dom.window.requestAnimationFrame=fn=>{const id=++nextId;frames.set(id,fn);return id;};
 dom.window.cancelAnimationFrame=id=>frames.delete(id);
 class ResizeObserver {
  constructor(callback){this.callback=callback;this.nodes=new Set();this.disconnected=false;observers.push(this);}
  observe(node){this.nodes.add(node);}
  unobserve(node){this.nodes.delete(node);}
  disconnect(){this.disconnected=true;this.nodes.clear();}
  fire(){this.callback([]);}
 }
 dom.window.ResizeObserver=ResizeObserver;
 const dialog=Object.assign(emitter(),{isOpen:true});
 class Adapter{
  constructor(){this.bridge={updatePlacementContext:()=>{updates++;}};}
  start(){return this.bridge;}
  screenModeChanged(){}
  dispose(){}
 }
 const binding=new Binding({view:{videoControlBar:{}},dialog,document:d,container:host,
  Adapter,Bridge:class {},classes:{},createRegistry:()=>({})});
 const flush=()=>{const pending=[...frames.values()];frames.clear();pending.forEach(fn=>fn());};
 return {d,host,dom,binding,dialog,frames,observers,flush,
  updates:()=>updates,
  close(){binding.dispose();dom.window.close();}};
}
describe('scene placement geometry observer ownership',()=>{
 it('registers dynamically inserted popovers and transformed child controls',async()=>{
  const h=harness();
  try{
   h.binding.attach();h.flush();const ro=h.observers[0];
   const row=h.host.querySelector('.controlItemContainer');
   const icon=row.querySelector('.controlButton');
   assert(ro.nodes.has(icon),'transformed button must be measured, not just its wrapper');
   const popup=h.d.createElement('div');popup.className='commandPopover';
   h.host.appendChild(popup);await Promise.resolve();
   assert(ro.nodes.has(popup),'newly added popup must join ResizeObserver');
   assert.equal(h.frames.size,1,'DOM additions coalesce into one frame');
   h.flush();const prev=h.updates();
   icon.style.transform='translateY(-36px)';await Promise.resolve();
   h.flush();assert.equal(h.updates(),prev+1,'child transform invalidates geometry');
   popup.remove();await Promise.resolve();
   assert(!ro.nodes.has(popup),'detached popups must not stay observed');
  }finally{h.close();}
 });
 it('reacts to focus and hover transitions without DOM attribute mutations',async()=>{
  const h=harness();
  try{
   h.binding.attach();h.flush();
   const panel=h.d.createElement('div');panel.className='commentInputPanel';
   panel.innerHTML='<input id="a"><button id="b"></button>';
   h.host.appendChild(panel);await Promise.resolve();h.flush();
   const a=h.d.getElementById('a'),b=h.d.getElementById('b');
   let old=h.updates();a.focus();h.flush();
   assert.equal(h.updates(),old+1,'focus-in makes comment input a physical blocker');
   old=h.updates();a.blur();h.flush();
   assert.equal(h.updates(),old+1,'focus-out releases comment input blocker');
   old=h.updates();
   a.dispatchEvent(new h.dom.window.MouseEvent('mouseover',{bubbles:true,relatedTarget:h.host}));
   h.flush();assert.equal(h.updates(),old+1,'hover enter invalidates obstacle');
   old=h.updates();
   b.dispatchEvent(new h.dom.window.MouseEvent('mouseover',{bubbles:true,relatedTarget:a}));
   h.flush();assert.equal(h.updates(),old,'moves within panel do not thrash');
   a.dispatchEvent(new h.dom.window.MouseEvent('mouseout',{bubbles:true,relatedTarget:h.host}));
   h.flush();assert.equal(h.updates(),old+1,'hover exit removes blocker');
  }finally{h.close();}
 });
 it('ignores unrelated mutations, coalesces frames and detaches on close',async()=>{
  const h=harness();
  try{
   h.binding.attach();h.flush();
   const other=h.d.createElement('div');other.className='unrelated';
   h.host.appendChild(other);await Promise.resolve();h.flush();
   const base=h.updates();
   other.style.left='50px';await Promise.resolve();
   assert.equal(h.frames.size,0,'unrelated class/style should not reposition');
   const icon=h.host.querySelector('.controlButton');
   icon.style.top='1px';icon.style.left='2px';await Promise.resolve();
   assert.equal(h.frames.size,1,'multiple updates produce only one RAF');
   h.flush();assert.equal(h.updates(),base+1);
   const ro=h.observers[0];h.dialog.isOpen=false;h.dialog.emit('close');
   assert(ro.disconnected);assert.equal(h.frames.size,0);
   icon.style.top='3px';await Promise.resolve();
   assert.equal(h.frames.size,0,'closed player must not reschedule');
  }finally{h.close();}
 });
});