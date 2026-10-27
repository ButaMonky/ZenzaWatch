'use strict';
const assert=require('assert');
const {createContext,loadClass,read,run,beginSection}=require('../helpers/extractSource');

function deferred(){
 let resolve,reject;
 const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});
 return {promise,resolve,reject};
}
function harness({enabled=true,bar=true,externalConfig=null}={}){
 const events=[],requests=[],settingsListeners=new Map(),queued=[];
 const values={enableStoryboard:enabled,enableStoryboardBar:bar,videoServerType:'domand'};
 const config={props:new Proxy(values,{set(target,key,value){
   if(target[key]===value)return true;
   target[key]=value;
   queued.push([key,value]);
   return true;
 }}),onkey(key,fn){
   if(!settingsListeners.has(key))settingsListeners.set(key,new Set());
   settingsListeners.get(key).add(fn);
 }};
 class Emitter{
   on(){return this;}
   emit(name){events.push(['emit',name]);return this;}
   promise(){return Promise.resolve();}
   emitResolve(){return null;}
 }
 class Model{
   constructor(){this.isAvailable=false;}
   reset(){this.isAvailable=false;events.push(['model-reset']);}
   update(data){this.isAvailable=!!data?.ready;events.push(['model-update',this.isAvailable]);}
 }
 class View{
   constructor(options){this.isEnable=options.enable;events.push(['view-init',this.isEnable]);}
   enable(){this.isEnable=true;events.push(['view-enable']);}
   disable(){this.isEnable=false;events.push(['view-disable']);}
   toggle(){this.isEnable=!this.isEnable;events.push(['view-toggle',this.isEnable]);}
 }
 const state={isStoryboardAvailable:false};
 const loader={load(type,info){const request=deferred();requests.push({type,info,...request});return request.promise;}};
 const ctx=createContext({
   Emitter,StoryboardInfoModel:Model,StoryboardView:View,
   StoryboardInfoLoader:loader,
   global:{debug:{}},console:{log(){},warn(){}},
   performance:{now:()=>12}
 });
 const S=loadClass('packages/zenza/src/storyboard/Storyboard.js','Storyboard',ctx);
 const board=new S({playerConfig:externalConfig||config,state,container:{},loader});
 const send=()=>{
   const [key,value]=queued.shift()||[];
   if(!key)return false;
   for(const cb of settingsListeners.get(key)||[])cb(value);
   return true;
 };
 const drain=()=>{while(send()){}};
 const settle=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
 const video=(id='sm101')=>({watchId:id,hasStoryboard:true,duration:120});
 return {board,config:externalConfig||config,values,state,requests,events,send,drain,settle,video,settingsListeners};
}
describe('Task943 storyboard master toggle live behavior',function(){
 this.timeout(15000);
 it('disabling master resets available thumbnails without losing the bar preference',async()=>{
   const h=harness();h.board.load('sm101',h.video());
   h.requests[0].resolve({ready:true});await h.settle();
   assert.strictEqual(h.state.isStoryboardAvailable,true);
   assert.strictEqual(h.board.model.isAvailable,true);
   h.config.props.enableStoryboard=false;h.drain();
   assert.strictEqual(h.state.isStoryboardAvailable,false,'master OFF must clear availability');
   assert.strictEqual(h.board.model.isAvailable,false,'master OFF must invalidate seek thumbnail');
   assert.strictEqual(h.board.view.isEnable,false,'master OFF must close legacy filmstrip');
   assert.strictEqual(h.config.props.enableStoryboardBar,true,
     'turning off master must not overwrite separately saved bar preference');
 });
 it('turning master on loads the current video without waiting for a new canPlay',async()=>{
   const h=harness({enabled:false,bar:true});
   h.board.load('sm101',h.video());
   assert.strictEqual(h.requests.length,0,'disabled master must not call loader');
   h.config.props.enableStoryboard=true;h.drain();
   assert.strictEqual(h.requests.length,1,'master ON must request current storyboard');
   assert.strictEqual(h.requests[0].info.watchId,'sm101');
   h.requests[0].resolve({ready:true});await h.settle();
   assert.strictEqual(h.board.model.isAvailable,true);
   assert.strictEqual(h.state.isStoryboardAvailable,true);
   assert.strictEqual(h.board.view.isEnable,true,
     'restored bar preference should be honored when master is ON');
 });
 it('late reply after master OFF cannot resurrect a thumbnail or toolbar',async()=>{
   const h=harness();h.board.load('sm101',h.video());
   assert.strictEqual(h.requests.length,1);
   h.config.props.enableStoryboard=false;h.drain();
   h.requests[0].resolve({ready:true});await h.settle();
   assert.strictEqual(h.board.model.isAvailable,false);
   assert.strictEqual(h.state.isStoryboardAvailable,false);
   assert.strictEqual(h.board.view.isEnable,false);
 });
 it('rapid OFF-ON creates a new request and ignores the older response',async()=>{
   const h=harness();h.board.load('sm101',h.video());
   h.config.props.enableStoryboard=false;h.drain();
   h.config.props.enableStoryboard=true;h.drain();
   assert.strictEqual(h.requests.length,2,'retry immediately after enabling');
   h.requests[0].resolve({ready:true,which:'old'});await h.settle();
   assert.strictEqual(h.state.isStoryboardAvailable,false,'stale first result must not win');
   h.requests[1].resolve({ready:true,which:'new'});await h.settle();
   assert.strictEqual(h.state.isStoryboardAvailable,true);
   assert.deepStrictEqual(h.requests.map(r=>r.info.watchId),['sm101','sm101']);
 });
 it('a new video resets retained info so master ON does not fetch the old video',()=>{
   const h=harness({enabled:false});
   h.board.load('sm101',h.video('sm101'));
   h.board.reset();
   h.config.props.enableStoryboard=true;h.drain();
   assert.strictEqual(h.requests.length,0,'old video was already left');
   h.board.load('sm102',h.video('sm102'));
   assert.strictEqual(h.requests.length,1);
   assert.strictEqual(h.requests[0].info.watchId,'sm102');
 });
 it('stale delayed master notifications cannot undo the latest preference',()=>{
   const h=harness({enabled:false,bar:true});
   h.board.load('sm101',h.video());
   h.config.props.enableStoryboard=true;
   h.config.props.enableStoryboard=false;
   h.drain();
   assert.strictEqual(h.requests.length,0,'old ON event must not start a request');
   assert.strictEqual(h.state.isStoryboardAvailable,false);
   assert.strictEqual(h.config.props.enableStoryboardBar,true);
 });
 it('master OFF still allows saving the independent bar switch without opening it',()=>{
   const h=harness({enabled:false,bar:true});
   h.board.load('sm101',h.video());
   h.board._initializeStoryboard();
   h.config.props.enableStoryboardBar=false;h.drain();
   h.config.props.enableStoryboardBar=true;h.drain();
   assert.strictEqual(h.board.view.isEnable,false,
     'bar should not become visible while the storyboard master is disabled');
 });
 it('does not emit duplicate thumbnail resets for stale OFF notifications',()=>{
   const h=harness({enabled:true});
   h.board.load('sm101',h.video());
   h.config.props.enableStoryboard=false;
   h.config.props.enableStoryboard=true;
   h.config.props.enableStoryboard=false;
   h.drain(); // delayed ON / OFF / OFF; current value is OFF
   const resets=h.events.filter(v=>v[0]==='emit'&&v[1]==='reset');
   assert.strictEqual(resets.length,1,'stale events must not reset twice');
   assert.strictEqual(h.state.isStoryboardAvailable,false);
   assert.strictEqual(h.requests.length,1);
 });
 it('ignores a loader response before the master-off event is dispatched',async()=>{
   const h=harness();h.board.load('sm101',h.video());
   h.config.props.enableStoryboard=false; // props updated, onkey still queued
   h.requests[0].resolve({ready:true});
   await h.settle();
   assert.strictEqual(h.state.isStoryboardAvailable,false);
   assert.strictEqual(h.board.model.isAvailable,false);
   h.drain();
   assert(h.events.some(v=>v[0]==='emit'&&v[1]==='reset'),
     'seek-thumbnail listener must receive explicit reset');
 });
 it('does not open a disabled master when its separate bar button is toggled',()=>{
   const h=harness({enabled:false,bar:false});
   h.board._initializeStoryboard();
   h.board.toggle();
   assert.strictEqual(h.config.props.enableStoryboardBar,true,
     'click may save the independent bar preference');
   assert.strictEqual(h.board.view.isEnable,false,
     'but the legacy filmstrip must stay hidden while master is OFF');
 });
 it('actual DataStorage events hide and reload current video without another canPlay',async()=>{
   const errors=[];
   const ctx=createContext({
     localStorage:{},
     bounce:{time:fn=>fn},
     objUtil:{bridge(dest,source){
       for(const key of Object.getOwnPropertyNames(Object.getPrototypeOf(source))){
         if(typeof source[key]==='function')dest[key]=source[key].bind(source);
       }
     }},
     console:{warn(){},log(){},error(...args){errors.push(args);}}
   });
   run(beginSection('packages/lib/src/Emitter.js'),ctx);
   const DataStorage=loadClass('packages/lib/src/infra/DataStorage.js','DataStorage',ctx);
   const prefs=new DataStorage({enableStoryboard:true,enableStoryboardBar:true,
      videoServerType:'domand'}, {prefix:'Task943',storage:{}});
   await prefs.promise('restore');
   const h=harness({externalConfig:prefs});
   h.board.load('sm101',h.video('sm101'));
   h.requests[0].resolve({ready:true});await h.settle();
   assert.strictEqual(h.state.isStoryboardAvailable,true);
   prefs.props.enableStoryboard=false;
   await new Promise(resolve=>setTimeout(resolve,30));
   assert.strictEqual(h.state.isStoryboardAvailable,false);
   assert.strictEqual(h.board.model.isAvailable,false);
   assert.strictEqual(prefs.props.enableStoryboardBar,true);
   prefs.props.enableStoryboard=true;
   await new Promise(resolve=>setTimeout(resolve,30));
   assert.strictEqual(h.requests.length,2,'one current-video request per reenable');
   h.requests[1].resolve({ready:true});await h.settle();
   assert.strictEqual(h.state.isStoryboardAvailable,true);
   assert.strictEqual(h.board.view.isEnable,true);
   assert.strictEqual(errors.length,0);
 });
 it('reenabling thumbnails does not force open an independently disabled filmstrip',async()=>{
   const h=harness({enabled:false,bar:false});
   h.board.load('sm101',h.video());
   h.config.props.enableStoryboard=true;h.drain();
   assert.strictEqual(h.requests.length,1);
   h.requests[0].resolve({ready:true});await h.settle();
   assert.strictEqual(h.state.isStoryboardAvailable,true);
   assert.strictEqual(h.board.view.isEnable,false,
     'enableStoryboard must not override the independent filmstrip preference');
   assert.strictEqual(h.config.props.enableStoryboardBar,false);
 });
 it('videos without storyboard metadata do not create a delayed load on master ON',()=>{
   const h=harness({enabled:false});
   h.board.load('sm101',{watchId:'sm101',hasStoryboard:false});
   h.config.props.enableStoryboard=true;h.drain();
   assert.strictEqual(h.requests.length,0);
   assert.strictEqual(h.board.state.isStoryboardAvailable,false);
 });
 it('the private distributed player contains the master fix and distinct shortcuts',()=>{
   const actions=read('packages/zenza/src/ShortcutActions.js');
   assert(actions.includes("command: 'toggle-enableStoryboard'"));
   assert(actions.includes("command: 'toggle-enableStoryboardBar'"));
   const distributed=read('dist/ZenzaWatch-dev.user.js');
   assert(distributed.includes("onkey?.('enableStoryboard'"),
     'private userscript has not bundled the live master listener');
   assert(distributed.includes('_onStoryboardMasterChange'),
     'private userscript has not bundled the master synchronizer');
   assert(distributed.includes('_currentVideoInfo'),
     'private userscript cannot restore current video on reenabling');
   assert(distributed.includes('ZenzaWatch/raw/develop'),
     'this test must not redirect private installs to public stable');
 });
});
