'use strict';
const assert=require('assert');
const {JSDOM}=require('jsdom');
const {createContext,loadClass,read}=require('../helpers/extractSource');

function harness(){
 const timers=new Map();let sequence=0;
 const dom=new JSDOM('<div id="host"><div class="hoverMenuContainer"><div class="menuItemContainer rightTop"><div class="menuButton toggleLikeButton" data-command="toggle-like"><span class="heart-effect">♡</span></div><div class="menuButton mylistButton deflistAdd" data-command="deflistAdd"></div></div><div class="menuItemContainer leftBottom"><div class="menuButton showCommentSwitch" data-command="toggle-showComment" aria-label="existing label"></div><div class="menuButton ngFilterSwitch" data-command="toggle-enableFilter"></div></div></div><div class="videoControlBar"><div class="controlButton togglePlay" data-command="togglePlay"><span class="controlButtonInner">▶</span></div><div class="controlButton muteSwitch" data-command="toggle-mute"><span class="controlButtonInner">♪</span></div><div class="volumeControl"></div><div class="controlButton playbackRateMenu"></div><div class="controlButton toggleStoryboard" data-command="toggleStoryboard"></div><div class="controlButton seekTop" data-command="seek" data-param="0"></div><div class="controlButton futureButton" data-command="future-action" data-feedback-animation="test-pulse"></div></div></div>');
 const ctx=createContext({Emitter:class{},Fullscreen:{now:()=>false},
   SHORTCUT_ACTIONS:[{id:'TOGGLE_NG_FILTER',command:'toggle-enableFilter'}],
   setTimeout(fn,delay){const id=++sequence;timers.set(id,{fn,delay});return id;},
   clearTimeout(id){timers.delete(id);}
 });
 const View=loadClass('src/NicoVideoPlayerDialog.js','NicoVideoPlayerDialogView',ctx);
 const Dialog=loadClass('src/NicoVideoPlayerDialog.js','NicoVideoPlayerDialog',ctx);
 const view=Object.create(View.prototype),dialog=Object.create(Dialog.prototype),host=dom.window.document.getElementById('host');
 const cfg={props:{showComment:true,enableFilter:true,screenMode:'small'}};
 Object.assign(view,{_$playerContainer:[host],_playerConfig:cfg,_state:{screenMode:'small',isOpen:true},
  addClass:c=>host.classList.add(c),removeClass:c=>host.classList.remove(c)});
 const calls=[];
 Object.assign(dialog,{_view:view,_state:{isOpen:true},_playerConfig:cfg,
  togglePlay(){calls.push('play');view._onVideoPause();},
  _onToggleLike(){calls.push('like');},
  emit(type,command){calls.push(command);if(command==='toggle-showComment')cfg.props.showComment=!cfg.props.showComment;if(command==='toggle-enableFilter')cfg.props.enableFilter=!cfg.props.enableFilter;},
  _nicoVideoPlayer:{volumeUp(){calls.push('volume');view._onVolumeChange();}}
 });
 const tick=delay=>{for(const [id,item]of [...timers])if(item.delay===delay){timers.delete(id);item.fn();}};
 return {view,dialog,dom,host,cfg,calls,timers,tick,ctx,el:s=>host.querySelector(s),close:()=>dom.window.close()};
}

