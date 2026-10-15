'use strict';
const assert=require('assert');
const {loadClass,createContext}=require('../helpers/extractSource');

function harness(delay=2) {
  const timers=new Map(), events=[], visibility=[];
  let now=0,next=0, duration=delay;
  const controller={shown:false,snapshot:{pinned:false},show(v){
    this.shown=v!==false;events.push(this.shown);
  },pin(v){
    this.snapshot.pinned=v===undefined?!this.snapshot.pinned:!!v;
    if(this.snapshot.pinned)this.shown=true;
    return {pinned:this.snapshot.pinned,shown:this.shown};
  }};
  const clock={
    setTimeout(fn,ms){const id=++next;timers.set(id,{fn,at:now+ms});return id;},
    clearTimeout(id){timers.delete(id);}
  };
  const Class=loadClass(
    'packages/zenza/src/sceneSearch/ScenePreviewIdleLimiter.js',
    'ScenePreviewIdleLimiter',createContext());
  const obj=new Class({controller,clock,getSeconds:()=>duration,
    onIdleHidden:hidden=>visibility.push(hidden)});
  const tick=ms=>{
    now+=ms;
    for(const [id,t] of [...timers]){if(t.at<=now){timers.delete(id);t.fn();}}
  };
  const pos=(x,y=900)=>({clientX:x,clientY:y});
  return {obj,controller,timers,events,visibility,tick,pos,
    setDelay:value=>{duration=value;obj.updateSeconds();}};
}

