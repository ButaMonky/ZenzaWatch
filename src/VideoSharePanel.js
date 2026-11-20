import {PopupMessage} from '../packages/lib/src/ui/PopupMessage';
import {ShareOfficialClip} from './ShareOfficialClip';
import {textUtil} from '../packages/lib/src/text/textUtil';
import {ShareClipRenderer} from './ShareClipRenderer';
import {ShareLocalClip} from './ShareLocalClip';
import {SharePlaybackFile} from './SharePlaybackFile';
import {HlsLibrary} from '../packages/zenza/src/hls/HlsLibrary';
//===BEGIN===
//@require PopupMessage
//@require HlsLibrary
function createVideoSharePanel() {
  //@require ShareLocalClip
  //@require SharePlaybackFile
  //@require ShareClipRenderer
  function createOfficialClipService() {
    //@require ShareOfficialClip
    return ShareOfficialClip;
  }
  let activeClose, officialClipService;
  const css = `
.zenzaShare {color-scheme:dark;box-sizing:border-box;width:min(64rem,calc(100vw - 24px));max-width:none;
  max-height:100dvh;margin:auto;padding:0;color:#f2f5f8;background:#1b2027;border:1px solid #526175;
  border-radius:12px;text-align:left;overflow:auto;font:14px/1.45 system-ui,sans-serif;box-shadow:0 12px 44px #0009}
.zenzaShare::backdrop {background:#090c1066}
.zenzaShare summary {cursor:pointer}
.zenzaShare .shareProvider p {color:#c1ccd7}
.zenzaShare [data-action=back] {margin-bottom:.5rem}
.zenzaShare * {box-sizing:border-box}
.zenzaShare header,.zenzaShare > section {padding:14px 18px}
.zenzaShare header {display:flex;align-items:center;justify-content:space-between;padding-bottom:4px}
.zenzaShare h2 {font:700 19px/1.5 system-ui;margin:0;color:inherit}
.zenzaShare p {margin:6px 0 10px}
.zenzaShare .shareTitle {color:#c3cdd7;padding:0 18px;overflow-wrap:anywhere}
.zenzaShare nav,.zenzaShare .shareRow {display:flex;align-items:center;flex-wrap:wrap;gap:8px}
.zenzaShare nav {padding:6px 18px 0;gap:3px;border-bottom:1px solid #475364}
.zenzaShare button,.zenzaShare a {color:#edf3fb;font:inherit;cursor:pointer}
.zenzaShare button,.zenzaShare .shareAction {display:inline-block;background:#313a46;border:1px solid #526175;border-radius:6px;padding:5px 10px;text-decoration:none;line-height:1.5}
.zenzaShare nav button {background:none;border:0;border-bottom:3px solid transparent;border-radius:0;padding:6px 8px}
.zenzaShare nav button[aria-pressed=true] {border-bottom-color:#6fc5ff;font-weight:700;color:white}
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
.zenzaShare .zwClipTimeline .zwClipScreen {max-height:clamp(54px,calc(100dvh - 425px),420px)}
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
.zenzaShare #zenzaShareLink {display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 20px}
.zenzaShare #zenzaShareLink > :not(details) {grid-column:1}
.zenzaShare #zenzaShareLink > details {grid-column:2;grid-row:1/span 5}
.zenzaShare textarea {resize:none;min-height:0}
.zenzaShare [data-official-editor] {display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px 16px;align-items:start}
.zenzaShare [data-official-editor]>:not([name=editor]) {grid-column:1;margin:0}
.zenzaShare [data-official-editor]>[name=editor] {grid-column:2;grid-row:1/span 6}
.zenzaShare [name=composer] video {max-height:clamp(58px,calc(100dvh - 355px),240px)}
@media(max-width:559px) {
  .zenzaShare {width:calc(100vw - 12px)}
  .zenzaShare .clipWorkspace,.zenzaShare [data-role=result],.zenzaShare #zenzaShareLink,.zenzaShare [data-official-editor] {display:block}
  .zenzaShare .clipWorkspace [data-role=timeline] {margin-bottom:6px}
  .zenzaShare .zwClipTimeline .zwClipScreen {max-height:clamp(36px,calc(100dvh - 430px),340px)}
  .zenzaShare .zenzaLocalClip[data-page=range] .zwClipScreen {max-height:clamp(34px,calc(100dvh - 456px),340px)}
  .zenzaShare #zenzaShareLink:has(details[open]) > :not(details,.shareStatus) {display:none}
  .zenzaShare [data-official-editor]:has([name=composer]:not([hidden])) > :is(p:not([role=status]),.shareRow:first-of-type) {display:none}
  .zenzaShare [name=composer] video {max-height:clamp(56px,calc(100dvh - 425px),240px)}
}
@media(min-width:560px) and (max-height:470px) {
  .zenzaShare[open] {display:grid;grid-template-columns:minmax(0,1fr) auto}
  .zenzaShare > header {grid-column:1}
  .zenzaShare > nav {grid-column:2;align-self:center;border:none}
  .zenzaShare > section {grid-column:1/-1}
  .zenzaShare .zenzaLocalClip[data-page=sources] .clipWorkspace {display:block}
}
@media(max-height:550px),(max-width:500px) {
  .zenzaShare {font-size:13px}
  .zenzaShare > section,.zenzaShare header {padding:6px 10px}
  .zenzaShare nav {padding:0 8px}
  .zenzaShare .clipPages {margin-bottom:5px;gap:1px}
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
  .zenzaShare nav {gap:1px;padding-inline:4px}
  .zenzaShare nav button {padding-inline:4px}
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
<header><h2 id="zenzaShareHeading">動画を共有</h2><p class="shareTitle"></p><button type="button" data-action="close" aria-label="共有画面を閉じる">閉じる</button></header>
<nav aria-label="共有方法">
<button type="button" data-view="local" aria-controls="zenzaShareLocal">ビデオクリップ</button>
<button type="button" data-view="official" aria-controls="zenzaShareOfficial" title="ニコニコでプレビューを作成してから投稿">Xに直接投稿</button>
<button type="button" data-view="link" aria-controls="zenzaShareLink">リンク・埋め込み</button>
</nav>
<section id="zenzaShareLink" hidden>
<div class="shareRow shareTime"><label><input type="checkbox" name="includeTime"> 開始位置を指定</label>
<label><input type="number" name="start" min="0" step="0.01" inputmode="decimal"> 秒から</label></div>
<label>共有リンク<input readonly name="link" aria-label="共有リンク"></label>
<label>投稿本文<textarea rows="2"></textarea></label>
<div class="shareRow"><a class="shareAction" data-action="x" target="_blank" rel="noopener noreferrer">別タブでXの下書きを開く</a>
<button type="button" data-copy="link">リンクをコピー</button>
<button type="button" data-copy="text">本文とリンクをコピー</button>
<button type="button" data-action="system" hidden>端末で共有</button></div>
<details><summary>埋め込みコード</summary>
<label>プレーヤーのサイズ <select name="embedSize"><option value="320,180">小（320 × 180）</option><option value="640,360">中（640 × 360）</option><option value="720,480">大（720 × 480）</option></select></label>
<label>外部プレーヤー<textarea rows="3" name="embed" readonly></textarea></label>
<button type="button" data-copy="embed">プレーヤーのコードをコピー</button>
<label>動画情報とサムネイル<textarea rows="3" name="thumb" readonly></textarea></label>
<button type="button" data-copy="thumb">動画情報のコードをコピー</button></details>
<p class="shareStatus" role="status"></p></section>
<section id="zenzaShareLocal" hidden><div data-clip-editor></div>
<div class="shareProvider"><button type="button" data-action="official">Xに直接投稿する画面へ</button>
<p>ニコニコが元動画から3〜30秒の映像を作成します。確認してからXに投稿できます。</p>
<p data-provider-range hidden></p><p data-provider-layers hidden>ここで選んだコメント・画面エフェクトは、端末で作成するファイルに反映されます。</p>
</div></section>
<section id="zenzaShareOfficial" hidden><button type="button" data-action="back">‹ クリップ編集に戻る</button><p data-selection-note hidden></p><div data-official-editor></div></section>`;
    const find = selector => dialog.querySelector(selector);
    find('style').textContent = css;
    find('.shareTitle').title = find('.shareTitle').textContent = info.title || info.watchId;
    const time = find('[name=start]');
    const useTime = find('[name=includeTime]');
    const message = find('#zenzaShareLink textarea');
    const duration = Math.max(0, Math.floor(Number(info.duration) || 0));
    const startTime = Math.min(Math.max(0, Math.floor((Number(position) || 0) * 100) / 100), duration || Infinity);
    time.value = String(startTime);
    if (duration) { time.max = String(duration); }
    const tags = [info.videoId, info.isChannel && 'nicoch'].filter(Boolean).map(tag => '#' + tag);
    const length = duration ? '(' + textUtil.secToTime(duration) + ')' : '';
    message.value = [(info.title || '').replace(/@/g, '@ ') + length, ...tags].join(' ').trim();
    const watch = new URL('https://www.nicovideo.jp/watch/' + info.watchId);
    const official = new URL(watch);
    official.searchParams.set('zenza_official', '1');
    if (startTime) { official.searchParams.set('from', String(startTime)); }
    const status = find('.shareStatus');
    const link = find('[name=link]');
    const embed = find('[name=embed]');
    const thumb = find('[name=thumb]');
    const size = find('[name=embedSize]');
    const attr = value => String(value).replace(/[&<>"']/g, char =>
      ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'})[char]);
    const videoId = /^(?:[a-z]{2})?\d+$/i.test(info.videoId) ? info.videoId : info.watchId;
    const shorts = location.hostname === 'www.nicovideo.jp' && location.pathname === '/shorts/' + videoId;
    function update() {
      const url = new URL('https://www.nicovideo.jp/' + (shorts ? 'shorts/' : 'watch/') + videoId);
      const embedUrl = new URL('https://embed.nicovideo.jp/watch/' + videoId + '/script');
      const [width, height] = size.value.split(',');
      embedUrl.searchParams.set('w', width); embedUrl.searchParams.set('h', height);
      const sec = Math.min(Math.max(0, Math.round((Number(time.value) || 0) * 100) / 100), duration || Infinity);
      if (useTime.checked && sec) {
        url.searchParams.set('from', String(sec));
        embedUrl.searchParams.set('from', String(sec));
      }
      time.disabled = !useTime.checked;
      link.value = url.href;
      const title = attr(info.title || videoId);
      embed.value = '<script type="application/javascript" src="' + attr(embedUrl.href) + '"></' + 'script>' +
        '<noscript><a href="' + attr(url.href) + '">' + title + '</a></noscript>';
      thumb.value = '<iframe width="312" height="176" src="https://ext.nicovideo.jp/thumb/' + videoId +
        '" scrolling="no" style="border:solid 1px #ccc;" frameborder="0"><a href="' + attr(watch.href) + '">' +
        title + '</a></iframe>';
      const draftLink = find('[data-action=x]');
      const intent = new URL('https://x.com/intent/tweet');
      intent.searchParams.set('text', message.value);
      intent.searchParams.set('url', url.href);
      draftLink.href = intent.href;
      status.textContent = '';
    }
    find('[data-action=x]').addEventListener('click', update);
    for (const input of [time, useTime, message, size]) { input.addEventListener('input', update); }
    time.addEventListener('change', () => {
      time.value = String(Math.min(Math.max(0, Math.round((Number(time.value) || 0) * 100) / 100), duration || Infinity));
      update();
    });
    for (const button of dialog.querySelectorAll('[data-copy]')) {
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
    const mounted = new Map();
    const sections = {link:find('#zenzaShareLink'), official:find('#zenzaShareOfficial'), local:find('#zenzaShareLocal')};
    const provider = find('.shareProvider');
    const prepare = find('[data-action=official]');
    const rangeNote = find('[data-provider-range]');
    let selection = {};
    function showSelection(next) {
      selection = next;
      provider.hidden = next.isFile;
      find('[data-view=official]').disabled = prepare.disabled = next.recording;
      find('[data-view=link]').disabled = next.recording;
      const length = next.end - next.start;
      prepare.textContent = length > 30 ? '先頭30秒をXに直接投稿する画面へ' : 'Xに直接投稿する画面へ';
      rangeNote.hidden = !(length > 30 || length < 3);
      rangeNote.textContent = length > 30 ? 'ニコニコには選択範囲の先頭30秒を渡します。' :
        'ニコニコでの投稿には3秒以上の範囲を指定してください。';
      find('[data-provider-layers]').hidden = !next.comments && !next.effects;
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
    function select(view) {
      if (view === 'link') {
        update();
        releasePlayback();
      } else holdPlayback();
      if (view !== 'local') { mounted.get('local')?.stopPreview?.(); }
      if (view !== 'official' && mounted.has('official')) {
        mounted.get('official')();
        mounted.delete('official');
        find('[data-official-editor]').replaceChildren();
      }
      for (const [key, el] of Object.entries(sections)) { el.hidden = key !== view; }
      for (const btn of dialog.querySelectorAll('[data-view]')) {
        btn.setAttribute('aria-pressed', String(btn.dataset.view === view));
      }
      if (view === 'official' && !mounted.has(view)) {
        const note = find('[data-selection-note]');
        if (selection.isFile) {
          note.textContent = 'ニコニコ連携で投稿できるのは視聴ページの元動画です。選んだファイルはクリップ編集で作成し、完成した動画からXに添付できます。';
          note.hidden = false;
          return;
        }
        const start = Number.isFinite(selection.start) ? selection.start : startTime;
        const end = Number.isFinite(selection.end) ? Math.min(selection.end, start + 30) : undefined;
        const lengthMs = Math.round(selection.end * 1000) - Math.round(selection.start * 1000);
        const differences = [];
        if (lengthMs > 30000) differences.push('公式クリップの初期範囲は選択区間の先頭30秒です。');
        else if (lengthMs < 3000) differences.push('公式クリップには3秒以上の区間を指定してください。');
        if (selection.comments || selection.effects) differences.push('コメント表示はニコニコ側の設定になり、ZenzaWatchの画面エフェクトは含まれません。');
        if (lengthMs > 30000 || selection.comments || selection.effects) differences.push('元の編集内容を使うには、クリップ編集に戻ってください。');
        note.textContent = differences.join('');
        note.hidden = !differences.length;
        officialClipService ||= createOfficialClipService();
        mounted.set(view, officialClipService.mount(find('[data-official-editor]'), {
          info, startTime:start, endTime:end,
          text:() => message.value, officialUrl:official.href,
          onUseLocal(range) {
            select('local');
            sections.local.querySelector('[data-editor-page=range]')?.click();
            const valid = mounted.get('local')?.setRange?.(range);
            const create = sections.local.querySelector('[data-action=create]');
            if (valid && create && !create.disabled) {
              create.click();
            } else {
              find('[data-view=local]').focus({preventScroll:true});
            }
          }
        }));
      }
      if (view === 'local' && !mounted.has(view)) {
        mounted.set(view, ShareLocalClip.mount(find('[data-clip-editor]'), {
          qualityConfig:playerContext?.config,
          onBackgroundFinish:message => PopupMessage.notify(message),
          onOpenOfficial:button => openOfficial(button),
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
          getShareText: () => [message.value, link.value].filter(Boolean).join('\n')
        }));
      }
      const providerSlot = sections.local.querySelector('[data-provider-slot]');
      if (providerSlot && provider.parentNode !== providerSlot) providerSlot.append(provider);
      if (view === 'local') mounted.get('local')?.startPreview?.();
      dialog.scrollTop = 0;
    }
    let officialOpener;
    function openOfficial(button) {
      officialOpener = button;
      select('official');
      find('[data-action=back]').focus();
    }
    prepare.onclick = () => openOfficial(prepare);
    find('[data-action=back]').onclick = () => { select('local'); officialOpener?.focus(); };
    for (const btn of dialog.querySelectorAll('[data-view]')) {
      btn.onclick = () => btn.dataset.view === 'official' ? openOfficial(btn) : select(btn.dataset.view);
    }
    const previousFocus = document.activeElement;
    function close() {
      if (activeClose !== close) { return; }
      activeClose = null;
      for (const cleanup of mounted.values()) { if (typeof cleanup === 'function') { cleanup(); } }
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
    update();
    dialog.showModal();
    window.dispatchEvent(new Event('zenza-share-panel-open'));
    select('local');
  }
  return {open, close() { if (activeClose) { activeClose(); } }};
}

const VideoSharePanel = (() => {
  let panel, loading, requested;
  function ready(instance) {
    loading = null;
    panel = instance;
    const args = requested;
    requested = null;
    if (args) panel.open(...args);
  }
  return {
    open(...args) {
      if (panel) return panel.open(...args);
      requested = args;
      if (loading) return;
      const instance = createVideoSharePanel();
      if (typeof instance?.then !== 'function') return ready(instance);
      loading = instance.then(ready,() => {
        loading = null;
        const showError = !!requested;
        requested = null;
        if (showError) PopupMessage.alert('共有画面を読み込めませんでした。もう一度開いてください。');
      });
    },
    close() {
      requested = null;
      panel?.close();
    }
  };
})();
//===END===
export {VideoSharePanel};
