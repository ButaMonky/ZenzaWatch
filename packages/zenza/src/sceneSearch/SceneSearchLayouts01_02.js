// SCUI-12: first two production layout strategies.
import {SceneSearchLayoutCard} from './SceneSearchLayoutCard';
//===BEGIN===
//@require SceneSearchLayoutCard
const SCENE_01_02_TOOLS_CSS=`
.zenzaSceneSearchHost.zenzaSceneLayout01 .zenzaSceneActions,
.zenzaSceneSearchHost.zenzaSceneLayout02 .zenzaSceneActions{
  position:relative;min-width:26px;flex:0 0 auto;gap:2px;
}
.zenzaSceneSearchHost.zenzaSceneLayout01 .scene-pin,
.zenzaSceneSearchHost.zenzaSceneLayout01 .scene-comment-toggle,
.zenzaSceneSearchHost.zenzaSceneLayout01 .scene-comment-search,
.zenzaSceneSearchHost.zenzaSceneLayout01 .scene-seek-step,
.zenzaSceneSearchHost.zenzaSceneLayout02 .scene-pin,
.zenzaSceneSearchHost.zenzaSceneLayout02 .scene-comment-toggle,
.zenzaSceneSearchHost.zenzaSceneLayout02 .scene-comment-search,
.zenzaSceneSearchHost.zenzaSceneLayout02 .scene-seek-step{
  position:absolute;z-index:1;right:-29px;min-width:25px;
  transform:translateY(6px);transition:opacity .16s ease,transform .16s ease,visibility .16s;
}
.zenzaSceneSearchHost.zenzaSceneLayout01 .scene-pin,
.zenzaSceneSearchHost.zenzaSceneLayout02 .scene-pin{bottom:0}
.zenzaSceneSearchHost.zenzaSceneLayout01 .scene-comment-toggle,
.zenzaSceneSearchHost.zenzaSceneLayout02 .scene-comment-toggle{bottom:27px}
.zenzaSceneSearchHost.zenzaSceneLayout01 .scene-comment-search,
.zenzaSceneSearchHost.zenzaSceneLayout02 .scene-comment-search{bottom:54px}
.zenzaSceneSearchHost.zenzaSceneLayout01 .scene-seek-step,
.zenzaSceneSearchHost.zenzaSceneLayout02 .scene-seek-step{bottom:81px}
.zenzaSceneSearchHost:is(.zenzaSceneLayout01,.zenzaSceneLayout02):is(:hover,:focus-within,.is-expanded,.is-pinned)
  .zenzaSceneActions>.zenzaSceneBtn{transform:translateY(0)}
.zenzaSceneSearchHost:is(.zenzaSceneLayout01,.zenzaSceneLayout02) .zenzaSceneFoot{
  gap:3px;min-width:0
}
.zenzaSceneSearchHost:is(.zenzaSceneLayout01,.zenzaSceneLayout02) .scene-more{
  opacity:1;visibility:visible;pointer-events:auto
}
@media(prefers-reduced-motion:reduce){
  .zenzaSceneSearchHost:is(.zenzaSceneLayout01,.zenzaSceneLayout02) .zenzaSceneBtn{
    transition:none!important;transform:none!important
  }
}
`;
const SCENE_LAYOUT01_CSS=`
.zenzaSceneSearchHost.zenzaSceneLayout01{
  width:var(--scene-preview-min-width);
  left:var(--scene-x,50%);
  bottom:var(--scene-bottom,60px);
  transform:translateX(-50%);
  border-radius:6px;box-shadow:none;
}
/* Above the video container AND the independent right information panel.
   The dialog spans the viewport, unlike its narrow .zenzaPlayerContainer. */
.zenzaSceneSearchHost.zenzaSceneLayout01[data-scui-portal="1"]{
  position:fixed!important;
  left:var(--scene-viewport-x,50%)!important;
  /* The portal uses viewport positioning. Retain the original bottom
     measured from the video container, not the viewport itself. */
  bottom:var(--scene-viewport-bottom,var(--scene-bottom,60px))!important;
  z-index:2800!important;
  pointer-events:auto!important
}
.zenzaSceneLayout01[data-mode="fullscreen"]{
  --scene-bottom:calc(var(--zenza-control-bar-height,40px) + 28px)
}
.zenzaSceneLayout01[data-mode="normal"]{--scene-bottom:38px}
/* Keep the tool rail inside the viewport at the right edge. */
.zenzaSceneSearchHost.zenzaSceneLayout01.is-tools-left .zenzaSceneActions,
.zenzaSceneSearchHost.zenzaSceneLayout01.is-tools-overlap .zenzaSceneActions{
  position:static;
}
.zenzaSceneSearchHost.zenzaSceneLayout01.is-tools-left .zenzaSceneActions>.scene-pin,
.zenzaSceneSearchHost.zenzaSceneLayout01.is-tools-left .zenzaSceneActions>.scene-comment-toggle,
.zenzaSceneSearchHost.zenzaSceneLayout01.is-tools-left .zenzaSceneActions>.scene-comment-search,
.zenzaSceneSearchHost.zenzaSceneLayout01.is-tools-left .zenzaSceneActions>.scene-seek-step{
  right:auto;left:-29px;
}
/* Below one card width, keep the controls within its hit-test rectangle. */
.zenzaSceneSearchHost.zenzaSceneLayout01.is-tools-overlap .zenzaSceneActions>.scene-pin,
.zenzaSceneSearchHost.zenzaSceneLayout01.is-tools-overlap .zenzaSceneActions>.scene-comment-toggle,
.zenzaSceneSearchHost.zenzaSceneLayout01.is-tools-overlap .zenzaSceneActions>.scene-comment-search,
.zenzaSceneSearchHost.zenzaSceneLayout01.is-tools-overlap .zenzaSceneActions>.scene-seek-step{
  left:auto;right:3px;
}
`;
const SCENE_LAYOUT02_CSS=`
.zenzaSceneSearchHost.zenzaSceneLayout02{
  width:var(--scene-preview-min-width);
  left:12px;bottom:var(--scene-bottom,64px);transform:none;
  border-radius:6px;box-shadow:0 4px 12px rgba(0,0,0,.16);
}
.zenzaSceneLayout02[data-mode="normal"]{--scene-bottom:42px}
.zenzaSceneLayout02[data-mode="fullscreen"]{
  --scene-bottom:calc(var(--zenza-control-bar-height,40px) + 28px)
}
/* The integration bridge places the independent native comment list.
   This provider owns only the scene card, including narrow layouts. */
`;
function registerSceneLayouts01_02(registry) {
  if(!registry||typeof registry.register!=='function'){
    throw new TypeError('A scene layout registry is required');
  }
  for(const item of [
    {id:'01',name:'クラシック追従',
      description:'シーク位置へ追従する小型プレビュー。通常表示と全画面で下端を調整',
      layoutClass:'zenzaSceneLayout01',css:SCENE_LAYOUT01_CSS},
    {id:'02',name:'左右ツインパネル',
      description:'シーンを左、コメント一覧を右に同時表示',
      layoutClass:'zenzaSceneLayout02',css:SCENE_LAYOUT02_CSS}
  ]){
    registry.register({id:item.id,label:item.name,description:item.description,
      factory:options=>{
        const card=new SceneSearchLayoutCard({...options,
          layoutClass:item.layoutClass,
          extraCss:SCENE_01_02_TOOLS_CSS+'\n'+item.css});
        const container=options.container,settings=options.settings||{};
        // Original video container can be narrower than the native 100vw
        // seek range and is painted BEHIND the right-side info panel.
        // UI01 alone uses a top-level Zenza dialog overlay for real playback.
        const portal=item.id==='01'?
          container.closest?.('.zenzaVideoPlayerDialog'):null;
        const render=card.render.bind(card),mount=card.mount.bind(card);
        const dispose=card.dispose.bind(card);
        // The legacy bottom is resolved BEFORE moving the card from its
        // original player containing block into the viewport-level portal.
        let originalPlayerBottom=options.mode==='normal'?38:68;
        return {
          get root(){return card.root;},
          mount(state){
            mount(state);
            if(portal&&card.root){
              const oldComputed=options.document.defaultView?.
                getComputedStyle?.(card.root);
              const measured=Number.parseFloat(oldComputed?.bottom);
              if(Number.isFinite(measured)&&measured>=0){
                originalPlayerBottom=measured;
              }
              card.root.dataset.scuiPortal='1';
              // Native fullscreen targets NicoVideoPlayer._parentNode, which
              // is THIS player container, not the outer Zenza dialog.
              // Portal nodes outside that subtree disappear in fullscreen.
              const owner=options.mode==='fullscreen'?container:portal;
              owner.appendChild(card.root);
            }
            container.dataset.sceneSearchLayout=item.id;
            container.dataset.sceneMode=options.mode;
            this.render(state);
          },
          render(state){
            render(state);
            if(!card.root)return;
            const geometry=(item.id==='01'?
              settings.getSeekGeometryUnclipped?.():null) ||
              settings.getSeekGeometry?.();
            const width=container.offsetWidth ||
              container.getBoundingClientRect?.().width ||
              container.clientWidth||800;
            const compact=state.seekStepSeconds===0;
            const frameWidth=compact?124:180;
            if(item.id==='01'){
              const duration=typeof settings.getDuration==='function'?
                settings.getDuration():settings.duration;
              const pct=Number.isFinite(duration)&&duration>0?
                Math.max(0,Math.min(1,state.time/duration)):0.5;
              // Use the actual seekbar's screen geometry. In embedded/small
              // modes the seekbar and the player container need not have equal
              // widths or origins; the old width*pct assumption drifted.
              // Geometry is expressed in the host's CSS coordinate space.
              // The native seek track can extend beyond the video container,
              // so only the real viewport bounds (not the video width) apply.
              const validViewport=Number.isFinite(geometry?.visibleLeft)&&
                Number.isFinite(geometry?.visibleRight)&&
                geometry.visibleRight>geometry.visibleLeft;
              const visibleLeft=validViewport?geometry.visibleLeft:0;
              const visibleRight=validViewport?geometry.visibleRight:width;
              const available=visibleRight-visibleLeft;
              const usable=Math.max(0,Math.min(frameWidth,available-12));
              const minX=visibleLeft+usable/2+6;
              const maxX=visibleRight-usable/2-6;
              const rawX=Number.isFinite(geometry?.pointerX)?
                geometry.pointerX:
                Number.isFinite(geometry?.seekLeft)&&
                Number.isFinite(geometry?.seekWidth)?
                  geometry.seekLeft+geometry.seekWidth*pct:width*pct;
              const clamp=x=>maxX>=minX?
                Math.max(minX,Math.min(maxX,x)):
                (visibleLeft+visibleRight)/2;
              let x=clamp(rawX);
              const previous=parseFloat(card.root.style.getPropertyValue('--scene-x'));
              // User-approved right-edge rule: keep the thumbnail LEFT of
              // the original comment pane and stop their GROUP at the screen
              // boundary. Neither side-switching nor above-stack is allowed.
              // Only UI01's coordinate calculation is changed.
              if(portal){
                const frameRect=container.getBoundingClientRect?.();
                const owner=options.mode==='fullscreen'?container:portal;
                const portalRect=owner.getBoundingClientRect?.();
                if(Number.isFinite(frameRect?.bottom)&&
                    Number.isFinite(portalRect?.bottom)){
                  const videoScale=container.offsetHeight>0&&frameRect.height>0?
                    frameRect.height/container.offsetHeight:1;
                  const portalScale=owner.offsetHeight>0&&portalRect.height>0?
                    portalRect.height/owner.offsetHeight:1;
                  const restoredBottom=(portalRect.bottom-frameRect.bottom+
                    originalPlayerBottom*videoScale)/portalScale;
                  if(Number.isFinite(restoredBottom)){
                    card.root.style.setProperty('--scene-viewport-bottom',
                      Math.round(restoredBottom)+'px');
                  }
                }
                const viewport=options.document.defaultView?.innerWidth||0;
                const screenScale=frameRect?.width>0?
                  frameRect.width/(container.offsetWidth||frameRect.width):1;
                if(viewport>0&&frameRect&&screenScale>0){
                  // Clamp the fixed-order pair as one group, so both panes
                  // remain visible even when the pointer reaches 95-100%.
                  // At narrow widths shrink the comment pane, not the seek
                  // range. Mode-specific list width is the native 350px cap.
                  const rootWidth=card.root.getBoundingClientRect?.().width||
                    card.root.offsetWidth||frameWidth;
                  const margin=8;
                  // Flow comments OVERLAY the scene image, so they occupy
                  // NO extra horizontal width. Only LIST mode reserves a
                  // separate right panel and stops the group at its edge.
                  const listMode=state.commentListMode===true;
                  const desiredPaneWidth=listMode?350:0;
                  const gap=listMode?8:0;
                  const paneWidth=listMode?
                    Math.max(1,Math.min(desiredPaneWidth,
                      viewport-margin*2-rootWidth-gap)):0;
                  const half=rootWidth/2;
                  const minCenter=margin+half;
                  const maxCenter=viewport-margin-gap-paneWidth-half;
                  const desired=frameRect.left+rawX*screenScale;
                  const last=state.pinned===true&&Number.isFinite(previous)?
                    frameRect.left+previous*screenScale:desired;
                  const screenX=maxCenter>=minCenter?
                    Math.max(minCenter,Math.min(maxCenter,last)):minCenter;
                  x=(screenX-frameRect.left)/screenScale;
                  card.root.style.setProperty('--scene-viewport-x',
                    Math.round(screenX)+'px');
                  card.root.style.setProperty('--scui-side-gap',
                    gap+'px');
                  card.root.style.setProperty('--scui-side-width',
                    paneWidth+'px');
                }
              }else if(state.pinned===true&&Number.isFinite(previous)){
                x=clamp(previous);
              }
              // The tool rail used to live in a 40px empty strip BETWEEN
              // thumbnail and comments. Now keep it LEFT of the thumbnail.
              // At the physical left edge use its existing inside-card
              // fallback so no button goes outside the viewport. The scene
              // and comment pane NEVER reverse sides.
              const railFitsLeft=x-visibleLeft>=usable/2+31;
              card.root.classList.toggle('is-tools-left',railFitsLeft);
              card.root.classList.toggle('is-tools-overlap',!railFitsLeft);
              card.root.style.setProperty('--scene-x',Math.round(x)+'px');
            }else{
              container.dataset.sceneNarrow=String(width<580);
              container.style.setProperty('--scene-bottom',
                options.mode==='fullscreen'?
                  'calc(var(--zenza-control-bar-height,40px) + 28px)':'42px');
            }
          },
          onPreview:(asset,meta)=>card.onPreview(asset,meta),
          dispose(){
            dispose();
            if(container.dataset.sceneSearchLayout===item.id){
              delete container.dataset.sceneSearchLayout;
              delete container.dataset.sceneMode;
              delete container.dataset.sceneNarrow;
              container.style.removeProperty('--scene-bottom');
            }
          }
        };
      }
    });
  }
  return registry;
}
//===END===
export {registerSceneLayouts01_02};
