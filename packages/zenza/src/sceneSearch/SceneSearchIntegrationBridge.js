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
    // Pointer coordinates are measured against the real seekbar, not against
    // the video duration or the width of the whole player container.
    this._seekClientX=null;
    this._commentPreviewElement=commentPreviewElement||null;
    this._commentPreviewOriginal=null;
    this._commentDock=null;
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
        this._seekClientX=null;
      },
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
    if(active || this._running){this.interaction.setDragging(false);}
  }
  _createLayout({id,mode}) {
    const card=this.registry.create({id,mode,document:this.document,
      container:this.container,settings:this.layoutSettings,
      onAction:(action,ctx,event)=>this._onCardAction(action,ctx,event)});
    return {
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
      render:state=>{
        card.render(state);
        if(id==='00')return; // Original tooltip/comment renderer owns UI00.
        this._syncCommentPreviewDock(card,state);
        if(id==='02'){
          const player=this.container.getBoundingClientRect?.();
          const windowHeight=this.document.defaultView?.innerHeight;
          const width=player?.width||this.container.clientWidth||800;
          const room=Number.isFinite(windowHeight)&&Number.isFinite(player?.bottom)?
            windowHeight-player.bottom:0;
          const enough=mode==='normal'&&room>=(width<580?300:180);
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
        this._visibility?.refresh?.();
        if(card.root){
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
  }
  _updateTwinCommentPlacement(below,player){
    if(!below||!player){
      this.container.style.removeProperty('--scui-twin-comment-top');
      return;
    }
    const comment=this._commentPreviewElement;
    const owner=comment?.offsetParent||comment?.parentElement;
    const origin=owner?.getBoundingClientRect?.();
    if(!origin||!Number.isFinite(origin.top)||!Number.isFinite(player.bottom)){
      return;
    }
    const scale=origin.width&&owner.offsetWidth?
      owner.offsetWidth/origin.width:1;
    const width=this.container.offsetWidth||player.width;
    const stack=width<580;
    const top=(player.bottom-origin.top)*scale+(stack?157:15);
    if(Number.isFinite(top)){
      this.container.style.setProperty('--scui-twin-comment-top',
        Math.round(Math.max(0,top))+'px');
    }
  }
  _onCardAction(action,context) {
    if(action==='comment-toggle'){
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
    if(this.controller.snapshot.layoutId==='00'){
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
  _syncCommentPreviewDock(card,state) {
    const node=this._commentPreviewElement,root=card?.root;
    if(!node||!root)return;
    if(!this._commentDock){
      this._commentDock={parent:node.parentNode,next:node.nextSibling};
      const enter=()=>this.interaction.previewEnter();
      const leave=()=>this.interaction.previewLeave();
      const focus=()=>this.interaction.previewFocus(true);
      const blur=e=>{
        if(!node.contains(e.relatedTarget))this.interaction.previewFocus(false);
      };
      const listeners=[['mouseenter',enter],['mouseleave',leave],
        ['focusin',focus],['focusout',blur]];
      for(const [name,handler] of listeners)node.addEventListener(name,handler);
      this._commentHoverCleanup=()=>{
        for(const [name,handler] of listeners)node.removeEventListener(name,handler);
      };
    }
    const list=this.config.getValue('enableCommentPreview')===true;
    const classic=root.dataset.layout==='01';
    // Classic follows the seek cursor, with a second adjacent pane.
    // Do not overlay the thumbnail or detach the original comment model.
    const target=classic?root:
      list?this.container:root.querySelector('.zenzaSceneImageBox');
    if(target&&node.parentNode!==target)target.appendChild(node);
    node.classList.add('zenzaSceneCommentAttached');
    node.classList.toggle('is-scui-list',list);
    node.classList.toggle('is-scui-flow',!list);
    node.classList.toggle('is-scui-classic-side',classic);
    const active=(state?.shown!==false||state?.pinned===true)&&
      this.config.getValue('sceneSearch.commentPreviewVisible')!==false&&
      !root.classList.contains('is-idle-suppressed');
    node.classList.toggle('is-scui-active',active);
    if(classic){
      this._positionClassicCommentSide(root,list);
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
    // The original classic control rail extends 29px outside the thumbnail.
    // Leave room for that rail when placing the adjacent comment panel.
    const gap=40,margin=8;
    const panelWidth=Math.min(list?350:180,Math.max(40,(viewport-2*margin)/scale));
    const sidePixels=panelWidth*scale+gap*scale;
    const roomRight=viewport-margin-rect.right;
    const roomLeft=rect.left-margin;
    let direction=roomRight>=sidePixels?'right':
      roomLeft>=sidePixels?'left':'above';
    let left;
    if(direction==='right')left=(root.offsetWidth||rect.width/scale)+gap;
    else if(direction==='left')left=-panelWidth-gap;
    else{
      const desired=rect.left+(rect.width-panelWidth*scale)/2;
      const screenLeft=Math.max(margin,Math.min(viewport-margin-panelWidth*scale,desired));
      left=(screenLeft-rect.left)/scale;
    }
    root.dataset.scuiSidePlacement=direction;
    root.style.setProperty('--scui-side-left',left.toFixed(2)+'px');
    root.style.setProperty('--scui-side-width',panelWidth.toFixed(2)+'px');
    // The thumbnail occupies only the image box; the scene card also has a
    // clock and tool rail. Align the flowing comment pane with the IMAGE,
    // not the overall card. Re-measure on each render / storyboard update.
    const imageRect=root.querySelector('.zenzaSceneImageBox')?.getBoundingClientRect?.();
    const imageTop=Number.isFinite(imageRect?.top)?
      (imageRect.top-rect.top)/scale:0;
    const imageHeight=Number.isFinite(imageRect?.height)&&imageRect.height>0?
      imageRect.height/scale:90;
    root.style.setProperty('--scui-mini-top',imageTop.toFixed(2)+'px');
    root.style.setProperty('--scui-mini-height',imageHeight.toFixed(2)+'px');
  }
  _restoreCommentPreviewDock(){
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
    this.container.style.removeProperty('--scui-list-x');
    this._commentDock=null;
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
  static validSavedPreference(key,value) {
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
    const layoutKey=keys.find(key=>key.startsWith('sceneSearch.layout.'));
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
        if(Object.is(value,config.getValue(key)))continue;
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
        this.seekElement.addEventListener(event,handler);
      }
      const keys=['sceneSearch.layout.normal','sceneSearch.layout.fullscreen',
        'sceneSearch.layout.linkFullscreen','sceneSearch.seekStepSeconds',
        'sceneSearch.commentPreviewVisible','sceneSearch.miniCommentMode','sceneSearch.idleHideSeconds',
        'sceneSearch.controlsReveal','sceneSearch.animation','enableCommentPreview'];
      if(typeof this.config.onkey==='function'){
        for(const key of keys){
          const callback=()=>{
            if(this._disposed||this._externalSettingsBatch)return;
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
/* UI01: native comment panel is a SIBLING of the image, not an overlay.
   Keep seek-thumbnail tracking unchanged; flip the side near viewport edges. */
.zenzaSceneSearchHost.zenzaSceneLayout01 >.zenzaCommentPreview.is-scui-classic-side{
  position:absolute!important;
  left:var(--scui-side-left,calc(100% + 8px))!important;
  right:auto!important;top:auto!important;bottom:0!important;
  width:var(--scui-side-width,180px)!important;
  max-width:calc(100vw - 16px)!important;
  margin:0!important;transform:none!important;box-sizing:border-box;
  z-index:160
}
.zenzaSceneSearchHost.zenzaSceneLayout01 >.zenzaCommentPreview.is-scui-classic-side.is-scui-flow{
  /* Never paint a panel behind native moving mini-comments. Preserve the
     comment text and its existing color/animation, without dimming opacity. */
  opacity:1!important;filter:none!important;
  background:transparent!important;background-image:none!important;
  border:0!important;box-shadow:none!important;
  /* The image itself is shorter than the card's image+clock+buttons. */
  top:var(--scui-mini-top,0px)!important;bottom:auto!important;
  height:var(--scui-mini-height,90px)!important;max-height:none!important;
  overflow:hidden!important;pointer-events:none!important
}
/* Native hover rules use absolute top:auto for every virtual row, so
   rows coincide at the same Y, with nth-child(8+) shifted upward by 144px.
   For UI01's independent mini-pane, lay out up to five original comment
   nodes in normal flow and keep their moving TEXT animation active. */
.zenzaSceneSearchHost.zenzaSceneLayout01 >.zenzaCommentPreview.is-scui-classic-side.is-scui-flow .listContainer{
  display:flex!important;flex-direction:column!important;
  justify-content:center!important;align-items:stretch!important;
  padding:0!important;margin:0!important;
  width:100%!important;height:100%!important;
  overflow:hidden!important;
  background:transparent!important;background-image:none!important;
  box-shadow:none!important
}
.zenzaSceneSearchHost.zenzaSceneLayout01 >.zenzaCommentPreview.is-scui-classic-side.is-scui-flow .listContainer>.nicoChat{
  position:relative!important;top:auto!important;left:auto!important;
  display:block!important;width:100%!important;
  height:18px!important;line-height:18px!important;
  flex:0 0 18px!important;
  transform:none!important;
  background:transparent!important;background-image:none!important;
  box-shadow:none!important
}
.zenzaSceneSearchHost.zenzaSceneLayout01 >.zenzaCommentPreview.is-scui-classic-side.is-scui-flow .listContainer>.nicoChat:nth-child(n+6){
  display:none!important
}
/* Compact thumbnail is only 112×63; at most three full 18px rows fit. */
.zenzaSceneSearchHost.zenzaSceneLayout01.is-compact >.zenzaCommentPreview.is-scui-classic-side.is-scui-flow .listContainer>.nicoChat:nth-child(n+4){
  display:none!important
}
.zenzaSceneSearchHost.zenzaSceneLayout01 >.zenzaCommentPreview.is-scui-classic-side.is-scui-flow .listContainer>.nicoChat .text{
  animation-play-state:running!important
}
.zenzaSceneSearchHost.zenzaSceneLayout01 >.zenzaCommentPreview.is-scui-classic-side.is-scui-list{
  height:200px!important;max-height:200px!important;
  overflow:auto!important;pointer-events:auto!important;
  opacity:1!important;background:rgba(0,0,0,.96)!important
}
.zenzaSceneSearchHost.zenzaSceneLayout01[data-scui-side-placement="above"] >.zenzaCommentPreview.is-scui-classic-side{
  top:auto!important;bottom:calc(100% + 8px)!important
}

/* The original seekbar remains the sole seek click owner. */
.zenzaSceneSearchHost[data-scene-animation="off"],
.zenzaSceneSearchHost[data-scene-animation="off"] *{transition:none!important;animation:none!important}
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
/* Task544: restore the original UI02 twin-panel design without touching
   the separately reserved Layout01_02/LegacyAdapter owner (Task532).
   Normal = two separate panels outside video, full = inside both edges. */
[data-scene-search-layout="02"] .zenzaSceneSearchHost.zenzaSceneLayout02{
  width:min(245px,calc(100% - 24px))!important;
}
[data-scene-search-layout="02"][data-scene-mode="normal"][data-scene-placement="below"] .zenzaSceneLayout02{
  left:23%!important;right:auto!important;top:calc(100% + 15px)!important;
  bottom:auto!important;transform:translateX(-50%)!important;
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
/* Preserve the real comment owner's hover/list/scroll and click behavior. */
[data-scene-search-layout="02"] .zenzaCommentPreview{
  left:auto!important;right:14px!important;top:auto!important;
  bottom:94px!important;max-width:calc(100% - 24px);
  transform:none!important;
}
[data-scene-search-layout="02"][data-scene-mode="normal"][data-scene-placement="below"] .zenzaCommentPreview{
  left:auto!important;right:15%!important;
  top:var(--scui-twin-comment-top,calc(100% + 15px))!important;
  bottom:auto!important;max-width:min(256px,calc(50% - 20px));
}
[data-scene-search-layout="02"][data-scene-narrow="true"][data-scene-mode="normal"][data-scene-placement="below"] .zenzaSceneLayout02{
  left:50%!important;transform:translateX(-50%)!important;
}
[data-scene-search-layout="02"][data-scene-narrow="true"][data-scene-mode="normal"][data-scene-placement="below"] .zenzaCommentPreview{
  left:12px!important;right:12px!important;max-width:calc(100% - 24px);
}
[data-scene-search-layout="02"][data-scene-narrow="true"][data-scene-placement="visible-fallback"] .zenzaCommentPreview,
[data-scene-search-layout="02"][data-scene-narrow="true"][data-scene-mode="fullscreen"] .zenzaCommentPreview{
  left:auto!important;right:12px!important;bottom:234px!important;
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