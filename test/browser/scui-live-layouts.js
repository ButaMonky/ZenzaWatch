// Run inside an isolated headless Chromium page, no NicoNico request or login.
const failures=[],results=[];
const record=(test,ok,data)=>{results.push({test,ok});if(!ok)failures.push({test,...data});};
function events(){const m=new Map();return {
 on(k,f){if(!m.has(k))m.set(k,new Set());m.get(k).add(f);},off(k,f){m.get(k)?.delete(f);},
 emit(k,...v){for(const f of [...m.get(k)||[]])f(...v);}};}
const host=document.getElementById('player');
const vals={'sceneSearch.seekStepSeconds':5,'sceneSearch.idleHideSeconds':0,
 'sceneSearch.animation':'off','sceneSearch.controlsReveal':'always',...UiVisibilityRegistry.defaults()};
const onkeys=new Map();const config={getValue:k=>vals[k],setValue(k,v){vals[k]=v;
 for(const f of onkeys.get(k)||[])f(v);
 // The actual CommentPreviewView uses StyleSwitcher for these two styles.
 // Mock the switch, not the comment content or its animations.
 if(k==='enableCommentPreview'){
   document.getElementById('native-comment-list').disabled=v!==true;
   document.getElementById('native-comment-hover').disabled=v===true;
 }},onkey(k,f){if(!onkeys.has(k))onkeys.set(k,new Set());onkeys.get(k).add(f);},
 offkey(k,f){onkeys.get(k)?.delete(f);}};
const player=Object.assign(events(),{isOpen:true,watchId:'sm9',duration:1000,
 chatList:[{text:'local browser fixture',vpos:1200,uniqNo:'fixture'}],execCommand:()=>{}});
const bar={player,_playerConfig:config,_duration:1000,_seekBar:document.getElementById('seek'),
 storyboard:events(),_seekBarToolTip:{_$view:[document.getElementById('old')],
 _seekBarThumbnail:{_view:document.getElementById('thumb')}},
 _commentPreview:{_model:{_chatList:player.chatList},_view:{_view:document.getElementById('comments')}}};
