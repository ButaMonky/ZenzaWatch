function scenePreviewVisualProbe(){
 const d=document,w=window,v={left:0,top:0,right:w.innerWidth,bottom:w.innerHeight};
 const root=d.querySelector('.zenzaSceneSearchHost,.is-scui00-root');
 const layout=qaDom.binding?.adapter?.bridge?.controller?.snapshot?.layoutId;
 const state=qaDom.binding?.adapter?.bridge?.controller?.snapshot||null;
 const rect=node=>{if(!node)return null;const r=node.getBoundingClientRect();return {
  left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
 const intersects=(a,b)=>!!a&&a.width>0&&a.height>0&&
  a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
 const stylePath=node=>{
  if(!node)return {visible:false,reason:'missing'};
  for(let n=node;n;n=n.parentElement){
   const s=getComputedStyle(n);
   if(n.hidden||s.display==='none'||s.visibility==='hidden'||
    s.visibility==='collapse'||Number(s.opacity)===0){
    return {visible:false,reason:n===node?'self-hidden':'ancestor-hidden',
     node:n.className||n.tagName,display:s.display,visibility:s.visibility,opacity:s.opacity};
   }
  }
  return {visible:true,reason:'paintable'};
 };
 const rootRect=rect(root),rootStyle=stylePath(root);
 const image=root?.querySelector('.zenzaSceneImageBox')||null;
 const thumb=root?.querySelector('.zenzaSeekThumbnail')||
  (layout==='00'?qaDom.thumb:null);
 const nativeCanvas=qaDom.thumb.querySelector('canvas');
 const mini=qaDom.comment._view._view;
 const minis=stylePath(mini),miniRect=rect(mini);
 const candidateCanvas=[...d.querySelectorAll('.zenzaSceneSearchHost canvas,.is-scui00-root canvas')];
 const rectCanvas=candidateCanvas.map(node=>({box:rect(node),visibility:stylePath(node)}));
 const actions=[...root?.querySelectorAll('button[data-scui-action],.toggleCommentPreview')||[]]
  .map(node=>{
   const r=rect(node),vis=stylePath(node);
   const onScreen=vis.visible&&intersects(r,v);
   const x=onScreen?Math.max(0,Math.min(w.innerWidth-1,r.left+r.width/2)):null;
   const y=onScreen?Math.max(0,Math.min(w.innerHeight-1,r.top+r.height/2)):null;
   const hit=onScreen?d.elementFromPoint(x,y):null;
   return {action:node.dataset.scuiAction||'toggleCommentPreview',
    rect:r,visible:vis.visible,onScreen,centerHit:!!hit&&(hit===node||node.contains(hit)),
    hit:hit?.className||hit?.tagName,
    pointerEvents:getComputedStyle(node).pointerEvents};
  });
 const rootInViewport=intersects(rootRect,v);
 const imageRect=rect(image),thumbRect=rect(thumb);
 const canvas=rect(nativeCanvas);
 const canvasStyle=stylePath(nativeCanvas);
 const hitX=rootInViewport?Math.max(0,Math.min(w.innerWidth-1,
  (imageRect||thumbRect||rootRect).left+
  (imageRect||thumbRect||rootRect).width/2)):null;
 const hitY=rootInViewport?Math.max(0,Math.min(w.innerHeight-1,
  (imageRect||thumbRect||rootRect).top+
  (imageRect||thumbRect||rootRect).height/2)):null;
 const imageHit=hitX===null?null:d.elementFromPoint(hitX,hitY);
 return {
  layout,shown:state?.shown,pinned:state?.pinned,time:state?.time,
  rootRect,rootStyle,rootInViewport,
  rootCount:d.querySelectorAll('.zenzaSceneSearchHost,.is-scui00-root').length,
  imageRect,imageStyle:stylePath(image),thumbRect,thumbStyle:stylePath(thumb),
  canvas,canvasStyle,embeddedCanvases:rectCanvas,
  nativeCanvasInsideRoot:!!root?.contains(nativeCanvas),
  miniRect,miniStyle:minis,miniMode:mini.dataset.commentPreviewMode,
  commentInsideImage:!!image?.contains(mini),
  rootContainsComment:!!root?.contains(mini),
  viewport:v,scrollY:w.scrollY,docScrollHeight:d.documentElement.scrollHeight,
  documentClientHeight:d.documentElement.clientHeight,
  controls:actions,visibleControls:actions.filter(x=>x.visible&&x.onScreen).length,
  hittableControls:actions.filter(x=>x.visible&&x.onScreen&&x.centerHit).length,
  imageHit:imageHit?.className||imageHit?.tagName,
  imageHitWithinRoot:!!imageHit&&!!root?.contains(imageHit),
  styles:{rootPointer:root&&getComputedStyle(root).pointerEvents}
 };
}