// SCUI-14: 05 Playback Deck and 06 Micro Capsule.
// Placement uses the real seekbar geometry; no new thumbnail workers or timers.
//===BEGIN===
class SceneSearchLayouts05_06 {
  static register(registry,{Card}={}) {
    if(!registry || typeof registry.register!=='function' ||
       typeof Card!=='function') {
      throw new TypeError('Layout registry and shared semantic Card are required');
    }
    class DeckCapsuleCard extends Card {
      constructor(args){
        super(args);
        this.settings=args.settings||{};
      }
      mount(state){
        super.mount(state);
        const foot=this.root.querySelector('.zenzaSceneFoot');
        const actions=this.root.querySelector('.zenzaSceneActions');
        // Keep seek-by and the expansion handle usable while extra tools
        // are collapsed, as in the original 10-design HTML.
        for(const key of ['seek-back','seek-forward','more']){
          const button=actions.querySelector('[data-scui-action="'+key+'"]');
          if(button)foot.insertBefore(button,actions);
        }
        this.render(state);
      }
      render(state){
        super.render(state);
        if(!this.root){return;}
        if(this.id==='05'){
          const rect=this.container.getBoundingClientRect?.();
          const viewportHeight=this.document.defaultView?.innerHeight;
          const expectedHeight=this.root.getBoundingClientRect?.().height||138;
          const room=Number.isFinite(viewportHeight)&&Number.isFinite(rect?.bottom)?
            viewportHeight-rect.bottom:Infinity;
          // Zenza's normal playback mode often hides overflow. Never lose
          // the deck below the window when there is insufficient space.
          this.root.dataset.scuiPlacement=this.mode==='normal'&&
            room<expectedHeight+16?'visible-fallback':'below';
        }else if(this.id==='06'){
          this._placeCapsule(state);
        }
      }
      _placeCapsule(state){
        const geometry=this.settings.getSeekGeometry?.();
        const width=this.container.offsetWidth||
          this.container.getBoundingClientRect?.().width||
          this.container.clientWidth||800;
        const duration=typeof this.settings.getDuration==='function'?
          this.settings.getDuration():this.settings.duration;
        const pct=Number.isFinite(duration)&&duration>0?
          Math.max(0,Math.min(1,(state?.time||0)/duration)):0.5;
        const cardWidth=state?.seekStepSeconds===0?98:166;
        const visibleLeft=Math.max(0,Math.min(width,
          Number.isFinite(geometry?.visibleLeft)?geometry.visibleLeft:0));
        const visibleRight=Math.max(visibleLeft,Math.min(width,
          Number.isFinite(geometry?.visibleRight)?geometry.visibleRight:width));
        const minX=visibleLeft+Math.min(cardWidth/2+6,(visibleRight-visibleLeft)/2);
        const maxX=visibleRight-Math.min(cardWidth/2+6,(visibleRight-visibleLeft)/2);
        const target=Number.isFinite(geometry?.pointerX)?geometry.pointerX:
          Number.isFinite(geometry?.seekLeft)&&Number.isFinite(geometry?.seekWidth)?
            geometry.seekLeft+geometry.seekWidth*pct:width*pct;
        const previous=parseFloat(this.root.style.getPropertyValue('--scene-x'));
        const raw=state?.pinned&&Number.isFinite(previous)?previous:target;
        const x=Math.max(minX,Math.min(maxX,raw));
        this.root.style.setProperty('--scene-x',Math.round(x)+'px');
      }
    }
    for(const [id,label,description,css] of [
      ['05','プレイバック・デッキ',
        '通常は動画の外・下、全画面ではシークバー直上の横長操作デッキ。',
        SceneSearchLayouts05_06.CSS_05],
      ['06','マイクロ・カプセル',
        '小型カプセルがシーク位置へ追従し、追加操作は上に展開。',
        SceneSearchLayouts05_06.CSS_06]
    ]){
      registry.register({id,label,description,
        factory:args=>new DeckCapsuleCard({...args,id,
          layoutClass:'zenzaLayout'+id,extraCss:css})});
    }
    return registry;
  }
  static get CSS_05() {return `
/* Original 05: outside/below in normal, above seekbar in fullscreen. */
.zenzaSceneSearchHost[data-layout="05"]{
  left:50%;right:auto;top:calc(100% + 12px);bottom:auto;
  transform:translateX(-50%);
  width:min(480px,calc(100% - 20px));max-width:calc(100% - 20px);
  display:grid;grid-template-columns:minmax(100px,160px) minmax(0,1fr);
  align-items:center;gap:11px;padding:9px 12px;border-radius:13px;
  background:#102136f3;
}
.zenzaSceneSearchHost[data-layout="05"] .zenzaSceneImageBox{
  min-width:0;min-height:72px;border-radius:7px;
}
.zenzaSceneSearchHost[data-layout="05"] .zenzaSceneImage{
  height:90px;max-height:90px;object-fit:cover;
}
.zenzaSceneSearchHost[data-layout="05"] .zenzaSceneFoot{
  display:flex;align-items:center;justify-content:center;
  flex-flow:row wrap;gap:5px;min-width:0;
}
.zenzaSceneSearchHost[data-layout="05"] .zenzaSceneTime{
  font-size:14px;font-weight:700;order:2;
}
.zenzaSceneSearchHost[data-layout="05"] .scene-seek-back{order:1}
.zenzaSceneSearchHost[data-layout="05"] .scene-seek-forward{order:3}
.zenzaSceneSearchHost[data-layout="05"] .scene-more{order:4}
.zenzaSceneSearchHost[data-layout="05"] .zenzaSceneActions{
  position:absolute;left:auto;right:8px;
  top:calc(100% - 1px);bottom:auto;
  display:flex;flex-flow:row wrap;justify-content:center;gap:4px;
  width:max-content;max-width:calc(100% - 16px);
  padding:5px;border-radius:9px;background:#102136;
  border:1px solid #56748a;box-shadow:0 8px 20px #0008;
  opacity:0;visibility:hidden;pointer-events:none;
  transform:translateY(-8px);
  transition:transform .18s,opacity .18s,visibility .18s;
}
.zenzaSceneSearchHost[data-layout="05"] .zenzaSceneActions>.zenzaSceneBtn{
  position:static;left:auto;right:auto;top:auto;bottom:auto;
  opacity:1;visibility:inherit;pointer-events:inherit;transform:none;
}
.zenzaSceneSearchHost[data-layout="05"]:is(:hover,:focus-within,.is-expanded,.is-pinned) .zenzaSceneActions{
  opacity:1;visibility:visible;pointer-events:auto;transform:translateY(0);
}
.zenzaSceneSearchHost[data-layout="05"][data-scene-reveal="click"]:not(.is-expanded):not(.is-pinned) .zenzaSceneActions{
  opacity:0!important;visibility:hidden!important;pointer-events:none!important;
}
/* Window-filling Zenza modes do not reserve a row below video. Keep the
   original below placement whenever it fits, otherwise use a visible dock. */
.zenzaSceneSearchHost[data-layout="05"][data-scui-placement="visible-fallback"]{
  top:auto;bottom:70px;
}
.zenzaSceneSearchHost[data-layout="05"][data-mode="fullscreen"]{
  top:auto;bottom:79px;
}
.zenzaSceneSearchHost[data-layout="05"].is-compact{
  width:min(245px,calc(100% - 20px));
  grid-template-columns:minmax(65px,92px) minmax(0,1fr);
  gap:6px;padding:5px;
}
.zenzaSceneSearchHost[data-layout="05"].is-compact .zenzaSceneImageBox{min-height:40px}
.zenzaSceneSearchHost[data-layout="05"].is-compact .zenzaSceneImage{height:51px;max-height:51px}
.zenzaSceneSearchHost[data-layout="05"].is-compact .zenzaSceneTime{font-size:12px}
@media(max-width:420px){
  .zenzaSceneSearchHost[data-layout="05"]{
    grid-template-columns:minmax(58px,95px) minmax(0,1fr);gap:5px;padding:5px;
  }
  .zenzaSceneSearchHost[data-layout="05"] .zenzaSceneFoot{gap:2px}
  .zenzaSceneSearchHost[data-layout="05"] .zenzaSceneBtn{min-width:22px}
}
@media(prefers-reduced-motion:reduce){
  .zenzaSceneSearchHost[data-layout="05"] .zenzaSceneActions{transition:none}
}
`;}
  static get CSS_06() {return `
/* Original 06: micro-capsule follows the true seekbar mouse coordinate. */
.zenzaSceneSearchHost[data-layout="06"]{
  left:var(--scene-x,50%);right:auto;top:auto;bottom:86px;
  transform:translateX(-50%);
  width:min(166px,calc(100% - 12px));max-width:calc(100% - 12px);
  border-radius:99px;padding:5px;
  background:#0c1929f3;box-shadow:0 3px 14px #0006;
}
.zenzaSceneSearchHost[data-layout="06"][data-mode="fullscreen"]{bottom:92px}
.zenzaSceneSearchHost[data-layout="06"] .zenzaSceneImageBox{
  min-height:56px;height:56px;border-radius:99px;
}
.zenzaSceneSearchHost[data-layout="06"] .zenzaSceneImage{
  height:56px;max-height:56px;object-fit:cover;
}
.zenzaSceneSearchHost[data-layout="06"] .zenzaSceneFoot{
  min-height:23px;gap:2px;justify-content:center;
}
.zenzaSceneSearchHost[data-layout="06"] .zenzaSceneTime{
  font-size:10px;min-width:36px;text-align:center;
}
.zenzaSceneSearchHost[data-layout="06"] .zenzaSceneFoot>.zenzaSceneBtn{
  min-width:20px;height:22px;font-size:11px;border-radius:99px;
}
.zenzaSceneSearchHost[data-layout="06"] .zenzaSceneActions{
  position:absolute;left:50%;right:auto;top:auto;
  bottom:calc(100% - 1px);
  display:flex;flex-flow:row wrap;justify-content:center;gap:4px;
  width:max-content;max-width:calc(100vw - 16px);min-width:0;
  padding:5px;border:1px solid #526c87;border-radius:99px;
  background:#0a1b2ced;box-shadow:0 8px 18px #0009;
  opacity:0;visibility:hidden;pointer-events:none;
  transform:translate(-50%,12px);
  transition:transform .18s,opacity .18s,visibility .18s;
}
.zenzaSceneSearchHost[data-layout="06"] .zenzaSceneActions>.zenzaSceneBtn{
  position:static;left:auto;right:auto;top:auto;bottom:auto;
  min-width:22px;height:22px;border-radius:99px;
  opacity:1;visibility:inherit;pointer-events:inherit;transform:none;
}
.zenzaSceneSearchHost[data-layout="06"]:is(:hover,:focus-within,.is-expanded,.is-pinned) .zenzaSceneActions{
  opacity:1;visibility:visible;pointer-events:auto;transform:translate(-50%,0);
}
.zenzaSceneSearchHost[data-layout="06"][data-scene-reveal="click"]:not(.is-expanded):not(.is-pinned) .zenzaSceneActions{
  opacity:0!important;visibility:hidden!important;pointer-events:none!important;
}
.zenzaSceneSearchHost[data-layout="06"].is-compact{
  width:min(98px,calc(100% - 12px));padding:3px;
}
.zenzaSceneSearchHost[data-layout="06"].is-compact .zenzaSceneImageBox{
  min-height:39px;height:39px;
}
.zenzaSceneSearchHost[data-layout="06"].is-compact .zenzaSceneImage{
  height:39px;max-height:39px;
}
.zenzaSceneSearchHost[data-layout="06"].is-compact .zenzaSceneActions{
  width:100%;box-sizing:border-box;
}
@media(prefers-reduced-motion:reduce){
  .zenzaSceneSearchHost[data-layout="06"] .zenzaSceneActions{transition:none}
}
`;}
}
//===END===
export {SceneSearchLayouts05_06};