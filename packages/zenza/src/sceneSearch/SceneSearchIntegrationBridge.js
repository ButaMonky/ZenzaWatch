// SCUI-18 bridge prototype. Not imported by ZenzaWatch until Task424 QA.
// The legacy seekbar remains owner of media input/hit testing. This bridge
// reads events and mounts the selected standalone scene card only.
//===BEGIN===
class SceneSearchIntegrationBridge {
  constructor({classes,document,container,seekElement,commentPreviewElement,
    legacyTooltipElement,getThumbnailElement,config,registry,clock,layoutSettings,
    getChats,getSeekTime,onSeekRelative,onSeekAbsolute,loadPreview,onError,createCommentList}={}) {
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
    // Pointer coordinates are measured against the real seekbar, not against
    // the video duration or the width of the whole player container.
    this._seekClientX=null;
    this._commentPreviewElement=commentPreviewElement||null;
    this._commentPreviewOriginal=null;
    this._commentDock=null;
    this._createCommentList=createCommentList||null;
    this._twinList=null;
    this._twinListCleanup=null;
    this._commentHoverCleanup=null;
    this._legacyTooltipElement=legacyTooltipElement||null;
    this._legacyTooltipOriginal=null;
    this._getThumbnailElement=typeof getThumbnailElement==='function'?
      getThumbnailElement:null;
    this._sharedThumbnail=null;
    this.config=config;
    this.registry=registry;
    this.layoutSettings={...(layoutSettings||{}),
      getSeekGeometry:()=>this._getSeekGeometry(),
      getSeekGeometryUnclipped:()=>this._getSeekGeometry(true),
      getLegacyTooltip:()=>this._legacyTooltipElement,
      getLegacyComment:()=>this._commentPreviewElement,
      getMiniCommentMode:()=>this.config.getValue('sceneSearch.miniCommentMode'),
      ...(config.resolveSceneSearch?{getAppearance:()=>config.resolveSceneSearch()}:{}),
      getThumbnail:()=>this._getThumbnailElement?.(),
      getSeekBarContainer:()=>this.seekElement.closest?.('.seekBarContainer')||null};
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
    this._placementContext='normal';this._placementGeometry=null;this._placementHold=false;
    this._seekListeners={
      mouseenter:e=>{
        this._seekClientX=Number.isFinite(e?.clientX)?e.clientX:null;
        this.interaction.seekEnter(e);
      },
      mousemove:e=>{
        this._seekClientX=Number.isFinite(e?.clientX)?e.clientX:null;
        this.interaction.seekMove(e);
        const seconds=this._getSeekTime?.(e);
        if(Number.isFinite(seconds)&&seconds>=0){this.controller.setTime(seconds);}
      },
      mouseleave:e=>{
        this.interaction.seekLeave(e);
        // Retain the last seek anchor while travelling to preview controls.
      },
      pointerdown:e=>this._startPointer(e)
    };
    this.controller=new classes.Controller({
      getPreference:key=>config.getValue(key),
      resolvePreferences:config.resolveSceneSearch?()=>config.resolveSceneSearch():null,
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
      getPreviewRect:()=>this._previewRects(),
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
      setPreference:(key,value)=>key.startsWith('sceneSearch.')&&typeof config.persistSceneSearchSelection==='function'?
        config.persistSceneSearchSelection({[key]:value}):config.setValue(key,value),
      onToggleControls:()=>this._active?.root?.classList.toggle('is-expanded'),
      onError:(error,key)=>this._onError(error,key)
    });
  }
  _getSeekGeometry(unclipped=false) {
    const seek=this.seekElement.getBoundingClientRect?.();
    const frame=this.container.getBoundingClientRect?.();
    if(!seek||!frame||!Number.isFinite(seek.left)||
       !Number.isFinite(seek.width)||seek.width<=0||
       !Number.isFinite(frame.left)||!Number.isFinite(frame.width)||
       frame.width<=0){return null;}
    const width=this.container.offsetWidth||frame.width;
    const scale=width/frame.width;
    const viewportWidth=this.document.defaultView?.innerWidth;
    // Only UI01 uses unclipped screen bounds for a full-width seekRange.
    // Preserve the old video-box clamps for layouts 02..10.
    const visibleLeft=Number.isFinite(viewportWidth)?
      (unclipped?-frame.left*scale:Math.max(0,-frame.left*scale)):0;
    const visibleRight=Number.isFinite(viewportWidth)?
      (unclipped?(viewportWidth-frame.left)*scale:
        Math.min(width,(viewportWidth-frame.left)*scale)):width;
    return {
      seekLeft:(seek.left-frame.left)*scale,
      seekWidth:seek.width*scale,
      pointerX:Number.isFinite(this._seekClientX)?
        (this._seekClientX-frame.left)*scale:null,
      visibleLeft,visibleRight
    };
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
    if(active || this._running){this.interaction.setDragging(false);this._resumePlacement();}
  }
  _createLayout({id,mode}) {
    this._placementGeometry=null;this._placementResult=null;
    if(id==='follow'||id==='fixed')return this._createModernLayout({id,mode});
    if(id==='legacy')id='00';
    const card=this.registry.create({id,mode,document:this.document,
      container:this.container,settings:this.layoutSettings,
      onAction:(action,ctx,event)=>this._onCardAction(action,ctx,event)});
    const wired={
      get root(){return card.root;},
      mount:state=>{
        if(id==='00'){
          this._restoreSharedThumbnail();
          this._restoreCommentPreviewDock();
          this._restoreLegacyTooltip();
        }
        card.mount(state);
        if(id==='00'){
          this._active=card;
          this._mountLegacyControls(card);
          return;
        }
        this._hideLegacyTooltip();
        if(id!=='01'&&id!=='02'){
          this.container.dataset.sceneSearchLayout=id;
          this.container.dataset.sceneMode=mode;
        }
        this._active=card;
        try{this._mountCardControls(card);}catch(error){
          this._releaseCard(card);card.dispose();throw error;
        }
      },
      renderTime:state=>wired.render(state,true),
      render:(state,timeOnly=false)=>{
        card.render(state);
        if(id==='00')return; // Original tooltip/comment renderer owns UI00.
        // The original VideoControlBar already advances flowing mini rows
        // on mousemove. Leave its DOM untouched on time-only renders. A
        // separately docked list still needs the card's updated position.
        if(!timeOnly||state.commentListMode===true){
          this._syncCommentPreviewDock(card,state);
        }
        if(id==='02'){
          const player=this.container.getBoundingClientRect?.();
          const windowHeight=this.document.defaultView?.innerHeight;
          const width=player?.width||this.container.clientWidth||800;
          const room=Number.isFinite(windowHeight)&&Number.isFinite(player?.bottom)?
            windowHeight-player.bottom:0;
          const enough=mode==='normal'&&room>=230;
          this.container.dataset.scenePlacement=enough?'below':'visible-fallback';
          this._updateTwinCommentPlacement(enough,player);
        }
        if(id!=='01'&&id!=='02'){
          const width=this.container.offsetWidth||
            this.container.getBoundingClientRect?.().width||
            this.container.clientWidth||800;
          this.container.dataset.sceneNarrow=String(width<580);
          this.container.dataset.sceneWide=String(width>=980);
          this.container.dataset.scenePlacement=
            card.root?.dataset.scuiPlacement||'overlay';
          if(id==='10'){
            const raw=Number.parseFloat(card.root?.style.getPropertyValue('--scene-x'));
            this.container.dataset.sceneCommentSide=Number.isFinite(raw)&&
              raw>width*.55?'left':'right';
          }
        }
        if(!timeOnly)this._visibility?.refresh?.();
        if(card.root&&!timeOnly){
          const reveal=this.config.getValue('sceneSearch.controlsReveal');
          const animation=this.config.getValue('sceneSearch.animation');
          card.root.dataset.sceneReveal=['click','always'].includes(reveal)?reveal:'hover-focus';
          card.root.dataset.sceneAnimation=['off','full'].includes(animation)?animation:'subtle';
        }
      },
      onPreview:(asset,request)=>{
        if(id==='00')return; // Existing seekbar still owns storyboard canvas.
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
        if(id==='00'){
          this._cardCleanup?.();
          this._cardCleanup=null;
          card.dispose(); // restores the exact original seekbar/comment owners
          if(this._active===card)this._active=null;
          return;
        }
        this._restoreCommentPreviewDock();
        this._releaseCard(card);
        card.dispose();
        if(id==='02'){
          delete this.container.dataset.scenePlacement;
          this.container.style.removeProperty('--scui-twin-comment-top');
        }
        if(id!=='01'&&id!=='02'&&
          this.container.dataset.sceneSearchLayout===id){
          delete this.container.dataset.sceneSearchLayout;
          delete this.container.dataset.sceneMode;
          delete this.container.dataset.sceneNarrow;
          delete this.container.dataset.sceneWide;
          delete this.container.dataset.scenePlacement;
          delete this.container.dataset.sceneCommentSide;
        }
      }
    };
    return wired;
  }
  _createModernLayout({id,mode}){
    const d=this.document,portal=d.createElement('div');
    // The native player disables input/animation on non-player body children.
    // This portal owns player controls even when it is outside the dialog DOM.
    portal.className='zenzaScenePreviewPortal zen-family';
    portal.style.cssText='position:fixed;inset:0;pointer-events:none;z-index:2147483000;';
    (d.fullscreenElement||d.body).append(portal);
    // Native row actions (seek / NG) still enter the original player dispatcher.
    portal.addEventListener('command',event=>{
      event.stopPropagation();
      this.container.dispatchEvent(new d.defaultView.CustomEvent('command',{detail:event.detail,bubbles:true,composed:true}));
    });
    const card=this.registry.create({id,mode,document:d,container:portal,settings:this.layoutSettings,
      onAction:(action,ctx,event)=>this._onCardAction(action,ctx,event)});
    let list=null;
    const render=state=>{
      const prefs=this.config.resolveSceneSearch();
      if(prefs.listOpen&&!list&&this._createCommentList){
        list=this._createCommentList(portal);card.setListView(list);
      }
      const returnListFocus=!prefs.listOpen&&card.root?.querySelector('.zenzaSceneListSlot')?.contains(d.activeElement);
      if(!prefs.listOpen)this._commentPanel?.close();
      card.render({...state,...prefs});
      if(returnListFocus)card.root.querySelector('[data-scui-action="comment-toggle"]')?.focus();
      if(card.root){
        card.root.dataset.sceneReveal=this.config.getValue('sceneSearch.controlsReveal')||'hover-focus';
        card.root.dataset.sceneAnimation=this.config.getValue('sceneSearch.animation')||'subtle';
      }
      this._visibility?.refresh?.();
      this._placeModern(card,state);
      if(!state.shown&&!state.pinned)this.interaction?.clearCorridor?.();
    };
    return {get root(){return card.root;},
      mount:()=>{try{
        card.mount();this._active=card;this._modernPortal=portal;
        this._hideLegacyTooltip();this._mountCardControls(card);
      }catch(error){this._releaseCard(card);card.dispose();portal.remove();throw error;}},
      render,renderTime:render,onPreview:()=>this.refreshSharedThumbnail(),
      dispose:()=>{
        this._releaseCard(card);card.dispose();portal.remove();
        this._modernPortal=null;this._placementResult=null;this._placementGeometry=null;
      }};
  }
  updatePlacementContext({context='normal',interactionActive=false}={}){
    if(this._disposed)return;
    this._placementContext=['normal','small','fullscreen'].includes(context)?context:'normal';
    this._placementHold=interactionActive;
    this._placementGeometry=null;
    this.idleLimiter.pause('player-manipulation',interactionActive);
    if(this._active?.fit)this._placeModern(this._active,this.controller.snapshot);
  }
  _placeModern(card,state){
    if(!card.root||!this._classes.Placement)return;
    const d=this.document,win=d.defaultView,portal=this._modernPortal;
    const parent=d.fullscreenElement||d.body;
    if(portal&&portal.parentNode!==parent)parent.append(portal);
    if(!this._placementGeometry){
      const player=(this.container.querySelector('.videoPlayer')||this.container).getBoundingClientRect();
      const seekbar=this.seekElement.getBoundingClientRect();
      const obstacles=[];
      for(const node of this.container.querySelectorAll(
        '.commentInputPanel,.commandDrawer,.commandPopover,.commandMenu,.commandList,.zenzaSmallModeResizeHandle,.zenzaSmallModeResetButton,.zenzaSmallModeAspectLockButton,.closeButton,.zenzaSmallModeCloseButton')){
        const css=win.getComputedStyle(node),rect=node.getBoundingClientRect();
        if(!node.hidden&&css.display!=='none'&&css.visibility!=='hidden'&&css.opacity!=='0'&&rect.width>0&&rect.height>0)obstacles.push(rect);
      }
      const origin=portal?.getBoundingClientRect()||{left:0,top:0,width:0,height:0};
      this._placementGeometry={player,seekbar,obstacles,origin,
        viewport:{left:0,top:0,width:win.innerWidth,height:win.innerHeight}};
    }
    const g=this._placementGeometry,prefs=this.config.resolveSceneSearch();
    const hold=this._placementHold||state.pinned||this.interaction?.holdingPreview===true;
    const input={...g,layout:state.layoutId,context:this._placementContext,
      imageSize:{width:180,height:90},requestedScale:prefs.scale,listOpen:prefs.listOpen,
      anchorX:this._seekClientX??g.seekbar.left+g.seekbar.width/2,previous:this._placementResult,hold};
    let result=this._classes.Placement.compute(input);
    if(card.measureFooter)result=this._classes.Placement.compute({...input,footerHeight:card.measureFooter(result.imageScale)});
    this._placementResult=result;card.fit(result);
    const x=g.origin.width&&portal?.clientWidth?portal.clientWidth/g.origin.width:1;
    const y=g.origin.height&&portal?.clientHeight?portal.clientHeight/g.origin.height:1;
    card.root.style.left=(result.rect.left-g.origin.left)*x+'px';
    card.root.style.top=(result.rect.top-g.origin.top)*y+'px';
    card.root.style.width=result.rect.width+'px';card.root.style.height=result.rect.height+'px';
    card.root.style.transformOrigin='0 0';card.root.style.transform='scale('+x+','+y+')';
    card.root.dataset.sceneContext=this._placementContext;
  }
  _updateTwinCommentPlacement(below,player){
    if(!below||!player){
      this.container.style.removeProperty('--scui-twin-comment-top');
      return;
    }
    const comment=this._twinList?.element||this._commentPreviewElement;
    const owner=comment?.offsetParent||comment?.parentElement;
    const origin=owner?.getBoundingClientRect?.();
    if(!origin||!Number.isFinite(origin.top)||!Number.isFinite(player.bottom)){
      return;
    }
    const scale=origin.width&&owner.offsetWidth?
      owner.offsetWidth/origin.width:1;
    const top=(player.bottom-origin.top)*scale+15;
    if(Number.isFinite(top)){
      this.container.style.setProperty('--scui-twin-comment-top',
        Math.round(Math.max(0,top))+'px');
    }
  }
  _onCardAction(action,context) {
    if(action==='more'){this._resumePlacement();return;}
    if(action==='comment-toggle'){
      if(this.config.resolveSceneSearch?.()?.listAllowed===false)return;
      // Legacy tooltip button selects flowing/list mode, NOT global visibility.
      this.config.setValue('enableCommentPreview',
        this.config.getValue('enableCommentPreview')!==true);
      this.controller.onPreferencesChanged('enableCommentPreview');
      return;
    }
    if(action==='frame-seek'){
      const seconds=context?.time;
      if(!Number.isFinite(seconds)||seconds<0){return;}
      const duration=typeof this.layoutSettings.getDuration==='function'?
        this.layoutSettings.getDuration():this.layoutSettings.duration;
      this._onSeekAbsolute(Number.isFinite(duration)&&duration>0?
        Math.min(seconds,duration):seconds);
      return;
    }
    const commands={
      'seek-back':'sceneSearch-seekBack',
      'seek-forward':'sceneSearch-seekForward',
      pin:'sceneSearch-togglePin',
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
    if(root.dataset.layout==='02'){
      // Keep the expander accessible when the twin-panel action tray is
      // collapsed below the preview card. Do not edit Task532's provider.
      const foot=root.querySelector('.zenzaSceneFoot');
      const more=actionList.querySelector('.scene-more');
      if(foot&&more)foot.insertBefore(more,actionList);
    }
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
        if(open){this.interaction.previewEnter('step-menu');}
        else{
          this.interaction.previewLeave('step-menu');
          // Some DOM hosts retain activeElement inside a newly hidden popup.
          // Release only that stale focus, preserving any visible control.
          const focused=this.document.activeElement;
          if(root.contains(focused)&&focused.closest('[hidden]')){
            this.interaction.previewFocus(false,root);
          }
        }
      },
      onError:error=>this._onError(error,'sceneSearch.seekStepSeconds')
    });
    const modern=root.classList.contains('zenzaSceneSharedPreview');
    // Modern controls use the shared seek commands; seconds stay in settings.
    // Retain the step model for existing keyboard shortcuts, without its popup.
    if(modern)step.updateFromConfig();else step.mount(actionList);
    this._stepWidget=step;
    const searchPanel=new C.CommentSearchPanel({
      document:this.document,search:this.commentSearch,
      onOpenChange:open=>{
        const button=root.querySelector('[data-scui-action="comment-search"]');
        button?.setAttribute('aria-expanded',String(open));
        if(!open&&searchPanel.root?.contains(this.document.activeElement))button?.focus();
      }
    });
    searchPanel.mount(modern?root.querySelector('.zenzaSceneListSlot'):root);
    this._commentPanel=searchPanel;
    this.router.seekStepControl=step;
    this.router.commentSearchPanel=modern?{toggle:()=>{
      if(this.config.resolveSceneSearch().listAllowed===false)return;
      if(this.config.getValue('enableCommentPreview')!==true)this.config.setValue('enableCommentPreview',true);
      searchPanel.toggle();
    }}:searchPanel;
    this._cardCleanup=this._bindPreviewSurface(root);
    this._visibility=C.VisibilityRegistry.connect(this.config,root,'scene');
    this.refreshSharedThumbnail();
  }
  _mountLegacyControls(card) {
    // UI00 deliberately has no new scene card. Its native seek tooltip
    // buttons and the separate scrollable CommentPreview are still controls:
    // hovering/focusing either must pause BOTH leave/corridor and idle timers.
    const nodes=[card?.root,this._commentPreviewElement].filter(Boolean);
    let hovered=false,focused=false,active=false;
    const owns=node=>nodes.some(root=>root===node||root.contains?.(node));
    const sync=()=>{
      const next=hovered||focused;
      if(next===active)return;
      active=next;
      if(next)this.interaction.previewEnter();
      else this.interaction.previewLeave();
    };
    const onEnter=()=>{hovered=true;sync();};
    const onLeave=e=>{
      if(owns(e?.relatedTarget))return;
      hovered=false;sync();
    };
    const onFocusIn=()=>{focused=true;sync();};
    const onFocusOut=e=>{
      if(owns(e?.relatedTarget))return;
      focused=false;sync();
    };
    const bindings=[
      ['mouseenter',onEnter],['mouseleave',onLeave],
      ['focusin',onFocusIn],['focusout',onFocusOut]
    ];
    for(const node of nodes)for(const [key,handler] of bindings){
      node.addEventListener(key,handler);
    }
    this._cardCleanup=()=>{
      for(const node of nodes)for(const [key,handler] of bindings){
        node.removeEventListener(key,handler);
      }
      if(active){active=false;this.interaction.previewLeave();}
    };
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
    if(this._active?.setImage){
      this._active.setImage(this._getThumbnailElement?.()||null);
      return true;
    }
    if(['00','legacy'].includes(this.controller.snapshot.layoutId)){
      // The legacy StoryboardWorker can create its 160x90 canvas after mount.
      // Retry attachment of the original flowing-comment DOM at that moment.
      this._active?.render?.(this.controller.snapshot);
      return false;
    }
    // The same storyboard update must refresh UI07 side frames even when
    // the shared central canvas itself is already mounted.
    if(!this._disposed&&this.controller.snapshot.layoutId==='07'){
      this.controller.onPreferencesChanged('sceneSearch.idleHideSeconds');
    }
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
  _resumePlacement(){
    if(!this._disposed&&this._active?.fit)this._placeModern(this._active,this.controller.snapshot);
  }
  _bindPreviewSurface(node) {
    let pointerFocus=false;
    const enter=()=>{this.interaction.previewEnter(node);this._resumePlacement();};
    const leave=e=>{
      const active=this.document.activeElement;
      // Clicked buttons retain DOM focus after the mouse leaves. That is not
      // continued keyboard interaction and must not freeze following or idle.
      // Editable search fields and keyboard navigation keep their focus hold.
      const editing=active?.closest?.('input,textarea,select,[contenteditable]:not([contenteditable="false"])');
      if(pointerFocus&&node.contains(active)&&!editing){
        active.blur?.();this.interaction.previewFocus(false,node);
      }
      this.interaction.previewLeave(node,e);this._resumePlacement();
    };
    const focus=()=>{this.interaction.previewFocus(true,node);this._resumePlacement();};
    const blur=e=>{
      if(!node.contains(e.relatedTarget)){this.interaction.previewFocus(false,node);this._resumePlacement();}
    };
    const pointer=e=>{pointerFocus=true;this._startPointer(e);};
    const keyboard=()=>{pointerFocus=false;};
    // Tab can enter this surface from outside, before it receives key events.
    this.document.addEventListener('keydown',keyboard,true);
    const listeners=[['mouseenter',enter],['mouseleave',leave],['focusin',focus],['focusout',blur],
      ['pointerdown',pointer]];
    for(const [event,fn] of listeners)node.addEventListener(event,fn);
    return ()=>{
      this.document.removeEventListener('keydown',keyboard,true);
      for(const [event,fn] of listeners)node.removeEventListener(event,fn);
      this.interaction.previewLeave(node);
      this.interaction.previewFocus(false,node);
    };
  }
  _restoreTwinList() {
    const handle=this._twinList;
    if(!handle)return;
    this._twinList=null;
    handle.element?.classList.remove('is-scui-active');
    this._twinListCleanup?.();
    this._twinListCleanup=null;
    handle.dispose();
  }
  _previewRects() {
    if(this._active?.getRects)return this._active.getRects();
    const root=this._active?.root;
    const nodes=[root,root?.querySelector('.zenzaSceneActions'),
      root?.querySelector('.zenzaSceneRemoteControls'),this._commentPreviewElement,
      this._twinList?.element].filter(Boolean);
    const regions=[];
    for(const node of new Set(nodes)){
      if(node.hidden||node.closest('[hidden],.is-idle-suppressed'))continue;
      if(node.classList.contains('zenzaSceneCommentAttached')&&
         !node.classList.contains('is-scui-active'))continue;
      const css=this.document.defaultView?.getComputedStyle?.(node);
      if(css&&(css.display==='none'||css.visibility==='hidden'||css.opacity==='0'))continue;
      const rect=node.getBoundingClientRect?.();
      if(rect?.width>0&&rect.height>0)regions.push(rect);
    }
    return regions;
  }
  _syncCommentPreviewDock(card,state) {
    const node=this._commentPreviewElement,root=card?.root;
    if(!node||!root)return;
    if(!this._commentDock){
      // CommentPreviewView normally inherits the *player* typography.
      // Modern scene cards use 12px system-ui: reparenting its original DOM
      // silently changed every 16px mini row and broke alignment/CA spaces.
      // Snapshot the native computed typography BEFORE the first move.
      const computed=this.document.defaultView?.getComputedStyle?.(node);
      const props=['font-family','font-size','line-height',
        'font-weight','letter-spacing','word-spacing'];
      const typography=props.map(name=>({
        name,value:node.style.getPropertyValue(name),
        priority:node.style.getPropertyPriority(name),
        native:computed?.getPropertyValue(name)||''
      }));
      this._commentDock={parent:node.parentNode,next:node.nextSibling,
        typography};
      for(const {name,native} of typography){
        if(native)node.style.setProperty(name,native);
      }
      this._commentHoverCleanup=this._bindPreviewSurface(node);
    }
    const listRequested=this.config.getValue('enableCommentPreview')===true;
    const twin=root.dataset.layout==='02'&&typeof this._createCommentList==='function';
    if(twin&&listRequested&&!this._twinList){
      this._twinList=this._createCommentList(this.container)||null;
      if(this._twinList?.element){
        const panel=this._twinList.element;
        panel.classList.add('zenzaSceneTwinList','zenzaSceneCommentAttached','is-scui-list');
        panel.tabIndex=0;
        panel.setAttribute('aria-label','シーンのコメント一覧');
        for(const {name,native} of this._commentDock.typography||[]){
          if(native)panel.style.setProperty(name,native);
        }
        this._twinListCleanup=this._bindPreviewSurface(panel);
      }
    }
    if(!listRequested)this._restoreTwinList();
    const list=listRequested&&!(twin&&this._twinList);
    const classic=root.dataset.layout==='01';
    // Task728: the ORIGINAL CommentPreviewView flows ON TOP of the
    // storyboard image in UI01. ONLY the scrollable LIST moves to the right
    // sibling pane. Never clone native chat rows or replace their animation.
    const image=root.querySelector('.zenzaSceneImageBox');
    const target=classic?(list?root:image):
      list?this.container:image;
    if(target&&node.parentNode!==target)target.appendChild(node);
    node.classList.add('zenzaSceneCommentAttached');
    node.classList.toggle('is-scui-list',list);
    node.classList.toggle('is-scui-flow',!list);
    node.classList.toggle('is-scui-classic-side',classic&&list);
    const active=(state?.shown!==false||state?.pinned===true)&&
      this.config.getValue('sceneSearch.commentPreviewVisible')!==false&&
      !root.classList.contains('is-idle-suppressed');
    node.classList.toggle('is-scui-active',active);
    if(this._twinList?.element){
      this._twinList.element.classList.toggle('is-scui-active',active&&listRequested);
    }
    if(twin){
      const toggle=root.querySelector('[data-scui-action="comment-toggle"]');
      const label=listRequested?'コメント一覧を閉じる':'コメント一覧を表示';
      toggle?.setAttribute('aria-label',label);
      toggle?.setAttribute('title',label);
      toggle?.setAttribute('aria-expanded',String(listRequested));
    }
    if(classic){
      if(list)this._positionClassicCommentSide(root,list);
      else root.dataset.scuiSidePlacement='overlay';
    }else if(list){
      const x=Number.parseFloat(root.style.getPropertyValue('--scene-x'));
      if(Number.isFinite(x))this.container.style.setProperty('--scui-list-x',x+'px');
    }
  }
  _positionClassicCommentSide(root,list) {
    const rect=root.getBoundingClientRect?.();
    const viewport=this.document.defaultView?.innerWidth||
      this.document.documentElement?.clientWidth||0;
    if(!rect||!Number.isFinite(rect.left)||!Number.isFinite(rect.right)||
      !Number.isFinite(viewport)||viewport<=0)return;
    const scale=rect.width>0&&root.offsetWidth>0?
      rect.width/root.offsetWidth:1;
    // Layout01 precomputes a group clamp and pane width with the SAME
    // viewport geometry. Reuse these values; calculating a second, different
    // clamp here caused the native comment view to leave the right edge.
    const configuredGap=Number.parseFloat(root.style.getPropertyValue('--scui-side-gap'));
    const configuredWidth=Number.parseFloat(root.style.getPropertyValue('--scui-side-width'));
    const gap=Number.isFinite(configuredGap)?configuredGap:8;
    const margin=8;
    const room=(viewport-margin-rect.right-gap*scale)/scale;
    const panelWidth=Number.isFinite(configuredWidth)&&configuredWidth>0?
      configuredWidth:Math.min(list?350:180,Math.max(1,room));
    // Never swap to the left or move above; on the right edge, the entire
    // group stops together while CommentPreviewView retains native owners.
    const cardWidth=rect.width/scale;
    const left=(root.offsetWidth||cardWidth)+gap;
    root.dataset.scuiSidePlacement='right';
    root.style.setProperty('--scui-side-left',left.toFixed(2)+'px');
    root.style.setProperty('--scui-side-width',panelWidth.toFixed(2)+'px');
    // Flow mode has no independent pane or coordinate offset. Its ORIGINAL
    // CommentPreviewView is positioned directly inside .zenzaSceneImageBox.
  }
  _restoreCommentPreviewDock(){
    this._restoreTwinList();
    const old=this._commentDock,node=this._commentPreviewElement;
    if(!old||!node)return;
    this._commentHoverCleanup?.();
    this._commentHoverCleanup=null;
    node.classList.remove('zenzaSceneCommentAttached','is-scui-flow',
      'is-scui-list','is-scui-active','is-scui-classic-side');
    if(old.parent){
      if(old.next?.parentNode===old.parent)old.parent.insertBefore(node,old.next);
      else old.parent.appendChild(node);
    }
    // UI00 and the regular VideoControlBar must not inherit any inline font
    // overrides when switching back from modern layouts.
    for(const {name,value,priority} of old.typography||[]){
      if(value)node.style.setProperty(name,value,priority);
      else node.style.removeProperty(name);
    }
    this.container.style.removeProperty('--scui-list-x');
    this._commentDock=null;
  }
  _syncCommentPreviewVisibility() {
    if(this.config.resolveSceneSearch)return; // Effective state belongs to shared view / legacy adapter.
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
  static validSavedPreference(key,value) {
    if(key==='sceneSearch.presentation.normal'||key==='sceneSearch.presentation.fullscreen')
      return ['follow','fixed','legacy'].includes(value);
    if(key==='sceneSearch.miniCommentVisible'||key==='sceneSearch.commentListVisible')return typeof value==='boolean';
    if(key==='sceneSearch.thumbnailScale')return Number.isInteger(value)&&value>=50&&value<=200;
    if(key==='sceneSearch.commentListBackgroundOpacity')return Number.isInteger(value)&&value>=0&&value<=100;
    if(key==='sceneSearch.layout.normal'||key==='sceneSearch.layout.fullscreen'){
      return typeof value==='string'&&/^(00|0[1-9]|10)$/.test(value);
    }
    if(key==='sceneSearch.miniCommentMode'){
      return ['flow','static','hidden'].includes(value);
    }
    if(key==='enableCommentPreview'||key==='sceneSearch.layout.linkFullscreen'||
      key==='sceneSearch.commentPreviewVisible'){
      return typeof value==='boolean';
    }
    if(key==='sceneSearch.seekStepSeconds'){
      return Number.isSafeInteger(value)&&value>=0&&value<=600;
    }
    if(key==='sceneSearch.idleHideSeconds'){
      return typeof value==='number'&&Number.isFinite(value)&&value>=0&&
        value<=30&&Number.isInteger(value*2);
    }
    if(key==='sceneSearch.controlsReveal')return ['hover-focus','click','always'].includes(value);
    if(key==='sceneSearch.animation')return ['off','subtle','full'].includes(value);
    return false;
  }
  _refreshSavedPreferenceViews(keys) {
    if(this._disposed||!keys.length){return;}
    const layoutKey=keys.find(key=>key.startsWith('sceneSearch.layout.')||key.startsWith('sceneSearch.presentation.'));
    this.controller.onPreferencesChanged(layoutKey||keys[0]);
    if(keys.includes('sceneSearch.commentPreviewVisible'))this._syncCommentPreviewVisibility();
    if(keys.includes('sceneSearch.idleHideSeconds'))this.interaction.idlePreferencesChanged();
    if(keys.includes('sceneSearch.seekStepSeconds'))this._stepWidget?.updateFromConfig();
  }
  _connectSavedPreferences(keys) {
    const win=this.document.defaultView,config=this.config;
    if(!win?.addEventListener||!config.storage||
      typeof config.getStorageKey!=='function'||typeof config.refresh!=='function')return;
    const allowed=new Set(keys);
    const storageKeys=new Map(keys.map(key=>[config.getStorageKey(key),key]));
    let queue=Promise.resolve();
    const sync=async requested=>{
      if(this._disposed)return;
      const changes=[],saved={},before={}; // DataStorage.refresh requires hasOwnProperty.
      // Read and validate the ENTIRE batch before mutating in-memory Config.
      // Event detail contains keys only, never trusted values or executable data.
      for(const key of requested){
        const sk=config.getStorageKey(key),raw=config.storage[sk];
        const value=raw===undefined||raw===null?config.default?.[key]:JSON.parse(raw);
        if(!SceneSearchIntegrationBridge.validSavedPreference(key,value)||
          (config.options?.validateImport&&!config.options.validateImport(key,value))){
          throw new TypeError('Invalid saved scene preference: '+key);
        }
        // Saved presence participates in migration even when the raw default is unchanged.
        const presenceSensitive=typeof config.resolveSceneSearch==='function'&&[
          'sceneSearch.presentation.normal','sceneSearch.presentation.fullscreen','sceneSearch.miniCommentVisible'
        ].includes(key);
        if(Object.is(value,config.getValue(key))&&!presenceSensitive)continue;
        saved[sk]=JSON.stringify(value);before[sk]=JSON.stringify(config.getValue(key));
        changes.push([key,value]);
      }
      if(this._disposed||!changes.length)return;
      const loaded=[];
      try{
        for(const [key] of changes){
          if(this._disposed)return;
          loaded.push(key);
          await config.refresh(key,saved); // read-only, no setValue/localStorage echo
        }
      }catch(error){
        // A failing custom storage adapter must not leave a half-applied batch.
        for(const key of loaded){
          try{await config.refresh(key,before);}catch(_){}
        }
        throw error;
      }
      if(this._disposed)return;
      this._externalSettingsBatch=true;
      try{
        config.emit?.('change',new Map(changes));
        for(const [key,value] of changes){
          config.emit?.('update',key,value);
          config.emit?.('update-'+key,value);
        }
      }finally{this._externalSettingsBatch=false;}
      this._refreshSavedPreferenceViews(changes.map(([key])=>key));
    };
    const enqueue=requested=>{
      if(this._disposed||!Array.isArray(requested))return;
      const selected=[...new Set(requested.filter(key=>allowed.has(key)))];
      if(!selected.length)return;
      // Serialized fresh reads prevent an older async save overtaking a newer one.
      queue=queue.then(()=>sync(selected)).catch(error=>{
        if(!this._disposed)this._onError(error,'saved-scene-settings');
      });
    };
    const onSaved=event=>enqueue(event.detail?.keys);
    const onStorage=event=>{
      if(event.storageArea&&event.storageArea!==config.storage)return;
      if(event.key===null){enqueue(keys);return;}
      const key=storageKeys.get(event.key);if(key)enqueue([key]);
    };
    win.addEventListener('ZenzaWatch-advanced-settings-saved',onSaved);
    win.addEventListener('storage',onStorage);
    this._savedPreferencesCleanup=()=>{
      win.removeEventListener('ZenzaWatch-advanced-settings-saved',onSaved);
      win.removeEventListener('storage',onStorage);
    };
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
      this.controller.start(mode);
      for(const [event,handler] of Object.entries(this._seekListeners)){
        // Match UI00: update follow geometry before the older bubble-phase
        // comment/thumbnail handler. Do not intercept media click ownership.
        this.seekElement.addEventListener(event,handler,event==='mousemove');
      }
      const keys=['sceneSearch.presentation.normal','sceneSearch.presentation.fullscreen',
        'sceneSearch.miniCommentVisible','sceneSearch.commentListVisible',
        'sceneSearch.thumbnailScale','sceneSearch.commentListBackgroundOpacity',
        'sceneSearch.layout.normal','sceneSearch.layout.fullscreen',
        'sceneSearch.layout.linkFullscreen','sceneSearch.seekStepSeconds',
        'sceneSearch.commentPreviewVisible','sceneSearch.miniCommentMode','sceneSearch.idleHideSeconds',
        'sceneSearch.controlsReveal','sceneSearch.animation','enableCommentPreview'];
      if(typeof this.config.onkey==='function'){
        for(const key of keys){
          const callback=()=>{
            if(this._disposed||this._externalSettingsBatch)return;
            if(key.startsWith('sceneSearch.presentation.')||key.startsWith('sceneSearch.layout.'))this.interaction.reset();
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
      this._connectSavedPreferences(keys);
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
    this._restoreCommentPreviewDock();
    this._savedPreferencesCleanup?.();
    this._savedPreferencesCleanup=null;
    this._restoreSharedThumbnail();
    this._restoreLegacyTooltip();
    this._restoreCommentPreviewVisibility();
    if(this._running){
      for(const [event,handler] of Object.entries(this._seekListeners)){
        this.seekElement.removeEventListener(event,handler,event==='mousemove');
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
    this._placementContext='normal';this._placementGeometry=null;this._placementHold=false;
    this._running=false;
  }
  static get CSS(){
    return `
/* Old seekbar-only hover rules hide previews when the pointer enters a new
   card. Reuse the actual CommentPreviewView node without cloning its data. */
.zenzaSceneSearchHost .zenzaSceneImageBox{position:relative}
.zenzaCommentPreview.zenzaSceneCommentAttached{display:none!important}
.zenzaCommentPreview.zenzaSceneCommentAttached.is-scui-active{display:block!important}
.zenzaSceneSearchHost .zenzaSceneImageBox >.zenzaCommentPreview.is-scui-flow{
  position:absolute!important;inset:0!important;
  left:0!important;right:0!important;top:0!important;bottom:0!important;
  width:100%!important;height:100%!important;max-height:none!important;
  margin:0!important;transform:none!important;overflow:hidden!important;
  /* The original thumbnail is a grid item with z-index:100; keep flowing
     mini-comments above its opaque canvas without changing the card/list layers. */
  z-index:200;background:transparent!important;border:0!important;
  pointer-events:none!important
}
.zenzaSceneSearchHost .zenzaSceneImageBox >.zenzaCommentPreview.is-scui-flow .listContainer{
  width:100%;height:100%;pointer-events:none!important
}
.zenzaCommentPreview.zenzaSceneCommentAttached.is-scui-list{
  position:absolute;z-index:250;max-height:200px;
  pointer-events:auto!important;overflow:auto;transform:none!important
}
/* UI01 FLOW: use the ORIGINAL CommentPreviewView over the actual
   storyboard canvas, not as a right-side sibling. The shared image-box
   absolute-position rule sets inset:0 and z-index:200 above the canvas.
   Preserve UI00's native rows, durations and preview-text-moving animation. */
.zenzaSceneSearchHost.zenzaSceneLayout01 .zenzaSceneImageBox
  >.zenzaCommentPreview.is-scui-flow{
  /* Same bright native UI00 mini, keep its original drop-shadow filter. */
  opacity:1!important;
  background:transparent!important;background-image:none!important;
  border:0!important;box-shadow:none!important;
  pointer-events:none!important
}
.zenzaSceneSearchHost.zenzaSceneLayout01 .zenzaSceneImageBox
  >.zenzaCommentPreview.is-scui-flow .listContainer{
  width:100%!important;height:100%!important;
  background:transparent!important;background-image:none!important;
  box-shadow:none!important
}
.zenzaSceneSearchHost.zenzaSceneLayout01 .zenzaSceneImageBox
  >.zenzaCommentPreview.is-scui-flow .listContainer>.nicoChat .text{
  animation-play-state:running!important
}
/* UI01 LIST only: the SAME native DOM becomes a separate scrollable panel
   to the RIGHT of the scene card. No side reversal or vertical fallback. */
.zenzaSceneSearchHost.zenzaSceneLayout01 >.zenzaCommentPreview.is-scui-classic-side.is-scui-list{
  position:absolute!important;
  left:var(--scui-side-left,calc(100% + 8px))!important;
  right:auto!important;top:auto!important;bottom:0!important;
  width:var(--scui-side-width,350px)!important;
  max-width:calc(100vw - 16px)!important;
  margin:0!important;transform:none!important;box-sizing:border-box;
  z-index:250;
  height:200px!important;max-height:200px!important;
  overflow:auto!important;pointer-events:auto!important;
  opacity:1!important;background:rgba(0,0,0,.96)!important
}

/* The original seekbar remains the sole seek click owner. */
/* "off" suppresses SCUI decorations across ALL layouts 01..10, never the
   native CommentPreviewView flow/list timing. The previous selector canceled
   preview-text-moving for UI02..10 even in the default non-reduced mode. */
.zenzaSceneSearchHost[data-scene-animation="off"],
.zenzaSceneSearchHost[data-scene-animation="off"]
  :not(.zenzaCommentPreview):not(.zenzaCommentPreview *){
  transition:none!important;animation:none!important
}
.zenzaSceneSearchHost[data-scene-animation="full"] .zenzaSceneBtn{transition-duration:.22s}
.zenzaSceneSearchHost[data-scene-reveal="always"] .zenzaSceneActions,
.zenzaSceneSearchHost[data-scene-reveal="always"] .zenzaSceneBtn{
 opacity:1!important;visibility:visible!important;pointer-events:auto!important
}
/* Keep the layout tray's translateX(-50%) and side-drawer transforms.
   Resetting ALL transforms clipped the 04/06 actions at the viewport edge. */
.zenzaSceneSearchHost[data-scene-reveal="always"] .zenzaSceneBtn{
 transform:none!important
}
.zenzaSceneSearchHost:not(.zenzaSceneSharedPreview)[data-scene-reveal="click"]:not(.is-expanded):not(.is-pinned) :is(.scene-pin,.scene-comment-toggle,.scene-comment-search,.scene-seek-step),
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
/* Task544: restore the original UI02 twin-panel design without touching
   the separately reserved Layout01_02/LegacyAdapter owner (Task532).
   Normal = two separate panels outside video, full = inside both edges. */
[data-scene-search-layout="02"] .zenzaSceneSearchHost.zenzaSceneLayout02{
  width:min(245px,calc(50% - 20px))!important;
}
[data-scene-search-layout="02"][data-scene-mode="normal"][data-scene-placement="below"] .zenzaSceneLayout02{
  left:12px!important;right:auto!important;top:calc(100% + 15px)!important;
  bottom:auto!important;transform:none!important;
}
[data-scene-search-layout="02"][data-scene-mode="normal"][data-scene-placement="visible-fallback"] .zenzaSceneLayout02{
  left:12px!important;right:auto!important;top:auto!important;
  bottom:94px!important;transform:none!important;
}
[data-scene-search-layout="02"][data-scene-mode="fullscreen"] .zenzaSceneLayout02{
  left:17px!important;right:auto!important;top:auto!important;
  bottom:94px!important;transform:none!important;
}
/* The per-layout action row opens below the scene card, not off its right
   edge. The visible 'more' handle stays inside .zenzaSceneFoot. */
[data-scene-search-layout="02"] .zenzaSceneLayout02 .zenzaSceneActions{
  position:absolute!important;left:8px!important;right:auto!important;
  top:calc(100% - 1px)!important;bottom:auto!important;
  width:max-content;max-width:calc(100% - 16px);
  min-width:0;display:flex;flex-flow:row wrap;justify-content:center;
  padding:5px;gap:4px;border-radius:9px;border:1px solid #536e88;
  background:#101c2c;box-shadow:0 8px 20px #0008;
  opacity:0;visibility:hidden;pointer-events:none;
  transform:translateY(-8px);
  transition:opacity .16s,transform .16s,visibility .16s;
}
[data-scene-search-layout="02"] .zenzaSceneLayout02 .zenzaSceneActions>.zenzaSceneBtn{
  position:static!important;left:auto!important;right:auto!important;
  top:auto!important;bottom:auto!important;min-width:25px;
  opacity:1;visibility:inherit;pointer-events:inherit;
  transform:none!important;
}
[data-scene-search-layout="02"] .zenzaSceneLayout02:is(:hover,:focus-within,.is-expanded,.is-pinned) .zenzaSceneActions{
  opacity:1;visibility:visible;pointer-events:auto;
  transform:translateY(0);
}
[data-scene-search-layout="02"] .zenzaSceneLayout02 .scene-more{
  position:static!important;opacity:1;visibility:visible;pointer-events:auto;
}
/* UI02 secondary native list shares the card's visibility and stays adjacent. */
[data-scene-search-layout="02"] .zenzaCommentPreview.is-scui-list{
  position:absolute;left:auto!important;right:12px!important;top:auto!important;
  bottom:94px!important;transform:none!important;
  width:min(350px,calc(50% - 20px))!important;
  max-width:calc(50% - 20px)!important;height:200px;box-sizing:border-box;
}
[data-scene-search-layout="02"][data-scene-mode="normal"][data-scene-placement="below"] .zenzaCommentPreview.is-scui-list{
  top:var(--scui-twin-comment-top,calc(100% + 15px))!important;
  bottom:auto!important;
}
[data-scene-search-layout="02"] .zenzaSceneLayout02 .zenzaSceneImageBox
 >.zenzaCommentPreview.is-scui-flow{
  background:transparent!important;opacity:1!important;
}
[data-scene-search-layout="02"] .zenzaSceneLayout02 .is-scui-flow .text{
  animation-play-state:running!important;
}
/* Task542: real comment list stays in the legacy seekbar owner; only
   selected layout's coordinates change. Keep its hover/list modes,
   click actions, scroll, visibility and other event owners untouched. */
[data-scene-search-layout="03"] .zenzaCommentPreview,
[data-scene-search-layout="04"] .zenzaCommentPreview,
[data-scene-search-layout="05"] .zenzaCommentPreview,
[data-scene-search-layout="06"] .zenzaCommentPreview,
[data-scene-search-layout="07"] .zenzaCommentPreview,
[data-scene-search-layout="08"] .zenzaCommentPreview,
[data-scene-search-layout="09"] .zenzaCommentPreview,
[data-scene-search-layout="10"] .zenzaCommentPreview{
  box-sizing:border-box;max-width:calc(100% - 24px);
  transform:none!important;
}
/* 03 right shelf / 04 top edge: comments on the opposite edge. */
[data-scene-search-layout="03"][data-scene-mode="normal"] .zenzaCommentPreview{
  left:18px!important;right:auto!important;top:auto!important;bottom:90px!important;
}
[data-scene-search-layout="03"][data-scene-mode="fullscreen"] .zenzaCommentPreview{
  left:auto!important;right:20px!important;top:auto!important;bottom:95px!important;
}
[data-scene-search-layout="04"][data-scene-mode="normal"] .zenzaCommentPreview{
  left:15px!important;right:auto!important;top:auto!important;bottom:87px!important;
}
[data-scene-search-layout="04"][data-scene-mode="fullscreen"] .zenzaCommentPreview{
  left:auto!important;right:19px!important;top:auto!important;bottom:90px!important;
}
/* 05 deck: beside the below-video controls only while there is room.
   In Zenza's viewport-filling modes, keep comments inside the player. */
[data-scene-search-layout="05"] .zenzaCommentPreview{
  left:auto!important;right:12px!important;top:auto!important;bottom:90px!important;
}
[data-scene-search-layout="05"][data-scene-mode="normal"][data-scene-placement="below"][data-scene-wide="true"] .zenzaCommentPreview{
  left:calc(50% + 280px)!important;right:auto!important;
  top:calc(100% + 9px)!important;bottom:auto!important;
  max-width:calc(50% - 20px);
}
/* 06 capsule: a separate right-hand comment list (seek card follows cursor). */
[data-scene-search-layout="06"] .zenzaCommentPreview{
  left:auto!important;right:12px!important;top:auto!important;bottom:91px!important;
}
/* 07 original filmstrip: list below video, opposite the left filmstrip.
   Fullscreen or clipped below-video layout uses the right lower overlay. */
[data-scene-search-layout="07"] .zenzaCommentPreview{
  left:auto!important;right:13px!important;top:auto!important;bottom:94px!important;
}
[data-scene-search-layout="07"][data-scene-mode="normal"][data-scene-placement="below"] .zenzaCommentPreview{
  left:auto!important;right:5px!important;top:calc(100% + 10px)!important;bottom:auto!important;
}
/* 08 drawer changes sides between normal and fullscreen. */
[data-scene-search-layout="08"][data-scene-mode="normal"] .zenzaCommentPreview{
  left:auto!important;right:12px!important;top:auto!important;bottom:87px!important;
}
[data-scene-search-layout="08"][data-scene-mode="fullscreen"] .zenzaCommentPreview{
  left:12px!important;right:auto!important;top:auto!important;bottom:91px!important;
}
/* 09 remote: separated right-side controller with comments beneath it. */
[data-scene-search-layout="09"] .zenzaCommentPreview{
  left:auto!important;right:12px!important;top:auto!important;bottom:153px!important;
}
[data-scene-search-layout="09"][data-scene-mode="normal"][data-scene-placement="below"] .zenzaCommentPreview{
  left:auto!important;right:12px!important;top:calc(100% + 74px)!important;bottom:auto!important;
}
/* 10 smart placement: put comments on the opposite side of the chosen card. */
[data-scene-search-layout="10"] .zenzaCommentPreview{
  left:auto!important;right:12px!important;top:auto!important;bottom:91px!important;
}
[data-scene-search-layout="10"][data-scene-mode="fullscreen"] .zenzaCommentPreview{
  bottom:96px!important;
}
[data-scene-search-layout="10"][data-scene-comment-side="left"] .zenzaCommentPreview{
  left:12px!important;right:auto!important;
}
/* Narrow viewports: preserve the existing 350/180px comment modes while
   preventing off-screen panels. Avoid covering a below-video filmstrip. */
[data-scene-narrow="true"][data-scene-search-layout="05"] .zenzaCommentPreview,
[data-scene-narrow="true"][data-scene-search-layout="07"] .zenzaCommentPreview,
[data-scene-narrow="true"][data-scene-search-layout="09"] .zenzaCommentPreview{
  left:12px!important;right:12px!important;
  max-width:calc(100% - 24px);
  transform:none!important;
}
[data-scene-narrow="true"][data-scene-search-layout="05"][data-scene-mode="normal"][data-scene-placement="below"] .zenzaCommentPreview{
  top:calc(100% + 111px)!important;bottom:auto!important;
}
[data-scene-narrow="true"][data-scene-search-layout="07"][data-scene-mode="normal"][data-scene-placement="below"] .zenzaCommentPreview{
  top:calc(100% + 157px)!important;bottom:auto!important;
}
[data-scene-narrow="true"][data-scene-search-layout="09"][data-scene-mode="normal"][data-scene-placement="below"] .zenzaCommentPreview{
  top:calc(100% + 112px)!important;bottom:auto!important;
}
`;
  }
}
//===END===
export {SceneSearchIntegrationBridge};
