// SCUI-16 completion provider: 08 Edge Drawer / 09 Detached Remote.
// No separate thumbnail fetch, timers, observers or global event listeners.
// The shared Card remains the single owner of actions, image and style.
//===BEGIN===
class SceneSearchLayouts08_09 {
  static get DESCRIPTORS() {
    return [
      {id:'08',label:'片側引き出し',
        description:'シーン画像の横に操作用引き出しを配置。狭い画面は下段へ折り返す'},
      {id:'09',label:'分離リモコン',
        description:'シーン画像と操作ボタンを視覚的に分離。通常・全画面とも端で退避'}
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
/* No transparent cover or second full-width pointer layer. */
.zenzaSceneSearchHost:is(.zenzaSceneEdgeDrawer,.zenzaSceneDetachedRemote) {
  --scene-bottom:62px;
  left:var(--scene-x,50%);
  transform:translateX(-50%);
  max-width:calc(100% - 16px);
  isolation:isolate;
}
.zenzaSceneSearchHost:is(.zenzaSceneEdgeDrawer,.zenzaSceneDetachedRemote)[data-mode="fullscreen"] {
  --scene-bottom:calc(var(--zenza-control-bar-height,40px) + 28px);
}
.zenzaSceneSearchHost.zenzaSceneEdgeDrawer {
  width:min(205px,calc(100% - 16px));
  border-radius:6px;
}
.zenzaSceneEdgeDrawer .zenzaSceneActions {
  position:absolute;left:100%;right:auto;bottom:0;
  width:110px;min-width:0;display:flex;flex-wrap:wrap;gap:3px;
  padding:4px;border-radius:6px;background:#111b28;
  box-shadow:0 2px 11px #0008;
  opacity:0;visibility:hidden;pointer-events:none;
  transform:translateX(-8px);
  transition:transform .14s ease,opacity .14s ease,visibility .14s;
}
.zenzaSceneEdgeDrawer .zenzaSceneActions .zenzaSceneBtn,
.zenzaSceneDetachedRemote .zenzaSceneActions .zenzaSceneBtn {
  position:static;opacity:1;visibility:visible;pointer-events:auto;
  transform:none;flex:0 0 auto;
}
.zenzaSceneEdgeDrawer:is(:hover,:focus-within,.is-expanded,.is-pinned) .zenzaSceneActions {
  opacity:1;visibility:visible;pointer-events:auto;transform:translateX(0);
}
.zenzaSceneEdgeDrawer[data-scui-side="left"] .zenzaSceneActions {
  left:auto;right:100%;transform:translateX(8px);
}
.zenzaSceneEdgeDrawer[data-scui-side="left"]:is(:hover,:focus-within,.is-expanded,.is-pinned) .zenzaSceneActions {
  transform:translateX(0);
}
.zenzaSceneSearchHost.zenzaSceneDetachedRemote {
  width:min(195px,calc(100% - 16px));border-radius:6px;
}
.zenzaSceneDetachedRemote .zenzaSceneRemoteControls {
  position:absolute;left:calc(100% + 8px);top:0;
  min-width:126px;max-width:144px;padding:4px;
  border:1px solid #4b6077;border-radius:7px;
  background:#111b28;box-shadow:0 3px 12px #0009;
}
.zenzaSceneDetachedRemote .zenzaSceneRemoteControls .zenzaSceneActions {
  position:static;display:flex;flex-wrap:wrap;justify-content:center;
  gap:3px;opacity:1;visibility:visible;pointer-events:auto;
}
.zenzaSceneDetachedRemote[data-scui-side="left"] .zenzaSceneRemoteControls {
  left:auto;right:calc(100% + 8px);
}
.zenzaSceneSearchHost:is(.zenzaSceneEdgeDrawer,.zenzaSceneDetachedRemote).is-compact {
  width:min(124px,calc(100% - 12px));
}
.zenzaSceneSearchHost:is(.zenzaSceneEdgeDrawer,.zenzaSceneDetachedRemote).is-compact .scene-seek-back,
.zenzaSceneSearchHost:is(.zenzaSceneEdgeDrawer,.zenzaSceneDetachedRemote).is-compact .scene-seek-forward {
  display:none!important;pointer-events:none;
}
.zenzaSceneEdgeDrawer .scene-more {
  position:static;opacity:1;visibility:visible;pointer-events:auto;
}
.zenzaSceneEdgeDrawer[data-scui-side="stack"] .zenzaSceneActions {
  left:0;right:auto;bottom:auto;top:calc(100% + 5px);
  width:min(200px,calc(100vw - 16px));transform:translateY(-5px);
}
.zenzaSceneEdgeDrawer[data-scui-side="stack"]:is(:hover,:focus-within,.is-expanded,.is-pinned) .zenzaSceneActions {
  transform:translateY(0);
}
.zenzaSceneDetachedRemote[data-scui-side="stack"] .zenzaSceneRemoteControls {
  left:0;right:auto;top:calc(100% + 5px);
  max-width:calc(100vw - 16px);
}
@media(max-width:460px) {
  .zenzaSceneEdgeDrawer .zenzaSceneActions,
  .zenzaSceneEdgeDrawer[data-scui-side="left"] .zenzaSceneActions {
    left:0;right:auto;bottom:auto;top:calc(100% + 5px);
    width:min(200px,calc(100vw - 16px));transform:translateY(-5px);
  }
  .zenzaSceneEdgeDrawer:is(:hover,:focus-within,.is-expanded,.is-pinned) .zenzaSceneActions {
    transform:translateY(0);
  }
  .zenzaSceneDetachedRemote .zenzaSceneRemoteControls,
  .zenzaSceneDetachedRemote[data-scui-side="left"] .zenzaSceneRemoteControls {
    left:0;right:auto;top:calc(100% + 5px);
    max-width:calc(100vw - 16px);
  }
}
@media(prefers-reduced-motion:reduce) {
  .zenzaSceneEdgeDrawer .zenzaSceneActions {transition:none}
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
    const width=this.container.getBoundingClientRect?.().width||
      this.container.clientWidth||800;
    const cardWidth=state?.seekStepSeconds===0?124:this.id==='08'?205:195;
    const remoteWidth=this.id==='08'?126:152;
    const x=Number(this.root.style.getPropertyValue('--scene-x').replace('px',''));
    const center=Number.isFinite(x)&&x>0?x:width/2;
    const limit=cardWidth/2+8;
    const clamped=Math.min(Math.max(center,limit),Math.max(limit,width-limit));
    const rightSpace=width-clamped-cardWidth/2;
    const leftSpace=clamped-cardWidth/2;
    const side=rightSpace>=remoteWidth+12?'right':
      leftSpace>=remoteWidth+12?'left':'stack';
    this.root.dataset.scuiSide=side;
    if(Number.isFinite(clamped)&&Math.abs(clamped-center)>0.5){
      this.root.style.setProperty('--scene-x',Math.round(clamped)+'px');
    }
    // On narrow viewports or with no side space, CSS stacks the controls below.
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
