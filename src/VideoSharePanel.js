import {PopupMessage} from '../packages/lib/src/ui/PopupMessage';
import {ShareOfficialClip} from './ShareOfficialClip';
import {textUtil} from '../packages/lib/src/text/textUtil';
import {ShareClipRenderer} from './ShareClipRenderer';
import {ShareClipQueue} from './ShareClipQueue';
import {ShareClipClipboard} from './ShareClipClipboard';
import {ShareClipPreferences} from './ShareClipPreferences';
import {ShareClipJobs} from './ShareClipJobs';
import {ShareLocalClip} from './ShareLocalClip';
import {SharePlaybackFile} from './SharePlaybackFile';
import {HlsLibrary} from '../packages/zenza/src/hls/HlsLibrary';
//===BEGIN===
//@require PopupMessage
//@require HlsLibrary
//@require ShareClipClipboard
//@require ShareClipPreferences
//@require SharePlaybackFile
//@require ShareClipRenderer
function defaultShareText(info) {
  const tags = [info.videoId, info.isChannel && 'nicoch'].filter(Boolean).map(tag => '#' + tag);
  const duration = Math.floor(Number(info.duration) || 0);
  const length = duration > 0 ? '(' + textUtil.secToTime(duration) + ')' : '';
  return [(info.title || '').replace(/@/g, '@ ') + length, ...tags].join(' ').trim();
}
function createVideoSharePanel() {
  //@require ShareClipQueue
  //@require ShareLocalClip
  function createOfficialClipService() {
    //@require ShareOfficialClip
    return ShareOfficialClip;
  }
  function notify(title, message, level, source, details) {
    const report = level === 'error' ? PopupMessage.alert : level === 'warning' ? PopupMessage.warning : PopupMessage.notify;
    report(title + '：' + message,false,{source,level:level === 'info' ? 'success' : level,details:{operation:source,
      outcome:level === 'info' ? 'success' : level === 'error' ? 'failed' : 'attention',...details}});
  }
  const notifyClip = (message,level,stage,reason,evidence) => {
    const draft = stage?.startsWith('draft-');
    const phase = stage || (level === 'info' ? 'export-ready' : 'export-recording');
    notify('動画クリップ',message,level,draft ? 'x-draft' : 'clip-export',{phase,reason:reason || phase,...evidence});
  };
  const notifyOfficial = (message,level,result) => {
    const details = result ? {phase:'official-' + result.stage,reason:'official-' + result.reason,
      lastStage:result.reason === 'posted' ? 'confirmed' : result.postAttempted ? 'attempted' : result.clipReady ? 'clip-ready' : 'submitted',
      statusCode:result.statusCode,missing:result.missing,retryAfterMs:result.retrySeconds * 1000} : {};
    notify('ニコニコ連携投稿',message,level,'official-share',details);
  };
  let activeClose, officialClipService;
  const css = `
.zenzaShare {color-scheme:dark;box-sizing:border-box;width:min(64rem,calc(100vw - 24px));max-width:none;
  max-height:100dvh;margin:auto;padding:0;color:#f2f5f8;background:#1b2027;border:1px solid #526175;
  border-radius:12px;text-align:left;overflow:auto;font:14px/1.45 system-ui,sans-serif;box-shadow:0 12px 44px #0009}
.zenzaShare::backdrop {background:#090c1066}
.zenzaShare summary {cursor:pointer}
.zenzaShare * {box-sizing:border-box}
.zenzaShare header,.zenzaShare > section {padding:14px 18px}
.zenzaShare header {display:flex;align-items:center;justify-content:space-between;padding-bottom:4px}
.zenzaShare h2 {font:700 19px/1.5 system-ui;margin:0;color:inherit}
.zenzaShare p {margin:6px 0 10px}
.zenzaShare .shareTitle {color:#c3cdd7;padding:0 18px;overflow-wrap:anywhere}
.zenzaShare .shareRow {display:flex;align-items:center;flex-wrap:wrap;gap:8px}
.zenzaShare button,.zenzaShare a {color:#edf3fb;font:inherit;cursor:pointer}
.zenzaShare button,.zenzaShare .shareAction {display:inline-block;background:#313a46;border:1px solid #526175;border-radius:6px;padding:5px 10px;text-decoration:none;line-height:1.5}
.zenzaShare :is(a,button):hover {background:#414d5c}
.zenzaShare :focus-visible {outline:2px solid #85d2ff;outline-offset:2px}
.zenzaShare input,.zenzaShare textarea,.zenzaShare select {font:inherit;color:#f2f5f8;background:#11161c;border:1px solid #697889;border-radius:4px;padding:5px}
.zenzaShare input[type=number] {width:6em}
.zenzaShare input[type=file],.zenzaShare video {max-width:100%}
.zenzaShare video {display:block;width:100%;max-height:190px}
.zenzaShare textarea,.zenzaShare input[readonly] {display:block;width:100%;margin:4px 0 10px}
.zenzaShare textarea {resize:vertical;min-height:4em}
.zenzaShare :disabled {opacity:.55;cursor:default}
.zenzaShare [hidden] {display:none!important}
.zenzaShare .shareTime {margin-bottom:10px}
.zenzaShare .shareStatus {min-height:1.5em;margin:6px 0 0;color:#afdfff}
.zenzaShare header {gap:12px;padding-block:9px 3px}
.zenzaShare header h2,.zenzaShare header button {flex:none}
.zenzaShare header .shareTitle {min-width:0;margin:0 auto 0 0;padding:0;color:#b9c6d5;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.zenzaShare .clipPages {display:flex;flex-wrap:wrap;gap:4px;margin-bottom:10px}
.zenzaShare .clipPages button {font-size:.9em;line-height:1.25;padding:5px 9px;background:transparent;border-color:transparent}
.zenzaShare .clipPages button[aria-pressed=true] {color:#d7edff;background:#344658;border-color:#6683a0}
.zenzaShare .clipWorkspace {display:grid;grid-template-columns:minmax(0,1.7fr) minmax(15rem,1fr);align-items:start;gap:18px}
.zenzaShare [data-editor-pane] {min-width:0}
.zenzaShare .clipWorkspace [data-role=quality] {display:grid;gap:9px}
.zenzaShare [data-role=quality] label {display:flex;align-items:center;justify-content:space-between;gap:8px}
.zenzaShare [data-role=timeline] {min-width:0}
.zenzaShare .zwClipTimeline .zwClipScreen {max-height:clamp(54px,calc(100dvh - 430px),420px)}
.zenzaShare .clipFooter {border-top:1px solid #465365;margin-top:8px;padding-top:8px;display:flex;align-items:center;flex-wrap:wrap;gap:6px 12px}
.zenzaShare .clipFooter .clipActions,.zenzaShare .clipFooter p {margin:0}
.zenzaShare [role=status][data-busy=true]::before {content:"";display:inline-block;vertical-align:-.1em;width:.8em;height:.8em;margin-right:.45em;border:2px solid #647382;border-top-color:#b8deff;border-radius:50%;animation:zwShareSpin .85s linear infinite}
.zenzaShare [data-role=clipProgress] {font-size:.85em;font-variant-numeric:tabular-nums;white-space:nowrap}
.zenzaShare [data-role=clipProgress] progress {width:4em;height:.5em;vertical-align:middle;accent-color:#83caff}
@keyframes zwShareSpin {to {transform:rotate(360deg)}}
@media (prefers-reduced-motion:reduce) {.zenzaShare [role=status][data-busy=true]::before {animation:none}}
.zenzaShare [role=status] {overflow-wrap:anywhere}
.zenzaShare [data-role=result] {grid-column:1/-1;display:grid;grid-template-columns:minmax(0,1.7fr) minmax(0,1fr);gap:6px 18px}
.zenzaShare [data-role=result] video {grid-row:span 2;max-height:clamp(80px,calc(100dvh - 240px),420px)}
.zenzaShare .zenzaLocalClip:not([data-page=range]) [data-role=timeline],.zenzaShare .zenzaLocalClip:not([data-page=result]) [data-role=result] {display:none}
.zenzaShare .clipSourceName {max-width:100%}
.zenzaShare .shareBody {min-width:0}
.zenzaShare .shareBodyLabel {display:flex;align-items:baseline;gap:5px 8px;flex-wrap:wrap;justify-content:space-between}
.zenzaShare [name=shareFormat] {font-size:.9em;padding:2px 4px}
.zenzaShare:has([data-text-composer]:not([hidden])) {width:min(36rem,calc(100vw - 12px))}
.zenzaShare [data-link-option] {font-size:.9em}
.zenzaShare [data-action=tools] {font-size:.9em}
.zenzaShare [data-text-count] {color:#b9c6d5;font-size:.85em}
.zenzaShare [name=shareText] {display:block;margin:2px 0;resize:vertical;min-height:2em;max-height:9em}
.zenzaShare [data-official-editor] p,.zenzaShare [data-selection-note] {margin:3px 0;overflow-wrap:anywhere}

.zenzaShare .clipFooter [data-action=official-submit] {background:#b8deff;color:#11263c;font-weight:700}
.zenzaShare .clipFooter .clipActions [data-action=create] {background:#313a46;color:#edf3fb;border-color:#65788c;font-weight:500}
.zenzaShare #zenzaShareGuide {flex:0 0 100%;font-size:.9em;color:#d4e4f3}
.zenzaShare [data-page=result] #zenzaShareGuide {display:none}
.zenzaShare #zenzaShareOfficial {margin-top:4px;font-size:.9em}
.zenzaShare:has([data-page=result]) #zenzaShareOfficial {display:none}
.zenzaShare #zenzaShareOfficial summary {width:fit-content;overflow-wrap:anywhere;color:#c9d7e5}
.zenzaShare [data-official-editor] > :is([name=account],[role=status]) {display:none}
.zenzaShare [data-official-editor] > p:first-child {display:none}
.zenzaShare [data-action=x][aria-disabled=true] {opacity:.55;cursor:default}
.zenzaShare [data-share-tools] {margin-top:5px;border-top:1px solid #465365;padding-top:4px}
.zenzaShare [data-share-tools] summary {width:fit-content;color:#c7d5e4}
.zenzaShare .shareToolsGrid {display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px 16px;align-items:start;padding:5px 0}
.zenzaShare .shareStatus:empty {display:none}
.zenzaShare [name=composer] video {max-height:clamp(58px,calc(100dvh - 355px),240px)}
@media(max-width:559px) {
  .zenzaShare {width:calc(100vw - 12px)}
  .zenzaShare .clipWorkspace,.zenzaShare [data-role=result],.zenzaShare .shareToolsGrid {display:block}
  .zenzaShare .clipWorkspace [data-role=timeline] {margin-bottom:4px}
  .zenzaShare .zwClipTimeline .zwClipScreen {max-height:clamp(36px,calc(100dvh - 430px),340px)}
  .zenzaShare .zenzaLocalClip[data-page=range] .zwClipScreen {max-height:clamp(34px,calc(100dvh - 520px),340px)}

}
@media(min-width:560px) and (max-height:470px) {
  .zenzaShare .shareBody textarea {height:2.65em}
  .zenzaShare .zenzaLocalClip[data-page=sources] .clipWorkspace {display:block}
  .zenzaShare .shareToolsGrid {display:block;padding:0}
  .zenzaShare .shareToolsGrid textarea {height:2.5em;margin:2px 0}
}
@media(max-height:550px),(max-width:500px) {
  .zenzaShare {font-size:13px}
  .zenzaShare > section,.zenzaShare header {padding:6px 10px}
  .zenzaShare button,.zenzaShare .shareAction {padding:3px 7px}
  .zenzaShare input,.zenzaShare select,.zenzaShare textarea {padding:3px}
  .zenzaShare header {gap:6px}
  .zenzaShare .clipPages {margin-bottom:3px;gap:1px}
  .zenzaShare .zwClipReadout .zwClipLength input {width:5ch}
  .zenzaShare .zwClipTimeline .zwClipReadout {gap:3px;font-size:12px}
  .zenzaShare .zwClipReadout button {padding:3px 5px}
  .zenzaShare .shareBody [name=shareText] {height:2.4em}
  .zenzaShare .shareTime {margin-bottom:3px}
  .zenzaShare .clipWorkspace .clipLayers,.zenzaShare .clipWorkspace .clipRange {margin:3px 0}
  .zenzaShare .clipPages button {padding:4px 6px}
  .zenzaShare .zwClipTimeline :is(.zwClipReadout,.zwClipTools,.zwClipRailWrap) {margin:3px 0}
  .zenzaShare .zwClipTimeline .zwClipRail {height:32px}
  .zenzaShare .clipFooter {margin-top:4px;padding-top:4px}
  .zenzaShare .clipRange,.zenzaShare .clipLayers,.zenzaShare .clipActions {margin:4px 0}
  .zenzaShare .zenzaLocalClip[data-page=result] video[data-role=preview] {max-height:clamp(64px,calc(100dvh - 365px),210px)}
}
@media(min-width:560px) and (max-height:470px) {
  .zenzaShare .zenzaLocalClip[data-page=result] [data-role=result] {display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr)}
  .zenzaShare .zenzaLocalClip[data-page=result] video[data-role=preview] {max-height:38dvh}
}

@media(max-width:380px) {
  .zenzaShare .clipFooter {gap:4px}
  .zenzaShare .clipFooter [data-role=createActions] {display:contents}
  .zenzaShare .clipFooter :is(button,.shareAction) {font-size:12px;padding:3px 4px}
  .zenzaShare .zenzaLocalClip[data-page=result] video[data-role=preview] {max-height:clamp(64px,calc(100dvh - 392px),210px)}
}
`;
  function open(info, position, getCurrentVideo, playerContext) {
    if (!info || !/^(?:[a-z]{2})?\d+$/i.test(info.watchId)) { return; }
    if (activeClose) { activeClose(); }
    const dialog = document.createElement('dialog');
    dialog.className = 'zen-family zenzaShare';
    dialog.setAttribute('aria-labelledby', 'zenzaShareHeading');
    dialog.innerHTML = `
<style></style>
<header><h2 id="zenzaShareHeading">動画を共有</h2><p class="shareTitle"></p><button type="button" data-action="tools" aria-controls="zenzaShareTools" aria-expanded="false">リンク・埋め込み</button><button type="button" data-action="close" aria-label="共有画面を閉じる">閉じる</button></header>
<section>
<div class="shareBody" data-share-body>
<div class="shareBodyLabel"><label for="zenzaShareText">投稿本文</label><select name="shareFormat" aria-label="投稿形式"><option value="clip">動画付き</option><option value="text">本文のみ</option></select><label data-link-option title="下書きに視聴ページのリンクを添える"><input type="checkbox" name="includeLink" checked> 動画リンク</label><span data-text-count></span></div>
<textarea id="zenzaShareText" name="shareText" rows="2"></textarea></div>
<div id="zenzaShareLocal" data-clip-editor></div>
<div data-text-composer hidden><div data-text-slot></div><p>本文のみの場合は、ニコニコでX連携済みでも、別タブのXで内容を確認して投稿します。</p></div>
<p id="zenzaShareGuide">3〜30秒の区間を連携先のXへ自動投稿します。元のタブを残せば、投稿中もこの画面を閉じられます。</p>
<button type="button" data-action="official-submit" disabled aria-describedby="zenzaShareGuide">ニコニコでXに投稿</button>
<a class="shareAction" data-action="x" target="_blank" rel="noopener noreferrer">本文でX下書き</a>
<div id="zenzaShareOfficial"><p data-selection-note hidden></p>
<details><summary><span aria-live="polite">ニコニコ連携の詳細</span></summary><div data-official-editor></div></details></div>
<div id="zenzaShareTools" data-share-tools hidden></div></section>`;
    const find = selector => dialog.querySelector(selector);
    find('style').textContent = css;
    find('.shareTitle').title = find('.shareTitle').textContent = info.title || info.watchId;
    const message = find('[name=shareText]');
    const includeLink = find('[name=includeLink]');
    const draftLink = find('[data-action=x]');
    const officialAction = find('[data-action=official-submit]');
    let selection = {}, textEdited = false, savedWatchLink = true;
    let localEditor, officialEditor;
    let officialState = {enabled:false};
    const duration = Math.max(0, Math.floor(Number(info.duration) || 0));
    const startTime = Math.min(Math.max(0, Math.floor((Number(position) || 0) * 100) / 100), duration || Infinity);
    const defaultText = defaultShareText(info);
    message.value = defaultText;
    const watch = new URL('https://www.nicovideo.jp/watch/' + info.watchId);
    const official = new URL(watch);
    official.searchParams.set('zenza_official', '1');
    if (startTime) { official.searchParams.set('from', String(startTime)); }
    const videoId = /^(?:[a-z]{2})?\d+$/i.test(info.videoId) ? info.videoId : info.watchId;
    const shorts = location.hostname === 'www.nicovideo.jp' && location.pathname === '/shorts/' + videoId;
    const shareUrl = new URL('https://www.nicovideo.jp/' + (shorts ? 'shorts/' : 'watch/') + videoId);
    const textCount = find('[data-text-count]');
    function updateDraft() {
      const intent = new URL('https://x.com/intent/tweet');
      intent.searchParams.set('text', message.value);
      if (includeLink.checked) intent.searchParams.set('url', shareUrl.href);
      if (message.value.trim() || includeLink.checked) {
        draftLink.href = intent.href;
        draftLink.removeAttribute('aria-disabled');
      } else {
        draftLink.removeAttribute('href');
        draftLink.setAttribute('aria-disabled','true');
      }
      textCount.textContent = Array.from(message.value).length + '文字';
    }
    draftLink.onclick = async event => {
      event.preventDefault();
      if (!event.isTrusted || !draftLink.hasAttribute('href')) return;
      const background = ShareClipPreferences.get(playerContext?.config,'shareClip.backgroundTab');
      const draft = ShareClipClipboard.reserveDraft(true,background);
      if (!draft) return PopupMessage.warning('Xの下書きを開けませんでした。');
      try { await draft.openText([message.value,includeLink.checked && shareUrl.href].filter(Boolean).join('\n')); }
      catch (error) { PopupMessage.warning(error.message); }
      finally { draft.cancel?.(); }
    };
    includeLink.addEventListener('input', updateDraft);
    message.addEventListener('input', () => {
      textEdited = true;
      officialEditor?.refresh?.();
      updateDraft();
    });
    const toolsButton = find('[data-action=tools]');
    const shareTools = find('[data-share-tools]');
    const format = find('[name=shareFormat]');
    const textComposer = find('[data-text-composer]');
    let clipLink = includeLink.checked, textLink = false;
    function updateSections() {
      const textOnly = format.value === 'text';
      localHost.hidden = !shareTools.hidden || textOnly;
      find('#zenzaShareOfficial').hidden = localHost.hidden;
      textComposer.hidden = !shareTools.hidden || !textOnly;
      if (localHost.hidden) localEditor?.stopPreview?.();
    }
    format.onchange = () => {
      if (format.value === 'text') {
        clipLink = includeLink.checked;
        includeLink.checked = textLink;
        textComposer.querySelector('[data-text-slot]').append(body);
        textComposer.append(draftLink);
        draftLink.textContent = 'Xで本文を確認して投稿';
      } else {
        textLink = includeLink.checked;
        includeLink.checked = clipLink;
        localHost.querySelector('[data-share-composer-slot]').append(body);
        localHost.querySelector('[data-role=createActions]').after(draftLink);
        draftLink.textContent = '本文でX下書き';
      }
      updateSections();
      updateDraft();
      format.focus({preventScroll:true});
    };
    toolsButton.onclick = () => {
      if (!shareTools.firstChild) mountTools();
      shareTools.hidden = !shareTools.hidden;
      toolsButton.setAttribute('aria-expanded', String(!shareTools.hidden));
      updateSections();
      dialog.scrollTop = 0;
    };
    function mountTools() {
      shareTools.innerHTML = `<div class="shareToolsGrid"><details name="zenzaShareCopyTools" open><summary>共有リンク</summary>
<div class="shareRow shareTime"><label><input type="checkbox" name="includeTime"> 開始位置を指定</label>
<label><input type="number" name="linkStart" min="0" step="0.01" inputmode="decimal"> 秒から</label></div>
<label>共有リンク<input readonly name="link" aria-label="共有リンク"></label>
<div class="shareRow"><button type="button" data-copy="link">リンクをコピー</button>
<button type="button" data-copy="text">本文とリンクをコピー</button>
<button type="button" data-action="system" hidden>端末で共有</button></div></details>
<details data-embed-tools name="zenzaShareCopyTools"><summary>埋め込みコード</summary>
<label>プレーヤーのサイズ <select name="embedSize"><option value="320,180">小（320 × 180）</option><option value="640,360">中（640 × 360）</option><option value="720,480">大（720 × 480）</option></select></label>
<label>外部プレーヤー<textarea rows="2" name="embed" readonly></textarea></label>
<button type="button" data-copy="embed">プレーヤーのコードをコピー</button>
<label>動画情報とサムネイル<textarea rows="2" name="thumb" readonly></textarea></label>
<button type="button" data-copy="thumb">動画情報のコードをコピー</button></details></div>
<p class="shareStatus" role="status"></p>`;
      const time = find('[name=linkStart]');
      const useTime = find('[name=includeTime]');
      time.value = String(startTime);
      if (duration) time.max = String(duration);
      const status = shareTools.querySelector('.shareStatus');
      const link = find('[name=link]');
      const embed = find('[name=embed]');
      const thumb = find('[name=thumb]');
      const size = find('[name=embedSize]');
      const attr = value => String(value).replace(/[&<>"']/g, char =>
        ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'})[char]);
      const seconds = () => Math.min(Math.max(0, Math.round((Number(time.value) || 0) * 100) / 100), duration || Infinity);
      function updateTools() {
        const embedUrl = new URL('https://embed.nicovideo.jp/watch/' + videoId + '/script');
        const [width, height] = size.value.split(',');
        embedUrl.searchParams.set('w', width); embedUrl.searchParams.set('h', height);
        const sec = seconds();
        shareUrl.searchParams.delete('from');
        if (useTime.checked && sec) {
          shareUrl.searchParams.set('from', String(sec));
          embedUrl.searchParams.set('from', String(sec));
        }
        time.disabled = !useTime.checked;
        link.value = shareUrl.href;
        const title = attr(info.title || videoId);
        embed.value = '<script type="application/javascript" src="' + attr(embedUrl.href) + '"></' + 'script>' +
          '<noscript><a href="' + attr(shareUrl.href) + '">' + title + '</a></noscript>';
        thumb.value = '<iframe width="312" height="176" src="https://ext.nicovideo.jp/thumb/' + videoId +
          '" scrolling="no" style="border:solid 1px #ccc;" frameborder="0"><a href="' + attr(watch.href) + '">' +
          title + '</a></iframe>';
        status.textContent = '';
        updateDraft();
      }
      for (const input of [time, useTime, size]) input.addEventListener('input', updateTools);
      time.addEventListener('change', () => {
        time.value = String(seconds());
        updateTools();
      });
      for (const button of shareTools.querySelectorAll('[data-copy]')) {
        button.onclick = async () => {
          const values = {link:link.value, text:[message.value, link.value].filter(Boolean).join('\n'), embed:embed.value, thumb:thumb.value};
          try {
            if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(values[button.dataset.copy]); }
            else {
              const temp = document.createElement('textarea');
              temp.value = values[button.dataset.copy]; dialog.append(temp); temp.select();
              let copied;
              try { copied = document.execCommand('copy'); } finally { temp.remove(); button.focus(); }
              if (!copied) { throw new Error('copy'); }
            }
            status.textContent = 'コピーしました。';
          } catch (_) { status.textContent = 'コピーできませんでした。上の欄を選択してコピーできます。'; }
        };
      }
      const system = find('[data-action=system]');
      system.hidden = !navigator.share;
      system.onclick = async () => {
        try { await navigator.share({title:info.title, text:message.value, url:link.value}); }
        catch (error) { if (error.name !== 'AbortError') { status.textContent = '端末の共有画面を開けませんでした。'; } }
      };
      updateTools();
    }
    const body = find('[data-share-body]');
    const localHost = find('#zenzaShareLocal');
    const officialDetails = find('#zenzaShareOfficial details');
    const officialSummary = officialDetails.querySelector('summary span');
    const guide = find('#zenzaShareGuide');
    const rangeNote = find('[data-selection-note]');
    function officialAvailability() {
      const length = Math.round(selection.end * 1000) - Math.round(selection.start * 1000);
      const valid = Number.isFinite(length) && length >= 3000 && length <= 30000;
      const notes = [];
      if (selection.isFile) notes.push('選んだファイルはZenzaでMP4にできます。ニコニコ連携は視聴ページの元動画のみ使えます。');
      else if (!valid) notes.push('ニコニコ連携では、元動画から3〜30秒の区間を選んでください。');
      if (!selection.isFile && (selection.comments || selection.effects)) notes.push('コメントはニコニコ側の設定を使います。Zenzaの画面エフェクトはMP4で使えます。');
      rangeNote.textContent = notes.join(' ');
      rangeNote.hidden = !notes.length;
      officialAction.disabled = !officialState.enabled || !valid || !!selection.isFile || !!selection.recording;
      officialAction.textContent = officialState.label === 'このクリップをXに投稿' ? 'ニコニコでこのクリップをXに投稿'
        : ShareClipQueue.items.length && officialState.enabled ? 'ニコニコでXへの投稿を予約' : 'ニコニコでXに投稿';
    }
    function showSelection(next) {
      if (!!selection.isFile !== !!next.isFile) {
        if (next.isFile) savedWatchLink = includeLink.checked;
        includeLink.checked = next.isFile ? false : savedWatchLink;
        if (!textEdited) message.value = next.isFile ? '' : defaultText;
        updateDraft();
      }
      selection = next;
      guide.hidden = officialDetails.hidden = !!next.isFile;
      if (!next.isFile && localEditor) mountOfficialEditor();
      if (!next.isFile) officialEditor?.setRange?.(next);
      officialAvailability();
    }
    // Hold the original playback position while the clip editor has focus.
    let resumeVideo;
    function holdPlayback() {
      const video = getCurrentVideo?.();
      if (!video || video.paused || video.ended || resumeVideo) return;
      const src = video.currentSrc, object = video.srcObject;
      video.pause();
      resumeVideo = () => {
        if (getCurrentVideo?.() === video && video.currentSrc === src && video.srcObject === object && video.paused && !video.ended) {
          video.play().catch(() => {});
        }
      };
    }
    function releasePlayback() {
      resumeVideo?.();
      resumeVideo = null;
    }
    function mountEditor() {
      holdPlayback();
      localEditor = ShareLocalClip.mount(localHost, {
        qualityConfig:playerContext?.config,
        onBackgroundFinish:notifyClip,
        onOpenOfficial() { officialDetails.open = true; officialDetails.querySelector('summary').focus(); },
        title:info.title, startTime, getCurrentVideo, seekCurrentVideo:playerContext?.seekCurrentVideo,
        getThumbnail:playerContext?.getThumbnail, clipSession:playerContext?.clipSession, onSelectionChange:showSelection,
        getCurrentHlsSource:playerContext?.getCurrentHlsSource, getFragmentCache:playerContext?.getFragmentCache,
        getCurrentHlsRendition:playerContext?.getCurrentHlsRendition,
        getStoryboardInterval:playerContext?.getStoryboardInterval,
        getCurrentFile(video, signal) {
          const src = playerContext?.getCurrentFileSource?.(video);
          if (!src) return Promise.resolve(null);
          return SharePlaybackFile.get(video, src, {
            signal, keepOriginal:true, isCurrent:() => playerContext.getCurrentFileSource(video) === src
          });
        },
        createFrameRenderer: options => ShareClipRenderer.create({...playerContext, ...options}),
        getShareText: () => [message.value, includeLink.checked && shareUrl.href].filter(Boolean).join('\n')
      });
      localHost.querySelector('[data-share-composer-slot]').append(body);
      const actions = localHost.querySelector('[data-role=createActions]');
      actions.prepend(officialAction);
      actions.after(draftLink);
      actions.before(guide);
      if (!selection.isFile) mountOfficialEditor();
      officialAvailability();
      localEditor?.startPreview?.();
    }
    function mountOfficialEditor() {
      if (officialEditor) return;
      officialClipService ||= createOfficialClipService();
      officialEditor = officialClipService.mount(find('[data-official-editor]'), {
        info, startTime:selection.start, endTime:selection.end, text:() => message.value,
        officialUrl:official.href, sharedEditor:true,
        onNotify:notifyOfficial, holdWatchPage:ShareClipJobs.keepWatchLinksInNewTabs,
        onSubmitState(state) {
          officialState = state;
          const destination = state.account ? '投稿先 @' + state.account : '';
          const summary = [destination,state.status].filter(Boolean).join('　') || 'ニコニコ連携の詳細';
          if (officialSummary.textContent !== summary) officialSummary.textContent = summary;
          officialAvailability();
        }
      });
      officialEditor.setRange?.(selection);
    }
    officialAction.onclick = () => {
      if (!officialAction.disabled) officialEditor.submit();
    };
    const previousFocus = document.activeElement;
    function close() {
      if (activeClose !== close) { return; }
      activeClose = null;
      officialEditor?.();
      localEditor?.();
      releasePlayback();
      if (dialog.open) { dialog.close(); }
      dialog.remove();
      if (previousFocus?.isConnected) { previousFocus.focus({preventScroll:true}); }
    }
    activeClose = close;
    find('[data-action=close]').onclick = close;
    dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
    dialog.addEventListener('close', close);
    for (const type of ['keydown', 'keyup', 'keypress']) { dialog.addEventListener(type, event => event.stopPropagation()); }
    (document.fullscreenElement || document.body).append(dialog);
    updateDraft();
    dialog.showModal();
    window.dispatchEvent(new Event('zenza-share-panel-open'));
    mountEditor();
  }
  function quick(spec) {
    if (spec.command === 'shareNicoNext30') {
      PopupMessage.notify('ニコニコで ' + spec.from + '〜' + spec.to + ' 秒の投稿先を確認しています。');
      officialClipService ||= createOfficialClipService();
      return officialClipService.submitQuick(spec,notifyOfficial,ShareClipJobs.keepWatchLinksInNewTabs);
    }
    const task = ShareLocalClip.startFull(spec,notifyClip);
    PopupMessage.notify('動画全体のMP4作成を受け付けました。Xへの添付結果は通知でお知らせします。');
    return task;
  }
  return {open, quick, close() { if (activeClose) { activeClose(); } }};
}

const VideoSharePanel = (() => {
  let panel, loading, requested;
  const quickRequests = [];
  function runQuick(spec) {
    function failed(error) {
      spec.cancel?.();
      PopupMessage.alert(error.message || '共有処理を開始できませんでした。');
    }
    try { Promise.resolve(panel.quick(spec)).catch(failed); }
    catch (error) { failed(error); }
  }
  function ready(instance) {
    loading = null;
    panel = instance;
    const args = requested;
    requested = null;
    for (const spec of quickRequests.splice(0)) runQuick(spec);
    if (args) panel.open(...args);
  }
  function load() {
    if (loading) return;
    const failed = () => {
      loading = null;
      const showError = !!requested || !!quickRequests.length;
      requested = null;
      for (const spec of quickRequests.splice(0)) spec.cancel?.();
      if (showError) PopupMessage.alert('共有機能を読み込めませんでした。もう一度お試しください。');
    };
    try {
      const instance = createVideoSharePanel();
      if (typeof instance?.then !== 'function') return ready(instance);
      loading = instance.then(ready,failed);
    } catch (_) { failed(); }
  }
  function quick(command,info,position,getCurrentVideo,context) {
    const video = getCurrentVideo();
    const duration = Number.isFinite(video?.duration) && video.duration > 0 ? video.duration : Number(info.duration);
    if (!Number.isFinite(duration) || duration <= 0) return PopupMessage.warning('動画の長さを取得できません。読み込み後にお試しください。');
    const watchId = info.watchId, videoId = info.videoId || watchId;
    if (![watchId,videoId].every(id => /^(?:[a-z]{2})?\d+$/i.test(id))) return;
    const name = info.title || watchId, text = defaultShareText(info) || watchId;
    let spec;
    if (command === 'shareNicoNext30') {
      const first = Math.max(0,Math.round(Number(position) * 1000));
      const last = Math.min(first + 30000,Math.floor(duration * 1000));
      if (!Number.isSafeInteger(first) || last - first < 3000) {
        return PopupMessage.warning('ニコニコで投稿するには、現在位置から3秒以上の区間が必要です。');
      }
      spec = {command,watchId,videoId,name,text,from:first/1000,to:last/1000};
    } else if (command === 'shareZenzaFull') {
      if (!video || video.mediaKeys) return PopupMessage.warning('再生中の動画からMP4を作成できません。');
      const source = context.getCurrentFileSource?.(video);
      const url = context.getCurrentHlsSource?.(video);
      if (!source && !url) return PopupMessage.warning('元の動画ファイルまたは配信を取得できません。');
      const pref = key => ShareClipPreferences.get(context.config,'shareClip.' + key);
      const quality = pref('exportQuality'), rendition = context.getCurrentHlsRendition?.(video);
      const height = quality === 'source' ? rendition?.height || video.videoHeight : quality === 'low' ? 0 : Number(quality);
      const comments = pref('includeComments'), effects = pref('includeEffects');
      const controller = new AbortController();
      const {signal} = controller;
      const draft = ShareClipClipboard.reserveDraft(true,pref('backgroundTab'));
      if (!draft) return PopupMessage.warning('Xの下書きタブを予約できませんでした。もう一度お試しください。');
      let renderer;
      const cancel = () => {
        controller.abort();
        draft.cancel?.();
        renderer?.then(layer => layer?.dispose(),() => {});
      };
      try {
        // Start capturing bytes and layers while the original player is still current.
        const blob = source && SharePlaybackFile.get(video,source,{signal,keepOriginal:true,
          isCurrent:() => context.getCurrentFileSource(video) === source});
        if (blob) blob.catch(() => {});
        if (comments || effects) {
          renderer = Promise.resolve(ShareClipRenderer.create({...context,video,comments,effects,from:0,to:duration,signal,
            isCurrent:() => getCurrentVideo() === video}));
          renderer.catch(() => {});
        }
        spec = {command,name,from:0,to:duration,comments,draft,cancel,controller,getBlob:() => blob,
          shareText:text + '\nhttps://www.nicovideo.jp/watch/' + videoId,
          hls:url && {url,height,cache:context.getFragmentCache?.(video),renditionUrl:quality === 'source' ? rendition?.uri : undefined},
          maxHeight:quality === 'source' ? undefined : height || (source ? 144 : undefined),
          prepareRenderer:renderer && (() => renderer)};
      } catch (error) { cancel(); return PopupMessage.alert(error.message); }
    } else return;
    if (panel) return runQuick(spec);
    quickRequests.push(spec);
    load();
  }
  return {
    quick,
    open(...args) {
      if (panel) return panel.open(...args);
      requested = args;
      load();
    },
    close() {
      requested = null;
      panel?.close();
    }
  };
})();
//===END===
export {VideoSharePanel};
