import {externalDefaults,sanitizeExternal} from './settings';
interface PreferenceStore {get(key:string):unknown;set(key:string,value:unknown):void;listen?(key:string,fn:()=>void):unknown;unlisten?(id:unknown):void;}
/** Synchronize only public external-launch preferences, never account/runtime data. */
export function connectOfficialExternalSettings(w:Window,gm:PreferenceStore):()=>void {
 const slot='external-links-v1',prefix='ZenzaWatch_',keys=Object.keys(externalDefaults);
 let syncing=false;
 const readLocal=()=>Object.fromEntries(keys.flatMap(key=>{try{const raw=w.localStorage.getItem(prefix+key);return raw===null?[]:[[key,JSON.parse(raw)]];}catch{return [];}}));
 const publish=(changed:string[])=>{
  const local=readLocal(),patch=Object.fromEntries(changed.filter(key=>keys.includes(key)&&Object.prototype.hasOwnProperty.call(local,key)).map(key=>[key,local[key]]));
  if(Object.keys(patch).length)gm.set(slot,sanitizeExternal({...sanitizeExternal(gm.get(slot)),...patch}));
 };
 const pull=()=>{
  if(syncing)return;syncing=true;
  try{
   if(!gm.get(slot))publish(Object.keys(readLocal()));
   const values=sanitizeExternal(gm.get(slot));
   for(const key of keys)w.localStorage.setItem(prefix+key,JSON.stringify(values[key as keyof typeof values]));
   w.dispatchEvent(new (w as Window & typeof globalThis).CustomEvent('ZenzaWatch-advanced-settings-saved',{detail:{keys}}));
  }finally{syncing=false;}
 };
 const onSave=(event:Event)=>{
  if(syncing)return;
  const changed=(event as CustomEvent<{keys?:unknown}>).detail?.keys;
  if(Array.isArray(changed))publish(changed.filter((key):key is string=>typeof key==='string'));
 };
 w.addEventListener('ZenzaWatch-advanced-settings-saved',onSave);
 const subscription=gm.listen?.(slot,pull);pull();
 return ()=>{w.removeEventListener('ZenzaWatch-advanced-settings-saved',onSave);if(subscription!==undefined)gm.unlisten?.(subscription);};
}
