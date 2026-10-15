'use strict';
const assert=require('assert');
const {JSDOM,VirtualConsole}=require('jsdom');
const {loadClass,createContext}=require('../helpers/extractSource');
const make=(path,name)=>loadClass(path,name,createContext());
const root='packages/zenza/src/sceneSearch/';
const C={
 Controller:make(root+'SceneSearchController.js','SceneSearchController'),
 Interaction:make(root+'SceneSearchInteraction.js','SceneSearchInteraction'),
 IdleLimiter:make(root+'ScenePreviewIdleLimiter.js','ScenePreviewIdleLimiter'),
 SeekStepControl:make(root+'SceneSeekStepControl.js','SceneSeekStepControl'),
 CommentSearch:make(root+'SceneCommentSearch.js','SceneCommentSearch'),
 CommentSearchPanel:make(root+'SceneCommentSearchPanel.js','SceneCommentSearchPanel'),
 ShortcutRouter:make(root+'SceneSearchShortcutRouter.js','SceneSearchShortcutRouter'),
 VisibilityRegistry:make('src/UiVisibilityRegistry.js','UiVisibilityRegistry')
};
const Bridge=make(root+'SceneSearchIntegrationBridge.js','SceneSearchIntegrationBridge');
const Registry=make(root+'SceneSearchLayoutRegistry.js','SceneSearchLayoutRegistry');
const Card=make(root+'SceneSearchLayoutCard.js','SceneSearchLayoutCard');
const Film=make(root+'layouts/SceneSearchLayout07.js','SceneSearchLayout07');
const preference={
 'sceneSearch.layout.normal':'07',
 'sceneSearch.layout.fullscreen':'07',
 'sceneSearch.layout.linkFullscreen':false,
 'sceneSearch.seekStepSeconds':5,
 'sceneSearch.commentPreviewVisible':true,
 'sceneSearch.idleHideSeconds':0
};
describe('SCUI-18 Canvas ownership in real filmstrip layout 07',()=>{
 it('uses the existing worker canvas for center, optional cached images only for sides',async()=>{
  const errors=[],vc=new VirtualConsole();
  vc.on('jsdomError',e=>errors.push(e.message));
  const dom=new JSDOM('<!doctype html><html><head></head><body>'+
    '<div id="stage"><div id="seek"></div><div id="mount"></div></div>'+
    '<div id="tooltip" style="display:inline-flex"><div id="holder">'+
    '<div class="zenzaSeekThumbnail" id="shared">'+
    '<div class="zenzaSeekThumbnail-image">'+
    '<canvas id="original" class="zenzaSeekThumbnail-thumbnail" width="160" height="90"></canvas>'+
    '</div></div></div></div></body></html>',{virtualConsole:vc});
  const d=dom.window.document,values={...preference,...C.VisibilityRegistry.defaults()};
  const subscribers=new Map();
  const config={
    getValue:k=>values[k],
    setValue:(k,v)=>{values[k]=v;(subscribers.get(k)||[]).forEach(f=>f(v));},
    onkey:(k,fn)=>subscribers.set(k,[...(subscribers.get(k)||[]),fn]),
    offkey:(k,fn)=>{
      const others=(subscribers.get(k)||[]).filter(f=>f!==fn);
      if(others.length){subscribers.set(k,others);}
      else{subscribers.delete(k);}
    }
  };
  const registry=Film.install(new Registry(),Card);
  const source=d.getElementById('shared'),holder=d.getElementById('holder');
  const legacy=d.getElementById('tooltip');
  const bridge=new Bridge({
    classes:C,document:d,registry,config,
    container:d.getElementById('mount'),
    seekElement:d.getElementById('seek'),
    legacyTooltipElement:legacy,
    getThumbnailElement:()=>source,
    getChats:()=>[],getSeekTime:()=>70,
    onSeekRelative:()=>{},onSeekAbsolute:()=>{},
    loadPreview:async()=>({
      imageUrl:'https://example.invalid/current.jpg',time:70,
      frames:{
        previous:{imageUrl:'https://example.invalid/previous.jpg',time:60},
        next:{imageUrl:'https://example.invalid/next.jpg',time:80}
      }
    }),
    onError:e=>errors.push('callback:'+e.message)
  });
  bridge.start('normal');
  bridge.setVideo('sm1');
  const ok=await bridge.previewAt(70,'s70');
  assert.strictEqual(ok,true);
  const stage=d.querySelector('.zenzaSceneFilmstripFrames');
  assert(stage,'real layout07 must create three visible slots');
  assert.strictEqual(stage.querySelectorAll('.zenzaSceneFilmFrame').length,3);
  assert.strictEqual(stage.querySelector('.scene-current canvas'),d.getElementById('original'));
  assert.strictEqual(stage.querySelector('.scene-current .zenzaSceneImage').hidden,true,
    'second center image remains hidden');
  assert(stage.querySelector('.scene-previous img').src.includes('previous.jpg'));
  assert(stage.querySelector('.scene-next img').src.includes('next.jpg'));
  bridge.setMode('fullscreen');
  assert(d.querySelector('.zenzaSceneFilmstripFrames .scene-current').contains(source));
  assert.strictEqual(d.querySelectorAll('#original').length,1);
  assert.strictEqual(legacy.style.display,'none');
  bridge.dispose();
  assert.strictEqual(source.parentNode,holder);
  assert.strictEqual(legacy.style.display,'inline-flex');
  assert.strictEqual(d.querySelectorAll('style').length,0);
  assert.strictEqual(subscribers.size,0);
  assert.deepStrictEqual(errors,[]);
  dom.window.close();
 });
});
