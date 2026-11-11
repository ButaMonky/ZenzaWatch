'use strict';
// Only registered preferences cross partitions; never arbitrary storage/history.
function createDisplaySettings(w, gm, registered=[]) {
  const slot='settings-v2',savedSlot='trial-settings-v2',prefix='ZenzaWatchExternalTrial_';
  const names=new Set([...registered,'screenMode','menuScale','videoHeader.position']);
  const excluded=new Set(['debug','message','lastPlayerId','lastWatchId','videoSearch.word']);
  const allowed=k=>!excluded.has(k)&&(names.has(k)||/^(?:ui\.|KEY_|PARAM_CUSTOM_SEEK_\d+$|commentHistory\.|video\.hls\.)/.test(k));
  function valid(value,depth=0){
    if(depth>12)return false;
    if(value===null||typeof value==='boolean')return true;
    if(typeof value==='number')return Number.isFinite(value);
    if(typeof value==='string')return value.length<=32768;
    if(Array.isArray(value))return value.length<=2000&&value.every(v=>valid(v,depth+1));
    if(value&&typeof value==='object')return Object.keys(value).length<=2000&&Object.entries(value).every(([k,v])=>!['__proto__','constructor','prototype'].includes(k)&&valid(v,depth+1));
    return false;
  }
  const clean=values=>Object.fromEntries(Object.entries(values||{}).filter(([k,v])=>allowed(k)&&valid(v)&&JSON.stringify(v).length<=131072));
  const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  function read(storagePrefix){
    const values={};
    for(let i=0;i<w.localStorage.length;i++){
      const key=w.localStorage.key(i);if(!key.startsWith(storagePrefix))continue;
      const name=key.slice(storagePrefix.length);if(!allowed(name))continue;
      try{values[name]=JSON.parse(w.localStorage.getItem(key));}catch(_){}
    }
    return clean(values);
  }
  function publish(){
    if(w!==w.top||w.location.origin!=='https://www.nicovideo.jp')return;
    try{gm.set(slot,{version:2,values:read('ZenzaWatch_')});}catch(_){}
  }
  let official={},baseline={},publishOfficial=false,active=false,timer=null;
  function apply(){
    const snapshot=gm.get(slot),saved=gm.get(savedSlot);
    official=clean(snapshot?.version===2?snapshot.values:saved?.official);
    let values=saved?.version===2?clean(saved.values):read(prefix);
    const previous=clean(saved?.official);
    baseline=clean(saved?.values);publishOfficial=snapshot?.version===2;
    // Unrelated official changes must not reset trial HLS/panel adjustments.
    for(const key of new Set([...Object.keys(previous),...Object.keys(official)])){
      if(!saved||!equal(previous[key],official[key])){
        if(Object.hasOwn(official,key))values[key]=official[key];else delete values[key];
      }
    }
    for(const key of Object.keys(w.localStorage))if(key.startsWith(prefix)&&allowed(key.slice(prefix.length)))w.localStorage.removeItem(key);
    for(const [key,value] of Object.entries(values))w.localStorage.setItem(prefix+key,JSON.stringify(value));
    active=true;save();return snapshot?.version===2;
  }
  function save(){
    if(!active)return;
    if(timer!==null){w.clearTimeout(timer);timer=null;}
    const latest=gm.get(savedSlot),values=clean(latest?.values),local=read(prefix);
    // Another external page may have saved since this player opened. Merge
    // only local changes; closing a stale player must not revert them.
    for(const key of new Set([...Object.keys(baseline),...Object.keys(local)])){
      if(!equal(baseline[key],local[key])){
        if(Object.hasOwn(local,key))values[key]=local[key];else delete values[key];
      }
    }
    gm.set(savedSlot,{version:2,official:publishOfficial?official:clean(latest?.official),values});
    baseline=local;publishOfficial=false;
  }
  function scheduleSave(){
    if(!active||timer!==null)return;
    timer=w.setTimeout(()=>{timer=null;save();},250);
  }
  // Explicit player close also flushes: removed frames may skip pagehide.
  w.addEventListener('pagehide',save);
  return {publish,apply,save,scheduleSave};
}
module.exports={createDisplaySettings};