describe('Discussion 36 shared action button feedback',function(){
 it('only keyboard shortcuts show the ON/OFF status text; clicks animate without it',()=>{
  const h=harness();try{
   h.dialog._onCommand('toggle-enableFilter');
   const icon=h.el('.ngFilterSwitch');
   assert(icon.classList.contains('is-feedback-pressed'),'mouse actions keep press animation');
   assert(icon.classList.contains('is-shortcut-feedback'),'mouse actions keep visibility cue');
   assert(!icon.hasAttribute('data-shortcut-state'),'ordinary clicks must not show status text');
   assert.strictEqual(icon.getAttribute('aria-label'),'NGフィルター OFF');
   h.dialog._onKeyEvent('TOGGLE_NG_FILTER',{preventDefault(){},stopPropagation(){}});
   assert.strictEqual(icon.dataset.shortcutState,'ON','keyboard status still appears');
   assert(icon.classList.contains('is-feedback-pressed'));
  }finally{h.close();}
 });
 it('keeps the Like button visible past its delayed press transition and expires independently',()=>{
  const h=harness();try{
   // The production button declares its own duration instead of a command-specific timer.
   const source=read('src/NicoVideoPlayerDialog.js');
   const tag=source.match(/<div class="menuButton toggleLikeButton forMember"[^>]*>/)?.[0];
   assert(tag,'production Like button missing');
   const duration=Number(tag.match(/data-feedback-visible-ms="([0-9]+)"/)?.[1]);
   assert(duration>=1400&&duration<=2000,'Like needs time for the 1s delayed 0.2s transform and 0.8s heart transition');
   h.el('.toggleLikeButton').dataset.feedbackVisibleMs=String(duration);
   h.view._flashActionFeedback('toggle-like');
   h.tick(90);
   h.tick(1000);
   assert(h.el('.toggleLikeButton').classList.contains('is-shortcut-feedback'),'do not hide during Like animation');
   assert([...h.timers.values()].some(t=>t.delay===duration),'button-specific lifetime must be applied');
   h.tick(duration);
   assert(!h.el('.toggleLikeButton').classList.contains('is-shortcut-feedback'),'clear after the full animation');
   h.view._flashActionFeedback('toggle-showComment');
   assert([...h.timers.values()].some(t=>t.delay===1000),'ordinary controls retain one-second feedback');
  }finally{h.close();}
 });
 it('reuses Like activation without showing other buttons or firing an action',()=>{
  const h=harness();try{h.view._flashActionFeedback('toggle-like');
   assert(h.el('.toggleLikeButton').classList.contains('is-shortcut-feedback'));
   assert(h.el('.toggleLikeButton').classList.contains('is-feedback-pressed'));
   assert.strictEqual(h.host.querySelectorAll('.is-shortcut-feedback').length,1);
   assert.deepStrictEqual(h.calls,[]);
   h.tick(90);assert(!h.el('.toggleLikeButton').classList.contains('is-feedback-pressed'));
   h.tick(1000);assert.strictEqual(h.host.querySelectorAll('.is-shortcut-feedback').length,0);
  }finally{h.close();}
 });
 it('restores pre-existing accessibility labels and clears the old target',()=>{
  const h=harness();try{h.view._flashShortcutToggleFeedback('comment',true);
   assert.strictEqual(h.el('.showCommentSwitch').dataset.shortcutState,'ON');
   assert.strictEqual(h.el('.showCommentSwitch').getAttribute('aria-label'),'コメント表示 ON');
   h.view._flashShortcutToggleFeedback('ng',true);
   assert.strictEqual(h.el('.showCommentSwitch').getAttribute('aria-label'),'existing label');
   assert(!h.el('.showCommentSwitch').hasAttribute('data-shortcut-state'));
   assert(h.el('.ngFilterSwitch').classList.contains('is-shortcut-feedback'));
   h.view._clearActionFeedback();assert.strictEqual(h.timers.size,0);
  }finally{h.close();}
 });
 it('prevents a cancelled callback from erasing the next activation',()=>{
  const h=harness();try{h.view._flashActionFeedback('toggle-like');const old=[...h.timers.values()];
   h.view._flashActionFeedback('toggle-like');
   for(const task of old)task.fn();
   assert(h.el('.toggleLikeButton').classList.contains('is-shortcut-feedback'));
   assert(h.el('.toggleLikeButton').classList.contains('is-feedback-pressed'));
   assert.strictEqual([...h.timers.values()].filter(x=>x.delay===1000).length,1);
  }finally{h.close();}
 });
 it('resolves volume/rate/filmstrip aliases and ignores unrelated seek actions',()=>{
  const h=harness();try{
   for(const [command,selector]of [['volumeUp','.volumeControl'],['volumeDown','.volumeControl'],['shiftUp','.playbackRateMenu'],['shiftDown','.playbackRateMenu'],['toggle-enableStoryboardBar','.toggleStoryboard']]){
    h.view._flashActionFeedback(command);assert(h.el(selector).classList.contains('is-shortcut-feedback'),command);
   }
   h.view._clearActionFeedback();h.view._flashActionFeedback('seekTo',83);assert.strictEqual(h.timers.size,0);
   h.view._flashActionFeedback('seekTo',0);assert(h.el('.seekTop').classList.contains('is-shortcut-feedback'));
  }finally{h.close();}
 });
 it('automatically finds a later data-command button and uses its animation hook',()=>{
  const h=harness();try{h.view._flashActionFeedback('future-action');
   const icon=h.el('.futureButton');assert(icon.classList.contains('is-shortcut-feedback'));
   assert.strictEqual(icon.style.getPropertyValue('--zenza-feedback-animation'),'test-pulse');
   h.view._clearActionFeedback();assert.strictEqual(icon.style.getPropertyValue('--zenza-feedback-animation'),'');
  }finally{h.close();}
 });
 it('leaves intentionally hidden controls hidden while still running the command',()=>{
  const h=harness();try{const icon=h.el('.toggleLikeButton');icon.hidden=true;icon.style.setProperty('display','none','important');
   h.dialog._onCommand('toggle-like');assert.deepStrictEqual(h.calls,['like']);
   assert(!icon.classList.contains('is-shortcut-feedback'));assert(icon.hidden);
   assert.strictEqual(icon.style.getPropertyPriority('display'),'important');assert.strictEqual(h.timers.size,0);
  }finally{h.close();}
 });
 it('keeps request-owned mylist animation and locks after feedback expires',()=>{
  const h=harness();try{h.host.classList.add('is-updatingDeflist');h.view._flashActionFeedback('deflistRemove');
   assert(h.el('.deflistAdd').classList.contains('is-shortcut-feedback'));
   h.tick(1000);assert(h.host.classList.contains('is-updatingDeflist'));
  }finally{h.close();}
 });
 it('runs the shared command exactly once for each keyboard or click activation',()=>{
  const h=harness();try{const e={preventDefault(){},stopPropagation(){}};
   h.cfg.props['controlBar.showOnPause.small']=true;
   h.dialog._onKeyEvent('TOGGLE_PLAY',e);assert.deepStrictEqual(h.calls,['play']);
   assert(h.el('.togglePlay').classList.contains('is-shortcut-feedback'));
   assert(!h.host.classList.contains('is-controlBarActive'));
   h.dialog._onCommand('toggle-like');assert.deepStrictEqual(h.calls,['play','like']);
   assert(h.el('.toggleLikeButton').classList.contains('is-shortcut-feedback'));
   assert.strictEqual(h.host.querySelectorAll('.is-shortcut-feedback').length,1);
   h.view._onVideoPause();assert(h.host.classList.contains('is-controlBarActive'));
  }finally{h.close();}
 });
 it('suppresses full-bar keyboard volume activity but preserves pointer volume activity',()=>{
  const h=harness();try{h.dialog._onKeyEvent('VOL_UP',{preventDefault(){},stopPropagation(){}});
   assert.deepStrictEqual(h.calls,['volume']);assert(!h.host.classList.contains('volumeChanging'));
   assert(h.el('.volumeControl').classList.contains('is-shortcut-feedback'));
   h.view._clearActionFeedback();h.view._onVolumeChange();assert(h.host.classList.contains('volumeChanging'));
  }finally{h.close();}
 });
 it('clears timers and labels even when the previous control has been removed',()=>{
  const h=harness();try{h.view._flashActionFeedback('toggle-like');h.el('.toggleLikeButton').remove();
   assert.doesNotThrow(()=>h.view._clearActionFeedback());assert.strictEqual(h.timers.size,0);
  }finally{h.close();}
 });
 it('isolates successive idle toolbar actions even while the old opacity transition reads one',()=>{
  const h=harness();try{
   const bar=h.el('.videoControlBar');bar.style.opacity='1';
   h.view._flashActionFeedback('toggle-mute');assert(bar.classList.contains('is-action-feedback-only'));
   h.view._flashActionFeedback('togglePlay');assert(bar.classList.contains('is-action-feedback-only'));
   assert(!h.el('.muteSwitch').classList.contains('is-shortcut-feedback'));
  }finally{h.close();}
 });
 it('allows real activity to reveal the bar, then isolates the still-active target on idle',()=>{
  const h=harness();try{
   const bar=h.el('.videoControlBar');h.view._onControlBarActive();
   h.view._flashActionFeedback('toggle-mute');assert(!bar.classList.contains('is-action-feedback-only'));
   h.view._onControlBarIdle();assert(bar.classList.contains('is-action-feedback-only'));
   h.view._onControlBarActive();assert(!bar.classList.contains('is-action-feedback-only'));
  }finally{h.close();}
 });
 it('resolves scalar parameters and skips unavailable duplicate controls',()=>{
  const h=harness();try{
   h.el('.videoControlBar').insertAdjacentHTML('beforeend','<div class="controlButton backwardSeek" data-command="seekBy" data-param="-5"></div><div class="controlButton forwardSeek" data-command="seekBy" data-param="5"></div><div class="controlButton nextVideo" data-command="playNextVideo" data-param="0"></div><div class="controlButton availableFuture" data-command="duplicate-future"></div>');
   h.host.insertAdjacentHTML('afterbegin','<div style="display:none"><div class="menuButton playNextVideo" data-command="playNextVideo"></div><div class="menuButton" data-command="duplicate-future"></div></div>');
   for(const [command,param,selector]of [['seek','0','.seekTop'],['seekBy','5','.forwardSeek'],['seekBy',-5,'.backwardSeek'],['playNextVideo',undefined,'.nextVideo'],['duplicate-future',undefined,'.availableFuture']]){
    h.view._flashActionFeedback(command,param);
    assert(h.el(selector).classList.contains('is-shortcut-feedback'),`${command} ${param}`);
    assert.strictEqual(h.host.querySelectorAll('.is-shortcut-feedback').length,1);
   }
   for(const param of [null,'',false,10,'10']){
    h.view._clearActionFeedback();h.view._flashActionFeedback('seek',param);
    assert.strictEqual(h.host.querySelectorAll('.is-shortcut-feedback').length,0);
    h.view._flashActionFeedback('seekBy',param);
    assert.strictEqual(h.host.querySelectorAll('.is-shortcut-feedback').length,0);
   }
  }finally{h.close();}
 });
 it('routes locally consumed settings and storyboard actions to the same feedback owner once',()=>{
  const h=harness();try{
   h.el('.videoControlBar').insertAdjacentHTML('beforeend','<div class="controlButton settingPanelSwitch" data-command="settingPanel"></div><div class="controlButton screenFilterSwitch" data-command="toggle-screenFilterPanel"></div>');
   h.view.toggleSettingPanel=()=>h.calls.push('settings');
   h.view.toggleScreenFilterPanel=()=>h.calls.push('filters');
   h.view._onCommand('settingPanel');assert(h.el('.settingPanelSwitch').classList.contains('is-feedback-pressed'));
   h.view._onCommand('toggle-screenFilterPanel');assert(h.el('.screenFilterSwitch').classList.contains('is-feedback-pressed'));
   const Bar=loadClass('src/VideoControlBar.js','VideoControlBar',h.ctx);
   const bar=Object.create(Bar.prototype);
   bar.storyboard={toggle(){h.calls.push('storyboard');}};
   bar.emit=(type,...args)=>{assert.strictEqual(type,'actionFeedback');h.view._onActionFeedback(...args);};
   const event={target:h.el('.toggleStoryboard'),preventDefault(){},stopPropagation(){},detail:{command:'toggleStoryboard'}};
   bar._onClick(event);assert(h.el('.toggleStoryboard').classList.contains('is-feedback-pressed'));
   h.tick(1000);bar._onCommandEvent(event);assert(h.el('.toggleStoryboard').classList.contains('is-feedback-pressed'));
   assert.deepStrictEqual(h.calls,['settings','filters','storyboard','storyboard']);
   assert.strictEqual([...h.timers.values()].filter(x=>x.delay===1000).length,1);
  }finally{h.close();}
 });
 it('keeps independent accessibility and animation updates made during a cue',()=>{
  const h=harness();try{
   const icon=h.el('.futureButton');icon.setAttribute('aria-label','before');
   h.view._flashActionFeedback('future-action');
   icon.setAttribute('aria-label','independent label');
   icon.style.setProperty('--zenza-feedback-animation','independent-animation','important');
   h.view._clearActionFeedback();
   assert.strictEqual(icon.getAttribute('aria-label'),'independent label');
   assert.strictEqual(icon.style.getPropertyValue('--zenza-feedback-animation'),'independent-animation');
   assert.strictEqual(icon.style.getPropertyPriority('--zenza-feedback-animation'),'important');
   h.view._flashActionFeedback('toggle-showComment');
   h.el('.showCommentSwitch').setAttribute('aria-label','independent comment label');
   h.tick(1000);assert.strictEqual(h.el('.showCommentSwitch').getAttribute('aria-label'),'independent comment label');
   assert(!h.el('.showCommentSwitch').hasAttribute('data-shortcut-state'));
  }finally{h.close();}
 });
 it('does not end the current cue when an unrelated asynchronous notification arrives',()=>{
  const h=harness();try{
   h.view._flashActionFeedback('deflistAdd');
   const lifetime=[...h.timers.entries()].find(([,value])=>value.delay===1000)[0];
   h.view._flashActionFeedback('alert','added');
   assert(h.el('.deflistAdd').classList.contains('is-shortcut-feedback'));
   assert(h.timers.has(lifetime));
   h.tick(1000);assert(!h.el('.deflistAdd').classList.contains('is-shortcut-feedback'));
  }finally{h.close();}
 });
});
