'use strict';
const assert=require('assert');
const {JSDOM}=require('jsdom');
const {createContext,run,beginSection}=require('../helpers/extractSource');
function harness(width=800){
 const dom=new JSDOM('<!doctype html><html><head></head><body><div id="host"></div></body></html>');
 const c=createContext({document:dom.window.document});
 run(beginSection('packages/zenza/src/sceneSearch/SceneSearchLayoutCard.js'),c);
 run(beginSection('packages/zenza/src/sceneSearch/SceneSearchLayoutRegistry.js'),c);
 run(beginSection('packages/zenza/src/sceneSearch/SceneSearchLayouts01_02.js')+
     ';globalThis.setup=registerSceneLayouts01_02;globalThis.Registry=SceneSearchLayoutRegistry;',c);
 const registry=c.setup(new c.Registry());
 const host=dom.window.document.getElementById('host'),actions=[];
 host.getBoundingClientRect=()=>({left:0,top:0,right:width,bottom:400,width,height:400});
 const opts={document:dom.window.document,container:host,
  onAction:(action,ctx)=>actions.push([action,ctx]),
  settings:{getDuration:()=>1000}};
 const state={layoutId:'01',mode:'normal',time:500,shown:true,pinned:false,
  seekStepSeconds:5,commentPreviewVisible:true};
 return {dom,registry,host,opts,state,actions};
}
describe('SCUI-12 classic and twin scene layouts',()=>{
 it('registers two distinct layouts with stable labels',()=>{
  const h=harness();
  assert.strictEqual(h.registry.list().length,2);
  assert.deepStrictEqual(Array.from(h.registry.list(),x=>x.id),['01','02']);
  assert(h.registry.get('01').label.includes('クラシック'));
  assert(h.registry.get('02').label.includes('ツイン'));
  h.dom.window.close();
 });
 it('classic follows video time and clamps to both viewport edges',()=>{
  const h=harness(800);
  const layout=h.registry.create({...h.opts,id:'01',mode:'normal'});
  layout.mount(h.state);
  const root=layout.root;
  assert(root.classList.contains('zenzaSceneLayout01'));
  assert.strictEqual(root.style.getPropertyValue('--scene-x'),'400px');
  layout.render({...h.state,time:0});
  assert.strictEqual(root.style.getPropertyValue('--scene-x'),'96px');
  layout.render({...h.state,time:1000});
  assert.strictEqual(root.style.getPropertyValue('--scene-x'),'675px');
  layout.render({...h.state,time:500,pinned:true});
  assert.strictEqual(root.style.getPropertyValue('--scene-x'),'675px',
   'pin freezes position');
  layout.render({...h.state,time:500,pinned:false});
  assert.strictEqual(root.style.getPropertyValue('--scene-x'),'400px');
  layout.dispose();h.dom.window.close();
 });
 it('classic on fullscreen changes position by mode without touching comment overlay',()=>{
  const h=harness(1000);
  const a=h.registry.create({...h.opts,id:'01',mode:'fullscreen'});
  a.mount({...h.state,mode:'fullscreen'});
  const css=h.dom.window.document.querySelector('style[data-scui-layout-style]').textContent;
  assert(css.includes('.zenzaSceneLayout01[data-mode="fullscreen"]'));
  assert(css.includes('--zenza-control-bar-height'));
  assert.strictEqual(h.host.dataset.sceneMode,'fullscreen');
  a.dispose();h.dom.window.close();
 });
 it('twin separates scene and comments on both normal and fullscreen',()=>{
  for(const mode of ['normal','fullscreen']){
   const h=harness(900);
   const a=h.registry.create({...h.opts,id:'02',mode});
   a.mount({...h.state,mode,layoutId:'02'});
   assert.strictEqual(h.host.dataset.sceneSearchLayout,'02');
   assert.strictEqual(h.host.dataset.sceneNarrow,'false');
   const css=h.dom.window.document.querySelector('style[data-scui-layout-style]').textContent;
   assert(css.includes('[data-scene-search-layout="02"] .zenzaCommentPreview'));
   assert(css.includes('right:12px'));
   assert(css.includes('.zenzaSceneLayout02[data-mode="'+mode+'"]'));
   a.dispose();
   assert(!h.host.dataset.sceneSearchLayout);
   assert.strictEqual(h.dom.window.document.querySelector('style[data-scui-layout-style]'),null);
   h.dom.window.close();
  }
 });
 it('small viewport stacks the twin comment preview and never leaves old mode classes',()=>{
  const h=harness(350);
  const a=h.registry.create({...h.opts,id:'02',mode:'fullscreen'});
  a.mount({...h.state,layoutId:'02',mode:'fullscreen'});
  assert.strictEqual(h.host.dataset.sceneNarrow,'true');
  assert(h.dom.window.document.querySelector('style').textContent.includes(
    '[data-scene-narrow="true"] .zenzaCommentPreview'));
  a.dispose();
  assert.strictEqual(h.host.style.getPropertyValue('--scene-bottom'),'');
  h.dom.window.close();
 });
 it('narrow viewport clamps follow position even if pinned during resize',()=>{
  const h=harness(120),a=h.registry.create({...h.opts,id:'01',mode:'normal'});
  a.mount({...h.state,time:1000});
  assert.strictEqual(a.root.style.getPropertyValue('--scene-x'),'60px');
  a.render({...h.state,time:500,pinned:true});
  assert.strictEqual(a.root.style.getPropertyValue('--scene-x'),'60px');
  a.dispose();h.dom.window.close();
 });
 it('zero seconds really hides both arrows and shrinks width',()=>{
  const h=harness();
  const a=h.registry.create({...h.opts,id:'01',mode:'normal'});
  a.mount(h.state);
  a.render({...h.state,seekStepSeconds:0});
  assert(a.root.classList.contains('is-compact'));
  assert.strictEqual(a.root.style.getPropertyValue('--scene-preview-min-width'),'124px');
  for(const id of ['seek-back','seek-forward']){
   const button=a.root.querySelector('[data-scui-action="'+id+'"]');
   assert.strictEqual(button.hidden,true);
   assert.strictEqual(button.disabled,true);
  }
  a.render({...h.state,seekStepSeconds:15});
  assert.strictEqual(a.root.querySelector('.scene-seek-back').hidden,false);
  a.dispose();h.dom.window.close();
 });
 it('opens hidden tray on more, and removes all card owners on dispose',()=>{
  const h=harness();
  const a=h.registry.create({...h.opts,id:'01',mode:'normal'});
  a.mount(h.state);
  assert.strictEqual(h.host.children.length,1);
  a.root.querySelector('.scene-more').click();
  assert(a.root.classList.contains('is-expanded'));
  assert(h.actions.some(x=>x[0]==='more'));
  const css=h.dom.window.document.querySelector('style').textContent;
  assert(css.includes('position:absolute;z-index:1;right:-29px'));
  a.dispose();
  assert.strictEqual(h.host.children.length,0);
  assert.strictEqual(h.dom.window.document.querySelectorAll('style').length,0);
  h.dom.window.close();
 });
});
