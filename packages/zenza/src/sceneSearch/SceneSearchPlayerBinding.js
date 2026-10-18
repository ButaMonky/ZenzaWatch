// SCUI-18: actual player lifecycle binding; no changes to VideoControlBar ownership.
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
import {UiVisibilityRegistry} from '../../../../src/UiVisibilityRegistry';
import {StoryboardWorker} from '../storyboard/StoryboardWorker';
//===BEGIN===
//@require SceneSearchPlacement
//@require SceneSearchLegacyAdapter
//@require SceneSearchIntegrationBridge
//@require createSceneSearchLayoutRegistry
//@require SceneSearchController
//@require SceneSearchInteraction
//@require ScenePreviewIdleLimiter
//@require SceneSeekStepControl
//@require SceneCommentSearch
//@require SceneCommentSearchPanel
//@require SceneSearchShortcutRouter
//@require UiVisibilityRegistry
//@require StoryboardWorker
class SceneSearchPlayerBinding {
  constructor({view,dialog,document,container,events,isFullscreen,onError,
    Adapter,Bridge,classes,createRegistry}={}) {
    if(!view||!dialog||!document||!container||typeof dialog.on!=='function'||
       typeof dialog.off!=='function'){
      throw new TypeError('Scene player binding requires a disposable player lifecycle');
    }
    this.view=view;this.dialog=dialog;this.document=document;this.container=container;
    this.events=events;this.isFullscreen=isFullscreen||(()=>false);
    this.onError=typeof onError==='function'?onError:()=>{};
    this.Adapter=Adapter||SceneSearchLegacyAdapter;
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
  _listen(owner,event,fn){
    if(typeof owner?.on!=='function'||typeof owner?.off!=='function'){return;}
    owner.on(event,fn);this._subscriptions.push([owner,event,fn]);
  }
  attach(){
    if(this._attached||this._disposed){return this;}
    this._attached=true;
    this._listen(this.dialog,'open',()=>this._start());
    this._listen(this.dialog,'close',()=>this._stop());
    this._listen(this.dialog,'screenModeChange',()=>this._mode());
    this._listen(this.events,'fullscreenStatusChange',()=>this._mode());
    this.document.defaultView?.addEventListener('pagehide',this._pagehide);
    this.document.defaultView?.addEventListener('resize',this._geometryChanged);
    this.document.addEventListener('fullscreenchange',this._fullscreenChanged);
    this._listen(this.dialog,'sceneSearchGeometryChange',event=>{
      this._manipulating=event?.active===true;this._scheduleGeometry();
    });
    if(this.dialog.isOpen){this._start();}
    return this;
  }
  _mode(){
    if(this._disposed||!this.adapter){return;}
    try{this.adapter.screenModeChanged(this.document.fullscreenElement||this.isFullscreen()?'fullscreen':'normal');
      this._scheduleGeometry();}
    catch(_){this._stop();this.onError('SCENE_MODE_FAILED');}
  }
  _start(){
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
  _geometryContext(){
    if(this.document.fullscreenElement||this.isFullscreen())return 'fullscreen';
    return this.dialog.screenMode==='small'||this.dialog._state?.screenMode==='small'||
      this.container.closest('.zenzaScreenMode_small')?'small':'normal';
  }
  _scheduleGeometry(){
    if(this._disposed||!this.adapter||this._geometryFrame!==null)return;
    const win=this.document.defaultView;
    const callback=()=>{
      this._geometryFrame=null;
      this.adapter?.bridge?.updatePlacementContext?.({context:this._geometryContext(),interactionActive:this._manipulating});
    };
    this._geometryFrame=win.requestAnimationFrame?win.requestAnimationFrame(callback):win.setTimeout(callback,0);
  }
  _watchGeometry(){
    const win=this.document.defaultView;
    const selectors='.videoPlayer,.commentInputPanel,.commandDrawer,.commandPopover,.closeButton,.zenzaSmallModeResizeHandle';
    if(win.ResizeObserver){
      this._geometryObserver=new win.ResizeObserver(this._geometryChanged);
      this._geometryObserver.observe(this.container);
      for(const node of this.container.querySelectorAll(selectors))this._geometryObserver.observe(node);
    }
    if(win.MutationObserver){
      this._geometryMutation=new win.MutationObserver(records=>{
        if(records.some(record=>record.target===this.container||record.target.matches?.(selectors)||
          record.target.closest?.('.commentInputPanel')))this._scheduleGeometry();
      });
      this._geometryMutation.observe(this.container,{attributes:true,attributeFilter:['class','style','hidden'],subtree:true});
    }
  }
  _stop(){
    const adapter=this.adapter;this.adapter=null;
    const win=this.document.defaultView;
    if(this._geometryFrame!==null){
      if(win.cancelAnimationFrame)win.cancelAnimationFrame(this._geometryFrame);else win.clearTimeout(this._geometryFrame);
      this._geometryFrame=null;
    }
    this._geometryObserver?.disconnect();this._geometryObserver=null;
    this._geometryMutation?.disconnect();this._geometryMutation=null;this._manipulating=false;
    try{adapter?.dispose();}catch(_){this.onError('SCENE_DISPOSE_FAILED');}
  }
  handleShortcut(command){
    if(this._disposed||typeof command!=='string'||!command.startsWith('sceneSearch-')){
      return false;
    }
    if(!this.adapter&&this.dialog.isOpen){this._start();}
    return this.adapter?.bridge?.handleShortcut(command)===true;
  }
  dispose(){
    if(this._disposed){return;}
    this._disposed=true;this._stop();
    for(const [owner,event,fn] of this._subscriptions){owner.off(event,fn);}
    this._subscriptions.length=0;
    this.document.defaultView?.removeEventListener('pagehide',this._pagehide);
    this.document.defaultView?.removeEventListener('resize',this._geometryChanged);
    this.document.removeEventListener('fullscreenchange',this._fullscreenChanged);
  }
}
//===END===
export {SceneSearchPlayerBinding};
