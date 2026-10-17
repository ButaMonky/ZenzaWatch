'use strict';
const assert=require('assert');
const {fixture}=require('../helpers/scenePlayerFixture');
function nativeWithFakeTime(seconds=2){
  const h=fixture('00');
  const bridge=h.binding.adapter.bridge;
  const timers=new Map();
  let now=0,id=0;
  const clock={
    setTimeout(fn,ms){const key=++id;timers.set(key,{fn,at:now+ms});return key;},
    clearTimeout(key){timers.delete(key);}
  };
  // The layout was just mounted but no mouse has entered yet.
  bridge.idleLimiter._clock=clock;
  bridge.interaction._clock=clock;
  h.config.setValue('sceneSearch.idleHideSeconds',seconds);
  const tick=ms=>{
    now+=ms;
    for(const [key,timer] of [...timers]){
      if(timer.at<=now){timers.delete(key);timer.fn();}
    }
  };
  const move=(x,y=510)=>{
    h.seek.dispatchEvent(new h.dom.window.MouseEvent('mousemove',
      {bubbles:true,clientX:x,clientY:y}));
  };
  const tooltip=h.d.getElementById('old');
  const comment=h.d.querySelector('.zenzaCommentPreview');
  return {...h,bridge,timers,tick,tooltip,comment,move,
    enter(x=500,y=510){
      h.seek.dispatchEvent(new h.dom.window.MouseEvent('mouseenter',
        {bubbles:true,clientX:x,clientY:y}));
      move(x,y);
    }};
}
describe('Task639 native UI00 auto-hide parity',()=>{
  it('hides both ORIGINAL image and independent comment preview after 2 seconds, restores on 4px movement',()=>{
    const h=nativeWithFakeTime(2);
    try{
      const nativeComment=h.comment;
      assert(h.host.classList.contains('is-scui00-inactive'),
        'before hover the old preview must be suppressed');
      h.enter();
      assert(h.bridge.state.shown);
      assert(!h.host.classList.contains('is-scui00-inactive'));
      h.tick(1999);
      assert(!h.host.classList.contains('is-scui00-inactive'));
      h.tick(1);
      assert.equal(h.bridge.state.shown,false,'same core ScenePreviewIdleLimiter deadline');
      assert(h.host.classList.contains('is-scui00-inactive'),
        'native UI00 must respond to shared shown=false');
      assert(h.tooltip.classList.contains('is-idle-suppressed'),
        'idle callback still targets the native tooltip');
      const css=h.d.querySelector('style[data-scui00-style]').textContent;
      assert(/\.is-scui00-inactive[\s\S]*?seekBarToolTip/.test(css));
      assert(/\.is-scui00-inactive[\s\S]*?zenzaCommentPreview/.test(css));
      assert.strictEqual(h.comment,nativeComment,'never clone/reparent native list');
      h.move(503);
      assert(h.host.classList.contains('is-scui00-inactive'));
      h.move(504);
      assert(h.bridge.state.shown);
      assert(!h.host.classList.contains('is-scui00-inactive'));
      assert(!h.tooltip.classList.contains('is-idle-suppressed'));
    }finally{h.close();}
  });
  it('0 disables auto-hide and runtime 0.5 setting follows 500ms deadline',()=>{
    const h=nativeWithFakeTime(0);
    try{
      h.enter();
      assert.equal(h.bridge.idleLimiter.timerActive,false);
      h.tick(10000);
      assert(!h.host.classList.contains('is-scui00-inactive'));
      h.config.setValue('sceneSearch.idleHideSeconds',0.5);
      assert.equal(h.bridge.idleLimiter.timerActive,true);
      h.tick(499);
      assert(!h.host.classList.contains('is-scui00-inactive'));
      h.tick(1);
      assert(h.host.classList.contains('is-scui00-inactive'));
      h.config.setValue('sceneSearch.idleHideSeconds',0);
      assert(!h.host.classList.contains('is-scui00-inactive'));
    }finally{h.close();}
  });
  it('native tooltip buttons and scrollable list suspend timeout while hovered',()=>{
    const h=nativeWithFakeTime(2);
    try{
      h.enter();
      h.tooltip.dispatchEvent(new h.dom.window.MouseEvent('mouseenter'));
      assert.equal(h.bridge.idleLimiter.timerActive,false,'native tooltip must pause idle');
      h.tick(7000);
      assert(!h.host.classList.contains('is-scui00-inactive'));
      h.tooltip.dispatchEvent(new h.dom.window.MouseEvent('mouseleave'));
      assert.equal(h.bridge.idleLimiter.timerActive,true);
      h.tick(2000);
      assert(h.host.classList.contains('is-scui00-inactive'));
      h.enter(600);
      h.config.setValue('enableCommentPreview',true);
      h.comment.dispatchEvent(new h.dom.window.MouseEvent('mouseenter'));
      assert.equal(h.bridge.idleLimiter.timerActive,false,'list scroll pauses the timer');
      h.tick(5000);
      assert(!h.host.classList.contains('is-scui00-inactive'));
      h.comment.dispatchEvent(new h.dom.window.MouseEvent('mouseleave'));
      h.tick(2000);
      assert(h.host.classList.contains('is-scui00-inactive'));
    }finally{h.close();}
  });
  it('keyboard focus and pin/drag suspend UI00 idle until the interaction ends',()=>{
    const h=nativeWithFakeTime(2);
    try{
      h.enter();
      const button=h.tooltip.querySelector('.toggleCommentPreview');
      button.dispatchEvent(new h.dom.window.FocusEvent('focusin',{bubbles:true}));
      assert.equal(h.bridge.idleLimiter.timerActive,false);
      h.tick(5000);
      assert(!h.host.classList.contains('is-scui00-inactive'));
      button.dispatchEvent(new h.dom.window.FocusEvent('focusout',{bubbles:true}));
      assert.equal(h.bridge.idleLimiter.timerActive,true);
      h.bridge.interaction.togglePin();
      assert(h.bridge.state.pinned);
      h.tick(5000);
      assert(!h.host.classList.contains('is-scui00-inactive'));
      h.bridge.interaction.togglePin();
      assert(!h.bridge.state.pinned);
      h.bridge.interaction.setDragging(true);
      h.tick(5000);
      assert(!h.host.classList.contains('is-scui00-inactive'));
      h.bridge.interaction.setDragging(false);
      h.tick(2000);
      assert(h.host.classList.contains('is-scui00-inactive'));
    }finally{h.close();}
  });
  it('cleans up native tooltip idle classes when saved layout changes',()=>{
    const h=nativeWithFakeTime(0.5);
    try{
      h.enter();
      h.tick(500);
      assert(h.tooltip.classList.contains('is-idle-suppressed'));
      h.config.setValue('sceneSearch.layout.normal','01');
      assert(!h.tooltip.classList.contains('is-idle-suppressed'),
        'leftover suppression must never contaminate original VideoControlBar');
      assert(!h.host.classList.contains('is-scui00-inactive'));
      h.config.setValue('sceneSearch.layout.normal','00');
      assert(h.host.classList.contains('is-scui00-active'));
      h.enter(504);
      assert(!h.host.classList.contains('is-scui00-inactive'));
    }finally{h.close();}
  });
  it('removes layout-only inactivity classes and native hover listeners on mode change/close',()=>{
    const h=nativeWithFakeTime(0.5);
    try{
      h.enter();h.tick(500);
      assert(h.host.classList.contains('is-scui00-inactive'));
      h.setMode('fullscreen');
      assert(h.host.classList.contains('is-scui00-inactive'));
      h.config.setValue('sceneSearch.layout.fullscreen','01');
      assert(!h.host.classList.contains('is-scui00-active'));
      assert(!h.host.classList.contains('is-scui00-inactive'));
      const holds=h.bridge.idleLimiter._hold.size;
      h.tooltip.dispatchEvent(new h.dom.window.MouseEvent('mouseenter'));
      assert.equal(h.bridge.idleLimiter._hold.size,holds,
        'UI00 controls must not keep a listener after disposal');
      h.config.setValue('sceneSearch.layout.fullscreen','00');
      assert(h.host.classList.contains('is-scui00-active'));
      h.player.emit('close');
      assert(!h.host.classList.contains('is-scui00-inactive'));
    }finally{h.close();}
  });
});
