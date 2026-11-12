import type {CheckVideo} from './preflight';
import {ExternalSettings,siteEnabled} from './settings';
import {linkTargets} from './targets';
const excluded='input,textarea,select,button,pre,code,[contenteditable]:not([contenteditable="false"]),[role="textbox"],svg';
// Own only the inserted siblings. Never wrap, rewrite or replace source links.
export function mountInlineButtons(w:Window & typeof globalThis,s:ExternalSettings,open:(id:string,e:Event)=>Promise<unknown>,check?:CheckVideo):{dispose():void} {
 if(s.activation!=='inline'||!siteEnabled(w.location.href,s))return {dispose(){}};
 const d=w.document,owned=new Map<Element,HTMLElement>(),pending=new Set<Element>();
 const observed=new Map<Element,()=>void>();
 const visible=typeof w.IntersectionObserver==='function'?new w.IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){visible!.unobserve(entry.target);const job=observed.get(entry.target);observed.delete(entry.target);job?.();}}):null;
 let disposed=false,timer:number|undefined,busy=false;
 const ids=(a:Element)=>a.isConnected&&!a.closest(excluded)?linkTargets(a.getAttribute('href')||'',d.baseURI,s):[];
 function update(a:Element){
  const old=owned.get(a);
  if(ids(a).length!==1){old?.remove();visible?.unobserve(a);observed.delete(a);owned.delete(a);return;}
  if(old?.isConnected&&old.previousSibling===a&&old.dataset.videoId===ids(a)[0])return;
  old?.remove();
  const host=d.createElement('span');host.dataset.zenzaExternalInline='';host.dataset.zenzaCompanion='';host.dataset.videoId=ids(a)[0];
  host.style.cssText='display:inline-block!important;margin:0 4px!important;vertical-align:middle!important;position:relative!important;';
  const root=host.attachShadow({mode:'closed'}),style=d.createElement('style'),button=d.createElement('button');
  const size={small:12,normal:14,large:17}[s.size]||12;
  style.textContent=`button{font:600 ${size}px/1.6 sans-serif;color:#e8f5f4;background:#243c47;border:1px solid #7acabc;border-radius:4px;padding:2px 7px;cursor:pointer}button:focus-visible{outline:2px solid #7acabc}span{font:12px/1.5 sans-serif;color:#fff;background:#17212d;padding:4px}`;
  button.type='button';button.textContent='Zen';button.setAttribute('aria-label','この動画をZenzaWatchで開く');
  const status=d.createElement('span');status.hidden=true;status.setAttribute('role','status');
  // Cards often handle bubbling clicks. Only our own button action is consumed.
  host.addEventListener('click',e=>e.stopPropagation());
  button.addEventListener('click',async e=>{
   if(!e.isTrusted||busy||disposed)return;const current=ids(a);if(current.length!==1){update(a);return;}
   e.preventDefault();e.stopPropagation();busy=true;button.disabled=true;status.hidden=false;status.textContent='起動中…';
   try{await open(current[0],e);status.hidden=true;}catch(error){status.textContent=error instanceof Error&&error.message==='VIDEO_UNAVAILABLE'?'動画情報では削除・非公開などにより利用できない状態です。':'起動できませんでした。ログイン状態と通信を確認してください。';}
   finally{busy=false;button.disabled=false;}
  });
  root.append(style,button,status);a.after(host);owned.set(a,host);
  if(check&&s.preflight==='display'){host.style.setProperty('display','none','important');const id=host.dataset.videoId!;const run=()=>{void check(id).then(result=>{if(disposed||owned.get(a)!==host||ids(a)[0]!==id)return;if(result!=='unavailable')host.style.setProperty('display','inline-block','important');});};if(visible){observed.set(a,run);visible.observe(a);}else run();}
 }
 function flush(){timer=undefined;if(disposed)return;let count=0;for(const a of pending){pending.delete(a);update(a);if(++count>=100)break;}if(pending.size)timer=w.setTimeout(flush,0);}
 function enqueue(node:Node){
  if(!(node instanceof w.Element)||node.hasAttribute('data-zenza-external-inline'))return;
  if(node.matches('a[href]'))pending.add(node);
  node.querySelectorAll('a[href]').forEach(a=>pending.add(a));
 }
 const observer=new w.MutationObserver(records=>{
  if(disposed)return;let removed=false;
  for(const record of records){
   if(record.type==='attributes'){pending.add(record.target as Element);continue;}
   record.addedNodes.forEach(enqueue);
   if(Array.from(record.removedNodes).some(n=>n instanceof w.Element&&!n.hasAttribute('data-zenza-external-inline')))removed=true;
  }
  if(removed)for(const [a,host] of owned)if(!a.isConnected){host.remove();visible?.unobserve(a);observed.delete(a);owned.delete(a);}
  if(pending.size&&timer===undefined)timer=w.setTimeout(flush,0);
 });
 enqueue(d.documentElement);flush();observer.observe(d.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['href']});
 return {dispose(){disposed=true;observer.disconnect();visible?.disconnect();observed.clear();w.clearTimeout(timer);pending.clear();for(const host of owned.values())host.remove();owned.clear();}};
}
