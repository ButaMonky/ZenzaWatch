import {SETTINGS_SCHEMA} from './settings.mjs';
import {HISTORY_PRESETS,APPLIED_PRESETS,createBrowserHistoryPreferences} from './browser-preferences.mjs';
import {CommentHistoryController} from './controller.mjs';

export const HISTORY_ICON='<svg viewBox="0 0 36 36" aria-hidden="true"><path fill-rule="evenodd" d="M8 7h20a3 3 0 0 1 3 3v13a3 3 0 0 1-3 3H16l-6 5v-5H8a3 3 0 0 1-3-3V10a3 3 0 0 1 3-3Zm1 3a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h4v2l2.4-2H27a1 1 0 0 0 1-1V11a1 1 0 0 0-1-1H9Z"/><path d="M16.5 12h3v3.5H23v3h-3.5V22h-3v-3.5H13v-3h3.5Z"/></svg>';
const CSS=`
.commentHistorySwitch .controlButtonInner{display:inline-block;width:26px;height:26px;vertical-align:middle}
.commentHistorySwitch svg{display:block;width:100%;height:100%;fill:currentColor}
.commentHistorySwitch.is-active{color:var(--enabled-button-color,#9cf);opacity:1}
.commentHistorySwitch.is-active svg{filter:drop-shadow(0 0 3px var(--enabled-button-color,#9cf))}
.commentHistorySwitch.is-fetching svg{animation:zenzaHistoryPulse 1.6s ease-in-out infinite}
@keyframes zenzaHistoryPulse{50%{opacity:.48}}
.zenzaCommentHistoryPanel{position:fixed;z-index:6060001;box-sizing:border-box;width:360px;max-width:calc(100vw - 32px);max-height:calc(100vh - 32px);overflow:auto;overscroll-behavior:contain;padding:16px;background:rgba(18,29,45,.97);color:#e6eef5;border:1px solid #455468;border-radius:12px;box-shadow:0 8px 36px #0009;font:13px/1.5 'Yu Gothic UI','Meiryo',sans-serif;text-align:left;display:none;transform-origin:var(--ch-origin,100% 100%)}
.zenzaCommentHistoryPanel.is-open{display:block;animation:zenzaHistoryIn .22s cubic-bezier(.2,.9,.3,1.15) both}
.zenzaCommentHistoryPanel.is-closing{pointer-events:none;animation:zenzaHistoryOut .16s ease-in both}
@keyframes zenzaHistoryIn{from{opacity:0;transform:translate(12px,18px) scale(.86);filter:blur(2px)}to{opacity:1;transform:none;filter:none}}
@keyframes zenzaHistoryOut{from{opacity:1;transform:none}to{opacity:0;transform:translate(8px,12px) scale(.92)}}
@media(prefers-reduced-motion:reduce){.zenzaCommentHistoryPanel.is-open,.zenzaCommentHistoryPanel.is-closing{animation-duration:.01s}.commentHistorySwitch.is-fetching svg{animation:none}}
.zenzaCommentHistoryPanel button,.zenzaCommentHistoryPanel select,.ch-settings input{font:inherit;box-sizing:border-box}
.zenzaCommentHistoryPanel button,.ch-settings button{cursor:pointer;border:1px solid #496071;border-radius:7px;padding:7px 10px;background:#27384b;color:#edf7ff}
.zenzaCommentHistoryPanel button:disabled{cursor:default;opacity:.45}
.zenzaCommentHistoryPanel button:focus-visible,.zenzaCommentHistoryPanel select:focus-visible,.ch-settings input:focus-visible{outline:2px solid #72e4cc;outline-offset:2px}
.ch-header{display:flex;align-items:center;gap:12px;margin-bottom:12px}.ch-header strong{font-size:16px;flex:1}.ch-header button{padding:1px 8px;font-size:22px;background:none;border:0}
.ch-enable{display:flex;align-items:center;gap:6px;white-space:nowrap}.ch-enable input{accent-color:#72e4cc}
.ch-counter{font-size:26px;font-weight:700;font-variant-numeric:tabular-nums;color:#91f2dc}.ch-counter small{font-size:12px;font-weight:400;color:#b4c2d0;margin-left:5px}
.ch-status,.ch-note{color:#b4c2d0;font-size:12px;white-space:normal;overflow-wrap:anywhere}.ch-note{margin:9px 0}
.zenzaCommentHistoryPanel progress{width:100%;height:6px;accent-color:#72e4cc;display:block;margin:10px 0 14px}
.ch-action-row{display:grid;grid-template-columns:124px minmax(0,1fr);gap:10px;align-items:end;margin-top:12px}.ch-action-row label{display:grid;gap:3px;color:#b4c2d0;font-size:11px}
.zenzaCommentHistoryPanel select{width:100%;height:36px;padding:4px 8px;color:#ecf7fa;background:#1c3044;border:1px solid #486175;border-radius:7px}
.zenzaCommentHistoryPanel [data-ch-primary]{background:#79dfc9;color:#0c2b28;border-color:#79dfc9;min-height:36px;font-weight:700}
.ch-details{border-top:1px solid #33475d;margin-top:14px;padding-top:11px}.ch-details summary{cursor:pointer;color:#cedde9}.ch-details>div{margin-top:10px}.ch-counts{display:grid;grid-template-columns:1fr auto;gap:5px;margin-bottom:9px;font-size:12px}.ch-footer{display:flex;justify-content:space-between;gap:8px;align-items:center;margin-top:12px}.ch-footer button{background:none;font-size:12px;padding:5px 8px}
.ch-advanced[hidden]{display:none}.ch-advanced{margin-top:16px;border-top:1px solid #415568;padding-top:12px}.ch-settings{font:13px/1.5 'Yu Gothic UI','Meiryo',sans-serif}.ch-settings label{display:grid;grid-template-columns:minmax(0,1fr) 100px;align-items:center;gap:10px;margin:10px 0}.ch-settings input[type=number]{width:100px;color:inherit;background:transparent;border:1px solid #60778a;border-radius:5px;padding:5px}.ch-settings input[type=checkbox]{justify-self:end;accent-color:#72e4cc}.ch-settings small{opacity:.75}.ch-setting-error{color:#ffbe94;min-height:1.5em}.ch-settings [aria-invalid=true]{outline:1px solid #ffae86}
.is-youTube .commentHistorySwitch{display:none}
`;
function style(doc){if(doc.querySelector('style[data-zenza-comment-history]'))return;const el=doc.createElement('style');el.dataset.zenzaCommentHistory='';el.textContent=CSS;doc.head.append(el);}
const fmt=n=>Number(n||0).toLocaleString('ja-JP');
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

