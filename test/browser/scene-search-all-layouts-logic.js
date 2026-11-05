// Runs in the same isolated Chromium main world as scui-live-layouts.js.
// All layout/card/CommentPreviewView classes and CSS are production sources.
const failures=[],counts={cases:0,checks:0,failed:0};
function check(label,condition,detail={}){
 counts.checks++;
 if(!condition){counts.failed++;if(failures.length<200)failures.push({test:label,...detail});}
}
const tick=()=>new Promise(resolve=>requestAnimationFrame(()=>resolve()));
const rjson=r=>r?{left:r.left,top:r.top,right:r.right,bottom:r.bottom,
 width:r.width,height:r.height}:null;
const rectValid=r=>r&&[r.left,r.top,r.width,r.height].every(Number.isFinite)&&
 r.width>=0&&r.height>=0;
const visible=node=>{
 if(!node)return false;
 for(let cursor=node;cursor;cursor=cursor.parentElement){
  const css=getComputedStyle(cursor);
  if(cursor.hidden||css.display==='none'||css.visibility==='hidden'||css.opacity==='0')
   return false;
 }
 return true;
};
const seek=document.getElementById('seek');
const originalHostStyle=host.style.cssText,originalClass=host.className;
const originalBodyClass=document.body.className;
const originalScreenMode=player.screenMode;
const thumb=document.getElementById('thumb');
const nativeComment=document.getElementById('comments');
const originalThumbParent=thumb.parentNode;
const originalCommentParent=nativeComment.parentNode;
const originalTooltip=document.getElementById('old');
const originalTooltipParent=originalTooltip.parentNode;
function prepareLegacy(){
 const t=document.createElement('template');t.innerHTML=scuiNativeTooltipTemplate;
 const native=t.content.firstElementChild;native.id='old';
 originalTooltip.replaceWith(native);
 const image=document.createElement('div');image.className='zenzaSeekThumbnail-image';
 while(thumb.firstChild)image.append(thumb.firstChild);
 thumb.append(image);thumb.classList.add('is-visible');
 native.querySelector('.seekBarThumbnailContainer').append(thumb);
 seek.classList.add('seekBarContainer');seek.append(native,nativeComment);
 bar._seekBarToolTip._$view=[native];
 return ()=>{
  while(image.firstChild)thumb.append(image.firstChild);
  image.remove();thumb.classList.remove('is-visible');
  originalThumbParent.append(thumb);
  originalTooltipParent.append(originalTooltip);
  native.remove();originalCommentParent.append(nativeComment);
  seek.classList.remove('seekBarContainer');
  bar._seekBarToolTip._$view=[originalTooltip];
 };
}
const resetContext=()=>{
 host.style.cssText=originalHostStyle;host.className=originalClass;
 document.body.className=originalBodyClass;
 player.screenMode=originalScreenMode;
};
const configureContext=context=>{
 resetContext();
 if(context==='sideView'){
  // This is an offline geometry fixture, not a substitute for the site's
  // real body/sidebar state. Mimic the canonical 400x225 side player and
  // >=1432px expansion of NicoVideoPlayerDialog's for-sideView CSS.
  player.screenMode='sideView';document.body.classList.add('zenzaScreenMode_sideView');
  host.classList.add('zenzaScreenMode_sideView','zenzaPlayerContainer');
  const width=innerWidth>=1432?innerWidth-1024:400;
  host.style.cssText='position:fixed;top:0;left:0;margin:0;width:'+width+'px;'+
   'height:'+(width*9/16)+'px;';
 }else if(context==='small'){
  player.screenMode='small';host.classList.add('zenzaScreenMode_small');
  host.style.width='min(430px, calc(100vw - 32px))';host.style.height='310px';
 }else if(context==='fullscreen'){
  player.screenMode='fullscreen';host.classList.add('zenzaScreenMode_full','is-fullscreen');
  host.style.cssText='position:fixed;inset:0;margin:0;width:100vw;height:100vh;';
 }else{
  player.screenMode='normal';
 }
 window.dispatchEvent(new Event('resize'));
};
const selected=new URLSearchParams(location.search).get('matrixContext');
for(const context of selected?[selected]:['normal','small','fullscreen']){
 for(let n=0;n<=10;n++){
  const id=String(n).padStart(2,'0'),label=id+'/'+context;
  const nativeCleanup=id==='00'?prepareLegacy():()=>{};
  const errors=[];
  configureContext(context);
  vals['sceneSearch.layout.normal']=id;vals['sceneSearch.layout.fullscreen']=id;
  config.setValue('enableCommentPreview',false);
  const em=events();
  const binding=new SceneSearchPlayerBinding({view:{videoControlBar:bar},dialog:player,
   document,container:host,events:em,isFullscreen:()=>context==='fullscreen',
   onError:code=>errors.push(code)});
  try{
   counts.cases++;
   binding.attach();await tick();
   const expectedRoot=id==='00'?document.querySelector('.is-scui00-root'):
    document.querySelector('.zenzaSceneSearchHost');
   check(label+'/mount',!!expectedRoot&&!!binding.adapter,{errors});
   check(label+'/layout',binding.adapter?.bridge?.controller.snapshot.layoutId===id,
    {actual:binding.adapter?.bridge?.controller.snapshot.layoutId});
   check(label+'/no-bind-errors',errors.length===0,{errors});
   if(context==='sideView'){
    const sideRect=host.getBoundingClientRect();
    const expectedWidth=innerWidth>=1432?innerWidth-1024:400;
    check(label+'/side-view-mode',player.screenMode==='sideView'&&
      document.body.classList.contains('zenzaScreenMode_sideView'));
    check(label+'/side-view-host-size',Math.abs(sideRect.width-expectedWidth)<1&&
      Math.abs(sideRect.height-expectedWidth*9/16)<1,
      {host:rjson(sideRect),expectedWidth});
    check(label+'/side-view-is-not-fullscreen',!document.fullscreenElement);
   }
   if(context==='fullscreen'&&document.fullscreenElement){
    check(label+'/native-fullscreen-active',document.fullscreenElement===host);
    check(label+'/fullscreen-top-layer-owner',host.contains(expectedRoot),
     {parent:expectedRoot?.parentElement?.className});
   }
   const r=expectedRoot?.getBoundingClientRect();
   check(label+'/finite-geometry',rectValid(r),{rect:rjson(r)});
   // UI00's native tooltip is intentionally CSS-hover gated. Synthetic
   // JS mouse events don't set :hover; check ownership and seek hit areas.
   // A separate native-pointer regression exercises the painted state.
   // The initial hidden preview can legitimately have a zero-sized box.
   // Validate actual painted geometry AFTER seek hover below.
   const barRect=seek.getBoundingClientRect();
   for(const pct of [.01,.5,.99]){
    const x=barRect.left+barRect.width*pct;
    seek.dispatchEvent(new MouseEvent('mouseenter',{clientX:x,bubbles:true}));
    seek.dispatchEvent(new MouseEvent('mousemove',{clientX:x,bubbles:true}));
    await tick();
    for(const ratio of [.1,.5,.9]){
     const y=barRect.top+barRect.height*ratio;
     const hit=document.elementFromPoint(Math.round(x),Math.round(y));
     const blocked=!!hit?.closest?.('button,.controlButton');
     check(label+'/seek-hit-'+pct+'/'+ratio,seek===hit||
      (seek.contains(hit)&&!blocked),
      {hit:hit?.className||hit?.id||hit?.tagName,blocked,x,y});
    }
    const follow=expectedRoot?.getBoundingClientRect();
    check(label+'/seek-stable-bounds-'+pct,rectValid(follow),
     {rect:rjson(follow)});
    if(id!=='00'){
     check(label+'/shown-preview-'+pct,!!follow&&follow.width>0&&follow.height>0,
      {rect:rjson(follow),shown:binding.adapter?.bridge?.controller.snapshot.shown});
     if(follow&&follow.width>0&&follow.height>0){
      check(label+'/preview-on-screen-'+pct,follow.right>0&&follow.bottom>0&&
       follow.left<innerWidth&&follow.top<innerHeight,{rect:rjson(follow)});
      const intersection=Math.max(0,Math.min(follow.right,barRect.right)-Math.max(follow.left,barRect.left))*
       Math.max(0,Math.min(follow.bottom,barRect.bottom)-Math.max(follow.top,barRect.top));
      check(label+'/preview-seek-overlap-'+pct,intersection===0,
       {rect:rjson(follow),seek:rjson(barRect),intersection});
     }
    }
   }
   const button=id==='00'?expectedRoot?.querySelector('.toggleCommentPreview'):
    expectedRoot?.querySelector('button[data-scui-action="comment-toggle"]');
   check(label+'/control-exists',!!button,{root:expectedRoot?.className});
   if(button&&visible(button)){
    const bounds=button.getBoundingClientRect();
    check(label+'/button-visible-in-viewport',
     bounds.width>0&&bounds.height>0&&bounds.left>=-1&&bounds.right<=innerWidth+1&&
     bounds.top>=-1&&bounds.bottom<=innerHeight+1,{button:rjson(bounds),
      root:rjson(expectedRoot?.getBoundingClientRect()),
      sceneBottom:expectedRoot?.style.getPropertyValue('--scene-bottom'),
      host:rjson(host.getBoundingClientRect())});
    const bx=bounds.left+bounds.width/2,by=bounds.top+bounds.height/2;
    if(bx>=0&&bx<innerWidth&&by>=0&&by<innerHeight){
     const target=document.elementFromPoint(bx,by);
     check(label+'/button-hit',target===button||button.contains(target),
      {hit:target?.className||target?.tagName,button:rjson(bounds)});
    }
    button.focus();
    check(label+'/keyboard-focus',document.activeElement===button);
   }
   const popup=document.createElement('div');popup.className='commandPopover';
   popup.style.cssText='position:absolute;left:15px;top:22px;width:125px;height:50px;'+
    'background:#19384c;pointer-events:auto;';
   const popupAction=document.createElement('button');
   popupAction.textContent='popup';popup.append(popupAction);host.append(popup);
   try{
    await tick();
    const p=popupAction.getBoundingClientRect();
    const hit=document.elementFromPoint(p.left+p.width/2,p.top+p.height/2);
    check(label+'/popup-input-hit',hit===popupAction||popupAction.contains(hit),
     {hit:hit?.className||hit?.tagName,popup:rjson(p)});
    const input=document.createElement('input');
    input.setAttribute('aria-label','comment-input-probe');
    input.className='commentInputPanel';host.append(input);input.focus();
    await tick();
    check(label+'/comment-focus',document.activeElement===input);
    input.remove();
   }finally{popup.remove();}
   const before=binding.adapter?.bridge?.controller.snapshot.pinned;
   const shortcut=binding.handleShortcut('sceneSearch-togglePin');
   const after=binding.adapter?.bridge?.controller.snapshot.pinned;
   check(label+'/pin-shortcut',shortcut===true&&after!==before,{shortcut,before,after});
   // Restore pin and ensure no extra mounted card after dynamic changes.
   if(after===true)binding.handleShortcut('sceneSearch-togglePin');
   const oldWidth=host.style.width,oldHeight=host.style.height;
   host.style.width=context==='fullscreen'?'100vw':'min(510px,calc(100vw - 32px))';
   host.style.height=context==='fullscreen'?'100vh':'420px';
   window.dispatchEvent(new Event('resize'));await tick();
   check(label+'/resize-stable',rectValid(expectedRoot?.getBoundingClientRect()));
   host.style.width=oldWidth;host.style.height=oldHeight;
   window.dispatchEvent(new Event('resize'));await tick();
   // Mutate the already-running controller to exercise its layout replacement.
   if(id!=='00'){
    const switchId=String(n===10?1:n+1).padStart(2,'0');
    config.setValue('sceneSearch.layout.normal',switchId);
    config.setValue('sceneSearch.layout.fullscreen',switchId);
    await tick();
    check(label+'/layout-switch',
     binding.adapter?.bridge?.controller.snapshot.layoutId===switchId,
     {after:binding.adapter?.bridge?.controller.snapshot.layoutId,switchId});
   }
  }catch(error){
   check(label+'/uncaught',false,{error:String(error),stack:error.stack?.slice(0,400)});
  }finally{
   binding.dispose();await tick();
   check(label+'/disposed-no-card',!document.querySelector('.zenzaSceneSearchHost')&&
    !document.querySelector('.is-scui00-root'));
   nativeCleanup();resetContext();
  }
 }
}
if(selected==='fullscreen'){
 // Native-pointer UI00 probe: the CSS :hover state cannot be established by
 // dispatchEvent(new MouseEvent). The CDP driver moves a real mouse between
 // start and finish while this original owner stays mounted.
 window.startSceneLegacyPointerProbe=()=>{
  const cleanup=prepareLegacy();
  configureContext('fullscreen');
  vals['sceneSearch.layout.fullscreen']='00';
  vals['sceneSearch.layout.normal']='00';
  const issues=[],binding=new SceneSearchPlayerBinding({
   view:{videoControlBar:bar},dialog:player,document,container:host,
   events:events(),isFullscreen:()=>true,onError:code=>issues.push(code)
  });
  binding.attach();
  window.__sceneLegacyOwner={binding,cleanup,issues};
  const rect=seek.getBoundingClientRect();
  seek.dispatchEvent(new MouseEvent('mouseenter',{clientX:rect.left+rect.width*.5,bubbles:true}));
  seek.dispatchEvent(new MouseEvent('mousemove',{clientX:rect.left+rect.width*.5,bubbles:true}));
  return {seek:rjson(rect),issues};
 };
 window.finishSceneLegacyPointerProbe=()=>{
  const owner=window.__sceneLegacyOwner,tip=document.querySelector('.is-scui00-root');
  const rect=tip?.getBoundingClientRect(),css=tip&&getComputedStyle(tip);
  const action=tip?.querySelector('.toggleCommentPreview');
  const b=action?.getBoundingClientRect();
  const hit=b&&document.elementFromPoint(b.left+b.width*.5,b.top+b.height*.5);
  const values={
   nativeTopLayer:document.fullscreenElement===host,
   tooltipVisible:!!tip&&css.visibility==='visible'&&css.display!=='none'&&
    Number(css.opacity)>0&&rect.width>0&&rect.height>0,
   tooltipInFullscreenSubtree:host.contains(tip),
   nativeButtonTarget:!!action&&(hit===action||action.contains(hit)),
   errors:owner?.issues||[]
  };
  owner?.binding?.dispose();owner?.cleanup?.();resetContext();
  delete window.__sceneLegacyOwner;
  return values;
 };
}
return {cases:counts.cases,checks:counts.checks,
 failed:counts.failed,failures};