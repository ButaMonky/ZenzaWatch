'use strict';
const assert=require('assert');
const {loadClass,createContext}=require('../helpers/extractSource');

function harness() {
  const listeners=new Map(),timers=new Map(),writes=[];
  let now=0,sequence=0,watcher=null,subscriptions=0,unsubscriptions=0;
  const snapshot={pinned:false,shown:false};
  const controller={
    snapshot,
    pin(value){
      snapshot.pinned=value===undefined?!snapshot.pinned:!!value;
      if(snapshot.pinned)snapshot.shown=true;
      writes.push(['pin',snapshot.pinned]);
      return {...snapshot};
    },
    show(value){
      snapshot.shown=value!==false;
      if(!snapshot.shown)snapshot.pinned=false;
      writes.push(['show',snapshot.shown]);
      return {...snapshot};
    }
  };
  const clock={
    setTimeout(fn,delay){
      const id=++sequence;timers.set(id,{fn,at:now+delay});return id;
    },
    clearTimeout(id){timers.delete(id);}
  };
  const Class=loadClass(
    'packages/zenza/src/sceneSearch/SceneSearchInteraction.js',
    'SceneSearchInteraction',createContext());
  const obj=new Class({controller,clock,
    getPreviewRect:()=>({left:760,right:940,top:425,bottom:600}),
    subscribePointerMove:fn=>{
      watcher=fn;subscriptions++;
      return ()=>{unsubscriptions++;watcher=null;};
    }
  });
  const tick=delta=>{
    now+=delta;
    for(const [id,t] of [...timers]){
      if(t.at<=now){timers.delete(id);t.fn();}
    }
  };
  return {obj,controller,snapshot,timers,writes,tick,listeners,
    get subscriptions(){return subscriptions;},
    get unsubscriptions(){return unsubscriptions;},
    move:(clientX,clientY)=>watcher?.({clientX,clientY}),
    get watching(){return !!watcher;}
  };
}

describe('SCUI-04 pointer corridor, pin and lifecycle',()=>{
  it('holds a preview through a two-second slow upward movement',()=>{
    const h=harness();h.obj.seekEnter();
    h.obj.seekLeave({clientX:850,clientY:910});
    assert(h.watching);
    for(const y of [880,830,770,710,645]){
      h.tick(400);h.move(850,y);
      assert.strictEqual(h.snapshot.shown,true);
    }
    h.obj.previewEnter();h.tick(2500);
    assert.strictEqual(h.snapshot.shown,true,'hovering buttons retains preview');
    assert.strictEqual(h.watching,false,'remove document mouse listener in card');
    h.obj.previewLeave();h.tick(451);
    assert.strictEqual(h.snapshot.shown,false);
  });
  it('closes on a movement outside the corridor with a short grace period',()=>{
    const h=harness();h.obj.seekEnter();
    h.obj.seekLeave({clientX:850,clientY:910});
    h.move(200,750);h.tick(181);
    assert.strictEqual(h.snapshot.shown,false);
    assert.strictEqual(h.watching,false);
    assert.strictEqual(h.subscriptions,h.unsubscriptions);
  });
  it('pin survives leaving the seek/preview area until manually removed',()=>{
    const h=harness();h.obj.seekEnter();
    h.obj.seekLeave({clientX:850,clientY:910});
    h.obj.previewEnter();
    const pinned=h.obj.togglePin();
    assert.strictEqual(pinned.pinned,true);
    h.obj.previewLeave();h.tick(5000);
    assert.strictEqual(h.snapshot.shown,true);
    assert.strictEqual(h.snapshot.pinned,true);
    h.obj.togglePin();h.tick(451);
    assert.strictEqual(h.snapshot.shown,false);
    assert.strictEqual(h.snapshot.pinned,false);
  });
  it('keyboard focus retains buttons with no invisible hitbox overlay',()=>{
    const h=harness();h.obj.seekEnter();
    h.obj.seekLeave({clientX:850,clientY:910});
    h.obj.previewFocus(true);
    h.tick(1100);assert.strictEqual(h.snapshot.shown,true);
    assert.strictEqual(h.watching,false);
    h.obj.previewFocus(false);h.tick(451);
    assert.strictEqual(h.snapshot.shown,false);
  });
  it('dragging keeps the preview; release restores idle timer',()=>{
    const h=harness();h.obj.seekEnter();h.obj.setDragging(true);
    h.obj.seekLeave({clientX:850,clientY:910});
    h.tick(3000);assert.strictEqual(h.snapshot.shown,true);
    h.obj.setDragging(false);h.tick(451);
    assert.strictEqual(h.snapshot.shown,false);
  });
  it('resets timers/listeners and pin when switching video or layout',()=>{
    const h=harness();h.obj.seekEnter();
    h.obj.seekLeave({clientX:850,clientY:910});
    assert(h.watching);
    h.obj.togglePin();h.obj.reset();
    assert.strictEqual(h.snapshot.pinned,false);
    assert.strictEqual(h.snapshot.shown,false);
    assert.strictEqual(h.watching,false);
    assert.strictEqual(h.timers.size,0);
    assert.strictEqual(h.subscriptions,h.unsubscriptions);
    h.tick(10000);assert.strictEqual(h.snapshot.shown,false);
    h.obj.dispose();h.obj.dispose();
    h.obj.seekEnter();assert.strictEqual(h.snapshot.shown,false);
  });
  it('rejects invalid geometry rather than leaving a permanent preview',()=>{
    const h=harness();
    const Class=h.obj.constructor;
    assert.strictEqual(Class.insideCorridor(
      {x:850,y:910},null,850,830),false);
    assert.strictEqual(Class.insideCorridor(
      {x:850,y:910},{left:760,right:940,top:425,bottom:600},NaN,830),false);
    assert.strictEqual(Class.insideCorridor(
      {x:850,y:910},{left:760,right:940,top:425,bottom:600},850,800),true);
  });
});
