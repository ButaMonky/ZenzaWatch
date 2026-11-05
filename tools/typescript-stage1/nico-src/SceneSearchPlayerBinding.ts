import {SceneSearchPlacement} from './SceneSearchPlacement';
import {SceneSearchLegacyAdapter} from './SceneSearchLegacyAdapter';
import {SceneSearchIntegrationBridge} from './SceneSearchIntegrationBridge';
import {createSceneSearchLayoutRegistry} from './SceneSearchLayoutBootstrap';
import {SceneSearchController} from './SceneSearchController';
import {SceneSearchInteraction} from './SceneSearchInteraction';
import {ScenePreviewIdleLimiter} from './ScenePreviewIdleLimiter';
import {SceneSeekStepControl} from './SceneSeekStepControl';
import {SceneCommentSearch} from './SceneCommentSearch';
import {SceneCommentSearchPanel} from './SceneCommentSearchPanel';
import {SceneSearchShortcutRouter} from './SceneSearchShortcutRouter';
import {UiVisibilityRegistry} from './UiVisibilityRegistry';
import {StoryboardWorker} from './SceneSearchStoryboardWorkerBoundary';
import type {SceneSearchLayoutRegistry} from './SceneSearchLayoutRegistry';
/**
 * Single owner for player/event bindings. The Bridge stays a separate runtime
 * until its own P13 responsibility split; both ownership boundaries are typed.
 */
