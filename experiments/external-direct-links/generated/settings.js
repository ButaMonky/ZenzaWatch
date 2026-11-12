"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.externalDescriptors = exports.externalDefaults = void 0;
exports.sanitizeExternal = sanitizeExternal;
exports.readExternal = readExternal;
exports.siteEnabled = siteEnabled;
const site_rules_1 = require("./site-rules");
exports.externalDefaults = {
    'externalLinks.enabled': true,
    'externalLinks.siteMode': 'all',
    'externalLinks.sites': '',
    'externalLinks.excludedSites': '',
    'externalLinks.displayMode': 'inline',
    'externalLinks.size': 'small',
    'externalLinks.redirects': false,
    'externalLinks.textIds': false,
    'externalLinks.prefixes': 'sm\nnm\nso\nss',
    'externalLinks.preflight': 'off'
};
const choice = (items) => items.map(([value, label]) => ({ value, label }));
exports.externalDescriptors = [
    { id: 'externalLinks.enabled', label: '外部サイトでZenボタンを使う', type: 'boolean' },
    { id: 'externalLinks.siteMode', label: '対象サイト', type: 'select', inputPresentation: 'radio', options: choice([['all', 'すべてのサイト'], ['allow', '指定したサイトのみ']]) },
    { id: 'externalLinks.sites', label: '対象サイト', type: 'textarea', dependsOn: 'externalLinks.siteMode', dependsOnValue: 'allow', disabledReason: '「指定したサイトのみ」を選ぶと編集できます。', addCurrentSite: true, description: '1行に1件。ドメインを指定すると、そのサブドメインも対象になります。', descriptionDetails: '例：example.com は本体とサブドメインの全ページ。https://example.com/watch/* はそのURLのwatch配下だけ。* は任意の文字列です。HTTPSページで動作し、URLの#以降は判定しません。変更後はページを再読み込みしてください。' },
    { id: 'externalLinks.excludedSites', label: '除外サイト', type: 'textarea', description: '対象サイトと同じ書き方で1行に1件。除外を優先します。', descriptionDetails: '「すべてのサイト」でも適用します。空欄なら除外なし。例：https://example.com/private/* を指定すると、そのURLの配下ではZenボタンを表示しません。' },
    { id: 'externalLinks.displayMode', label: 'Zenボタンの表示方法', type: 'select', description: 'リンクの横・マウス・文字選択から選びます。', descriptionDetails: '「常に表示」は対象リンクの横にボタンを配置します。サイトによっては改行や配置が変わるため、その場合は「マウスを置いたときに表示」を選んでください。文章中の動画IDはマウスを置くか、文字を選択すると表示します。', options: choice([['inline', '常に表示（リンクの横に配置）'], ['hover', 'マウスを置いたときに表示'], ['selection', '文字を選択したときに表示']]) },
    { id: 'externalLinks.size', label: 'ボタンの大きさ', type: 'select', options: choice([['small', '小'], ['normal', '標準'], ['large', '大']]) },
    { id: 'externalLinks.redirects', label: '中継リンク内の動画URLも検出', type: 'boolean', description: 'リンクを開かず、埋め込まれたニコニコ動画URLを調べます。' },
    { id: 'externalLinks.textIds', label: '文章中の動画IDも検出', type: 'boolean', description: '入力欄・編集中・コード欄は対象外です。' },
    { id: 'externalLinks.prefixes', label: '検出する動画IDの接頭辞', type: 'textarea', description: '1行に1種類。初期値はsm・nm・so・ssです。', descriptionDetails: '数字やワイルドカードは付けず、英小文字2〜8文字だけを入力してください。例：smを登録するとsm12345を検出します。空白・カンマ区切りも使用できます。検出対象への追加は、本体での再生対応を保証するものではありません。事前通信は下の「再生情報の事前確認」で選択します。' },
    { id: 'externalLinks.preflight', label: '再生情報の事前確認', type: 'select', description: '既定は追加通信なし。確認するタイミングを選べます。', descriptionDetails: '確認しない：追加通信なし。Zenを押したとき：起動前に確認。ボタン表示前：見えている候補を順に確認（通信が増えます）。動画情報から判断するため、実際の再生成功までは保証しません。通信失敗や不明な応答では再生不可と決めつけず、通常の起動を試せます。結果は最大5分、100件まで一時保持し、同時確認は2件までです。', options: choice([['off', '確認しない（追加通信なし）'], ['click', 'Zenを押したときに確認'], ['display', 'ボタンを表示する前に確認']]) }
].map(d => ({ ...d, category: '外部サイトからの再生', subcategory: '基本設定', dependsOn: d.id === 'externalLinks.enabled' ? undefined : ('dependsOn' in d ? d.dependsOn : 'externalLinks.enabled') }));
const tokens = (v) => typeof v === 'string' ? v.trim().toLowerCase().split(/[\s,]+/).filter(Boolean) : [];
function sanitizeExternal(values) {
    const source = values && typeof values === 'object' ? values : {};
    const out = { ...exports.externalDefaults };
    for (const key of Object.keys(out)) {
        const value = source[key];
        if (typeof value === typeof out[key])
            out[key] = typeof value === 'string' ? value.slice(0, 4096) : value;
    }
    for (const [key, valid] of [['externalLinks.preflight', ['off', 'click', 'display']], ['externalLinks.siteMode', ['all', 'allow']], ['externalLinks.displayMode', ['inline', 'hover', 'selection']], ['externalLinks.size', ['small', 'normal', 'large']]])
        if (!valid.includes(String(out[key])))
            out[key] = exports.externalDefaults[key];
    return out;
}
function readExternal(values) {
    const v = sanitizeExternal(values);
    return { enabled: v['externalLinks.enabled'] === true, siteMode: String(v['externalLinks.siteMode']), sites: (0, site_rules_1.siteRules)(v['externalLinks.sites']), excludedSites: (0, site_rules_1.siteRules)(v['externalLinks.excludedSites']), preflight: String(v['externalLinks.preflight']), activation: String(v['externalLinks.displayMode']), size: String(v['externalLinks.size']), redirects: v['externalLinks.redirects'] === true, textIds: v['externalLinks.textIds'] === true, prefixes: [...new Set(tokens(v['externalLinks.prefixes']).filter(x => /^[a-z]{2,8}$/.test(x)))] };
}
function siteEnabled(host, s) {
    const matches = (rule) => (0, site_rules_1.matchesSiteRule)(rule, host);
    return s.enabled && !s.excludedSites.some(matches) && (s.siteMode === 'all' || s.sites.some(matches));
}
