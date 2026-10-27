import {ZenzaWatch} from '../../../../src/ZenzaWatchIndex';

//===BEGIN===
/*
 * Task 088（監査v2 ZW-085）: 以前は動画のタイトル等を、保存する HTML の <h2> と <title> へそのまま差し込んでいた
 * （「titleはエスケープされてる」とコメントにあったが、今の VideoInfo.title は元の文字列を返す）。
 * タイトルに < > & " を含むと、保存した HTML の中で要素・属性として解釈されてしまう。
 * HTML に入れる文字はすべてエスケープし、置き換えは関数で行う（$& 等の特殊な記号を置き換えの指示として解釈させない）。
 */
const saveMymemory = (player, videoInfo) => {
  const escapeHtml = text => String(text == null ? '' : text).replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;'
  })[ch]);
  const rawTitle = String(videoInfo.title == null ? '' : videoInfo.title);
  const watchId = String(videoInfo.watchId == null ? '' : videoInfo.watchId);
  const from = Math.floor(player.currentTime) || 0;
  const info = (`
    <div>
      <h2>${escapeHtml(rawTitle)}</h2>
      <a href="//www.nicovideo.jp/watch/${escapeHtml(encodeURIComponent(watchId))}?from=${from}">元動画</a><br>
      作成環境: ${escapeHtml(navigator.userAgent)}<br>
      作成日: ${escapeHtml((new Date()).toLocaleString())}<br>
      ZenzaWatch: ver${escapeHtml(ZenzaWatch.version)} (${escapeHtml(ZenzaWatch.env)})<br>

      <button
        onclick="document.body.classList.toggle('debug');return false;">
        デバッグON/OFF
      </button>
    </div>
  `).trim();
  const title = `${watchId} - ${rawTitle}`;
  const html = player.getMymemory()
    .replace(/<title>(.*?)<\/title>/, () => `<title>${escapeHtml(title)}</title>`)
    .replace(/(<body.*?>)/, (m, body) => body + info);

  // ファイル名に使えない文字（パスの区切り等）と制御文字は _ にする
  const fileName = `${title.replace(/[\\/:*?"<>|\u0000-\u001f\u007f]/g, '_').trim() || watchId || 'mymemory'}.html`;
  const blob = new Blob([html], {'type': 'text/html'});
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), {
    download: fileName,
    href: url,
    rel: 'noopener'
  });
  document.body.append(a);
  a.click();
  window.setTimeout(() => {
    a.remove();
    URL.revokeObjectURL(url);
  }, 1000);
};
//===END===

export {saveMymemory};