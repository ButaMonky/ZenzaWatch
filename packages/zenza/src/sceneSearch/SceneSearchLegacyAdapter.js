// SCUI-18: non-invasive binding plan for the original VideoControlBar.
// No imports from the player: product owners opt-in after Task424 QA.
//===BEGIN===
class SceneSearchLegacyAdapter {
  constructor({Bridge,classes,registry,controlBar,dialog,document,container,
    clock,onError,defer}={}) {
    const seek=controlBar?._seekBar;
    const cfg=controlBar?._playerConfig;
    const player=controlBar?.player;
    if(typeof Bridge!=='function'||!classes||!registry||!seek||
       !cfg||!player||typeof dialog?.execCommand!=='function'||
       !document||!container) {
      throw new TypeError('Legacy scene adapter requires the real seekbar, player, config and commands');
    }
    this.Bridge=Bridge;
    this.classes=classes;
    this.registry=registry;
    this.bar=controlBar;
    this.dialog=dialog;
    this.document=document;
    this.container=container;
    this.clock=clock;
    this._onError=typeof onError==='function'?onError:()=>{};
    this._defer=typeof defer==='function'?defer:
      callback=>Promise.resolve().then(callback);
    this._bridge=null;
    this._owners=[];
    this._generation=0;
    this._disposed=false;
  }
  static seekTime(element,event,duration) {
    if(!Number.isFinite(duration)||duration<=0){return null;}
    const rect=element?.getBoundingClientRect?.();
    if(!rect||!Number.isFinite(rect.left)||!Number.isFinite(rect.width)||
       rect.width<=0){return null;}
    const x=event?.clientX;
    if(!Number.isFinite(x)){return null;}
    // Client rect rather than original offsetX/global.innerWidth means nested
    // targets do not change seek timing, especially at 99%-100% fullscreen.
    return Math.max(0,Math.min(1,(x-rect.left)/rect.width))*duration;
  }
  get seekElement(){return this.bar._seekBar;}
  get currentVideoId(){
    return this.bar.player?.watchId||null;
  }
  get duration(){
    for(const n of [this.bar._duration,this.bar.player?.duration,this.dialog?.duration]){
      if(Number.isFinite(n)&&n>0){return n;}
    }
    return 0;
  }
  get commentData(){
    // Prefer the already filtered data in the existing preview model.
    const existing=this.bar._commentPreview?._model?._chatList;
    if(Array.isArray(existing)){return existing;}
    const raw=this.bar.player?.chatList;
    return Array.isArray(raw)?raw:[];
  }
  _makeOptions(){
    const seek=this.seekElement;
    const legacy=this.bar._seekBarToolTip;
    return {
      classes:this.classes,
      registry:this.registry,
      document:this.document,
      container:this.container,
      seekElement:seek,
      legacyTooltipElement:legacy?._$view?.[0]||null,
      getThumbnailElement:()=>legacy?._seekBarThumbnail?._view||null,
      commentPreviewElement:this.bar._commentPreview?._view?._view||null,
      config:this.bar._playerConfig,
      clock:this.clock,
      getChats:()=>this.commentData,
      layoutSettings:{getDuration:()=>this.duration},
      getSeekTime:e=>SceneSearchLegacyAdapter.seekTime(seek,e,this.duration),
      onSeekRelative:delta=>this.dialog.execCommand('seekBy',delta),
      onSeekAbsolute:sec=>this.dialog.execCommand('seek',sec),
      onError:(error,key)=>this._onError(error,key)
    };
  }
  get bridge(){return this._bridge;}
  _subscribe(owner,event,callback){
    if(typeof owner?.on!=='function'||typeof owner?.off!=='function'){
      throw new TypeError('Legacy emitter '+event+' requires on/off lifecycle');
    }
    owner.on(event,callback);
    this._owners.push([owner,event,callback]);
  }
  _onStoryboardEvent(){
    const generation=this._generation;
    const active=this._bridge;
    this._defer(()=>{
      if(this._disposed||this._generation!==generation||this._bridge!==active){return;}
      this._bridge?.refreshSharedThumbnail?.();
    });
  }
  start(mode='normal'){
    if(this._disposed){throw new Error('Legacy adapter disposed');}
    if(this._bridge){return this._bridge;}
    const bridge=new this.Bridge(this._makeOptions());
    this._bridge=bridge;
    try{
      bridge.start(mode);
      bridge.setVideo(this.currentVideoId);
      const player=this.bar.player;
      this._subscribe(player,'open',watchId=>{
        if(!this._disposed){bridge.setVideo(watchId);}
      });
      this._subscribe(player,'close',()=>{
        if(!this._disposed){bridge.setVideo(null);}
      });
      const storyboard=this.bar.storyboard;
      if(storyboard){
        this._subscribe(storyboard,'update',()=>this._onStoryboardEvent());
        this._subscribe(storyboard,'reset',()=>this._onStoryboardEvent());
      }
    }catch(error){
      this.dispose();
      throw error;
    }
    return bridge;
  }
  screenModeChanged(mode){
    if(this._disposed||!this._bridge){return false;}
    this._generation++; // obsolete outstanding storyboard async notifications
    this._bridge.setMode(mode==='fullscreen'?'fullscreen':'normal');
    this._bridge.refreshSharedThumbnail?.();
    return true;
  }
  dispose(){
    if(this._disposed){return;}
    this._disposed=true;
    this._generation++;
    for(const [owner,event,callback] of this._owners){
      try{owner.off(event,callback);}
      catch(error){this._onError(error,'unsubscribe:'+event);}
    }
    this._owners.length=0;
    this._bridge?.dispose();
    this._bridge=null;
  }
}
//===END===
export {SceneSearchLegacyAdapter};