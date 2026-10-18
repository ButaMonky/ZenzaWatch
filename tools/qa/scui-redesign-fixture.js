// Offline fixture: actual scene modules, CommentPreview model/view and native CSS.
function events(){const m=new Map();return {on(k,f){if(!m.has(k))m.set(k,new Set());m.get(k).add(f);},
 off(k,f){m.get(k)?.delete(f);},emit(k,...a){for(const f of [...m.get(k)||[]])f(...a);}};}
const host=document.getElementById('player'),seek=document.getElementById('seek');
// Production exempts only player-owned body children from its page input guard.
host.classList.add('zen-family');document.body.classList.add('zenzaScreenMode_big');
const old=document.getElementById('old'),thumb=document.getElementById('thumb');
old.className='seekBarToolTip';
const tooltipTemplate=document.createElement('template');tooltipTemplate.innerHTML=nativeTooltipTemplate;
old.replaceChildren(...tooltipTemplate.content.firstElementChild.childNodes);
old.querySelector('.currentTime').textContent='0:02';
old.querySelector('.currentTime').style.width='50px';
old.querySelector('.seekBarThumbnailContainer').append(thumb);
thumb.classList.add('is-visible');
thumb.innerHTML='<div class="zenzaSeekThumbnail-image"><canvas width="160" height="90" class="zenzaSeekThumbnail-thumbnail"></canvas></div>';
const ctx=thumb.querySelector('canvas').getContext('2d');
ctx.fillStyle='#235870';ctx.fillRect(0,0,160,90);ctx.fillStyle='#9cdef5';ctx.font='16px sans-serif';ctx.fillText('Scene preview',20,48);
document.getElementById('comments').remove();seek.className='seekBarContainer';seek.append(old);
const video=document.createElement('div');video.className='videoPlayer';video.style.cssText='position:absolute;inset:0 0 40px;background:#233443';host.prepend(video);
const vals={'sceneSearch.presentation.normal':'follow','sceneSearch.presentation.fullscreen':'follow',
 'sceneSearch.idleHideSeconds':0,'sceneSearch.seekStepSeconds':5,'sceneSearch.controlsReveal':'always',
 'sceneSearch.commentPreviewVisible':true,'sceneSearch.miniCommentVisible':true,'sceneSearch.commentListVisible':true,
 'sceneSearch.thumbnailScale':100,'sceneSearch.commentListBackgroundOpacity':90,...UiVisibilityRegistry.defaults()};
const listeners=new Map(),saved=new Set(Object.keys(vals));
const config={getValue:k=>vals[k],setValue(k,v){saved.add(k);vals[k]=v;
 for(const f of [...listeners.get(k)||[]])f(v);},
 onkey(k,f){if(!listeners.has(k))listeners.set(k,new Set());listeners.get(k).add(f);},
 offkey(k,f){listeners.get(k)?.delete(f);},
 resolveSceneSearch:()=>SceneSearchPreferences.resolve(k=>vals[k],k=>saved.has(k))};
const player=Object.assign(events(),{isOpen:true,watchId:'sm9',duration:100,screenMode:'normal',execCommand:(c,v)=>qaNativeCommands.push([c,v])});
const bar={player,_playerConfig:config,_duration:100,_seekBar:seek,storyboard:events(),
 _seekBarToolTip:{_$view:[old],_seekBarThumbnail:{_view:thumb}},
 _commentPreview:new CommentPreview({$container:wrap(seek)})};
util.dispatchCommand=(node,command,param)=>node.dispatchEvent(new CustomEvent('command',{detail:{command,param},bubbles:true}));
host.addEventListener('command',e=>{qaNativeCommands.push([e.detail.command,e.detail.param]);e.stopPropagation();});
const updateMode=()=>{const open=config.resolveSceneSearch().listOpen;seek.classList.toggle('enableCommentPreview',open);bar._commentPreview.mode=open?'list':'hover';};
for(const k of ['enableCommentPreview','sceneSearch.commentPreviewVisible','sceneSearch.commentListVisible'])config.onkey(k,updateMode);
bar._commentPreview.chatList={top:[],bottom:[],naka:Array.from({length:40},(_,i)=>({
 vpos:i*10,uniqNo:'browser'+i,text:'コメント '+i+'　★  ＡＡ',no:i,date:1600000000,
 userId:'fixture',duration:12,color:'#fff',fork:0}))};
bar._commentPreview.currentTime=2;bar._commentPreview._view._onUpdate();bar._commentPreview._view.applyView();
old.querySelector('.toggleCommentPreview').onclick=()=>config.setValue('enableCommentPreview',!vals.enableCommentPreview);
seek.addEventListener('mousemove',e=>{
 const time=bar._sceneSearchPinnedTime?.()??2;
 bar._commentPreview.currentTime=time;bar._commentPreview.update(e.clientX);
});
const playerView=Object.assign(events(),{videoControlBar:bar});
const qaBinding=new SceneSearchPlayerBinding({view:playerView,dialog:player,document,container:host,events:events(),
 isFullscreen:()=>!!document.fullscreenElement,onError:code=>{throw Error(code);}});
qaBinding.attach();
window.qaReady=true;