/** Both the current advanced userscript and future settings screens consume this adapter. */
export function mountHistorySettings(container,{preferences}={}){
  const doc=container.ownerDocument;style(doc);container.classList.add('ch-settings');
  container.innerHTML='<strong>コメント増量</strong><p class="ch-note">変更した取得条件は次の取得に使用します。取得済みデータの取り直しは行いません。</p>'+SETTINGS_SCHEMA.map(d=>
    `<label><span>${esc(d.label)}${d.type==='integer'?`<br><small>${d.min.toLocaleString()}～${d.max.toLocaleString()}</small>`:''}</span><input data-history-setting="${d.name}" type="${d.type==='boolean'?'checkbox':'number'}"${d.type==='integer'?` min="${d.min}" max="${d.max}" step="1"`:''}></label>`
  ).join('')+'<p class="ch-setting-error" role="status"></p>';
  const error=container.querySelector('.ch-setting-error');
  const refresh=()=>{const s=preferences.get();for(const d of SETTINGS_SCHEMA){const e=container.querySelector(`[data-history-setting="${d.name}"]`);if(doc.activeElement===e)continue;if(d.type==='boolean')e.checked=s.settings[d.name];else e.value=s.settings[d.name];}if(s.valid===false)error.textContent='保存設定が不正です。既存設定は上書きしていません。';};
  const change=e=>{const name=e.target.dataset.historySetting,d=SETTINGS_SCHEMA.find(x=>x.name===name);if(!d)return;e.stopPropagation();try{const v=d.type==='boolean'?e.target.checked:e.target.value.trim()===''?NaN:Number(e.target.value);preferences.patch({[name]:v});error.textContent='';e.target.removeAttribute('aria-invalid');}catch{error.textContent='設定を保存できませんでした。入力範囲と保存領域を確認してください。';e.target.setAttribute('aria-invalid','true');}};
  container.addEventListener('change',change);const off=preferences.subscribe(refresh);refresh();
  return {dispose(){off();container.removeEventListener('change',change);container.replaceChildren();}};
}

