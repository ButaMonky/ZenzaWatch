// ==UserScript==
// @name         ZenzaBlogPartsButton
// @namespace    https://github.com/segabito/
// @version      1.1.1-task1024
// @description  ブログパーツや外部サイトの動画リンクから、そのページ上でZenzaWatchを開く
// @match        https://*/*
// @match        http://ext.nicovideo.jp/thumb/*
// @homepageURL  https://github.com/ButaMonky/ZenzaWatch
// @supportURL   https://github.com/ButaMonky/ZenzaWatch/issues
// @downloadURL  https://github.com/ButaMonky/ZenzaWatch/raw/develop/dist/ZenzaBlogPartsButton.user.js
// @updateURL    https://github.com/ButaMonky/ZenzaWatch/raw/develop/dist/ZenzaBlogPartsButton.user.js
// @run-at       document-end
// @grant        GM_registerMenuCommand
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_addValueChangeListener
// @grant        GM_removeValueChangeListener
// @grant        GM_xmlhttpRequest
// @connect      nicovideo.jp
// @connect      nimg.jp
// @connect      dmc.nico
// @sandbox      DOM
// ==/UserScript==
// build: 2026-11-12 19:03Z 4a9db3b
// Shared runtime normalized SHA256: 810a0c4a6dbdd470023de5fb36e447fc5a02dfcc73b8ea3be7e1567ea11942e7

