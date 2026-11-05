// Runs only inside isolated Chromium with real, AST-extracted VideoControlBar
// CSS/HTML/seek-method bodies. Stubs network + player state, NOT seek methods.
const bindings=new Map();
function asElement(v){return v==='body'?document.body:v?.[0]||v;}
function wrap(node){
 const target=asElement(node),out=[target];
 out.append=child=>{target.append(asElement(child));return out;};
 out.on=(event,fn,options)=>{
  const type=event.split('.')[0],key=target;
  target.addEventListener(type,fn,typeof options==='object'?options:undefined);
  if(!bindings.has(key))bindings.set(key,[]);
  bindings.get(key).push({event,fn,type,options});
  return out;
 };
 out.off=event=>{
  const rows=bindings.get(target)||[];
  for(const rec of [...rows])if(!event||rec.event===event){
   target.removeEventListener(rec.type,rec.fn);
   rows.splice(rows.indexOf(rec),1);
  }
  if(!rows.length)bindings.delete(target);
  return out;
 };
 return out;
}
wrap.html=html=>{
 const t=document.createElement('template');t.innerHTML=html;
 return wrap(t.content.firstElementChild);
};
const throttle={raf:fn=>{
 let frame=null,args;const f=(...next)=>{args=next;if(frame!==null)return;
  frame=requestAnimationFrame(()=>{frame=null;fn(...args);});
 };f.cancel=()=>{if(frame!==null)cancelAnimationFrame(frame);frame=null;};
 return f;
}};
const cssUtil={registerProps(){},s:x=>x+'s',px:x=>x+'px',
 setProps:(...rows)=>rows.forEach(([node,key,value])=>
  node.style.setProperty(key,String(value)))};
window.qaNativeCommands=[];
const util={$:wrap,addStyle(){},secToTime:sec=>String(sec),
 dispatchCommand:(node,command,value)=>{
  window.qaNativeCommands.push({command,value});
  window.qaCommand?.(command,value);
 }};
function emitter(){
 const m=new Map();return {
  on(k,f){if(!m.has(k))m.set(k,new Set());m.get(k).add(f);},
  off(k,f){m.get(k)?.delete(f);},
  emit(k,...args){for(const fn of [...m.get(k)||[]])fn(...args);},
  count(){return [...m.values()].reduce((n,set)=>n+set.size,0);}
 };
}
const host=document.querySelector('#player'),control=host.querySelector('.videoControlBar');
const seek=control.querySelector('.seekBar'),range=control.querySelector('.seekRange');
const seekContainer=control.querySelector('.seekBarContainer');
const vcbStyles={
 normal:['vcb-base'],
 small:['vcb-base','vcb-popup'],
 fullscreen:['vcb-base','vcb-full','vcb-screen-full']
};
const vals={'sceneSearch.seekStepSeconds':5,'sceneSearch.idleHideSeconds':0,
 'sceneSearch.animation':'off','sceneSearch.controlsReveal':'always',
 ...UiVisibilityRegistry.defaults()};
const configEvents=new Map();
const config={
 getValue:key=>vals[key],
 setValue(key,value){
  vals[key]=value;
  if(key==='enableCommentPreview'){
   comment.mode=value?'list':'hover';
   // VideoControlBar constructor's native updateEnableCommentPreview
   // toggles this class. The isolated fixture must preserve that CSS owner.
   seekContainer.classList.toggle('enableCommentPreview',value===true);
  }
  for(const fn of configEvents.get(key)||[])fn(value);
 },
 onkey(key,fn){if(!configEvents.has(key))configEvents.set(key,new Set());
  configEvents.get(key).add(fn);},
 offkey(key,fn){configEvents.get(key)?.delete(fn);},
 subscriptions:()=>[...configEvents.values()].reduce((n,s)=>n+s.size,0)
};
const player=Object.assign(emitter(),{isOpen:true,watchId:'sm9',duration:1000,
 currentTime:0,chatList:[],execCommand(command,value){
 window.qaNativeCommands.push({command,value,via:'player'});
}});
const uiEvents=emitter(),storyboard=Object.assign(emitter(),{
 _watchId:'sm9',model:{isAvailable:false},currentTime:0,
 setCurrentTime(sec){this.currentTime=sec;window.qaStoryboardTimes.push(sec);}
});
window.qaStoryboardTimes=[];
const tooltipEl=document.createElement('template');
tooltipEl.innerHTML=window.VCB_NATIVE_TOOLTIP;
const tip=tooltipEl.content.firstElementChild;
seekContainer.append(tip);
const thumb=document.createElement('div');thumb.className='zenzaSeekThumbnail is-visible';
const image=document.createElement('div');image.className='zenzaSeekThumbnail-image';
const initialCanvas=document.createElement('canvas');
initialCanvas.width=160;initialCanvas.height=90;
image.append(initialCanvas);thumb.append(image);
tip.querySelector('.seekBarThumbnailContainer').append(thumb);
const comment=new CommentPreview({$container:wrap(seekContainer)});
comment._view._view.id='comments';
const makeChats=()=>Array.from({length:9},(_,i)=>({
 vpos:1000+i*200,uniqNo:'native-'+i,text:'native preview '+i,
 no:i,date:1600000000,userId:'qa-user',duration:12,color:'#fff',fork:0}));
