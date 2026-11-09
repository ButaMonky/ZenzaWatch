'use strict';
// #214 repair contract: compiled toolbar/Dock retry and independent seekbar ticks.
// Offline synthetic DOM only; never access network, cookies or saved bookmarks.
const assert=require('assert');
const fs=require('fs');
const path=require('path');
const parser=require('@babel/parser');
const {pathToFileURL}=require('url');
const {JSDOM}=require('jsdom');
const {beginSection,createContext,run}=require('../helpers/extractSource');
const nico='tools/typescript-stage1/.generated/nico/';
let BookmarkDock;
before(async()=>{
  const url=pathToFileURL(path.resolve('packages/zenza/src/resume/ManualBookmarkDock.js')).href;
  ({ManualBookmarkDock:BookmarkDock}=await new Function('u','return import(u)')(url));
});
function canonicalClass(file,name){
  const source=fs.readFileSync(path.resolve(nico+file+'.js'),'utf8');
  const ast=parser.parse(source,{sourceType:'module',allowUndeclaredExports:true,
    plugins:['classProperties']});
  const node=ast.program.body.find(node=>node.type==='ClassDeclaration'&&node.id?.name===name);
  assert(node,name+' absent from current TS compilation');
  return source.slice(node.start,node.end);
}
function actualVideoInfoMarkup(){
  // Use the canonical production VideoInfoPanel HTML rather than a hand-built
  // lookalike: this proves that the Dock mount selector matches real markup.
  const source=fs.readFileSync(
    path.resolve('tools/typescript-stage1/nico-src/VideoInfoPanel.ts'),'utf8');
  const match=/VideoInfoPanel\.__tpl__\s*=\s*\(\s*`([\s\S]*?)`\s*\)\.trim\(\)/.exec(source);
  assert(match,'canonical video info template must be available');
  assert(!match[1].includes('${'),'the video info template must be static');
  return match[1];
}
function fixture({infoContent=true,firstBookmarkLoadFails=false}={}){
  const dom=new JSDOM('<!doctype html><body><div id="zenzaVideoPlayerDialog">'+
    '<div class="zenzaPlayerContainer"><div class="videoControlBar">'+
    '<button class="playbackPointsSwitch controlButton" type="button" '+
    'data-command="toggle-playbackPoints" aria-expanded="false"><span>▱</span></button>'+
    '</div></div></div></body>');
  const doc=dom.window.document;
  const container=doc.querySelector('.zenzaPlayerContainer');
  const button=doc.querySelector('.playbackPointsSwitch');
  const warnings=[];
  const consoleStub={warn:(...args)=>warnings.push(args),log(){},info(){},error(){}};
  class FakeVideoInfoPanel{
    constructor({node}){
      const host=node[0];
      if(infoContent){
        host.insertAdjacentHTML('beforeend',actualVideoInfoMarkup());
      }
    }
    on(){}
    update(){}
    onLoadFail(){}
  }
  const sessions=[];
  class FakeSession{
    constructor(){
      this.snapshot={status:'idle',videoId:null,bookmarks:[]};
      this.activateCalls=0;this.needsLoadRetry=false;sessions.push(this);
    }
    subscribe(listener){this.listener=listener;listener(this.snapshot);return()=>{this.listener=null;};}
    publish(snapshot){this.snapshot=snapshot;this.listener?.(snapshot);}
    dispose(){}
    // The production Dock now performs a read-only shared-DB refresh on open.
    refreshIfIdle(){return Promise.resolve({status:'applied',snapshot:this.snapshot});}
    deactivate(){this.publish({status:'idle',videoId:null,bookmarks:[]});}
    async activate(id){
      this.activateCalls++;
      const status=firstBookmarkLoadFails&&this.activateCalls===1?'error':'ready';
      this.needsLoadRetry=status==='error';
      this.publish({status,videoId:id,bookmarks:[]});
      return {status:status==='ready'?'applied':'error',snapshot:this.snapshot};
    }
  }
  const domClasses=Object.fromEntries(Object.getOwnPropertyNames(dom.window)
    .filter(n=>/^[A-Z]/.test(n)&&typeof dom.window[n]==='function')
    .map(n=>[n,dom.window[n]]));
  const ctx=createContext({
    ...domClasses,console:consoleStub,window:dom.window,document:doc,
    customElements:dom.window.customElements,CSS:dom.window.CSS,
    requestAnimationFrame:f=>setTimeout(f,0),cancelAnimationFrame:clearTimeout,
    IndexedDbManualBookmarkBackend:class{},
    ManualBookmarkRepository:class{},
    ManualBookmarkSession:FakeSession,
    ManualBookmarkDock:BookmarkDock,
    VideoInfoPanel:FakeVideoInfoPanel,
    util:{dispatchCommand:(target,command,param)=>target.dispatchEvent(
      new dom.window.CustomEvent('command',{bubbles:true,detail:{command,param}}))}
  });
  run(beginSection('packages/zenza/src/sceneSearch/TimelineGeometry.js'),ctx);
  run(beginSection('packages/zenza/src/sceneSearch/SceneResumeMarkerPresenter.js'),ctx);
  run(beginSection('packages/lib/src/Emitter.js'),ctx);
  run(beginSection('packages/lib/src/infra/bounce.js'),ctx);
  run(beginSection('packages/lib/src/text/textUtil.js'),ctx);
  run(beginSection('packages/lib/src/uQuery.js')+';globalThis.__uq=uq;',ctx);
  run(beginSection('packages/lib/src/dom/domEvent.js')+';globalThis.__domEvent=domEvent;',ctx);
  ctx.util=ctx.__domEvent;
  run(canonicalClass('NicoVideoPlayerDialog','NicoVideoPlayerDialogView')+';'+
    canonicalClass('NicoVideoPlayerDialog','NicoVideoPlayerDialog')+';'+
    canonicalClass('VideoControlBar','VideoControlBar')+';'+
    'globalThis.__View=NicoVideoPlayerDialogView;'+
    'globalThis.__Dialog=NicoVideoPlayerDialog;'+
    'globalThis.__Bar=VideoControlBar;',ctx);
  const view=Object.create(ctx.__View.prototype);
  const dialog=Object.create(ctx.__Dialog.prototype);
  dialog._view=view;
  dialog._state={isOpen:true};
  view._dialog=dialog;
  view._state={videoInfo:{watchId:'sm9',duration:120}};
  view._$playerContainer=[container];
  view._playerConfig={getValue:()=>true};
  view._currentTimeGetter=()=>13;
  view._applyPendingVideoInfo=()=>{};
  view.on('command',dialog._onCommand.bind(dialog));
  container.addEventListener('command',event=>{
    event.stopPropagation();event.preventDefault();
    view._onCommand(event.detail.command,event.detail.param);
  });
  const control=Object.create(ctx.__Bar.prototype);
  ctx.__uq(container.querySelector('.videoControlBar'))
    .on('click',control._onClick.bind(control))
    .on('command',control._onCommandEvent.bind(control));
  const click=()=>button.querySelector('span').click();
  const close=()=>{view.manualBookmarkDock?.dispose();dom.window.close();};
  return {ctx,control,view,dialog,container,button,warnings,click,close,
    get session(){return sessions[0];}};
}
describe('P12 real compiled toolbar command to dock integration (#214)',()=>{
  it('skips bookmark motion when the device requests reduced motion',()=>{
    const h=fixture();h.view._initializeVideoInfoPanel();const dock=h.view.manualBookmarkDock.element;
    dock.ownerDocument.defaultView.matchMedia=()=>({matches:true});
    let animations=0;dock.animate=()=>{animations++;throw new Error('Reduced motion must skip animate');};
    h.click();h.click();assert.equal(animations,0);assert.equal(dock.open,false);assert.equal(dock.inert,false);h.close();
  });
  it('animates the real dock without letting a stale close hide a reopened panel',()=>{
    const h=fixture();h.view._initializeVideoInfoPanel();
    const dock=h.view.manualBookmarkDock.element, animations=[];
    dock.animate=(frames,options)=>{const a={onfinish:null,cancel(){this.cancelled=true;},frames,options};animations.push(a);return a;};
    h.click(); assert.equal(animations[0].options.duration,220);
    h.click();assert.equal(dock.inert,true);assert.equal(h.button.getAttribute('aria-expanded'),'false');
    const closing=animations[1];h.click();assert.equal(closing.cancelled,true);assert.equal(dock.inert,false);
    assert.equal(dock.parentElement,h.container);
    h.click();animations[3].onfinish();assert.equal(dock.open,false);
    assert.equal(dock.classList.contains('zw-points-floating'),false);
    h.click();h.close();assert.equal(animations[4].cancelled,true);
  });
  it('dismisses on outside presses and clicks, preserving inside edits and the toolbar toggle',()=>{
    const h=fixture(); h.click();
    const dock=h.view.manualBookmarkDock.element, doc=dock.ownerDocument, win=doc.defaultView;
    const outside=doc.createElement('input'); doc.body.append(outside);
    const pointer=target=>target.dispatchEvent(new win.MouseEvent('pointerdown',{bubbles:true,cancelable:true}));
    assert.equal(dock.querySelector('[data-points-close]'),null);
    pointer(dock.querySelector('[data-point-tab]')); pointer(h.button.querySelector('span'));
    assert.equal(dock.open,true);
    outside.focus(); assert.equal(pointer(outside),true);
    assert.equal(dock.open,false); assert.equal(h.button.getAttribute('aria-expanded'),'false');
    assert.equal(doc.activeElement,outside);
    h.click(); outside.focus(); outside.click();
    assert.equal(dock.open,false); assert.equal(doc.activeElement,outside);
    h.click(); pointer(h.button); h.click(); assert.equal(dock.open,false);
    h.close();
  });
  it('opens a real bookmark dock, then restores it to the info tab on a second click',()=>{
    const h=fixture();
    h.view._initializeVideoInfoPanel();
    const original=h.container.querySelector('.zenzaWatchVideoInfoPanelContent');
    const mounted=h.container.querySelector('.zenzaManualBookmarkDock');
    assert(mounted,'the production Dock must mount after video info');
    assert.equal(mounted.open,false);
    assert.equal(original.contains(mounted),true);
    h.click();
    assert.equal(mounted.open,true);
    assert.equal(mounted.classList.contains('zw-points-floating'),true);
    assert.equal(mounted.parentElement,h.container);
    assert.equal(h.button.getAttribute('aria-expanded'),'true');
    assert(mounted.querySelector('[data-point-tab="repeat"]'),'AB tab exists');
    h.click();
    assert.equal(mounted.open,false);
    assert.equal(original.contains(mounted),true);
    assert.equal(h.button.getAttribute('aria-expanded'),'false');
    h.close();
  });
  it('recovers when the real info-tab target arrives after an initial mount failure',()=>{
    const h=fixture({infoContent:false});
    h.view._initializeVideoInfoPanel();
    assert.equal(h.view.manualBookmarkDock,undefined);
    h.container.insertAdjacentHTML('beforeend',actualVideoInfoMarkup());
    const content=h.container.querySelector(
      '.zenzaWatchVideoInfoPanel .tabs.videoInfoTab .zenzaWatchVideoInfoPanelContent');
    assert(content,'the real VideoInfoPanel selector is now available');
    h.click();
    const dock=h.container.querySelector('.zenzaManualBookmarkDock');
    assert(dock,'the click must reattempt mounting after the late DOM arrives');
    assert.equal(dock.open,true);
    assert.equal(h.button.getAttribute('aria-expanded'),'true');
    assert.equal(h.container.querySelectorAll('.zenzaManualBookmarkDock').length,1);
    h.click();
    assert.equal(dock.open,false);
    assert.equal(content.contains(dock),true);
    assert.equal(h.button.getAttribute('aria-expanded'),'false');
    h.close();
  });
  it('shows a visible non-sensitive status when the Dock target is still missing',()=>{
    const h=fixture({infoContent:false});
    h.view._initializeVideoInfoPanel();
    assert.equal(h.view.manualBookmarkDock,undefined);
    assert(h.warnings.some(args=>args[0]==='Manual bookmark dock unavailable'));
    h.click();
    const status=h.container.querySelector('.zw-points-unavailable[role="status"]');
    assert(status,'the button must not fail without user-visible feedback');
    assert.match(status.textContent,/再試行/);
    assert.equal(h.button.getAttribute('aria-expanded'),'false');
    assert.equal(h.container.querySelector('.zenzaManualBookmarkDock'),null);
    h.container.insertAdjacentHTML('beforeend',actualVideoInfoMarkup());
    h.click();
    assert(h.container.querySelector('.zenzaManualBookmarkDock'));
    assert.equal(h.container.querySelector('.zw-points-unavailable'),null);
    h.close();
  });
  it('keeps persisted markers visible after a non-destructive write error',()=>{
    const h=fixture();
    h.view._initializeVideoInfoPanel();
    const host=h.container.ownerDocument.createElement('div');
    h.container.append(host);
    h.control._$seekBarContainer=[host];
    const track=host.ownerDocument.createElement('div');
    track.className='seekBar';host.append(track);
    h.control._seekBar=track;
    h.control._playerState=h.view._state;
    h.view.videoControlBar=h.control;
    const saved=Object.freeze({id:'B1',videoId:'sm9',time:25,label:'保存済み',createdAt:1,updatedAt:1});
    h.session.publish({status:'ready',videoId:'sm9',bookmarks:[saved]});
    assert.equal(host.querySelectorAll('.manualBookmarkMarker').length,1);
    h.session.publish({status:'error',videoId:'sm9',bookmarks:[saved]});
    assert.equal(host.querySelectorAll('.manualBookmarkMarker').length,1,
      'a failed write does not erase already committed markers');
    assert.match(h.container.querySelector('[data-bookmark-status="error"]').textContent,/失敗/);
    h.session.publish({status:'loading',videoId:'sm10',bookmarks:[]});
    assert.equal(host.querySelectorAll('.manualBookmarkMarker').length,0,
      'a different video must not expose old markers');
    h.close();
  });
  it('retries a failed DB read on explicit reopen, without remounting or duplicating healthy reads',async()=>{
    const h=fixture({firstBookmarkLoadFails:true});
    h.dialog._requestId='current-1';
    h.view._pendingVideoInfo={requestId:'current-1',
      info:h.view._state.videoInfo,failed:false};
    h.view._applyPendingVideoInfo=
      h.ctx.__View.prototype._applyPendingVideoInfo.bind(h.view);
    h.view._initializeVideoInfoPanel();
    await Promise.resolve();await Promise.resolve();
    const dock=h.view.manualBookmarkDock;
    assert(dock,'initial mount should succeed even when the DB read fails');
    assert.equal(h.session.activateCalls,1);
    assert.equal(dock.bookmarkStatus,'error');
    h.click();
    assert.equal(h.session.activateCalls,2,'opening should retry the same video');
    await Promise.resolve();await Promise.resolve();
    assert.equal(dock.bookmarkStatus,'ready');
    assert.equal(h.container.querySelectorAll('.zenzaManualBookmarkDock').length,1);
    h.click();h.click();
    assert.equal(h.session.activateCalls,2,'a healthy session cannot be reloaded on toggles');
    h.session.publish({status:'error',videoId:'sm9',bookmarks:[]});
    h.click();h.click();
    assert.equal(h.session.activateCalls,2,
      'an unsuccessful write must not reload and erase unsaved field drafts');
    h.session.needsLoadRetry=true;
    h.dialog._requestId='newer-request';
    h.click();
    assert.equal(h.session.activateCalls,2,'stale request must not retry the old DB owner');
    h.close();
  });
  it('shows safe, independent bookmark ticks; click seeks and video change clears them',()=>{
    const h=fixture();
    const host=h.container.ownerDocument.createElement('div');
    host.className='seekBarContainer';
    h.container.append(host);
    const bar=h.control;
    bar._$seekBarContainer=[host];
    bar._seekBar=host.ownerDocument.createElement('div');
    bar._seekBar.className='seekBar';host.append(bar._seekBar);
    bar._playerState={videoInfo:{watchId:'sm9'}};
    const actions=[];
    bar.emit=(...args)=>actions.push(args);
    bar.setManualBookmarkMarkers([
      {id:'A1',time:12,label:'お気に入り'},
      {id:'A2',time:60,label:'<img src=x onerror=alert(1)>'},
      {id:'A2',time:63,label:'重複'},
      {id:'bad',time:121,label:'範囲外'}
    ],120,'sm9');
    const markers=host.querySelectorAll('button.manualBookmarkMarker');
    assert.equal(markers.length,2);
    assert.equal(markers[0].style.left,'10%');
    assert.equal(markers[1].style.left,'50%');
    assert.equal(host.querySelector('img'),null,'bookmark text must never become HTML');
    markers[0].click();
    assert.deepEqual(actions,[['command','seekTo',12]]);
    bar._playerState.videoInfo.watchId='sm10';
    markers[1].click();
    assert.equal(actions.length,1,'a stale marker cannot seek after a video switch');
    bar._clearManualBookmarkMarkers();
    assert.equal(host.querySelectorAll('.manualBookmarkMarker').length,0);
    bar.setManualBookmarkMarkers([{id:'B',time:8,label:'次'}],0,'sm10');
    assert.equal(host.querySelectorAll('.manualBookmarkMarker').length,0);
    h.close();
  });
});
