// SCUI-03: Shared, framework-independent scene-search state owner.
// This module deliberately does not touch the NicoNico DOM or fetch URLs.
// UI adapters are created only for the selected layout and are disposable.
//===BEGIN===
class SceneSearchController {
  constructor({getPreference,resolvePreferences,createLayout,loadPreview,onSeek,onError}={}) {
    if(typeof getPreference!=='function'||typeof createLayout!=='function'){
      throw new TypeError('SceneSearchController requires preferences and a layout factory');
    }
    this._getPreference=getPreference;
    this._resolvePreferences=resolvePreferences||null;
    this._createLayout=createLayout;
    this._loadPreview=loadPreview||null;
    this._onSeek=typeof onSeek==='function'?onSeek:null;
    this._onError=typeof onError==='function'?onError:null;
    this._mode='normal';
    this._videoId=null;
    this._time=0;
    this._pinned=false;
    this._shown=false;
    this._started=false;
    this._disposed=false;
    this._layout=null;
    this._layoutId=null;
    this._epoch=0;
    this._abort=null;
  }
  _pref(key,fallback) {
    const value=this._getPreference(key);
    return value===undefined?fallback:value;
  }
  _layoutFor(mode) {
    const settings=this._resolvePreferences?.();
    if(settings)return mode==='fullscreen'&&!settings.linked?settings.fullscreen:settings.normal;
    const linked=this._pref('sceneSearch.layout.linkFullscreen',false)===true;
    const key=mode==='fullscreen'&&!linked?
      'sceneSearch.layout.fullscreen':'sceneSearch.layout.normal';
    const id=this._pref(key,'01');
    return typeof id==='string'&&/^(00|0[1-9]|10)$/.test(id)?id:'01';
  }
  _stepSeconds() {
    const v=this._pref('sceneSearch.seekStepSeconds',5);
    return Number.isSafeInteger(v)&&v>=0&&v<=600?v:5;
  }
  _previewEnabled() {
    return this._pref('sceneSearch.commentPreviewVisible',true)!==false;
  }
  get snapshot() {
    const enabled=this._pref('sceneSearch.enabled',true)!==false;
    return Object.freeze({mode:this._mode,layoutId:this._layoutId,
      videoId:this._videoId,time:this._time,pinned:this._pinned&&enabled,
      shown:this._shown&&enabled,seekStepSeconds:this._stepSeconds(),
      commentPreviewVisible:this._previewEnabled(),
      commentListMode:this._resolvePreferences?.()?.listOpen??(this._pref('enableCommentPreview',false)===true)});
  }
  _ensureReady() {
    if(this._disposed){throw new Error('SceneSearchController has been disposed');}
  }
  start(mode='normal') {
    this._ensureReady();
    if(this._started){return this.setMode(mode);}
    this._mode=mode==='fullscreen'?'fullscreen':'normal';
    this._started=true;
    this._activateLayout();
    return this.snapshot;
  }
  _cancelPreview() {
    this._epoch++;
    this._abort?.abort();
    this._abort=null;
  }
  _activateLayout() {
    this._cancelPreview();
    this._layout?.dispose?.();
    this._layout=null;
    const desired=this._layoutFor(this._mode);
    const create=id=>{
      const candidate=this._createLayout({id,mode:this._mode});
      if(!candidate||typeof candidate.dispose!=='function'){
        throw new TypeError('Layout '+id+' must supply dispose()');
      }
      try{candidate.mount?.(this.snapshot);}catch(error){
        candidate.dispose();throw error;
      }
      return candidate;
    };
    try{
      this._layoutId=desired;
      this._layout=create(desired);
    }catch(error){
      this._onError?.(error,desired);
      const fallback=this._resolvePreferences?'follow':'01';
      if(desired===fallback){this._layoutId=null;throw error;}
      this._layoutId=fallback;
      this._layout=create(fallback);
    }
    this._render();
  }
  _render() {
    if(!this._started||this._disposed){return;}
    this._layout?.render?.(this.snapshot);
  }
  setMode(mode) {
    this._ensureReady();
    if(mode!=='normal'&&mode!=='fullscreen'){throw new RangeError('Unknown display mode');}
    if(!this._started){return this.start(mode);}
    if(this._mode===mode){return this.snapshot;}
    this._mode=mode;
    this._pinned=false;
    this._activateLayout();
    return this.snapshot;
  }
  onPreferencesChanged(key) {
    this._ensureReady();
    if(!this._started){return this.snapshot;}
    if(key?.startsWith('sceneSearch.layout.')||key?.startsWith('sceneSearch.presentation.')) {
      if(this._layoutFor(this._mode)!==this._layoutId){
        this._activateLayout();
        return this.snapshot;
      }
    }
    this._render();
    return this.snapshot;
  }
  onVideoChange(videoId) {
    this._ensureReady();
    if(this._videoId===videoId){return this.snapshot;}
    this._cancelPreview();
    this._videoId=videoId||null;
    this._time=0;
    this._pinned=false;
    this._shown=false;
    this._render();
    return this.snapshot;
  }
  setTime(seconds) {
    this._ensureReady();
    if(this._pinned||!Number.isFinite(seconds)||seconds<0||this._time===seconds){
      return this.snapshot;
    }
    this._time=seconds;
    // A pointer-time update is not a settings change. Layouts may keep their
    // geometry/time label current without rebuilding visibility or controls.
    if(this._started&&typeof this._layout?.renderTime==='function'){
      this._layout.renderTime(this.snapshot);
    }else{this._render();}
    return this.snapshot;
  }
  show(value=true) {
    this._ensureReady();
    const next=value!==false;
    if(this._shown===next&&(next||!this._pinned)){return this.snapshot;}
    this._shown=next;
    if(!this._shown){this._pinned=false;}
    this._render();
    return this.snapshot;
  }
  pin(value) {
    this._ensureReady();
    const next=value===undefined?!this._pinned:!!value;
    if(this._pinned===next&&(!next||this._shown)){return this.snapshot;}
    this._pinned=next;
    if(this._pinned){this._shown=true;}
    this._render();
    return this.snapshot;
  }
  seekBy(direction) {
    this._ensureReady();
    if(!this._started||!this._onSeek){return false;}
    const step=this._stepSeconds();
    const sign=Math.sign(Number(direction));
    if(!step||!Number.isFinite(sign)||!sign){return false;}
    this._onSeek(sign*step);
    return true;
  }
  async previewAt(seconds) {
    this._ensureReady();
    if(!this._started||!this._videoId||!this._loadPreview||
      !Number.isFinite(seconds)||seconds<0){return false;}
    this._cancelPreview();
    const epoch=this._epoch;
    const videoId=this._videoId;
    const time=seconds;
    if(typeof AbortController==='function'){this._abort=new AbortController();}
    const signal=this._abort?.signal;
    let asset;
    try {
      asset=await this._loadPreview({videoId,time,signal});
    }catch(error){
      if(this._disposed||epoch!==this._epoch){return false;}
      this._onError?.(error,{videoId,time});
      return false;
    }
    if(this._disposed||epoch!==this._epoch||videoId!==this._videoId){
      return false;
    }
    this._layout?.onPreview?.(asset,{videoId,time});
    return true;
  }
  dispose() {
    if(this._disposed){return;}
    this._disposed=true;
    this._cancelPreview();
    this._layout?.dispose?.();
    this._layout=null;
    this._layoutId=null;
    this._started=false;
  }
}
//===END===
export {SceneSearchController};
