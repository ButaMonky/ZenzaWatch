import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {loadSource} from './nonvisual-audit-source-harness.mjs';
const {JSDOM}=createRequire(import.meta.url)('jsdom');
function fixture(t){
 const dom=new JSDOM('<!doctype html><button></button><button></button>');t.after(()=>dom.window.close());
 const w=dom.window;
 const uq=loadSource('nico-src/uQuery.ts','uQuery',{window:w,document:w.document,Window:w.Window,Node:w.Node,Document:w.Document,
  HTMLCollection:w.HTMLCollection,NodeList:w.NodeList,EventTarget:w.EventTarget,CSS:{},PromiseHandler:class{resolve(){}},Emitter:class{},throttle:{raf:fn=>fn}});
 const nodes=[...w.document.querySelectorAll('button')],q=uq(nodes);
 return {dom,w,nodes,q,fire(){nodes.forEach(node=>node.dispatchEvent(new w.Event('click')));}};
}
for(const selector of [undefined,'click','click.audit','.audit'])test('AUD67 removes capture listeners with off('+selector+')',t=>{
 const h=fixture(t);let called=0;const fn=()=>called++;h.q.on('click.audit',fn,{capture:true});
 selector===undefined?h.q.off():h.q.off(selector);h.fire();assert.equal(called,0);
});
for(const withCallback of [false,true])test('AUD67 one namespace off preserves another with the same callback '+withCallback,t=>{
 const h=fixture(t);let called=0;const fn=()=>called++;h.q.on('click.alpha',fn).on('click.beta',fn);
 withCallback?h.q.off('click.alpha',fn):h.q.off('click.alpha');h.fire();assert.equal(called,2);
 h.q.on('click.alpha',fn);h.fire();assert.equal(called,6);h.q.off();h.fire();assert.equal(called,6);
});
test('AUD67 capture is part of registration identity and callback/this remain native',t=>{
 const h=fixture(t),seen=[];function fn(event){seen.push([this,event.target]);}
 h.q.on('click.audit',fn,false).on('click.audit',fn,{capture:true}).on('click.audit',fn,false);h.fire();
 assert.equal(seen.length,4);assert(seen.every(([owner,target])=>owner===target));h.q.off('click.audit',fn);h.fire();assert.equal(seen.length,4);
});
test('AUD67 once registration can register itself again after dispatch',t=>{
 const h=fixture(t);let called=0;const fn=()=>{called++;};
 h.q.on('click.audit',fn,{once:true});h.fire();h.q.on('click.audit',fn,{once:true});h.fire();h.fire();assert.equal(called,4);
});
test('AUD67 aborted signal permits replacement registration and leaves no active subscription',t=>{
 const h=fixture(t),controller=new h.w.AbortController();let called=0;const fn=()=>called++;
 h.q.on('click.audit',fn,{signal:controller.signal});controller.abort();h.q.on('click.audit',fn);h.fire();assert.equal(called,2);
 h.q.off('.audit',fn);h.fire();assert.equal(called,2);
});
