import {siteEnabled,readExternal} from './settings';
import {validVideoId} from './targets';
type BrowserWindow=Window & typeof globalThis;
interface Store {get(key:string):unknown;set(key:string,value:unknown):void;remove(key:string):void;}
interface Click {id:string;time:number;}
const prefix='blog-click-v1:';
/** DOM messages carry only a correlation nonce. The trusted-click proof stays in GM storage. */
export function sendBlogClick(w:BrowserWindow,gm:Store,id:string,event:Event):boolean {
 if(!event.isTrusted||!validVideoId(id)||w===w.top)return false;
 const nonce=w.crypto.randomUUID(),key=prefix+nonce;
 gm.set(key,{id,time:Date.now()});
 w.parent.postMessage({type:'ZenzaBlogPartsClick',nonce},'*');
 w.setTimeout(()=>gm.remove(key),10000);return true;
}
export function receiveBlogClicks(w:BrowserWindow,gm:Store,preferences:()=>unknown,open:(id:string,event:{isTrusted:true})=>Promise<unknown>):()=>void {
 const receive=(event:MessageEvent)=>{
  if(!['https://ext.nicovideo.jp','http://ext.nicovideo.jp'].includes(event.origin))return;
  const nonce=event.data?.type==='ZenzaBlogPartsClick'?event.data.nonce:null;
  if(typeof nonce!=='string'||!/^[-a-f0-9]{36}$/.test(nonce))return;
  const frame=Array.from(w.document.querySelectorAll('iframe')).find(frame=>frame.contentWindow===event.source);
  if(!frame)return;
  let id:string|undefined;try{const url=new URL(frame.src,w.location.href);if(url.origin!==event.origin)return;id=/^\/thumb\/([^/]+)\/?$/.exec(url.pathname)?.[1];}catch{return;}
  const key=prefix+nonce,proof=gm.get(key) as Click|undefined;
  if(!id||!validVideoId(id)||!proof||proof.id!==id||!Number.isFinite(proof.time)||Date.now()-proof.time<0||Date.now()-proof.time>10000)return;
  gm.remove(key);
  if(!siteEnabled(w.location.href,readExternal(preferences())))return;
  void open(id,{isTrusted:true}).catch(()=>w.console.warn('ZenzaBlogPartsButton: could not open embedded video'));
 };
 w.addEventListener('message',receive);return ()=>w.removeEventListener('message',receive);
}
