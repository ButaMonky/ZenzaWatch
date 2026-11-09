'use strict';
// P10: run the actual generated presenter in isolation with owned native nodes.
const assert=require('assert');
const {createContext,loadClass}=require('../helpers/extractSource');

function setup(){
 const pointers=Array.from({length:3},()=>({
  hidden:false,attributes:{},props:new Map(),
  setAttribute(name,value){this.attributes[name]=String(value);},
  removeAttribute(name){delete this.attributes[name];}
 }));
 const changes=[];
 const setProps=(...tasks)=>{
  changes.push(tasks);
  for(const [pointer,name,value] of tasks){
   if(value==='') pointer.props.delete(name);
   else pointer.props.set(name,value);
  }
 };
 const context=createContext();
 context.TimelineGeometry=loadClass('packages/zenza/src/sceneSearch/TimelineGeometry.js','TimelineGeometry',context);
 const presenter=loadClass(
  'packages/zenza/src/sceneSearch/SceneResumeMarkerPresenter.js',
  'SceneResumeMarkerPresenter',context);
 return {pointers,changes,setProps,render:presenter.render};
}

describe('P10 resume marker presenter',()=>{
 it('reuses the same three nodes and restores hidden markers on the next video',()=>{
  const h=setup(),original=h.pointers.slice();
  h.render(h.pointers,[],120,h.setProps);
  assert(h.pointers.every(p=>p.hidden));
  h.render(h.pointers,[{now:'前回',time:40}],240,h.setProps);
  assert.strictEqual(h.pointers[0],original[0]);
  assert.strictEqual(h.pointers[0].hidden,false);
  assert.equal(h.pointers[0].attributes.duration,'240');
  assert.equal(h.pointers[0].attributes.time,'40');
  assert.equal(h.pointers[0].attributes.text,'前回 ここまで見た');
  assert(h.pointers.slice(1).every(p=>p.hidden));
 });
 it('clears obsolete per-node custom colors and scales across videos',()=>{
  const h=setup(),p=h.pointers[0];
  h.render(h.pointers,[{now:'2026/10/30',time:60}],100,h.setProps);
  assert.equal(p.props.get('--pointer-color'),'rgba(128, 128, 255, 0.6)');
  assert.equal(p.props.get('--color'),'#aef');
  h.render(h.pointers,[{now:'前回',time:70}],100,h.setProps);
  assert.equal(p.props.get('--pointer-color'),undefined);
  assert.equal(p.props.get('--color'),undefined);
  assert.equal(p.props.get('--scale-pp'),1.7);
  h.render(h.pointers,[{now:'2026/10/31',time:80}],100,h.setProps);
  assert.equal(p.props.get('--scale-pp'),undefined);
  assert.equal(p.props.get('--color'),'#aef');
 });
 it('clears old video identity from hidden native markers, and restores new metadata',()=>{
  const h=setup(),p=h.pointers[0];
  h.render(h.pointers,[{now:'前回',time:33.5}],120,h.setProps);
  assert.equal(p.attributes.time,'33.5');
  assert.equal(p.attributes.duration,'120');
  assert.equal(p.attributes.text,'前回 ここまで見た');
  h.render(h.pointers,[],180,h.setProps);
  assert.equal(p.hidden,true);
  for(const key of ['time','duration','text']){
   assert.equal(p.attributes[key],undefined,'hidden node kept stale '+key);
  }
  h.render(h.pointers,[{now:'前回',time:88}],240,h.setProps);
  assert.equal(p.hidden,false);
  assert.equal(p.attributes.time,'88');
  assert.equal(p.attributes.duration,'240');
 });
 it('ignores invalid or missing metadata without nonfinite attributes or extra nodes',()=>{
  const h=setup();
  h.render(h.pointers,undefined,100,h.setProps);
  assert(h.pointers.every(p=>p.hidden));
  h.render(h.pointers,[
   {now:'前回',time:Infinity},{now:'前回',time:-1},{now:'前回',time:40},
   {now:'extra',time:25}
  ],100,h.setProps);
  assert.equal(h.pointers.length,3);
  assert(h.pointers[0].hidden&&h.pointers[1].hidden);
  assert.equal(h.pointers[2].hidden,false);
  assert.equal(h.pointers[2].attributes.time,'40');
  h.render(h.pointers,[{now:'前回',time:40}],NaN,h.setProps);
  assert(h.pointers.every(p=>p.hidden));
 });
});
