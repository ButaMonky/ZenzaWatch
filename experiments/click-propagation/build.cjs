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
  let result = once(source,
    /const propagate = this\._playerConfig\?\.getValue\?\.\('overrideWatchLink:allowPropagation'\) \?\?\s*this\._playerConfig\?\.props\?\.\['overrideWatchLink:allowPropagation'\];/,
    'const propagate = true; // click-propagation1018: trial only; no saved-setting changes');
  result = once(result, /^\/\/ @version\s+.*$/m, '// @version        2.7.392-click1018.1');
  result = once(result, /^\/\/ @description\s+.*$/m, '// @description    クリック伝播の検証版。通常版の再インストールで元に戻せます。');
  for (const key of ['downloadURL', 'updateURL']) {
    result = once(result, new RegExp('^// @' + key + '\\s+.*$', 'm'), '// @' + key + '    ' + url);
  }
  result = once(result, /既読記録などの連携用。ONにすると、サイト側の処理によって公式プレイヤーも開く場合があります。通常はOFFで使用してください。/,
    'この検証版では、このスイッチの保存値にかかわらずクリックを伝播します。元に戻すには通常版を再インストールしてください。保存値は変更しません。');
  // Keep the visible player version aligned with the userscript metadata.
  result = result.replaceAll('2.7.392-task1017', '2.7.392-click1018.1');
  return result;
}
if (require.main === module) {
  fs.writeFileSync(output, build(fs.readFileSync(path.join(root, 'dist/ZenzaWatch-dev.user.js'), 'utf8')));
  console.log('TRIAL_READY ' + output);
}
module.exports = {build};
