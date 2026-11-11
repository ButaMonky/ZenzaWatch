'use strict';
// Only presentation preferences cross the storage partition. No history,
// account identifiers, custom links, scripts, or authentication material.
function createDisplaySettings(w, gm) {
  const slot='display-settings-v1';
  const names=new Set(['screenMode','screenMode:ginza','screenMode:others','menuScale',
    'smallModeOffsetX','smallModeOffsetY','smallModeWidth','smallModeHeight','smallModeAspectLock',
    'fullscreenControlBarMode','videoInfoPanelTab','showComment','backComment','enableHeatMap',
    'enableStoryboard','enableStoryboardBar','enableCommentPanel','enableCommentPanelAutoScroll',
    'baseFontFamily','baseChatScale','baseFontBolder','cssFontWeight','commentLayerOpacity','commentSpeedRate']);
  const allowed=k=>names.has(k)||/^(?:ui\.|controlBar\.|popup\.|bookmark\.(?:show|thumbnail|title))/.test(k);
  const valid=v=>typeof v==='boolean'||typeof v==='number'&&Number.isFinite(v)||typeof v==='string'&&v.length<=512;
  function publish() {
    if(w!==w.top||w.location.origin!=='https://www.nicovideo.jp')return;
    const values={};
    try {
      for(let i=0;i<w.localStorage.length;i++){
        const key=w.localStorage.key(i);if(!key.startsWith('ZenzaWatch_'))continue;
        const name=key.slice(11);if(!allowed(name))continue;
        try{const value=JSON.parse(w.localStorage.getItem(key));if(valid(value))values[name]=value;}catch(_){}
      }
      gm.set(slot,{version:1,values});
    } catch(_) { /* Storage may be unavailable; keep the last valid snapshot. */ }
  }
  function apply() {
    const snapshot=gm.get(slot);if(snapshot?.version!==1||!snapshot.values)return false;
    const values=Object.fromEntries(Object.entries(snapshot.values).filter(([key,value])=>allowed(key)&&valid(value)));
    const stamp=JSON.stringify(Object.entries(values).sort(([a],[b])=>a.localeCompare(b)));
    const marker='ZenzaWatchExternalTrial_displaySnapshot';
    if(w.localStorage.getItem(marker)===stamp)return true;
    const prefix='ZenzaWatchExternalTrial_';
    for(const key of Object.keys(w.localStorage))if(key.startsWith(prefix)&&allowed(key.slice(prefix.length)))w.localStorage.removeItem(key);
    for(const [key,value] of Object.entries(values))w.localStorage.setItem(prefix+key,JSON.stringify(value));
    w.localStorage.setItem(marker,stamp);
    return true;
  }
  return {publish,apply};
}
module.exports={createDisplaySettings};
