// SCUI-13: 03 side shelf / 04 top edge.
// Original 2026-10-14 demo: 03 right shelf (normal) / left shelf (full),
// 04 right top (normal) / top center (full). No independent media owners.
//===BEGIN===
class SceneSearchLayouts03_04 {
  static get DESCRIPTORS() {
    return [
      {id:'03',label:'サイドシェルフ',
        description:'通常は動画右端、全画面は動画左端。操作レールを画面内側に開く'},
      {id:'04',label:'トップエッジ',
        description:'通常は動画右上、全画面では上中央。操作列はカードの下へ展開'}
    ];
  }
  static install(registry,Card) {
    if(!registry?.register || typeof Card!=='function'){
      throw new TypeError('Side shelf layouts require the common registry and card');
    }
    const [shelf,top]=this.DESCRIPTORS;
    // The 'more' handle stays on the visible card; otherwise the closed
    // tool tray becomes impossible to open with keyboard or touch.
    class EdgeCard extends Card {
      mount(state){
        super.mount(state);
        const actions=this.root.querySelector('.zenzaSceneActions');
        const more=actions.querySelector('.scene-more');
        actions.parentElement.insertBefore(more,actions);
        this.render(state);
      }
      render(state){
        super.render(state);
        if(!this.root){return;}
        const width=this.container.getBoundingClientRect?.().width||
          this.container.clientWidth||800;
        this.root.dataset.scuiNarrow=String(width<440);
      }
    }
    registry.register({...shelf,factory:args=>new EdgeCard({...args,
      layoutClass:'zenzaSceneSideShelf',extraCss:this.SHELF_STYLE})});
    registry.register({...top,factory:args=>new EdgeCard({...args,
      layoutClass:'zenzaSceneTopEdge',extraCss:this.TOP_STYLE})});
    return registry;
  }
  static get SHELF_STYLE() {
    return `
/* Original 03: normal on video right, fullscreen on video left. */
.zenzaSceneSearchHost.zenzaSceneSideShelf{
  left:auto;right:12px;top:17%;bottom:auto;transform:none;
  width:min(193px,calc(100% - 24px));
  border-radius:9px;border-left:3px solid #7fbce8;
  transform-origin:right center;
}
.zenzaSceneSearchHost.zenzaSceneSideShelf[data-mode="fullscreen"]{
  position:absolute;left:15px;right:auto;top:32%;bottom:auto;
  transform:none;transform-origin:left center;
}
.zenzaSceneSearchHost.zenzaSceneSideShelf .zenzaSceneFoot{
  display:flex;justify-content:space-around;gap:5px;
}
.zenzaSceneSearchHost.zenzaSceneSideShelf .zenzaSceneActions{
  position:absolute;right:calc(100% - 1px);left:auto;top:7px;bottom:auto;
  display:flex;flex-direction:column;align-items:stretch;gap:4px;
  min-width:37px;width:max-content;padding:5px;
  background:#0c1c2d;border:1px solid #56748a;border-radius:9px;
  box-shadow:0 7px 18px #0008;
  opacity:0;visibility:hidden;pointer-events:none;
  transform:translateX(7px);
  transition:opacity .16s,visibility .16s,transform .2s ease;
}
.zenzaSceneSearchHost.zenzaSceneSideShelf[data-mode="fullscreen"] .zenzaSceneActions{
  right:auto;left:calc(100% - 1px);transform:translateX(-7px);
}
.zenzaSceneSearchHost.zenzaSceneSideShelf .zenzaSceneActions>.zenzaSceneBtn{
  position:static;left:auto;right:auto;top:auto;bottom:auto;
  opacity:1;visibility:inherit;pointer-events:inherit;
  transform:none;flex:0 0 auto;
}
.zenzaSceneSearchHost.zenzaSceneSideShelf:is(:hover,:focus-within,.is-expanded,.is-pinned) .zenzaSceneActions{
  opacity:1;visibility:visible;pointer-events:auto;transform:translateX(0);
}
.zenzaSceneSearchHost.zenzaSceneSideShelf[data-scene-reveal="click"]:not(.is-expanded):not(.is-pinned) .zenzaSceneActions{
  opacity:0!important;visibility:hidden!important;pointer-events:none!important;
}
.zenzaSceneSearchHost.zenzaSceneSideShelf.is-compact{
  width:min(114px,calc(100% - 24px));
}
.zenzaSceneSearchHost.zenzaSceneSideShelf[data-scui-narrow="true"] .zenzaSceneActions{
  right:0;left:auto;top:calc(100% - 1px);bottom:auto;
  width:100%;min-width:0;flex-flow:row wrap;justify-content:center;
  transform:translateY(-7px);
}
.zenzaSceneSearchHost.zenzaSceneSideShelf[data-mode="fullscreen"][data-scui-narrow="true"] .zenzaSceneActions{
  right:auto;left:0;
}
.zenzaSceneSearchHost.zenzaSceneSideShelf[data-scui-narrow="true"]:is(:hover,:focus-within,.is-expanded,.is-pinned) .zenzaSceneActions{
  transform:translateY(0);
}
@media(prefers-reduced-motion:reduce){
  .zenzaSceneSearchHost.zenzaSceneSideShelf .zenzaSceneActions{transition:none}
}
`;
  }
  static get TOP_STYLE() {
    return `
/* Original 04: normal on right top; fullscreen at screen top center. */
.zenzaSceneSearchHost.zenzaSceneTopEdge{
  left:auto;right:16px;top:17px;bottom:auto;transform:none;
  width:min(217px,calc(100% - 32px));
  border-radius:14px;border-top:3px solid #8bb6d8;
  transform-origin:center top;
}
.zenzaSceneSearchHost.zenzaSceneTopEdge[data-mode="fullscreen"]{
  position:absolute;left:50%;right:auto;
  top:max(17px,env(safe-area-inset-top));bottom:auto;
  transform:translateX(-50%);
}
.zenzaSceneSearchHost.zenzaSceneTopEdge .zenzaSceneFoot{
  justify-content:space-between;gap:6px;
}
.zenzaSceneSearchHost.zenzaSceneTopEdge .zenzaSceneActions{
  position:absolute;left:50%;right:auto;
  top:calc(100% - 1px);bottom:auto;
  display:flex;flex-flow:row wrap;justify-content:center;gap:4px;
  width:max-content;max-width:100%;min-width:0;
  padding:5px;background:#0c1c2d;border:1px solid #56748a;
  border-radius:9px;box-shadow:0 7px 18px #0008;
  opacity:0;visibility:hidden;pointer-events:none;
  transform:translate(-50%,-7px);
  transition:opacity .16s,visibility .16s,transform .2s ease;
}
.zenzaSceneSearchHost.zenzaSceneTopEdge .zenzaSceneActions>.zenzaSceneBtn{
  position:static;left:auto;right:auto;top:auto;bottom:auto;
  opacity:1;visibility:inherit;pointer-events:inherit;
  transform:none;flex:0 0 auto;
}
.zenzaSceneSearchHost.zenzaSceneTopEdge:is(:hover,:focus-within,.is-expanded,.is-pinned) .zenzaSceneActions{
  opacity:1;visibility:visible;pointer-events:auto;
  transform:translate(-50%,0);
}
.zenzaSceneSearchHost.zenzaSceneTopEdge[data-scene-reveal="click"]:not(.is-expanded):not(.is-pinned) .zenzaSceneActions{
  opacity:0!important;visibility:hidden!important;pointer-events:none!important;
}
/* Opening the step submenu from a top-edge card must stay under the card. */
.zenzaSceneSearchHost.zenzaSceneTopEdge .zenzaSceneStepPopup{
  top:calc(100% + 6px);bottom:auto;right:0;
}
.zenzaSceneSearchHost.zenzaSceneTopEdge .zenzaSceneImage{max-height:110px;}
.zenzaSceneSearchHost.zenzaSceneTopEdge.is-compact{
  width:min(125px,calc(100% - 24px));
}
.zenzaSceneSearchHost.zenzaSceneTopEdge[data-scui-narrow="true"] .zenzaSceneActions{
  width:100%;box-sizing:border-box;
}
@media(prefers-reduced-motion:reduce){
  .zenzaSceneSearchHost.zenzaSceneTopEdge .zenzaSceneActions{transition:none}
}
`;
  }
}
//===END===
export {SceneSearchLayouts03_04};