import type {CheckVideo} from './preflight';
import {ExternalSettings,siteEnabled} from './settings';
import {linkTargets,textTargets} from './targets';
type BrowserWindow=Window & typeof globalThis;
const excluded='input,textarea,select,button,pre,code,[contenteditable]:not([contenteditable="false"]),[role="textbox"]';
export function mountOverlay(w:BrowserWindow,s:ExternalSettings,open:(id:string,e:Event)=>Promise<unknown>,check?:CheckVideo):{dispose():void} {
 if(!siteEnabled(w.location.href,s))return {dispose(){}};
 const d=w.document,host=d.createElement('div');host.dataset.zenzaExternalOverlay='';host.dataset.zenzaCompanion='';
 host.style.cssText='all:initial!important;position:fixed!important;inset:auto!important;margin:0!important;padding:0!important;border:0!important;z-index:2147483647!important;display:none!important;';
 const shadow=host.attachShadow({mode:'closed'}),style=d.createElement('style');
 const size={small:12,normal:14,large:17}[s.size]||12;
 style.textContent=`:host{color-scheme:dark}button{font:600 ${size}px/1.6 sans-serif;color:#e8f5f4;background:#243c47;border:1px solid #7acabc;border-radius:4px;padding:2px 7px;cursor:pointer}button:focus-visible{outline:2px solid #fff}p{font:13px/1.5 sans-serif;margin:0;padding:8px;color:#eee;background:#17212d;max-width:280px}`;
 const button=d.createElement('button');button.type='button';button.textContent='Zen';button.setAttribute('aria-label','この動画をZenzaWatchで開く');button.title='Alt+Enterでボタンへ移動';
 const status=d.createElement('p');status.setAttribute('role','status');status.hidden=true;shadow.append(style,button,status);d.documentElement.append(host);
 let showSerial=0;
 let resolveTarget:(()=>string[])|null=null,busy=false,disposed=false,hideTimer:number|undefined;
 function hide(){if(busy)return;showSerial++;host.style.setProperty('display','none','important');resolveTarget=null;}
 function show(ids:()=>string[],rect:DOMRect){
  w.clearTimeout(hideTimer);
  const targetIds=ids();
  if(check&&s.preflight==='display'&&targetIds.length===1){const serial=++showSerial;host.style.setProperty('display','none','important');resolveTarget=null;void check(targetIds[0]).then(result=>{if(disposed||serial!==showSerial||ids()[0]!==targetIds[0])return;if(result!=='unavailable')present(ids,rect);});return;}
  present(ids,rect);
 }
 function present(ids:()=>string[],rect:DOMRect){
  if(busy||ids().length!==1){if(!busy)hide();return;}
  w.clearTimeout(hideTimer);resolveTarget=ids;status.hidden=true;host.style.setProperty('display','block','important');
  const width=host.getBoundingClientRect().width||60,height=host.getBoundingClientRect().height||30;
  const x=Math.max(4,Math.min(rect.right+4,w.innerWidth-width-4));
  const y=Math.max(4,Math.min(rect.top,w.innerHeight-height-4));
  host.style.setProperty('left',x+'px','important');host.style.setProperty('top',y+'px','important');
 }
 function target(e:Event){
  if(disposed||busy||e.composedPath().includes(host)||s.activation==='selection')return;
  const node=e.target;if(!(node instanceof w.Element)||node.closest(excluded)){hide();return;}
  const anchor=node.closest('a[href]');
  if(anchor&&s.activation==='inline')return;
  if(anchor){const ids=()=>anchor.isConnected&&!anchor.closest(excluded)?linkTargets(anchor.getAttribute('href')||'',d.baseURI,s):[];if(ids().length){show(ids,anchor.getBoundingClientRect());return;}}
  if(s.textIds){
   // Only inspect direct text at the interaction target, never walk the document.
   const ids=()=>node.isConnected&&!node.closest(excluded)?textTargets(Array.from(node.childNodes).filter(n=>n.nodeType===3).slice(0,16).map(n=>n.textContent||'').join(' '),s):[];
   if(ids().length){show(ids,node.getBoundingClientRect());return;}
  }
  // Allow crossing the small gap between a link and the overlay.
  w.clearTimeout(hideTimer);hideTimer=w.setTimeout(hide,250);
 }
 function selection(){
  if(disposed||busy)return;const sel=w.getSelection();
  if(!sel||sel.isCollapsed||!sel.rangeCount){if(s.activation==='selection')hide();return;}
  const range=sel.getRangeAt(0),element=range.commonAncestorContainer.nodeType===1?range.commonAncestorContainer as Element:range.commonAncestorContainer.parentElement;
  if(!element||element.closest(excluded)||range.cloneContents().querySelector(excluded)){hide();return;}
  const selected=()=>{
   if(!element.isConnected||element.closest(excluded))return [];const text=range.toString().trim();if(text.length>4096)return [];
   const link=element.closest('a[href]');const ids=link?linkTargets(link.getAttribute('href')||'',d.baseURI,s):linkTargets(text,d.baseURI,s);
   return ids.length?ids:textTargets(text,s);
  };
  if(s.activation==='selection'||s.textIds)show(selected,range.getBoundingClientRect());
 }
 function keys(e:KeyboardEvent){if(e.key==='Escape')hide();else if(e.altKey&&e.key==='Enter'&&resolveTarget&&host.style.display!=='none'){e.preventDefault();button.focus();}}
 function keep(){w.clearTimeout(hideTimer);}
 button.addEventListener('pointerenter',keep);
 button.addEventListener('click',async e=>{
  if(!e.isTrusted||busy||!resolveTarget)return;
  const ids=resolveTarget();if(ids.length!==1){hide();return;}
  e.preventDefault();e.stopPropagation();busy=true;button.disabled=true;status.hidden=false;status.textContent='起動しています…';
  try{await open(ids[0],e);busy=false;hide();}
  catch(error){status.textContent=error instanceof Error&&error.message==='MAIN_PLAYER_UNAVAILABLE'?'ZenzaWatch本体を最新版に更新して有効にし、このページを再読み込みしてください。':error instanceof Error&&error.message==='VIDEO_UNAVAILABLE'?'動画情報では削除・非公開などにより利用できない状態です。':'起動できませんでした。ニコニコのログイン状態と通信を確認してください。';}
  finally{busy=false;button.disabled=false;}
 });
 d.addEventListener('pointerover',target,true);d.addEventListener('focusin',target,true);d.addEventListener('selectionchange',selection);
 d.addEventListener('keydown',keys,true);w.addEventListener('scroll',hide,true);w.addEventListener('resize',hide);
 return {dispose(){disposed=true;w.clearTimeout(hideTimer);d.removeEventListener('pointerover',target,true);d.removeEventListener('focusin',target,true);d.removeEventListener('selectionchange',selection);d.removeEventListener('keydown',keys,true);w.removeEventListener('scroll',hide,true);w.removeEventListener('resize',hide);host.remove();}};
}