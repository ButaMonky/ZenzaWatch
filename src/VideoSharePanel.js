import {ShareOfficialClip} from './ShareOfficialClip';
import {textUtil} from '../packages/lib/src/text/textUtil';
import {ShareClipRenderer} from './ShareClipRenderer';
import {ShareLocalClip} from './ShareLocalClip';
import {SharePlaybackFile} from './SharePlaybackFile';
//===BEGIN===
//@require ShareOfficialClip
//@require ShareLocalClip
//@require SharePlaybackFile
//@require ShareClipRenderer
const VideoSharePanel = (() => {
  let activeClose;
  const css = `
.zenzaShare {color-scheme:dark;color:#f2f5f8;background:#1d2229;border:1px solid #526175;
  border-radius:12px;width:min(35rem,94vw);max-width:94vw;max-height:88vh;box-sizing:border-box;
  margin:auto;padding:0;text-align:left;overflow:auto;font:14px/1.5 system-ui,sans-serif;box-shadow:0 12px 44px #0009}
.zenzaShare {width:min(33rem,calc(100vw - 24px));max-height:calc(100dvh - 24px);margin:auto 12px auto auto;
  background:#1b2027;scrollbar-width:thin;overscroll-behavior:contain}
.zenzaShare::backdrop {background:#090c104d}
.zenzaShare .shareProvider {border-top:1px solid #465365;padding-top:.65rem;margin-top:.9rem}
.zenzaShare summary {cursor:pointer}
.zenzaShare .shareProvider p {color:#c1ccd7}
.zenzaShare [data-action=back] {margin-bottom:.5rem}
@media(max-width:600px) {.zenzaShare {width:calc(100vw - 12px);max-width:none;max-height:calc(100dvh - 12px);margin:auto}}

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
`;
  function open(info, position, getCurrentVideo, playerContext) {
    if (!info || !/^(?:[a-z]{2})?\d+$/i.test(info.watchId)) { return; }
    if (activeClose) { activeClose(); }
    const dialog = document.createElement('dialog');
    dialog.className = 'zen-family zenzaShare';
    dialog.setAttribute('aria-labelledby', 'zenzaShareHeading');
    dialog.innerHTML = `
<style></style>
<header><h2 id="zenzaShareHeading">動画を共有</h2><button type="button" data-action="close" aria-label="共有画面を閉じる">閉じる</button></header>
<p class="shareTitle"></p>
<nav aria-label="共有方法">
<button type="button" data-view="local" aria-controls="zenzaShareLocal">ビデオクリップ</button>
<button type="button" data-view="link" aria-controls="zenzaShareLink">リンク・埋め込み</button>
</nav>
<section id="zenzaShareLink" hidden>
<div class="shareRow shareTime"><label><input type="checkbox" name="includeTime"> 開始位置を指定</label>
<label><input type="number" name="start" min="0" step="0.01" inputmode="decimal"> 秒から</label></div>
<label>共有リンク<input readonly name="link" aria-label="共有リンク"></label>
<label>投稿本文<textarea rows="2"></textarea></label>
<div class="shareRow"><a class="shareAction" data-action="x" target="_blank" rel="noopener noreferrer">X で投稿画面を開く</a>
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
<div class="shareProvider"><button type="button" data-action="official">ニコニコでX用プレビューを作成</button>
<p>ニコニコが元動画から3〜30秒の映像を作ります。端末での録画や添付を省き、映像を確認してから投稿できます。</p>
<p data-provider-range hidden></p><p data-provider-layers hidden>ここで選んだコメント・画面エフェクトは、端末で作成するファイルに反映されます。</p>
</div></section>
<section id="zenzaShareOfficial" hidden><button type="button" data-action="back">‹ クリップ編集に戻る</button><div data-official-editor></div></section>`;
    const find = selector => dialog.querySelector(selector);
    find('style').textContent = css;
    find('.shareTitle').textContent = info.title || info.watchId;
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
      const intent = new URL('https://twitter.com/intent/tweet');
      intent.searchParams.set('text', message.value);
      intent.searchParams.set('url', url.href);
      find('[data-action=x]').href = intent.href;
      status.textContent = '';
    }
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
      prepare.disabled = next.recording;
      find('[data-view=link]').disabled = next.recording;
      const length = next.end - next.start;
      prepare.textContent = length > 30 ? 'ニコニコで先頭30秒のX用プレビューを作成' : 'ニコニコでX用プレビューを作成';
      rangeNote.hidden = !(length > 30 || length < 3);
      rangeNote.textContent = length > 30 ? 'ニコニコには選択範囲の先頭30秒を渡します。' :
        'ニコニコでの投稿には3秒以上の範囲を指定してください。';
      find('[data-provider-layers]').hidden = !next.comments && !next.effects;
    }
    function select(view) {
      if (view !== 'local') { mounted.get('local')?.stopPreview?.(); }
      if (view !== 'official' && mounted.has('official')) {
        mounted.get('official')();
        mounted.delete('official');
        find('[data-official-editor]').replaceChildren();
      }
      for (const [key, el] of Object.entries(sections)) { el.hidden = key !== view; }
      for (const btn of dialog.querySelectorAll('[data-view]')) {
        btn.setAttribute('aria-pressed', String(btn.dataset.view === (view === 'official' ? 'local' : view)));
      }
      if (view === 'official' && !mounted.has(view)) {
        const start = Number.isFinite(selection.start) ? selection.start : startTime;
        const end = Number.isFinite(selection.end) ? Math.min(selection.end, start + 30) : undefined;
        mounted.set(view, ShareOfficialClip.mount(find('[data-official-editor]'), {
          info, startTime:start, endTime:end, autoPreview:true, text:() => message.value, officialUrl:official.href,
          onUseLocal(range) {
            select('local');
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
          title:info.title, startTime, getCurrentVideo, seekCurrentVideo:playerContext?.seekCurrentVideo,
          getThumbnail:playerContext?.getThumbnail, clipSession:playerContext?.clipSession, onSelectionChange:showSelection,
          getCurrentFile(video, signal) {
            const src = playerContext?.getCurrentFileSource?.(video);
            if (!src) return Promise.resolve(null);
            return SharePlaybackFile.get(video, src, {
              signal, isCurrent:() => playerContext.getCurrentFileSource(video) === src
            });
          },
          createFrameRenderer: options => ShareClipRenderer.create({...playerContext, ...options}),
          getShareText: () => [message.value, link.value].filter(Boolean).join('\n')
        }));
      }
      dialog.scrollTop = 0;
    }
    prepare.onclick = () => { select('official'); find('[data-action=back]').focus(); };
    find('[data-action=back]').onclick = () => { select('local'); prepare.focus(); };
    for (const btn of dialog.querySelectorAll('[data-view]')) { btn.onclick = () => select(btn.dataset.view); }
    const previousFocus = document.activeElement;
    function close() {
      if (activeClose !== close) { return; }
      activeClose = null;
      for (const cleanup of mounted.values()) { if (typeof cleanup === 'function') { cleanup(); } }
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
    select('local');
  }
  return {open, close() { if (activeClose) { activeClose(); } }};
})();
//===END===
export {VideoSharePanel};
