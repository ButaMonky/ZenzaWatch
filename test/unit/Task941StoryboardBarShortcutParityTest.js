'use strict';
const assert=require('assert');
const {createContext,loadClass,read}=require('../helpers/extractSource');

function setup(initial=false){
 const subscriptions=new Map(),history=[];
 const values={enableStoryboardBar:initial,enableStoryboard:true};
 const config={
  props:new Proxy(values,{
   set(target,key,value){
    const previous=target[key];target[key]=value;
    if(previous!==value){
     for(const listener of subscriptions.get(String(key))||[])listener(value);
    }
    return true;
   }
  }),
  onkey(key,listener){
   if(!subscriptions.has(key))subscriptions.set(key,new Set());
   subscriptions.get(key).add(listener);
  },
  offkey(key,listener){subscriptions.get(key)?.delete(listener);}
 };
 class View{
  constructor(params){this.isEnable=params.enable;history.push(['new',this.isEnable]);}
  enable(){this.isEnable=true;history.push(['enable']);}
  disable(){this.isEnable=false;history.push(['disable']);}
  toggle(){this.isEnable=!this.isEnable;history.push(['toggle',this.isEnable]);}
 }
 class Model{constructor() {this.isAvailable=true;}}
 class Emitter{on(){return this;}emitResolve(){return null;}}
 const ctx=createContext({
  Emitter,StoryboardInfoModel:Model,StoryboardView:View,
  global:{debug:{}},StoryboardInfoLoader:{load(){throw Error('network not allowed');}}
 });
 const Storyboard=loadClass('packages/zenza/src/storyboard/Storyboard.js','Storyboard',ctx);
 const board=new Storyboard({playerConfig:config,state:{},container:{}});
 return {board,config,history,subscriptions,values};
}
describe('Task941 storyboard bar key/settings/button synchronization',function(){
 it('immediately hides and shows an already-created storyboard when settings change',()=>{
  const {board,config,history,subscriptions}=setup(false);
  board._initializeStoryboard();
  assert.strictEqual(board.view.isEnable,false);
  assert(subscriptions.get('enableStoryboardBar')?.size>0,
    'Storyboard must subscribe to live setting changes');
  config.props.enableStoryboardBar=true;
  assert.strictEqual(board.view.isEnable,true,
    'shortcut changed the preference but did not open the bar');
  config.props.enableStoryboardBar=false;
  assert.strictEqual(board.view.isEnable,false,
    'shortcut changed the preference but did not hide the bar');
  assert.deepStrictEqual(history,[['new',false],['enable'],['disable']]);
 });
 it('pre-initialization changes become the first display state',()=>{
  const {board,config,history}=setup(false);
  config.props.enableStoryboardBar=true;
  board._initializeStoryboard();
  assert.strictEqual(board.view.isEnable,true);
  assert.deepStrictEqual(history,[['new',true]]);
  config.props.enableStoryboardBar=false;
  assert.strictEqual(board.view.isEnable,false);
  assert.deepStrictEqual(history,[['new',true],['disable']]);
 });
 it('a toolbar click still toggles once, without redundant config synchronization',()=>{
  const {board,config,history}=setup(false);
  board._initializeStoryboard();
  board.toggle();
  assert.strictEqual(board.view.isEnable,true);
  assert.strictEqual(config.props.enableStoryboardBar,true);
  board.toggle();
  assert.strictEqual(board.view.isEnable,false);
  assert.strictEqual(config.props.enableStoryboardBar,false);
  assert.deepStrictEqual(history,[['new',false],['toggle',true],['toggle',false]]);
 });
 it('repeated identical preference events do not restart visual transitions',()=>{
  const {board,config,history}=setup(false);
  board._initializeStoryboard();
  config.props.enableStoryboardBar=true;
  config.props.enableStoryboardBar=true;
  config.props.enableStoryboardBar=false;
  config.props.enableStoryboardBar=false;
  assert.deepStrictEqual(history,[['new',false],['enable'],['disable']]);
 });
 it('the two private installers actually ship the shared repair',()=>{
  const player=read('dist/ZenzaWatch-dev.user.js');
  const settings=read('dist/ZenzaAdvancedSettings.user.js');
  assert(player.includes('_onStoryboardBarVisibilityChange'),
    'Storyboard callback not bundled in the player');
  assert(player.includes("onkey?.('enableStoryboardBar'"),
    'settings observer not bundled in the player');
  assert(player.includes("'toggleStoryboard': 'TOGGLE_STORYBOARD_BAR'"),
    'the player lacks the right tooltip shortcut');
  assert(settings.includes("'toggleStoryboard': 'TOGGLE_STORYBOARD_BAR'"),
    'the settings userscript lacks the canonical shortcut registry');
  // Keep Task941's behavior test valid as private distributions advance.
  const playerVersion=read('src/_template.js').match(/^\/\/ @version\s+(\S+)/m)?.[1];
  const settingsVersion=read('tools/typescript-stage1/advanced-src/_setting.ts')
    .match(/^\/\/ @version\s+(\S+)/m)?.[1];
  assert.match(playerVersion||'',/^2\.7\.\d+-task\d+$/);
  assert.match(settingsVersion||'',/^0\.3\.\d+-task\d+$/);
  assert.strictEqual(player.match(/^\/\/ @version\s+(\S+)/m)?.[1],playerVersion);
  assert.strictEqual(settings.match(/^\/\/ @version\s+(\S+)/m)?.[1],settingsVersion);
 });
 it('keeps the two storyboard keyboard actions distinct',()=>{
  const actions=read('packages/zenza/src/ShortcutActions.js');
  const root=read('src/RootDispatcher.js');
  const view=read('src/VideoControlBar.js');
  assert(actions.includes("id: 'TOGGLE_STORYBOARD_BAR'"));
  assert(actions.includes("command: 'toggle-enableStoryboardBar'"));
  assert(actions.includes("id: 'TOGGLE_STORYBOARD'"));
  assert(actions.includes("command: 'toggle-enableStoryboard'"));
  assert(root.includes("case 'toggle-enableStoryboardBar':"));
  assert(view.includes("case 'toggleStoryboard':"));
  assert(view.includes('this.storyboard.toggle()'));
 });
});