(() => {
 const externalModules=(()=>{const factories={"./site-rules":(exports,require)=>{"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.siteRules = siteRules;
exports.matchesSiteRule = matchesSiteRule;
// URL rules share @match-style boundaries; no requests and no arbitrary regex execution.
function siteRules(value) {
    if (typeof value !== 'string')
        return [];
    return value.split(/\r?\n/).flatMap(line => {
        const clean = line.trim().replace(/^\/\/\s*(?=@)/, '').replace(/^@(match|include|exclude)\s+/, '');
        if (!clean || clean.startsWith('//') || clean.startsWith('#'))
            return [];
        return clean.includes('://') || clean === '*' ? [clean] : clean.split(/[\s,]+/).filter(Boolean);
    });
}
function glob(pattern, value) {
    // Linear-space wildcard matcher; '*' is the only metacharacter.
    const parts = pattern.split('*');
    if (parts.length === 1)
        return value === pattern;
    if (!value.startsWith(parts[0]))
        return false;
    let pos = parts[0].length;
    for (const part of parts.slice(1, -1)) {
        const at = value.indexOf(part, pos);
        if (at < 0)
            return false;
        pos = at + part.length;
    }
    const tail = parts[parts.length - 1];
    return value.length - pos >= tail.length && value.endsWith(tail);
}
function matchesSiteRule(rule, address) {
    let url;
    try {
        url = new URL(address.includes('://') ? address : 'https://' + address + '/');
    }
    catch {
        return false;
    }
    if (!['https:', 'http:'].includes(url.protocol))
        return false;
    if (rule === '*')
        return true;
    if (!rule.includes('://')) {
        const domain = rule.toLowerCase().replace(/^\*\./, '');
        if (rule.includes('*') && !rule.startsWith('*.'))
            return glob(rule, url.href.split('#')[0]);
        if (!/^[a-z0-9-]+(?:\.[a-z0-9-]+)*$/.test(domain))
            return false;
        return url.hostname === domain || url.hostname.endsWith('.' + domain);
    }
    const match = /^(https?|http\*|\*):\/\/([^/]+)(\/[^#]*)?$/.exec(rule);
    if (!match)
        return false;
    const [, scheme, authority] = match, path = match[3] || (authority.includes('*') ? '/*' : '/');
    if (scheme !== '*' && scheme !== 'http*' && url.protocol !== scheme + ':')
        return false;
    const hostPort = /^([^:@]+)(?::(\d+|\*))?$/.exec(authority);
    if (!hostPort)
        return false;
    const host = hostPort[1].toLowerCase(), port = hostPort[2];
    if (port && port !== '*' && (url.port || (url.protocol === 'https:' ? '443' : '80')) !== port)
        return false;
    const matchesHost = host === '*' || (host.startsWith('*.') ? (url.hostname === host.slice(2) || url.hostname.endsWith('.' + host.slice(2))) : glob(host, url.hostname));
    return matchesHost && glob(path, url.pathname + url.search);
}
},"./settings":(exports,require)=>{"use strict";
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
    { id: 'externalLinks.enabled', label: '外部サイトでZenボタンを使う', type: 'boolean', description: 'ZenzaBlogPartsButtonのインストールが必要です。変更後は外部ページを再読み込みしてください。' },
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
},"./targets":(exports,require)=>{"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validVideoId = validVideoId;
exports.linkTargets = linkTargets;
exports.textTargets = textTargets;
function validVideoId(id) { return typeof id === 'string' && /^(?:[a-z]{2,8})?\d{1,20}$/.test(id); }
function allowedId(id, s, numeric = false) {
    const m = /^([a-z]{2,8})(\d{1,20})$/.exec(id);
    return m ? s.prefixes.includes(m[1]) : numeric && /^\d{1,20}$/.test(id);
}
function direct(value, base, s) {
    try {
        const u = new URL(value, base);
        if (!['http:', 'https:'].includes(u.protocol) || u.username || u.password || u.port || !['www.nicovideo.jp', 'sp.nicovideo.jp'].includes(u.hostname))
            return null;
        const id = /^\/watch\/([^/]+)\/?$/.exec(u.pathname)?.[1];
        return id && allowedId(id, s, true) ? id : null;
    }
    catch {
        return null;
    }
}
function linkTargets(value, base, s) {
    const ids = new Set(), seen = new Set();
    const visit = (text, depth) => {
        if (text.length > 8192 || seen.has(text) || seen.size >= 32)
            return;
        seen.add(text);
        const id = direct(text, base, s);
        if (id) {
            ids.add(id);
            return;
        }
        if (!s.redirects || depth >= 3)
            return;
        try {
            const u = new URL(text, base);
            if (!['https:', 'http:'].includes(u.protocol) || u.username || u.password)
                return;
            u.searchParams.forEach(v => { if (/^https?:\/\//i.test(v))
                visit(v, depth + 1);
            else {
                try {
                    const decoded = decodeURIComponent(v);
                    if (/^https?:\/\//i.test(decoded))
                        visit(decoded, depth + 1);
                }
                catch { }
            } });
        }
        catch { }
    };
    visit(value, 0);
    return [...ids];
}
function textTargets(text, s) {
    if (!s.textIds || text.length > 4096)
        return [];
    const ids = new Set();
    for (const m of text.matchAll(/(?<![a-zA-Z0-9_])([a-z]{2,8}\d{1,20})(?![a-zA-Z0-9_])/g))
        if (allowedId(m[1], s))
            ids.add(m[1]);
    return [...ids];
}
},"./preflight":(exports,require)=>{"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.classifyWatchPage = classifyWatchPage;
exports.createPreflight = createPreflight;
const targets_1 = require("./targets");
// Keep only status + expiry. Never retain watch responses, auth keys or account data.
function classifyWatchPage(html, status, Parser) {
    if (status >= 500 || html.length > 5000000)
        return 'unknown';
    try {
        const meta = html.match(/<meta\b[^>]*\bname\s*=\s*(["'])server-response\1[^>]*>/i)?.[0];
        if (!meta)
            return 'unknown';
        const raw = new Parser().parseFromString(meta, 'text/html').querySelector('meta[name="server-response"]')?.getAttribute('content');
        if (!raw)
            return 'unknown';
        const response = JSON.parse(raw)?.data?.response, data = response?.$watchV4?.data || response;
        const code = response?.errorCode || data?.errorCode;
        if (code === 'NOT_FOUND' || code === 'FORBIDDEN')
            return 'unavailable';
        if (code || !data?.video || !data?.client)
            return 'unknown';
        const media = data.media;
        if (response?.$watchV4 ? media?.accessRightKey && Array.isArray(media?.contents?.videos) && media.contents.videos.length : media?.domand?.accessRightKey)
            return 'available';
    }
    catch { }
    return 'unknown';
}
function createPreflight(fetcher, Parser, now = Date.now) {
    const cache = new Map(), pending = new Map();
    const queue = [], controllers = new Set();
    let active = 0, disposed = false;
    function pump() {
        while (!disposed && active < 2 && queue.length) {
            const task = queue.shift(), controller = new AbortController();
            active++;
            controllers.add(controller);
            void (async () => {
                let result = 'unknown';
                try {
                    const r = await fetcher('https://www.nicovideo.jp/watch/' + encodeURIComponent(task.id), { credentials: 'include', timeout: 8000, signal: controller.signal });
                    result = classifyWatchPage(await r.text(), r.status, Parser);
                }
                catch { }
                controllers.delete(controller);
                active--;
                pending.delete(task.id);
                if (!disposed) {
                    cache.delete(task.id);
                    cache.set(task.id, { result, until: now() + (result === 'unknown' ? 15000 : 300000) });
                    while (cache.size > 100)
                        cache.delete(cache.keys().next().value);
                }
                task.resolve(disposed ? 'unknown' : result);
                pump();
            })();
        }
    }
    return { check(id) {
            if (disposed || !(0, targets_1.validVideoId)(id))
                return Promise.resolve('unknown');
            const hit = cache.get(id);
            if (hit && hit.until > now())
                return Promise.resolve(hit.result);
            const running = pending.get(id);
            if (running)
                return running;
            if (pending.size >= 100)
                return Promise.resolve('unknown');
            let resolve;
            const promise = new Promise(r => resolve = r);
            pending.set(id, promise);
            queue.push({ id, resolve });
            pump();
            return promise;
        }, dispose() { disposed = true; for (const c of controllers)
            c.abort(); for (const task of queue)
            task.resolve('unknown'); queue.length = 0; pending.clear(); cache.clear(); } };
}
},"./overlay":(exports,require)=>{"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mountOverlay = mountOverlay;
const settings_1 = require("./settings");
const targets_1 = require("./targets");
const excluded = 'input,textarea,select,button,pre,code,[contenteditable]:not([contenteditable="false"]),[role="textbox"]';
function mountOverlay(w, s, open, check) {
    if (!(0, settings_1.siteEnabled)(w.location.href, s))
        return { dispose() { } };
    const d = w.document, host = d.createElement('div');
    host.dataset.zenzaExternalOverlay = '';
    host.dataset.zenzaCompanion = '';
    host.style.cssText = 'all:initial!important;position:fixed!important;inset:auto!important;margin:0!important;padding:0!important;border:0!important;z-index:2147483647!important;display:none!important;';
    const shadow = host.attachShadow({ mode: 'closed' }), style = d.createElement('style');
    const size = { small: 12, normal: 14, large: 17 }[s.size] || 12;
    style.textContent = `:host{color-scheme:dark}button{font:600 ${size}px/1.6 sans-serif;color:#e8f5f4;background:#243c47;border:1px solid #7acabc;border-radius:4px;padding:2px 7px;cursor:pointer}button:focus-visible{outline:2px solid #fff}p{font:13px/1.5 sans-serif;margin:0;padding:8px;color:#eee;background:#17212d;max-width:280px}`;
    const button = d.createElement('button');
    button.type = 'button';
    button.textContent = 'Zen';
    button.setAttribute('aria-label', 'この動画をZenzaWatchで開く');
    button.title = 'Alt+Enterでボタンへ移動';
    const status = d.createElement('p');
    status.setAttribute('role', 'status');
    status.hidden = true;
    shadow.append(style, button, status);
    d.documentElement.append(host);
    let showSerial = 0;
    let resolveTarget = null, busy = false, disposed = false, hideTimer;
    function hide() { if (busy)
        return; showSerial++; host.style.setProperty('display', 'none', 'important'); resolveTarget = null; }
    function show(ids, rect) {
        w.clearTimeout(hideTimer);
        const targetIds = ids();
        if (check && s.preflight === 'display' && targetIds.length === 1) {
            const serial = ++showSerial;
            host.style.setProperty('display', 'none', 'important');
            resolveTarget = null;
            void check(targetIds[0]).then(result => { if (disposed || serial !== showSerial || ids()[0] !== targetIds[0])
                return; if (result !== 'unavailable')
                present(ids, rect); });
            return;
        }
        present(ids, rect);
    }
    function present(ids, rect) {
        if (busy || ids().length !== 1) {
            if (!busy)
                hide();
            return;
        }
        w.clearTimeout(hideTimer);
        resolveTarget = ids;
        status.hidden = true;
        host.style.setProperty('display', 'block', 'important');
        const width = host.getBoundingClientRect().width || 60, height = host.getBoundingClientRect().height || 30;
        const x = Math.max(4, Math.min(rect.right + 4, w.innerWidth - width - 4));
        const y = Math.max(4, Math.min(rect.top, w.innerHeight - height - 4));
        host.style.setProperty('left', x + 'px', 'important');
        host.style.setProperty('top', y + 'px', 'important');
    }
    function target(e) {
        if (disposed || busy || e.composedPath().includes(host) || s.activation === 'selection')
            return;
        const node = e.target;
        if (!(node instanceof w.Element) || node.closest(excluded)) {
            hide();
            return;
        }
        const anchor = node.closest('a[href]');
        if (anchor && s.activation === 'inline')
            return;
        if (anchor) {
            const ids = () => anchor.isConnected && !anchor.closest(excluded) ? (0, targets_1.linkTargets)(anchor.getAttribute('href') || '', d.baseURI, s) : [];
            if (ids().length) {
                show(ids, anchor.getBoundingClientRect());
                return;
            }
        }
        if (s.textIds) {
            // Only inspect direct text at the interaction target, never walk the document.
            const ids = () => node.isConnected && !node.closest(excluded) ? (0, targets_1.textTargets)(Array.from(node.childNodes).filter(n => n.nodeType === 3).slice(0, 16).map(n => n.textContent || '').join(' '), s) : [];
            if (ids().length) {
                show(ids, node.getBoundingClientRect());
                return;
            }
        }
        // Allow crossing the small gap between a link and the overlay.
        w.clearTimeout(hideTimer);
        hideTimer = w.setTimeout(hide, 250);
    }
    function selection() {
        if (disposed || busy)
            return;
        const sel = w.getSelection();
        if (!sel || sel.isCollapsed || !sel.rangeCount) {
            if (s.activation === 'selection')
                hide();
            return;
        }
        const range = sel.getRangeAt(0), element = range.commonAncestorContainer.nodeType === 1 ? range.commonAncestorContainer : range.commonAncestorContainer.parentElement;
        if (!element || element.closest(excluded) || range.cloneContents().querySelector(excluded)) {
            hide();
            return;
        }
        const selected = () => {
            if (!element.isConnected || element.closest(excluded))
                return [];
            const text = range.toString().trim();
            if (text.length > 4096)
                return [];
            const link = element.closest('a[href]');
            const ids = link ? (0, targets_1.linkTargets)(link.getAttribute('href') || '', d.baseURI, s) : (0, targets_1.linkTargets)(text, d.baseURI, s);
            return ids.length ? ids : (0, targets_1.textTargets)(text, s);
        };
        if (s.activation === 'selection' || s.textIds)
            show(selected, range.getBoundingClientRect());
    }
    function keys(e) { if (e.key === 'Escape')
        hide();
    else if (e.altKey && e.key === 'Enter' && resolveTarget && host.style.display !== 'none') {
        e.preventDefault();
        button.focus();
    } }
    function keep() { w.clearTimeout(hideTimer); }
    button.addEventListener('pointerenter', keep);
    button.addEventListener('click', async (e) => {
        if (!e.isTrusted || busy || !resolveTarget)
            return;
        const ids = resolveTarget();
        if (ids.length !== 1) {
            hide();
            return;
        }
        e.preventDefault();
        e.stopPropagation();
        busy = true;
        button.disabled = true;
        status.hidden = false;
        status.textContent = '起動しています…';
        try {
            await open(ids[0], e);
            busy = false;
            hide();
        }
        catch (error) {
            status.textContent = error instanceof Error && error.message === 'MAIN_PLAYER_UNAVAILABLE' ? 'ZenzaWatch本体を最新版に更新して有効にし、このページを再読み込みしてください。' : error instanceof Error && error.message === 'VIDEO_UNAVAILABLE' ? '動画情報では削除・非公開などにより利用できない状態です。' : '起動できませんでした。ニコニコのログイン状態と通信を確認してください。';
        }
        finally {
            busy = false;
            button.disabled = false;
        }
    });
    d.addEventListener('pointerover', target, true);
    d.addEventListener('focusin', target, true);
    d.addEventListener('selectionchange', selection);
    d.addEventListener('keydown', keys, true);
    w.addEventListener('scroll', hide, true);
    w.addEventListener('resize', hide);
    return { dispose() { disposed = true; w.clearTimeout(hideTimer); d.removeEventListener('pointerover', target, true); d.removeEventListener('focusin', target, true); d.removeEventListener('selectionchange', selection); d.removeEventListener('keydown', keys, true); w.removeEventListener('scroll', hide, true); w.removeEventListener('resize', hide); host.remove(); } };
}
},"./inline-buttons":(exports,require)=>{"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mountInlineButtons = mountInlineButtons;
const settings_1 = require("./settings");
const targets_1 = require("./targets");
const excluded = 'input,textarea,select,button,pre,code,[contenteditable]:not([contenteditable="false"]),[role="textbox"],svg';
// Own only the inserted siblings. Never wrap, rewrite or replace source links.
function mountInlineButtons(w, s, open, check) {
    if (s.activation !== 'inline' || !(0, settings_1.siteEnabled)(w.location.href, s))
        return { dispose() { } };
    const d = w.document, owned = new Map(), pending = new Set();
    const observed = new Map();
    const visible = typeof w.IntersectionObserver === 'function' ? new w.IntersectionObserver(entries => { for (const entry of entries)
        if (entry.isIntersecting) {
            visible.unobserve(entry.target);
            const job = observed.get(entry.target);
            observed.delete(entry.target);
            job?.();
        } }) : null;
    let disposed = false, timer, busy = false;
    const ids = (a) => a.isConnected && !a.closest(excluded) ? (0, targets_1.linkTargets)(a.getAttribute('href') || '', d.baseURI, s) : [];
    function update(a) {
        const old = owned.get(a);
        if (ids(a).length !== 1) {
            old?.remove();
            visible?.unobserve(a);
            observed.delete(a);
            owned.delete(a);
            return;
        }
        if (old?.isConnected && old.previousSibling === a && old.dataset.videoId === ids(a)[0])
            return;
        old?.remove();
        const host = d.createElement('span');
        host.dataset.zenzaExternalInline = '';
        host.dataset.zenzaCompanion = '';
        host.dataset.videoId = ids(a)[0];
        host.style.cssText = 'display:inline-block!important;margin:0 4px!important;vertical-align:middle!important;position:relative!important;';
        const root = host.attachShadow({ mode: 'closed' }), style = d.createElement('style'), button = d.createElement('button');
        const size = { small: 12, normal: 14, large: 17 }[s.size] || 12;
        style.textContent = `button{font:600 ${size}px/1.6 sans-serif;color:#e8f5f4;background:#243c47;border:1px solid #7acabc;border-radius:4px;padding:2px 7px;cursor:pointer}button:focus-visible{outline:2px solid #7acabc}span{font:12px/1.5 sans-serif;color:#fff;background:#17212d;padding:4px}`;
        button.type = 'button';
        button.textContent = 'Zen';
        button.setAttribute('aria-label', 'この動画をZenzaWatchで開く');
        const status = d.createElement('span');
        status.hidden = true;
        status.setAttribute('role', 'status');
        // Cards often handle bubbling clicks. Only our own button action is consumed.
        host.addEventListener('click', e => e.stopPropagation());
        button.addEventListener('click', async (e) => {
            if (!e.isTrusted || busy || disposed)
                return;
            const current = ids(a);
            if (current.length !== 1) {
                update(a);
                return;
            }
            e.preventDefault();
            e.stopPropagation();
            busy = true;
            button.disabled = true;
            status.hidden = false;
            status.textContent = '起動中…';
            try {
                await open(current[0], e);
                status.hidden = true;
            }
            catch (error) {
                status.textContent = error instanceof Error && error.message === 'MAIN_PLAYER_UNAVAILABLE' ? 'ZenzaWatch本体を最新版に更新して有効にし、このページを再読み込みしてください。' : error instanceof Error && error.message === 'VIDEO_UNAVAILABLE' ? '動画情報では削除・非公開などにより利用できない状態です。' : '起動できませんでした。ログイン状態と通信を確認してください。';
            }
            finally {
                busy = false;
                button.disabled = false;
            }
        });
        root.append(style, button, status);
        a.after(host);
        owned.set(a, host);
        if (check && s.preflight === 'display') {
            host.style.setProperty('display', 'none', 'important');
            const id = host.dataset.videoId;
            const run = () => { void check(id).then(result => { if (disposed || owned.get(a) !== host || ids(a)[0] !== id)
                return; if (result !== 'unavailable')
                host.style.setProperty('display', 'inline-block', 'important'); }); };
            if (visible) {
                observed.set(a, run);
                visible.observe(a);
            }
            else
                run();
        }
    }
    function flush() { timer = undefined; if (disposed)
        return; let count = 0; for (const a of pending) {
        pending.delete(a);
        update(a);
        if (++count >= 100)
            break;
    } if (pending.size)
        timer = w.setTimeout(flush, 0); }
    function enqueue(node) {
        if (!(node instanceof w.Element) || node.hasAttribute('data-zenza-external-inline'))
            return;
        if (node.matches('a[href]'))
            pending.add(node);
        node.querySelectorAll('a[href]').forEach(a => pending.add(a));
    }
    const observer = new w.MutationObserver(records => {
        if (disposed)
            return;
        let removed = false;
        for (const record of records) {
            if (record.type === 'attributes') {
                pending.add(record.target);
                continue;
            }
            record.addedNodes.forEach(enqueue);
            if (Array.from(record.removedNodes).some(n => n instanceof w.Element && !n.hasAttribute('data-zenza-external-inline')))
                removed = true;
        }
        if (removed)
            for (const [a, host] of owned)
                if (!a.isConnected) {
                    host.remove();
                    visible?.unobserve(a);
                    observed.delete(a);
                    owned.delete(a);
                }
        if (pending.size && timer === undefined)
            timer = w.setTimeout(flush, 0);
    });
    enqueue(d.documentElement);
    flush();
    observer.observe(d.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['href'] });
    return { dispose() { disposed = true; observer.disconnect(); visible?.disconnect(); observed.clear(); w.clearTimeout(timer); pending.clear(); for (const host of owned.values())
            host.remove(); owned.clear(); } };
}
},"./settings-panel":(exports,require)=>{"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.openExternalSettings = openExternalSettings;
const settings_1 = require("./settings");
function openExternalSettings(d, values, save) {
    d.querySelector('[data-zenza-external-settings]')?.remove();
    const host = d.createElement('div');
    host.dataset.zenzaExternalSettings = '';
    host.style.cssText = 'all:initial!important;position:fixed!important;inset:24px!important;z-index:2147483647!important;display:block!important;';
    const shadow = host.attachShadow({ mode: 'closed' }), style = d.createElement('style');
    style.textContent = `
 section{font:14px/1.5 sans-serif;color:#eee;background:#17212d;border:1px solid #6c8296;border-radius:10px;padding:18px;max-width:680px;max-height:80vh;overflow:auto;margin:auto;color-scheme:dark}
 h2{font-size:19px;margin:0 0 14px}.row{padding:10px 0;border-bottom:1px solid #344353}.field-label{display:block;font-weight:600;margin-bottom:5px}.child-group{margin-left:12px;padding-left:16px;border-left:2px solid #405064}.row[data-disabled=true]>.field{opacity:.48}
 input:not([type=checkbox]):not([type=radio]),select,textarea{width:100%;box-sizing:border-box;padding:6px 8px;background:#101a25;color:#eee;border:1px solid #65778a;border-radius:4px}textarea{resize:vertical;min-height:62px}input{accent-color:#7acabc}input[type=checkbox]{margin-right:8px}.choices{display:flex;gap:6px 18px;flex-wrap:wrap}.choices label{display:flex;gap:5px;align-items:center}small,details{display:block;color:#bbc6d0;font-size:12px;margin-top:4px}summary{cursor:pointer;width:fit-content}.reason{color:#c8d3dd}.reason:empty{display:none}button{padding:6px 12px;background:#243c47;color:#eee;border:1px solid #7acabc;border-radius:4px;cursor:pointer}button:disabled{opacity:.45;cursor:default}.add-site{margin-top:6px}.actions{display:flex;gap:8px;margin-top:16px;flex-wrap:wrap}.actions button:first-child{margin-right:auto}button:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible,summary:focus-visible{outline:2px solid #a2e4d7;outline-offset:2px}
 `;
    const section = d.createElement('section');
    section.setAttribute('role', 'dialog');
    section.setAttribute('aria-modal', 'true');
    section.setAttribute('aria-label', '外部サイトからの再生');
    section.addEventListener('keydown', e => { if (e.key === 'Escape') {
        e.stopPropagation();
        host.remove();
    } });
    const heading = d.createElement('h2');
    heading.textContent = '外部サイトからの再生';
    section.append(heading);
    const current = (0, settings_1.sanitizeExternal)(values), inputs = new Map(), rows = new Map(), reasons = new Map(), addButtons = new Map(), groups = new Map();
    const read = (key) => { const controls = inputs.get(key); const input = controls[0]; return input.type === 'checkbox' ? input.checked : input.type === 'radio' ? (controls.find(c => c.checked)?.value || '') : input.value; };
    let currentHost = '';
    try {
        const url = new URL(d.URL);
        if (url.protocol === 'https:')
            currentHost = url.hostname;
    }
    catch { }
    for (const descriptor of settings_1.externalDescriptors) {
        const row = d.createElement('div');
        row.className = 'row';
        row.dataset.setting = descriptor.id;
        rows.set(descriptor.id, row);
        const field = d.createElement('div');
        field.className = 'field';
        row.append(field);
        const label = d.createElement('label');
        label.className = 'field-label';
        label.textContent = descriptor.label;
        field.append(label);
        const controls = [];
        const configure = (input, value) => { input.dataset.key = descriptor.id; input.id = descriptor.id + (value ? '-' + value : ''); input.setAttribute('aria-describedby', descriptor.id + '-help ' + descriptor.id + '-reason'); controls.push(input); };
        if (descriptor.inputPresentation === 'radio' && descriptor.options) {
            const choices = d.createElement('div');
            choices.className = 'choices';
            choices.setAttribute('role', 'radiogroup');
            choices.setAttribute('aria-label', descriptor.label);
            for (const option of descriptor.options) {
                const item = d.createElement('label'), input = d.createElement('input');
                input.type = 'radio';
                input.name = descriptor.id;
                input.value = option.value;
                input.checked = current[descriptor.id] === option.value;
                configure(input, option.value);
                item.append(input, option.label);
                choices.append(item);
            }
            field.append(choices);
        }
        else {
            const input = descriptor.options ? d.createElement('select') : descriptor.type === 'textarea' ? d.createElement('textarea') : d.createElement('input');
            if (input.tagName === 'SELECT')
                for (const option of descriptor.options || []) {
                    const el = d.createElement('option');
                    el.value = option.value;
                    el.textContent = option.label;
                    input.append(el);
                }
            else if (input.tagName === 'INPUT')
                input.type = descriptor.type === 'boolean' ? 'checkbox' : 'text';
            if (input.type === 'checkbox')
                input.checked = current[descriptor.id] === true;
            else
                input.value = String(current[descriptor.id]);
            if (input.tagName === 'TEXTAREA')
                input.rows = descriptor.id === 'externalLinks.prefixes' ? 4 : 3;
            configure(input);
            label.htmlFor = input.id;
            if (input.type === 'checkbox')
                label.prepend(input);
            else
                field.append(input);
        }
        inputs.set(descriptor.id, controls);
        if (descriptor.description) {
            const small = d.createElement('small');
            small.id = descriptor.id + '-help';
            small.textContent = descriptor.description;
            field.append(small);
        }
        if (descriptor.descriptionDetails) {
            const details = d.createElement('details'), summary = d.createElement('summary'), body = d.createElement('div');
            summary.textContent = '詳しい説明';
            body.textContent = descriptor.descriptionDetails;
            details.append(summary, body);
            field.append(details);
        }
        if (descriptor.addCurrentSite) {
            const button = d.createElement('button');
            button.type = 'button';
            button.className = 'add-site';
            button.textContent = '現在のサイトを追加';
            button.onclick = () => { if (button.disabled || !currentHost)
                return; const input = controls[0]; if (!input.value.split(/\r?\n/).some(line => line.trim().toLowerCase() === currentHost.toLowerCase()))
                input.value += (input.value && !input.value.endsWith('\n') ? '\n' : '') + currentHost; };
            field.append(button);
            addButtons.set(descriptor.id, button);
        }
        const reason = d.createElement('small');
        reason.id = descriptor.id + '-reason';
        reason.className = 'reason';
        row.append(reason);
        reasons.set(descriptor.id, reason);
        if (descriptor.dependsOn) {
            let group = groups.get(descriptor.dependsOn);
            if (!group) {
                group = d.createElement('div');
                group.className = 'child-group';
                (rows.get(descriptor.dependsOn) || section).append(group);
                groups.set(descriptor.dependsOn, group);
            }
            group.append(row);
        }
        else
            section.append(row);
    }
    const disabledReason = (key) => {
        const descriptor = settings_1.externalDescriptors.find(item => item.id === key);
        if (!descriptor.dependsOn)
            return '';
        const parent = descriptor.dependsOn, ancestor = disabledReason(parent);
        if (ancestor)
            return ancestor;
        if (descriptor.dependsOnValue !== undefined)
            return read(parent) === descriptor.dependsOnValue ? '' : descriptor.disabledReason || '親の設定を変更すると編集できます。';
        return read(parent) === true ? '' : '外部サイトでZenボタンを使うをONにすると編集できます。';
    };
    const update = () => { for (const [key, controls] of inputs) {
        const reason = disabledReason(key);
        controls.forEach(input => input.disabled = !!reason);
        rows.get(key).dataset.disabled = String(!!reason);
        const button = addButtons.get(key);
        if (button)
            button.disabled = !!reason || !currentHost;
        reasons.get(key).textContent = reason || (button && !currentHost ? 'HTTPSページで現在のサイトを追加できます。' : '');
    } };
    for (const controls of inputs.values())
        controls.forEach(input => input.addEventListener('change', update));
    update();
    const actions = d.createElement('div');
    actions.className = 'actions';
    const reset = d.createElement('button');
    reset.textContent = '初期値に戻す';
    reset.onclick = () => { for (const [key, controls] of inputs)
        for (const input of controls) {
            if (input.type === 'checkbox')
                input.checked = settings_1.externalDefaults[key] === true;
            else if (input.type === 'radio')
                input.checked = input.value === settings_1.externalDefaults[key];
            else
                input.value = String(settings_1.externalDefaults[key]);
        } update(); };
    const commit = d.createElement('button');
    commit.textContent = '保存';
    commit.onclick = () => { const next = { ...current }; for (const key of inputs.keys())
        next[key] = read(key); save((0, settings_1.sanitizeExternal)(next)); host.remove(); };
    const cancel = d.createElement('button');
    cancel.textContent = 'キャンセル';
    cancel.onclick = () => host.remove();
    actions.append(reset, commit, cancel);
    section.append(actions);
    shadow.append(style, section);
    d.documentElement.append(host);
    inputs.get('externalLinks.enabled')[0].focus();
}
},"./player-background":(exports,require)=>{"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.installPlayerBackground = installPlayerBackground;
/** The isolated player document must not paint over the host in small mode. */
function installPlayerBackground(document) {
    const style = document.createElement('style');
    style.dataset.zenzaExternalBackground = '';
    style.textContent = `
    html:has(body.zenzaScreenMode_small):not(:has(:fullscreen)),
    body.zenzaScreenMode_small:not(:has(:fullscreen)) {
      background: transparent !important;
    }
  `;
    document.head.append(style);
}
},"./official-settings":(exports,require)=>{"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectOfficialExternalSettings = connectOfficialExternalSettings;
const settings_1 = require("./settings");
/** Synchronize only public external-launch preferences, never account/runtime data. */
function connectOfficialExternalSettings(w, gm) {
    const slot = 'external-links-v1', prefix = 'ZenzaWatch_', keys = Object.keys(settings_1.externalDefaults);
    let syncing = false;
    const readLocal = () => Object.fromEntries(keys.flatMap(key => { try {
        const raw = w.localStorage.getItem(prefix + key);
        return raw === null ? [] : [[key, JSON.parse(raw)]];
    }
    catch {
        return [];
    } }));
    const publish = (changed) => {
        const local = readLocal(), patch = Object.fromEntries(changed.filter(key => keys.includes(key) && Object.prototype.hasOwnProperty.call(local, key)).map(key => [key, local[key]]));
        if (Object.keys(patch).length)
            gm.set(slot, (0, settings_1.sanitizeExternal)({ ...(0, settings_1.sanitizeExternal)(gm.get(slot)), ...patch }));
    };
    const pull = () => {
        if (syncing)
            return;
        syncing = true;
        try {
            if (!gm.get(slot))
                publish(Object.keys(readLocal()));
            const values = (0, settings_1.sanitizeExternal)(gm.get(slot));
            for (const key of keys)
                w.localStorage.setItem(prefix + key, JSON.stringify(values[key]));
            w.dispatchEvent(new w.CustomEvent('ZenzaWatch-advanced-settings-saved', { detail: { keys } }));
        }
        finally {
            syncing = false;
        }
    };
    const onSave = (event) => {
        if (syncing)
            return;
        const changed = event.detail?.keys;
        if (Array.isArray(changed))
            publish(changed.filter((key) => typeof key === 'string'));
    };
    w.addEventListener('ZenzaWatch-advanced-settings-saved', onSave);
    const subscription = gm.listen?.(slot, pull);
    pull();
    return () => { w.removeEventListener('ZenzaWatch-advanced-settings-saved', onSave); if (subscription !== undefined)
        gm.unlisten?.(subscription); };
}
},"./blog-clicks":(exports,require)=>{"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendBlogClick = sendBlogClick;
exports.receiveBlogClicks = receiveBlogClicks;
const settings_1 = require("./settings");
const targets_1 = require("./targets");
const prefix = 'blog-click-v1:';
/** DOM messages carry only a correlation nonce. The trusted-click proof stays in GM storage. */
function sendBlogClick(w, gm, id, event) {
    if (!event.isTrusted || !(0, targets_1.validVideoId)(id) || w === w.top)
        return false;
    const nonce = w.crypto.randomUUID(), key = prefix + nonce;
    gm.set(key, { id, time: Date.now() });
    w.parent.postMessage({ type: 'ZenzaBlogPartsClick', nonce }, '*');
    w.setTimeout(() => gm.remove(key), 10000);
    return true;
}
function receiveBlogClicks(w, gm, preferences, open) {
    const receive = (event) => {
        if (!['https://ext.nicovideo.jp', 'http://ext.nicovideo.jp'].includes(event.origin))
            return;
        const nonce = event.data?.type === 'ZenzaBlogPartsClick' ? event.data.nonce : null;
        if (typeof nonce !== 'string' || !/^[-a-f0-9]{36}$/.test(nonce))
            return;
        const frame = Array.from(w.document.querySelectorAll('iframe')).find(frame => frame.contentWindow === event.source);
        if (!frame)
            return;
        let id;
        try {
            const url = new URL(frame.src, w.location.href);
            if (url.origin !== event.origin)
                return;
            id = /^\/thumb\/([^/]+)\/?$/.exec(url.pathname)?.[1];
        }
        catch {
            return;
        }
        const key = prefix + nonce, proof = gm.get(key);
        if (!id || !(0, targets_1.validVideoId)(id) || !proof || proof.id !== id || !Number.isFinite(proof.time) || Date.now() - proof.time < 0 || Date.now() - proof.time > 10000)
            return;
        gm.remove(key);
        if (!(0, settings_1.siteEnabled)(w.location.href, (0, settings_1.readExternal)(preferences())))
            return;
        void open(id, { isTrusted: true }).catch(() => w.console.warn('ZenzaBlogPartsButton: could not open embedded video'));
    };
    w.addEventListener('message', receive);
    return () => w.removeEventListener('message', receive);
}
},"./coexistence":(exports,require)=>{"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.watchLegacyTrial = watchLegacyTrial;
/** Suspend the companion when an older external trial is active in this page. */
function watchLegacyTrial(w, stop) {
    let stopped = false;
    const check = () => {
        if (stopped || !w.document.querySelector('[data-zenza-external-overlay]:not([data-zenza-companion]),[data-zenza-external-inline]:not([data-zenza-companion])'))
            return;
        stopped = true;
        stop();
        observer.disconnect();
    };
    const observer = new w.MutationObserver(check);
    observer.observe(w.document.documentElement, { childList: true, subtree: true });
    check();
    return () => observer.disconnect();
}
},"./main-player-bridge":(exports,require)=>{"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMainPlayerClient = createMainPlayerClient;
exports.installMainPlayerProvider = installMainPlayerProvider;
const targets_1 = require("./targets");
// This channel exists only inside the static Nico player frame. External
// parents never receive API responses, credentials, fetch methods or ports.
const protocol = 'zenza-main-player-v1';
function eligible(w) {
    return w !== w.top && w.name === 'ZenzaWatchExternalTrialPlayer' &&
        w.location.origin === 'https://www.nicovideo.jp' && w.location.pathname === '/robots.txt';
}
function accepts(w, event) {
    return event.source === w && event.origin === w.location.origin &&
        event.data?.protocol === protocol;
}
function createMainPlayerClient(w, options = {}) {
    let disposed = false, closing = false, connected = false, seq = 0, stageListener = (_) => { };
    const channel = w.crypto.randomUUID();
    let pending;
    const send = (data) => w.postMessage({ protocol, channel, ...data }, w.location.origin);
    function settle(error) {
        if (!pending)
            return;
        const task = pending;
        pending = undefined;
        w.clearTimeout(task.timer);
        w.clearTimeout(task.retry);
        if (error)
            task.reject(error);
        else
            task.resolve();
    }
    const receive = (event) => {
        if (disposed || !accepts(w, event) || event.data.channel !== channel)
            return;
        const message = event.data;
        if (closing && message.type !== 'stage')
            return;
        if (message.type === 'ready' && pending) {
            connected = true;
            w.clearTimeout(pending.retry);
            if (!pending.ready) {
                pending.ready = true;
                w.clearTimeout(pending.timer);
                pending.timer = w.setTimeout(() => settle(Error('PLAYER_TIMEOUT')), 60000);
            }
            send({ type: 'open', id: pending.id, requestId: pending.seq });
        }
        else if (message.type === 'opened' && message.requestId === pending?.seq)
            settle();
        else if (message.type === 'error' && message.requestId === pending?.seq) {
            const allowed = ['LOGIN_REQUIRED', 'AUTH_FORBIDDEN', 'AUTH_TIMEOUT', 'GM_NETWORK_ERROR', 'PLAYER_CLOSED'];
            const error = Object.assign(Error(allowed.includes(message.code) ? message.code : 'PLAYER_START_FAILED'), { stage: ['BOOT', 'SETTINGS', 'AUTH', 'UI', 'VIDEO'].includes(message.stage) ? message.stage : 'BOOT' });
            settle(error);
        }
        else if (message.type === 'settings')
            options.onSettings?.(message.values);
        else if (message.type === 'stage' && typeof message.stage === 'string') {
            if (message.stage === 'CLOSING') {
                closing = true;
                settle(Error('PLAYER_CLOSED'));
                options.onClosing?.();
            }
            else if (message.stage === 'CLOSED') {
                settle(Error('PLAYER_CLOSED'));
                options.onClosed?.();
            }
            else if (['BOOT', 'SETTINGS', 'AUTH', 'UI', 'VIDEO', 'OPEN'].includes(message.stage))
                stageListener(message.stage);
        }
    };
    w.addEventListener('message', receive);
    const dispose = () => {
        if (disposed)
            return;
        disposed = true;
        settle(Error('PLAYER_CLOSED'));
        w.removeEventListener('message', receive);
    };
    w.addEventListener('pagehide', dispose, { once: true });
    return {
        async open(id, event) {
            if (!event?.isTrusted)
                throw Error('USER_CLICK_REQUIRED');
            if (!eligible(w) || !(0, targets_1.validVideoId)(id))
                throw Error('INVALID_VIDEO_ID');
            if (disposed || closing)
                throw Error('PLAYER_CLOSED');
            if (pending)
                throw Error('PLAYER_BUSY');
            return new Promise((resolve, reject) => {
                const task = pending = { id, seq: ++seq, resolve, reject,
                    timer: w.setTimeout(() => settle(Error('MAIN_PLAYER_UNAVAILABLE')), options.timeoutMs ?? 15000),
                    retry: undefined };
                const hello = () => {
                    if (pending !== task || disposed)
                        return;
                    send({ type: 'hello', snapshot: options.snapshot?.() });
                    task.retry = w.setTimeout(hello, options.retryMs ?? 250);
                };
                hello();
            });
        },
        updateSettings(values) { if (!disposed)
            send({ type: 'settings', values }); },
        close() {
            if (disposed)
                return false;
            if (closing)
                return true;
            closing = true;
            settle(Error('PLAYER_CLOSED'));
            if (connected)
                send({ type: 'close' });
            else {
                options.onClosing?.();
                options.onClosed?.();
            }
            return true;
        },
        setStageListener(listener) { stageListener = listener; },
        dispose
    };
}
function installMainPlayerProvider(w, session, options = {}) {
    if (!eligible(w))
        return () => { };
    let channel = '', last = 0, busy = false, disposed = false, closing = false;
    const send = (data) => {
        if (!disposed && channel)
            w.postMessage({ protocol, channel, ...data }, w.location.origin);
    };
    session.setStageListener(stage => { if (stage === 'CLOSING' || stage === 'CLOSED')
        closing = true; send({ type: 'stage', stage }); });
    options.subscribeSettings?.(values => send({ type: 'settings', values }));
    const receive = async (event) => {
        if (disposed || !accepts(w, event))
            return;
        const m = event.data;
        if (typeof m.channel !== 'string' || !/^[a-f0-9-]{36}$/i.test(m.channel))
            return;
        if (m.type === 'hello') {
            if (channel && channel !== m.channel)
                return;
            if (!channel)
                options.setup?.(m.snapshot);
            channel = m.channel;
            send({ type: 'ready' });
            return;
        }
        if (!channel || m.channel !== channel)
            return;
        if (m.type === 'settings') {
            options.onSettings?.(m.values);
            return;
        }
        if (m.type === 'close') {
            closing = true;
            if (!session.close()) {
                send({ type: 'stage', stage: 'CLOSING' });
                send({ type: 'stage', stage: 'CLOSED' });
            }
            return;
        }
        if (m.type !== 'open' || closing || busy || !Number.isSafeInteger(m.requestId) ||
            m.requestId <= last || !(0, targets_1.validVideoId)(m.id))
            return;
        last = m.requestId;
        busy = true;
        try {
            await session.open(m.id, { isTrusted: true });
            if (!closing)
                send({ type: 'opened', requestId: m.requestId });
        }
        catch (e) {
            const error = e;
            send({ type: 'error', requestId: m.requestId, code: error.message, stage: error.stage });
        }
        finally {
            busy = false;
        }
    };
    w.addEventListener('message', receive);
    const dispose = () => { disposed = true; w.removeEventListener('message', receive); };
    w.addEventListener('pagehide', dispose, { once: true });
    return dispose;
}
}},cache={};const require=name=>{if(!cache[name]){const exports=cache[name]={};factories[name](exports,require);}return cache[name];};return {settings:require('./settings'),targets:require('./targets'),overlay:require('./overlay'),inline:require('./inline-buttons'),preflight:require('./preflight'),panel:require('./settings-panel'),background:require('./player-background'),officialSettings:require('./official-settings'),blog:require('./blog-clicks'),coexistence:require('./coexistence'),mainBridge:require('./main-player-bridge')};})();
 if(location.hostname==='ext.nicovideo.jp'&&location.pathname.startsWith('/thumb/')){


/* eslint-disable */


(window => {
  const addStyle = (styles, id) => {
    const elm = document.createElement('style');
    elm.type = 'text/css';
    if (id) { elm.id = id; }
    elm.append(styles);
    document.head.append(elm);
    return elm;
  };

  // 埋め込み元（大百科等）のoriginを取得する。
  // Chrome/Edge/Brave系はlocation.ancestorOriginsで直接取得でき、
  // Referrer-Policyの影響を受けない（最も確実）。非対応ブラウザでは
  // document.referrerにフォールバックする。document.referrerは
  // サイト側のReferrer-Policy設定次第で空文字列になり得るため、
  // その場合は最後の手段としてpostMessageのtargetOriginを'*'にする
  // （送るメッセージ自体に機微な情報は含まれないため許容する）。
  const getParentOrigin = () => {
    try {
      if (location.ancestorOrigins && location.ancestorOrigins.length) {
        return location.ancestorOrigins[0];
      }
    } catch (e) { /* noop */ }
    try {
      if (document.referrer) {
        return new URL(document.referrer).origin;
      }
    } catch (e) { /* noop */ }
    return '*';
  };

  const postMessage = (type, message, token) => {
    const origin = getParentOrigin();
    const {command, watchId} = message;
    try {
          parent.postMessage(JSON.stringify({ // 互換のため冗長
          id: 'ZenzaWatch',
          type,
          token,
          body: {
            token,
            url: location.href,
            message: {command, watchId},
            command: 'message', params: {
              command, params: { watchId }
            }
          }
        }),
        origin);
    } catch (e) {
      alert(e);
      console.log('err', e);
    }
  };

  const __css__ = (`
    #zenzaButton {
      position: fixed;
      left: 0;
      top: 0;
      z-index: 10000;
      line-height: 24px;
      padding: 4px 4px;
      cursor: pointer;
      font-weight: bolder;
      display: none;
    }
    body:hover #zenzaButton {
      display: inline-block;
    }
  `).trim();

  const blogPartsApi = () => {
    // location.hrefだと大百科等が付与するクエリ文字列（nicopedia_from等）まで
    // videoIdの一部として拾ってしまい、壊れたwatchId（例: "sm9?nicopedia_from=..."）を
    // ZenzaWatch本体に渡してしまうバグがあった。クエリを含まないlocation.pathnameから
    // 取得するよう修正。
    const [watchId] = location.pathname.split('/').reverse();

    // 旧実装はdocument.referrerの文字列を'/'分割してホスト名を取り出し、
    // '.nicovideo.jp'で終わるかどうかで「埋め込み元が身内かどうか」を判定していた。
    // しかしdocument.referrerはサイト側のReferrer-Policy設定次第で空文字列になり得て、
    // その場合''.split('/')の結果からホスト名相当の要素が取れず、
    // parentHost.endsWith(...)が「undefinedはendsWithを持たない」TypeErrorで例外になり、
    // blogPartsApi()全体がそこで停止して「Zen」ボタンが一切追加されなくなっていた
    // （大百科で動画が開けなくなっていた原因）。
    // 「iframeとして他ページに埋め込まれているかどうか」はwindow.top === windowで
    // 判定でき、Referrer-Policyの影響を受けないため、これに置き換えた。
    if (window.top === window) {
      window.console.log('disable bridge');
      return;
    }

    addStyle(__css__);
    const button = document.createElement('button');
    button.innerHTML = '<span>Zen</span>';
    button.id = 'zenzaButton';
    document.body.append(button);
    button.onclick = e => { if(!e.isTrusted)return; const parentOrigin=getParentOrigin(); if(parentOrigin==='*')externalModules.blog.sendBlogClick(window,{get:GM_getValue,set:GM_setValue,remove:GM_deleteValue},watchId,e); if(parentOrigin !== '*' && !/(^|\.)nicovideo\.jp$/.test(new URL(parentOrigin).hostname)){ externalModules.blog.sendBlogClick(window,{get:GM_getValue,set:GM_setValue,remove:GM_deleteValue},watchId,e); return; }
      postMessage('blogParts', {
        command: e.shiftKey ? 'send' : 'open',
        watchId
      });
    };
  };

  blogPartsApi();
})(globalThis ? globalThis.window : window);
   return;
 }

 const official=/(^|\.)nicovideo\.jp$/.test(location.hostname);
 const playerFrame=window!==window.top&&window.name==='ZenzaWatchExternalTrialPlayer'&&location.hostname==='www.nicovideo.jp'&&location.pathname==='/robots.txt';
 const loader=window!==window.top&&((location.hostname==='www.nicovideo.jp'&&location.pathname==='/robots.txt'&&window.name.startsWith('nicovideoApiZenzaWatchExternalTrialLoader'))||(location.hostname==='ext.nicovideo.jp'&&window.name.startsWith('thumbInfoZenzaWatchExternalTrialLoader')));
 const externalSettingsHost=(()=>{try{return new URL(playerFrame?document.referrer:location.href).hostname;}catch{return '';}})();
 const gm={get:key=>GM_getValue(key),set:(key,value)=>GM_setValue(key,value),remove:key=>GM_deleteValue(key),
   listen:(key,fn)=>GM_addValueChangeListener(key,fn),unlisten:id=>GM_removeValueChangeListener(id)};
 const externalSlot='external-links-v1';
 const readExternalValues=()=>externalModules.settings.sanitizeExternal(gm.get(externalSlot));
 let notifySettings=()=>{};
 const writeExternal=patch=>{const current=readExternalValues(),next=externalModules.settings.sanitizeExternal({...current,...patch});if(JSON.stringify(current)!==JSON.stringify(next)){gm.set(externalSlot,next);notifySettings(next);}};
 'use strict';
// Only registered preferences cross partitions; never arbitrary storage/history.
function createDisplaySettings(w, gm, registered=[]) {
  const slot='settings-v2',savedSlot='trial-settings-v2',prefix='ZenzaWatchExternalTrial_';
  const names=new Set([...registered,'screenMode','menuScale','videoHeader.position']);
  const excluded=new Set(['debug','message','lastPlayerId','lastWatchId','videoSearch.word']);
  const allowed=k=>!excluded.has(k)&&(names.has(k)||/^(?:ui\.|KEY_|PARAM_CUSTOM_SEEK_\d+$|commentHistory\.|video\.hls\.)/.test(k));
  function valid(value,depth=0){
    if(depth>12)return false;
    if(value===null||typeof value==='boolean')return true;
    if(typeof value==='number')return Number.isFinite(value);
    if(typeof value==='string')return value.length<=32768;
    if(Array.isArray(value))return value.length<=2000&&value.every(v=>valid(v,depth+1));
    if(value&&typeof value==='object')return Object.keys(value).length<=2000&&Object.entries(value).every(([k,v])=>!['__proto__','constructor','prototype'].includes(k)&&valid(v,depth+1));
    return false;
  }
  const clean=values=>Object.fromEntries(Object.entries(values||{}).filter(([k,v])=>allowed(k)&&valid(v)&&JSON.stringify(v).length<=131072));
  const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  function read(storagePrefix){
    const values={};
    for(let i=0;i<w.localStorage.length;i++){
      const key=w.localStorage.key(i);if(!key.startsWith(storagePrefix))continue;
      const name=key.slice(storagePrefix.length);if(!allowed(name))continue;
      try{values[name]=JSON.parse(w.localStorage.getItem(key));}catch(_){}
    }
    return clean(values);
  }
  function publish(){
    if(w!==w.top||w.location.origin!=='https://www.nicovideo.jp')return;
    try{gm.set(slot,{version:2,publishedAt:Date.now(),values:read('ZenzaWatch_')});}catch(_){}
  }
  let official={},baseline={},publishOfficial=false,active=false,timer=null;
  function apply(){
    const snapshot=gm.get(slot),saved=gm.get(savedSlot);
    official=clean(snapshot?.version===2?snapshot.values:saved?.official);
    let values=saved?.version===2?clean(saved.values):read(prefix);
    const previous=clean(saved?.official);
    baseline=clean(saved?.values);publishOfficial=snapshot?.version===2;
    // Unrelated official changes must not reset trial HLS/panel adjustments.
    for(const key of new Set([...Object.keys(previous),...Object.keys(official)])){
      if(!saved||!equal(previous[key],official[key])){
        if(Object.hasOwn(official,key))values[key]=official[key];else delete values[key];
      }
    }
    for(const key of Object.keys(w.localStorage))if(key.startsWith(prefix)&&allowed(key.slice(prefix.length)))w.localStorage.removeItem(key);
    for(const [key,value] of Object.entries(values))w.localStorage.setItem(prefix+key,JSON.stringify(value));
    active=true;save();return snapshot?.version===2;
  }
  const storageTiming={saveCount:0,totalSaveMs:0,maxSaveMs:0};
  function save(){
    if(!active)return;
    const started=w.performance.now();
    if(timer!==null){w.clearTimeout(timer);timer=null;}
    const latest=gm.get(savedSlot),values=clean(latest?.values),local=read(prefix);
    // Another external page may have saved since this player opened. Merge
    // only local changes; closing a stale player must not revert them.
    for(const key of new Set([...Object.keys(baseline),...Object.keys(local)])){
      if(!equal(baseline[key],local[key])){
        if(Object.hasOwn(local,key))values[key]=local[key];else delete values[key];
      }
    }
    gm.set(savedSlot,{version:2,official:publishOfficial?official:clean(latest?.official),values});
    baseline=local;publishOfficial=false;
    const duration=w.performance.now()-started;storageTiming.saveCount++;storageTiming.totalSaveMs+=duration;storageTiming.maxSaveMs=Math.max(storageTiming.maxSaveMs,duration);
  }
  function scheduleSave(){
    if(!active||timer!==null)return;
    timer=w.setTimeout(()=>{timer=null;save();},250);
  }
  // Explicit player close also flushes: removed frames may skip pagehide.
  w.addEventListener('pagehide',save);
  function diagnostics(config){
    const snapshot=gm.get(slot),values=read(prefix),runtimeMismatch=[];
    if(config)for(const key of Object.keys(values))if(config.getKeys().includes(key)&&!equal(values[key],config.getStoredValue?config.getStoredValue(key):config.getValue(key)))runtimeMismatch.push(key);
    return {sourceAvailable:snapshot?.version===2,sourceSettingCount:Object.keys(clean(snapshot?.values)).length,
      sourceAgeSeconds:typeof snapshot?.publishedAt==='number'?Math.round((Date.now()-snapshot.publishedAt)/1000):null,
      localSettingCount:Object.keys(values).length,runtimeMismatch,
      officialDifferent:Object.keys(official).filter(key=>!equal(official[key],values[key])),
      storageTiming:Object.fromEntries(Object.entries(storageTiming).map(([key,value])=>[key,Math.round(value*10)/10])),
      playerCount:w.document.querySelectorAll('.zenzaPlayerContainer').length};
  }
  function migrate(snapshot) {
    if(!snapshot||typeof snapshot!=='object')return;
    if(!gm.get(slot)&&snapshot.official?.version===2)
      gm.set(slot,{version:2,publishedAt:Date.now(),values:clean(snapshot.official.values)});
    if(!gm.get(savedSlot)&&snapshot.saved?.version===2)
      gm.set(savedSlot,{version:2,official:clean(snapshot.saved.official),values:clean(snapshot.saved.values)});
  }
  return {publish,apply,save,scheduleSave,diagnostics,migrate};
}

 const displaySettings=createDisplaySettings(window,gm,["externalLinks.enabled","externalLinks.siteMode","externalLinks.sites","externalLinks.excludedSites","externalLinks.displayMode","externalLinks.size","externalLinks.redirects","externalLinks.textIds","externalLinks.prefixes","externalLinks.preflight","volume","showComment","autoPlay","autoPlay:ginza","autoPlay:others","enableResume","resume.recordEnabled","resume.clearOnComplete","bookmark.showToolbarButton","bookmark.showVideoThumbnails","bookmark.showScenePreviews","bookmark.thumbnailWidth","bookmark.titleFontSize","bookmark.titleLines","abRepeat.enabled","loop","mute","screenMode","screenMode:ginza","screenMode:others","autoFullScreen","autoCloseFullScreen","continueNextPage","backComment","autoPauseCommentInput","sharedNgLevel","enablePushState","enableHeatMap","pipPageThumbnail","pipPageThumbnailSource","enableCommentPreview","enableAutoMylistComment","menuScale","enableTogglePlayOnClick","enableDblclickClose","smallModeOffsetX","smallModeOffsetY","smallModeWidth","smallModeHeight","smallModeAspectLock","enableFullScreenOnDoubleClick","storyboardCacheMaxMB","storyboardCacheDays","savedSceneFetch","enableStoryboard","enableStoryboardBar","popup.notifyColor","popup.alertColor","popup.warningColor","notificationHistory.enabled","notificationHistory.commentText","notificationHistory.level.info","notificationHistory.level.success","notificationHistory.level.warning","notificationHistory.level.error","notificationHistory.record.general","notificationHistory.record.player","notificationHistory.record.comment","notificationHistory.record.like","notificationHistory.record.mylist","notificationHistory.record.playlist","notificationHistory.record.search","notificationHistory.record.storyboard","notificationHistory.record.tags","notificationHistory.record.advertising","notificationHistory.record.related","notificationHistory.record.network","notificationHistory.record.system","popup.backgroundTransparency","videoInfoPanelTab","fullscreenControlBarMode","controlBar.showOnPause.small","controlBar.showOnPause.fullscreen","controlBar.hideAfterSeconds.small","controlBar.hideAfterSeconds.fullscreen","relatedMenu.customLinks","relatedMenu.order","relatedMenu.hiddenItems","relatedMenu.builtinOptions","forceEconomy","enableFilter","wordFilter","wordRegFilter","wordRegFilterFlags","userIdFilter","commandFilter","removeNgMatchedUser","ngComposite.rules","filter.fork0","filter.fork1","filter.fork2","filter.fork3","filter.defaultThread","filter.ownerThread","filter.communityThread","filter.nicosThread","filter.easyThread","filter.aiThread","filter.extraDefaultThread","filter.extraOwnerThread","filter.extraCommunityThread","filter.extraNicosThread","filter.extraEasyThread","videoTagFilter","videoOwnerFilter","enableCommentPanel","enableCommentPanelAutoScroll","commentSpeedRate","autoCommentSpeedRate","playlistLoop","playlist.maxItems","enableAdDecoration","debugCheckAdDecoration","commentLanguage","baseFontFamily","baseChatScale","baseFontBolder","cssFontWeight","allowOtherDomain","overrideWatchLink","overrideWatchLink:allowPropagation","overrideWatchLink:others","speakLark","speakLarkVolume","enableSingleton","loadLinkedChannelVideo","commentLayerOpacity","commentLayer.textShadowType","commentLayer.enableSlotLayoutEmulation","commentLayer.maxDisplayComment","commentLayer.protectCA","commentLayer.ownerCommentShadowColor","commentLayer.easyCommentOpacity","commentLayer.aiCommentOpacity","overrideGinza","enableGinzaSlayer","playbackRate","enableVideoSession","videoServerType","autoDisableNew","dmcVideoQuality","domandVideoQuality","video.hls.enableOnlyRequired","enableNicosJumpVideo","videoSearch.ownerOnly","videoSearch.mode","videoSearch.order","videoSearch.sort","videoSearch.f_range","videoSearch.l_range","videoSearch.genre","videoSearch.selectContentType","videoSearch.videoIdSuggestMode","videoSearch.wordCountMode","videoHeader.position","uaa.enable","audio.autoAdjust","supporterCredit.enable","supporterCredit.voice","supporterCredit.gift","supporterCredit.skipInPlaylist","screenFilter.enable","screenFilter.saved","screenFilter.bloom","screenFilter.bloomThreshold","screenFilter.bloomRadius","screenFilter.posterize","screenFilter.edge","screenFilter.edgeStyle","screenFilter.rgbShift","screenFilter.grain","screenFilter.grainSize","screenFilter.scanlines","screenFilter.scanlineSpacing","screenFilter.userPresets","screenFilter.showDescriptions","screenFilter.showAdjustments","screenFilter.renderQuality","screenFilter.changedOnly","screenFilter.splitPosition","screenFilter.presetOrder","screenFilter.brightness","screenFilter.contrast","screenFilter.saturate","screenFilter.sepia","screenFilter.hue","screenFilter.blur","screenFilter.invert","screenFilter.gamma","screenFilter.blackLevel","screenFilter.whiteLevel","screenFilter.sharpen","screenFilter.temperature","screenFilter.tint","screenFilter.autoLevels","screenFilter.vignette","screenFilter.colorize","screenFilter.flipH","screenFilter.flipV","screenFilter.applyToScreenshot","screenFilter.applyToCommentPip","screenshot.prefix","screenshot.filenameTemplate","search.limit","touch.enable","touch.tap2command","touch.tap3command","touch.tap4command","touch.tap5command","autoZenTube","bestZenTube","KEY_CLOSE","KEY_RE_OPEN","KEY_HOME","KEY_SEEK_LEFT","KEY_SEEK_RIGHT","KEY_SEEK_PREV_FRAME","KEY_SEEK_NEXT_FRAME","KEY_VOL_UP","KEY_VOL_DOWN","KEY_INPUT_COMMENT","KEY_FULLSCREEN","KEY_MUTE","KEY_TOGGLE_COMMENT","KEY_TOGGLE_LOOP","KEY_DEFLIST_ADD","KEY_DEFLIST_REMOVE","KEY_TOGGLE_PLAY","KEY_TOGGLE_PLAYLIST","KEY_SCREEN_MODE_1","KEY_SCREEN_MODE_2","KEY_SCREEN_MODE_3","KEY_SCREEN_MODE_4","KEY_SCREEN_MODE_5","KEY_SCREEN_MODE_6","KEY_SHIFT_RESET","KEY_SHIFT_DOWN","KEY_SHIFT_UP","KEY_NEXT_VIDEO","KEY_PREV_VIDEO","KEY_SCREEN_SHOT","KEY_SCREEN_SHOT_WITH_COMMENT","sceneSearch.presentation.normal","sceneSearch.presentation.fullscreen","sceneSearch.presentation.migrationAcknowledged","sceneSearch.layout.normal","sceneSearch.layout.fullscreen","sceneSearch.layout.linkFullscreen","sceneSearch.seekStepSeconds","sceneSearch.idleHideSeconds","sceneSearch.controlsReveal","sceneSearch.animation","sceneSearch.enabled","sceneSearch.commentListScale","sceneSearch.commentPreviewVisible","sceneSearch.miniCommentVisible","sceneSearch.commentListVisible","sceneSearch.commentListBackgroundOpacity","sceneSearch.thumbnailScale","sceneSearch.miniCommentMode"]);

 if(official&&!playerFrame){
   const disconnect=typeof GM_addValueChangeListener==='function'?externalModules.officialSettings.connectOfficialExternalSettings(window,gm):()=>{};
   displaySettings.publish();window.addEventListener('pagehide',()=>{disconnect();displaySettings.publish();},{once:true});return;
 }
 if(window!==window.top&&!playerFrame)return;
 'use strict';

// Private userscript storage carries messages. No ports, API responses or
// authentication capabilities are sent through window.postMessage / DOM events.
function createPrivateTransport(w, gm, onDispose=()=>{}) {
  const ports=new Set();let disposed=false;
  function dispose(keep){
    if(disposed)return;disposed=true;
    for(const p of [...ports])if(p!==keep)p.close();
    onDispose();
  }
  w.addEventListener('pagehide',()=>dispose(),{once:true});
  let frameTicket=null,framePort=null;
  async function pack(value) {
    if(value instanceof w.ArrayBuffer) return {zwType:'buffer',bytes:Array.from(new w.Uint8Array(value))};
    if(w.Blob && value instanceof w.Blob) return {zwType:'blob',mime:value.type,bytes:Array.from(new w.Uint8Array(await value.arrayBuffer()))};
    if(ArrayBuffer.isView(value))return {zwType:'buffer',bytes:Array.from(new Uint8Array(value.buffer,value.byteOffset,value.byteLength))};
    if(value instanceof w.Date)return {zwType:'date',value:value.toISOString()};
    if(Array.isArray(value))return Promise.all(value.map(pack));
    if(value&&typeof value==='object')return {zwType:'object',entries:await Promise.all(Object.entries(value).map(async([k,v])=>[k,await pack(v)]))};
    return value===undefined?{zwType:'undefined'}:value;
  }
  function unpack(value) {
    if(Array.isArray(value))return value.map(unpack);
    if(!value||typeof value!=='object')return value;
    if(value.zwType==='buffer')return new w.Uint8Array(value.bytes).buffer;
    if(value.zwType==='blob')return new w.Blob([new w.Uint8Array(value.bytes)],{type:value.mime});
    if(value.zwType==='date')return new w.Date(value.value);
    if(value.zwType==='undefined')return undefined;
    if(value.zwType==='object')return Object.fromEntries(value.entries.map(([k,v])=>[k,unpack(v)]));
    throw Error('INVALID_PRIVATE_PACKET');
  }
  function port(channel,side,onClose=()=>{}) {
    if(disposed)throw Error('TRANSPORT_CLOSED');
    const incoming=channel+(side==='parent'?':f':':p'),outgoing=channel+(side==='parent'?':p':':f');
    const listeners={message:new Set(),messageerror:new Set()};let closed=false,queue=Promise.resolve(),seq=0,last=0;
    const emit=(kind,event)=>{for(const fn of [...listeners[kind]]){fn(event);if(event.stopped)break;}};
    const listener=gm.listen(incoming,(_key,_old,packet)=>{
      if(closed||!packet||!Number.isSafeInteger(packet.seq)||packet.seq<=last)return;
      last=packet.seq;
      if(packet.closed){api.close(false);return;}
      try {emit('message',{data:unpack(packet.data),stopImmediatePropagation(){this.stopped=true;}});}
      catch(_){emit('messageerror',{});}
      finally {if(gm.get(incoming)?.seq===packet.seq)gm.remove(incoming);}
    });
    const api={
      postMessage(data){queue=queue.then(async()=>{if(closed)return;const encoded=await pack(data);if(!closed)gm.set(outgoing,{seq:++seq,data:encoded});})
        .catch(()=>{if(!closed)emit('messageerror',{});});return queue;},
      addEventListener(kind,fn){listeners[kind]?.add(fn);},
      removeEventListener(kind,fn){listeners[kind]?.delete(fn);},start(){},
      close(notify=true){
        if(closed)return;closed=true;gm.unlisten(listener);ports.delete(api);
        listeners.message.clear();listeners.messageerror.clear();
        if(notify)gm.set(outgoing,{seq:++seq,closed:true});
        gm.remove(incoming);gm.remove(outgoing);onClose();
      }
    };
    ports.add(api);return api;
  }
  const origin=value=>{try{return new URL(value).origin;}catch(_){return null;}};
  function acceptFrame() {
    const match=/^(nicovideoApi|thumbInfo)ZenzaWatchExternalTrialLoader(?:#(.*))?$/.exec(w.name);
    if(!match||w===w.top)return false;
    const type=match[1],token=w.location.hash.slice(1),key='ticket:'+type+':'+token;
    const ticket=gm.get(key);
    if(!ticket||ticket.claimed||ticket.expires<Date.now()||ticket.type!==type||
      ticket.frameOrigin!==w.location.origin||ticket.origin!==origin(w.document.referrer||match[2]))return false;
    gm.set(key,{...ticket,claimed:true});frameTicket=ticket;
    framePort=port(ticket.channel,'frame',()=>dispose());
    w.addEventListener('pagehide',()=>framePort.close(),{once:true});
    return true;
  }
  function connectGate(gate,token,product) {
    const frame=w.document.createElement('iframe'),generation=gate._generation;
    const type=gate._type,key='ticket:'+type+':'+token;
    const ticket={type,origin:w.location.origin,frameOrigin:new URL(gate._baseUrl).origin,
      channel:'zw-private:'+w.crypto.randomUUID(),expires:Date.now()+60000,claimed:false};
    gm.set(key,ticket);
    const p=port(ticket.channel,'parent',()=>gm.remove(key));gate._pendingPrivatePort=p;
    const initial=e=>{
      if(generation!==gate._generation)return;
      gate._onMessage({...e,ports:[p]});
      if(gate._initializeStatus==='done'){p.removeEventListener('message',initial);gm.remove(key);}
    };
    p.addEventListener('message',initial);
    gate.loaderFrame=frame;frame.name=type+product+'Loader#'+w.location.origin;
    frame.referrerPolicy='origin';frame.sandbox='allow-scripts allow-same-origin';
    frame.style.cssText='position:fixed;left:-10000px;top:-10000px;width:1px;height:1px;visibility:hidden;pointer-events:none';
    frame.src=gate._baseUrl+'#'+token;
    (w.document.body||w.document.documentElement).append(frame);gate._loaderWindow=frame.contentWindow;
    gate._frameObserver=new w.MutationObserver(()=>{if(generation===gate._generation&&!frame.isConnected)gate._disconnect(Error('Gate frame removed'));});
    gate._frameObserver.observe(frame.parentNode,{childList:true});
  }
  let posted=false,frameType=null,frameToken=null;
  function postGate(body,{type,token,sessionId=''}={}) {
    if(!framePort)throw Error('PRIVATE_FRAME_REQUIRED');
    frameType=type||frameType;frameToken=token||frameToken;
    const message={id:'ZenzaWatchExternalTrial',type:frameType,token:frameToken,sessionId,body};
    if(!posted){message.body={command:'initialized',params:body};posted=true;}
    framePort.postMessage(message);return framePort;
  }
  return {acceptFrame,connectGate,postGate,dispose,
    isEnabledOrigin:value=>!!frameTicket&&origin(value)===frameTicket.origin,
    // Tests use this constructor with isolated mock GM stores, not page globals.
    port};
}


 'use strict';

function createGmNetwork(request) {
  let disposed=false;const active=new Set();
  function permitted(value) {
    const u=new URL(value);
    if(u.protocol!=='https:'||u.username||u.password||u.port||
      /^(?:account|point)\.nicovideo\.jp$/.test(u.hostname)||
      !['nicovideo.jp','nimg.jp','dmc.nico'].some(h=>u.hostname===h||u.hostname.endsWith('.'+h)))
      throw Error('GM_DESTINATION_DENIED');
    return u.href;
  }
  async function gmFetch(resource, options={}) {
    if(disposed)throw new DOMException('Closed','AbortError');
    const isRequest=typeof Request!=='undefined' && resource instanceof Request;
    const url=permitted(isRequest?resource.url:String(resource));
    const method=options.method||(isRequest?resource.method:'GET');
    const signal=options.signal||(isRequest?resource.signal:undefined);
    const headers=Object.fromEntries(new Headers(options.headers||(isRequest?resource.headers:undefined)));
    for(const key of Object.keys(headers))if(/^(cookie|host|authorization|proxy-authorization)$/i.test(key))throw Error('GM_HEADER_DENIED');
    let data=options.body;
    if(data===undefined && isRequest && !/^(GET|HEAD)$/i.test(method))data=await resource.clone().arrayBuffer();
    return new Promise((resolve,reject)=>{
      let handle,done=false,timer;
      if(disposed){reject(new DOMException('Closed','AbortError'));return;}
      const finish=(error,value)=>{if(done)return;done=true;active.delete(abort);clearTimeout(timer);signal?.removeEventListener('abort',abort);error?reject(error):resolve(value);};
      const abort=()=>{finish(signal?.reason||new DOMException('Aborted','AbortError'));handle?.abort();};
      const timeout=()=>{finish(new DOMException('GM request timed out','TimeoutError'));handle?.abort();};
      if(signal?.aborted){abort();return;}
      active.add(abort);
      signal?.addEventListener('abort',abort,{once:true});
      const ms=options.timeout===0?0:(options.timeout||30000);
      if(ms>0)timer=setTimeout(timeout,ms);
      try {
        handle=request({url,method,headers,data,responseType:'arraybuffer',
          anonymous:options.credentials==='omit',redirect:'error',nocache:options.cache==='no-store',
          onload:r=>{
            if(done)return;
            try {
              permitted(r.finalUrl||url);
              if(r.status<200||r.status>599||r.status>=300&&r.status<400)throw Error('GM_INVALID_RESPONSE');
              const h=new Headers();
              for(const line of (r.responseHeaders||'').split(/\r?\n/)){
                const i=line.indexOf(':');if(i>0 && !/^set-cookie2?$/i.test(line.slice(0,i)))h.append(line.slice(0,i),line.slice(i+1).trim());
              }
              const res=new Response([204,205,304].includes(r.status)||method==='HEAD'?null:r.response,{status:r.status,statusText:r.statusText||'',headers:h});
              Object.defineProperty(res,'url',{value:r.finalUrl||url});finish(null,res);
            } catch(e){finish(e);}
          },onerror:()=>finish(Error('GM_NETWORK_ERROR')),ontimeout:timeout,
          onabort:()=>finish(new DOMException('Aborted','AbortError'))});
      } catch(e){finish(e);}
    });
  }
  class Loader {
    constructor(){this.context=null;this.controller=null;this.stats=this.newStats();}
    newStats(){return {aborted:false,loaded:0,total:0,retry:0,chunkCount:0,bwEstimate:0,loading:{start:0,first:0,end:0},parsing:{start:0,end:0},buffering:{start:0,first:0,end:0}};}
    load(context,config,callbacks){
      this.abort();this.context=context;this.callbacks=callbacks;
      const stats=this.stats;Object.assign(stats,this.newStats());
      const controller=this.controller=new AbortController();stats.loading.start=performance.now();
      // GM arraybuffer delivery is buffered. Use total elapsed time for a
      // conservative throughput estimate rather than reporting zero transfer time.
      stats.loading.first=stats.loading.start;
      const headers={...context.headers};if(Number.isFinite(context.rangeEnd)&&context.rangeEnd>(context.rangeStart||0))headers.Range=`bytes=${context.rangeStart||0}-${context.rangeEnd-1}`;
      const timeout=config.timeout||config.loadPolicy?.maxLoadTimeMs||30000;
      gmFetch(context.url,{headers,signal:controller.signal,timeout,credentials:'include'}).then(async response=>{
        if(this.controller!==controller||stats.aborted)return;
        if(!response.ok){this.controller=null;callbacks.onError({code:response.status,text:'HLS HTTP '+response.status},context,null,stats);return;}
        const bytes=await response.arrayBuffer();if(this.controller!==controller||stats.aborted)return;
        const now=performance.now();stats.loading.end=now;stats.loaded=stats.total=bytes.byteLength;stats.chunkCount=1;
        const data=context.responseType==='arraybuffer'?bytes:new TextDecoder().decode(bytes);
        this.controller=null;
        callbacks.onSuccess({url:response.url,data,code:response.status},stats,context,null);
      }).catch(error=>{
        if(this.controller!==controller||stats.aborted)return;
        this.controller=null;
        if(error.name==='TimeoutError')callbacks.onTimeout(stats,context,null);
        else callbacks.onError({code:0,text:'HLS GM transport failed'},context,null,stats);
      });
    }
    abort(){if(this.controller){const controller=this.controller;this.controller=null;this.stats.aborted=true;controller.abort();this.callbacks?.onAbort?.(this.stats,this.context,null);}}
    destroy(){this.abort();this.context=null;this.callbacks=null;}
    getCacheAge(){return null;}
    getResponseHeader(){return null;}
  }
  return {fetch:gmFetch,Loader,dispose(){if(disposed)return;disposed=true;for(const abort of [...active])abort();}};
}


 const {finishPlayerClose}=(()=>{const exports={};"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.finishPlayerClose = finishPlayerClose;
/** Give already-requested saves a bounded opportunity to finish before disposal. */
async function finishPlayerClose(pendingSaves, actions, timeoutMs = 2000) {
    const saved = Promise.allSettled(pendingSaves);
    let timeout;
    try {
        await actions.hide();
        await Promise.race([saved, new Promise(resolve => {
                timeout = setTimeout(resolve, timeoutMs);
            })]);
    }
    finally {
        clearTimeout(timeout);
        try {
            actions.dispose();
        }
        finally {
            await actions.finish();
        }
    }
}
;return exports;})();
 'use strict';

const {installPlayerBackground}=externalModules.background;
const {validVideoId}=externalModules.targets;
// A cross-origin document is the CSS boundary. Account capabilities stay there.
function createPlayerHost(w,gm,transport,session,onStopped=()=>{}) {
  let frame,port,ticketKey,pending,sequence=0,closing=false,closeTimer,closingTask;
  const stop=(error=Error('PLAYER_CLOSED'))=>{
    const closingPort=port,closingFrame=frame,closingTicket=ticketKey,request=pending;
    port=null;frame=null;ticketKey=null;pending=null;closing=false;
    clearTimeout(closeTimer);
    request?.reject(error);closingPort?.close();closingFrame?.remove();
    if(closingTicket)gm.remove(closingTicket);
    if(closingFrame)onStopped();
  };
  async function open(id,event) {
    if(!event?.isTrusted)throw Error('USER_CLICK_REQUIRED');
    if(!validVideoId(id))throw Error('INVALID_VIDEO_ID');
    if(pending||closing)throw Error('PLAYER_BUSY');
    if(frame&&!frame.isConnected)stop();
    return new Promise((resolve,reject)=>{
      const requestId=++sequence;
      const timer=w.setTimeout(()=>{stop(Error('PLAYER_TIMEOUT'));},60000);
      pending={resolve:()=>{w.clearTimeout(timer);pending=null;resolve();},reject:e=>{w.clearTimeout(timer);pending=null;reject(e);}};
      const send=()=>port.postMessage(closing?{type:'request-close'}:{type:'open',id,requestId});
      if(frame){send();return;}
      const token=w.crypto.randomUUID();ticketKey='player:'+token;
      const channel='zw-player:'+w.crypto.randomUUID();
      gm.set(ticketKey,{channel,origin:w.location.origin,expires:Date.now()+60000});
      port=transport.port(channel,'parent',()=>stop());
      port.addEventListener('message',e=>{
        const data=e.data;
        if(data?.type==='ready'){gm.remove(ticketKey);send();}
        else if(data?.type==='closing' && frame){
          closing=true;frame.style.setProperty('display','none','important');
          clearTimeout(closeTimer);closeTimer=setTimeout(()=>stop(),4000);
        }
        else if(data?.type==='closed')stop();
        else if(!closing && data?.requestId===sequence && data.type==='opened')pending?.resolve();
        else if(!closing && data?.requestId===sequence && data.type==='error'){
          const error=Error(['LOGIN_REQUIRED','AUTH_FORBIDDEN','AUTH_TIMEOUT','GM_NETWORK_ERROR','MAIN_PLAYER_UNAVAILABLE'].includes(data.code)?data.code:'PLAYER_START_FAILED');
          error.stage=['BOOT','SETTINGS','AUTH','UI','VIDEO'].includes(data.stage)?data.stage:'BOOT';
          stop(error);
        }
      });
      frame=w.document.createElement('iframe');frame.name='ZenzaWatchExternalTrialPlayer';
      frame.setAttribute('data-zenza-player-host','');frame.title='ZenzaWatch';frame.allow='autoplay; fullscreen';frame.referrerPolicy='origin';
      frame.src='https://www.nicovideo.jp/robots.txt#'+token;
      for(const [key,value] of Object.entries({all:'initial',position:'fixed',inset:'0',width:'100vw',height:'100vh',border:'0',margin:'0',padding:'0',display:'block',background:'transparent','z-index':'2147483646'}))frame.style.setProperty(key,value,'important');
      w.document.body.append(frame);
    });
  }
  function accept() {
    if(w===w.top||w.name!=='ZenzaWatchExternalTrialPlayer'||w.location.origin!=='https://www.nicovideo.jp'||w.location.pathname!=='/robots.txt')return false;
    const key='player:'+w.location.hash.slice(1),ticket=gm.get(key);
    let origin;try{origin=new URL(w.document.referrer).origin;}catch(_){return false;}
    if(!ticket||ticket.claimed||ticket.expires<Date.now()||ticket.origin!==origin)return false;
    gm.set(key,{...ticket,claimed:true});port=transport.port(ticket.channel,'frame',()=>transport.dispose?.());
    w.document.head.replaceChildren();w.document.body.replaceChildren();
    w.document.documentElement.style.cssText='background:#111;color:#ddd;font:16px sans-serif;';
    w.document.body.style.cssText='margin:0;background:#111;';
    installPlayerBackground(w.document);
    const status=w.document.createElement('div');status.style.cssText='position:fixed;top:24px;left:24px;z-index:2147483647;color:#eee;background:#17212d;padding:16px;font:16px sans-serif';
    const labels={BOOT:'本体を準備しています',SETTINGS:'設定を接続しています',AUTH:'ログイン状態を確認しています',UI:'画面を準備しています',VIDEO:'動画を開いています'};
    status.textContent=labels.BOOT;w.document.body.append(status);
    session.setStageListener?.(stage=>{if(stage==='OPEN')status.remove();else status.textContent=labels[stage]||labels.BOOT;});
    let busy=false,last=0;
    port.addEventListener('message',async e=>{
      const m=e.data;if(m?.type==='request-close'){closing=true;if(!session.close?.())void closePlayer();return;}if(m?.type!=='open'||busy||!Number.isSafeInteger(m.requestId)||m.requestId<=last||!validVideoId(m.id))return;
      busy=true;last=m.requestId;const requestPort=port;
      try{await session.open(m.id,{isTrusted:true});if(closing||port!==requestPort)return;port.postMessage({type:'opened',requestId:m.requestId});}
      catch(error){if(closing||port!==requestPort)return;w.console?.warn('[Zenza external trial] startup failed',error.stage||'BOOT',error.name||'Error');port.postMessage({type:'error',requestId:m.requestId,code:error.message,stage:error.stage});}
      finally{busy=false;}
    });
    port.postMessage({type:'ready'});
    return true;
  }
  w.addEventListener('pagehide',stop,{once:true});
  const closePlayer=(pendingSaves=[])=>{
    if(closingTask)return closingTask;
    if(!port)return Promise.resolve();
    const closingPort=port;closing=true;
    closingTask=finishPlayerClose(pendingSaves,{
      hide:()=>closingPort.postMessage({type:'closing'}),
      dispose:()=>transport.dispose?.(closingPort),
      finish:async()=>{try{await closingPort.postMessage({type:'closed'});}finally{stop();}}
    });
    return closingTask;
  };
  return {open,accept,close:closePlayer,requestClose(){
    if(!frame||!port)return;
    closing=true;frame.style.setProperty('display','none','important');
    clearTimeout(closeTimer);closeTimer=setTimeout(()=>stop(),4000);
    void port.postMessage({type:'request-close'});
  }};
}

 const privateTransport=createPrivateTransport(window,gm);
 let closedResolve;
 const closed=new Promise(resolve=>{closedResolve=resolve;});
 const mainClient=playerFrame?externalModules.mainBridge.createMainPlayerClient(window,{
   snapshot:()=>({official:gm.get('settings-v2'),saved:gm.get('trial-settings-v2'),external:readExternalValues()}),
   onSettings:values=>writeExternal(externalModules.settings.sanitizeExternal(values)),
   onClosing:()=>{void playerHost.close([closed]);},
   onClosed:()=>{closedResolve();void playerHost.close();}
 }):null;
 const playerHost=createPlayerHost(window,gm,privateTransport,mainClient);
 if(playerFrame){
   notifySettings=values=>mainClient.updateSettings(values);
   const listener=gm.listen(externalSlot,()=>mainClient.updateSettings(readExternalValues()));
   window.addEventListener('pagehide',()=>{gm.unlisten(listener);mainClient.dispose();},{once:true});
   playerHost.accept();return;
 }
 // Only optional availability checking remains in the launcher. Playback,
 // account operations and HLS networking are exclusively in the main script.
 const preflightNetwork=createGmNetwork(options=>GM_xmlhttpRequest(options));
 let launcherHandle,openVideo,legacyActive=false;
 const mount=()=>{
   launcherHandle?.dispose();openVideo=null;if(legacyActive)return;
   const settings=externalModules.settings.readExternal(readExternalValues());
   const preflight=externalModules.preflight.createPreflight(preflightNetwork.fetch,DOMParser);
   let active=true;
   const open=async(id,event)=>{
     if(!event?.isTrusted)throw Error('USER_CLICK_REQUIRED');
     if(settings.preflight!=='off'&&await preflight.check(id)==='unavailable')throw Error('VIDEO_UNAVAILABLE');
     if(!active)throw Error('CLOSED');return playerHost.open(id,event);
   };
   const overlay=externalModules.overlay.mountOverlay(window,settings,open,preflight.check);
   const inline=externalModules.inline.mountInlineButtons(window,settings,open,preflight.check);
   openVideo=open;launcherHandle={dispose(){active=false;preflight.dispose();overlay.dispose();inline.dispose();}};
 };
 const stopBlog=externalModules.blog.receiveBlogClicks(window,{get:GM_getValue,set:GM_setValue,remove:GM_deleteValue},readExternalValues,(id,event)=>openVideo&&!legacyActive?openVideo(id,event):Promise.reject(Error('LAUNCHER_UNAVAILABLE')));
 mount();
 const stopCoexistence=externalModules.coexistence.watchLegacyTrial(window,()=>{legacyActive=true;launcherHandle?.dispose();openVideo=null;playerHost.requestClose();});
 const listener=typeof GM_addValueChangeListener==='function'?gm.listen(externalSlot,mount):null;
 if(typeof GM_registerMenuCommand==='function')GM_registerMenuCommand('外部サイトからの再生設定',()=>externalModules.panel.openExternalSettings(document,readExternalValues(),values=>{writeExternal(values);mount();}));
 window.addEventListener('pagehide',()=>{stopCoexistence();stopBlog();launcherHandle?.dispose();preflightNetwork.dispose();if(listener!==null)gm.unlisten(listener);},{once:true});
})();
