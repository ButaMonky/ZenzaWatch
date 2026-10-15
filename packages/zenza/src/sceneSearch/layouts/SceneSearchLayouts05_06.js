// SCUI-14: 05 Playback Deck and 06 Micro Capsule.
 // A layout contains positioning CSS only, not its own thumbnail provider or timers.
//===BEGIN===
class SceneSearchLayouts05_06 {
  static register(registry,{Card}={}) {
    if(!registry || typeof registry.register!=='function' ||
       typeof Card!=='function') {
      throw new TypeError('Layout registry and shared semantic Card are required');
    }
    for(const [id,label,description,css] of [
      ['05','プレイバック・デッキ',
        'サムネイルと再生操作を横並びのコンパクトな操作デッキにまとめる。',
        SceneSearchLayouts05_06.CSS_05],
      ['06','マイクロ・カプセル',
        '小さなサムネイルと時刻だけを常時表示し、ボタンは操作時に展開する。',
        SceneSearchLayouts05_06.CSS_06]
    ]){
      registry.register({id,label,description,
        factory:({document,container,mode,onAction})=>new Card({
          document,container,id,mode,
          layoutClass:'zenzaLayout'+id,
          extraCss:css,
          onAction
        })});
    }
    return registry;
  }
  static get CSS_05() {return `
/* 05: A stable horizontal playback deck in either viewing mode. */
.zenzaSceneSearchHost[data-layout="05"]{
  --scene-bottom:70px;
  width:min(620px,calc(100% - 20px));
  max-width:calc(100% - 20px);
  display:grid;
  grid-template-columns:minmax(110px,162px) minmax(0,1fr);
  align-items:center;
  gap:10px;
  padding:8px;
}
.zenzaSceneSearchHost[data-layout="05"] .zenzaSceneImageBox{
  min-width:0;
  min-height:72px;
  border-radius:4px;
}
.zenzaSceneSearchHost[data-layout="05"] .zenzaSceneImage{
  height:74px;
  max-height:74px;
}
.zenzaSceneSearchHost[data-layout="05"] .zenzaSceneFoot{
  display:flex;
  flex-direction:column;
  align-items:stretch;
  justify-content:center;
  gap:9px;
}
.zenzaSceneSearchHost[data-layout="05"] .zenzaSceneTime{
  font-size:17px;
  font-weight:600;
}
.zenzaSceneSearchHost[data-layout="05"] .zenzaSceneActions{
  flex-wrap:wrap;
  gap:5px;
}
.zenzaSceneSearchHost[data-layout="05"] .zenzaSceneBtn{
  min-width:27px;
  min-height:27px;
}
.zenzaSceneSearchHost[data-layout="05"][data-mode="fullscreen"]{
  --scene-bottom:82px;
  width:min(720px,calc(100% - 28px));
  grid-template-columns:minmax(130px,200px) minmax(0,1fr);
}
.zenzaSceneSearchHost[data-layout="05"].is-compact{
  width:min(325px,calc(100% - 20px));
  grid-template-columns:minmax(65px,94px) minmax(0,1fr);
  gap:6px;
  padding:5px;
}
.zenzaSceneSearchHost[data-layout="05"].is-compact .zenzaSceneImageBox{
  min-height:39px;
}
.zenzaSceneSearchHost[data-layout="05"].is-compact .zenzaSceneImage{
  height:40px;
  max-height:40px;
}
.zenzaSceneSearchHost[data-layout="05"].is-compact .zenzaSceneTime{
  font-size:13px;
}
@media(max-width:420px){
 .zenzaSceneSearchHost[data-layout="05"]{
   grid-template-columns:minmax(65px,90px) minmax(0,1fr);
   gap:5px;padding:5px;
 }
 .zenzaSceneSearchHost[data-layout="05"] .zenzaSceneActions{gap:2px}
 .zenzaSceneSearchHost[data-layout="05"] .zenzaSceneBtn{min-width:24px}
}
`;}
  static get CSS_06() {return `
/* 06: Minimal floating capsule; no extra permanent control row. */
.zenzaSceneSearchHost[data-layout="06"]{
  --scene-bottom:70px;
  width:min(180px,calc(100% - 12px));
  max-width:calc(100% - 12px);
  border-radius:13px;
  padding:4px 5px;
  box-shadow:0 3px 14px #0006;
}
.zenzaSceneSearchHost[data-layout="06"] .zenzaSceneImageBox{
  min-height:55px;
  border-radius:8px;
}
.zenzaSceneSearchHost[data-layout="06"] .zenzaSceneImage{
  height:60px;max-height:60px;object-fit:cover;
}
.zenzaSceneSearchHost[data-layout="06"] .zenzaSceneFoot{
  min-height:24px;gap:3px;
}
.zenzaSceneSearchHost[data-layout="06"] .zenzaSceneActions{
  justify-content:end;flex-wrap:wrap;gap:2px;
}
.zenzaSceneSearchHost[data-layout="06"] .zenzaSceneBtn{
  min-width:21px;height:22px;border-radius:10px;
}
.zenzaSceneSearchHost[data-layout="06"][data-mode="fullscreen"]{
  --scene-bottom:84px;
}
.zenzaSceneSearchHost[data-layout="06"].is-compact{
  width:min(124px,calc(100% - 12px));
  padding:3px;
  border-radius:10px;
}
.zenzaSceneSearchHost[data-layout="06"].is-compact .zenzaSceneImageBox{
  min-height:35px;
}
.zenzaSceneSearchHost[data-layout="06"].is-compact .zenzaSceneImage{
  height:38px;max-height:38px;
}
.zenzaSceneSearchHost[data-layout="06"]:not(:hover):not(:focus-within):not(.is-expanded):not(.is-pinned)
  .zenzaSceneBtn:not(.scene-more){visibility:hidden;opacity:0;pointer-events:none;}
`;}
}
//===END===
export {SceneSearchLayouts05_06};