type BindingCallback=(event?:BindingEventPayload)=>void;
type BindingEventPayload={active?:boolean;[key:string]:unknown};
type BindingEventOwner={
  on?:(event:string,callback:BindingCallback)=>unknown;
  off?:(event:string,callback:BindingCallback)=>unknown;
};
type BindingDialog=BindingEventOwner&{
  isOpen?:boolean;screenMode?:string;_state?:{screenMode?:string};
};
type BindingStoryboard={_watchId?:string|null;model?:{isAvailable?:boolean}|null};
type BindingBar={storyboard?:BindingStoryboard|null;player?:{watchId?:string|null}};
type BindingView=BindingEventOwner&{videoControlBar?:BindingBar|null};
type BindingBridge={
  layoutSettings?:{getStoryboardModel?:()=>unknown;createFilmstripThumbnail?:(options:unknown)=>unknown};
  state?:{layoutId?:string};
  controller?:{onPreferencesChanged?:(key:string)=>void};
  updatePlacementContext?:(opts:{context:string;interactionActive:boolean})=>void;
  handleShortcut(command:string):boolean;
};
type BindingAdapter={
  bridge?:BindingBridge|null;
  start(mode:string):BindingBridge|null;
  screenModeChanged(mode:string):unknown;dispose():void;
};
type BindingAdapterConstructor=new(options:Record<string,unknown>)=>BindingAdapter;
type BindingOptions={
  view?:BindingView|null;dialog?:BindingDialog|null;document?:Document;
  container?:HTMLElement;events?:BindingEventOwner|null;
  isFullscreen?:()=>boolean;onError?:(error:string)=>void;
  Adapter?:BindingAdapterConstructor;Bridge?:typeof SceneSearchIntegrationBridge;
  classes?:Record<string,unknown>;createRegistry?:()=>SceneSearchLayoutRegistry;
};
export class SceneSearchPlayerBinding {
  declare view:BindingView;
  declare dialog:BindingDialog;
  declare document:Document;
  declare container:HTMLElement;
  declare events:BindingEventOwner|null|undefined;
  declare isFullscreen:()=>boolean;
  declare onError:(error:string)=>void;
  declare Adapter:BindingAdapterConstructor;
  declare Bridge:typeof SceneSearchIntegrationBridge;
  declare createRegistry:()=>SceneSearchLayoutRegistry;
  declare classes:Record<string,unknown>;
  declare adapter:BindingAdapter|null;
  declare _subscriptions:Array<[BindingEventOwner,string,BindingCallback]>;
  declare _attached:boolean;declare _disposed:boolean;
  declare _pagehide:()=>void;
  declare _geometryFrame:number|null;declare _manipulating:boolean;
  declare _geometryChanged:()=>void;declare _fullscreenChanged:()=>void;
  declare _geometryObserver:ResizeObserver|null;
  declare _geometryMutation:MutationObserver|null;
  declare _geometryTargets:Set<Element>|null;
  declare _geometryInteractionChanged:((event:Event)=>void)|null;
  declare _geometryInteractionEvents:string[]|null;
  declare _geometryTransitionChanged:((event:Event)=>void)|null;
  constructor({view,dialog,document,container,events,isFullscreen,onError,
    Adapter,Bridge,classes,createRegistry}:BindingOptions={}) {
    if(!view||!dialog||!document||!container||typeof dialog.on!=='function'||
       typeof dialog.off!=='function'){
      throw new TypeError('Scene player binding requires a disposable player lifecycle');
    }
    this.view=view;this.dialog=dialog;this.document=document;this.container=container;
    this.events=events;this.isFullscreen=isFullscreen||(()=>false);
    this.onError=typeof onError==='function'?onError:()=>{};
    this.Adapter=Adapter||(SceneSearchLegacyAdapter as unknown as BindingAdapterConstructor);
    this.Bridge=Bridge||SceneSearchIntegrationBridge;
    this.createRegistry=createRegistry||createSceneSearchLayoutRegistry;
    this.classes=classes||{Controller:SceneSearchController,Interaction:SceneSearchInteraction,
      IdleLimiter:ScenePreviewIdleLimiter,SeekStepControl:SceneSeekStepControl,
      CommentSearch:SceneCommentSearch,CommentSearchPanel:SceneCommentSearchPanel,
      ShortcutRouter:SceneSearchShortcutRouter,VisibilityRegistry:UiVisibilityRegistry,
      Placement:typeof SceneSearchPlacement==='undefined'?null:SceneSearchPlacement};
    this.adapter=null;this._subscriptions=[];this._attached=false;this._disposed=false;
    this._pagehide=()=>this.dispose();
    this._geometryFrame=null;this._manipulating=false;
    this._geometryChanged=()=>this._scheduleGeometry();
    this._fullscreenChanged=()=>this._mode();
  }
  _listen(owner:BindingEventOwner|null|undefined,event:string,fn:BindingCallback):void{
    if(typeof owner?.on!=='function'||typeof owner?.off!=='function'){return;}
    owner.on(event,fn);this._subscriptions.push([owner,event,fn]);
  }
  attach():this{
    if(this._attached||this._disposed){return this;}
    this._attached=true;
    this._listen(this.dialog,'open',()=>this._start());
    this._listen(this.dialog,'close',()=>this._stop());
    this._listen(this.dialog,'screenModeChange',()=>this._mode());
    this._listen(this.events,'fullscreenStatusChange',()=>this._mode());
    this.document.defaultView?.addEventListener('pagehide',this._pagehide);
    this.document.defaultView?.addEventListener('resize',this._geometryChanged);
    this.document.addEventListener('fullscreenchange',this._fullscreenChanged);
    this._listen(this.view,'sceneSearchGeometryChange',(event?:BindingEventPayload)=>{
      this._manipulating=event?.active===true;this._scheduleGeometry();
    });
    if(this.dialog.isOpen){this._start();}
    return this;
  }
  _mode():void{
    if(this._disposed||!this.adapter){return;}
    try{this.adapter.screenModeChanged(this.document.fullscreenElement||this.isFullscreen()?'fullscreen':'normal');
      this._scheduleGeometry();}
    catch(_){this._stop();this.onError('SCENE_MODE_FAILED');}
  }
  _start():void{
    if(this._disposed||this.adapter){return;}
    try{
      const adapter=new this.Adapter({Bridge:this.Bridge,classes:this.classes,
        registry:this.createRegistry(),controlBar:this.view.videoControlBar,
        dialog:this.dialog,document:this.document,container:this.container,
        onError:()=>this.onError('SCENE_ADAPTER_FAILED')});
      this.adapter=adapter;
      const bridge=adapter.start(this.document.fullscreenElement||this.isFullscreen()?'fullscreen':'normal');
      this._watchGeometry();this._scheduleGeometry();
      // UI07 shares the existing StoryboardWorker/image cache, but owns only
      // two lazily-created adjacent canvases while its layout is selected.
      // Avoid the separate LegacyAdapter owner (Task532).
      if(bridge?.layoutSettings && this.view.videoControlBar?.storyboard){
        const bar=this.view.videoControlBar;
        bridge.layoutSettings.getStoryboardModel=()=>{
          const board=bar.storyboard;
          const videoId=bar.player?.watchId;
          return videoId && board?._watchId===videoId &&
            board.model?.isAvailable ? board.model:null;
        };
        bridge.layoutSettings.createFilmstripThumbnail=options=>
          StoryboardWorker.createThumbnail(options);
        if(bridge.state?.layoutId==='07'){
          bridge.controller?.onPreferencesChanged?.('sceneSearch.idleHideSeconds');
        }
      }
    }catch(_){this._stop();this.onError('SCENE_START_FAILED');}
  }
  _geometryContext():'normal'|'small'|'fullscreen'{
    if(this.document.fullscreenElement||this.isFullscreen())return 'fullscreen';
    return this.dialog.screenMode==='small'||this.dialog.screenMode==='sideView'||
      this.dialog._state?.screenMode==='small'||this.dialog._state?.screenMode==='sideView'||
      this.container.closest('.zenzaScreenMode_small,.zenzaScreenMode_sideView')?'small':'normal';
  }
  _scheduleGeometry():void{
    if(this._disposed||!this.adapter||this._geometryFrame!==null)return;
    const win=this.document.defaultView!;
    const callback=()=>{
      this._geometryFrame=null;
      this.adapter?.bridge?.updatePlacementContext?.({context:this._geometryContext(),interactionActive:this._manipulating});
    };
    this._geometryFrame=win.requestAnimationFrame?win.requestAnimationFrame(callback):win.setTimeout(callback,0);
  }
  _watchGeometry():void{
    const win=this.document.defaultView!;
    // The Bridge reads transformed *rendered* controls. ResizeObserver alone
    // reports content-box changes, not CSS transforms or focus/hover state.
    const selectors='.videoPlayer,.videoControlBar,.seekBarContainer,.seekBar,'+
      '.commentInputPanel,.commandDrawer,.commandPopover,.commandMenu,.commandList,'+
      '.closeButton,.zenzaSmallModeResizeHandle,.zenzaSmallModeResetButton,'+
      '.zenzaSmallModeAspectLockButton,.zenzaSmallModeCloseButton,'+
      '.controlItemContainer,.controlItemContainer .scalingUI,.controlItemContainer .controlButton';
    this._geometryTargets=new Set();
    const refreshTargets=()=>{
      if(!this._geometryObserver)return;
      const present=new Set<Element>([this.container,...this.container.querySelectorAll(selectors)]);
      for(const node of present)if(!this._geometryTargets!.has(node)){
        this._geometryObserver.observe(node);this._geometryTargets!.add(node);
      }
      for(const node of this._geometryTargets!)if(!present.has(node)){
        this._geometryObserver.unobserve?.(node);this._geometryTargets!.delete(node);
      }
    };
    if(win.ResizeObserver){
      this._geometryObserver=new win.ResizeObserver(this._geometryChanged);
      refreshTargets();
    }
    if(win.MutationObserver){
      const matches=(node:Node|null)=>node?.nodeType===1&&
        ((node as Element).matches?.(selectors)||this._geometryTargets!.has(node as Element));
      const hasTarget=(node:Node|null)=>matches(node)||(node as Element|null)?.querySelector?.(selectors);
      this._geometryMutation=new win.MutationObserver(records=>{
        let changed=false,refresh=false;
        for(const record of records){
          if(record.type==='childList'){
            const nodes=[...record.addedNodes,...record.removedNodes];
            if((record.target as Element)?.matches?.(selectors)||
              (record.target as Element)?.closest?.('.commentInputPanel,.controlItemContainer')||
              nodes.some(hasTarget)){changed=true;refresh=true;}
          }else if(record.target===this.container||matches(record.target)){
            changed=true;
            if(record.attributeName==='class')refresh=true;
          }
        }
        if(refresh)refreshTargets();
        if(changed)this._scheduleGeometry();
      });
      this._geometryMutation.observe(this.container,{attributes:true,
        attributeFilter:['class','style','hidden','aria-hidden','aria-expanded'],
        childList:true,subtree:true});
    }
    // CSS :hover/:focus-within can reveal an interactive popup with no DOM
    // mutation, content-box resize, or changed inline style. Observe only
    // entry/exit boundaries, never continuous mousemove or costly polling.
    const pseudoTargets='.commentInputPanel,.commandDrawer,.commandPopover,'+
      '.commandMenu,.commandList,.zenzaPopupMenu,.playbackRateMenu,'+
      '.controlItemContainer,.scalingUI,.controlButton,.closeButton,'+
      '.zenzaSmallModeResizeHandle,.zenzaSmallModeResetButton,'+
      '.zenzaSmallModeAspectLockButton,.zenzaSmallModeCloseButton';
    const pseudoScope=(node:EventTarget|null):Element|null=>{
      if((node as Element|null)?.nodeType!==1||!this.container.contains(node as Node))return null;
      const owned=(node as Element).closest?.(pseudoTargets);
      if(owned&&this.container.contains(owned))return owned;
      // A hover rule may live on a neutral wrapper around .commandPopover.
      // Exclude the entire player/toolbar from this ancestor-owner fallback.
      for(let parent=node as Element|null;parent&&parent!==this.container;parent=parent.parentElement){
        if(parent.matches?.('.videoPlayer,.videoControlBar,.seekBar,.seekBarContainer'))break;
        if(parent.querySelector?.(pseudoTargets))return parent;
      }
      return null;
    };
    this._geometryInteractionChanged=(event:Event)=>{
      const from=pseudoScope(event.target);
      const to=pseudoScope((event as MouseEvent).relatedTarget);
      if(!from&&!to)return;
      // Crossing children of the same pseudo-state owner does not change
      // the owner's :hover or :focus-within and needs no fresh placement.
      if(from&&to&&(from===to||from.contains((event as MouseEvent).relatedTarget as Node)||
        to.contains(event.target as Node)))return;
      this._scheduleGeometry(); // RAF coalesces pointer + mouse event pairs.
    };
    this._geometryInteractionEvents=[
      'pointerover','pointerout','mouseover','mouseout','focusin','focusout'];
    for(const event of this._geometryInteractionEvents){
      this.container.addEventListener(event,this._geometryInteractionChanged,true);
    }
    this._geometryTransitionChanged=(event:Event)=>{
      // Ignore animations on unrelated descendants of a popup owner.
      // Re-sample actual obstacle surfaces after visibility/geometry
      // transitions, without amplifying button decoration animations.
      if((event.target as Element|null)?.matches?.(
        '.controlItemContainer,.scalingUI,.controlButton,.commentInputPanel,'+
        '.commandDrawer,.commandPopover,.commandMenu,.commandList,'+
        '.zenzaPopupMenu,.playbackRateMenu')){
        if(!(event as TransitionEvent).propertyName||['opacity','visibility','transform','clip-path'].includes(
          (event as TransitionEvent).propertyName))this._scheduleGeometry();
      }
    };
    this.container.addEventListener('transitionend',this._geometryTransitionChanged,true);
  }
  _stop():void{
    const adapter=this.adapter;this.adapter=null;
    const win=this.document.defaultView!;
    if(this._geometryFrame!==null){
      if(win.cancelAnimationFrame)win.cancelAnimationFrame(this._geometryFrame);else win.clearTimeout(this._geometryFrame);
      this._geometryFrame=null;
    }
    this._geometryObserver?.disconnect();this._geometryObserver=null;
    this._geometryMutation?.disconnect();this._geometryMutation=null;
    this._geometryTargets?.clear();this._geometryTargets=null;
    if(this._geometryInteractionChanged){
      for(const event of this._geometryInteractionEvents||[]){
        this.container.removeEventListener(event,this._geometryInteractionChanged,true);
      }
      this._geometryInteractionChanged=null;
      this._geometryInteractionEvents=null;
    }
    if(this._geometryTransitionChanged){
      this.container.removeEventListener('transitionend',this._geometryTransitionChanged,true);
      this._geometryTransitionChanged=null;
    }
    this._manipulating=false;
    try{adapter?.dispose();}catch(_){this.onError('SCENE_DISPOSE_FAILED');}
  }
  handleShortcut(command:unknown):boolean{
    if(this._disposed||typeof command!=='string'||!command.startsWith('sceneSearch-')){
      return false;
    }
    if(!this.adapter&&this.dialog.isOpen){this._start();}
    return this.adapter?.bridge?.handleShortcut(command)===true;
  }
  dispose():void{
    if(this._disposed){return;}
    this._disposed=true;this._stop();
    for(const [owner,event,fn] of this._subscriptions){owner.off!(event,fn);}
    this._subscriptions.length=0;
    this.document.defaultView?.removeEventListener('pagehide',this._pagehide);
    this.document.defaultView?.removeEventListener('resize',this._geometryChanged);
    this.document.removeEventListener('fullscreenchange',this._fullscreenChanged);
  }
}
