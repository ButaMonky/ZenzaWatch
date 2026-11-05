'use strict';
const assert=require('assert');
const {JSDOM}=require('jsdom');
const {loadClass,createContext}=require('../helpers/extractSource');
const context=createContext();
const Registry=loadClass('packages/zenza/src/sceneSearch/SceneSearchLayoutRegistry.js',
 'SceneSearchLayoutRegistry',context);
const Card=loadClass('packages/zenza/src/sceneSearch/SceneSearchLayoutCard.js',
 'SceneSearchLayoutCard',context);
const Filmstrip=loadClass('packages/zenza/src/sceneSearch/layouts/SceneSearchLayout07.js',
 'SceneSearchLayout07',context);
const Remote=loadClass('packages/zenza/src/sceneSearch/layouts/SceneSearchLayouts08_09.js',
 'SceneSearchLayouts08_09',context);
const state={shown:true,pinned:false,time:25,seekStepSeconds:5,
 commentListMode:true,commentPreviewVisible:true};
function harness(id,width,height,{panelHeight=200,scrollHeight=840,opened=true,previous=null}={}){
 const dom=new JSDOM('<!doctype html><html><body><div id="host"></div></body></html>');
 const d=dom.window.document,host=d.getElementById('host');
 Object.defineProperty(dom.window,'innerHeight',{configurable:true,value:height});
 const list=d.createElement('aside');list.className='zenzaCommentPreview';
 list.dataset.commentPreviewMode='list';list.style.maxHeight='200px';
 list.getBoundingClientRect=()=>({left:8,top:500,right:358,bottom:500+panelHeight,
   width:350,height:panelHeight});
 Object.defineProperty(list,'scrollHeight',{configurable:true,value:scrollHeight});
 host.append(list);
 host.getBoundingClientRect=()=>({left:0,top:16,right:width,bottom:566,
   width,height:550});
 if(previous){
  host.style.setProperty(previous.name,previous.value,previous.priority||'');
 }
 const registry=new Registry();
 if(id==='07')Filmstrip.install(registry,Card);
 else Remote.install(registry,Card);
 const actions=[],card=registry.create({id,mode:'normal',document:d,
  container:host,onAction:a=>actions.push(a),settings:{}});
 card.mount({...state,commentListMode:opened});
 return {dom,d,host,list,card,actions,close(){card.dispose();dom.window.close();}};
}
describe('UI07/UI09 locked normal viewport native list reachability',()=>{
 for(const width of [320,360,768,1280]){
  for(const height of [420,600,740,900]){
   for(const id of ['07','09']){
    it(id+' '+width+'x'+height+' chooses below only if native list fits',()=>{
     const h=harness(id,width,height);
     try{
      const nativeTopOffset=id==='07'?(width<580?157:10):(width<580?112:74);
      const needed=Math.max(id==='07'?160:165,200+nativeTopOffset+8);
      const expected=height-566<needed?'visible-fallback':'below';
      assert.strictEqual(h.card.root.dataset.scuiPlacement,expected);
      assert.strictEqual(h.list.parentNode,h.host,'native DOM remains player-owned');
      assert.strictEqual(h.list.dataset.commentPreviewMode,'list');
      const name=id==='07'?'--scui-ui07-list-lift':'--scui-ui09-list-lift';
      const fallbackBottom=id==='07'?94:153;
      const lift=expected==='visible-fallback'?
       Math.max(0,Math.ceil(566-fallbackBottom-height+8)):0;
      assert.strictEqual(h.host.style.getPropertyValue(name),lift+'px',
       'fallback compensates when even the overlay would extend beyond the viewport');
     }finally{h.close();}
    });
   }
  }
 }
 it('reserves list space before a native hover-to-list transition completes',()=>{
  // Real VideoControlBar and Bridge callbacks can run before the native view
  // changes data-comment-preview-mode to list. The old 140px hover box
  // must not make a newly requested 200px list fall below a locked viewport.
  for(const id of ['07','09']){
   const height=id==='07'?740:820;
   const h=harness(id,768,height,{panelHeight:140,opened:false});
   try{
    h.list.dataset.commentPreviewMode='hover';
    assert.strictEqual(h.card.root.dataset.scuiPlacement,'below');
    h.card.render({...state,commentListMode:true});
    assert.strictEqual(h.list.dataset.commentPreviewMode,'hover');
    assert.strictEqual(h.card.root.dataset.scuiPlacement,'visible-fallback',
     id+' must reserve the native list max-height during mode transition');
    h.list.dataset.commentPreviewMode='list';
    h.list.getBoundingClientRect=()=>({left:8,top:500,right:358,bottom:700,
     width:350,height:200});
    h.card.render({...state,time:27});
    assert.strictEqual(h.card.root.dataset.scuiPlacement,'visible-fallback');
   }finally{h.close();}
  }
 });
 it('uses actual reduced list height rather than assuming 200px at all times',()=>{
  for(const id of ['07','09']){
   const h=harness(id,768,740,{panelHeight:120,scrollHeight:120});
   try{
    assert.strictEqual(h.card.root.dataset.scuiPlacement,
     id==='07'?'below':'visible-fallback');
   }finally{h.close();}
  }
 });
 it('does not reserve unused native list space for mini-comment-only mode',()=>{
  for(const id of ['07','09']){
   const h=harness(id,768,740,{opened:false});
   try{assert.strictEqual(h.card.root.dataset.scuiPlacement,'below');}
   finally{h.close();}
  }
 });
 it('responds to native list growth after comment delivery without stale placement',()=>{
  for(const id of ['07','09']){
   const h=harness(id,768,740,{panelHeight:id==='07'?120:60,scrollHeight:100});
   try{
    assert.strictEqual(h.card.root.dataset.scuiPlacement,'below');
    h.list.getBoundingClientRect=()=>({left:8,top:500,right:358,bottom:700,
      width:350,height:200});
    h.card.render({...state,time:26});
    assert.strictEqual(h.card.root.dataset.scuiPlacement,'visible-fallback');
   }finally{h.close();}
  }
 });
 it('recomputes viewport fallback after resizing without a new DOM owner',()=>{
  for(const id of ['07','09']){
   const h=harness(id,768,900);
   try{
    const original=h.list;
    assert.strictEqual(h.card.root.dataset.scuiPlacement,'below');
    Object.defineProperty(h.dom.window,'innerHeight',{configurable:true,value:740});
    h.card.render({...state,time:27});
    assert.strictEqual(h.card.root.dataset.scuiPlacement,'visible-fallback');
    Object.defineProperty(h.dom.window,'innerHeight',{configurable:true,value:900});
    h.card.render({...state,time:28});
    assert.strictEqual(h.card.root.dataset.scuiPlacement,'below');
    assert.strictEqual(original.parentElement,h.host);
   }finally{h.close();}
  }
 });
 it('does not force native scrollHeight reads during repetitive seek-time updates',()=>{
  for(const id of ['07','09']){
   const h=harness(id,768,740);
   let reads=0;
   Object.defineProperty(h.list,'scrollHeight',{configurable:true,
    get(){reads++;return 840;}});
   try{
    for(let i=0;i<40;i++)h.card.render({...state,time:i+1});
    assert.strictEqual(reads,0,'visible panel geometry must not force list layout');
   }finally{h.close();}
  }
 });
 it('preserves original inline lift variables and priority on dispose',()=>{
  for(const id of ['07','09']){
   const name=id==='07'?'--scui-ui07-list-lift':'--scui-ui09-list-lift';
   const h=harness(id,768,420,{previous:{name,value:'4px',priority:'important'}});
   const list=h.list,host=h.host;
   try{
    assert.notStrictEqual(host.style.getPropertyValue(name),'4px');
    assert.strictEqual(list.parentNode,host);
   }finally{h.card.dispose();}
   assert.strictEqual(host.style.getPropertyValue(name),'4px');
   assert.strictEqual(host.style.getPropertyPriority(name),'important');
   assert.strictEqual(host.querySelector('.zenzaCommentPreview'),list);
   assert.strictEqual(host.querySelector('.zenzaSceneSearchHost'),null);
   h.dom.window.close();
  }
 });
 it('restores absent variables and retains original native click listeners',()=>{
  for(const id of ['07','09']){
   const h=harness(id,320,420);
   const name=id==='07'?'--scui-ui07-list-lift':'--scui-ui09-list-lift';
   let clicked=0;h.list.addEventListener('click',()=>clicked++);
   h.card.dispose();h.list.click();
   assert.strictEqual(clicked,1,'native click owner preserved');
   assert.strictEqual(h.host.style.getPropertyValue(name),'');
   assert.strictEqual(h.host.contains(h.list),true);
   h.dom.window.close();
  }
 });
 it('does not change UI08 own layout or create a UI09 lift',()=>{
  const h=harness('08',320,420);
  try{
   assert.strictEqual(h.card.root.dataset.layout,'08');
   assert.strictEqual(h.host.style.getPropertyValue('--scui-ui09-list-lift'),'');
   assert.strictEqual(h.list.parentNode,h.host);
  }finally{h.close();}
 });
 it('CSS scopes the overlay lift to UI07/UI09 normal/list/fallback only',()=>{
  const text07=Filmstrip.CSS,text09=Remote.CSS;
  for(const [css,id] of [[text07,'07'],[text09,'09']]){
   assert(css.includes('[data-scene-search-layout="'+id+'"]'));
   assert(css.includes('[data-scene-mode="normal"]'));
   assert(css.includes('[data-scene-placement="visible-fallback"]'));
   assert(css.includes('>.zenzaCommentPreview:where([data-comment-preview-mode="list"])')
      ||css.includes('>.zenzaCommentPreview:where([data-comment-preview-mode="list"])'));
   assert(!css.includes('[data-scene-search-layout="00"]'));
   assert(!css.includes('[data-scene-search-layout="01"]'));
  }
 });
});