comment.chatList={top:[],bottom:[],naka:makeChats()};
comment.currentTime=2;
comment._view._onUpdate();comment._view.applyView();
const tipRuntime=new NativeTooltipHandlers();
tipRuntime._$view=[tip];tipRuntime._$container=[seekContainer];
tipRuntime._seekBarThumbnail={_view:thumb,currentTime:0};
tipRuntime.currentTimeLabel={text:''};
const bar=new NativeSeekHandlers();
bar._seekBar=seek;bar._seekRange=range;bar._seekBarMouseX=0;
bar._duration=1000;bar._seekBarToolTip=tipRuntime;
bar._commentPreview=comment;bar.storyboard=storyboard;
bar._playerConfig=config;bar.player=player;bar._sceneSearchPinnedTime=()=>null;
bar.state={isDragging:false,isWheelSeeking:false};
bar.classList=control.classList;
bar._seekBarToolTip._seekBarThumbnail._view=thumb;
const wheel=new NativeWheelHandlers();
wheel._props={isActive:false,pos:0,ax:0,lastWheelTime:0,duration:1000};
wheel._elm={root:document.createElement('div')};
wheel._elm.root.className='WheelSeeker';wheel._elm.root.style.display='none';
host.append(wheel._elm.root);
wheel._bound={onMouseUp:e=>wheel.onMouseUp(e),dispatchSeek:()=>wheel.dispatchSeek()};
wheel.dispatchCommand=(cmd,param)=>{
 window.qaNativeCommands.push({command:cmd,value:param,via:'wheel'});
 if(cmd==='wheelSeek-start'){
  bar.state.isWheelSeeking=true;bar.classList.add('is-wheelSeeking');
 }else if(cmd==='wheelSeek-end'){
  bar.state.isWheelSeeking=false;bar.classList.remove('is-wheelSeeking');
 }else if(cmd==='wheelSeek')bar._onWheelSeek(param);
 else if(cmd==='seek')player.currentTime=param;
};
const onInput=e=>bar._onSeekRangeInput(e);
const onChange=e=>e.target.blur();
const onDown=e=>bar._onSeekBarMouseDown(e);
const onMove=e=>bar._onSeekBarMouseMove(e);
const onWheel=e=>wheel.onWheel(e);
const initialState={style:host.style.cssText,cls:host.className,scrollY:scrollY};
let binding=null,live=false,activeMode='normal',activeLayout='01';
const setMode=mode=>{
 if(!vcbStyles[mode])throw Error('QA_UNKNOWN_MODE_'+mode);
 activeMode=mode;
 for(const key of Object.values(vcbStyles).flat()){
  const node=document.getElementById(key);
  node.disabled=!vcbStyles[mode].includes(key);
 }
 host.style.cssText=initialState.style;
 host.className=initialState.cls;
 document.body.classList.add('showVideoControlBar','is-controlBarActive');
 if(mode==='small'){
  host.classList.add('zenzaScreenMode_small');
  host.style.width='min(450px,calc(100vw - 24px))';host.style.height='310px';
 }else if(mode==='fullscreen'){
  host.classList.add('zenzaScreenMode_full','is-fullscreen');
  host.style.cssText='position:fixed;inset:0;margin:0;width:100vw;height:100vh';
 }
 player.screenMode=mode;
 window.dispatchEvent(new Event('resize'));
};
window.qaStart=({layout='01',mode='normal'}={})=>{
 if(live)throw Error('QA_ALREADY_STARTED');
 live=true;activeLayout=layout;setMode(mode);
 vals['sceneSearch.layout.normal']=layout;
 vals['sceneSearch.layout.fullscreen']=layout;
 window.qaNativeCommands.length=0;window.qaStoryboardTimes.length=0;
 range.addEventListener('input',onInput);range.addEventListener('change',onChange);
 seek.addEventListener('mousedown',onDown);
 seek.addEventListener('mousemove',onMove);
 host.addEventListener('wheel',onWheel,{passive:false});
 binding=new SceneSearchPlayerBinding({
  view:{videoControlBar:bar},dialog:player,document,
  container:host,events:uiEvents,
  isFullscreen:()=>activeMode==='fullscreen',
  onError:code=>(window.qaErrors.push(code))
 });
 binding.attach();
 return window.qaSnapshot();
};
window.qaErrors=[];
window.qaSetLayout=id=>{
 vals['sceneSearch.layout.normal']=id;
 vals['sceneSearch.layout.fullscreen']=id;
 activeLayout=id;
 config.setValue('sceneSearch.layout.normal',id);
 config.setValue('sceneSearch.layout.fullscreen',id);
 return window.qaSnapshot();
};
window.qaSetMode=mode=>{
 setMode(mode);uiEvents.emit('fullscreenStatusChange');
 player.emit('screenModeChange',mode);
 return window.qaSnapshot();
};
window.qaStop=()=>{
 if(!live)return {alreadyStopped:true};
 if(bar.state.isDragging)bar._endMouseDrag();
 bar._cancelStoryboardLongPress();
 if(wheel.isActive)wheel.disable();
 const oldBinding=binding;
 binding?.dispose();binding=null;
 const cleanup={geometryObserverGone:!oldBinding?._geometryObserver,
  mutationObserverGone:!oldBinding?._geometryMutation,
  pendingFrameGone:oldBinding?._geometryFrame==null,
  subscriptionsGone:(oldBinding?._subscriptions?.length||0)===0};
 range.removeEventListener('input',onInput);range.removeEventListener('change',onChange);
 seek.removeEventListener('mousedown',onDown);seek.removeEventListener('mousemove',onMove);
 host.removeEventListener('wheel',onWheel);
 live=false;
 const pre=window.qaNativeCommands.length;
 range.dispatchEvent(new Event('input',{bubbles:true}));
 cleanup.nativeInputListenerGone=pre===window.qaNativeCommands.length;
 cleanup.playerListeners=player.count();cleanup.uiListeners=uiEvents.count();
 return {...window.qaSnapshot(),cleanup};
};
window.qaSnapshot=()=>{
 const roots=[...document.querySelectorAll('.zenzaSceneSearchHost,.is-scui00-root')];
 const root=roots[0],r=root?.getBoundingClientRect();
 return {live,mode:activeMode,layout:activeLayout,
  rootCount:roots.length,rootClass:root?.className,
  rootHidden:root?.hidden,rootDisplay:root?getComputedStyle(root).display:null,
  controller:binding?.adapter?.bridge?.controller?.snapshot||null,
  rootRect:r?{left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height}:null,
  seekRect:seek.getBoundingClientRect().toJSON(),
  rangeRect:range.getBoundingClientRect().toJSON(),
  toolbarRect:control.getBoundingClientRect().toJSON(),
  barOpacity:getComputedStyle(control).opacity,
  nativeRange:range.type==='range',
  actualControlButtons:[...control.querySelectorAll('.controlItemContainer .controlButton')].length,
  commentOwner:comment._view._view.parentElement?.className,
  commentMode:comment._view._view.dataset.commentPreviewMode,
  commentElements:document.querySelectorAll('.zenzaCommentPreview').length,
  canvasCount:host.querySelectorAll('canvas').length,
  fullscreenOwner:document.fullscreenElement===host,
  dragging:bar.state.isDragging,longPressed:bar.classList.contains('is-storyboardLongPress'),
  wheelActive:wheel.isActive,wheelSeeking:bar.state.isWheelSeeking,
  rangeValue:range.value,events:[...window.qaNativeCommands],
  bindings:bindings.size,configSubscriptions:config.subscriptions(),
  errors:[...window.qaErrors]};
};
window.qaDom={host,seek,range,control,seekContainer,bar,tip,thumb,comment,player,uiEvents,config,
 wheel,storyboard,initialCanvas,get binding(){return binding;}};
