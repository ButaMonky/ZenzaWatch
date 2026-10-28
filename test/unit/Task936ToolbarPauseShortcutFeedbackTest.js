'use strict';
const assert=require('assert');
const {JSDOM}=require('jsdom');
const {createContext,loadClass,read}=require('../helpers/extractSource');

function harness(){
 const pending=new Map(),cancelled=[];
 let sequence=0;
 const full={value:false};
 const ctx=createContext({
   Fullscreen:{now:()=>full.value},
   Emitter:class{},
   setTimeout(fn,delay){const id=++sequence;pending.set(id,{fn,delay});return id;},
   clearTimeout(id){if(pending.has(id))cancelled.push(id);pending.delete(id);},
   SHORTCUT_ACTIONS:[{id:'TOGGLE_NG_FILTER',legacy:false,command:'toggle-enableFilter'}]
 });
 const View=loadClass('src/NicoVideoPlayerDialog.js','NicoVideoPlayerDialogView',ctx);
 const Dialog=loadClass('src/NicoVideoPlayerDialog.js','NicoVideoPlayerDialog',ctx);
 const dom=new JSDOM('<div id="player" class="zenzaPlayerContainer"><div class="hoverMenuContainer"><div class="menuItemContainer leftBottom"><div class="scalingUI"><div class="showCommentSwitch menuButton"></div><div class="ngFilterSwitch menuButton"></div></div></div></div></div>');
 const view=Object.create(View.prototype),dialog=Object.create(Dialog.prototype);
 const cfg=view._playerConfig={props:{
   showComment:true,enableFilter:true,screenMode:'normal',
   'controlBar.showOnPause.small':false,
   'controlBar.showOnPause.fullscreen':false,
   'controlBar.hideAfterSeconds.small':3,
   'controlBar.hideAfterSeconds.fullscreen':0.4
 }};
 view._state={screenMode:'normal'};
 view._$playerContainer=[dom.window.document.getElementById('player')];
 const events=[];
 view._onControlBarIdleDebounced=Object.assign(()=>events.push('small'),{cancel:()=>events.push('cancel-small')});
 view._onControlBarIdleDebouncedDefault=Object.assign(()=>events.push('regular'),{cancel:()=>events.push('cancel-regular')});
 view.addClass=x=>events.push('add:'+x);
 view.removeClass=x=>events.push('remove:'+x);
 dialog._state={isOpen:true};
 dialog._playerConfig=cfg;dialog._view=view;
 dialog.execCommand=name=>{
   events.push('command:'+name);
   if(name==='toggle-showComment')cfg.props.showComment=!cfg.props.showComment;
   if(name==='toggle-enableFilter')cfg.props.enableFilter=!cfg.props.enableFilter;
 };
 const tick=(ms)=>{
   for(const [id,item] of [...pending])if(item.delay===ms){
     pending.delete(id);item.fn();
   }
 };
 return {view,dialog,ctx,dom,cfg,full,events,pending,cancelled,tick,
   element:s=>dom.window.document.querySelector(s),
   close(){dom.window.close();}
 };
}
describe('Task936 fullscreen/small pause preference and shortcut icon',function(){
 this.timeout(12000);
 it('uses independent bounded idle seconds while keeping normal 400ms',()=>{
   const h=harness();try{
     h.view._scheduleControlBarIdle();
     assert(h.events.includes('regular'));
     h.events.length=0;
     h.view._state.screenMode='small';
     h.cfg.props['controlBar.hideAfterSeconds.small']=1.3;
     h.view._scheduleControlBarIdle();
     assert.deepStrictEqual([...h.pending.values()].map(x=>x.delay),[1300]);
     h.events.length=0;
     h.view._scheduleControlBarIdle();
     assert.strictEqual(h.pending.size,1,'rapid mousemove resets one timer');
     h.tick(1300);
     assert(h.events.includes('remove:is-controlBarActive')===false,'inactive state remains inactive');
     h.view._state.screenMode='normal';h.full.value=true;
     h.cfg.props['controlBar.hideAfterSeconds.fullscreen']=1;
     h.view._scheduleControlBarIdle();
     assert.deepStrictEqual([...h.pending.values()].map(x=>x.delay),[1000]);
     h.events.length=0;h.full.value=false;
     h.view._scheduleControlBarIdle();
     assert.strictEqual(h.pending.size,0,'normal mode clears custom timer');
     assert(h.events.includes('regular'));
   }finally{h.close();}
 });
 it('does not wake the bar on small/fullscreen pause until enabled',()=>{
   const h=harness();try{
     h.view._state.screenMode='small';
     h.view._onVideoPause();
     assert(!h.events.length);
     h.cfg.props['controlBar.showOnPause.small']=true;
     h.view._onVideoPause();
     assert(h.events.includes('add:is-controlBarActive'));
     h.view._onControlBarIdle();h.events.length=0;
     h.view._state.screenMode='normal';h.full.value=true;
     h.view._onVideoPause();assert.deepStrictEqual(h.events,[]);
     h.cfg.props['controlBar.showOnPause.fullscreen']=true;
     h.view._onVideoPause();
     assert(h.events.includes('add:is-controlBarActive'));
     h.view._onControlBarIdle();h.events.length=0;
     h.full.value=false;h.view._onVideoPause();
     assert(h.events.includes('add:is-controlBarActive'),
       'normal mode keeps its pause cue');
   }finally{h.close();}
 });
 it('flashes only requested icon for 1000ms and reveals actual ON/OFF',()=>{
   const h=harness();try{
     h.view._flashShortcutToggleFeedback('comment',false);
     const a=h.element('.showCommentSwitch'),b=h.element('.ngFilterSwitch');
     assert(a.classList.contains('is-shortcut-feedback'));
     assert.strictEqual(a.dataset.shortcutState,'OFF');
     assert.strictEqual(b.classList.contains('is-shortcut-feedback'),false);
     assert.strictEqual([...h.pending.values()].filter(x=>x.delay===1000).length,1);
     h.view._flashShortcutToggleFeedback('ng',true);
     assert(!a.classList.contains('is-shortcut-feedback'));
     assert(b.classList.contains('is-shortcut-feedback'));
     assert.strictEqual(b.getAttribute('aria-label'),'NGフィルター ON');
     h.view._flashShortcutToggleFeedback('ng',false);
     assert.strictEqual([...h.pending.values()].filter(x=>x.delay===1000).length,1,'repeated hotkey restarts one reveal timer');
     assert.strictEqual(b.dataset.shortcutState,'OFF');
     h.tick(1000);
     assert(!b.classList.contains('is-shortcut-feedback'));
     assert(!b.hasAttribute('data-shortcut-state'));
     assert(!b.hasAttribute('aria-label'));
   }finally{h.close();}
 });
 it('dispatches V/comment and NG keyboard commands and shows post-toggle states',()=>{
   const h=harness();try{
     const e={preventDefault(){},stopPropagation(){}};
     h.dialog._onKeyEvent('VIEW_COMMENT',e);
     assert.strictEqual(h.cfg.props.showComment,false);
     assert.strictEqual(h.element('.showCommentSwitch').dataset.shortcutState,'OFF');
     h.dialog._onKeyEvent('TOGGLE_COMMENT',e);
     assert.strictEqual(h.cfg.props.showComment,true);
     assert.strictEqual(h.element('.showCommentSwitch').dataset.shortcutState,'ON');
     h.dialog._onKeyEvent('TOGGLE_NG_FILTER',e);
     assert.strictEqual(h.cfg.props.enableFilter,false);
     assert.strictEqual(h.element('.ngFilterSwitch').dataset.shortcutState,'OFF');
     assert(h.events.includes('command:toggle-showComment'));
     assert(h.events.includes('command:toggle-enableFilter'));
     h.tick(1000);
   }finally{h.close();}
 });
 it('holds each toggle to a single action despite repeating keydown',()=>{
   const h=harness();try{
     let stopped=0;
     const repeated={repeat:true,preventDefault(){stopped++;},stopPropagation(){stopped++;}};
     h.dialog._onKeyEvent('TOGGLE_NG_FILTER',repeated);
     h.dialog._onKeyEvent('TOGGLE_COMMENT',repeated);
     h.dialog._onKeyEvent('VIEW_COMMENT',repeated);
     assert.strictEqual(stopped,6);
     assert.strictEqual(h.cfg.props.enableFilter,true);
     assert.strictEqual(h.cfg.props.showComment,true);
     assert(!h.events.some(e=>e.startsWith('command:')));
     assert.strictEqual(h.pending.size,0);
     h.dialog._onKeyEvent('TOGGLE_NG_FILTER',{repeat:false,preventDefault(){},stopPropagation(){}});
     assert.strictEqual(h.cfg.props.enableFilter,false);
     assert.strictEqual([...h.pending.values()].filter(x=>x.delay===1000).length,1);
   }finally{h.close();}
 });
 it('reschedules an already visible bar on a saved delay change',()=>{
   const h=harness();try{
     h.view._state.screenMode='small';
     h.view._onControlBarActive();
     h.view._scheduleControlBarIdle();
     assert(h.events.includes('small'));
     h.cfg.props['controlBar.hideAfterSeconds.small']=0.8;
     h.view._onControlBarTimingConfigChange();
     assert.deepStrictEqual([...h.pending.values()].map(x=>x.delay),[800]);
     h.view._onControlBarIdle();
     h.events.length=0;
     h.view._onControlBarTimingConfigChange();
     assert.strictEqual(h.pending.size,1,'idle change must not arm another timer');
     const src=read('src/NicoVideoPlayerDialog.js');
     assert(src.includes("config.onkey(key, () => this._onControlBarTimingConfigChange())"));
     h.tick(800);
     assert.strictEqual(h.pending.size,0);
   }finally{h.close();}
 });
 it('makes keyboard feedback visible via the real hover-menu CSS even when idle',()=>{
   const h=harness();
   try{
     const source=read('src/NicoVideoPlayerDialog.js');
     const end=source.indexOf("className: 'videoHoverMenu'");
     const start=source.lastIndexOf('util.addStyle('+String.fromCharCode(96),end);
     const close=source.lastIndexOf(String.fromCharCode(96)+', {',end);
     assert(start>=0 && close>start);
     const css=source.slice(start+'util.addStyle('.length+1,close);
     assert(!css.includes(String.fromCharCode(36)+'{'));
     const style=h.dom.window.document.createElement('style');style.textContent=css;
     h.dom.window.document.head.append(style);
     const icon=h.element('.showCommentSwitch');
     assert.strictEqual(h.dom.window.getComputedStyle(icon).opacity,'0');
     h.view._flashShortcutToggleFeedback('comment',false);
     assert.strictEqual(h.dom.window.getComputedStyle(icon).opacity,'1',
       'shortcut feedback should override idle opacity');
     h.tick(1000);
     assert.strictEqual(h.dom.window.getComputedStyle(icon).opacity,'0',
       'keyboard feedback must disappear after 1s');
   }finally{h.close();}
 });
 it('extends the same feedback lifetime to a right-top Like button',()=>{
   const h=harness();try{
     const icon=h.dom.window.document.createElement('div');
     icon.className='menuButton toggleLikeButton';
     h.element('.zenzaPlayerContainer').append(icon);
     h.view._flashActionFeedback('toggle-like');
     assert(icon.classList.contains('is-shortcut-feedback'));
     assert(!h.element('.showCommentSwitch').classList.contains('is-shortcut-feedback'));
     assert(!h.element('.ngFilterSwitch').classList.contains('is-shortcut-feedback'));
     h.tick(1000);assert(!icon.classList.contains('is-shortcut-feedback'));
   }finally{h.close();}
 });
});
