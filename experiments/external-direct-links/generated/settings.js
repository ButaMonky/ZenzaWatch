"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.externalDescriptors = exports.externalDefaults = void 0;
exports.sanitizeExternal = sanitizeExternal;
exports.readExternal = readExternal;
exports.siteEnabled = siteEnabled;
exports.externalDefaults = {
    'externalLinks.enabled': true,
    'externalLinks.siteMode': 'all',
    'externalLinks.sites': '',
    'externalLinks.excludedSites': '',
    'externalLinks.activation': 'hover',
    'externalLinks.size': 'small',
    'externalLinks.redirects': false,
    'externalLinks.textIds': false,
    'externalLinks.prefixes': 'sm nm so ss'
};
const choice = (items) => items.map(([value, label]) => ({ value, label }));
exports.externalDescriptors = [
    { id: 'externalLinks.enabled', label: '外部サイトでZenボタンを使う', type: 'boolean' },
    { id: 'externalLinks.siteMode', label: '対象サイト', type: 'select', options: choice([['all', 'すべてのサイト'], ['allow', '指定したサイトのみ']]) },
    { id: 'externalLinks.sites', label: '対象のドメイン', type: 'text', description: '例：example.com。空白・改行・カンマで区切ります。サブドメインも含みます。' },
    { id: 'externalLinks.excludedSites', label: '除外するドメイン', type: 'text', description: '除外を優先します。URLではなくドメインを入力してください。' },
    { id: 'externalLinks.activation', label: 'ボタンを表示するタイミング', type: 'select', options: choice([['hover', 'マウスを置いたとき・キーボードでフォーカスしたとき'], ['selection', '文字を選択したとき']]) },
    { id: 'externalLinks.size', label: 'ボタンの大きさ', type: 'select', options: choice([['small', '小'], ['normal', '標準'], ['large', '大']]) },
    { id: 'externalLinks.redirects', label: '中継リンク内の動画URLも検出', type: 'boolean', description: 'リンクを開かず、埋め込まれたニコニコ動画URLを調べます。' },
    { id: 'externalLinks.textIds', label: '文章中の動画IDも検出', type: 'boolean', description: '入力欄・編集中・コード欄は対象外です。' },
    { id: 'externalLinks.prefixes', label: '検出する動画IDの接頭辞', type: 'text', description: '例：sm nm so ss。英小文字2〜8文字を空白で区切ります。再生可能かの事前通信はしません。' }
].map(d => ({ ...d, category: '外部サイトからの再生', subcategory: '基本設定', dependsOn: d.id === 'externalLinks.enabled' ? undefined : 'externalLinks.enabled' }));
const tokens = (v) => typeof v === 'string' ? v.trim().toLowerCase().split(/[\s,]+/).filter(Boolean) : [];
const domains = (v) => tokens(v).filter(x => /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9-]+$/.test(x));
function sanitizeExternal(values) {
    const source = values && typeof values === 'object' ? values : {};
    const out = { ...exports.externalDefaults };
    for (const key of Object.keys(out)) {
        const value = source[key];
        if (typeof value === typeof out[key])
            out[key] = typeof value === 'string' ? value.slice(0, 4096) : value;
    }
    for (const [key, valid] of [['externalLinks.siteMode', ['all', 'allow']], ['externalLinks.activation', ['hover', 'selection']], ['externalLinks.size', ['small', 'normal', 'large']]])
        if (!valid.includes(String(out[key])))
            out[key] = exports.externalDefaults[key];
    return out;
}
function readExternal(values) {
    const v = sanitizeExternal(values);
    return { enabled: v['externalLinks.enabled'] === true, siteMode: String(v['externalLinks.siteMode']), sites: domains(v['externalLinks.sites']), excludedSites: domains(v['externalLinks.excludedSites']), activation: String(v['externalLinks.activation']), size: String(v['externalLinks.size']), redirects: v['externalLinks.redirects'] === true, textIds: v['externalLinks.textIds'] === true, prefixes: [...new Set(tokens(v['externalLinks.prefixes']).filter(x => /^[a-z]{2,8}$/.test(x)))] };
}
function siteEnabled(host, s) {
    const matches = (domain) => host === domain || host.endsWith('.' + domain);
    return s.enabled && !s.excludedSites.some(matches) && (s.siteMode === 'all' || s.sites.some(matches));
}
