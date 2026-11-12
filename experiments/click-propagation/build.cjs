'use strict';
// Reversible experiment: reuse the current published player and change only
// click propagation and trial identification. Never migrate saved preferences.
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '../..');
const output = path.join(__dirname, 'ZenzaWatch-click-propagation-trial.user.js');
const url = 'https://raw.githubusercontent.com/ButaMonky/ZenzaWatch/experiment/click-propagation1018/experiments/click-propagation/ZenzaWatch-click-propagation-trial.user.js';
function once(source, pattern, replacement) {
  const matches = [...source.matchAll(new RegExp(pattern.source, 'gm'))];
  if (matches.length !== 1) throw Error('Trial anchor changed: ' + pattern);
  return source.replace(pattern, replacement);
}
function build(source) {
  const helper = require('node:module').stripTypeScriptTypes(fs.readFileSync(path.join(__dirname, 'ClickNavigationTrial.ts'), 'utf8'));
  let result = once(source, /class HoverMenu \{/, helper + '\nClickNavigationTrial.install(window);\nclass HoverMenu {');
  const start = result.indexOf('this._pagePreviewGuard?.claim(target);');
  const tail = "window.setTimeout(() => ZenzaWatch.emitter.emit('hideHover'), 1500);";
  const end = result.indexOf(tail, start) + tail.length;
  if (start < 0 || end < start || result.indexOf('this._pagePreviewGuard?.claim(target);', start + 1) !== -1) throw Error('Trial handler anchor changed');
  const old = result.slice(start, end);
  if (!old.includes('e.stopImmediatePropagation();') || !old.includes('const propagate =')) throw Error('Trial handler anchor changed');
  result = result.slice(0, start) + `ClickNavigationTrial.begin(window, e, watchId, () => {
    this._pagePreviewGuard?.claim(target);
    this._query = nicoUtil.parseWatchQuery(url.search.substr(1));
    if (e.shiftKey) { this._send(watchId); } else { this._open(watchId); }
    window.setTimeout(() => ZenzaWatch.emitter.emit('hideHover'), 1500);
  });` + result.slice(end);
  result = once(result, /^\/\/ @version\s+.*$/m, '// @version        2.7.392-click1018.3');
  result = once(result, /^\/\/ @description\s+.*$/m, '// @description    クリック伝播の検証版。通常版の再インストールで元に戻せます。');
  for (const key of ['downloadURL', 'updateURL']) {
    result = once(result, new RegExp('^// @' + key + '\\s+.*$', 'm'), '// @' + key + '    ' + url);
  }
  result = once(result, /既読記録などの連携用。ONにすると、サイト側の処理によって公式プレイヤーも開く場合があります。通常はOFFで使用してください。/,
    'この検証版では、このスイッチの保存値にかかわらずクリックを伝播します。元に戻すには通常版を再インストールしてください。保存値は変更しません。');
  // Keep the visible player version aligned with the userscript metadata.
  result = result.replaceAll('2.7.392-task1017', '2.7.392-click1018.3');
  return result;
}
if (require.main === module) {
  fs.writeFileSync(output, build(fs.readFileSync(path.join(root, 'dist/ZenzaWatch-dev.user.js'), 'utf8')));
  console.log('TRIAL_READY ' + output);
}
module.exports = {build};
