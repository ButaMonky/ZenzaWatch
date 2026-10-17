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
 for(const f of onkeys.get(k)||[])f(v);},onkey(k,f){if(!onkeys.has(k))onkeys.set(k,new Set());onkeys.get(k).add(f);},
 offkey(k,f){onkeys.get(k)?.delete(f);}};
const player=Object.assign(events(),{isOpen:true,watchId:'sm9',duration:1000,
 chatList:[{text:'local browser fixture',vpos:1200,uniqNo:'fixture'}],execCommand:()=>{}});
const bar={player,_playerConfig:config,_duration:1000,_seekBar:document.getElementById('seek'),
 storyboard:events(),_seekBarToolTip:{_$view:[document.getElementById('old')],
 _seekBarThumbnail:{_view:document.getElementById('thumb')}},
 _commentPreview:{_model:{_chatList:player.chatList},_view:{_view:document.getElementById('comments')}}};
function measure(id,mode,pct){
 console.log('QA_PHASE '+id+'/'+mode+'/'+pct+' begin');
 class TraceAdapter extends SceneSearchLegacyAdapter {
  start(mode){try{return super.start(mode);}catch(e){console.error('ADAPTER_TRACE '+e.stack);throw e;}}
 }
 const b=new SceneSearchPlayerBinding({Adapter:TraceAdapter,view:{videoControlBar:bar},dialog:player,document,
 container:host,events:events(),isFullscreen:()=>mode==='fullscreen',onError:code=>failures.push({code})});
 vals['sceneSearch.layout.normal']=id;vals['sceneSearch.layout.fullscreen']=id;
 vals.enableCommentPreview=false;b.attach();
 const seek=bar._seekBar,r=seek.getBoundingClientRect(),x=r.left+r.width*pct;
 seek.dispatchEvent(new MouseEvent('mouseenter',{clientX:x,bubbles:true}));
 seek.dispatchEvent(new MouseEvent('mousemove',{clientX:x,bubbles:true}));
 const root=host.querySelector('.zenzaSceneSearchHost');
 const label=id+'/'+mode+'/'+pct;
 console.log('QA_PHASE '+label+' mounted');
 record(label+'/mounted',!!root,{});
 if(root){
  const rect=root.getBoundingClientRect();
  record(label+'/card-bounds',rect.left>=-1&&rect.right<=innerWidth+1&&rect.top>=-1&&rect.bottom<=innerHeight+1,
   {rect:rect.toJSON(),width:innerWidth,height:innerHeight});
  if(id==='01'&&r.width>host.getBoundingClientRect().width+64){
    const half=rect.width/2;
    const expected=Math.max(half+6,Math.min(innerWidth-half-6,x));
    const actual=rect.left+half;
    record(label+'/seek-track-centered',Math.abs(actual-expected)<2,
      {expected,actual,track:r.toJSON(),host:host.getBoundingClientRect().toJSON()});
  }
  for(const btn of root.querySelectorAll('button[data-scui-action]')){
   const s=getComputedStyle(btn);if(btn.hidden||s.display==='none'||s.visibility==='hidden')continue;
   const z=btn.getBoundingClientRect();
   record(label+'/button-'+btn.dataset.scuiAction,z.left>=-1&&z.right<=innerWidth+1&&z.top>=-1&&z.bottom<=innerHeight+1,
    {rect:z.toJSON(),width:innerWidth,height:innerHeight});
  }
  record(label+'/shared-canvas',root.contains(document.getElementById('thumb')),{});
  const commentView=document.getElementById('comments');
  record(label+'/flow-overlay',
    root.querySelector('.zenzaSceneImageBox')?.contains(commentView)===true&&
    commentView.classList.contains('is-scui-active'),{});
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
  config.setValue('enableCommentPreview',true);
  record(label+'/list-owner',
    commentView.parentNode===host&&
    commentView.classList.contains('is-scui-list')&&
    getComputedStyle(commentView).display!=='none',{});
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
  config.setValue('sceneSearch.seekStepSeconds',5);
 }
 b.dispose();record(label+'/cleanup',!host.querySelector('.zenzaSceneSearchHost')&&
 document.querySelectorAll('style[data-scui-layout-style]').length===0&&
 !host.dataset.sceneSearchLayout&&!host.dataset.sceneMode&&!host.dataset.scenePlacement,
 {dataset:{...host.dataset}});
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
      for(const pct of [0.05,0.5,0.95,0.99])measure('01','normal',pct);
    }finally{host.style.width=oldHostWidth;seek.style.width=oldSeekWidth;}
  }
}}catch(e){failures.push({exception:String(e),stack:e.stack});}
document.getElementById('qa-result').textContent=JSON.stringify({
 width:innerWidth,height:innerHeight,checks:results.length,failures});
document.documentElement.dataset.qa=failures.length?'FAIL':'PASS';
