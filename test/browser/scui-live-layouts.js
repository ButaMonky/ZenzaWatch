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
 vals['sceneSearch.layout.normal']=id;vals['sceneSearch.layout.fullscreen']=id;b.attach();
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
  for(const btn of root.querySelectorAll('button[data-scui-action]')){
   const s=getComputedStyle(btn);if(btn.hidden||s.display==='none'||s.visibility==='hidden')continue;
   const z=btn.getBoundingClientRect();
   record(label+'/button-'+btn.dataset.scuiAction,z.left>=-1&&z.right<=innerWidth+1&&z.top>=-1&&z.bottom<=innerHeight+1,
    {rect:z.toJSON(),width:innerWidth,height:innerHeight});
  }
  record(label+'/shared-canvas',root.contains(document.getElementById('thumb')),{});
  config.setValue('sceneSearch.seekStepSeconds',0);
  record(label+'/zero',root.querySelector('.scene-seek-back').getBoundingClientRect().width===0,{});
  config.setValue('sceneSearch.seekStepSeconds',5);
 }
 b.dispose();record(label+'/cleanup',!host.querySelector('.zenzaSceneSearchHost')&&
 document.querySelectorAll('style[data-scui-layout-style]').length===0,{});
}
try{for(const mode of ['normal','fullscreen'])for(let n=1;n<=10;n++){
 if(new URLSearchParams(location.search).has('one') && (n!==1||mode!=='normal'))continue;
 for(const pct of new URLSearchParams(location.search).has('one')?[0.5]:[0.05,0.5,0.95,0.99])measure(String(n).padStart(2,'0'),mode,pct);
}}catch(e){failures.push({exception:String(e),stack:e.stack});}
document.getElementById('qa-result').textContent=JSON.stringify({
 width:innerWidth,height:innerHeight,checks:results.length,failures});
document.documentElement.dataset.qa=failures.length?'FAIL':'PASS';
