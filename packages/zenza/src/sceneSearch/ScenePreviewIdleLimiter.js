// SCUI-20 / Discussion #6: suppress an unchanged seek preview after idle time.
// Pure coordination with injected clock and geometry, no DOM subscriptions.
//===BEGIN===
class ScenePreviewIdleLimiter {
  constructor({controller,getSeconds,clock,onIdleHidden}={}) {
    if(!controller||typeof getSeconds!=='function'){
      throw new TypeError('ScenePreviewIdleLimiter needs controller/preferences');
    }
    this.controller=controller;
    this._getSeconds=getSeconds;
    this._clock=clock||{setTimeout:(fn,ms)=>globalThis.setTimeout(fn,ms),
      clearTimeout:id=>globalThis.clearTimeout(id)};
    this._onIdleHidden=onIdleHidden||null;
    this._timer=null;
    this._generation=0;
    this._insideSeek=false;
    this._anchor=null;
    this._contentToken=null;
    this._hold=new Set();
    this._idleHidden=false;
    this._disposed=false;
  }
  static validSeconds(value) {
    return typeof value==='number'&&Number.isFinite(value)&&
      value>=0&&value<=30&&Number.isInteger(value*2);
  }
  _seconds() {
    const value=this._getSeconds();
    return ScenePreviewIdleLimiter.validSeconds(value)?value:2;
  }
  get hiddenByIdle() {return this._idleHidden;}
  get timerActive() {return this._timer!==null;}
  _clearTimer() {
    this._generation++;
    if(this._timer!==null){this._clock.clearTimeout(this._timer);this._timer=null;}
  }
  _notifyHidden(hidden) {
    if(this._idleHidden===hidden){return;}
    this._idleHidden=hidden;
    this._onIdleHidden?.(hidden);
  }
  _arm() {
    this._clearTimer();
    const sec=this._seconds();
    if(this._disposed||!this._insideSeek||this._hold.size||!sec){return;}
    const generation=this._generation;
    this._timer=this._clock.setTimeout(()=>{
      if(this._disposed||generation!==this._generation||
        !this._insideSeek||this._hold.size){return;}
      this._timer=null;
      this._notifyHidden(true);
      this.controller.show(false);
    },sec*1000);
  }
  _resumed() {
    if(this._disposed){return;}
    this._notifyHidden(false);
    this.controller.show(true);
    this._arm();
  }
  seekEnter(point) {
    if(this._disposed){return;}
    this._insideSeek=true;
    this._anchor=ScenePreviewIdleLimiter._point(point);
    this._resumed();
  }
  static _point(value) {
    if(!value||!Number.isFinite(value.clientX)||
      !Number.isFinite(value.clientY)){return null;}
    return {x:value.clientX,y:value.clientY};
  }
  seekMove(point) {
    if(this._disposed||!this._insideSeek){return false;}
    const next=ScenePreviewIdleLimiter._point(point);
    if(!next){return false;}
    const prior=this._anchor;
    if(!prior){
      this._anchor=next;
      this._resumed();
      return true;
    }
    const dx=next.x-prior.x,dy=next.y-prior.y;
    if(dx*dx+dy*dy<16){return false;}
    this._anchor=next;
    this._resumed();
    return true;
  }
  previewChanged(token) {
    if(this._disposed||!this._insideSeek||token===this._contentToken){return;}
    this._contentToken=token;
    this._resumed();
  }
  pause(reason,active=true) {
    if(this._disposed||typeof reason!=='string'||!reason){return;}
    if(active){
      this._hold.add(reason);
      this._clearTimer();
      this._notifyHidden(false);
      this.controller.show(true);
    }else{
      this._hold.delete(reason);
      if(!this._hold.size&&this._insideSeek){this._arm();}
    }
  }
  updateSeconds() {
    if(this._disposed){return;}
    this._notifyHidden(false);
    if(this._insideSeek){this.controller.show(true);}
    this._arm();
  }
  seekLeave() {
    if(this._disposed){return;}
    this._clearTimer();
    this._insideSeek=false;
    this._anchor=null;
    this._contentToken=null;
    this._notifyHidden(false);
    // The regular seek-to-card corridor controller handles leaving itself.
  }
  reset() {
    if(this._disposed){return;}
    this.seekLeave();
    this._hold.clear();
  }
  dispose() {
    if(this._disposed){return;}
    this.reset();
    this._disposed=true;
  }
}
//===END===
export {ScenePreviewIdleLimiter};
