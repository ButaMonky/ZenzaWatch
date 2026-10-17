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
/* The comment preview stays separate on the right, without losing
   its original click-through stacking relative to the scene preview. */
[data-scene-search-layout="02"] .zenzaCommentPreview{
  left:auto!important;right:12px;max-width:calc(100% - 24px);
  bottom:var(--scene-bottom,64px)!important;
  transform:none!important;
}
[data-scene-search-layout="02"][data-scene-narrow="true"] .zenzaCommentPreview{
  right:12px;bottom:calc(var(--scene-bottom,64px) + 140px)!important;
}
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
      description:'シーンを左、コメントを右へ分離。狭い画面は上下に退避',
      layoutClass:'zenzaSceneLayout02',css:SCENE_LAYOUT02_CSS}
  ]){
    registry.register({id:item.id,label:item.name,description:item.description,
      factory:options=>{
        const card=new SceneSearchLayoutCard({...options,
          layoutClass:item.layoutClass,
          extraCss:SCENE_01_02_TOOLS_CSS+'\n'+item.css});
        const container=options.container,settings=options.settings||{};
        const render=card.render.bind(card),mount=card.mount.bind(card);
        const dispose=card.dispose.bind(card);
        return {
          get root(){return card.root;},
          mount(state){
            mount(state);
            container.dataset.sceneSearchLayout=item.id;
            container.dataset.sceneMode=options.mode;
            this.render(state);
          },
          render(state){
            render(state);
            if(!card.root)return;
            const geometry=settings.getSeekGeometry?.();
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
              const visibleLeft=Math.max(0,Math.min(width,
                Number.isFinite(geometry?.visibleLeft)?geometry.visibleLeft:0));
              const visibleRight=Math.max(visibleLeft,Math.min(width,
                Number.isFinite(geometry?.visibleRight)?geometry.visibleRight:width));
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
              const x=clamp(rawX);
              const previous=parseFloat(card.root.style.getPropertyValue('--scene-x'));
              const fixed=state.pinned===true&&Number.isFinite(previous)?
                clamp(previous):x;
              // The original HTML flips its tool rail to the left at the
              // right edge instead of permanently losing 35px of seek range.
              const railClearance=usable/2+35;
              const canRight=visibleRight-fixed>=railClearance;
              const canLeft=fixed-visibleLeft>=railClearance;
              card.root.classList.toggle('is-tools-left',!canRight&&canLeft);
              card.root.classList.toggle('is-tools-overlap',!canRight&&!canLeft);
              card.root.style.setProperty('--scene-x',Math.round(fixed)+'px');
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
