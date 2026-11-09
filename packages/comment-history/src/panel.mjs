import {SETTINGS_SCHEMA} from './settings.mjs';
import {HISTORY_PRESETS,createBrowserHistoryPreferences} from './browser-preferences.mjs';
import {CommentHistoryController} from './controller.mjs';

export const HISTORY_ICON='<svg viewBox="0 0 36 36" aria-hidden="true"><path fill-rule="evenodd" d="M8 7h20a3 3 0 0 1 3 3v13a3 3 0 0 1-3 3H16l-6 5v-5H8a3 3 0 0 1-3-3V10a3 3 0 0 1 3-3Zm1 3a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h4v2l2.4-2H27a1 1 0 0 0 1-1V11a1 1 0 0 0-1-1H9Z"/><path d="M16.5 12h3v3.5H23v3h-3.5V22h-3v-3.5H13v-3h3.5Z"/></svg>';
const CSS=`
.commentHistorySwitch .controlButtonInner{display:inline-block;width:26px;height:26px;vertical-align:middle}
.commentHistorySwitch svg{display:block;width:100%;height:100%;fill:currentColor}
.commentHistorySwitch.is-active{color:var(--enabled-button-color,#9cf);opacity:1}
.commentHistorySwitch.is-active svg{filter:drop-shadow(0 0 3px var(--enabled-button-color,#9cf))}
.commentHistorySwitch.is-fetching svg{animation:zenzaHistoryPulse 1.6s ease-in-out infinite}
@keyframes zenzaHistoryPulse{50%{opacity:.48}}
.zenzaCommentHistoryPanel{position:fixed;z-index:6060001;box-sizing:border-box;width:360px;max-width:calc(100vw - 32px);max-height:calc(100vh - 32px);overflow:auto;overscroll-behavior:contain;padding:12px;background:rgba(18,29,45,.97);color:#e6eef5;border:1px solid #455468;border-radius:12px;box-shadow:0 8px 36px #0009;font:13px/1.5 'Yu Gothic UI','Meiryo',sans-serif;text-align:left;display:none;transform-origin:var(--ch-origin,100% 100%)}
.zenzaCommentHistoryPanel.is-open{display:block;animation:zenzaHistoryIn .22s cubic-bezier(.2,.9,.3,1.15) both}
.zenzaCommentHistoryPanel.is-closing{pointer-events:none;animation:zenzaHistoryOut .16s ease-in both}
@keyframes zenzaHistoryIn{from{opacity:0;transform:translate(12px,18px) scale(.86);filter:blur(2px)}to{opacity:1;transform:none;filter:none}}
@keyframes zenzaHistoryOut{from{opacity:1;transform:none}to{opacity:0;transform:translate(8px,12px) scale(.92)}}
@media(prefers-reduced-motion:reduce){.zenzaCommentHistoryPanel.is-open,.zenzaCommentHistoryPanel.is-closing{animation-duration:.01s}.commentHistorySwitch.is-fetching svg{animation:none}}
.zenzaCommentHistoryPanel button,.zenzaCommentHistoryPanel select,.ch-settings input{font:inherit;box-sizing:border-box}
.zenzaCommentHistoryPanel button,.ch-settings button{cursor:pointer;border:1px solid #496071;border-radius:7px;padding:7px 10px;background:#27384b;color:#edf7ff}
.zenzaCommentHistoryPanel button:disabled{cursor:default;opacity:.45}
.zenzaCommentHistoryPanel button:focus-visible,.zenzaCommentHistoryPanel select:focus-visible,.ch-settings input:focus-visible{outline:2px solid #72e4cc;outline-offset:2px}
 .ch-header{display:flex;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:10px}.ch-header strong{font-size:16px;flex:1}
.ch-visibility{display:flex;align-items:center;justify-content:space-between;gap:8px}.ch-visibility strong{font-size:13px}.zenzaCommentHistoryPanel [data-ch-visibility]{min-width:76px;min-height:32px;padding:5px 8px;font-weight:700;background:#79dfc9;color:#0c2b28;border-color:#79dfc9}
.ch-enable{display:flex;align-items:center;gap:6px;white-space:nowrap}.ch-enable input{accent-color:#72e4cc}
.ch-status,.ch-note{color:#b4c2d0;font-size:12px;white-space:normal;overflow-wrap:anywhere}.ch-note{margin:6px 0}.ch-status{margin-top:6px}
.zenzaCommentHistoryPanel [hidden]{display:none!important}.zenzaCommentHistoryPanel progress{width:100%;height:6px;accent-color:#72e4cc;display:block;margin:8px 0}
.ch-slider{margin:10px 0 6px}.ch-slider-label{display:flex;flex-wrap:wrap;justify-content:space-between;gap:4px;color:#b4c2d0;font-size:12px}.ch-slider-label output{color:#e6eef5;font-variant-numeric:tabular-nums}.ch-slider input{display:block;width:100%;height:24px;margin:2px 0;accent-color:#72e4cc}.ch-slider input:disabled{opacity:.45}.ch-slider-ticks{display:flex;justify-content:space-between;color:#b4c2d0;font-size:11px}
.ch-action-row{display:grid;grid-template-columns:112px minmax(0,1fr) 68px;gap:6px;align-items:center;margin-top:8px}.ch-action-row label{color:#b4c2d0;font-size:12px}
.zenzaCommentHistoryPanel select{width:100%;min-width:0;height:32px;padding:4px 6px;color:#ecf7fa;background:#1c3044;border:1px solid #486175;border-radius:7px}
.zenzaCommentHistoryPanel [data-ch-primary]{min-height:32px;padding:5px 6px;font-weight:700}
.ch-bottom{margin-top:12px;padding-top:10px;border-top:1px solid #33475d;display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:start;gap:8px}.ch-details{display:contents}.ch-details:not([open])>div{display:none}.ch-details summary{grid-column:1;grid-row:1;padding:5px 0;cursor:pointer;color:#cedde9}.ch-details>div{grid-column:1/-1}.ch-counts{display:grid;grid-template-columns:1fr auto;gap:5px;margin:8px 0;font-size:12px}.ch-bottom [data-ch-advanced]{grid-column:2;grid-row:1;background:none;font-size:12px;padding:5px 8px;min-height:32px}.zenzaCommentHistoryPanel .ch-setting-error:empty{display:none}
@media(max-width:360px){.ch-action-row{grid-template-columns:100px minmax(0,1fr) 60px;gap:5px}}
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
    `<label><span>${esc(d.name==='maxAdditionalComments'?'読み込むコメント数':d.label)}${d.type==='integer'?`<br><small>${d.min.toLocaleString()}～${d.max.toLocaleString()}</small>`:''}</span><input data-history-setting="${d.name}" type="${d.type==='boolean'?'checkbox':'number'}"${d.type==='integer'?` min="${d.min}" max="${d.max}" step="1"`:''}></label>`
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
    el.innerHTML=`<header class="ch-header"><strong>コメント増量</strong><label class="ch-enable"><input type="checkbox" data-ch-enabled> 自動で増量</label></header>
