/**
 * A closed-by-default floating manual-bookmark panel with a static heading.
 * Its hidden lifecycle home remains in the existing info tab; native
 * seek range, automatic markers, thumbnails and scene-search remain untouched.
 */
import {ManualBookmarkPanel} from './ManualBookmarkPanel.ts';
import type {ManualBookmarkPanelDependencies} from './ManualBookmarkPanel.ts';
import {ManualBookmarkSession} from './ManualBookmarkSession.ts';
import type {ManualBookmarkActionResult} from './ManualBookmarkSession.ts';

const contentSelector=
  '.zenzaWatchVideoInfoPanel .tabs.videoInfoTab .zenzaWatchVideoInfoPanelContent';
export class ManualBookmarkDock {
  private readonly node:HTMLElement;
  private readonly root:HTMLElement;
  private readonly panel:ManualBookmarkPanel;
  private readonly session:ManualBookmarkSession;
  private readonly keyHandler:(event:KeyboardEvent)=>void;
  private readonly clickHandler:(event:MouseEvent)=>void;
  private readonly visibilityHandler:()=>void;
  private readonly outsideHandler:(event:Event)=>void;
  private disposed=false;
  private host:HTMLElement|null=null;
  private readonly home:HTMLElement;
  private readonly resizeHandler:()=>void;
  private resizeObserver:ResizeObserver|null=null;
  private layoutObserver:MutationObserver|null=null;
  private bottomReference:HTMLElement|null=null;
  private readonly scrollHandler:(event:Event)=>void;
  private readonly transitionHandler:(event:Event)=>void;
  private observedLayout=new Set<HTMLElement>();
  private observeLayoutChain(start:HTMLElement|null):void {
    for(let node=start;node;node=node.parentElement)if(!this.observedLayout.has(node)){
      this.observedLayout.add(node);this.layoutObserver?.observe(node,{attributes:true,attributeFilter:['class','style','hidden']});
    }
  }
  private position():void {
    if(!this.floating||!this.host)return;
    const host=this.host.getBoundingClientRect(),trigger=this.trigger?.getBoundingClientRect();
    const scaleX=host.width&&(this.host.offsetWidth||this.host.clientWidth)?host.width/(this.host.offsetWidth||this.host.clientWidth):1;
    const scaleY=host.height&&(this.host.offsetHeight||this.host.clientHeight)?host.height/(this.host.offsetHeight||this.host.clientHeight):1;
    const width=this.host.clientWidth||host.width,height=this.host.clientHeight||host.height;
    const win=this.node.ownerDocument.defaultView;
    const viewportHeight=win?.innerHeight||host.bottom;
    const anchor=this.host.querySelector<HTMLElement>('.commentHistorySwitch')||this.node.ownerDocument.querySelector<HTMLElement>('.commentHistorySwitch');
    if(anchor!==this.bottomReference){
      if(this.bottomReference)this.resizeObserver?.unobserve?.(this.bottomReference);
      this.bottomReference=anchor;
      if(anchor){this.resizeObserver?.observe(anchor);this.observeLayoutChain(anchor);
        if(anchor.parentElement)this.layoutObserver?.observe(anchor.parentElement,{attributes:true,childList:true,attributeFilter:['class','style','hidden']});}
    }
    const anchorRect=anchor?.getBoundingClientRect();
    const reference=anchorRect&&anchorRect.width>0&&anchorRect.height>0?anchorRect:undefined;
    // Same viewport baseline as CommentHistoryPanel; only convert coordinates.
    const viewportBottom=Math.max(16,Math.min(viewportHeight-120,reference?viewportHeight-reference.top+10:50));
    const targetBottom=viewportHeight-viewportBottom;
    const originLeft=host.left+(this.host.clientLeft-this.host.scrollLeft)*scaleX;
    const originBottom=host.top+(this.host.clientTop+height-this.host.scrollTop)*scaleY;
    const panelWidth=this.node.offsetWidth||Math.min(this.node.classList.contains('zw-library-wide')?620:400,width-24);
    this.node.style.left=Math.max(12,Math.min(((trigger?.left??originLeft+12*scaleX)-originLeft)/scaleX,width-panelWidth-12))+'px';
    this.node.style.right='auto';this.node.style.top='auto';
    this.node.style.bottom=(originBottom-targetBottom)/scaleY+'px';
    // Keep natural panel size. Restrict only the space available above its bottom.
    this.node.style.maxHeight=Math.max(1,Math.min(height-24,(targetBottom-16)/scaleY))+'px';
    this.node.style.transformOrigin='left bottom';
  }
  private trigger:HTMLElement|null=null;
  private floating=false;
  private closing=false;
  private animation:Animation|null=null;
  private cancelAnimation():void {
    if(this.animation){this.animation.onfinish=null;this.animation.cancel();this.animation=null;}
  }
  private animate(open:boolean,done:()=>void=()=>{}):void {
    this.cancelAnimation();
    const win=this.node.ownerDocument.defaultView;
    if(typeof this.node.animate!=='function'||win?.matchMedia?.('(prefers-reduced-motion: reduce)').matches){done();return;}
    const frames=open?
      [{opacity:0,transform:'translate(12px,18px) scale(.86)'},{opacity:1,transform:'none'}]:
      [{opacity:1,transform:'none'},{opacity:0,transform:'translate(8px,12px) scale(.92)'}];
    try {
      const animation=this.animation=this.node.animate(frames,{duration:open?220:160,easing:open?'cubic-bezier(.2,.9,.3,1.15)':'ease-in',fill:'both'});
      animation.onfinish=()=>{if(this.animation!==animation)return;this.cancelAnimation();done();};
    }catch {this.cancelAnimation();done();}
  }
  private style:HTMLStyleElement;
  toggle(host:HTMLElement,trigger?:HTMLElement|null):void {
    if(this.disposed)return;
    if(this.floating&&!this.closing){this.close();return;}
    this.cancelAnimation();this.closing=false;this.node.inert=false;
    this.resizeObserver?.disconnect();this.layoutObserver?.disconnect();this.observedLayout.clear();this.bottomReference=null;
    this.host=host;this.trigger=trigger||null;this.floating=true;
    this.resizeObserver?.observe(this.node);this.resizeObserver?.observe(host);
    if(this.trigger)this.resizeObserver?.observe(this.trigger);
    this.observeLayoutChain(host);this.observeLayoutChain(this.trigger);
    host.append(this.node);this.node.hidden=false;this.node.classList.add('zw-points-floating');
    this.panel.refreshPreferences();this.panel.setVisible(true);this.trigger?.setAttribute('aria-expanded','true');
    this.position();
    // Refresh shared IndexedDB only on explicit reopen, without polling.
    void this.session.refreshIfIdle();
    this.node.querySelector<HTMLElement>('.zw-points-heading')?.focus({preventScroll:true});
    this.animate(true);
  }
  close(restoreFocus=true):void {
    if(this.disposed||this.closing)return;
    this.panel.setVisible(false);
    if(this.floating){
      this.closing=true;this.node.inert=true;
      this.trigger?.setAttribute('aria-expanded','false');
      if(restoreFocus&&this.trigger?.isConnected)this.trigger.focus({preventScroll:true});
      this.animate(false,()=>{
        this.node.hidden=true;this.node.inert=false;
        this.node.classList.remove('zw-points-floating');this.home.append(this.node);
        this.floating=false;this.closing=false;this.resizeObserver?.disconnect();this.layoutObserver?.disconnect();this.observedLayout.clear();this.bottomReference=null;
      });
    }else{this.node.hidden=true;}
  }
  get bookmarkStatus():string{return this.session.snapshot.status;}
  get bookmarkNeedsReload():boolean{return this.session.needsLoadRetry;}
  get isRepeating():boolean{return this.panel.isRepeating;}
  setRepeatRange(a:number,b:number,activate=true):boolean {return this.panel.setRepeatRange(a,b,activate);}
  repeatAtEnd():boolean {return this.panel.repeatAtEnd();}
  stopUnresponsiveRepeat():void {this.panel.stopUnresponsiveRepeat();}
  acknowledgeLoopSeek(time:number):void {this.panel.acknowledgeLoopSeek(time);}
  refreshPreferences():void {this.panel.refreshPreferences();}
  tick(time:number,paused:boolean,seeking:boolean):boolean {
    return this.panel.tick(time,paused,seeking);
  }
  private constructor(target:HTMLElement,session:ManualBookmarkSession,
    deps:ManualBookmarkPanelDependencies) {
    this.session=session;this.home=target;
    const doc=target.ownerDocument;
    const node=this.node=doc.createElement('section');
    node.setAttribute('role','dialog');node.setAttribute('aria-label','しおり・ABリピート');
    node.className='zenzaManualBookmarkDock';node.hidden=true;
    node.dataset.bookmarkOwner='manual';
    const summary=doc.createElement('h2');summary.className='zw-points-heading';summary.tabIndex=-1;
    summary.textContent='しおり・ABリピート';
    node.append(summary);
    const root=this.root=doc.createElement('section');
    root.className='zenzaManualBookmarkDockContent';
    node.append(root);
    this.style=doc.createElement('style');
    this.style.textContent=ManualBookmarkDock.styles;
    node.append(this.style);
    this.resizeHandler=()=>this.position();
    this.scrollHandler=event=>{if(event.target instanceof doc.defaultView!.Node&&this.node.contains(event.target as Node))return;this.position();};
    this.transitionHandler=event=>{if(this.observedLayout.has(event.target as HTMLElement))this.position();};
    doc.addEventListener('scroll',this.scrollHandler,true);
    doc.addEventListener('fullscreenchange',this.resizeHandler);
    doc.addEventListener('webkitfullscreenchange',this.resizeHandler);
    doc.addEventListener('transitionend',this.transitionHandler,true);
    const MutationObserver=doc.defaultView?.MutationObserver;
    if(MutationObserver)this.layoutObserver=new MutationObserver(this.resizeHandler);
    doc.defaultView?.addEventListener('resize',this.resizeHandler);
    const Observer=doc.defaultView?.ResizeObserver;
    if(Observer){this.resizeObserver=new Observer(this.resizeHandler);this.resizeObserver.observe(node);}
    const series=target.querySelector(':scope > .seriesList');
    target.insertBefore(node,series||null);
    // All keyboard interaction within this dedicated dock belongs to its
    // summary, buttons and text fields, not the video's global shortcuts.
    // Stop bubbling (never preventDefault) without touching native seek keys.
    this.keyHandler=event=>{
      event.stopPropagation();
      if(event.type==='keydown'&&event.key==='Escape'){event.preventDefault();this.close();}
    };
    node.addEventListener('keydown',this.keyHandler);
    node.addEventListener('keyup',this.keyHandler);
    // Floating placement makes the player container an ancestor. Its click
    // handler cancels default actions, including details/summary and checkboxes.
    // Keep dock clicks here without cancelling their native default actions.
    this.clickHandler=event=>event.stopPropagation();
    node.addEventListener('click',this.clickHandler);
    // When another tab was editing the same video, a visible open Dock
    // checks the latest record. Broadcast no video IDs or bookmark content.
    this.visibilityHandler=()=>{
      if(this.disposed||this.node.hidden||
         doc.visibilityState!=='visible')return;
      void this.session.refreshIfIdle();
    };
    this.outsideHandler=event=>{
      if(this.disposed||this.node.hidden)return;
      const path=event.composedPath();
      if(path.includes(this.node)||(this.trigger&&path.includes(this.trigger)))return;
      this.close(false);
    };
    try {
      this.panel=new ManualBookmarkPanel(root,session,deps);
      this.panel.setVisible(false);
      doc.addEventListener('visibilitychange',this.visibilityHandler);
      doc.addEventListener('pointerdown',this.outsideHandler,true);
      doc.addEventListener('click',this.outsideHandler,true);
    }catch(error){
      node.removeEventListener('keydown',this.keyHandler);
      node.removeEventListener('keyup',this.keyHandler);
      node.removeEventListener('click',this.clickHandler);
      node.remove();this.resizeObserver?.disconnect();this.layoutObserver?.disconnect();this.observedLayout.clear();this.bottomReference=null;doc.defaultView?.removeEventListener('resize',this.resizeHandler);doc.removeEventListener('scroll',this.scrollHandler,true);doc.removeEventListener('fullscreenchange',this.resizeHandler);doc.removeEventListener('webkitfullscreenchange',this.resizeHandler);doc.removeEventListener('transitionend',this.transitionHandler,true);
      throw error;
    }
  }
  static mount(host:HTMLElement,session:ManualBookmarkSession,
    deps:ManualBookmarkPanelDependencies):ManualBookmarkDock {
    const target=host?.querySelector<HTMLElement>(contentSelector);
    if(!target)throw new Error('Manual bookmark info-tab mount missing');
    if(target.querySelector(':scope > .zenzaManualBookmarkDock')){
      throw new Error('Manual bookmark dock already owned');
    }
    return new ManualBookmarkDock(target,session,deps);
  }
  get element():HTMLElement{return this.node;}
  activate(videoId:string,duration:number):Promise<ManualBookmarkActionResult>{
    if(this.disposed)throw new Error('Manual bookmark dock disposed');
    return this.session.activate(videoId,duration);
  }
  deactivate():void{
    if(this.disposed)return;
    this.cancelAnimation();this.closing=false;this.node.hidden=true;this.node.inert=false;
    if(this.floating){this.node.classList.remove('zw-points-floating');this.home.append(this.node);this.floating=false;}
    this.resizeObserver?.disconnect();this.layoutObserver?.disconnect();this.observedLayout.clear();this.bottomReference=null;this.trigger?.setAttribute('aria-expanded','false');this.panel.setVisible(false);this.session.deactivate();
  }
  private static readonly styles=`
    .zenzaManualBookmarkDock[hidden]{display:none!important}
    .zenzaManualBookmarkDock{position:relative;color-scheme:dark;box-sizing:border-box;color:#e9edf5;background:#171e2a;border:1px solid #455066;border-radius:12px;font:13px/1.6 system-ui,sans-serif;text-align:left;overflow:hidden;isolation:isolate}
    .zenzaManualBookmarkDock>.zw-points-heading{margin:0;padding:10px 14px;font-size:inherit;font-weight:700;color:#f4f7ff}
    .zenzaManualBookmarkDock:not([hidden]){overflow:auto}
    .zenzaManualBookmarkDock.zw-points-floating{position:absolute;z-index:150000;right:12px;bottom:64px;width:400px;transition:width .18s ease;max-width:calc(100% - 24px);max-height:calc(100% - 88px);box-shadow:0 12px 48px #000a;overscroll-behavior:contain}
    .zenzaManualBookmarkDockContent{padding:0 14px 10px}
    .zenzaManualBookmarkDock:not(.zw-library-wide)>.zw-points-heading{padding-right:104px}
    .zenzaManualBookmarkDock:not(.zw-library-wide) .zw-library-nav{position:absolute;right:12px;top:5px;margin:0;padding:4px 9px;font-size:12px}
    .zenzaManualBookmarkDock .zw-point-section[data-point-section="repeat"]{margin-top:0;padding-top:0;border-top:0}
    .zenzaManualBookmarkDock [data-point-section="repeat"]>h3{display:none}
    .zenzaManualBookmarkDock [data-point-section="repeat"]>[data-point-status]{margin:3px 0 8px}
    .zenzaManualBookmarkDock [data-point-section="repeat"]>button{width:calc((100% - 12px)/3);margin:6px 4px 3px 0;padding:5px 3px;font-size:12px;vertical-align:top}
    .zenzaManualBookmarkDock [data-point-section="repeat"]>.zw-point-range{margin:8px 0}
    .zenzaManualBookmarkDock .zw-library-pagination{display:flex;align-items:center;justify-content:center;gap:6px;flex-wrap:wrap;margin:8px 0}
    .zenzaManualBookmarkDock .zw-library-pagination>span{color:#aebbd1;font-size:12px}
    .zenzaManualBookmarkDock h3{font-size:13px;margin:12px 0 8px;color:#f4f7ff;letter-spacing:.02em}
    .zenzaManualBookmarkDock p{margin:5px 0 10px;color:#aebbd1;font-size:12px}
    .zenzaManualBookmarkDock button,.zenzaManualBookmarkDock input{box-sizing:border-box;font:inherit;line-height:1.4;border-radius:6px;min-height:32px;margin:3px 5px 3px 0}
    .zenzaManualBookmarkDock button{background:#303c51;color:#f4f7ff;border:1px solid #53627b;padding:6px 10px;cursor:pointer}
    .zenzaManualBookmarkDock button:hover{background:#435574}
    .zenzaManualBookmarkDock button:disabled{opacity:.45;cursor:default}
    .zenzaManualBookmarkDock button:focus-visible,.zenzaManualBookmarkDock input:focus-visible,.zenzaManualBookmarkDock summary:focus-visible{outline:2px solid #8ecbff;outline-offset:2px}
    .zenzaManualBookmarkDock input{background:#101722;color:#fff;border:1px solid #53627b;padding:6px 8px;max-width:100%}
    .zenzaManualBookmarkDock label{display:inline-flex;align-items:center;gap:8px;color:#cad5e8}
    .zenzaManualBookmarkDock input[data-point-field]{width:88px;font-variant-numeric:tabular-nums}
    .zenzaManualBookmarkDock input[data-bookmark-label]{width:calc(100% - 2px)}
    .zenzaManualBookmarkDock button[data-bookmark-action="add"]{width:100%;background:#286b91;border-color:#66b8e0;margin-bottom:8px;font-weight:700}
    .zenzaManualBookmarkDock ul{list-style:none;padding:0;margin:6px 0}
    .zenzaManualBookmarkDock li{padding:8px 0;border-top:1px solid #354056;display:flex;align-items:center;gap:4px;flex-wrap:wrap}
    .zenzaManualBookmarkDock li>span{display:block;flex:1 1 55%;overflow-wrap:anywhere;color:#e4edff;font-variant-numeric:tabular-nums}
    .zenzaManualBookmarkDock input[data-bookmark-rename-id]{width:130px;flex:1 1 100px}
    .zenzaManualBookmarkDock .zw-point-section{border-top:1px solid #354056;margin-top:12px;padding-top:2px}
    .zenzaManualBookmarkDock .zw-point-section:first-child{border-top:0;margin-top:0}
    .zenzaManualBookmarkDock .zw-point-range-inputs{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);align-items:start;gap:10px}
    .zenzaManualBookmarkDock .zw-point-range{height:6px;border-radius:3px;background:#354056;position:relative;margin:12px 0;overflow:hidden}
    .zenzaManualBookmarkDock .zw-point-range span{position:absolute;height:100%;background:#6ed9bc}
    .zenzaManualBookmarkDock button[aria-pressed="true"]{background:#245f52;border-color:#6ed9bc}
    .zenzaManualBookmarkDock .zw-point-tabs{display:flex;gap:4px;position:sticky;top:0;background:#171e2a;padding:4px 0 8px;z-index:1}
    .zenzaManualBookmarkDock .zw-point-tabs button{flex:1;padding:6px 3px;font-size:12px;margin:0;white-space:nowrap}
    .zenzaManualBookmarkDock [data-point-section][hidden]{display:none}
    .zenzaManualBookmarkDock .zw-bookmark-edit{flex:1 1 100%;border:0;background:transparent}
    .zenzaManualBookmarkDock .zw-bookmark-edit summary{font-size:11px;padding:2px 0;color:#aebbd1}
    .zenzaManualBookmarkDock small{display:block;color:#aebbd1;font-size:11px;line-height:1.6}
    .zenzaManualBookmarkDock.zw-library-wide{width:620px}
    .zenzaManualBookmarkDock [hidden]{display:none!important}
    .zenzaManualBookmarkDock .zw-scene-preview{flex:none;width:80px;aspect-ratio:16/9;background:#253346;color:#b9c9d9;border-radius:4px;display:flex;align-items:center;justify-content:center;overflow:hidden;font-size:11px}
    .zenzaManualBookmarkDock .zw-scene-preview img,.zenzaManualBookmarkDock .zw-scene-preview canvas{width:100%;height:100%;object-fit:cover}
    .zenzaManualBookmarkDock li>span{flex:1 1 80px}
    .zenzaManualBookmarkDock .zw-point-line{display:flex;align-items:center;gap:8px;margin:10px 0}
    .zenzaManualBookmarkDock .zw-point-line>span{flex:1}
    .zenzaManualBookmarkDock .zw-auto-setting{display:flex;margin-top:10px}
    .zenzaManualBookmarkDock input[type=checkbox]{width:16px;height:16px;min-height:0;accent-color:#6ed9bc}
    .zenzaManualBookmarkDock .zw-automatic-edit summary,.zenzaManualBookmarkDock .zw-bookmark-edit summary{cursor:pointer}
    .zenzaManualBookmarkDock .zw-bookmark-edit[open],.zenzaManualBookmarkDock .zw-automatic-edit[open]{animation:zw-bookmark-reveal .14s ease}
    .zenzaManualBookmarkDock .zw-library-nav{display:block;margin-left:auto}
    .zenzaManualBookmarkDock .zw-library-search{display:flex;gap:8px;flex-wrap:wrap}
    .zenzaManualBookmarkDock .zw-library-search input{flex:1;min-width:150px}
    .zenzaManualBookmarkDock select{background:#101722;color:#f4f7ff;border:1px solid #53627b;border-radius:5px;padding:6px;font:inherit}
    .zenzaManualBookmarkDock .zw-library-sticky-header{position:sticky;top:0;z-index:3;background:#171e2a;padding:4px 0;border-bottom:1px solid #354056}
    .zenzaManualBookmarkDock .zw-library-virtual-item{display:flow-root}
    .zenzaManualBookmarkDock .zw-library-thumbnail-host{flex:none;width:var(--zw-video-thumb-width,80px);aspect-ratio:16/9;overflow:hidden;display:flex;align-items:center;justify-content:center;border-radius:4px;background:#253346;color:#b9c9d9;font-size:12px;line-height:1.4}
    .zenzaManualBookmarkDock .zw-library-thumbnail-host .zw-library-thumbnail-image{display:block;width:100%;height:100%;object-fit:cover}
    .zenzaManualBookmarkDock .zw-library-group{margin-top:12px}
    .zenzaManualBookmarkDock .zw-library-group>summary{font-weight:600;cursor:pointer;display:flex;align-items:center;gap:10px;min-width:0}
    .zenzaManualBookmarkDock .zw-library-group>summary::before{content:'▸';flex:none;color:#aebbd1}
    .zenzaManualBookmarkDock .zw-library-group[open]>summary::before{content:'▾'}
    .zenzaManualBookmarkDock .zw-library-group>summary::-webkit-details-marker{display:none}
    .zenzaManualBookmarkDock .zw-library-thumbnail{width:var(--zw-video-thumb-width,80px);aspect-ratio:16/9;object-fit:cover;border-radius:4px;flex:none;background:#253346}
    .zenzaManualBookmarkDock .zw-library-header{min-width:0;flex:1}
    .zenzaManualBookmarkDock .zw-library-title{font-size:var(--zw-library-title-size,13px);display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:var(--zw-library-title-lines,1);overflow:hidden;overflow-wrap:anywhere}
    .zenzaManualBookmarkDock .zw-library-group[open] .zw-library-title{display:block;-webkit-line-clamp:unset;overflow:visible}
    .zenzaManualBookmarkDock time[data-viewed-at]{display:block;font-size:11px;color:#aebbd1;font-weight:400}
    .zenzaManualBookmarkDock .zw-scene-loading{position:relative;font-size:0}
    .zenzaManualBookmarkDock .zw-scene-loading::after{content:'';position:absolute;left:calc(50% - 8px);top:calc(50% - 8px);z-index:1;width:12px;height:12px;border:2px solid #53627b;border-top-color:#8ecbff;border-radius:50%;animation:zw-scene-loading-spin .8s linear infinite}
    @keyframes zw-scene-loading-spin{to{transform:rotate(360deg)}}
    @media(prefers-reduced-motion:reduce){.zenzaManualBookmarkDock .zw-scene-loading::after{animation:none}}
    .zenzaManualBookmarkDock .zw-point-range-inputs>div{display:grid;grid-template-columns:minmax(0,1fr) 80px;gap:5px 8px;min-width:0;align-items:end}
    .zenzaManualBookmarkDock .zw-point-range-inputs .zw-scene-preview{grid-column:2;grid-row:1;width:80px;height:45px;margin:0}
    .zenzaManualBookmarkDock .zw-point-range-inputs label{display:block;grid-column:1;grid-row:1;min-width:0}
    .zenzaManualBookmarkDock .zw-point-range-inputs>div:has(.zw-scene-preview[hidden]) label{grid-column:1/-1}
    .zenzaManualBookmarkDock .zw-point-range-inputs input{display:block;width:100%;margin:0}
    .zenzaManualBookmarkDock .zw-point-range-inputs button{grid-column:1/-1;width:100%;margin:0;padding:5px 2px;font-size:12px}
    @keyframes zw-bookmark-reveal{from{opacity:0;transform:translateY(-3px)}to{opacity:1;transform:none}}
    @media(prefers-reduced-motion:reduce){.zenzaManualBookmarkDock.zw-points-floating{transition:none}.zenzaManualBookmarkDock .zw-bookmark-edit[open],.zenzaManualBookmarkDock .zw-automatic-edit[open]{animation:none}}
    @media(pointer:coarse){.zenzaManualBookmarkDock button{min-height:44px}.zenzaManualBookmarkDock:not(.zw-library-wide)>.zw-points-heading{box-sizing:border-box;min-height:54px}.zenzaManualBookmarkDock input:not([type=checkbox]),.zenzaManualBookmarkDock select{font-size:16px}}
    `;
  dispose():void {
    if(this.disposed)return;
    this.disposed=true;
    this.cancelAnimation();
    this.node.removeEventListener('keydown',this.keyHandler);
    this.node.removeEventListener('keyup',this.keyHandler);
    this.node.removeEventListener('click',this.clickHandler);
    this.node.ownerDocument.removeEventListener('visibilitychange',this.visibilityHandler);
    this.node.ownerDocument.removeEventListener('pointerdown',this.outsideHandler,true);
    this.node.ownerDocument.removeEventListener('click',this.outsideHandler,true);
    this.resizeObserver?.disconnect();this.layoutObserver?.disconnect();this.observedLayout.clear();this.bottomReference=null;
    this.node.ownerDocument.defaultView?.removeEventListener('resize',this.resizeHandler);
    this.node.ownerDocument.removeEventListener('scroll',this.scrollHandler,true);
    this.node.ownerDocument.removeEventListener('fullscreenchange',this.resizeHandler);
    this.node.ownerDocument.removeEventListener('webkitfullscreenchange',this.resizeHandler);
    this.node.ownerDocument.removeEventListener('transitionend',this.transitionHandler,true);
    this.panel.dispose();
    this.session.dispose();
    this.node.remove();
  }
}
