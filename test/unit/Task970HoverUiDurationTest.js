'use strict';
const assert=require('assert');
const {JSDOM}=require('jsdom');
const {createContext,loadClass,read}=require('../helpers/extractSource');
function harness(){
 const dom=new JSDOM('<body><div id="dialog" class="is-open"><div id="player" class="zenzaPlayerContainer"><div class="hoverMenuContainer"><div class="menuItemContainer leftBottom"><div class="scalingUI"><div class="showCommentSwitch menuButton"><span class="tooltip">Comment</span></div></div></div></div></div></div></body>');
 const host=dom.window.document.getElementById('player'),jobs=new Map();
 let now=0,seq=0;
 const ctx=createContext({Emitter:class{},Fullscreen:{now:()=>false},
  ClassList:el=>el.classList,
  document:dom.window.document,
  util:{StyleSwitcher:{update(){}}},
  setTimeout(fn,delay){const id=++seq;jobs.set(id,{fn,at:now+delay});return id;},
  clearTimeout(id){jobs.delete(id);}});
 const View=loadClass('src/NicoVideoPlayerDialog.js','NicoVideoPlayerDialogView',ctx);
 const view=Object.create(View.prototype);
 view._$playerContainer=[host];view._$dialog=[dom.window.document.getElementById('dialog')];
 view._$body={raf:{addClass(){},removeClass(){}}};
 view._state={screenMode:'normal'};view._playerConfig={props:{}};
 view.addClass=x=>host.classList.add(x);view.removeClass=x=>host.classList.remove(x);
 view._clearClass=()=>{};view._updateScreenModeStyle=()=>{};view._setThumbnail=()=>{};
 const cssSource=read('src/NicoVideoPlayerDialog.js');
 const end=cssSource.indexOf("className: 'videoHoverMenu'");
 const start=cssSource.lastIndexOf('util.addStyle('+String.fromCharCode(96),end);
 const close=cssSource.lastIndexOf(String.fromCharCode(96)+', {',end);
 assert(start>=0&&close>start,'real hover-menu stylesheet');
 const style=dom.window.document.createElement('style');
 style.textContent=cssSource.slice(start+'util.addStyle('.length+1,close);
 dom.window.document.head.append(style);
 const tick=ms=>{const target=now+ms;while(true){
  const ready=[...jobs].filter(([,v])=>v.at<=target).sort((a,b)=>a[1].at-b[1].at);
  if(!ready.length)break;const [id,item]=ready[0];now=item.at;jobs.delete(id);item.fn();
 }now=target;};
 return {view,host,jobs,tick,dom,visible:()=>host.classList.contains('is-hoverUiActive'),
  opacity:()=>dom.window.getComputedStyle(host.querySelector('.showCommentSwitch')).opacity,
  close(){jobs.clear();dom.window.close();}};
}
describe('Task970 independent one-second hover UI',function(){
 this.timeout(15000);
 it('keeps hover UI past mouse idle at 400ms, expires exactly at 1000ms',()=>{
  const h=harness();try{
   h.view._onMouseMove();assert(h.visible(),'pointer movement must reveal hover UI');
   h.tick(400);h.view._onMouseMoveEnd();
   assert(!h.host.classList.contains('is-mouseMoving'));
   assert(h.visible(),'cursor state must not prematurely hide UI');
   h.tick(599);assert(h.visible());h.tick(1);assert(!h.visible());
   assert.strictEqual(h.jobs.size,0);
  }finally{h.close();}
 });
 it('restarts one timer even when movement is already marked active',()=>{
  const h=harness();try{
   h.view._onMouseMove();h.tick(700);h.view._onMouseMove();
   assert.strictEqual(h.jobs.size,1,'no accumulating timeout jobs');
   h.tick(300);assert(h.visible(),'old deadline must not hide latest movement');
   h.tick(699);assert(h.visible());h.tick(1);assert(!h.visible());
  }finally{h.close();}
 });
 it('does not trigger or change the separately configured control-bar timer',()=>{
  const h=harness();try{
   let calls=0;h.view._scheduleControlBarIdle=()=>{calls++;};
   h.view._playerConfig.props['controlBar.hideAfterSeconds.fullscreen']=0.4;
   h.view._onMouseMove();assert(h.visible());
   assert.strictEqual(calls,0);assert.strictEqual(h.view._isControlBarActive,undefined);
   h.tick(1000);assert.strictEqual(calls,0);
  }finally{h.close();}
 });
 it('close removes state, cancels timer and blocks a delayed pointer callback until show',()=>{
  const h=harness();try{
   h.view._onMouseMove();assert(h.visible());h.view.hide();
   assert(!h.visible());assert.strictEqual(h.jobs.size,0);
   h.view._onMouseMove();assert(!h.visible(),'hidden player must not regain hover UI');
   assert.strictEqual(h.jobs.size,0);h.view.show();h.view._onMouseMove();assert(h.visible());
  }finally{h.close();}
 });
 it('video switch clears the prior hover display without disabling future movements',()=>{
  const h=harness();try{
   h.view._onMouseMove();assert(h.visible());h.view._onBeforeVideoOpen();
   assert(!h.visible());assert.strictEqual(h.jobs.size,0);
   h.view._onMouseMove();assert(h.visible());
  }finally{h.close();}
 });
 it('the real overlay CSS stays visible after the 400ms class is removed',()=>{
  const h=harness();try{
   assert.strictEqual(h.opacity(),'0');h.view._onMouseMove();
   h.tick(400);h.view._onMouseMoveEnd();
   assert.strictEqual(h.opacity(),'0.8','overlay must use the longer UI activity state');
   h.tick(600);assert.strictEqual(h.opacity(),'0');
  }finally{h.close();}
 });
 it('one-second shortcut feedback is independent of the hover UI expiry',()=>{
  const h=harness();try{
   h.view._onMouseMove();assert(h.visible());h.tick(500);
   h.view._flashShortcutToggleFeedback('comment',false);h.tick(500);
   assert(!h.visible());assert.strictEqual(h.opacity(),'1');
   h.tick(500);assert.strictEqual(h.opacity(),'0');
  }finally{h.close();}
 });
 it('player instances do not cancel or extend each others idle period',()=>{
  const a=harness(),b=harness();try{
   a.view._onMouseMove();b.view._onMouseMove();a.tick(1000);
   assert(!a.visible());assert(b.visible());b.tick(1000);assert(!b.visible());
  }finally{a.close();b.close();}
 });
});
