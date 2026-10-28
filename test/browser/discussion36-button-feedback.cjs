'use strict';
// Offline Chromium regression: production view methods, templates, and CSS.
// No NicoNico page, account, request, or command dispatcher is used.
const assert=require('assert'),fs=require('fs'),path=require('path'),os=require('os');
const vm=require('vm');
const {spawnSync}=require('child_process');
const parser=require('@babel/parser'),traverse=require('@babel/traverse').default;
const {extract,loadClass,createContext,read}=require('../helpers/extractSource');
const {startChromeCdp}=require('../helpers/startChromeCdp');
const viewSource=extract('src/NicoVideoPlayerDialog.js','NicoVideoPlayerDialogView');
const View=loadClass('src/NicoVideoPlayerDialog.js','NicoVideoPlayerDialogView',createContext({Emitter:class{}}));
for(const name of ['_flashActionFeedback','_clearActionFeedback']) {
 assert.strictEqual(typeof View.prototype[name],'function','Discussion #36 missing production API: '+name);
}
const evalContext=vm.createContext({
 VideoControlBar:{BASE_HEIGHT:64},CONSTANT:{BASE_CSS_VARS:''},ZenzaWatch:{env:'TEST',version:'test',build:'offline'},
 ZenzaCommentHistoryCore:{HISTORY_ICON:'H'},
 util:{toRgba:()=> 'rgba(255,255,204,.3)'}
});
const styles=[],templates={};
for(const rel of ['src/constant.js','src/VideoControlBar.js','src/NicoVideoPlayerDialog.js']) {
 const source=read(rel);
 traverse(parser.parse(source,{sourceType:'unambiguous',plugins:['classProperties']}),{
  noScope:true,
  CallExpression(p){
   const n=p.node;
   if(n.callee.type!=='MemberExpression'||n.callee.object.name!=='util'||n.callee.property.name!=='addStyle')return;
   const opts=n.arguments[1];
   const label=opts?.properties?.find(x=>x.key.name==='className')?.value?.value;
   if(!label||!/(?:videoControlBar|videoHoverMenu)/.test(label))return;
   styles.push({label,css:vm.runInContext(source.slice(n.arguments[0].start,n.arguments[0].end),evalContext)});
  },
  AssignmentExpression(p){
   const n=p.node;
   if(n.left.type!=='MemberExpression')return;
   const owner=n.left.object.name;
   if(owner==='CONSTANT'&&n.left.property.name==='COMMON_CSS') {
    styles.push({label:'common',css:vm.runInContext(source.slice(n.right.start,n.right.end),evalContext)});
   }
   if(owner==='SeekBarToolTip'&&n.left.property.name==='__css__') {
    styles.push({label:'seekBarToolTip',css:vm.runInContext(source.slice(n.right.start,n.right.end),evalContext)});
   }
   if(n.left.property.name==='__tpl__'&&['VideoControlBar','VideoHoverMenu','SeekBarToolTip'].includes(owner)) {
    templates[owner]=vm.runInContext(source.slice(n.right.start,n.right.end),evalContext);
   }
  }
 });
}
assert(templates.VideoControlBar&&templates.VideoHoverMenu,'production templates missing');
const html='<!doctype html><meta charset="utf-8">'+
 styles.map(({label,css})=>'<style data-production-style="'+label+'"'+(/screenMode/.test(label)?' disabled':'')+'>'+css+'</style>').join('')+
 '<style>html,body{margin:0;width:100%;height:100%}#dialog,#player{position:fixed;inset:0}.scalingUI{--zenza-ui-scale:1}</style>'+
 '<div id="dialog" class="is-open"><div id="player" class="zenzaPlayerContainer is-playlistEnable is-showComment is-enableFilter">'+
 templates.VideoHoverMenu+templates.VideoControlBar+'</div></div><script>'+`
window.Emitter=class{};
window.ClassList=e=>e.classList;
window.util={StyleSwitcher:{update(){}}};
window.Fullscreen={value:false,now(){return this.value}};
${viewSource}
const host=document.querySelector('#player');
document.querySelector('.seekBarContainer').insertAdjacentHTML('beforeend',${JSON.stringify(templates.SeekBarToolTip)});
window.view=Object.create(NicoVideoPlayerDialogView.prototype);
Object.assign(view,{
 _$dialog:[document.querySelector('#dialog')],_$playerContainer:[host],
 _$body:{raf:{addClass(){},removeClass(){}}},
 _state:{screenMode:'small',isOpen:true},
 _playerConfig:{props:{showComment:true,enableFilter:true,screenMode:'small'}},
 addClass(c){host.classList.add(c)},removeClass(c){host.classList.remove(c)},
 _setThumbnail(){},_clearClass(){},_updateScreenModeStyle(){},
 _onControlBarIdleDebounced:Object.assign(()=>{}, {cancel(){}}),
 _onControlBarIdleDebouncedDefault:Object.assign(()=>{}, {cancel(){}})
});
window.sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
window.setMode=mode=>{
 view._clearActionFeedback();view._clearHoverUiActive();view._onControlBarIdle();
 Fullscreen.value=mode==='full';view._state.screenMode=mode==='popup'?'small':'normal';
 view._playerConfig.props.screenMode=view._state.screenMode;
 document.body.dataset.fullscreenControlBarMode='auto';
 for(const s of document.querySelectorAll('style[data-production-style]')){
  const label=s.dataset.productionStyle;
  s.disabled=label.includes('screenMode')&&!(mode==='popup'?label.includes('for-popup'):label.includes('for-full')||label.includes('for-screen-full'));
 }
};
window.visible=selector=>{
 const el=document.querySelector(selector),r=el.getBoundingClientRect();let opacity=1;
 // Visibility inherits but a descendant may explicitly restore visible.
 // Display and opacity continue to suppress painting through all ancestors.
 if(getComputedStyle(el).visibility!=='visible')return false;
 for(let e=el;e;e=e.parentElement){const s=getComputedStyle(e);if(s.display==='none'||e.hidden)return false;opacity*=Number(s.opacity);}
 return opacity>.05&&r.width>0&&r.height>0;
};
window.sample=selector=>({target:visible(selector),
 siblings:[...document.querySelectorAll('.videoControlBar .controlButton,.videoControlBar .volumeControl,.hoverMenuContainer .menuButton')]
  .filter(e=>!e.matches(selector)).filter(e=>visible('.'+[...e.classList].find(c=>!['controlButton','menuButton','playControl','forMember'].includes(c)))).map(e=>e.className),
 seek:visible('.seekBarContainer'),
 root:getComputedStyle(document.querySelector('.videoControlBar')).backgroundColor,
 center:getComputedStyle(document.querySelector('.seekBarContainer-mainControl')).backgroundImage,
 pressed:document.querySelector(selector).classList.contains('is-feedback-pressed'),
 feedback:document.querySelector(selector).classList.contains('is-shortcut-feedback')});
window.ready=true;
`+'</script>';
function chromeExecutable(){
 if(process.env.CHROME_EXECUTABLE)return process.env.CHROME_EXECUTABLE;
 if(process.platform==='win32')return path.join(process.env.LOCALAPPDATA||'','Google/Chrome/Application/chrome.exe');
 for(const name of ['google-chrome','chromium','chromium-browser']){
  const r=spawnSync('which',[name],{encoding:'utf8'});if(r.status===0)return r.stdout.trim();
 }
 try{return require(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES||'','playwright')).chromium.executablePath();}catch(_){return null;}
}
const executable=chromeExecutable();
assert(executable&&fs.existsSync(executable),'Chrome missing: set CHROME_EXECUTABLE to an existing Chromium executable');
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'zenza-discussion36-'));
let chrome,ws,sequence=0;const pending=new Map();
async function send(method,params={}){const id=++sequence;return new Promise((resolve,reject)=>{
 const timeout=setTimeout(()=>{pending.delete(id);reject(Error(method+' timeout'));},15000);
 pending.set(id,{resolve,reject,timeout});ws.send(JSON.stringify({id,method,params}));
});}
async function evaluate(expression){const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result?.value;}
async function idle(){await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:640,y:200,button:'none'});}
async function flash(command,selector,param){
 return evaluate(`(async()=>{view._flashActionFeedback(${JSON.stringify(command)},${JSON.stringify(param)});await sleep(180);return sample(${JSON.stringify(selector)})})()`);
}
function onlyTarget(result,label){
 assert(result.target,label+' target invisible: '+JSON.stringify(result));
 assert.deepStrictEqual(result.siblings,[],label+' exposed sibling: '+JSON.stringify(result));
 assert(!result.seek,label+' exposed seekbar');
 assert(/rgba\(0, 0, 0, 0\)|transparent/.test(result.root),label+' exposed bar background '+result.root);
 assert.strictEqual(result.center,'none',label+' exposed center gradient');
}
(async()=>{try{
 chrome=await startChromeCdp(executable,profile);
 const port=fs.readFileSync(path.join(profile,'DevToolsActivePort'),'utf8').split(/\r?\n/)[0];
 const tab=await(await fetch('http://127.0.0.1:'+port+'/json/new?about:blank',{method:'PUT'})).json();
 ws=new WebSocket(tab.webSocketDebuggerUrl);
 await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});
 ws.addEventListener('message',ev=>{const m=JSON.parse(ev.data),p=pending.get(m.id);if(!p)return;clearTimeout(p.timeout);pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);});
 await send('Page.enable');await send('Runtime.enable');
 await send('Emulation.setDeviceMetricsOverride',{width:1280,height:720,deviceScaleFactor:1,mobile:false});
 await send('Page.navigate',{url:'data:text/html;charset=utf-8,'+encodeURIComponent(html)});
 for(let i=0;i<60;i++){if(await evaluate('!!window.ready'))break;await new Promise(r=>setTimeout(r,50));}
 assert(await evaluate('!!window.ready'),'fixture did not boot');await idle();
 const cases=[];
 for(const mode of ['popup','full']){
  await evaluate(`(async()=>{setMode(${JSON.stringify(mode)});document.querySelector('.notificationHistorySwitch').focus();await sleep(350)})()`);
  const focused=await flash('toggle-mute','.muteSwitch');onlyTarget(focused,mode+' focused idle toolbar');
  await evaluate('document.activeElement.blur();view._clearActionFeedback()');
  cases.push({mode,focusedIdle:true});
 }
 for(const mode of ['popup','full']){
  await evaluate(`(async()=>{setMode(${JSON.stringify(mode)});document.querySelector('.playbackRateMenu').focus();await sleep(350)})()`);
  const focusedMenu=await evaluate(`(async()=>{view._flashActionFeedback('playbackRate',1.5);await sleep(180);const menu=document.querySelector('.playbackRateMenu .zenzaPopupMenu');return {target:visible('.playbackRateMenu'),menu:visible('.playbackRateMenu .zenzaPopupMenu'),pointer:getComputedStyle(menu).pointerEvents,visibleChildren:[...menu.querySelectorAll('*')].filter(e=>getComputedStyle(e).visibility==='visible').length,interactiveChildren:[...menu.querySelectorAll('*')].filter(e=>getComputedStyle(e).pointerEvents!=='none').length}})()`);
  assert.deepStrictEqual(focusedMenu,{target:true,menu:false,pointer:'none',visibleChildren:0,interactiveChildren:0},mode+' focused speed cue must hide popup and its descendants');
  await evaluate('document.activeElement.blur();view._clearActionFeedback()');
  cases.push({mode,focusedMenu:true});
 }
 for(const mode of ['popup','full']){
  await evaluate('setMode('+JSON.stringify(mode)+')');
  for(const [command,selector,param] of [
   ['toggle-mute','.muteSwitch'],['togglePlay','.videoControlBar .togglePlay'],
   ['toggle-fullscreen','.fullscreenSwitch'],['playPreviousVideo','.prevVideo'],
   ['playNextVideo','.nextVideo'],['seek','.seekTop','0'],
   ['playbackRate','.playbackRateMenu',1.25],['volumeUp','.volumeControl'],
   ['toggle-enableStoryboardBar','.toggleStoryboard']
  ]){
   await evaluate(`view._clearActionFeedback();document.querySelector('.videoControlBar').classList.add('is-storyboardAvailable')`);
   const result=await flash(command,selector,param);onlyTarget(result,mode+' '+command);cases.push({mode,command});
  }
 }
 const direction=await evaluate(`(async()=>{setMode('popup');view._onControlBarActive();const container=document.querySelector('.seekBarContainer');container.classList.add('is-dragging');await sleep(350);view._flashActionFeedback('seekBy','5');await sleep(30);const result={forward:document.querySelector('.forwardSeek').classList.contains('is-shortcut-feedback'),backward:document.querySelector('.backwardSeek').classList.contains('is-shortcut-feedback'),visible:visible('.forwardSeek')};view._clearActionFeedback();container.classList.remove('is-dragging');view._onControlBarIdle();return result})()`);
 assert.deepStrictEqual(direction,{forward:true,backward:false,visible:true},'positive string seekBy must choose the visible forward control');
 const rapid=await evaluate(`(async()=>{setMode('popup');await sleep(350);view._flashActionFeedback('toggle-mute');await sleep(180);view._flashActionFeedback('togglePlay');await sleep(180);return sample('.videoControlBar .togglePlay')})()`);
 onlyTarget(rapid,'rapid mute to play');
 await evaluate('(async()=>{setMode("popup");await sleep(350)})()');
 for(const [command,selector] of [['toggle-showComment','.showCommentSwitch'],['toggle-enableFilter','.ngFilterSwitch'],['toggle-like','.toggleLikeButton']]){
  await evaluate('(async()=>{view._clearActionFeedback();await sleep(450)})()');
  const r=await flash(command,selector);assert(r.target,command+' target hidden');assert.deepStrictEqual(r.siblings,[],command+' sibling shown');assert(!r.seek);cases.push({command});
 }
 const heart=await evaluate(`(async()=>{view._clearActionFeedback();view._flashActionFeedback('toggle-like');
 const e=document.querySelector('.toggleLikeButton'),h=e.querySelector('.heart-effect');
 const start={pressed:e.classList.contains('is-feedback-pressed'),opacity:Number(getComputedStyle(h).opacity),visibility:getComputedStyle(h).visibility};
 await sleep(180);return {start,released:!e.classList.contains('is-feedback-pressed'),transition:getComputedStyle(h).transitionDuration}})()`);
 assert(heart.start.pressed&&heart.start.opacity>0&&heart.start.visibility==='visible',JSON.stringify(heart));
 assert(heart.released,'Like must release its pressed phase before 1s');
 assert(parseFloat(heart.transition)>0,'Like existing release transition retained');
 const heartLifetime=await evaluate(`(async()=>{setMode('popup');view._flashActionFeedback('toggle-like');await sleep(1150);const during={visible:visible('.toggleLikeButton'),active:document.querySelector('.toggleLikeButton').classList.contains('is-shortcut-feedback')};await sleep(1000);return {during,ended:!visible('.toggleLikeButton'),remaining:document.querySelectorAll('.toggleLikeButton.is-shortcut-feedback').length}})()`);
 assert(heartLifetime.during.visible&&heartLifetime.during.active,'Like must remain visible through its delayed 1s button return: '+JSON.stringify(heartLifetime));
 assert(heartLifetime.ended&&heartLifetime.remaining===0,'Like must disappear after the full animation');
 cases.push({command:'toggle-like',duration:'extended'});
 const statusModes=await evaluate(`(()=>{view._clearActionFeedback();view._flashActionFeedback('toggle-enableFilter');const button=document.querySelector('.ngFilterSwitch');const mouse={pressed:button.classList.contains('is-feedback-pressed'),badge:button.hasAttribute('data-shortcut-state')};view._keyboardFeedbackCommand='toggle-enableFilter';view._flashActionFeedback('toggle-enableFilter');view._keyboardFeedbackCommand=undefined;return {mouse,keyboard:button.dataset.shortcutState}})()`);
 assert(statusModes.mouse.pressed&&!statusModes.mouse.badge,'mouse click must animate without a text badge');
 assert(['ON','OFF'].includes(statusModes.keyboard),'keyboard shortcut must still display ON/OFF text');
 cases.push({command:'toggle-enableFilter',mode:'mouse-vs-keyboard'});
 const expiry=await evaluate(`(async()=>{view._flashActionFeedback('toggle-showComment');await sleep(650);view._flashActionFeedback('toggle-showComment');await sleep(500);const restarted=visible('.showCommentSwitch');await sleep(950);return {restarted,expired:!visible('.showCommentSwitch'),remaining:document.querySelectorAll('.is-shortcut-feedback,.is-feedback-pressed,.is-action-feedback-only').length}})()`);
 assert(expiry.restarted,'repeat must extend cue beyond original deadline');assert(expiry.expired,'cue must expire after about 1s');assert.strictEqual(expiry.remaining,0);
 const hidden=await evaluate(`(()=>{const e=document.querySelector('.muteSwitch');e.hidden=true;e.style.setProperty('display','none','important');view._flashActionFeedback('toggle-mute');const result={visible:visible('.muteSwitch'),display:e.style.getPropertyValue('display'),priority:e.style.getPropertyPriority('display'),hidden:e.hidden};view._clearActionFeedback();e.hidden=false;e.style.removeProperty('display');return result})()`);
 assert.deepStrictEqual(hidden,{visible:false,display:'none',priority:'important',hidden:true},'respect explicit visibility preference');
 const recovery=await evaluate(`(async()=>{view._flashActionFeedback('toggle-mute');view._onControlBarActive();view._onMouseMove();await sleep(350);return {play:visible('.videoControlBar .togglePlay'),seek:visible('.seekBarContainer'),background:getComputedStyle(document.querySelector('.videoControlBar')).backgroundColor}})()`);
 assert(recovery.play&&recovery.seek,'mouse activity must restore full controls: '+JSON.stringify(recovery));assert.strictEqual(recovery.background,'rgb(0, 0, 0)');
 await evaluate('setMode("popup")');
 const mirror=await evaluate(`(async()=>{view._flashActionFeedback('playPreviousVideo');await sleep(20);const t=getComputedStyle(document.querySelector('.prevVideo .controlButtonInner')).transform;return {transform:t,xx:t==='none'?1:new DOMMatrix(t).a}})()`);
 assert(mirror.xx<0,'previous icon mirror lost during press '+JSON.stringify(mirror));
 await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
 const reduced=await flash('toggle-like','.toggleLikeButton');assert(reduced.target,'reduced motion must still show feedback');
 await send('Emulation.setEmulatedMedia',{features:[]});
 const surfaceChange=await evaluate(`(async()=>{setMode('popup');await sleep(350);view._flashActionFeedback('toggle-mute');await sleep(180);view._flashActionFeedback('toggle-showComment');await sleep(100);return sample('.showCommentSwitch')})()`);
 assert(surfaceChange.target,'toolbar to hover must reveal new target');assert.deepStrictEqual(surfaceChange.siblings,[],'toolbar to hover must not flash retired toolbar siblings');assert(!surfaceChange.seek,'toolbar to hover must not flash seekbar');
 const hoverChange=await evaluate(`(async()=>{view._clearActionFeedback();await sleep(450);view._flashActionFeedback('toggle-showComment');await sleep(180);view._flashActionFeedback('toggle-enableFilter');await sleep(100);return sample('.ngFilterSwitch')})()`);
 assert(hoverChange.target,'comment to NG must reveal new target');assert.deepStrictEqual(hoverChange.siblings,[],'comment to NG must hide retired target');
 const cleanup=await evaluate(`(async()=>{view._clearActionFeedback();view._flashActionFeedback('toggle-like');view._onBeforeVideoOpen();const navigation=document.querySelectorAll('.is-shortcut-feedback,.is-feedback-pressed,.is-action-feedback-only').length;view._flashActionFeedback('toggle-mute');view.hide();await sleep(180);return {navigation,closed:document.querySelectorAll('.is-shortcut-feedback,.is-feedback-pressed,.is-action-feedback-only').length}})()`);
 assert.deepStrictEqual(cleanup,{navigation:0,closed:0},'navigation/close must clear feedback and queued pressed release');
 console.log('DISCUSSION36_CHROMIUM_PASS '+JSON.stringify({cases:cases.length,direction,heart,expiry,hidden,recovery,mirror,cleanup}));
}catch(e){console.error('DISCUSSION36_CHROMIUM_FAIL '+e.stack);process.exitCode=1;}
finally{for(const p of pending.values())clearTimeout(p.timeout);try{ws?.close()}catch(_){}try{chrome?.kill()}catch(_){}try{fs.rmSync(profile,{recursive:true,force:true,maxRetries:3,retryDelay:100})}catch(_){}}
})();
