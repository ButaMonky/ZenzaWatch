"use strict";
const assert=require('assert');
const {extract,createContext,run}=require('../helpers/extractSource');
function fixture() {
 const cleaned=[],unobserved=[],observers=[];
 const node={classList:{contains:()=>false,add(){},remove(){cleaned.push('node')}}};
 const child={classList:{contains:()=>false,add(){},remove(){cleaned.push('child')}}};
 const container={dataset:{},querySelectorAll:()=>[node,child]};
 const intersection={observe(){},unobserve(item){unobserved.push(item)},disconnect(){}};
 const ctx=createContext({util:{addStyle(){}},__ng_css__:'',document:container,
  MutationObserver:class {constructor(fn){this.fn=fn;observers.push(this)}observe(){}disconnect(){}}
 });
 run('globalThis.initNgDom='+extract('src/_pocket.js','initNgDom','var'),ctx);
 const stop=ctx.initNgDom({intersectionObserver:intersection,query:'.video',container,subtree:true});
 return {node,child,container,cleaned,unobserved,stop,mutate:records=>observers[0].fn(records)};
}
describe('Pocket NG releases removed card ownership',()=>{
 it('unobserves removed cards and excludes them from later session cleanup',()=>{
  const h=fixture();h.mutate([{target:h.container,addedNodes:[],removedNodes:[h.node]}]);
  assert.deepStrictEqual(h.unobserved,[h.node]);
  assert.deepStrictEqual(h.cleaned,['node']);h.stop();
  assert.deepStrictEqual(h.cleaned,['node','child']);
 });
 it('releases a removed subtree and clears retained cards after stopping',()=>{
  const h=fixture(),subtree={contains:item=>item===h.node||item===h.child};
  h.mutate([{target:h.container,addedNodes:[],removedNodes:[subtree]}]);
  assert.deepStrictEqual(h.unobserved,[h.node,h.child]);
  assert.deepStrictEqual(h.cleaned,['node','child']);h.stop();h.stop();
  assert.deepStrictEqual(h.cleaned,['node','child']);
 });
});
