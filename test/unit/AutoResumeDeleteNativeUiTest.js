'use strict';
const assert=require('assert');
const {JSDOM}=require('jsdom');
const {loadClass,createContext,run}=require('../helpers/extractSource');
const parser=require('@babel/parser'),fs=require('fs'),path=require('path');
const generatedBar='tools/typescript-stage1/.generated/nico/VideoControlBar.js';
let classSource=null;
function nativeClassSource(){
 if(classSource)return classSource;
 const emitted=fs.readFileSync(path.resolve(generatedBar),'utf8');
 const parsed=parser.parse(emitted,{sourceType:'module',
   allowUndeclaredExports:true,plugins:['classProperties']});
 const declaration=parsed.program.body.find(item=>
   item.type==='ClassDeclaration'&&item.id?.name==='VideoControlBar');
 assert(declaration,'VideoControlBar missing from legacy TypeScript emission');
 return classSource=emitted.slice(declaration.start,declaration.end);
}
function prepare(){
 const dom=new JSDOM('<!doctype html><html><body><section class="videoControlBar">'+
   Array.from({length:5},()=>'<zenza-seekbar-label class="resumePointer"></zenza-seekbar-label>').join('')+
   '<input class="seekRange" type="range"/><button class="regular" type="button">play</button>'+
   '</section></body></html>');
 let confirmCount=0,allowed=true;
 dom.window.confirm=()=>{confirmCount++;return allowed;};
 const ctx=createContext({Emitter:class {},window:dom.window,
   cssUtil:{setProps(...styles){for(const [element,key,value]of styles){
     element.style.setProperty(key,String(value));
   }}}
 });
 ctx.TimelineGeometry=loadClass('packages/zenza/src/sceneSearch/TimelineGeometry.js','TimelineGeometry',ctx);
 const Presenter=loadClass('packages/zenza/src/sceneSearch/SceneResumeMarkerPresenter.js',
   'SceneResumeMarkerPresenter',ctx);
 ctx.SceneResumeMarkerPresenter=Presenter;
 // The original Emitter is supplied by the test harness; all tested method
 // bodies are extracted intact from the compiler's actual runtime class.
 run(nativeClassSource()+';globalThis.__subject=VideoControlBar;',ctx);
 const Bar=ctx.__subject;
 const bar=Object.create(Bar.prototype);
 const events=[];bar.emit=(...args)=>events.push(args);
 const container=dom.window.document.querySelector('.videoControlBar');
 const pointers=[...container.querySelectorAll('.resumePointer')];
 bar.$resumePointers=pointers;
 const listen=event=>bar._onResumeMarkerDelete(event);
 container.addEventListener('contextmenu',listen,true);
 container.addEventListener('keydown',listen,true);
 const send=(target,type,key)=>{
   const evt=type==='keydown'?
     new dom.window.KeyboardEvent(type,{key,bubbles:true,cancelable:true}):
     new dom.window.MouseEvent(type,{button:2,bubbles:true,cancelable:true});
   target.dispatchEvent(evt);
   return evt;
 };
 return {bar,ctx,dom,container,pointers,events,send,
   setAllow(value){allowed=value;},
   get confirmCount(){return confirmCount;},
   close(){dom.window.close();}};
}
describe('P12 native onepoint delete is explicit and does not own seek input',()=>{
 it('right-click visible only marker, after confirmation, emits one delete action',()=>{
  const h=prepare();
  h.bar.refreshAutoResumePointers({duration:300,resumePoints:[{now:'??',time:80}]});
  assert.strictEqual(h.pointers.length,5);
  assert.strictEqual(h.pointers[0].hidden,false);
  assert.deepStrictEqual(h.pointers.slice(1).map(x=>x.hidden),[true,true,true,true]);
  const evt=h.send(h.pointers[0],'contextmenu');
  assert.strictEqual(evt.defaultPrevented,true);
  assert.strictEqual(h.confirmCount,1);
  assert.deepStrictEqual(h.events,[['command','deleteAutomaticResume']]);
  h.close();
 });
 it('normal seek click is unchanged; delete only on the targeted explicit event',()=>{
  const h=prepare();
  h.bar.refreshAutoResumePointers({duration:300,resumePoints:[{now:'??',time:80}]});
  const click=h.send(h.pointers[0],'click');
  const change=h.send(h.container.querySelector('input'),'keydown','Delete');
  assert.strictEqual(click.defaultPrevented,false);
  assert.strictEqual(change.defaultPrevented,false);
  assert.strictEqual(h.confirmCount,0);
  assert.strictEqual(h.events.length,0);
  h.close();
 });
 it('cancelled delete leaves marker and display unchanged',()=>{
  const h=prepare();
  h.bar.refreshAutoResumePointers({duration:300,resumePoints:[{now:'??',time:80}]});
  h.setAllow(false);
  h.send(h.pointers[0],'keydown','Delete');
  assert.strictEqual(h.confirmCount,1);
  assert.deepStrictEqual(h.events,[]);
  assert.strictEqual(h.pointers[0].hidden,false);
  h.close();
 });
 it('no prompt on hidden previous-video markers or non-delete keyboard keys',()=>{
  const h=prepare();
  h.bar.refreshAutoResumePointers({duration:300,resumePoints:[]});
  h.send(h.pointers[0],'contextmenu');
  h.send(h.pointers[0],'keydown','Backspace');
  assert.strictEqual(h.confirmCount,0);
  h.bar.refreshAutoResumePointers({duration:300,resumePoints:[{now:'??',time:80}]});
  h.send(h.pointers[0],'keydown','ArrowRight');
  assert.strictEqual(h.confirmCount,0);
  h.close();
 });
 it('repeated rendering preserves DOM identity and native seekRange',()=>{
  const h=prepare(),range=h.container.querySelector('input');
  const before=[...h.pointers];
  h.bar.refreshAutoResumePointers({duration:300,resumePoints:[{now:'??',time:80}]});
  assert.strictEqual(h.pointers[0].getAttribute('tabindex'),'0');
  h.bar.refreshAutoResumePointers({duration:300,resumePoints:[]});
  assert.strictEqual(h.pointers[0].hidden,true);
  assert.strictEqual(h.container.querySelector('input'),range);
  assert(before.every((x,i)=>h.container.querySelectorAll('.resumePointer')[i]===x));
  h.close();
 });
 it('a visible marker supports Backspace as an explicit accessible delete action',()=>{
  const h=prepare();
  h.bar.refreshAutoResumePointers({duration:300,resumePoints:[{now:'??',time:100}]});
  h.send(h.pointers[0],'keydown','Backspace');
  assert.deepStrictEqual(h.events,[['command','deleteAutomaticResume']]);
  h.close();
 });
});