describe('SCUI-20 Discussion #6: stationary seek-preview auto hide',()=>{
  it('hides after two seconds despite the pointer still hovering seekbar',()=>{
    const h=harness();
    h.obj.seekEnter(h.pos(500));
    h.tick(1999);assert.strictEqual(h.controller.shown,true);
    h.tick(1);assert.strictEqual(h.controller.shown,false);
    assert.strictEqual(h.obj.hiddenByIdle,true);
    assert.deepStrictEqual(h.visibility,[true],
      'UI layer will apply a hover-suppression class, not rely on mouseleave');
  });
  it('a real >=4px cursor move resurfaces preview and rearms once',()=>{
    const h=harness();h.obj.seekEnter(h.pos(500));h.tick(2000);
    assert.strictEqual(h.obj.seekMove(h.pos(503)),false);
    assert.strictEqual(h.controller.shown,false);
    assert.strictEqual(h.obj.seekMove(h.pos(504)),true);
    assert.strictEqual(h.controller.shown,true);
    assert.strictEqual(h.obj.hiddenByIdle,false);
    assert.strictEqual(h.timers.size,1);
    h.tick(2000);assert.strictEqual(h.controller.shown,false);
    assert.deepStrictEqual(h.visibility,[true,false,true]);
  });
  it('small jitter does not keep extending the same static thumbnail',()=>{
    const h=harness();h.obj.seekEnter(h.pos(500));
    h.tick(500);h.obj.seekMove(h.pos(501));
    h.tick(500);h.obj.seekMove(h.pos(502));
    h.tick(500);h.obj.seekMove(h.pos(503));
    h.tick(500);assert.strictEqual(h.controller.shown,false);
  });
  it('new thumbnail restarts clock, same thumbnail does not',()=>{
    const h=harness();h.obj.seekEnter(h.pos(500));
    h.obj.previewChanged('frame-1');
    h.tick(1000);h.obj.previewChanged('frame-1');
    h.tick(900);assert.strictEqual(h.controller.shown,true);
    h.obj.previewChanged('frame-2');
    h.tick(1300);assert.strictEqual(h.controller.shown,true);
    h.tick(700);assert.strictEqual(h.controller.shown,false);
  });
  it('0 disables idle hiding and a 0.5 setting hides in 500ms',()=>{
    const h=harness(0);h.obj.seekEnter(h.pos(500));
    assert.strictEqual(h.obj.timerActive,false);
    h.tick(20000);assert.strictEqual(h.controller.shown,true);
    h.setDelay(0.5);assert.strictEqual(h.obj.timerActive,true);
    h.tick(499);assert.strictEqual(h.controller.shown,true);
    h.tick(1);assert.strictEqual(h.controller.shown,false);
    h.setDelay(0);assert.strictEqual(h.controller.shown,true);
    assert.strictEqual(h.obj.timerActive,false);
  });
  it('pin, drag, focus, button interaction suspend timeout until released',()=>{
    for(const reason of ['pin','drag','focus','preview','button','touch','transfer']){
      const h=harness();h.obj.seekEnter(h.pos(500));
      h.obj.pause(reason,true);
      assert.strictEqual(h.obj.timerActive,false,reason);
      h.tick(5000);assert.strictEqual(h.controller.shown,true,reason);
      h.obj.pause(reason,false);
      h.tick(2000);assert.strictEqual(h.controller.shown,false,reason);
    }
  });
  it('reset, seekLeave, and dispose release timers and old generations',()=>{
    const h=harness();h.obj.seekEnter(h.pos(500));
    assert.strictEqual(h.timers.size,1);
    h.obj.seekLeave();assert.strictEqual(h.timers.size,0);
    h.obj.seekEnter(h.pos(500));h.tick(1000);h.obj.reset();
    assert.strictEqual(h.timers.size,0);
    h.tick(4000);assert.strictEqual(h.controller.shown,true);
    h.obj.seekEnter(h.pos(500));h.obj.dispose();h.obj.dispose();
    assert.strictEqual(h.timers.size,0);
    h.obj.seekMove(h.pos(600));h.tick(4000);
    assert.strictEqual(h.controller.shown,true);
  });
  it('rejects malformed durations and uses fallback for corrupted values',()=>{
    const h=harness();const K=h.obj.constructor;
    for(const n of [0,0.5,2,29.5,30])assert.strictEqual(K.validSeconds(n),true);
    for(const n of [-1,30.5,1.2,NaN,Infinity,'2',null,{}]){
      assert.strictEqual(K.validSeconds(n),false);
    }
    h.obj.seekEnter(h.pos(500));
    h.obj.seekEnter(h.pos(500));
    h.setDelay('oops');h.tick(1999);assert.strictEqual(h.controller.shown,true);
    h.tick(1);assert.strictEqual(h.controller.shown,false);
  });
  it('interaction bridge forwards seek, pin, drag and focus signals',()=>{
    const {controller}=harness();
    const spies=[],classes=loadClass(
      'packages/zenza/src/sceneSearch/SceneSearchInteraction.js',
      'SceneSearchInteraction',createContext());
    const fake={
      seekEnter:point=>spies.push(['enter',point?.clientX]),
      seekMove:point=>spies.push(['move',point?.clientX]),
      seekLeave:()=>spies.push(['leave']),
      pause:(name,state)=>spies.push(['pause',name,state]),
      previewChanged:token=>spies.push(['thumbnail',token]),
      updateSeconds:()=>spies.push(['settings']),
      reset:()=>spies.push(['reset']),
      dispose:()=>spies.push(['dispose'])
    };
    const obj=new classes({controller,getPreviewRect:()=>({left:1,right:2,top:1,bottom:2}),
      subscribePointerMove:()=>()=>{},idleLimiter:fake});
    obj.seekEnter({clientX:123});obj.seekMove({clientX:140});
    obj.thumbnailChanged('thumbnail-a');obj.idlePreferencesChanged();
    obj.setDragging(true);obj.previewFocus(true);obj.previewFocus(false);
    obj.togglePin();obj.seekLeave({clientX:140,clientY:500});obj.dispose();
    assert(spies.some(x=>x[0]==='enter'&&x[1]===123));
    assert(spies.some(x=>x[0]==='move'&&x[1]===140));
    assert(spies.some(x=>x[0]==='thumbnail'&&x[1]==='thumbnail-a'));
    assert(spies.some(x=>x[0]==='pause'&&x[1]==='pin'&&x[2]===true));
    assert(spies.some(x=>x[0]==='pause'&&x[1]==='drag'&&x[2]===true));
    assert(spies.some(x=>x[0]==='pause'&&x[1]==='focus'&&x[2]===true));
    assert(spies.some(x=>x[0]==='reset'));
    assert(spies.some(x=>x[0]==='dispose'));
  });
});
