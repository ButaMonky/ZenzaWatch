/**
 * Canonical typed adapter for native seek and scene-search bridge.
 * Runtime TimelineGeometry must remain an explicit bundled dependency.
 */
import type {TimelineGeometry as TimelineGeometryType} from './TimelineGeometry';
declare const TimelineGeometry:typeof TimelineGeometryType;
type SceneLegacyListener=(...args:never[])=>void;
type SceneLegacyEmitter={
  on(event:string,listener:SceneLegacyListener):unknown;
  off(event:string,listener:SceneLegacyListener):unknown;
};
type SceneSeekElement={
  getBoundingClientRect():{left:number;width:number};
};
type SceneLegacyPlayer=SceneLegacyEmitter&{
  watchId?:string|null;duration?:number;chatList?:unknown[];
};
type SceneLegacyControlBar={
  _seekBar:SceneSeekElement;
  _playerConfig:unknown;
  player:SceneLegacyPlayer;
  _duration?:number;
  _seekBarToolTip?:{_$view?:HTMLElement[];_seekBarThumbnail?:{_view?:HTMLElement}};
  _commentPreview?:{_view?:{_view?:HTMLElement};_model?:{_chatList?:unknown};createListView?:(container:HTMLElement)=>unknown};
  _sceneSearchPinnedTime?:(()=>number|null);
  storyboard?:SceneLegacyEmitter;
};
type SceneLegacyDialog={
  duration?:number;
  execCommand(command:string,value:number):unknown;
};
type SceneLegacyBridge={
  start(mode:string):unknown;
  setVideo(id:string|null):unknown;
  setMode(mode:string):unknown;
  dispose():unknown;
  refreshSharedThumbnail?():unknown;
  readonly state:{pinned:boolean;time:number};
};
type SceneLegacyBridgeConstructor=new (options:Record<string,unknown>)=>SceneLegacyBridge;
type SceneLegacyAdapterOptions={
  Bridge?:SceneLegacyBridgeConstructor;
  classes?:unknown;registry?:unknown;
  controlBar?:SceneLegacyControlBar;dialog?:SceneLegacyDialog;
  document?:Document;container?:HTMLElement;
  clock?:unknown;
  onError?:(error:unknown,key?:string)=>void;
  defer?:(callback:()=>void)=>void;
};
export class SceneSearchLegacyAdapter {
  declare Bridge:SceneLegacyBridgeConstructor;
  declare classes:unknown;
  declare registry:unknown;
  declare bar:SceneLegacyControlBar;
  declare dialog:SceneLegacyDialog;
  declare document:Document;
  declare container:HTMLElement;
  declare clock:unknown;
  declare _onError:(error:unknown,key?:string)=>void;
  declare _defer:(callback:()=>void)=>void;
  declare _bridge:SceneLegacyBridge|null;
  declare _owners:Array<[SceneLegacyEmitter,string,SceneLegacyListener]>;
  declare _generation:number;
  declare _disposed:boolean;
  declare _previousPinnedTime:(()=>number|null)|undefined;
  declare _pinnedTimeHook:(()=>number|null)|undefined;
  constructor({Bridge,classes,registry,controlBar,dialog,document,container,
    clock,onError,defer}:SceneLegacyAdapterOptions={}) {
    const seek=controlBar?._seekBar;
    const cfg=controlBar?._playerConfig;
    const player=controlBar?.player;
    if(typeof Bridge!=='function'||!classes||!registry||!seek||
       !cfg||!player||typeof dialog?.execCommand!=='function'||
       !document||!container) {
      throw new TypeError('Legacy scene adapter requires the real seekbar, player, config and commands');
    }
    this.Bridge=Bridge as SceneLegacyBridgeConstructor;
    this.classes=classes;
    this.registry=registry;
    this.bar=controlBar as SceneLegacyControlBar;
    this.dialog=dialog as SceneLegacyDialog;
    this.document=document as Document;
    this.container=container as HTMLElement;
    this.clock=clock;
    this._onError=typeof onError==='function'?onError:()=>{};
    this._defer=typeof defer==='function'?defer:
      callback=>Promise.resolve().then(callback);
    this._bridge=null;
    this._owners=[];
    this._generation=0;
    this._disposed=false;
  }
  static seekTime(element:SceneSeekElement|null,event:{clientX?:number}|null,duration:number):number|null {
    if(TimelineGeometry.timeToRatio(0,duration)===null){return null;}
    const rect=element?.getBoundingClientRect?.();
    if(!rect){return null;}
    // This consumer maps client pixels only; it never positions a local preview.
    const geometry=TimelineGeometry.create({
      clientLeft:rect.left,clientWidth:rect.width,localWidth:rect.width
    });
    const ratio=geometry?.clientXToRatio(event?.clientX as number);
    return ratio==null?null:TimelineGeometry.ratioToTime(ratio,duration);
  }
  get seekElement():SceneSeekElement{return this.bar._seekBar;}
  get currentVideoId():string|null{
    return this.bar.player?.watchId||null;
  }
  get duration():number{
    for(const n of [this.bar._duration,this.bar.player?.duration,this.dialog?.duration]){
      if(Number.isFinite(n as number)&&(n as number)>0){return n as number;}
    }
    return 0;
  }
  get commentData():unknown[]{
    // Prefer the already filtered data in the existing preview model.
    const existing=this.bar._commentPreview?._model?._chatList;
    if(Array.isArray(existing)){return existing;}
    const raw=this.bar.player?.chatList;
    return Array.isArray(raw)?raw:[];
  }
  _makeOptions():Record<string,unknown>{
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
      createCommentList:(container:HTMLElement)=>this.bar._commentPreview?.createListView?.(container),
      config:this.bar._playerConfig,
      clock:this.clock,
      getChats:()=>this.commentData,
      layoutSettings:{getDuration:()=>this.duration},
      getSeekTime:(e:{clientX?:number})=>SceneSearchLegacyAdapter.seekTime(seek,e,this.duration),
      onSeekRelative:(delta:number)=>this.dialog.execCommand('seekBy',delta),
      onSeekAbsolute:(sec:number)=>this.dialog.execCommand('seek',sec),
      onError:(error:unknown,key:string)=>this._onError(error,key)
    };
  }
  get bridge():SceneLegacyBridge|null{return this._bridge;}
  _subscribe(owner:SceneLegacyEmitter,event:string,callback:SceneLegacyListener):void{
    if(typeof owner?.on!=='function'||typeof owner?.off!=='function'){
      throw new TypeError('Legacy emitter '+event+' requires on/off lifecycle');
    }
    owner.on(event,callback);
    this._owners.push([owner,event,callback]);
  }
  _onStoryboardEvent():void{
    const generation=this._generation;
    const active=this._bridge;
    this._defer(()=>{
      if(this._disposed||this._generation!==generation||this._bridge!==active){return;}
      this._bridge?.refreshSharedThumbnail?.();
    });
  }
  start(mode:string='normal'):SceneLegacyBridge{
    if(this._disposed){throw new Error('Legacy adapter disposed');}
    if(this._bridge){return this._bridge;}
    const bridge=new this.Bridge(this._makeOptions());
    this._bridge=bridge;
    try{
      bridge.start(mode);
      bridge.setVideo(this.currentVideoId);
      this._previousPinnedTime=this.bar._sceneSearchPinnedTime;
      this._pinnedTimeHook=()=>bridge.state.pinned?bridge.state.time:null;
      this.bar._sceneSearchPinnedTime=this._pinnedTimeHook;
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
  screenModeChanged(mode:string):boolean{
    if(this._disposed||!this._bridge){return false;}
    this._generation++; // obsolete outstanding storyboard async notifications
    this._bridge.setMode(mode==='fullscreen'?'fullscreen':'normal');
    this._bridge.refreshSharedThumbnail?.();
    return true;
  }
  dispose():void{
    if(this._disposed){return;}
    this._disposed=true;
    this._generation++;
    for(const [owner,event,callback] of this._owners){
      try{owner.off(event,callback);}
      catch(error){this._onError(error,'unsubscribe:'+event);}
    }
    this._owners.length=0;
    if(this.bar._sceneSearchPinnedTime===this._pinnedTimeHook){
      if(this._previousPinnedTime===undefined)delete this.bar._sceneSearchPinnedTime;
      else this.bar._sceneSearchPinnedTime=this._previousPinnedTime;
    }
    this._bridge?.dispose();
    this._bridge=null;
  }
}
