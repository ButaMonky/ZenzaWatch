// SCUI-18 bridge prototype. Not imported by ZenzaWatch until Task424 QA.
// The legacy seekbar remains owner of media input/hit testing. This bridge
// reads events and mounts the selected standalone scene card only.
//===BEGIN===
class SceneSearchIntegrationBridge {
  constructor({classes,document,container,seekElement,commentPreviewElement,
    legacyTooltipElement,getThumbnailElement,config,registry,clock,layoutSettings,
    getChats,getSeekTime,onSeekRelative,onSeekAbsolute,loadPreview,onError}={}) {
    if(!document||!container||!seekElement||!config||!registry||
       typeof config.getValue!=='function'||typeof config.setValue!=='function'||
       typeof onSeekRelative!=='function'||typeof onSeekAbsolute!=='function'){
      throw new TypeError('Scene search integration requires DOM, config, registry and seek callbacks');
    }
    const required=['Controller','Interaction','IdleLimiter','SeekStepControl',
      'CommentSearch','CommentSearchPanel','ShortcutRouter','VisibilityRegistry'];
    if(!classes||required.some(name=>typeof classes[name]!=='function'&&
       !(name==='VisibilityRegistry'&&typeof classes[name]?.connect==='function'))){
      throw new TypeError('Missing scene-search integration dependencies');
    }
    this.document=document;
    this.container=container;
    this.seekElement=seekElement;
    this._commentPreviewElement=commentPreviewElement||null;
    this._commentPreviewOriginal=null;
    this._legacyTooltipElement=legacyTooltipElement||null;
    this._legacyTooltipOriginal=null;
    this._getThumbnailElement=typeof getThumbnailElement==='function'?
      getThumbnailElement:null;
    this._sharedThumbnail=null;
    this.config=config;
    this.registry=registry;
    this.layoutSettings=layoutSettings||{};
    this._clock=clock||null;
    this._classes=classes;
    this._getChats=typeof getChats==='function'?getChats:()=>[];
    this._getSeekTime=typeof getSeekTime==='function'?getSeekTime:null;
    this._onSeekRelative=onSeekRelative;
    this._onSeekAbsolute=onSeekAbsolute;
    this._onError=typeof onError==='function'?onError:()=>{};
    this._active=null;
    this._cardCleanup=null;
    this._visibility=null;
    this._subscriptions=[];
    this._activePointers=new Set();
    this._onPointerFinish=this._finishPointer.bind(this);
    this._running=false;
    this._disposed=false;
    this._style=null;
    this._seekListeners={
      mouseenter:e=>this.interaction.seekEnter(e),
      mousemove:e=>{
        this.interaction.seekMove(e);
        const seconds=this._getSeekTime?.(e);
        if(Number.isFinite(seconds)&&seconds>=0){this.controller.setTime(seconds);}
      },
      mouseleave:e=>this.interaction.seekLeave(e),
      pointerdown:e=>this._startPointer(e)
    };
    this.controller=new classes.Controller({
      getPreference:key=>config.getValue(key),
      createLayout:({id,mode})=>this._createLayout({id,mode}),
      loadPreview:loadPreview||null,
      onSeek:delta=>this._onSeekRelative(delta),
      onError:(error,key)=>this._onError(error,key)
    });
    this.commentSearch=new classes.CommentSearch({
      getChats:()=>this._getChats(),
      getVideoId:()=>this.controller.snapshot.videoId,
      seekTo:seconds=>this._onSeekAbsolute(seconds)
    });
    this.idleLimiter=new classes.IdleLimiter({
      controller:this.controller,
      getSeconds:()=>config.getValue('sceneSearch.idleHideSeconds'),
      clock:this._clock||undefined,
      onIdleHidden:hidden=>this._active?.root?.classList.toggle('is-idle-suppressed',hidden)
    });
    this.interaction=new classes.Interaction({
      controller:this.controller,
      getPreviewRect:()=>{
        const root=this._active?.root;
        return root?.getBoundingClientRect?.()||null;
      },
      subscribePointerMove:listener=>{
        document.addEventListener('mousemove',listener,true);
        return ()=>document.removeEventListener('mousemove',listener,true);
      },
      clock:this._clock||undefined,
      idleLimiter:this.idleLimiter
    });
    this.router=new classes.ShortcutRouter({
      controller:this.controller,interaction:this.interaction,
      getPreference:key=>config.getValue(key),
      setPreference:(key,value)=>config.setValue(key,value),
      onToggleControls:()=>this._active?.root?.classList.toggle('is-expanded'),
      onError:(error,key)=>this._onError(error,key)
    });
  }
  _startPointer(e) {
    if(this._disposed){return;}
    const id=e?.pointerId??'main';
    const empty=this._activePointers.size===0;
    this._activePointers.add(id);
    if(empty && this._activePointers.size===1){
      // Observe release even if the pointer leaves the seekbar.
      this.document.addEventListener('pointerup',this._onPointerFinish,true);
      this.document.addEventListener('pointercancel',this._onPointerFinish,true);
      this.interaction.setDragging(true);
    }
  }
  _finishPointer(e) {
    const id=e?.pointerId??'main';
    if(!this._activePointers.delete(id)){return;}
    if(!this._activePointers.size){this._clearPointers();}
  }
  _clearPointers() {
    const active=this._activePointers.size>0;
    this._activePointers.clear();
    this.document.removeEventListener('pointerup',this._onPointerFinish,true);
    this.document.removeEventListener('pointercancel',this._onPointerFinish,true);
    if(active || this._running){this.interaction.setDragging(false);}
  }
  _createLayout({id,mode}) {
    const card=this.registry.create({id,mode,document:this.document,
      container:this.container,settings:this.layoutSettings,
      onAction:(action,ctx,event)=>this._onCardAction(action,ctx,event)});
    return {
      get root(){return card.root;},
      mount:state=>{
        card.mount(state);
        this._active=card;
        try{this._mountCardControls(card);}catch(error){
          this._releaseCard(card);card.dispose();throw error;
        }
      },
      render:state=>{
        card.render(state);
        this._visibility?.refresh?.();
        if(card.root){
          const reveal=this.config.getValue('sceneSearch.controlsReveal');
          const animation=this.config.getValue('sceneSearch.animation');
          card.root.dataset.sceneReveal=['click','always'].includes(reveal)?reveal:'hover-focus';
          card.root.dataset.sceneAnimation=['off','full'].includes(animation)?animation:'subtle';
        }
      },
      onPreview:(asset,request)=>{
        card.onPreview?.(asset,request);
        if(this._sharedThumbnail?.node && card.root?.contains(this._sharedThumbnail.node)){
          const slot=card.root.querySelector('.zenzaSceneImageBox');
          if(slot){
            const image=slot.querySelector('.zenzaSceneImage');
            const placeholder=slot.querySelector('.zenzaSceneImagePlaceholder');
            if(image){image.hidden=true;}
            if(placeholder){placeholder.hidden=true;}
          }
        }
      },
      dispose:()=>{
        this._releaseCard(card);
        card.dispose();
      }
    };
  }
  _onCardAction(action) {
    const commands={
      'seek-back':'sceneSearch-seekBack',
      'seek-forward':'sceneSearch-seekForward',
      pin:'sceneSearch-togglePin',
      'comment-toggle':'sceneSearch-toggleCommentPreview',
      'comment-search':'sceneSearch-toggleCommentSearch'
    };
    if(action==='seek-step'){
      this._stepWidget?.openMenu();
      return;
    }
    if(commands[action]){this.router.handle(commands[action]);}
  }
  _mountCardControls(card) {
    const root=card.root;
    if(!root){throw new Error('Cannot wire unmounted scene card');}
    const classNames={
      pin:'zenzaSceneSearchPin',
      'comment-toggle':'zenzaSceneCommentToggle',
      'comment-search':'zenzaSceneCommentSearchToggle',
      more:'zenzaSceneSearchMore'
    };
    for(const [action,css] of Object.entries(classNames)){
      root.querySelector('[data-scui-action="'+action+'"]')?.classList.add(css);
    }
    const actionList=root.querySelector('.zenzaSceneActions');
    if(!actionList){throw new Error('Scene controls missing');}
    actionList.classList.add('zenzaSceneSeekStepControl');
    for(const [action,tag] of [
      ['seek-back','back'],['seek-forward','forward'],['seek-step','open']
    ]){
      const button=root.querySelector('[data-scui-action="'+action+'"]');
      if(button){button.dataset.scui=tag;}
    }
    const C=this._classes;
    const step=new C.SeekStepControl({
      document:this.document,
      getSeconds:()=>this.config.getValue('sceneSearch.seekStepSeconds'),
      setSeconds:value=>{
        this.config.setValue('sceneSearch.seekStepSeconds',value);
        this.controller.onPreferencesChanged('sceneSearch.seekStepSeconds');
      },
      onSeek:delta=>this._onSeekRelative(delta),
      onCompactChange:()=>this.controller.onPreferencesChanged('sceneSearch.seekStepSeconds'),
      onMenuChange:open=>{
        if(this._disposed){return;}
        this.idleLimiter.pause('step-menu',open);
        if(open){this.interaction.previewEnter();}
        else{this.interaction.previewLeave();}
      },
      onError:error=>this._onError(error,'sceneSearch.seekStepSeconds')
    });
    step.mount(actionList);
    this._stepWidget=step;
    const searchPanel=new C.CommentSearchPanel({
      document:this.document,search:this.commentSearch
    });
    searchPanel.mount(root);
    this._commentPanel=searchPanel;
    this.router.seekStepControl=step;
    this.router.commentSearchPanel=searchPanel;
    const enter=()=>this.interaction.previewEnter();
    const leave=()=>this.interaction.previewLeave();
    const focusin=()=>this.interaction.previewFocus(true);
    const focusout=e=>{
      if(!root.contains(e.relatedTarget)){this.interaction.previewFocus(false);}
    };
    for(const [event,handler] of [
      ['mouseenter',enter],['mouseleave',leave],
      ['focusin',focusin],['focusout',focusout]
    ])root.addEventListener(event,handler);
    this._cardCleanup=()=>{
      for(const [event,handler] of [
        ['mouseenter',enter],['mouseleave',leave],
        ['focusin',focusin],['focusout',focusout]
      ])root.removeEventListener(event,handler);
    };
    this._visibility=C.VisibilityRegistry.connect(this.config,root,'scene');
    this.refreshSharedThumbnail();
  }
  _releaseCard(card) {
    if(this._active!==card){return;}
    this._restoreSharedThumbnail();
    this._cardCleanup?.();
    this._cardCleanup=null;
    this._visibility?.dispose?.();
    this._visibility=null;
    this._commentPanel?.dispose?.();
    this._commentPanel=null;
    this._stepWidget?.dispose?.();
    this._stepWidget=null;
    this.router.seekStepControl=null;
    this.router.commentSearchPanel=null;
    this._active=null;
  }
  refreshSharedThumbnail() {
    if(this._disposed||!this._active?.root||!this._getThumbnailElement){
      return false;
    }
    let node;
    try{node=this._getThumbnailElement();}
    catch(error){
      this._restoreSharedThumbnail();
      this._hideLegacyTooltip();
      this._onError(error,'existing-seek-thumbnail');
      return false;
    }
    if(!node||!node.parentNode){
      this._restoreSharedThumbnail();
      this._hideLegacyTooltip();
      return false;
    }
    const slot=this._active.root.querySelector('.zenzaSceneImageBox');
    if(!slot){return false;}
    if(this._sharedThumbnail?.node===node&&slot.contains(node)){return true;}
    if(!node.querySelector?.('canvas')){return false;}
    this._restoreSharedThumbnail();
    const parent=node.parentNode,nextSibling=node.nextSibling;
    slot.appendChild(node); // Move the original worker canvas, never clone it.
    this._sharedThumbnail={node,parent,nextSibling};
    slot.querySelector('.zenzaSceneImage')?.setAttribute('hidden','');
    slot.querySelector('.zenzaSceneImagePlaceholder')?.setAttribute('hidden','');
    this._hideLegacyTooltip();
    return true;
  }
  _restoreSharedThumbnail() {
    const old=this._sharedThumbnail;
    if(old){
      if(old.parent?.insertBefore){
        if(old.nextSibling?.parentNode===old.parent){
          old.parent.insertBefore(old.node,old.nextSibling);
        }else{old.parent.appendChild(old.node);}
      }
      this._sharedThumbnail=null;
      const slot=this._active?.root?.querySelector('.zenzaSceneImageBox');
      const image=slot?.querySelector('.zenzaSceneImage');
      const placeholder=slot?.querySelector('.zenzaSceneImagePlaceholder');
      const hasImage=!!image?.getAttribute('src');
      if(image){image.hidden=!hasImage;}
      if(placeholder){placeholder.hidden=hasImage;}
    }
  }
  _hideLegacyTooltip() {
    const tooltip=this._legacyTooltipElement;
    if(!tooltip?.style||this._legacyTooltipOriginal){return;}
    this._legacyTooltipOriginal={
      hidden:tooltip.hidden,
      display:tooltip.style.getPropertyValue('display'),
      priority:tooltip.style.getPropertyPriority('display')
    };
    tooltip.hidden=true;
    tooltip.style.setProperty('display','none','important');
  }
  _restoreLegacyTooltip() {
    const tooltip=this._legacyTooltipElement,previous=this._legacyTooltipOriginal;
    if(tooltip?.style&&previous){
      if(previous.display){
        tooltip.style.setProperty('display',previous.display,previous.priority);
      }else{tooltip.style.removeProperty('display');}
      tooltip.hidden=previous.hidden;
    }
    this._legacyTooltipOriginal=null;
  }
  _syncCommentPreviewVisibility() {
    const node=this._commentPreviewElement;
    if(!node?.style){return;}
    const visible=this.config.getValue('sceneSearch.commentPreviewVisible')!==false;
    if(!visible){
      if(!this._commentPreviewOriginal){
        this._commentPreviewOriginal={
          hidden:node.hidden,
          display:node.style.getPropertyValue('display'),
          priority:node.style.getPropertyPriority('display')
        };
      }
      // CSS :hover can override [hidden]; inline !important is essential.
      node.hidden=true;
      node.style.setProperty('display','none','important');
    }else{
      this._restoreCommentPreviewVisibility();
    }
  }
  _restoreCommentPreviewVisibility() {
    const node=this._commentPreviewElement;
    const old=this._commentPreviewOriginal;
    if(!node?.style||!old){return;}
    if(old.display){node.style.setProperty('display',old.display,old.priority);}
    else{node.style.removeProperty('display');}
    node.hidden=old.hidden;
    this._commentPreviewOriginal=null;
  }
  start(mode='normal') {
    if(this._disposed){throw new Error('Integration bridge disposed');}
    if(this._running){return this.controller.snapshot;}
    this._running=true;
    const style=this.document.createElement('style');
    style.dataset.scuiBridgeStyle='1';
    style.textContent=SceneSearchIntegrationBridge.CSS;
    this.document.head.appendChild(style);
    this._style=style;
    try{
      this._hideLegacyTooltip();
      this.controller.start(mode);
      for(const [event,handler] of Object.entries(this._seekListeners)){
        this.seekElement.addEventListener(event,handler);
      }
      const keys=['sceneSearch.layout.normal','sceneSearch.layout.fullscreen',
        'sceneSearch.layout.linkFullscreen','sceneSearch.seekStepSeconds',
        'sceneSearch.commentPreviewVisible','sceneSearch.idleHideSeconds',
        'sceneSearch.controlsReveal','sceneSearch.animation'];
      if(typeof this.config.onkey==='function'){
        for(const key of keys){
          const callback=()=>{
            this.controller.onPreferencesChanged(key);
            if(key==='sceneSearch.commentPreviewVisible'){
              this._syncCommentPreviewVisibility();
            }
            if(key==='sceneSearch.idleHideSeconds')this.interaction.idlePreferencesChanged();
            if(key==='sceneSearch.seekStepSeconds')this._stepWidget?.updateFromConfig();
          };
          this.config.onkey(key,callback);
          this._subscriptions.push([key,callback]);
        }
      }
      this._syncCommentPreviewVisibility();
    }catch(error){
      this.dispose();
      throw error;
    }
    return this.controller.snapshot;
  }
  setMode(mode){
    this._clearPointers();
    this.interaction.reset();
    return this.controller.setMode(mode);
  }
  setVideo(videoId){
    this._clearPointers();
    this.interaction.reset();
    this.commentSearch.reset();
    return this.controller.onVideoChange(videoId);
  }
  setTime(seconds){return this.controller.setTime(seconds);}
  previewAt(seconds,token){
    const promise=this.controller.previewAt(seconds);
    return Promise.resolve(promise).then(ok=>{
      if(ok && token!==undefined)this.interaction.thumbnailChanged(token);
      return ok;
    });
  }
  get state(){return this.controller.snapshot;}
  handleShortcut(command){return this.router.handle(command);}
  dispose(){
    if(this._disposed){return;}
    this._clearPointers();
    this._disposed=true;
    this._restoreSharedThumbnail();
    this._restoreLegacyTooltip();
    this._restoreCommentPreviewVisibility();
    if(this._running){
      for(const [event,handler] of Object.entries(this._seekListeners)){
        this.seekElement.removeEventListener(event,handler);
      }
    }
    this.interaction.dispose();
    this.controller.dispose();
    this.commentSearch.dispose();
    if(typeof this.config.offkey==='function'){
      for(const [key,handler] of this._subscriptions){
        this.config.offkey(key,handler);
      }
    }
    this._subscriptions.length=0;
    this._style?.remove();
    this._style=null;
    this._running=false;
  }
  static get CSS(){
    return `
/* The original seekbar remains the sole seek click owner. */
.zenzaSceneSearchHost[data-scene-animation="off"],
.zenzaSceneSearchHost[data-scene-animation="off"] *{transition:none!important;animation:none!important}
.zenzaSceneSearchHost[data-scene-animation="full"] .zenzaSceneBtn{transition-duration:.22s}
.zenzaSceneSearchHost[data-scene-reveal="always"] .zenzaSceneActions,
.zenzaSceneSearchHost[data-scene-reveal="always"] .zenzaSceneBtn{
 opacity:1!important;visibility:visible!important;pointer-events:auto!important;transform:none!important
}
.zenzaSceneSearchHost[data-scene-reveal="click"]:not(.is-expanded):not(.is-pinned) :is(.scene-pin,.scene-comment-toggle,.scene-comment-search,.scene-seek-step),
.zenzaSceneEdgeDrawer[data-scene-reveal="click"]:not(.is-expanded):not(.is-pinned) .zenzaSceneActions{
 opacity:0!important;visibility:hidden!important;pointer-events:none!important
}
.zenzaSceneSearchHost .zenzaSceneActions > .zenzaSceneSeekStepControl
 >[data-scui="back"],
.zenzaSceneSearchHost .zenzaSceneActions > .zenzaSceneSeekStepControl
 >[data-scui="forward"],
.zenzaSceneSearchHost .zenzaSceneActions > .zenzaSceneSeekStepControl
 >[data-scui="open"]{display:none!important}
.zenzaSceneSearchHost .zenzaSceneSeekStepControl .zenzaSceneStepPopup{
 position:absolute;min-width:164px;max-width:min(280px,calc(100vw - 24px));
 bottom:calc(100% + 6px);right:0;
 padding:7px;z-index:320;background:#101824;color:#fff;
 border:1px solid #64748b;border-radius:6px;
 box-shadow:0 8px 20px #0009
}
.zenzaSceneSearchHost .zenzaSceneStepPopup[hidden]{display:none!important}
.zenzaSceneSearchHost .zenzaSceneStepPresets{display:grid;grid-template-columns:repeat(4,1fr);gap:4px}
.zenzaSceneSearchHost .zenzaSceneStepPopup button{cursor:pointer}
.zenzaSceneSearchHost.is-idle-suppressed{display:none!important}
`;
  }
}
//===END===
export {SceneSearchIntegrationBridge};