<div class="ch-visibility"><strong data-ch-visibility-status role="status" aria-live="polite"></strong><button type="button" data-ch-visibility aria-pressed="false">非表示</button></div>
<div class="ch-status" data-ch-status role="status" aria-live="polite" hidden></div><div class="ch-progress" hidden><progress value="0" max="5000" aria-label="読み込みの進捗"></progress></div>
<div class="ch-slider"><div class="ch-slider-label"><label for="zenza-history-percentage" data-ch-apply-label>追加コメント数</label><output for="zenza-history-percentage" data-ch-apply-summary></output></div><input id="zenza-history-percentage" type="range" min="0" max="100" step="1" value="0" data-ch-applied-target aria-label="追加コメント数"><div class="ch-slider-ticks"><span>0%</span><span>100%</span></div></div>
<div class="ch-action-row"><label for="zenza-history-quota">読み込むコメント数</label><select id="zenza-history-quota" data-ch-quota aria-label="読み込むコメント数">${HISTORY_PRESETS.map(n=>`<option value="${n}">${fmt(n)} 件</option>`).join('')}</select><button type="button" data-ch-primary>読込</button></div>
<div class="ch-bottom"><details class="ch-details"><summary>詳細・説明</summary><div><p class="ch-note">非表示は今の動画だけです。再表示では読み込み済みデータを使います。次の動画は「自動で増量」の設定に従います。</p><p class="ch-note">「自動で増量」をOFFにすると通常コメントだけに戻り、読み込み済みデータを破棄します。追加コメント数の100%は、選択した読み込み数と読み込み済み数の小さい方です。</p><div class="ch-counts"><span>通常コメント</span><span data-ch-normal></span><span>読み込み済みの追加分（保持中）</span><span data-ch-cached></span><span>表示中の追加分</span><span data-ch-applied></span><span>表示対象の合計</span><span data-ch-total></span></div><label><input type="checkbox" data-ch-easy> かんたんコメントも追加取得</label><p class="ch-note">取得中の条件は固定です。かんたんコメントの変更は、次の動画か「最初から取得」で使用します。NGはそのまま適用されます。</p><button type="button" data-ch-restart>最初から取得</button><p class="ch-note" data-ch-pages></p></div></details><button type="button" data-ch-advanced>上級者設定</button></div><div class="ch-advanced" hidden></div><div class="ch-setting-error" data-ch-error role="status"></div>`;
    const safe=fn=>{try{fn();this.view.querySelector('[data-ch-error]').textContent='';}catch{this.refresh(this.controller.state);this.view.querySelector('[data-ch-error]').textContent='設定を保存できませんでした。';}};
    el.querySelector('[data-ch-visibility]').onclick=()=>safe(()=>{void this.controller.setHidden(!this.controller.state.hidden);});
    el.querySelector('[data-ch-enabled]').onchange=e=>safe(()=>this.controller.setEnabled(e.target.checked));
    el.querySelector('[data-ch-quota]').onchange=e=>safe(()=>this.preferences.patch({maxAdditionalComments:Number(e.target.value)}));
    const slider=el.querySelector('[data-ch-applied-target]');
    slider.oninput=()=>{if(slider.disabled)return;this.sliderDraft={key:this._sliderKey(),percent:Number(slider.value)};this._slider(this.controller.state,this.preferences.get());};
    slider.onchange=()=>safe(()=>{
      if(slider.disabled)return;
      const count=Math.round(this._sliderLimit(this.controller.state,this.preferences.get())*Number(slider.value)/100);
      this.sliderDraft=null;
      void this.controller.setCachedCount(count).catch(()=>{if(!this.disposed)this.refresh(this.controller.state);});
    });
    el.querySelector('[data-ch-easy]').onchange=e=>safe(()=>this.preferences.patch({includeEasy:e.target.checked}));
    el.querySelector('[data-ch-primary]').onclick=()=>{const s=this.controller.state;if(['fetching','queued'].includes(s.phase))this.controller.stop();else if(!s.enabled)safe(()=>this.controller.setEnabled(true));else void this.controller.loadSelectedCount();};
    el.querySelector('[data-ch-restart]').onclick=()=>void this.controller.restart();
    el.querySelector('[data-ch-advanced]').onclick=()=>{const target=el.querySelector('.ch-advanced');target.hidden=!target.hidden;if(!target.hidden&&!this.advanced)this.advanced=mountHistorySettings(target,{preferences:this.preferences});if(!target.hidden)target.scrollIntoView({block:'nearest'});};
    for(const name of ['click','dblclick','mousedown','mouseup','pointerdown','wheel','keydown','keyup','contextmenu'])el.addEventListener(name,e=>e.stopPropagation());
  }
  _sliderLimit(state,p){return state.cacheAvailable?Math.max(0,Math.min(Number(p.settings.maxAdditionalComments)||0,Number(state.cachedAdditional)||0)):0;}
  _sliderKey(){const s=this.controller.state,p=this.preferences.get();return JSON.stringify([s.videoId,s.phase,s.hidden,s.enabled,s.appliedTarget,this._sliderLimit(s,p)]);}
  _slider(state,p){
    const slider=this.view.querySelector('[data-ch-applied-target]'),limit=this._sliderLimit(state,p);
    const key=this._sliderKey();if(this.sliderDraft?.key!==key)this.sliderDraft=null;
    const count=Math.min(limit,Math.max(0,Number(state.appliedTarget)||0));
    const percent=this.sliderDraft?.percent??(limit?Math.round(count/limit*100):0);
    const preview=this.sliderDraft?Math.round(limit*percent/100):count;
    slider.value=String(percent);slider.disabled=!!state.hidden||!state.enabled||['fetching','queued','applying'].includes(state.phase)||!limit||p.valid===false;
    slider.setAttribute('aria-valuetext',`${fmt(preview)} 件、${percent}%`);
    this.view.querySelector('[data-ch-apply-summary]').textContent=`${fmt(preview)} / ${fmt(limit)} 件（${percent}%）`;
    this.view.querySelector('[data-ch-apply-label]').textContent=state.hidden?'追加コメント数（保持）':'追加コメント数';
  }
  refresh(state){
    const a=this.anchor?.();
    if(a){a.classList.toggle('is-active',state.enabled&&!state.hidden);a.classList.toggle('is-fetching',state.phase==='fetching');a.setAttribute('aria-expanded',String(this.isOpen));a.setAttribute('aria-label','コメント増量'+(state.enabled?'：自動で増量 有効':'：自動で増量 無効'));}
    if(!this.view)return;
    const p=this.preferences.get(),v=this.view;const q=s=>v.querySelector(s),running=['fetching','queued','applying'].includes(state.phase);
    q('[data-ch-enabled]').checked=state.enabled;
    const visibility=q('[data-ch-visibility]');
    visibility.textContent=state.hidden?'再表示':'非表示';
    visibility.setAttribute('aria-label',state.hidden?'増量分を再表示':'増量分を非表示');
    visibility.setAttribute('aria-pressed',String(!!state.hidden));
    visibility.disabled=!state.enabled||!state.videoId||p.valid===false||(!running&&!state.hidden&&!state.cachedAdditional);
    q('.ch-visibility').classList.toggle('is-hidden',!!state.hidden);
    q('[data-ch-visibility-status]').textContent=state.hidden?'増量分：非表示中':!state.enabled?'自動増量：OFF':state.appliedAdditional>0?'増量分：表示中':running?'増量分：準備中':state.cachedAdditional?'増量分：表示なし':'増量分なし';
    const quota=q('[data-ch-quota]');
    quota.querySelector('[data-ch-custom]')?.remove();
    if(!HISTORY_PRESETS.includes(p.settings.maxAdditionalComments)){
      const option=this.doc.createElement('option');option.dataset.chCustom='';
      option.value=String(p.settings.maxAdditionalComments);option.textContent=fmt(p.settings.maxAdditionalComments)+' 件';quota.append(option);
    }
    quota.value=p.settings.maxAdditionalComments;q('[data-ch-easy]').checked=p.settings.includeEasy;
    q('.ch-progress').hidden=!running;
    q('progress').max=state.goal||p.settings.maxAdditionalComments;q('progress').value=state.additionalCount||0;
    const texts={idle:state.enabled?'通常コメントの読込完了を待っています':'自動増量なし · 通常コメントのみ表示',queued:'他のタブの取得終了を待っています',fetching:'取得中 · 追加分は未反映',applying:'取得終了 · 表示を準備しています',ready:'反映済み',partial:'一部取得 · 取得済みの正常分を反映',unavailable:'この動画・コメント形式では増量できません', 'render-error':'取得済みデータの反映に失敗しました'};
    q('[data-ch-status]').textContent=p.valid===false?'保存設定が不正です。上書きは行っていません。':texts[state.phase]||'待機中';
    if(['cursor_stalled','same_second_boundary','subsecond_boundary','same_second_boundary_unverified','subsecond_boundary_unverified'].includes(state.reason))q('[data-ch-status]').textContent+='（日時境界で停止）';
    if(state.hidden)q('[data-ch-status]').textContent=running?'増量分は非表示 · 取得済みデータを保持しています':'増量分は非表示 · 再表示できます';
    q('[data-ch-status]').hidden=!running&&!['partial','unavailable','render-error'].includes(state.phase)&&p.valid!==false;
    this._slider(state,p);
    q('[data-ch-normal]').textContent=fmt(state.normalCount);q('[data-ch-cached]').textContent=fmt(state.cachedAdditional);q('[data-ch-applied]').textContent=fmt(state.appliedAdditional);q('[data-ch-total]').textContent=fmt((state.normalCount||0)+(state.appliedAdditional||0));q('[data-ch-pages]').textContent=`${fmt(state.pages)} ページ取得`;
    const button=q('[data-ch-primary]');button.textContent=state.phase==='queued'?'待機中止':state.phase==='fetching'?'読込中止':state.phase==='applying'?'反映中':state.phase==='render-error'?'再反映':'読込';
    button.title='選択したコメント数まで読み込みます。読み込み済みの分は再取得しません。';
    button.disabled=(state.hidden&&!['fetching','queued'].includes(state.phase))||state.phase==='applying'||state.phase==='unavailable'||(state.phase!=='render-error'&&!running&&state.cacheAvailable&&state.appliedTarget>=this._sliderLimit(state,p)&&(state.cachedAdditional>=p.settings.maxAdditionalComments||state.canContinue===false))||p.valid===false;q('[data-ch-restart]').disabled=state.hidden||running||!state.enabled;
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
    if(this.disposed)return;this.sliderDraft=null;this._init();this.win.clearTimeout(this.closeTimer);this.view.classList.remove('is-closing','is-open');this._place();this.view.querySelector('details').open=false;this.view.querySelector('.ch-advanced').hidden=true;void this.view.offsetWidth;this.view.classList.add('is-open');this.view.setAttribute('aria-hidden','false');this._listen();this.win.addEventListener('resize',this.onResize);this.doc.addEventListener('fullscreenchange',this.onResize);if(this.win.MutationObserver){this.observer?.disconnect();this.observer=new this.win.MutationObserver(()=>this._listen());this.observer.observe(this.doc.body,{childList:true,subtree:true});}this.refresh(this.controller.state);
  }
  close(focus=false){if(!this.isOpen)return;this._unlisten();this.view.classList.add('is-closing');this.view.setAttribute('aria-hidden','true');this.win.clearTimeout(this.closeTimer);this.closeTimer=this.win.setTimeout(()=>this.view?.classList.remove('is-open','is-closing'),170);if(focus)this.anchor?.()?.focus?.();this.refresh(this.controller.state);}
  toggle(){this.isOpen?this.close(true):this.open();}
  dispose(){if(this.disposed)return;this.disposed=true;this._unlisten();this.off?.();this.offPrefs?.();this.advanced?.dispose();this.win.clearTimeout(this.closeTimer);[...this.swallowCleanup].forEach(f=>f());this.view?.remove();this.view=null;}
}

export function createHistoryFeature({dialog,config,window:win=globalThis.window}){
  const preferences=createBrowserHistoryPreferences({window:win,config});
  const acquire=(run,signal)=>win.navigator.locks?.request?win.navigator.locks.request('zenza-comment-history-fetch',{mode:'exclusive',signal},async()=>{const result=await run();await new Promise(r=>win.setTimeout(r,1500));return result;}):run();
  const controller=new CommentHistoryController({preferences,acquire,displayLimit:()=>preferences.get().settings.maxAdditionalComments,
    render:(data,control)=>dialog._nicoVideoPlayer.applyHistoryThreads(data,control),
    clearRender:options=>dialog._nicoVideoPlayer?.clearCommentHistory(options),
    notify:text=>dialog.execCommand('notify',text)});
  const panel=new CommentHistoryPanel({controller,preferences,window:win,anchor:()=>dialog._view?._$view?.[0]?.querySelector('.commentHistorySwitch')||win.document.querySelector('.commentHistorySwitch')});
  return {controller,preferences,panel,dispose(){panel.dispose();controller.dispose();preferences.dispose();}};
}
