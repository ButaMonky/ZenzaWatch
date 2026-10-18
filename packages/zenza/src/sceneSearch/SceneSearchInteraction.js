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
    this._hoverSources=new Set();
    this._focusSources=new Set();
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
    // Travel between separated panels can be horizontal. The corridor is
    // transient pointer tracking, never an element spanning the empty gap.
    if(anchor.y>=rect.top&&anchor.y<=rect.bottom&&
       (anchor.x<rect.left||anchor.x>rect.right)){
      const rightward=anchor.x<rect.left;
      const edge=rightward?rect.left:rect.right;
      const distance=Math.max(1,Math.abs(edge-anchor.x));
      const progress=(rightward?x-anchor.x:anchor.x-x)/distance;
      if(progress<0||x<Math.min(anchor.x,rect.left)-18||
         x>Math.max(anchor.x,rect.right)+18)return false;
      const t=Math.min(1,progress);
      return y>=anchor.y-25+t*(rect.top-18-(anchor.y-25))&&
        y<=anchor.y+25+t*(rect.bottom+18-(anchor.y+25));
    }
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
  get holdingPreview(){return this._overPreview||this._dragging;}
  clearCorridor(){this._clearTimer();this._stopTracking();}
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
    const regions=Array.isArray(rect)?rect:[rect];
    const inside=regions.some(region=>SceneSearchInteraction.insideCorridor(
      this._anchor,region,e?.clientX,e?.clientY));
    // Activity toward the card renews the deadline. Off-path cursor
    // movements retain a short grace period, not a ghost hit-test overlay.
    this._armHide(inside?850:180);
  }
  _syncPreviewHold() {
    this._overPreview=this._hoverSources.size>0||this._focusSources.size>0;
    this._idle?.pause('preview',this._hoverSources.size>0);
    this._idle?.pause('focus',this._focusSources.size>0);
    if(this._overPreview){
      this._clearTimer();
      this._stopTracking();
      this.controller.show(true);
    }else{this._armHide(450);}
  }
  previewEnter(source='preview') {
    if(this._disposed){return;}
    this._hoverSources.add(source);
    this._syncPreviewHold();
  }
  previewLeave(source='preview',point) {
    if(this._disposed){return;}
    this._hoverSources.delete(source);
    this._syncPreviewHold();
    if(!this._overPreview&&!this._overSeek&&!this._dragging&&
       !this.controller.snapshot.pinned&&Number.isFinite(point?.clientX)&&
       Number.isFinite(point?.clientY)){
      this._stopTracking();
      this._anchor={x:point.clientX,y:point.clientY};
      this._unsubscribe=this._subscribe(e=>this.pointerMove(e));
      this._armHide(850);
    }
  }
  previewFocus(active,source='preview') {
    if(this._disposed){return;}
    if(active){this._focusSources.add(source);}
    else{this._focusSources.delete(source);}
    this._syncPreviewHold();
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
    this._hoverSources.clear();
    this._focusSources.clear();
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
