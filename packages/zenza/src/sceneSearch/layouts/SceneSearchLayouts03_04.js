// SCUI-13: 03 side shelf / 04 top edge.
// Layout-specific CSS only; input/timer/thumbnail ownership stays in shared card.
//===BEGIN===
class SceneSearchLayouts03_04 {
  static get DESCRIPTORS() {
    return [
      {id:'03',label:'サイドシェルフ',
        description:'通常画面は動画右端、全画面は右下端の専用棚。縦移動を短くする'},
      {id:'04',label:'トップエッジ',
        description:'通常は動画上部付近、全画面では安全余白を取った上端固定'}
    ];
  }
  static install(registry,Card) {
    if(!registry?.register || typeof Card!=='function'){
      throw new TypeError('Side shelf layouts require the common registry and card');
    }
    const [shelf,top]=this.DESCRIPTORS;
    registry.register({...shelf,factory:args=>new Card({...args,
      layoutClass:'zenzaSceneSideShelf',extraCss:this.SHELF_STYLE})});
    registry.register({...top,factory:args=>new Card({...args,
      layoutClass:'zenzaSceneTopEdge',extraCss:this.TOP_STYLE})});
    return registry;
  }
  static get SHELF_STYLE() {
    return `
/* 03: compact side shelf; no invisible full-width input layer */
.zenzaSceneSearchHost.zenzaSceneSideShelf {
  left:auto;right:12px;transform:none;
  width:min(220px,calc(100% - 24px));
  bottom:calc(var(--scene-bottom,64px) + 18px);
  border-left:3px solid #7fbce8;
  transform-origin:right bottom;
  animation:zenzaShelfEnter .17s ease-out both;
}
.zenzaSceneSearchHost.zenzaSceneSideShelf[data-mode="fullscreen"] {
  position:fixed;
  right:max(12px,env(safe-area-inset-right));
  bottom:calc(var(--scene-bottom,64px) + 26px);
  width:min(232px,calc(100vw - 24px));
}
.zenzaSceneSearchHost.zenzaSceneSideShelf .zenzaSceneFoot{
  display:grid;grid-template-columns:auto 1fr;gap:5px;
}
.zenzaSceneSearchHost.zenzaSceneSideShelf .zenzaSceneActions{justify-content:end}
.zenzaSceneSearchHost.zenzaSceneSideShelf.is-compact {
  width:min(124px,calc(100% - 24px));
}
@keyframes zenzaShelfEnter{
  from{opacity:.3;translate:6px 0}
  to{opacity:1;translate:0 0}
}
@media (max-width:600px){
 .zenzaSceneSearchHost.zenzaSceneSideShelf,
 .zenzaSceneSearchHost.zenzaSceneSideShelf[data-mode="fullscreen"]{
   right:6px;bottom:calc(var(--scene-bottom,64px) + 6px);
   max-width:calc(100vw - 12px)}
}
@media (prefers-reduced-motion:reduce){
 .zenzaSceneSearchHost.zenzaSceneSideShelf{animation:none}
}
`;
  }
  static get TOP_STYLE() {
    return `
/* 04: anchored near the video top, away from busy playback buttons */
.zenzaSceneSearchHost.zenzaSceneTopEdge {
  left:50%;right:auto;top:auto;
  bottom:calc(var(--scene-video-height,360px) - 16px);
  width:min(238px,calc(100% - 24px));
  transform:translate(-50%,0);
  transform-origin:center top;
  border-top:3px solid #8bb6d8;
  animation:zenzaTopCardEnter .16s ease-out both;
}
.zenzaSceneSearchHost.zenzaSceneTopEdge[data-mode="fullscreen"] {
  position:fixed;
  left:50%;top:max(12px,env(safe-area-inset-top));bottom:auto;
  width:min(260px,calc(100vw - 32px));
}
/* A top-edge card unfolds tools downward, never outside the top viewport. */
.zenzaSceneSearchHost.zenzaSceneTopEdge .zenzaSceneBtn.scene-pin,
.zenzaSceneSearchHost.zenzaSceneTopEdge .zenzaSceneBtn.scene-comment-toggle,
.zenzaSceneSearchHost.zenzaSceneTopEdge .zenzaSceneBtn.scene-comment-search,
.zenzaSceneSearchHost.zenzaSceneTopEdge .zenzaSceneBtn.scene-seek-step{
  top:100%;bottom:auto;
}
.zenzaSceneSearchHost.zenzaSceneTopEdge .zenzaSceneImage{
  max-height:110px;
}
.zenzaSceneSearchHost.zenzaSceneTopEdge.is-compact{
  width:min(124px,calc(100% - 24px));
}
@keyframes zenzaTopCardEnter{
  from{opacity:.3;translate:0 -5px}
  to{opacity:1;translate:0 0}
}
@media (max-width:600px){
 .zenzaSceneSearchHost.zenzaSceneTopEdge{
   bottom:calc(var(--scene-bottom,64px) + 60px)}
 .zenzaSceneSearchHost.zenzaSceneTopEdge[data-mode="fullscreen"]{
   top:max(5px,env(safe-area-inset-top));bottom:auto}
}
@media (prefers-reduced-motion:reduce){
 .zenzaSceneSearchHost.zenzaSceneTopEdge{animation:none}
}
`;
  }
}
//===END===
export {SceneSearchLayouts03_04};