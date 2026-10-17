'use strict';
const {JSDOM,VirtualConsole}=require('jsdom');
const {createContext,run,beginSection}=require('./extractSource');
const scene='packages/zenza/src/sceneSearch/';
const modules=['src/UiVisibilityRegistry.js',...[
 'SceneSearchLayoutCard.js','SceneSearchLayout00.js',
 'SceneSearchLayoutRegistry.js','SceneSearchLayoutCatalog.js',
 'SceneSearchLayouts01_02.js','layouts/SceneSearchLayouts03_04.js',
 'layouts/SceneSearchLayouts05_06.js','layouts/SceneSearchLayout07.js',
 'layouts/SceneSearchLayouts08_09.js','layouts/SceneSearchLayout10.js',
 'SceneSearchLayoutBootstrap.js','SceneSearchController.js','SceneSearchInteraction.js',
 'ScenePreviewIdleLimiter.js','SceneSeekStepControl.js','SceneCommentSearch.js',
 'SceneCommentSearchPanel.js','SceneSearchShortcutRouter.js','SceneSearchIntegrationBridge.js',
 'SceneSearchLegacyAdapter.js','SceneSearchPlayerBinding.js'].map(x=>scene+x)];
function emitter(){
 const rows=new Map();
 return {on(k,f){if(!rows.has(k))rows.set(k,new Set());rows.get(k).add(f);},
 off(k,f){rows.get(k)?.delete(f);},emit(k,...a){for(const f of [...rows.get(k)||[]])f(...a);},
 count(){return [...rows.values()].reduce((n,s)=>n+s.size,0);}};
}
function fixture(id='01',mode='normal'){
 const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
 const dom=new JSDOM('<!doctype html><html><head></head><body>'+
  '<div id="player" style="position:relative;width:900px;height:520px">'+
  '<div id="seek"></div><aside class="zenzaCommentPreview"></aside>'+
  '<div id="old"><div id="thumb" class="zenzaSeekThumbnail"><canvas width="160" height="90"></canvas></div></div>'+
  '</div></body></html>',{url:'https://example.invalid/',virtualConsole:vc});
 const d=dom.window.document,ctx=createContext({document:d});
 for(const file of modules)run(beginSection(file),ctx);
 run('globalThis.Binding=SceneSearchPlayerBinding;globalThis.Visibility=UiVisibilityRegistry;',ctx);
 const values={'sceneSearch.layout.normal':id,'sceneSearch.layout.fullscreen':id,
  'sceneSearch.seekStepSeconds':5,'sceneSearch.idleHideSeconds':0,
  'sceneSearch.animation':'off','sceneSearch.controlsReveal':'hover-focus',
  ...ctx.Visibility.defaults()};
 const listeners=new Map();
 const config={getValue:k=>values[k],setValue(k,v){values[k]=v;
   for(const f of listeners.get(k)||[])f(v);},
  onkey(k,f){if(!listeners.has(k))listeners.set(k,new Set());listeners.get(k).add(f);},
  offkey(k,f){listeners.get(k)?.delete(f);}};
 const player=Object.assign(emitter(),{isOpen:true,watchId:'sm9',duration:1000,
  chatList:[{text:'scene test',vpos:2000,uniqNo:'synthetic'}]});
 const commands=[];player.execCommand=(command,value)=>commands.push([command,value]);
 const events=emitter(),storyboard=emitter();let fullscreen=mode==='fullscreen';
 const host=d.getElementById('player'),seek=d.getElementById('seek');
 if(id==='00'){
   // The UI00 native layout reuses the exact seekbar/tooltip DOM owned by VideoControlBar.
   const old=d.getElementById('old'),thumb=d.getElementById('thumb');
   const holder=d.createElement('div');holder.className='seekBarThumbnailContainer';
   old.insertBefore(holder,thumb);holder.appendChild(thumb);
   thumb.classList.add('zenzaSeekThumbnail','is-visible');
   const image=d.createElement('div');image.className='zenzaSeekThumbnail-image';
   while(thumb.firstChild)image.appendChild(thumb.firstChild);
   thumb.appendChild(image);
   old.classList.add('seekBarToolTip');
   const buttons=d.createElement('div');buttons.className='seekBarToolTipButtonContainer';
   const toggle=d.createElement('button');toggle.className='toggleCommentPreview';
   toggle.title='original';buttons.appendChild(toggle);old.appendChild(buttons);
   seek.classList.add('seekBarContainer');
   seek.append(old,d.querySelector('.zenzaCommentPreview'));
 }
 host.getBoundingClientRect=()=>({left:0,top:0,x:0,y:0,width:900,height:520,right:900,bottom:520});
 seek.getBoundingClientRect=()=>({left:0,top:500,x:0,y:500,width:900,height:20,right:900,bottom:520});
 const bar={player,_duration:1000,_playerConfig:config,_seekBar:seek,storyboard,
  _seekBarToolTip:{_$view:[d.getElementById('old')],_seekBarThumbnail:{_view:d.getElementById('thumb')}},
  _commentPreview:{_view:{_view:d.querySelector('.zenzaCommentPreview')},_model:{_chatList:player.chatList}}};
 const binding=new ctx.Binding({view:{videoControlBar:bar},dialog:player,document:d,
  container:host,events,isFullscreen:()=>fullscreen,onError:code=>errors.push(code)});
 binding.attach();
 return {dom,d,host,seek,binding,player,bar,config,events,storyboard,commands,errors,
  move(x){seek.dispatchEvent(new dom.window.MouseEvent('mouseenter',{clientX:x,bubbles:true}));
    seek.dispatchEvent(new dom.window.MouseEvent('mousemove',{clientX:x,bubbles:true}));},
  setMode(v){fullscreen=v==='fullscreen';events.emit('fullscreenStatusChange');},
  close(){binding.dispose();dom.window.close();}};
}
module.exports={fixture,modules};
