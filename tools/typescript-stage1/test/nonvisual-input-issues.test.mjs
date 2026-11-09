import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {stripTypeScriptTypes,createRequire} from 'node:module';
const require=createRequire(import.meta.url),{JSDOM}=require('jsdom'),parser=require('@babel/parser');
const {createContext,run,beginSection}=require('../../../test/helpers/extractSource.js');
function sourceClass(name,file=name){
 const source=stripTypeScriptTypes(fs.readFileSync(new URL('../nico-src/'+file+'.ts',import.meta.url),'utf8'),{mode:'strip'});
 const find=node=>{if(!node||typeof node!=='object')return;
  if(node.type==='ClassDeclaration'&&node.id?.name===name)return node;
  for(const value of Object.values(node)){if(Array.isArray(value)){for(const x of value){const found=find(x);if(found)return found;}}
   else{const found=find(value);if(found)return found;}}};
 const node=find(parser.parse(source,{sourceType:'module',allowUndeclaredExports:true}));assert(node,name);
 return source.slice(node.start,node.end);
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
for(const [time,seconds] of [['90',90],['90s',90],['1m30s',90],['1h2m5s',3725],['1m',60],['',0],['garbage',0],['-5',0],['1mgarbage',0]]){
 test(`#115 setSrc interprets t=${time}`,async()=>{
  const context=vm.createContext({Emitter:class{},console:{log(){}}});
  vm.runInContext(sourceClass('YouTubeWrapper')+';globalThis.Wrapper=YouTubeWrapper;',context);
  const wrapper=Object.create(context.Wrapper.prototype),calls=[];
  wrapper._autoplay=true; // This #115 fixture verifies t= parsing on the autoplay-on path.
  wrapper._player={loadVideoById:value=>calls.push(value),loadPlaylist(){}};
  wrapper._parseVideoId=()=> 'synthetic';wrapper._parseUrlParams=()=>({t:time});
  await wrapper.setSrc('https://youtube.invalid/watch',4);
  assert.equal(calls[0].startSeconds,seconds+4);assert.equal(wrapper._startDiff,seconds);
  await wrapper.setSrc('https://youtube.invalid/watch',0);assert.equal(calls[1].startSeconds,seconds);
 });
}
for(const rate of [0.75,1.75,2.5])for(const mode of ['normal','input','focus','modifier','reassign','blur','repeat']){
 test(`#114 held speed restores ${rate} after ${mode}`,async t=>{
  const dom=new JSDOM('<!doctype html><body><input></body>');t.after(()=>dom.window.close());
  const c=createContext({window:dom.window,document:dom.window.document,SHORTCUT_ACTIONS:[]});
  run(beginSection('packages/lib/src/Emitter.js'),c);
  run(sourceClass('ShortcutKeyEmitter')+';globalThis.Keys=ShortcutKeyEmitter;',c);
  run('globalThis.config=new Emitter();globalThis.external=new Emitter();external.emitResolve("init");',c);
  c.config.props={KEY_SHIFT_RESET:82+(mode==='modifier'?0x10000:0),playbackRate:rate};
  const keys=c.Keys.create(c.config,dom.window.document.body,c.external),events=[];
  for(const kind of ['keyDown','keyUp'])keys.on(kind,(name,event,value)=>{
   events.push([kind,name,value]);if(name==='PLAYBACK_RATE')c.config.props.playbackRate=value;
  });await tick();
  const send=(kind,target=dom.window.document.body,extra={})=>target.dispatchEvent(new dom.window.KeyboardEvent(kind,
   {keyCode:82,bubbles:true,cancelable:true,ctrlKey:mode==='modifier',...extra}));
  send('keydown');assert.equal(c.config.props.playbackRate,0.1);
  if(mode==='repeat')send('keydown',undefined,{repeat:true});
  if(mode==='blur')dom.window.dispatchEvent(new dom.window.Event('blur'));
  else if(mode==='focus')dom.window.document.querySelector('input').dispatchEvent(new dom.window.FocusEvent('focusin',{bubbles:true}));
  else if(mode==='reassign'){c.config.props.KEY_SHIFT_RESET=83;c.config.emit('update','KEY_SHIFT_RESET',83);}
  else send('keyup',mode==='input'?dom.window.document.querySelector('input'):undefined,
   mode==='modifier'?{keyCode:17,ctrlKey:false}:{});
  assert.equal(c.config.props.playbackRate,rate);
  assert.deepEqual(events,[['keyDown','PLAYBACK_RATE',0.1],['keyUp','PLAYBACK_RATE',rate]]);
  send('keyup');assert.equal(events.length,2);
 });
}
test('#114 closing the real Dialog restores held speed before its closed shortcut guard',async t=>{
 const dom=new JSDOM('<!doctype html><body></body>');t.after(()=>dom.window.close());
 const rates=[],c=createContext({window:dom.window,document:dom.window.document,SHORTCUT_ACTIONS:[],
  MediaSessionApi:{updatePositionStateByMedia(){}},WatchInfoCacheDb:{putBestEffort(){}},
  Fullscreen:{now:()=>false},global:{emitter:{emitAsync(){}}}});
 run(beginSection('packages/lib/src/Emitter.js'),c);
 run(sourceClass('ShortcutKeyEmitter')+';globalThis.Keys=ShortcutKeyEmitter;',c);
 run(sourceClass('NicoVideoPlayerDialog')+';globalThis.Dialog=NicoVideoPlayerDialog;',c);
 run('globalThis.config=new Emitter();globalThis.external=new Emitter();external.emitResolve("init");globalThis.dialog=new Emitter();',c);
 c.config.props={KEY_SHIFT_RESET:82,KEY_TOGGLE_PLAY:32,playbackRate:1.75};
 // Match the real PlayerConfig API, including its read path used at Dialog close.
 c.config.getValue=key=>c.config.props[key];
 c.config.setValue=(key,value)=>{c.config.props[key]=value;if(key==='playbackRate')rates.push(value);c.config.emit('update',key,value);};
 const d=c.dialog;Object.setPrototypeOf(d,c.Dialog.prototype);let toggles=0;
 Object.assign(d,{_playerConfig:c.config,_state:{isOpen:true,isPlaying:false,isEnded:false,isError:false,setPausing(){}},
  _watchId:'sm1',_requestId:'A',_videoInfo:{watchId:'sm1',contextWatchId:'sm1',duration:300},
  _nicoVideoPlayer:{currentTime:20,pause(){},close(){}},_view:{},
  _clearVideoTimers(){},_cancelCommentLoad(){},_abortCommonsTreeJob(){},togglePlay(){toggles++;}});
 const keys=d._keyEmitter=c.Keys.create(c.config,dom.window.document.body,c.external);
 keys.on('keyDown',d._onKeyDown.bind(d));keys.on('keyUp',d._onKeyUp.bind(d));await tick();
 const send=(type,keyCode)=>dom.window.document.body.dispatchEvent(new dom.window.KeyboardEvent(type,{keyCode,bubbles:true,cancelable:true}));
 send('keydown',82);assert.equal(c.config.props.playbackRate,0.1);
 d.close();assert.equal(d._state.isOpen,false);assert.equal(c.config.props.playbackRate,1.75);
 send('keydown',32);assert.equal(toggles,0,'ordinary shortcuts remain blocked while closed');
 send('keyup',82);d.show();assert.equal(d._state.isOpen,true);
 assert.equal(c.config.props.playbackRate,1.75);assert.deepEqual(rates,[0.1,1.75]);
});
test('#118 Cancel discards edited date and cannot focus a hidden date input',t=>{
 const dom=new JSDOM('<!doctype html><body><input type="datetime-local"></body>');t.after(()=>dom.window.close());
 const timers=[],emitted=[],c=vm.createContext({BaseViewComponent:class{},Date,window:{setTimeout:fn=>timers.push(fn)}});
 vm.runInContext(sourceClass('TimeMachineView','CommentPanel')+';globalThis.View=TimeMachineView;',c);
 const view=Object.create(c.View.prototype),input=dom.window.document.querySelector('input');let focused=0;
 input.focus=()=>focused++;view._elm={input};view._state={isSelecting:false};
 view.setState=patch=>Object.assign(view._state,patch);view.emit=(...args)=>emitted.push(args);
 view._currentTimestamp=new Date('2020-01-02T03:04:05').getTime();
 view._videoPostTime=new Date('2019-01-01T00:00:00').getTime();
 view.openSelect();input.value='2021-02-03T04:05';view._onCancel();timers.shift()();
 assert.equal(focused,0);view.openSelect();assert.equal(new Date(input.value).getTime(),view._currentTimestamp);
 view._onSubmit();assert.equal(emitted[0][2].when,Math.floor(view._currentTimestamp/1000));
});
for(const [file,name,method] of [['PlayListView','PlayListView','_onDropFile'],['PlayListView','PlayListView','_onImportFileSelect'],['VideoListView','VideoListView','_onBodyDropFile']]){
 test(`#40 ${name}.${method} forwards import data without logging it`,()=>{
  const marker='PRIVATE_PLAYLIST_PAYLOAD_SENTINEL',logs=[],events=[];
  const c=vm.createContext({Emitter:class{},VideoListView:class{},window:{console:{log:(...args)=>logs.push(args)}},
   FileReader:class{readAsText(){this.onload({target:{result:marker}});}}});
  vm.runInContext(sourceClass(name,file)+';globalThis.View='+name+';',c);
  const subject=Object.create(c.View.prototype);subject._$fileDrop={removeClass(){}};subject.removeClass=()=>{};
  subject.emit=(...args)=>events.push(args);const importFile={name:'synthetic.playlist.json'};
  subject[method]({preventDefault(){},stopPropagation(){},dataTransfer:{files:[importFile]},target:{files:[importFile]}});
  assert(events.some(args=>args.includes(marker)));assert(!JSON.stringify(logs).includes(marker));
 });
}
