// SCUI-16 completion provider: 08 Edge Drawer / 09 Detached Remote.
// No separate thumbnail fetch, timers, observers or global event listeners.
// The shared Card remains the single owner of actions, image and style.
//===BEGIN===
class SceneSearchLayouts08_09 {
  static get DESCRIPTORS() {
    return [
      {id:'08',label:'片側引き出し',
        description:'通常は動画の左縁、全画面は右縁。操作列を画面内側へ引き出す'},
      {id:'09',label:'分離リモコン',
        description:'左の画像と右の独立操作ドックを分離。狭い画面は上下に退避'}
    ];
  }
  static install(registry,Card) {
    if(typeof registry?.register!=='function'||typeof Card!=='function') {
      throw new TypeError('Drawer layouts require the shared registry and card');
    }
    const [drawer,remote]=SceneSearchLayouts08_09.DESCRIPTORS;
    registry.register({...drawer,
      factory:args=>new SceneSearchLayouts08_09({
        ...args,Card,layoutId:drawer.id
      })});
    registry.register({...remote,
      factory:args=>new SceneSearchLayouts08_09({
        ...args,Card,layoutId:remote.id
      })});
    return registry;
  }
  static get CSS() {return `
/* Original 08: left shelf normal, right shelf fullscreen, tools inward. */
.zenzaSceneSearchHost.zenzaSceneEdgeDrawer{
  position:absolute;left:10px;right:auto;top:29%;bottom:auto;
  transform:none;width:min(204px,calc(100% - 20px));
  border-radius:8px;background:#07111af2;isolation:isolate;
}
.zenzaSceneSearchHost.zenzaSceneEdgeDrawer[data-mode="fullscreen"]{
  left:auto;right:14px;top:32%;bottom:auto;
}
.zenzaSceneEdgeDrawer .zenzaSceneFoot{justify-content:space-between}
.zenzaSceneEdgeDrawer .zenzaSceneActions{
  position:absolute;left:calc(100% - 1px);right:auto;top:0;bottom:auto;
  width:124px;min-width:0;display:flex;flex-flow:row wrap;gap:3px;
  padding:4px;border:1px solid #56748a;border-radius:7px;
  background:#111b28;box-shadow:0 2px 11px #0008;
  opacity:0;visibility:hidden;pointer-events:none;
  transform:translateX(-8px);
  transition:transform .14s ease,opacity .14s ease,visibility .14s;
}
.zenzaSceneEdgeDrawer[data-mode="fullscreen"] .zenzaSceneActions{
  left:auto;right:calc(100% - 1px);transform:translateX(8px);
}
.zenzaSceneEdgeDrawer .zenzaSceneActions>.zenzaSceneBtn,
.zenzaSceneDetachedRemote .zenzaSceneActions>.zenzaSceneBtn{
  position:static;left:auto;right:auto;top:auto;bottom:auto;
  opacity:1;visibility:inherit;pointer-events:inherit;
  transform:none;flex:0 0 auto;
}
.zenzaSceneEdgeDrawer:is(:hover,:focus-within,.is-expanded,.is-pinned) .zenzaSceneActions{
  opacity:1;visibility:visible;pointer-events:auto;transform:translateX(0);
}
.zenzaSceneEdgeDrawer[data-scene-reveal="click"]:not(.is-expanded):not(.is-pinned) .zenzaSceneActions{
  opacity:0!important;visibility:hidden!important;pointer-events:none!important;
}
.zenzaSceneEdgeDrawer .scene-more,
.zenzaSceneDetachedRemote .scene-more{
  position:static;opacity:1;visibility:visible;pointer-events:auto;
}
.zenzaSceneSearchHost.zenzaSceneEdgeDrawer.is-compact{
  width:min(117px,calc(100% - 16px));
}
/* On narrow player sizes, stack buttons directly below the drawer.
   No full-screen transparent hit test layer is added. */
.zenzaSceneEdgeDrawer[data-scui-side="stack"] .zenzaSceneActions{
  left:0;right:auto;top:calc(100% - 1px);bottom:auto;
  width:100%;box-sizing:border-box;transform:translateY(-7px);
}
.zenzaSceneEdgeDrawer[data-scui-side="stack"]:is(:hover,:focus-within,.is-expanded,.is-pinned) .zenzaSceneActions{
  transform:translateY(0);
}
/* Original 09: preview left and a separately reachable remote at right. */
.zenzaSceneSearchHost.zenzaSceneDetachedRemote{
  position:absolute;left:16%;right:auto;top:calc(100% + 15px);bottom:auto;
  transform:translateX(-40%);
  width:min(205px,calc(100% - 16px));
  border-radius:7px;isolation:isolate;
}
.zenzaSceneSearchHost.zenzaSceneDetachedRemote[data-mode="fullscreen"]{
  left:16px;right:auto;top:auto;bottom:96px;transform:none;
}
.zenzaSceneSearchHost.zenzaSceneDetachedRemote[data-scui-placement="visible-fallback"]{
  top:auto;bottom:96px;
}
/* When thumbnail auto-hides, the independently placed right-hand remote
   stays operable. Only the image card is collapsed. */
.zenzaSceneSearchHost.zenzaSceneDetachedRemote.is-preview-suppressed{
  width:0!important;min-width:0!important;max-width:0!important;height:0!important;
  padding:0!important;border:0!important;background:transparent!important;
  box-shadow:none!important;overflow:visible;
}
.zenzaSceneDetachedRemote.is-preview-suppressed>.zenzaSceneImageBox,
.zenzaSceneDetachedRemote.is-preview-suppressed>.zenzaSceneFoot{
  display:none!important;
}
.zenzaSceneDetachedRemote .zenzaSceneRemoteControls{
  position:absolute;left:var(--scene-remote-offset,calc(100% + 8px));
  right:auto;top:auto;bottom:0;
  width:174px;max-width:calc(100vw - 16px);
  padding:6px;border:1px solid #4b6077;border-radius:11px;
  background:#111b28;box-shadow:0 3px 12px #0009;
  display:flex;align-items:center;justify-content:center;gap:4px;
}
.zenzaSceneDetachedRemote .zenzaSceneRemoteControls .zenzaSceneActions{
  position:static;display:flex;flex-flow:row wrap;justify-content:center;
  gap:3px;width:auto;min-width:0;padding:0;
  opacity:0;visibility:hidden;pointer-events:none;
}
.zenzaSceneDetachedRemote .zenzaSceneRemoteControls:is(:hover,:focus-within),
.zenzaSceneDetachedRemote.is-expanded .zenzaSceneRemoteControls,
.zenzaSceneDetachedRemote.is-pinned .zenzaSceneRemoteControls{
  border-color:#8abddd;
}
.zenzaSceneDetachedRemote .zenzaSceneRemoteControls:is(:hover,:focus-within) .zenzaSceneActions,
.zenzaSceneDetachedRemote:is(.is-expanded,.is-pinned) .zenzaSceneActions{
  opacity:1;visibility:visible;pointer-events:auto;
}
.zenzaSceneDetachedRemote[data-scene-reveal="always"] .zenzaSceneActions{
  opacity:1!important;visibility:visible!important;pointer-events:auto!important;
}
.zenzaSceneDetachedRemote[data-scene-reveal="click"]:not(.is-expanded):not(.is-pinned) .zenzaSceneActions{
  opacity:0!important;visibility:hidden!important;pointer-events:none!important;
}
.zenzaSceneSearchHost.zenzaSceneDetachedRemote.is-compact{
  width:min(119px,calc(100% - 12px));
}
.zenzaSceneSearchHost:is(.zenzaSceneEdgeDrawer,.zenzaSceneDetachedRemote).is-compact :is(.scene-seek-back,.scene-seek-forward){
  display:none!important;pointer-events:none!important;
}
.zenzaSceneSearchHost.zenzaSceneDetachedRemote[data-scui-side="stack"]{
  left:12px;right:auto;transform:none;
}
.zenzaSceneDetachedRemote[data-scui-side="stack"] .zenzaSceneRemoteControls{
  left:0;right:auto;top:calc(100% - 1px);bottom:auto;
  width:100%;box-sizing:border-box;max-width:100%;
}
/* When the image is auto-hidden on narrow screens, the toolbar may still
   be accessed at the bottom dock position rather than a stale image gap. */
.zenzaSceneDetachedRemote[data-scui-side="stack"].is-preview-suppressed .zenzaSceneRemoteControls{
  left:0;top:0;
}
@media(prefers-reduced-motion:reduce){
  .zenzaSceneEdgeDrawer .zenzaSceneActions{transition:none}
}
`;}
  constructor({Card,layoutId,document,container,mode,onAction,settings}={}) {
    if(typeof Card!=='function'||!document||!container||
      !['08','09'].includes(layoutId)){
      throw new TypeError('Drawer layouts require ID, DOM and Card');
    }
    this.id=layoutId;
    this.container=container;
    this.mode=mode;
    this.card=new Card({document,container,id:layoutId,mode,onAction,settings,
      layoutClass:layoutId==='08'?'zenzaSceneEdgeDrawer':'zenzaSceneDetachedRemote',
      extraCss:SceneSearchLayouts08_09.CSS});
    this.root=null;this._disposed=false;this._remote=null;
  }
  mount(state) {
    if(this._disposed){throw new Error('Layout disposed');}
    this.card.mount(state);this.root=this.card.root;
    try {
      if(this.id==='08') {
        // The handle must remain keyboard accessible while the drawer is closed.
        const handle=this.root.querySelector('.scene-more');
        const actions=this.root.querySelector('.zenzaSceneActions');
        const foot=this.root.querySelector('.zenzaSceneFoot');
        foot.insertBefore(handle,actions);
      }
      if(this.id==='09') {
        const actions=this.root.querySelector('.zenzaSceneActions');
        const holder=this.card.document.createElement('aside');
        holder.className='zenzaSceneRemoteControls';
        holder.setAttribute('role','toolbar');
        holder.setAttribute('aria-label','シーンサーチ分離リモコン');
        const more=actions.querySelector('.scene-more');
        if(more)holder.append(more);
        holder.append(actions);
        this.root.append(holder);
        this._remote=holder;
      }
      this.render(state);
    } catch(error) {this.dispose();throw error;}
  }
  render(state) {
    if(this._disposed||!this.root){return;}
    this.card.render(state);
    const frame=this.container.getBoundingClientRect?.();
    const width=this.container.offsetWidth||frame?.width||
      this.container.clientWidth||800;
    if(this.id==='08'){
      this.root.dataset.scuiSide=width<360?'stack':
        this.mode==='fullscreen'?'left':'right';
      return;
    }
    // The independent remote remains usable after thumbnail hover expires.
    const suppressed=state?.shown===false&&!state?.pinned;
    this.root.hidden=false;
    this.root.classList.toggle('is-preview-suppressed',suppressed);
    const viewportHeight=this.card.document.defaultView?.innerHeight;
    const room=Number.isFinite(viewportHeight)&&Number.isFinite(frame?.bottom)?
      viewportHeight-frame.bottom:Infinity;
    this.root.dataset.scuiPlacement=this.mode==='normal'&&room<165?
      'visible-fallback':'below';
    const stack=width<500;
    this.root.dataset.scuiSide=stack?'stack':'dock';
    const rootRect=this.root.getBoundingClientRect?.();
    const scale=frame?.width?width/frame.width:1;
    const cardWidth=state?.seekStepSeconds===0?119:205;
    const fallbackX=this.mode==='fullscreen'?16:width*.16-cardWidth*.4;
    const rootX=Number.isFinite(rootRect?.left)&&rootRect?.width>0&&
      Number.isFinite(frame?.left)?
        (rootRect.left-frame.left)*scale:fallbackX;
    // The remote is still a child for one-event-owner semantics, but its
    // visual position is computed relative to the far RIGHT of the player.
    const rightDock=width-12-174-rootX;
    this.root.style.setProperty('--scene-remote-offset',
      Math.round(Math.max(0,rightDock))+'px');
  }
  onPreview(asset,context){this.card.onPreview(asset,context);}
  dispose(){
    if(this._disposed){return;}
    this._disposed=true;
    this.card.dispose();
    this.root=null;this._remote=null;
  }
}
//===END===
export {SceneSearchLayouts08_09};
