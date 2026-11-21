/**
 * Canonical TypeScript source for src/NicoVideoPlayerDialogNicoadEnd.js (Task1060: NicoVideoPlayerDialog.ts から役割ごとに分割).
 * 動画の終わりに出す、ニコニ広告した人の一覧（終了画面）。
 * NicoVideoPlayerDialog.prototype へそのまま取り付ける（クラスのメソッドと同じく列挙されない）。
 */
/**
 * Values that come from raw API/DOM records or from modules that are still JS; this one
 * documented loose alias covers them.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = any;
// Task1060: 本体のクラス（実行時は同じスコープにある）。
type Dialog = import('./NicoVideoPlayerDialog').NicoVideoPlayerDialog;
declare const NicoVideoPlayerDialog: typeof import('./NicoVideoPlayerDialog').NicoVideoPlayerDialog;
// legacy-to-ts: names provided by other bundled modules
declare const RequestDiagnostics: typeof import('./RequestDiagnostics').RequestDiagnostics;
declare const _: import('./shared-types/Lodash').LodashSubset;

/** 動画の終わりに出す、ニコニ広告した人の一覧（終了画面）。 */
const NicoVideoPlayerDialogNicoadEnd = {
  async _showNicoadEndScreen(this: Dialog) {
    const props = this._playerConfig?.props || {};
    if (!props['uaa.enable'] || props['nicoadEnd.enable'] === false) { return; }
    if (NicoVideoPlayerDialog.isExternalPlayback()) { return; }
    const videoInfo = this._videoInfo;
    const parent = this._nicoVideoPlayer?._videoPlayer?._body;
    if (!videoInfo || !parent || this._nicoVideoPlayer?._videoPlayer?._isYouTube) { return; }
    const videoId = videoInfo.videoId;
    if (!/^[a-z]{2}\d+$/.test(String(videoId))) { return; }
    const requestId = this._requestId;
    const tags = (videoInfo.tagList || []).map((t: Loose) => t && (t.name || t.tag || t.text))
      .filter((t: Loose) => typeof t === 'string' && t).slice(0, 30);
    const url = 'https://api.nicoad.nicovideo.jp/v1/nicoad?frameId=12&limit=10' +
      '&tags=' + encodeURIComponent(tags.join(',')) + '&excludeVideoIds=' + encodeURIComponent(videoId) +
      '&allowSensitiveContents=true&decoration=video';
    const diagnostic = typeof RequestDiagnostics === 'undefined' ? null :
      RequestDiagnostics.begin('nicoad-end', videoId, 'response', () => this._requestId === requestId, undefined, {url, method:'GET'});
    let items: Loose[] = [];
    let res: Response | undefined;
    try {
      res = await fetch(url, {credentials: 'include', headers: {'x-frontend-id': '6', 'x-frontend-version': '0'}});
      if (!res.ok) { diagnostic?.response(res); return; }
      const body = await res.json();
      const valid = Array.isArray(body?.data?.nicoads);
      diagnostic?.decoded(res, body?.meta, valid ? undefined : 'data.nicoads', false);
      if (!valid) return;
      items = NicoVideoPlayerDialog.nicoadEndItems(body);
    } catch (e) { diagnostic?.failure(RequestDiagnostics.readFailure(res, e)); return; }
    // 待っている間に再生・別の動画・閉じる操作があったら出さない。
    if (this._requestId !== requestId || !this._state?.isEnded || this.isPlaying || !items.length) { return; }
    this._hideNicoadEndScreen();
    NicoVideoPlayerDialog.ensureNicoadEndStyle();
    const view = document.createElement('div');
    view.className = 'zenzaNicoadEnd';
    view.setAttribute('role', 'region');
    view.setAttribute('aria-label', 'ニコニ広告された動画');
    const header = document.createElement('div');
    header.className = 'zenzaNicoadEnd-header';
    const title = document.createElement('span');
    title.textContent = 'ニコニ広告';
    const close = document.createElement('button');
    close.type = 'button'; close.className = 'zenzaNicoadEnd-close'; close.textContent = '×';
    close.title = '閉じる';
    close.addEventListener('click', e => { e.stopPropagation(); this._hideNicoadEndScreen(); });
    header.append(title, close);
    const list = document.createElement('div');
    list.className = 'zenzaNicoadEnd-list';
    for (const item of items) {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'zenzaNicoadEnd-item' + (item.decoration ? ' is-' + item.decoration : '');
      card.title = item.title;
      const thumb = document.createElement('div');
      thumb.className = 'zenzaNicoadEnd-thumb' + (item.mask ? ' is-mask' : '');
      if (item.thumbnail) { thumb.style.backgroundImage = 'url("' + item.thumbnail.replace(/["\\]/g, '') + '")'; }
      const name = document.createElement('div');
      name.className = 'zenzaNicoadEnd-title'; name.textContent = item.title;
      const by = document.createElement('div');
      by.className = 'zenzaNicoadEnd-by'; by.textContent = '提供：' + item.supporter;
      const pt = document.createElement('div');
      pt.className = 'zenzaNicoadEnd-pt'; pt.textContent = item.point.toLocaleString('ja-JP') + 'pt';
      card.append(thumb, name, by, pt);
      card.addEventListener('click', e => {
        e.stopPropagation();
        this._hideNicoadEndScreen();
        this.open(item.id, {openNow: true});
      });
      list.append(card);
    }
    view.append(header, list);
    for (const type of ['mousedown', 'dblclick', 'wheel']) {
      view.addEventListener(type, e => e.stopPropagation());
    }
    parent.append(view);
    this._nicoadEnd = view;
  },
  _hideNicoadEndScreen(this: Dialog) {
    const view = this._nicoadEnd;
    this._nicoadEnd = null;
    try { view?.remove(); } catch (_) { /* noop */ }
  },
};

export {NicoVideoPlayerDialogNicoadEnd};
