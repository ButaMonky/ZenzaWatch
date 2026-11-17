// Task1060: NicoVideoPlayerDialog は役割ごとのファイルに分割した。クラスだけを取り出して動かすテストは、
// このファイルの roleInstallSource() をクラスの直後に足すと、本番と同じ形でメソッドが取り付けられる。
import fs from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';

export const DIALOG_ROLES = Object.freeze([
  'NicoVideoPlayerDialogPrefetch', 'NicoVideoPlayerDialogPlaylistSources', 'NicoVideoPlayerDialogComments',
  'NicoVideoPlayerDialogResume', 'NicoVideoPlayerDialogUserActions', 'NicoVideoPlayerDialogNotifications',
  'NicoVideoPlayerDialogNicoadEnd', 'NicoVideoPlayerDialogCommands'
]);
// Task1063: NicoVideoPlayerDialogView も同じ形で役割ごとに分けた。
export const VIEW_ROLES = Object.freeze([
  'NicoVideoPlayerDialogViewSmallMode', 'NicoVideoPlayerDialogViewBookmarks', 'NicoVideoPlayerDialogViewFeedback'
]);
/** クラス名 → 取り付ける役割（本体の for 文と同じ順番） */
export const CLASS_ROLES = Object.freeze({NicoVideoPlayerDialog: DIALOG_ROLES, NicoVideoPlayerDialogView: VIEW_ROLES});
const strip = name => stripTypeScriptTypes(fs.readFileSync(new URL(`../nico-src/${name}.ts`, import.meta.url), 'utf8'), {mode: 'strip'});

/** 役割オブジェクトの定義（型を外した JS）。 */
export function roleObjectSource(name) {
  const text = strip(name);
  const start = text.indexOf(`const ${name} = {`);
  const end = text.indexOf('\n};', start);
  if (start < 0 || end < 0) throw Error(name + ' role object missing');
  return text.slice(start, end + 3);
}

/** クラス NicoVideoPlayerDialog が定義された後に実行する JS（役割の定義と取り付け）。 */
export function roleInstallSource(className = 'NicoVideoPlayerDialog') {
  const roles = CLASS_ROLES[className] || [];
  if (!roles.length) { return ''; }
  return '\n;' + roles.map(roleObjectSource).join('\n') +
    `\nfor (const role of [${roles.join(', ')}]) {` +
    `\n  for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(role))) {` +
    `\n    Object.defineProperty(${className}.prototype, key, {...descriptor, enumerable: false});` +
    `\n  }\n}\n`;
}

/** 分割前と同じように、本体と分割先をまとめた TS の全文（文字列で検査するテスト用）。 */
export function dialogFamilyText({stripTypes = false} = {}) {
  const names = ['NicoVideoPlayerDialog', 'NicoVideoPlayerDialogView', 'VariablesMapper', 'VideoHoverMenu', ...DIALOG_ROLES, ...VIEW_ROLES];
  return names.map(name => {
    const text = fs.readFileSync(new URL(`../nico-src/${name}.ts`, import.meta.url), 'utf8');
    return stripTypes ? stripTypeScriptTypes(text, {mode: 'strip'}) : text;
  }).join('\n');
}

// Task1063: 分割した大きなモジュール（元の名前 → 分割先）。文字列で調べるテストは元の名前で全体を読める。
export const SPLIT_MODULES = Object.freeze({
  NicoVideoPlayerDialog: ['NicoVideoPlayerDialogView', 'VideoHoverMenu', ...DIALOG_ROLES],
  NicoVideoPlayerDialogView: ['VariablesMapper', ...VIEW_ROLES],
  VideoInfoPanel: ['VideoHeaderPanel', 'VideoSearchForm', 'UaaView', 'RelatedInfoMenu', 'VideoMetaInfo'],
  VideoControlBar: ['CommentPreview', 'SeekBarToolTip', 'SmoothSeekBarPointer'],
});
const expandFamily = name => [name, ...(SPLIT_MODULES[name] || []).flatMap(expandFamily)];
/** 'nico-src/X.ts' を読む。X が分割した元のモジュールなら、分割先も含めた全文を返す。 */
export function readNicoFamily(rel) {
  const m = rel.match(/^nico-src\/([A-Za-z]+)\.ts$/);
  const names = m && SPLIT_MODULES[m[1]] ? expandFamily(m[1]) : null;
  if (!names) { return fs.readFileSync(new URL('../' + rel, import.meta.url), 'utf8'); }
  return names.map(n => fs.readFileSync(new URL(`../nico-src/${n}.ts`, import.meta.url), 'utf8')).join('\n');
}