function measure(id,mode,pct,{portal=id==='01'}={}){
 console.log('QA_PHASE '+id+'/'+mode+'/'+pct+(portal?'/portal':'')+' begin');
 let dialog=null,sidebar=null,originalParent=null,originalNext=null;
 const originalHostStyle=host.style.cssText;
 if(portal){
  originalParent=host.parentNode;originalNext=host.nextSibling;
  dialog=document.createElement('div');dialog.className='zenzaVideoPlayerDialog zen-family';
  dialog.style.cssText='position:fixed;inset:0;z-index:10000;pointer-events:none';
  originalParent.insertBefore(dialog,host);dialog.appendChild(host);
  sidebar=document.createElement('aside');sidebar.id='qa-info-sidebar';
  sidebar.style.cssText='position:absolute;right:0;top:0;bottom:0;'+
   'width:min(30vw,385px);background:#263238;z-index:1200;pointer-events:auto';
  dialog.appendChild(sidebar);
  if(mode==='fullscreen'){
   // The real Fullscreen.request targets .zenzaPlayerContainer, not dialog.
   // Chromium only paints descendants of the fullscreen element.
   host.style.cssText+=';position:fixed;inset:0;margin:0;width:100vw;height:100vh;contain:layout size';
   sidebar.style.display='none'; // outside the fullscreen top-layer subtree
  }
 }
 class TraceAdapter extends SceneSearchLegacyAdapter {
  start(mode){try{return super.start(mode);}catch(e){console.error('ADAPTER_TRACE '+e.stack);throw e;}}
 }
 const b=new SceneSearchPlayerBinding({Adapter:TraceAdapter,view:{videoControlBar:bar},dialog:player,document,
 container:host,events:events(),isFullscreen:()=>mode==='fullscreen',onError:code=>failures.push({code})});
 vals['sceneSearch.layout.normal']=id;vals['sceneSearch.layout.fullscreen']=id;
 // Reset both stored mode AND original hover/list stylesheet before
 // every new fixture; a direct vals assignment does not notify StyleSwitcher.
 config.setValue('enableCommentPreview',false);b.attach();
 const seek=bar._seekBar,r=seek.getBoundingClientRect(),x=r.left+r.width*pct;
 seek.dispatchEvent(new MouseEvent('mouseenter',{clientX:x,bubbles:true}));
 seek.dispatchEvent(new MouseEvent('mousemove',{clientX:x,bubbles:true}));
 const root=portal?dialog.querySelector('.zenzaSceneSearchHost'):
  host.querySelector('.zenzaSceneSearchHost');
 const label=id+'/'+mode+'/'+pct+(portal?'/portal':'');
 console.log('QA_PHASE '+label+' mounted');
 record(label+'/mounted',!!root,{});
 if(root){
  const rect=root.getBoundingClientRect();
  record(label+'/card-bounds',rect.left>=-1&&rect.right<=innerWidth+1&&rect.top>=-1&&rect.bottom<=innerHeight+1,
   {rect:rect.toJSON(),width:innerWidth,height:innerHeight});
  if(id==='01'&&r.width>host.getBoundingClientRect().width+64){
    const half=rect.width/2;
    // Thumbnail and right pane have a single viewport clamp. Cursor
    // tracking stops once both panels reach the physical right margin.
    const paneWidth=parseFloat(root.style.getPropertyValue('--scui-side-width'));
    const gap=parseFloat(root.style.getPropertyValue('--scui-side-gap'));
    const expected=portal?
      Math.max(8+half,Math.min(innerWidth-8-half-gap-paneWidth,x)):
      Math.max(half+6,Math.min(innerWidth-half-6,x));
    const actual=rect.left+half;
    record(label+'/group-follows-then-stops',Math.abs(actual-expected)<2,
      {expected,actual,paneWidth,gap,track:r.toJSON(),
       host:host.getBoundingClientRect().toJSON()});
  }
  for(const btn of root.querySelectorAll('button[data-scui-action]')){
   const s=getComputedStyle(btn);if(btn.hidden||s.display==='none'||s.visibility==='hidden')continue;
   const z=btn.getBoundingClientRect();
   record(label+'/button-'+btn.dataset.scuiAction,z.left>=-1&&z.right<=innerWidth+1&&z.top>=-1&&z.bottom<=innerHeight+1,
    {rect:z.toJSON(),width:innerWidth,height:innerHeight});
  }
  record(label+'/shared-canvas',root.contains(document.getElementById('thumb')),{});
  const commentView=document.getElementById('comments');
  if(portal){
    const expectedOwner=mode==='fullscreen'?host:dialog;
    record(label+'/fullscreen-dom-subtree',
      root.parentElement===expectedOwner &&
      getComputedStyle(root).position==='fixed',
      {parent:root.parentElement?.className,mode,
       fullscreenSubtree:mode==='fullscreen'?host.contains(root):null});
    const hostBottom=host.getBoundingClientRect().bottom;
    const targetBottom=hostBottom-(mode==='normal'?38:68);
    record(label+'/restored-video-relative-height',
      Math.abs(rect.bottom-targetBottom)<2,
      {sceneBottom:rect.bottom,originalVideoBottom:targetBottom,
       viewportBottom:innerHeight-(mode==='normal'?38:68)});
    const imageRect=root.querySelector('.zenzaSceneImageBox').getBoundingClientRect();
    const sidebarRect=sidebar.getBoundingClientRect();
    const ix=Math.max(sidebarRect.left+3,imageRect.left+4);
    const iy=imageRect.top+Math.min(imageRect.height/2,30);
    if(mode==='normal'&&ix<imageRect.right-2){
      const above=document.elementFromPoint(ix,iy);
      record(label+'/paints-above-sidebar',above===root||root.contains(above),
       {x:ix,y:iy,hit:above?.className||above?.tagName,
        scene:imageRect.toJSON(),sidebar:sidebarRect.toJSON()});
    }
  }
  record(label+'/flow-owner',
    root.querySelector('.zenzaSceneImageBox')?.contains(commentView)===true&&
    commentView.classList.contains('is-scui-flow')&&
    commentView.classList.contains('is-scui-active')&&
    (id!=='01'||!commentView.classList.contains('is-scui-classic-side')),{});
  // Native SeekBarThumbnail.is-visible has z-index:100 and is a CSS grid item.
  // The attached mini-comment must paint ABOVE that thumbnail, not underneath it.
  const sharedThumb=document.getElementById('thumb');
  const previousThumbZ=sharedThumb.style.getPropertyValue('z-index');
  sharedThumb.style.setProperty('z-index','100');
  const thumbZ=Number(getComputedStyle(sharedThumb).zIndex);
  const commentZ=Number(getComputedStyle(commentView).zIndex);
  record(label+'/flow-foreground-stacking',
    commentView.parentNode===root.querySelector('.zenzaSceneImageBox')&&
    sharedThumb.parentNode===commentView.parentNode&&
    Number.isFinite(commentZ)&&commentZ>thumbZ,
    {commentZ,thumbZ,mode:commentView.className});
  if(previousThumbZ){sharedThumb.style.setProperty('z-index',previousThumbZ);}
  else{sharedThumb.style.removeProperty('z-index');}
  if(id==='01'){
    const imageBox=root.querySelector('.zenzaSceneImageBox');
    const image=imageBox.getBoundingClientRect();
    const side=commentView.getBoundingClientRect();
    const placement=root.dataset.scuiSidePlacement;
    // This was the missing contract in Task716-727. The ORIGINAL flowing
    // CommentPreviewView must physically OVERLAP the storyboard image.
    const overImage=commentView.parentNode===imageBox&&
      placement==='overlay'&&!commentView.classList.contains('is-scui-classic-side')&&
      Math.abs(side.left-image.left)<=2&&
      Math.abs(side.right-image.right)<=2&&
      Math.abs(side.top-image.top)<=2&&
      Math.abs(side.bottom-image.bottom)<=2;
    record(label+'/classic-mini-OVER-thumbnail',overImage,
      {image:image.toJSON(),mini:side.toJSON(),placement,mode,pct});
    if(portal){
      record(label+'/flow-no-right-panel-reservation',
        root.style.getPropertyValue('--scui-side-width')==='0px'&&
        root.style.getPropertyValue('--scui-side-gap')==='0px',
        {width:root.style.getPropertyValue('--scui-side-width'),
         gap:root.style.getPropertyValue('--scui-side-gap')});
      if(pct>=.95){
        record(label+'/flow-fullwidth-thumbnail-follow',
          Math.abs(rect.right-(innerWidth-8))<=3,
          {sceneRight:rect.right,viewport:innerWidth,cursor:x});
      }
    }
    const paneStyle=getComputedStyle(commentView);
    const channels=(paneStyle.backgroundColor.match(/[\d.]+/g)||[]).map(Number);
    const alpha=channels.length>=4?channels[3]:1;
    const innerColor=getComputedStyle(commentView.querySelector('.listContainer')).backgroundColor;
    const innerChannels=(innerColor.match(/[\d.]+/g)||[]).map(Number);
    const innerAlpha=innerChannels.length>=4?innerChannels[3]:innerColor==='transparent'?0:1;
    record(label+'/classic-flow-transparent-background',
      Number(paneStyle.opacity)>=.99 && alpha===0 &&
      paneStyle.backgroundImage==='none' && innerAlpha===0,
      {opacity:paneStyle.opacity,bg:paneStyle.backgroundColor,alpha,
        innerColor,innerAlpha});
    record(label+'/classic-flow-image-top-align',
      Math.abs(side.top-image.top)<=2,
      {imageTop:image.top,paneTop:side.top,offset:side.top-image.top,placement});
    record(label+'/classic-flow-image-height-align',Math.abs(side.height-image.height)<=2,
      {imageHeight:image.height,paneHeight:side.height});
    const mini=commentView.querySelector('.nicoChat'),miniRect=mini?.getBoundingClientRect();
    record(label+'/classic-mini-inside-pane',!!miniRect&&
      miniRect.left>=side.left-1&&miniRect.right<=side.right+1&&
      miniRect.top>=side.top-1&&miniRect.bottom<=side.bottom+1,
      {mini:miniRect?.toJSON(),pane:side.toJSON()});
    // Test the original native hover CSS with NINE virtual rows, not an
    // invented single row at top:5px. This catches lower-edge piling up.
    const nativeRows=[...commentView.querySelectorAll('.listContainer>.nicoChat')];
    const drawn=nativeRows.filter(el=>getComputedStyle(el).display!=='none');
    const boxes=drawn.map(el=>el.getBoundingClientRect());
    const rowTop=boxes[0]?.top;
    record(label+'/classic-native-row-top',
      drawn.length>=1&&rowTop>=side.top-1&&
      rowTop<=side.top+Math.max(7,side.height*.32),
      {rowTop,paneTop:side.top,paneHeight:side.height,count:drawn.length});
    // Native UI00 hover rows overlap temporally by design; their animation
    // timing is based on vpos, NOT a fabricated flex-column row limit.
    record(label+'/native-virtual-rows-preserved',
      drawn.length===9&&drawn.every(el=>getComputedStyle(el).position==='absolute')&&
      Math.abs(boxes[7].top-(boxes[0].top-144))<=1,
      {drawn:drawn.length,top0:boxes[0].top,top7:boxes[7].top});
    const firstText=drawn[0]?.querySelector('.text');
    record(label+'/classic-native-text-running',firstText&&
      getComputedStyle(firstText).animationPlayState==='running',
      {playState:firstText&&getComputedStyle(firstText).animationPlayState});
    // The scene-card "animation off" preference must NOT cancel native
    // CommentPreviewView movement, which UI00 keeps completely independent.
    record(label+'/classic-original-animation-name',firstText&&
      getComputedStyle(firstText).animationName==='preview-text-moving',
      {animationName:firstText&&getComputedStyle(firstText).animationName});
  }
  config.setValue('enableCommentPreview',true);
  record(label+'/list-owner',
    (id==='01'?commentView.parentNode===root&&
      commentView.classList.contains('is-scui-classic-side'):
      commentView.parentNode===host)&&
    commentView.classList.contains('is-scui-list')&&
    getComputedStyle(commentView).display!=='none',{});
  if(id==='01'){
    const image=root.querySelector('.zenzaSceneImageBox').getBoundingClientRect();
    const side=commentView.getBoundingClientRect();
    const placement=root.dataset.scuiSidePlacement;
    const gap=parseFloat(root.style.getPropertyValue('--scui-side-gap'))||8;
    const separate=placement==='right'&&side.left>=image.right+gap-2;
    record(label+'/classic-list-side-and-interaction',separate&&side.top>=-1&&
      side.left>=7&&side.right<=innerWidth-7&&
      commentView.parentNode===root&&
      !root.querySelector('.zenzaSceneImageBox').contains(commentView)&&
      commentView.classList.contains('is-scui-classic-side')&&
      getComputedStyle(commentView).pointerEvents!=='none',
      {placement,image:image.toJSON(),side:side.toJSON()});
    if(portal&&pct>=.95){
      record(label+'/list-group-clamp-right-edge',
        Math.abs(side.right-(innerWidth-8))<=3,
        {commentRight:side.right,viewport:innerWidth});
    }
    const listStyle=getComputedStyle(commentView);
    const commentToggle=root.querySelector('.scene-comment-toggle');
    const toggleRect=commentToggle?.getBoundingClientRect();
    const toggleStyle=commentToggle?getComputedStyle(commentToggle):null;
    if(toggleRect&&toggleStyle.display!=='none'&&
      toggleStyle.visibility==='visible'){
      const hit=document.elementFromPoint(toggleRect.left+toggleRect.width/2,
        toggleRect.top+toggleRect.height/2);
      record(label+'/classic-mode-toggle-hit',hit===commentToggle||
        commentToggle.contains(hit),
        {button:toggleRect.toJSON(),hit:hit?.className||hit?.tagName,
         pane:side.toJSON()});
    }
    const listChannels=(listStyle.backgroundColor.match(/[\d.]+/g)||[]).map(Number);
    const listAlpha=listChannels.length>=4?listChannels[3]:1;
    record(label+'/classic-list-contrast',Number(listStyle.opacity)>=.99&&
      listAlpha>=.92,{opacity:listStyle.opacity,bg:listStyle.backgroundColor});
    // An off-viewport pane cannot receive mouse events. Verify hit testing
    // whenever the pointer location leaves physical space for a side pane.
    const canClick=side.left<innerWidth-12&&side.top>=0;
    const hit=canClick?document.elementFromPoint(
      Math.min(side.left+side.width/2,innerWidth-4),
      side.top+side.height/2):null;
    if(canClick)record(label+'/classic-list-hit-target',
      hit===commentView||commentView.contains(hit),
      {placement,hit:hit?.className||hit?.tagName});
    config.setValue('enableCommentPreview',false);
    record(label+'/classic-flow-restored-OVER-image',
      commentView.parentNode===root.querySelector('.zenzaSceneImageBox')&&
      commentView.classList.contains('is-scui-flow')&&
      !commentView.classList.contains('is-scui-classic-side')&&
      root.dataset.scuiSidePlacement==='overlay',{});
  }
  if(id==='02'){
    const player=host.getBoundingClientRect();
    const comment=document.getElementById('comments').getBoundingClientRect();
    const below=host.dataset.scenePlacement==='below';
    const isNarrow=host.dataset.sceneNarrow==='true';
    const placed=mode==='normal'?
      below?(rect.top>=player.bottom+9):
        rect.bottom<=player.bottom-65:
      rect.left<=player.left+30&&rect.bottom<=player.bottom-65;
    record(label+'/twin-original-placement',placed,{
      mode,below,rect:rect.toJSON(),player:player.toJSON()
    });
    if(mode==='normal'&&below){
      const separated=isNarrow?comment.top>=rect.bottom+3:
        comment.left>=rect.right-4&&Math.abs(comment.top-rect.top)<=14;
      record(label+'/twin-separated-comments',separated,{
        isNarrow,scene:rect.toJSON(),comment:comment.toJSON()
      });
    }
    const handle=root.querySelector('.scene-more');
    record(label+'/twin-exposed-expander',
      !!handle&&!root.querySelector('.zenzaSceneActions')?.contains(handle),{});
  }
  if(Number(id)>=3){
    const comment=document.getElementById('comments');
    const c=comment.getBoundingClientRect(),style=getComputedStyle(comment);
    const dataset=host.dataset;
    record(label+'/comment-layout-owner',
      dataset.sceneSearchLayout===id&&dataset.sceneMode===mode,{
        owner:dataset.sceneSearchLayout,mode:dataset.sceneMode
      });
    record(label+'/comment-bounds',
      c.left>=-1&&c.right<=innerWidth+1&&c.top>=-1&&c.bottom<=innerHeight+1,{
        rect:c.toJSON(),width:innerWidth,height:innerHeight
      });
    // The original Zenza comment element must remain owned by the original
    // control bar. Layouts alter location only, never display or click logic.
    const expected={
      '03':mode==='normal'?['left','18px']:['right','20px'],
      '04':mode==='normal'?['left','15px']:['right','19px'],
      '06':['right','12px'],
      '08':mode==='normal'?['right','12px']:['left','12px'],
      '10':dataset.sceneCommentSide==='left'?['left','12px']:['right','12px']
    }[id];
    if(expected){
      record(label+'/comment-anchor',style[expected[0]]===expected[1],{
        property:expected[0],actual:style[expected[0]],expected:expected[1]
      });
    }
  }
  config.setValue('sceneSearch.seekStepSeconds',0);
  record(label+'/zero',root.querySelector('.scene-seek-back').getBoundingClientRect().width===0,{});
  if(id==='01'){
    const pane=commentView.getBoundingClientRect();
    const rows=[...commentView.querySelectorAll('.listContainer>.nicoChat')]
      .filter(row=>getComputedStyle(row).display!=='none');
    const boxes=rows.map(row=>row.getBoundingClientRect());
    record(label+'/compact-keeps-native-rows',rows.length===9&&
      rows.every(row=>getComputedStyle(row).position==='absolute'),
      {pane:pane.toJSON(),rowCount:rows.length});
  }
  config.setValue('sceneSearch.seekStepSeconds',5);
 }
 b.dispose();record(label+'/cleanup',!document.querySelector('.zenzaSceneSearchHost')&&
 document.querySelectorAll('style[data-scui-layout-style]').length===0&&
 !host.dataset.sceneSearchLayout&&!host.dataset.sceneMode&&!host.dataset.scenePlacement,
 {dataset:{...host.dataset}});
 if(portal){
   host.style.cssText=originalHostStyle;
   originalParent.insertBefore(host,originalNext);
   dialog.remove();
 }
}
try{for(const mode of ['normal','fullscreen'])for(let n=1;n<=10;n++){
 if(new URLSearchParams(location.search).has('one') && (n!==1||mode!=='normal'))continue;
 for(const pct of new URLSearchParams(location.search).has('one')?[0.5]:[0.05,0.5,0.95,0.99])measure(String(n).padStart(2,'0'),mode,pct);
  if(!new URLSearchParams(location.search).has('one')){
    const seek=document.getElementById('seek');
    const oldHostWidth=host.style.width,oldSeekWidth=seek.style.width;
    try{
      host.style.width='calc(100vw - min(30vw, 385px))';
      seek.style.width='calc(100vw - 32px)';
      for(const pct of [0.05,0.5,0.95,0.99])
        measure('01','normal',pct,{portal:true});
    }finally{host.style.width=oldHostWidth;seek.style.width=oldSeekWidth;}
  }
}}catch(e){failures.push({exception:String(e),stack:e.stack});}
document.getElementById('qa-result').textContent=JSON.stringify({
 width:innerWidth,height:innerHeight,checks:results.length,failures});
document.documentElement.dataset.qa=failures.length?'FAIL':'PASS';