export class CommentHistoryPanel {
  constructor({controller,preferences,anchor,window:win=globalThis.window}){
    this.controller=controller;this.preferences=preferences;this.anchor=anchor;this.win=win;this.doc=win.document;this.listeners=[];this.closeTimer=null;this.swallowCleanup=[];this.disposed=false;
    style(this.doc);
    this.onOutside=e=>this._outside(e);this.onEscape=e=>{if(this.isOpen&&e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();this.close(true);}};
    this.onResize=()=>this._place();
    this.off=controller.subscribe(state=>this.refresh(state));this.offPrefs=preferences.subscribe(()=>this.refresh(controller.state));
  }
  get isOpen(){return !!this.view?.classList.contains('is-open')&&!this.view.classList.contains('is-closing');}
  _init(){
    if(this.view)return;
    const el=this.view=this.doc.createElement('section');el.className='zenzaCommentHistoryPanel zen-family';el.setAttribute('role','dialog');el.setAttribute('aria-label','コメント増量');el.setAttribute('aria-modal','false');
    el.innerHTML=`<header class="ch-header"><strong>コメント増量</strong><label class="ch-enable"><input type="checkbox" data-ch-enabled> ON</label><button type="button" data-ch-close aria-label="パネルを閉じる">×</button></header><div class="ch-counter"><span data-ch-count>0</span><small data-ch-goal> / 5,000 件</small></div><div class="ch-status" data-ch-status role="status" aria-live="polite"></div><progress value="0" max="5000" aria-label="追加取得の進捗"></progress><div class="ch-action-row"><label>追加する件数<select data-ch-quota aria-label="追加する件数">${HISTORY_PRESETS.map(n=>`<option value="${n}">${fmt(n)} 件</option>`).join('')}</select></label><button type="button" data-ch-primary>取得開始</button></div><div class="ch-action-row ch-apply-row"><label>適用する件数<select data-ch-applied-target aria-label="適用する件数">${APPLIED_PRESETS.map(n=>`<option value="${n}">${n?fmt(n)+' 件':'0 件（増量前）'}</option>`).join('')}</select></label><span class="ch-note" data-ch-apply-summary></span></div><p class="ch-note">ONは次の動画・再起動後も維持します。全タブが取得対象です。適用する件数を減らしても取得済みの分は保持し、戻すときは再取得しません。</p><details class="ch-details"><summary>取得条件と内訳</summary><div><div class="ch-counts"><span>通常コメント</span><span data-ch-normal></span><span>取得済みの追加分（保持中）</span><span data-ch-cached></span><span>適用中の追加分</span><span data-ch-applied></span><span>表示対象の合計</span><span data-ch-total></span></div><label><input type="checkbox" data-ch-easy> かんたんコメントも追加取得</label><p class="ch-note">取得中の条件は固定です。かんたんコメントの変更は、次の動画か「最初から取得」で使用します。NGはそのまま適用されます。</p><button type="button" data-ch-restart>最初から取得</button></div></details><footer class="ch-footer"><span class="ch-note" data-ch-pages></span><button type="button" data-ch-advanced>上級者設定</button></footer><div class="ch-advanced" hidden></div><div class="ch-setting-error" data-ch-error role="status"></div>`;
    const safe=fn=>{try{fn();this.view.querySelector('[data-ch-error]').textContent='';}catch{this.refresh(this.controller.state);this.view.querySelector('[data-ch-error]').textContent='設定を保存できませんでした。';}};
    el.querySelector('[data-ch-close]').onclick=()=>this.close(true);
    el.querySelector('[data-ch-enabled]').onchange=e=>safe(()=>this.controller.setEnabled(e.target.checked));
    el.querySelector('[data-ch-quota]').onchange=e=>safe(()=>this.preferences.patch({maxAdditionalComments:Number(e.target.value)}));
    // Task207: applied additional count. Not a fetch setting and not Task206's simultaneous display limit.
    el.querySelector('[data-ch-applied-target]').onchange=e=>safe(()=>{void this.controller.setAppliedCount(Number(e.target.value)).catch?.(()=>{});});
    el.querySelector('[data-ch-easy]').onchange=e=>safe(()=>this.preferences.patch({includeEasy:e.target.checked}));
    el.querySelector('[data-ch-primary]').onclick=()=>{const s=this.controller.state;if(['fetching','queued'].includes(s.phase))this.controller.stop();else if(!s.enabled)safe(()=>this.controller.setEnabled(true));else if(s.canContinue||s.phase==='render-error')void this.controller.more();else void this.controller.restart();};
    el.querySelector('[data-ch-restart]').onclick=()=>void this.controller.restart();
    el.querySelector('[data-ch-advanced]').onclick=()=>{const target=el.querySelector('.ch-advanced');target.hidden=!target.hidden;if(!target.hidden&&!this.advanced)this.advanced=mountHistorySettings(target,{preferences:this.preferences});if(!target.hidden)target.scrollIntoView({block:'nearest'});};
    for(const name of ['click','dblclick','mousedown','mouseup','pointerdown','wheel','keydown','keyup','contextmenu'])el.addEventListener(name,e=>e.stopPropagation());
  }
  refresh(state){
    const a=this.anchor?.();
    if(a){a.classList.toggle('is-active',state.enabled);a.classList.toggle('is-fetching',state.phase==='fetching');a.setAttribute('aria-expanded',String(this.isOpen));a.setAttribute('aria-label','コメント増量'+(state.enabled?'：ON':'：OFF'));}
    if(!this.view)return;
    const p=this.preferences.get(),v=this.view;const q=s=>v.querySelector(s),running=['fetching','queued','applying'].includes(state.phase);
    q('[data-ch-enabled]').checked=state.enabled;
    const quota=q('[data-ch-quota]');
    quota.querySelector('[data-ch-custom]')?.remove();
    if(!HISTORY_PRESETS.includes(p.settings.maxAdditionalComments)){
      const option=this.doc.createElement('option');option.dataset.chCustom='';
      option.value=String(p.settings.maxAdditionalComments);option.textContent=fmt(p.settings.maxAdditionalComments)+' 件';quota.append(option);
    }
    quota.value=p.settings.maxAdditionalComments;q('[data-ch-easy]').checked=p.settings.includeEasy;
    q('[data-ch-count]').textContent=fmt(state.additionalCount);q('[data-ch-goal]').textContent=` / ${fmt(state.goal||p.settings.maxAdditionalComments)} 件`;
    q('progress').max=state.goal||p.settings.maxAdditionalComments;q('progress').value=state.additionalCount||0;
    const texts={idle:state.enabled?'通常コメントの読込完了を待っています':'OFF · 通常コメントのみ表示',queued:'他のタブの取得終了を待っています',fetching:'取得中 · 追加分は未反映',applying:'取得終了 · 表示を準備しています',ready:'反映済み',partial:'一部取得 · 取得済みの正常分を反映',unavailable:'この動画・コメント形式では増量できません', 'render-error':'取得済みデータの反映に失敗しました'};
    q('[data-ch-status]').textContent=p.valid===false?'保存設定が不正です。上書きは行っていません。':texts[state.phase]||'待機中';
    if(['cursor_stalled','same_second_boundary','subsecond_boundary','same_second_boundary_unverified','subsecond_boundary_unverified'].includes(state.reason))q('[data-ch-status]').textContent+='（日時境界で停止）';
    // Task207: applied additional count (separate from the fetch step above and from Task206's display limit).
    const appliedSelect=q('[data-ch-applied-target]');appliedSelect.querySelector('[data-ch-custom]')?.remove();
    const appliedTarget=Number(state.appliedTarget)||0;
    if(!APPLIED_PRESETS.includes(appliedTarget)){
      const option=this.doc.createElement('option');option.dataset.chCustom='';option.value=String(appliedTarget);option.textContent=fmt(appliedTarget)+' 件';appliedSelect.append(option);
    }
    appliedSelect.value=String(appliedTarget);
    appliedSelect.disabled=!state.enabled||running||!state.cacheAvailable||p.valid===false;
    q('[data-ch-apply-summary]').textContent=state.cacheAvailable?`取得済み ${fmt(state.cachedAdditional)} 件 · 適用中 ${fmt(state.appliedAdditional)} 件`:'';
    if(state.cacheAvailable&&!running&&['ready','partial'].includes(state.phase)&&state.appliedAdditional<state.cachedAdditional)
      q('[data-ch-status]').textContent+=state.appliedAdditional===0?'（増量前の表示・取得済み分は保持）':'（一部を適用中・取得済み分は保持）';
    q('[data-ch-normal]').textContent=fmt(state.normalCount);q('[data-ch-cached]').textContent=fmt(state.cachedAdditional);q('[data-ch-applied]').textContent=fmt(state.appliedAdditional);q('[data-ch-total]').textContent=fmt((state.normalCount||0)+(state.appliedAdditional||0));q('[data-ch-pages]').textContent=`${fmt(state.pages)} ページ取得`;
    const button=q('[data-ch-primary]');button.textContent=state.phase==='queued'?'待機を中止':state.phase==='fetching'?'中止して反映':state.phase==='applying'?'反映準備中':state.phase==='render-error'?'反映を再試行':state.additionalCount>=20000?'上限に到達':state.canContinue?'さらに取得':state.enabled?'取得し直す':'取得開始';
    button.disabled=state.phase==='applying'||state.phase==='unavailable'||(state.additionalCount>=20000&&state.phase!=='render-error')||p.valid===false;q('[data-ch-restart]').disabled=running||!state.enabled;
  }
  _place(){
    if(!this.view)return;const host=this.doc.fullscreenElement||this.doc.webkitFullscreenElement||this.doc.body;if(this.view.parentNode!==host)host.append(this.view);
    const a=this.anchor?.()?.getBoundingClientRect(),width=Math.min(360,this.win.innerWidth-32);
    this.view.style.left=Math.max(16,Math.min(this.win.innerWidth-width-16,(a?.right||this.win.innerWidth-16)-width))+'px';
    this.view.style.bottom=Math.max(16,Math.min(this.win.innerHeight-120,a?this.win.innerHeight-a.top+10:50))+'px';
    this.view.style.maxHeight=Math.max(100,this.win.innerHeight-parseFloat(this.view.style.bottom)-16)+'px';
  }
  _listen(){
    const attach=win=>{if(this.listeners.includes(win))return;try{win.addEventListener('pointerdown',this.onOutside,true);win.addEventListener('keydown',this.onEscape,true);this.listeners.push(win);}catch{}};
    attach(this.win);for(const f of this.doc.querySelectorAll('iframe')){try{if(f.contentWindow?.document)attach(f.contentWindow);}catch{}}
  }
  _unlisten(){for(const w of this.listeners){try{w.removeEventListener('pointerdown',this.onOutside,true);w.removeEventListener('keydown',this.onEscape,true);}catch{}}this.listeners=[];this.observer?.disconnect();this.observer=null;this.win.removeEventListener('resize',this.onResize);this.doc.removeEventListener('fullscreenchange',this.onResize);}
  _outside(e){
    if(!this.isOpen)return;const path=e.composedPath?.()||[e.target],a=this.anchor?.();if(path.includes(this.view)||path.includes(a))return;
    let video=path.some(x=>x?.matches?.('video,.videoPlayer,.commentLayerFrame'));
    try{video=video||e.view?.frameElement?.matches('.commentLayerFrame,[name="commentLayerFrame"]');}catch{}
    this.close(false);
    if(video&&e.button===0){
      const target=e.target,win=e.view||this.win;
      const swallow=event=>{if(event.target===target||(event.composedPath?.()||[]).includes(target)){event.preventDefault();event.stopImmediatePropagation();}cleanup();};
      const timer=this.win.setTimeout(()=>cleanup(),600);
      const cleanup=()=>{win.removeEventListener('click',swallow,true);this.win.clearTimeout(timer);const i=this.swallowCleanup.indexOf(cleanup);if(i>=0)this.swallowCleanup.splice(i,1);};
      win.addEventListener('click',swallow,true);this.swallowCleanup.push(cleanup);
    }
  }
  open(){
    if(this.disposed)return;this._init();this.win.clearTimeout(this.closeTimer);this.view.classList.remove('is-closing','is-open');this._place();this.view.querySelector('details').open=false;this.view.querySelector('.ch-advanced').hidden=true;void this.view.offsetWidth;this.view.classList.add('is-open');this.view.setAttribute('aria-hidden','false');this._listen();this.win.addEventListener('resize',this.onResize);this.doc.addEventListener('fullscreenchange',this.onResize);if(this.win.MutationObserver){this.observer?.disconnect();this.observer=new this.win.MutationObserver(()=>this._listen());this.observer.observe(this.doc.body,{childList:true,subtree:true});}this.refresh(this.controller.state);
  }
  close(focus=false){if(!this.isOpen)return;this._unlisten();this.view.classList.add('is-closing');this.view.setAttribute('aria-hidden','true');this.win.clearTimeout(this.closeTimer);this.closeTimer=this.win.setTimeout(()=>this.view?.classList.remove('is-open','is-closing'),170);if(focus)this.anchor?.()?.focus?.();this.refresh(this.controller.state);}
  toggle(){this.isOpen?this.close(true):this.open();}
  dispose(){if(this.disposed)return;this.disposed=true;this._unlisten();this.off?.();this.offPrefs?.();this.advanced?.dispose();this.win.clearTimeout(this.closeTimer);[...this.swallowCleanup].forEach(f=>f());this.view?.remove();this.view=null;}
}

export function createHistoryFeature({dialog,config,window:win=globalThis.window}){
  const preferences=createBrowserHistoryPreferences({window:win,config});
  const acquire=(run,signal)=>win.navigator.locks?.request?win.navigator.locks.request('zenza-comment-history-fetch',{mode:'exclusive',signal},async()=>{const result=await run();await new Promise(r=>win.setTimeout(r,1500));return result;}):run();
  const controller=new CommentHistoryController({preferences,acquire,
    render:(data,control)=>dialog._nicoVideoPlayer.applyHistoryThreads(data,control),
    clearRender:()=>dialog._nicoVideoPlayer?.clearCommentHistory(),
    notify:text=>dialog.execCommand('notify',text)});
  const panel=new CommentHistoryPanel({controller,preferences,window:win,anchor:()=>dialog._view?._$view?.[0]?.querySelector('.commentHistorySwitch')||win.document.querySelector('.commentHistorySwitch')});
  return {controller,preferences,panel,dispose(){panel.dispose();controller.dispose();preferences.dispose();}};
}
