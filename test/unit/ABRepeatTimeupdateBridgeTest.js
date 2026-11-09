'use strict';
// #217: actual compiled Nico video layers must forward native HTMLVideoElement
// timeupdate into the real P12 AB interval logic. No network or saved DB access.
const assert=require('assert');
const fs=require('fs'),path=require('path'),parser=require('@babel/parser');
const {pathToFileURL}=require('url');
const {JSDOM}=require('jsdom');
const {createContext,run}=require('../helpers/extractSource');
let ManualBookmarkPanel;
before(async()=>{
  const file=path.resolve('packages/zenza/src/resume/ManualBookmarkPanel.js');
  ({ManualBookmarkPanel}=await new Function('u','return import(u)')(
    pathToFileURL(file).href));
});
function compiledClass(name,file='NicoVideoPlayer'){
  const source=fs.readFileSync(path.resolve(
    'tools/typescript-stage1/.generated/nico/'+file+'.js'),'utf8');
  const ast=parser.parse(source,{sourceType:'module',allowUndeclaredExports:true,plugins:['classProperties']});
  const node=ast.program.body.find(x=>x.type==='ClassDeclaration'&&x.id?.name===name);
  assert(node, name+' missing from canonical TS compile');
  return source.slice(node.start,node.end);
}
function build(){
  const dom=new JSDOM('<!doctype html><body><video></video><div id="touch"></div><main></main></body>');
  const doc=dom.window.document;
  const video=doc.querySelector('video'),touch=doc.querySelector('#touch');
  const root=doc.querySelector('main');
  const seen=[],commands=[],logs=[];
  const ctx=createContext({
    Emitter:class{},window:dom.window,document:doc,
    // NicoVideoPlayer installs a throttled wheel listener beside timeupdate.
    _: {throttle:fn=>fn},
    console:{log:(...a)=>logs.push(a),warn(){},error(){}},
    util:{$:element=>({
      on(name,listener){element.addEventListener(name,listener);return this;}
    })}
  });
  run(compiledClass('VideoPlayer')+';'+
      compiledClass('NicoVideoPlayer')+';'+
      compiledClass('NicoVideoPlayerDialog','NicoVideoPlayerDialog')+';'+
      'globalThis.__video=VideoPlayer;globalThis.__nico=NicoVideoPlayer;'+
      'globalThis.__dialog=NicoVideoPlayerDialog;',ctx);
  const raw=Object.create(ctx.__video.prototype);
  raw._video=video;raw._videoElement=video;raw._currentVideo=video;
  raw._src='https://example.test/native';raw._touchWrapper={body:touch};
  const subscribers=new Map();
  const add=(name,listener)=>{
    const listeners=subscribers.get(name)||[];
    listeners.push(listener);subscribers.set(name,listeners);
  };
  raw.on=(name,listener)=>{add(name,listener);return raw;};
  raw.emit=(name,...args)=>{
    seen.push(['raw',name]);
    for(const listener of subscribers.get(name)||[])listener(...args);
  };
  raw._initializeEvents();
  const nico=Object.create(ctx.__nico.prototype);
  const nicoListeners=new Map();
  nico._videoPlayer=raw;
  nico._commentPlayer={on(){},currentTime:0};
  nico._checkSupporterCreditPreload=()=>{};
  nico._state={on(){}};
  nico.on=(name,listener)=>{
    const listeners=nicoListeners.get(name)||[];
    listeners.push(listener);nicoListeners.set(name,listeners);return nico;
  };
  nico.emit=(name,...args)=>{
    seen.push(['nico',name]);
    for(const listener of nicoListeners.get(name)||[])listener(...args);
  };
  nico._initializeEvents();
  let time=5,playing=true,seeking=false;
  const session={
    snapshot:{status:'ready',videoId:'sm9',bookmarks:[]},
    subscribe(fn){fn(this.snapshot);return()=>{};}
  };
  const panel=new ManualBookmarkPanel(root,session,{
    currentVideoId:()=>session.snapshot.videoId,
    currentTime:()=>time,duration:()=>120,repeatEnabled:()=>true,
    timestamp:()=>100,newId:()=> 'B1',
    seek:value=>commands.push(['seekTo',value])
  });
  const dialog=Object.create(ctx.__dialog.prototype);
  dialog._state={isSeeking:false,isStalled:false};
  dialog._view={manualBookmarkDock:{tick:(...args)=>panel.tick(...args)}};
  Object.defineProperty(dialog,'currentTime',{get:()=>time});
  Object.defineProperty(dialog,'isPlaying',{get:()=>playing});
  nico.on('timeupdate',dialog._onVideoTimeUpdate.bind(dialog));
  const set=(t,p=true,s=false)=>{
    time=t;playing=p;seeking=s;nico._isPlaying=p;dialog._state.isSeeking=s;
  };
  const useYouTube=()=>{
    raw._videoYouTube={};raw._currentVideo=raw._videoYouTube;
    Object.defineProperty(raw,'currentTime',{get:()=>time,configurable:true});
  };
  const timer=()=>nico._onTimer();
  const fire=()=>video.dispatchEvent(new dom.window.Event('timeupdate'));
  const field=(id,value)=>{root.querySelector('[data-point-field="'+id+'"]').value=value;};
  const start=()=>{field('a','10');field('b','20');
    root.querySelector('[data-point-action="repeat"]').click();};
  const close=()=>{panel.dispose();dom.window.close();};
  return {seen,commands,logs,set,fire,start,close,root,session,useYouTube,timer,nico};
}
describe('P12 #217 actual native AB timeupdate propagation',()=>{
  it('forwards video timeupdate through the two production player classes and Dialog into A/B seek',()=>{
    const h=build();
    try{
      h.start();
      assert.deepEqual(h.commands,[['seekTo',10]],'starting interval seeks to A');
      h.commands.length=0;
      h.set(19);h.fire();
      assert.deepEqual(h.commands,[],'before B does not loop');
      h.set(20);h.fire();
      assert.deepEqual(h.commands,[['seekTo',10]],'B must auto seek to A');
      h.fire();assert.equal(h.commands.length,1,'no repeat seek while landing');
      h.set(10);h.fire();h.set(20);h.fire();
      assert.deepEqual(h.commands,[['seekTo',10],['seekTo',10]],
        'second pass over B must repeat again');
      assert.equal(h.seen.filter(e=>e[0]==='raw'&&e[1]==='timeupdate').length,5);
      assert.equal(h.seen.filter(e=>e[0]==='nico'&&e[1]==='timeupdate').length,5);
      assert.equal(h.logs.length,0,'timeupdate must not flood per-frame debug logs');
    }finally{h.close();}
  });
  it('reuses the existing YouTube comment clock for AB without a second timer',()=>{
    const h=build();
    try{
      h.start();h.commands.length=0;h.useYouTube();
      h.set(19,true);h.timer();assert.deepEqual(h.commands,[]);
      h.set(20,true);h.timer();assert.deepEqual(h.commands,[['seekTo',10]]);
      h.set(10,true);h.timer();h.set(20,true);h.timer();
      assert.equal(h.commands.length,2,'YouTube AB loops over B twice');
      h.commands.length=0;
      h.set(20,false);h.timer();assert.equal(h.commands.length,0,'paused YouTube never seeks');
      h.set(20,true,true);h.timer();assert.equal(h.commands.length,0,'seeking YouTube never seeks');
      assert.equal(h.seen.some(x=>x[0]==='raw'&&x[1]==='timeupdate'),false,
        'YouTube loop must not fake a native HTMLVideoElement event');
      assert.equal(h.seen.filter(x=>x[0]==='nico'&&x[1]==='timeupdate').length,5,
        'paused source must not produce a timeupdate');
      assert.equal(h.logs.length,0);
    }finally{h.close();}
  });
  it('forwards paused and seeking state without triggering AB and rejects stale video owners',()=>{
    const h=build();
    try{
      h.start();h.commands.length=0;
      h.set(22,false);h.fire();
      h.set(22,true,true);h.fire();
      assert.deepEqual(h.commands,[]);
      h.set(22,true,false);h.fire();
      assert.deepEqual(h.commands,[['seekTo',10]]);
      h.commands.length=0;
      h.session.snapshot={status:'ready',videoId:'sm10',bookmarks:[]};
      h.set(21);h.fire();
      assert.deepEqual(h.commands,[],'old interval cannot control another video');
    }finally{h.close();}
  });
});
