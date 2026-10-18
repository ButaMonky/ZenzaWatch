type SceneListView = {element:HTMLElement;dispose:()=>void};
type SceneViewState = {shown:boolean;miniEnabled:boolean;listOpen:boolean;listAllowed?:boolean;
 opacity:number;scale:number;miniStyle:'flow'|'static';time?:number;pinned?:boolean;seekStepSeconds?:number};
type SceneNativeSnapshot = {parent:Node|null;next:Node|null;style:string|null;className:string;hidden:HTMLElement['hidden']};
type SceneViewOptions = {document:Document;host:HTMLElement;image?:HTMLElement|null;mini?:HTMLElement|null;
 listView?:SceneListView|null;id?:string;onAction?:(action:string,context:unknown,event:Event)=>void};
export class SceneSearchPreviewView {
 readonly document:Document;
 readonly host:HTMLElement;
 readonly id:string;
 root:HTMLElement|null=null;
 private image:HTMLElement|null;
 private mini:HTMLElement|null;
 private listView:SceneListView|null;
 private logical:HTMLElement|null=null;
 private imageBox:HTMLElement|null=null;
 private listSlot:HTMLElement|null=null;
 private style:HTMLStyleElement|null=null;
 private snapshots=new Map<HTMLElement,SceneNativeSnapshot>();
 private disposed=false;
 private state:SceneViewState|null=null;
 private onAction:(action:string,context:unknown,event:Event)=>void;
 private click:(event:Event)=>void;
 constructor({document,host,image=null,mini=null,listView=null,id='follow',onAction}:SceneViewOptions){
  this.document=document;this.host=host;this.image=image;this.mini=mini;this.listView=listView;this.id=id;
  this.onAction=onAction||(()=>{});
  this.click=event=>{
   const button=(event.target as Element|null)?.closest<HTMLButtonElement>('button[data-scui-action]');
   if(!button||!this.root?.contains(button)||button.disabled)return;
   const action=button.dataset['scuiAction'];if(!action)return;
   this.onAction(action,{layoutId:this.id},event);event.stopPropagation();
  };
 }
 private remember(node:HTMLElement):void{
  if(this.snapshots.has(node))return;
  this.snapshots.set(node,{parent:node.parentNode,next:node.nextSibling,
   style:node.getAttribute('style'),className:node.className,hidden:node.hidden});
 }
 private typography(node:HTMLElement):void{
  const computed=this.document.defaultView?.getComputedStyle(node);
  for(const key of ['font-family','font-size','line-height','font-weight','letter-spacing','word-spacing']){
   const value=computed?.getPropertyValue(key);if(value)node.style.setProperty(key,value);
  }
 }
 private restore(node:HTMLElement):void{
  const old=this.snapshots.get(node);if(!old)return;
  if(old.parent){old.parent.insertBefore(node,old.next?.parentNode===old.parent?old.next:null);}
  else node.remove();
  if(old.style===null)node.removeAttribute('style');else node.setAttribute('style',old.style);
  node.className=old.className;node.hidden=old.hidden;this.snapshots.delete(node);
 }
 mount():void{
  if(this.disposed||this.root)return;
  const d=this.document,root=d.createElement('section');
  root.className='zenzaSceneSearchHost zenzaSceneSharedPreview';
  root.dataset['layout']=this.id;root.setAttribute('role','group');root.setAttribute('aria-label','シーンサーチ');
  root.hidden=true;
  const media=d.createElement('div');media.className='zenzaSceneMedia';
  const left=d.createElement('div');left.className='zenzaSceneLeft';
  this.imageBox=d.createElement('div');this.imageBox.className='zenzaSceneImageBox';
  this.logical=d.createElement('div');this.logical.className='zenzaSceneLogical';
  this.imageBox.append(this.logical);
  const foot=d.createElement('div');foot.className='zenzaSceneFoot';
  const time=d.createElement('span');time.className='zenzaSceneTime';time.textContent='0:00';foot.append(time);
  const actions=d.createElement('div');actions.className='zenzaSceneActions';
  for(const [action,symbol,label] of [
   ['seek-back','‹','指定秒数戻る'],['comment-toggle','💬','コメント一覧を開く'],
   ['seek-forward','›','指定秒数進む']
  ] as const){
   const button=d.createElement('button');button.type='button';
   button.className='zenzaSceneBtn scene-'+action;button.dataset['scuiAction']=action;
   button.textContent=symbol;button.title=label;button.setAttribute('aria-label',label);
   actions.append(button);
  }
  foot.append(actions);left.append(this.imageBox,foot);
  this.listSlot=d.createElement('div');this.listSlot.className='zenzaSceneListSlot';
  const listHead=d.createElement('div');listHead.className='zenzaSceneListHead';
  const listTitle=d.createElement('span');listTitle.textContent='コメント';
  const search=d.createElement('button');search.type='button';search.className='zenzaSceneBtn scene-comment-search';
  search.dataset['scuiAction']='comment-search';search.textContent='⌕';search.title='コメント検索';
  search.setAttribute('aria-label','コメント検索');search.setAttribute('aria-expanded','false');
  listHead.append(listTitle,search);this.listSlot.append(listHead);
  this.listSlot.hidden=true;media.append(left,this.listSlot);root.append(media);
  this.style=d.createElement('style');this.style.textContent=SceneSearchPreviewView.CSS;
  this.style.dataset['scuiSharedStyle']='';d.head.append(this.style);
  this.host.append(root);this.root=root;
  root.addEventListener('click',this.click);
  const image=this.image;this.image=null;this.setImage(image);
  if(this.mini){
   this.remember(this.mini);this.typography(this.mini);this.logical.append(this.mini);
   this.mini.classList.add('zenzaSceneNativeMini');
  }
  const list=this.listView;this.listView=null;this.setListView(list);
  this.fit({imageScale:1,listWidth:280,listMaxHeight:240});
 }
 setImage(image:HTMLElement|null):void{
  if(this.disposed)return;
  if(this.image===image){if(this.state)this.render(this.state);return;}
  if(this.image)this.restore(this.image);
  this.image=image;
  if(image&&this.logical){this.remember(image);this.logical.prepend(image);}
  if(this.state)this.render(this.state);
 }
 setListView(handle:SceneListView|null):void{
  if(this.disposed||this.listView===handle)return;
  if(this.listView){this.listView.dispose();}
  this.listView=handle;
  if(handle&&this.listSlot){
   this.typography(handle.element);this.listSlot.append(handle.element);
   handle.element.classList.add('zenzaSceneNativeList');
   handle.element.tabIndex=0;handle.element.setAttribute('aria-label','シーンのコメント一覧');
  }
  if(this.state)this.render(this.state);
 }
 render(state:SceneViewState):void{
  const root=this.root;if(this.disposed||!root)return;
  this.state=state;root.hidden=!state.shown&&!state.pinned;
  root.dataset['miniStyle']=state.miniStyle;
  root.classList.toggle('is-pinned',!!state.pinned);
  const hasImage=!!this.image?.querySelector('canvas')&&this.image.classList.contains('is-visible');
  if(this.mini)this.mini.hidden=!state.miniEnabled||!hasImage;
  const listVisible=state.listOpen&&!!this.listView;
  if(this.listSlot)this.listSlot.hidden=!listVisible;
  if(this.listView){
   this.listView.element.hidden=!listVisible;
   this.listView.element.style.setProperty('--scene-list-alpha',String(state.opacity/100));
   this.listView.element.style.setProperty('opacity','1','important');
  }
  const time=Number.isFinite(state.time)?Math.max(0,Math.floor(state.time||0)):0;
  const label=root.querySelector('.zenzaSceneTime');
  if(label)label.textContent=Math.floor(time/60)+':'+String(time%60).padStart(2,'0');
  const toggle=root.querySelector<HTMLButtonElement>('[data-scui-action="comment-toggle"]');
  if(toggle){
   toggle.disabled=state.listAllowed===false;toggle.setAttribute('aria-expanded',String(listVisible));
   toggle.title=toggle.disabled?'上級者設定でコメントプレビューがOFFです':listVisible?'コメント一覧を閉じる':'コメント一覧を開く';
   toggle.setAttribute('aria-label',toggle.title);
  }
  for(const action of ['seek-back','seek-forward']){
   const button=root.querySelector<HTMLButtonElement>('[data-scui-action="'+action+'"]');
   if(button){button.hidden=state.seekStepSeconds===0;button.disabled=state.seekStepSeconds===0;}
  }
 }
 measureFooter(imageScale:number):number{
  const left=this.root?.querySelector<HTMLElement>('.zenzaSceneLeft');
  const foot=this.root?.querySelector<HTMLElement>('.zenzaSceneFoot');
  if(!left||!foot)return 36;
  left.style.width=Math.max(104,180*imageScale)+'px';
  foot.style.height='auto';
  return Math.max(32,foot.scrollHeight)+4;
 }
 fit({imageScale,listWidth,listMaxHeight,footerHeight=54}:{imageScale:number;listWidth:number;listMaxHeight:number;footerHeight?:number}):void{
  if(!this.logical||!this.imageBox||!this.listSlot||this.disposed)return;
  const scale=Number.isFinite(imageScale)?Math.max(.05,Math.min(2,imageScale)):1;
  this.logical.style.transform='scale('+scale+')';
  this.imageBox.style.width=180*scale+'px';this.imageBox.style.height=90*scale+'px';
  this.root?.style.setProperty('--scene-image-height',90*scale+'px');
  const left=this.root?.querySelector<HTMLElement>('.zenzaSceneLeft');
  if(left)left.style.width=Math.max(104,180*scale)+'px';
  const foot=this.root?.querySelector<HTMLElement>('.zenzaSceneFoot');
  if(foot)foot.style.height=Math.max(32,footerHeight-4)+'px';
  this.root?.style.setProperty('--scene-footer-height',Math.max(36,footerHeight)+'px');
  this.listSlot.style.width=Math.max(1,listWidth)+'px';
  this.listSlot.style.maxHeight=Math.max(32,listMaxHeight)+'px';
  if(this.listView){this.listView.element.style.height=Math.max(32,listMaxHeight-36)+'px';}
 }
 getRects():DOMRect[]{
  if(!this.root||this.root.hidden||this.disposed||this.root.classList.contains('is-idle-suppressed'))return [];
  return [...this.root.querySelectorAll<HTMLElement>('.zenzaSceneLeft,.zenzaSceneListSlot,.zenzaSceneActions')]
   .filter(node=>!node.hidden&&!node.closest('[hidden]')).map(node=>node.getBoundingClientRect())
   .filter(rect=>rect.width>0&&rect.height>0);
 }
 dispose():void{
  if(this.disposed)return;this.disposed=true;
  this.listView?.dispose();this.listView=null;
  for(const node of [...this.snapshots.keys()].reverse())this.restore(node);
  this.root?.removeEventListener('click',this.click);
  this.root?.remove();this.style?.remove();this.root=null;this.style=null;this.state=null;
  this.logical=null;this.imageBox=null;this.listSlot=null;this.image=null;this.mini=null;
 }
 static get CSS():string{return `
.zenzaSceneSharedPreview{position:absolute;box-sizing:border-box;z-index:150;left:0;top:0;bottom:auto;transform:none;width:max-content;max-width:calc(100vw - 16px);padding:4px;border:1px solid #586879;border-radius:6px;background:transparent;color:#eee;font:12px/1.35 system-ui,sans-serif;pointer-events:none;overflow:auto}
.zenzaSceneSharedPreview[hidden],.zenzaSceneSharedPreview [hidden],.zenzaSceneSharedPreview.is-idle-suppressed{display:none!important}
.zenzaSceneSharedPreview .zenzaSceneMedia{display:flex;align-items:flex-start;gap:8px}
.zenzaSceneSharedPreview .zenzaSceneLeft{position:relative;min-width:104px;flex-shrink:0;background:#101722;pointer-events:auto}
.zenzaSceneSharedPreview .zenzaSceneImageBox{position:relative;overflow:hidden;background:#101114;min-height:0;margin:auto}
.zenzaSceneSharedPreview .zenzaSceneLogical{position:absolute;left:0;top:0;width:180px;height:90px;transform-origin:0 0}
.zenzaSceneSharedPreview .zenzaSceneLogical>.zenzaSeekThumbnail{position:absolute!important;left:10px!important;top:0!important;width:160px!important;height:90px!important;margin:0!important}
.zenzaSceneSharedPreview .zenzaSceneLogical>.zenzaSeekThumbnail.is-visible{display:block!important}
.zenzaSceneSharedPreview .zenzaSeekThumbnail-image,.zenzaSceneSharedPreview canvas.zenzaSeekThumbnail-thumbnail{width:160px!important;height:90px!important;max-width:none!important}
.zenzaSceneSharedPreview .zenzaSceneNativeMini{display:block!important;position:absolute!important;left:0!important;top:0!important;bottom:auto!important;width:180px!important;height:90px!important;max-height:90px!important;transform:none!important;opacity:1!important;background:transparent!important;overflow:hidden!important;pointer-events:none!important;z-index:200}
.zenzaSceneSharedPreview .zenzaSceneNativeMini[hidden]{display:none!important}
.zenzaSceneSharedPreview .zenzaSceneListSlot{position:relative;flex-shrink:0;overflow:auto;pointer-events:auto}
.zenzaSceneSharedPreview .zenzaSceneNativeList{display:block!important;position:relative!important;inset:auto!important;width:100%!important;max-height:none!important;transform:none!important;border:0!important;opacity:1!important;background:rgba(7,13,24,var(--scene-list-alpha,.9))!important;overflow:auto!important;pointer-events:auto!important}
.zenzaSceneSharedPreview .zenzaSceneNativeList .listContainer{pointer-events:auto!important}
.zenzaSceneSharedPreview .zenzaSceneFoot{position:static;display:flex;flex-direction:column;align-items:stretch;gap:2px;margin-top:4px;overflow:visible}
.zenzaSceneSharedPreview .zenzaSceneTime{text-align:center;line-height:16px;font-variant-numeric:tabular-nums}
.zenzaSceneSharedPreview .zenzaSceneActions{display:grid;grid-template-columns:repeat(3,1fr);gap:2px;position:static;width:100%}
.zenzaSceneSharedPreview .scene-comment-toggle{grid-column:2}
.zenzaSceneSharedPreview .scene-seek-forward{grid-column:3}
.zenzaSceneSharedPreview .zenzaSceneListHead{position:sticky;top:0;display:flex;align-items:center;justify-content:space-between;box-sizing:border-box;height:36px;padding:2px 4px;background:#101722;z-index:401}
.zenzaSceneSharedPreview .zenzaSceneBtn{position:static;box-sizing:border-box;min-width:32px;height:32px;padding:2px 5px;border:0;border-radius:4px;background:#243346;color:inherit;font:12px system-ui;cursor:pointer}
.zenzaSceneSharedPreview .zenzaSceneCommentSearch{position:absolute!important;box-sizing:border-box;top:36px!important;bottom:0!important;left:0!important;right:0!important;width:100%;max-width:100%!important;overflow:auto;z-index:400;pointer-events:auto;background:#101824;color:#fff;padding:7px;border:1px solid #64748b}
.zenzaSceneSharedPreview .zenzaSceneCommentSearch input{box-sizing:border-box;max-width:100%;min-height:32px}
.zenzaSceneSharedPreview .zenzaSceneCommentSearch ul{padding:0;list-style:none}
.zenzaSceneSharedPreview .zenzaSceneCommentSearch button{max-width:100%;overflow-wrap:anywhere}
.zenzaSceneSharedPreview .zenzaSceneBtn:disabled{opacity:.5;cursor:default}
.zenzaSceneSharedPreview .zenzaSceneBtn:focus-visible{outline:2px solid #8ed8ff}
.zenzaSceneSharedPreview .zenzaSceneBtn[aria-pressed=true]{background:#456b8d}
.zenzaSceneSharedPreview[data-mini-style=flow] .zenzaSceneNativeMini .text{animation-play-state:running!important}
.zenzaSceneSharedPreview[data-mini-style=static] .zenzaSceneNativeMini .listContainer{display:flex!important;flex-direction:column!important;height:90px!important}
.zenzaSceneSharedPreview[data-mini-style=static] .zenzaSceneNativeMini .nicoChat{position:relative!important;top:auto!important;transform:none!important;flex:0 0 18px!important;height:18px!important}
.zenzaSceneSharedPreview[data-mini-style=static] .zenzaSceneNativeMini .nicoChat:nth-child(n+6){display:none!important}
.zenzaSceneSharedPreview[data-mini-style=static] .zenzaSceneNativeMini .text{animation:none!important;transform:none!important;visibility:visible!important}
`;}
}
