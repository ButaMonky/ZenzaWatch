// SCUI-04: Pointer-safe transient hover and pin gestures shared by all layouts.
// Pure state coordinator. Browser pointer subscription is injected by the UI.
// The parent SceneSearchController remains the single owner of pinned/shown.
//===BEGIN===
class SceneSearchInteraction {
  constructor({controller,getPreviewRect,subscribePointerMove,clock,idleLimiter}={}) {
    if(!controller || typeof getPreviewRect!=='function' ||
      typeof subscribePointerMove!=='function'){
      throw new TypeError('Interaction requires a controller and geometry hooks');
    }
    this.controller=controller;
    this._idle=idleLimiter||null;
    this._getPreviewRect=getPreviewRect;
    this._subscribe=subscribePointerMove;
    this._clock=clock||{setTimeout:(fn,ms)=>globalThis.setTimeout(fn,ms),
      clearTimeout:id=>globalThis.clearTimeout(id)};
    this._overSeek=false;
    this._overPreview=false;
    this._dragging=false;
    this._anchor=null;
    this._timer=null;
    this._unsubscribe=null;
    this._disposed=false;
  }
  static insideCorridor(anchor,rect,x,y) {
    if(!anchor||!rect || !Number.isFinite(x)||!Number.isFinite(y)||
      !Number.isFinite(rect.left)||!Number.isFinite(rect.right)||
      !Number.isFinite(rect.top)||!Number.isFinite(rect.bottom)){return false;}
    // The initial interaction corridor assumed every preview was ABOVE
    // the seekbar. UI02/05/07/09 intentionally sit BELOW the video.
    // Mirror the tapered corridor vertically instead of requiring the
    // pointer to move upward through an impossible hit-test region.
    if(rect.top>=anchor.y){
      if(y<anchor.y-25||y>rect.bottom+18){return false;}
      const travel=Math.max(1,rect.top-anchor.y);
      const t=Math.max(0,Math.min(1,(y-anchor.y)/travel));
      const left=anchor.x-30+t*(rect.left-18-(anchor.x-30));
      const right=anchor.x+30+t*(rect.right+18-(anchor.x+30));
      return x>=left&&x<=right;
    }
    if(y<rect.top-18||y>anchor.y+25){return false;}
    const rise=Math.max(1,anchor.y-rect.bottom);
    const t=Math.max(0,Math.min(1,(anchor.y-y)/rise));
    const left=anchor.x-30+t*(rect.left-18-(anchor.x-30));
    const right=anchor.x+30+t*(rect.right+18-(anchor.x+30));
    return x>=left&&x<=right;
  }
  _clearTimer() {
    if(this._timer!==null){this._clock.clearTimeout(this._timer);this._timer=null;}
  }
  _stopTracking() {
    this._unsubscribe?.();
    this._unsubscribe=null;
    this._anchor=null;
  }
  _armHide(delay) {
    this._clearTimer();
    if(this._disposed||this.controller.snapshot.pinned||this._overSeek||
      this._overPreview||this._dragging){return;}
    this._timer=this._clock.setTimeout(()=>{
      this._timer=null;
      if(this._disposed||this.controller.snapshot.pinned||this._overSeek||
        this._overPreview||this._dragging){return;}
      this._stopTracking();
      this.controller.show(false);
    },delay);
  }
  seekEnter(point) {
    if(this._disposed){return;}
    this._overSeek=true;
    this._clearTimer();
    this._stopTracking();
    this.controller.show(true);
    this._idle?.seekEnter(point);
  }
  seekMove(point) {
    this._idle?.seekMove(point);
  }
  thumbnailChanged(token) {
    this._idle?.previewChanged(token);
  }
  idlePreferencesChanged() {
    this._idle?.updateSeconds();
  }
  seekLeave(point) {
    if(this._disposed){return;}
    this._overSeek=false;
    this._idle?.seekLeave();
    if(this._overPreview||this._dragging||this.controller.snapshot.pinned){return;}
    const x=Number(point?.clientX),y=Number(point?.clientY);
    if(!Number.isFinite(x)||!Number.isFinite(y)){this._armHide(250);return;}
    this._stopTracking();
    this._anchor={x,y};
    this._unsubscribe=this._subscribe(e=>this.pointerMove(e));
    this._armHide(850);
  }
  pointerMove(e) {
    if(this._disposed||!this._anchor||this._overPreview||
      this.controller.snapshot.pinned){return;}
    let rect;
    try{rect=this._getPreviewRect();}
    catch(_){this._armHide(180);return;}
    const inside=SceneSearchInteraction.insideCorridor(
      this._anchor,rect,e?.clientX,e?.clientY);
    // Activity toward the card renews the deadline. Off-path cursor
    // movements retain a short grace period, not a ghost hit-test overlay.
    this._armHide(inside?850:180);
  }
  previewEnter() {
    if(this._disposed){return;}
    this._overPreview=true;
    this._idle?.pause('preview',true);
    this._clearTimer();
    this._stopTracking();
    this.controller.show(true);
  }
  previewLeave() {
    if(this._disposed){return;}
    this._overPreview=false;
    this._idle?.pause('preview',false);
    this._armHide(450);
  }
  previewFocus(active) {
    if(active){this.previewEnter();}else{this.previewLeave();}
    this._idle?.pause('focus',!!active);
  }
  setDragging(value) {
    if(this._disposed){return;}
    this._dragging=!!value;
    this._idle?.pause('drag',this._dragging);
    if(this._dragging){
      this._clearTimer();
      this._stopTracking();
      this.controller.show(true);
    }else{this._armHide(450);}
  }
  togglePin() {
    if(this._disposed){return null;}
    const snapshot=this.controller.pin();
    this._idle?.pause('pin',snapshot.pinned);
    if(snapshot.pinned){
      this._clearTimer();
      this._stopTracking();
    }else{this._armHide(450);}
    return snapshot;
  }
  reset() {
    if(this._disposed){return;}
    this._idle?.reset();
    this._clearTimer();
    this._stopTracking();
    this._overSeek=false;
    this._overPreview=false;
    this._dragging=false;
    this.controller.pin(false);
    this.controller.show(false);
  }
  dispose() {
    if(this._disposed){return;}
    this.reset();
    this._idle?.dispose();
    this._disposed=true;
  }
}
//===END===
export {SceneSearchInteraction};
