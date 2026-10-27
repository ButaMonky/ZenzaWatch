// Task318: responsive Zenza Dark shell for the new advanced settings.
// Source is deliberately isolated from the older SettingPanel until parity validation.
import { ModernAdvancedSettingsModel } from './ModernAdvancedSettingsModel';
//===BEGIN===
class ModernAdvancedSettingsUI {
    _updateSceneSettingsPreview() {
        const demo = this.cards?.querySelector('[data-zw-scene-demo]');
        if (!demo)
            return;
        const state = this._sceneDemoState, get = (key) => this.model.get('sceneSearch.' + key);
        const screen = state.screen, mode = get('presentation.' + (screen === 'fullscreen' && !get('layout.linkFullscreen') ? 'fullscreen' : 'normal'));
        const stage = demo.querySelector('[data-zw-demo-stage]');
        stage.dataset.screen = screen;
        for (const b of demo.querySelectorAll('[data-demo-screen]'))
            b.setAttribute('aria-pressed', String(b.dataset.demoScreen === screen));
        const panels = demo.querySelector('[data-zw-demo-panels]');
        panels.hidden = get('enabled') === false;
        const master = get('commentPreviewVisible') !== false, allowed = master && get('commentListVisible') !== false;
        const open = allowed && state.list, legacy = mode === 'legacy';
        const scale = Math.max(.5, Math.min(2, Number(get('thumbnailScale')) / 100 || 1));
        const listScale = Math.max(1, Math.min(2, Number(get('commentListScale')) / 100 || 1));
        const image = demo.querySelector('.zw-scene-demo-image'), thumb = demo.querySelector('.zw-scene-demo-thumb'), list = demo.querySelector('.zw-scene-demo-list');
        image.hidden = legacy && open;
        image.style.width = 120 * scale + 'px';
        image.style.height = 60 * scale + 'px';
        const mini = demo.querySelector('.zw-scene-demo-mini');
        mini.hidden = !master || get('miniCommentVisible') === false;
        mini.style.fontSize = 11 * scale + 'px';
        list.hidden = !open;
        list.style.width = 155 * listScale + 'px';
        list.style.height = 140 * listScale + 'px';
        list.style.backgroundColor = 'rgba(7,13,24,' + Math.max(0, Math.min(100, Number(get('commentListBackgroundOpacity')))) / 100 + ')';
        for (const row of list.querySelectorAll('div'))
            row.remove();
        for (let i = 0; i < 24; i++) {
            const row = this.doc.createElement('div');
            row.textContent = '01:' + String(20 + i).padStart(2, '0') + '  ' + ['この場面が好き', 'いいね！', 'もう一度見たい', 'ここから楽しみ'][i % 4];
            list.append(row);
        }
        if (legacy && open) {
            thumb.prepend(list);
            thumb.style.width = 155 * listScale + 'px';
        }
        else {
            panels.append(list);
            thumb.style.width = '';
        }
        const button = demo.querySelector('[data-demo-comments]');
        button.disabled = !allowed;
        button.setAttribute('aria-pressed', String(open));
        for (const b of demo.querySelectorAll('[data-demo-back],[data-demo-next]'))
            b.hidden = Number(get('seekStepSeconds')) === 0;
        const width = stage.clientWidth || 400, total = (legacy ? (open ? 155 * listScale : 120 * scale) : 120 * scale + (open ? 161 * listScale : 0)) + 4;
        panels.style.left = Math.max(6, Math.min(width - total - 6, mode === 'fixed' ? 10 : width * state.seek / 100 - total / 2)) + 'px';
        demo.querySelector('[data-demo-caption]').textContent = panels.hidden ? 'シーンサーチは非表示です。個別設定は保持されます。' :
            (legacy ? '従来表示：画像とコメントプレビューを切り替えます。' : mode === 'fixed' ? '位置を固定：同じ場所に表示します。' : 'シーク位置に追従：シーク先に合わせて動きます。') + ' 文字サイズを保ったまま、表示領域を調整します。';
    }
    _createSceneSettingsPanel(rows) {
        const wrap = this.doc.createElement('div');
        wrap.className = 'zw-scene-settings';
        const style = this.doc.createElement('style');
        style.textContent = `
      .zw-scene-settings{display:grid;grid-template-columns:minmax(280px,1fr) minmax(300px,1fr);gap:20px;align-items:start}
      .zw-scene-settings .zw-scui-layout-grid{grid-template-columns:repeat(3,minmax(0,1fr))}
      .zw-scene-settings .zw-scui-layout-option{background:#182b40;color:#dce8f6;border:1px solid #445b72;border-radius:10px;padding:10px;text-align:left;cursor:pointer}
      .zw-scene-settings .zw-scui-layout-option[aria-pressed=true]{background:#203f5b;border-color:#79c8f5;box-shadow:0 0 10px #68baff30}
      .zw-scene-settings .zw-scui-layout-option:disabled{opacity:.5;cursor:default}
      .zw-scene-settings .zw-scui-mini{height:68px;margin-bottom:8px}
      .zw-scene-settings .zw-scui-mini[data-layout=legacy] b{left:25%!important;width:50%}
      .zw-scene-settings .zw-scui-mini[data-layout=legacy] i{display:none}
      .zw-scene-settings h4{margin:22px 0 10px;color:#b9d7ee;font-size:14px}
      .zw-scene-settings .zw-modern-card{margin-bottom:10px}
      .zw-scene-settings .zw-scene-extra{margin-top:18px}
      .zw-scene-settings .zw-scene-extra summary{cursor:pointer;padding:12px 0}
      .zw-scene-demo{position:sticky;top:12px;background:#152336;border:1px solid #40566e;border-radius:14px;padding:16px;min-width:0}
      .zw-scene-demo p{color:#a9bdd2;font-size:12px;line-height:1.7}
      .zw-scene-demo button{background:#263d55;color:#e6f2ff;border:1px solid #506780;border-radius:7px;padding:7px 10px;cursor:pointer}
      .zw-scene-demo button[aria-pressed=true]{background:#346086;border-color:#8bd2ff}
      .zw-scene-demo button:focus-visible{outline:2px solid #93d7ff;outline-offset:2px}
      .zw-scene-demo nav{display:flex;gap:6px;margin:12px 0;flex-wrap:wrap}
      .zw-scene-demo-stage{height:340px;position:relative;overflow:hidden;background:#0a131f;border:1px solid #3d5067;border-radius:9px}
      .zw-scene-demo-video{position:absolute;inset:14px 28% 70px 10px;background:linear-gradient(150deg,#35657b,#203b55 45%,#766d55);display:grid;place-items:center;color:#d1e3eb;font-size:13px;border-radius:5px;transition:inset .15s}
      .zw-scene-demo-stage[data-screen=fullscreen] .zw-scene-demo-video{inset:0 0 30px;border-radius:0}
      .zw-scene-demo-stage[data-screen=small] .zw-scene-demo-video{inset:12px 42% 56% 12px}
      .zw-scene-demo-panels{position:absolute;bottom:40px;display:flex;gap:6px;align-items:flex-start;max-width:calc(100% - 12px)}
      .zw-scene-demo [hidden]{display:none!important}
      .zw-scene-demo-thumb{background:#0d1927;border:1px solid #48627b;border-radius:6px;overflow:hidden;flex:none}
      .zw-scene-demo-image{background:linear-gradient(145deg,#427d90,#213f57 55%,#c29a63);position:relative;overflow:hidden;display:grid;place-items:center;color:#b7cbd9}
      .zw-scene-demo-mini{position:absolute;left:8%;top:25%;white-space:nowrap;color:white;text-shadow:1px 1px 2px black;font-size:11px}
      .zw-scene-demo-time{text-align:center;padding:4px;font-size:11px;color:#d9e9f6}
      .zw-scene-demo-controls{display:flex;gap:3px;padding:0 3px 3px}
      .zw-scene-demo-controls button{flex:1;padding:5px 3px}
      .zw-scene-demo-list{box-sizing:border-box;border:1px solid #4f6882;border-radius:6px;overflow:hidden;flex-shrink:1;color:#e4edf6;font-size:11px;line-height:21px}
      .zw-scene-demo-list strong{display:block;padding:4px 7px;border-bottom:1px solid #52677b;font-size:11px}
      .zw-scene-demo-list div{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:0 7px}
      .zw-scene-demo-seek{position:absolute;bottom:9px;left:3%;width:94%;accent-color:#80caff}
      @media(max-width:1100px){.zw-scene-settings{grid-template-columns:minmax(0,1fr)}.zw-scene-demo{position:static;grid-row:1}}
    `;
        const controls = this.doc.createElement('div');
        controls.append(this._createSceneLayoutPicker());
        const remaining = new Map(rows.map(row => [row.dataset.zwId, row]));
        for (const [title, keys] of [
            ['画面ごとの表示', ['sceneSearch.layout.linkFullscreen']],
            ['表示するもの', ['sceneSearch.enabled', 'sceneSearch.commentPreviewVisible', 'sceneSearch.miniCommentVisible', 'sceneSearch.commentListVisible']],
            ['大きさと背景', ['sceneSearch.thumbnailScale', 'sceneSearch.commentListScale', 'sceneSearch.commentListBackgroundOpacity']],
            ['操作と自動非表示', ['sceneSearch.seekStepSeconds', 'sceneSearch.idleHideSeconds']]
        ]) {
            const heading = this.doc.createElement('h4');
            heading.textContent = title;
            controls.append(heading);
            for (const key of keys) {
                const row = remaining.get(key);
                if (row) {
                    controls.append(row);
                    remaining.delete(key);
                }
            }
        }
        if (remaining.size) {
            const extra = this.doc.createElement('details');
            extra.className = 'zw-scene-extra';
            const summary = this.doc.createElement('summary');
            summary.textContent = 'その他のシーンサーチ設定';
            extra.append(summary, ...remaining.values());
            controls.append(extra);
        }
        const demo = this.doc.createElement('aside');
        demo.className = 'zw-scene-demo';
        demo.dataset.zwSceneDemo = '';
        demo.setAttribute('aria-label', '設定のプレビュー');
        demo.innerHTML = '<strong>見ながら調整</strong><p>設定の見え方を確認する見本です。下のシークバーとコメントボタンを試せます。</p><nav aria-label="見本の画面"></nav><div class="zw-scene-demo-stage" data-zw-demo-stage><div class="zw-scene-demo-video">動画</div><div class="zw-scene-demo-panels" data-zw-demo-panels><div class="zw-scene-demo-thumb"><div class="zw-scene-demo-image">サムネイル<span class="zw-scene-demo-mini">ここ好き　いいね！</span></div><div class="zw-scene-demo-time">01:24</div><div class="zw-scene-demo-controls"><button type="button" data-demo-back aria-label="前へ">‹</button><button type="button" data-demo-comments aria-label="コメントプレビューを開閉">☁</button><button type="button" data-demo-next aria-label="次へ">›</button></div></div><div class="zw-scene-demo-list"><strong>コメントプレビュー</strong></div></div><input class="zw-scene-demo-seek" type="range" min="0" max="100" aria-label="見本のシーク位置"></div><p data-demo-caption></p>';
        this._sceneDemoState = this._sceneDemoState || { screen: 'normal', seek: 35, list: true };
        const nav = demo.querySelector('nav');
        for (const [screen, label] of [['normal', '通常表示'], ['fullscreen', '全画面'], ['small', '小画面']]) {
            const b = this.doc.createElement('button');
            b.type = 'button';
            b.textContent = label;
            b.dataset.demoScreen = screen;
            b.addEventListener('click', () => {
                this._sceneDemoState.screen = screen;
                this._sceneLayoutTab = screen === 'fullscreen' ? 'fullscreen' : 'normal';
                this.cards.querySelector('[data-zw-scene-layout-gallery]')?.replaceWith(this._createSceneLayoutPicker());
                this._updateSceneSettingsPreview();
            });
            nav.append(b);
        }
        const seek = demo.querySelector('input');
        seek.value = String(this._sceneDemoState.seek);
        seek.addEventListener('input', () => { this._sceneDemoState.seek = Number(seek.value); this._updateSceneSettingsPreview(); });
        demo.querySelector('[data-demo-comments]').addEventListener('click', () => { this._sceneDemoState.list = !this._sceneDemoState.list; this._updateSceneSettingsPreview(); });
        for (const [selector, sign] of [['[data-demo-back]', -1], ['[data-demo-next]', 1]]) {
            demo.querySelector(selector).addEventListener('click', () => { this._sceneDemoState.seek = Math.max(0, Math.min(100, this._sceneDemoState.seek + sign * Number(this.model.get('sceneSearch.seekStepSeconds') || 0))); seek.value = String(this._sceneDemoState.seek); this._updateSceneSettingsPreview(); });
        }
        wrap.append(style, controls, demo);
        return wrap;
    }
    static _style(doc) {
        if (doc.querySelector('style[data-zw-modern-ui]')) {
            return;
        }
        const style = doc.createElement('style');
        style.setAttribute('data-zw-modern-ui', '');
        style.textContent = [
            '.zenzaAdvancedSettingPanel.zw-modern-active { position:fixed !important; inset:0 !important; width:auto !important; height:auto !important; min-width:0; max-width:none !important; max-height:none !important; margin:0 !important; transform:none !important; transition:none !important; border:0; padding:0; background:#101927; border-radius:0; z-index:2147483647 !important; overflow:hidden; box-sizing:border-box; }',
            '.zenzaAdvancedSettingPanel.zw-modern-active:not(.show) { display:none !important; }',
            '.zenzaAdvancedSettingPanel.zw-modern-active.show { display:block; opacity:1; pointer-events:auto; box-shadow:none; }',
            '.zenzaAdvancedSettingPanel.zw-modern-active > .settingPanelInner { display:none !important; }',
            '.zenzaAdvancedSettingPanel.zw-modern-active > .zenzaAdvancedSetting-close { display:none !important; }',
            '.zw-modern-root { --zw-dark-bg:#101927; --zw-dark-side:#141e2d; --zw-dark-panel:#1b293a; --zw-dark-card:#243449; --zw-dark-border:#2b394b; --zw-dark-text:#edf4ff; --zw-dark-muted:#a5b7cb; --zw-dark-accent:#82bfff; --zw-sidebar-width:290px; color-scheme:dark; color:var(--zw-dark-text); background:var(--zw-dark-bg); display:flex; flex-direction:column; width:100%; height:100%; font:13px/1.45 system-ui,"Yu Gothic UI",Meiryo,sans-serif; box-sizing:border-box; user-select:text; }',
            '.zw-modern-root *, .zw-modern-root *::before, .zw-modern-root *::after { box-sizing:border-box; }',
            // Legacy SettingPanel styles are global; never let its scaled checkboxes,
            // 100%-sized labels or 24px text inputs flow into the modern UI.
            '.zenzaAdvancedSettingPanel.zw-modern-active .zw-modern-root label { width:auto; height:auto; padding:0; margin:0; min-width:0; }',
            '.zenzaAdvancedSettingPanel.zw-modern-active .zw-modern-root input[type=checkbox] { transform:none; margin:0; }',
            '.zenzaAdvancedSettingPanel.zw-modern-active .zw-modern-root input[type=text],.zenzaAdvancedSettingPanel.zw-modern-active .zw-modern-root select { font-size:inherit; margin:0; }',
            '.zenzaAdvancedSettingPanel.zw-modern-active .zw-modern-root input[type=text] { width:auto; }',
            '.zenzaAdvancedSettingPanel.zw-modern-active .zw-modern-cardcontrols label:has(textarea),.zenzaAdvancedSettingPanel.zw-modern-active .zw-modern-cardcontrols label:has(input[type=text]) { width:100%; display:flex; }',
            '.zw-modern-root button, .zw-modern-root input, .zw-modern-root select, .zw-modern-root textarea { font:inherit; }',
            '.zw-modern-root button { cursor:pointer; }',
            '.zw-modern-root button:disabled, .zw-modern-root input:disabled { opacity:.55; cursor:not-allowed; }',
            '.zw-modern-header { display:flex; align-items:center; gap:12px; background:var(--zw-dark-panel); border-bottom:1px solid var(--zw-dark-border); padding:13px 17px; flex:none; }',
            '.zw-modern-header h2 { font-size:17px; font-weight:750; margin:0; flex:1; }',
            '.zw-modern-root .zw-modern-iconbtn { border:1px solid #405069; background:#23334a; color:var(--zw-dark-text); padding:6px 10px; border-radius:5px; }',
            '.zw-modern-body { position:relative; display:flex; flex:1; min-height:0; }',
            '.zw-modern-sidebar { width:var(--zw-sidebar-width); flex:0 0 var(--zw-sidebar-width); overflow:auto; min-width:0; background:var(--zw-dark-side); border-right:1px solid var(--zw-dark-border); padding:14px 9px; transition:width .18s ease,flex-basis .18s ease; }',
            '.zw-modern-root.is-sidebar-collapsed .zw-modern-sidebar { width:0; flex-basis:0; padding:0; overflow:hidden; border:0; }',
            '.zw-modern-search { width:100%; background:#0f1a29; color:var(--zw-dark-text); border:1px solid #40516a; border-radius:5px; padding:9px 10px; margin:0 0 12px; outline-offset:1px; }',
            '.zw-modern-nav { display:flex; flex-direction:column; gap:3px; }',
            '.zw-modern-nav button { display:block; width:100%; text-align:left; border:0; border-radius:5px; color:var(--zw-dark-text); background:transparent; padding:8px; }',
            '.zw-modern-nav button:hover, .zw-modern-nav button.is-active { background:var(--zw-dark-card); }',
            '.zw-modern-nav button.is-active { color:var(--zw-dark-accent); }',
            '.zw-modern-nav .zw-modern-sub { font-size:12px; padding-left:21px; color:var(--zw-dark-muted); }',
            '.zw-modern-main { flex:1; min-width:0; overflow:auto; overscroll-behavior:contain; padding:24px clamp(12px,3vw,44px); }',
            '.zw-modern-content-inner { width:100%; max-width:960px; margin:0 auto; }',
            '.zw-modern-breadcrumb { font-size:11px; color:var(--zw-dark-muted); margin:0 0 4px; }',
            '.zw-modern-section-title { font-size:21px; line-height:1.4; margin:0 0 6px; font-weight:750; }',
            '.zw-modern-section-subtitle { margin:0 0 15px; color:var(--zw-dark-muted); font-size:12px; }',
            '.zw-modern-toolbar { display:flex; justify-content:flex-end; gap:7px; margin:0 0 14px; }',
            '.zw-modern-card { background:var(--zw-dark-card); border:1px solid var(--zw-dark-border); border-radius:5px; padding:13px 15px; margin:0 0 10px; min-width:0; }',
            '.zw-modern-card.is-inline { display:flex; align-items:center; flex-wrap:wrap; column-gap:15px; row-gap:6px; min-height:55px; }',
            '.zw-modern-card.is-inline > .zw-modern-cardhead { min-width:0; flex:1 1 210px; }',
            '.zw-modern-card.is-inline > .zw-modern-cardcontrols { flex:0 1 auto; margin:0; min-width:0; }',
            '.zw-modern-card.is-inline > .zw-modern-note { flex-basis:100%; margin-top:2px; }',
            '.zw-modern-card.is-modified { border-color:#528db7; box-shadow:0 0 0 1px #528db733,0 0 10px #82bfff22; }',
            '.zw-modern-card.is-disabled { opacity:.5; }',
            '.zw-modern-card.is-child { margin-left:14px; border-left:2px solid #475e77; }',
            '.zw-modern-cardhead { display:flex; align-items:center; gap:10px; }',
            '.zw-modern-cardhead strong { font-size:13px; font-weight:650; flex:1; overflow-wrap:anywhere; }',
            '.zw-modern-visibility-icon { display:inline-flex; justify-content:center; align-items:center; flex:none; width:38px; height:32px; background:#23354b; border:1px solid #60748c; border-radius:5px; color:#edf4ff; font:19px/1 system-ui,sans-serif; white-space:nowrap; overflow:hidden; pointer-events:none; user-select:none; }',
            '.zw-modern-visibility-icon.is-compact-glyph { font-size:12px; letter-spacing:-.25px; }',
            '.zw-modern-visibility-icon.is-pair-glyph { font-size:15px; }',
            '.zw-modern-visibility-icon.is-tweet { font-weight:750; color:#79c8f8; }',
            '.zw-modern-visibility-icon.is-mylist { font-size:15px; font-weight:750; }',
            '.zw-modern-visibility-icon.is-like { color:#ffc0d8; font-size:26px; }',
            '.zw-modern-visibility-icon.is-comment { font-size:20px; }',
            '.zw-modern-visibility-icon.is-related { width:100px; font-size:10px; gap:6px; background:#59636b; border-color:#7c8992; }',
            '.zw-modern-visibility-icon.is-comment-input { width:118px; padding:0 6px; justify-content:start; font-size:10px; border-color:#8798a9; color:#c3d3e2; background:#172437; }',
            '.zw-modern-visibility-icon svg { width:24px; height:24px; fill:none; stroke:currentColor; stroke-width:2; stroke-linecap:round; stroke-linejoin:round; }',
            '.zw-modern-root .zw-modern-plainbtn { border:1px solid #445a71; border-radius:5px; background:#1d2b3d; color:var(--zw-dark-text); padding:5px 8px; font-size:11px; }',
            '.zw-modern-cardcontrols { display:flex; gap:10px; align-items:center; justify-content:flex-end; margin:8px 0 0; flex-wrap:wrap; }',
            '.zw-modern-cardcontrols label { display:inline-flex; gap:8px; align-items:center; }',
            '.zw-modern-cardcontrols label:has(textarea), .zw-modern-cardcontrols label:has(input[type=text]) { display:flex; flex-direction:column; align-items:stretch; width:100%; }',
            '.zw-modern-cardcontrols input[type=text], .zw-modern-cardcontrols input[type=number], .zw-modern-cardcontrols textarea, .zw-modern-cardcontrols select { color:var(--zw-dark-text); background:#101927; border:1px solid #445a71; padding:7px 9px; border-radius:5px; min-width:150px; max-width:100%; }',
            '.zw-modern-cardcontrols textarea { width:100%; min-height:95px; resize:vertical; }',
            '.zw-modern-cardcontrols input[type=checkbox] { appearance:none; -webkit-appearance:none; display:inline-block; position:relative; width:39px; height:23px; flex:none; margin:0; background:#47576b; border:1px solid #546a82; border-radius:12px; cursor:pointer; }',
            '.zw-modern-cardcontrols input[type=checkbox]::after { content:""; position:absolute; top:3px; left:3px; width:15px; height:15px; border-radius:50%; background:#fff; transition:transform .14s ease; }',
            '.zw-modern-cardcontrols input[type=checkbox]:checked { background:#82bfff; border-color:#82bfff; }',
            '.zw-modern-cardcontrols input[type=checkbox]:checked::after { transform:translateX(16px); }',
            '.zw-modern-cardcontrols .checkbox { cursor:pointer; }',
            '.zw-modern-cardcontrols label input[type=checkbox] { order:1; }',
            '.zw-modern-cardcontrols .zw-modern-native-label { display:none; }',
            '.zw-modern-seek-editor { display:flex; flex-wrap:wrap; gap:8px; align-items:center; margin-top:6px; width:100%; }',
            '.zw-modern-seek-editor select,.zw-modern-seek-editor input { background:#101927; color:var(--zw-dark-text); border:1px solid #445a71; border-radius:5px; padding:6px; }',
            '.zw-modern-seek-editor input { width:100px; }',
            '.zw-modern-slider { display:flex; align-items:center; justify-content:flex-end; flex-wrap:wrap; gap:12px; width:100%; }',
            '.zw-modern-slider input[type=range] { flex:1; min-width:160px; max-width:750px; accent-color:var(--zw-dark-accent); }',
            '.zw-modern-slider input[type=number] { width:91px; color:var(--zw-dark-text); background:var(--zw-dark-bg); border:1px solid #445a71; padding:7px 9px; border-radius:5px; }',
            '.zw-modern-slider span { color:var(--zw-dark-muted); }',
            '.zw-modern-cardcontrols .zw-modern-segments { display:flex; flex-wrap:wrap; gap:5px; justify-content:flex-end; }',
            '.zw-modern-cardcontrols .zw-modern-segments button { background:#1c2c3f; color:var(--zw-dark-text); border:1px solid #435a76; padding:7px 9px; border-radius:5px; font-size:11px; }',
            '.zw-modern-cardcontrols .zw-modern-segments button.is-selected { color:#101927; background:#82bfff; border-color:#82bfff; }',
            '.zw-modern-color-editor { display:flex; align-items:center; justify-content:flex-end; gap:9px; flex-wrap:wrap; width:100%; }',
            '.zw-modern-color-editor input[type=color] { width:46px; height:34px; padding:2px; cursor:pointer; background:#101927; border:1px solid #52657c; border-radius:6px; }',
            '.zw-modern-color-editor input[type=text] { width:140px; min-width:112px; font:12px/1.4 ui-monospace,Consolas,monospace; }',
            '.zw-modern-color-hint { color:#a5b7cb; font-size:11px; flex-basis:100%; text-align:right; }',
            '.zw-popup-settings { display:grid; grid-template-columns:minmax(0,1fr) minmax(260px,.85fr); gap:18px; align-items:start; }',
            '.zw-popup-settings .zw-popup-preview { position:sticky; top:12px; background:#152336; border:1px solid #40566e; border-radius:10px; padding:15px; min-width:0; }',
            '.zw-popup-settings .zw-popup-preview h4 { margin:0 0 7px; color:#e4edf6; font-size:14px; }',
            '.zw-popup-settings .zw-popup-preview p { color:#a5b7cb; font-size:12px; line-height:1.6; margin:0 0 12px; }',
            '.zw-popup-settings .zw-popup-sample { display:block; background:#333; color:#fff; box-shadow:2px 2px 0 #ccc; padding:8px 16px; border-radius:4px; text-align:center; font-weight:bolder; margin:0 2px 12px 0; overflow-wrap:anywhere; }',
            '@media(max-width:900px){ .zw-popup-settings {grid-template-columns:minmax(0,1fr)} .zw-popup-settings .zw-popup-preview {position:static;grid-row:1} }',
            '.zw-modern-font-editor { display:flex; flex-wrap:wrap; gap:7px; width:100%; justify-content:flex-end; }',
            '.zw-modern-font-editor select { flex:1 1 190px; max-width:420px; }',
            '.zw-modern-font-editor input[type=text] { flex:1 1 220px; }',
            '.zw-modern-font-editor [hidden] { display:none!important; }',
            '.zw-modern-example { display:flex; flex-direction:column; gap:7px; border-top:1px solid #405168; padding:10px 0 1px; margin-top:10px; width:100%; }',
            '.zw-example-label { color:#a5b7cb; font-size:11px; }',
            '.zw-example-caption { font-size:11px; line-height:1.5; color:#a5b7cb; }',
            '.zw-example-text { display:block; align-self:flex-start; background:linear-gradient(145deg,#14253a,#243d50); border-radius:5px; padding:15px; color:white; font-size:24px; line-height:1.35; white-space:nowrap; max-width:100%; overflow:hidden; }',
            '.zw-example-filename { overflow-wrap:anywhere; background:#14253a; border:1px solid #405168; padding:9px; border-radius:5px; font-size:12px; }',
            '.zw-example-screen { width:min(365px,100%); height:124px; border:1px solid #51647c; border-radius:5px; background:#142137; display:flex; align-items:center; justify-content:center; gap:6px; padding:10px; position:relative; overflow:hidden; }',
            '.zw-example-video { background:linear-gradient(125deg,#213c57,#3f7481); border:2px solid #8ec8d0; width:69%; aspect-ratio:16/9; position:relative; display:flex; flex-direction:column; justify-content:center; align-items:center; transition:width .12s ease; overflow:hidden; border-radius:3px; }',
            '.zw-example-title { position:absolute; top:0; left:0; right:0; text-align:center; font-size:10px; background:#15283dcc; color:#fff; }',
            '.zw-example-fly { font-size:11px; color:#fff; text-shadow:0 1px 1px #000; white-space:nowrap; }',
            '.zw-example-controlbar { position:absolute; bottom:0;left:0;right:0; background:#111d32dc; font-size:9px; text-align:center; color:#fff; }',
            '.zw-example-sidebar { background:#22354a; padding:4px; color:#b8d1e8; border-radius:3px; font-size:10px; max-width:80px; }',
            '.zw-modern-example[data-zw-example-mode=big] .zw-example-video { width:84%; }',
            '.zw-modern-example[data-zw-example-mode=wide] .zw-example-video { width:95%; }',
            '.zw-modern-example[data-zw-example-mode=small] .zw-example-video { width:45%; margin-left:auto; }',
            '.zw-modern-example[data-zw-example-mode=sideView] .zw-example-video { width:51%; margin-left:auto; }',
            '.zw-modern-example[data-zw-example-mode="3D"] .zw-example-video { transform:perspective(200px) rotateY(-12deg); }',
            '.zw-modern-example[data-zw-example-mode=auto] .zw-example-controlbar { opacity:.6; }',
            '.zw-modern-example[data-zw-example-mode=always-hide] .zw-example-controlbar { opacity:.06; }',
            '.zw-modern-example[data-zw-example-mode=always-show] .zw-example-controlbar { opacity:1; }',
            '.zw-modern-example[data-zw-example-mode=outside] .zw-example-title { top:-17px; background:#1a314b; }',
            '.zw-modern-example[data-zw-example-mode=overlay] .zw-example-title { opacity:.3; }',
            '.zw-modern-example[data-zw-example-mode=overlay-visible] .zw-example-title { opacity:1; background:#08233ecf; }',
            '.zw-modern-search-guide { padding:12px 15px; margin:0 0 14px; background:#17283c; border:1px solid #39516e; border-radius:5px; color:var(--zw-dark-text); font-size:12px; }',
            '.zw-modern-search-guide strong { display:block; font-size:13px; margin-bottom:6px; }',
            '.zw-modern-search-guide p { margin:5px 0; color:var(--zw-dark-muted); }',
            '.zw-modern-search-guide b { color:var(--zw-dark-text); }',
            '.zw-modern-note { color:var(--zw-dark-muted); font-size:12px; padding:8px 11px; border-radius:5px; background:var(--zw-dark-panel); margin-top:9px; white-space:pre-wrap; }',
            '.zw-modern-note[hidden] { display:none; }',
            '.zw-modern-warning { color:#e6bb75; font-size:11px; display:block; margin-top:5px; }',
            '.zw-modern-regex-editor { display:grid; grid-template-columns:1fr; gap:7px; width:100%; max-width:700px; }',
            '.zw-modern-regex-editor label { display:flex; gap:9px; align-items:center; justify-content:flex-start; font-size:12px; }',
            '.zw-modern-cardcontrols .zw-modern-regex-editor input[type=checkbox] { flex:none; width:17px; height:17px; appearance:checkbox; -webkit-appearance:checkbox; accent-color:#82bfff; border:0; background:transparent; border-radius:0; padding:0; }',
            '.zw-modern-cardcontrols .zw-modern-regex-editor input[type=checkbox]::after { content:none!important; display:none!important; }',
            '.zw-modern-regex-editor [data-zw-regex-advanced-panel] { display:flex; flex-direction:column; gap:6px; align-items:flex-start; }',
            '.zw-modern-regex-editor [data-zw-regex-advanced-panel][hidden] { display:none!important; }',
            '.zw-modern-regex-editor input[type=text] { width:180px; min-width:0; }',
            '.zw-modern-regex-current { color:var(--zw-dark-muted); font-size:11px; }',
            '.zw-modern-regex-editor small { color:var(--zw-dark-muted); font-size:11px; }',
            '.zw-modern-command-assist { margin-top:10px; padding:12px; background:#1a293c; border:1px solid #445a71; border-radius:5px; display:grid; gap:10px; }',
            '.zw-modern-command-assist p { margin:0; color:var(--zw-dark-muted); font-size:12px; line-height:1.6; }',
            '.zw-modern-command-assist p strong { color:var(--zw-dark-text); }',
            '.zw-modern-command-group { display:flex; align-items:center; flex-wrap:wrap; gap:6px; }',
            '.zw-modern-command-group > strong { min-width:65px; font-size:11px; color:#c5d9ed; }',
            '.zw-modern-command-group button { border:1px solid #526c89; border-radius:5px; color:#ecf5ff; background:#23364d; padding:5px 9px; font-size:11px; }',
            '.zw-modern-command-group button:disabled { opacity:.55; background:#2f4458; }',
            '.zw-modern-prefix-breakdown { display:flex; gap:5px; flex-wrap:wrap; }',
            '.zw-modern-prefix-breakdown span { font-size:10px; padding:4px 7px; border-radius:4px; border:1px solid #465971; color:#aebed0; background:#1b293a; }',
            '.zw-modern-prefix-presets { display:flex; flex-wrap:wrap; align-items:center; gap:7px; width:100%; justify-content:flex-start; }',
            '.zw-modern-prefix-presets .is-selected { color:#101927; border-color:#82bfff; background:#82bfff; }',
            '.zw-modern-prefix-hint { color:var(--zw-dark-muted); margin:6px 0 0; font-size:11px; width:100%; }',
            '.zw-modern-backup { display:grid; gap:10px; }',
            '.zw-modern-backup textarea { width:100%; min-height:150px; padding:10px; border:1px solid #465a74; border-radius:5px; background:#101927; color:#edf4ff; resize:vertical; font:12px/1.45 ui-monospace,Consolas,monospace; }',
            '.zw-modern-backup p { color:#a5b7cb; font-size:12px; }',
            '.zw-modern-backup .zw-modern-actions { display:flex; gap:8px; flex-wrap:wrap; }',
            '.zw-modern-footer { background:var(--zw-dark-panel); border-top:1px solid var(--zw-dark-border); padding:12px 18px; display:flex; align-items:center; justify-content:flex-end; gap:9px; flex:none; }',
            '.zw-modern-footer .zw-modern-dirty { color:var(--zw-dark-muted); margin-right:auto; }',
            '.zw-modern-footer .zw-modern-primary { padding:9px 15px; border:1px solid #82bfff; color:#101927; background:#82bfff; font-weight:700; border-radius:5px; }',
            '.zw-modern-backdrop { display:none; }',
            '.zw-modern-root .relatedMenuCustomLinksContainer { width:100%; min-width:0; }',
            '.zw-modern-root .zenzaRelatedLinksEditor { color:var(--zw-dark-text); width:100%; padding:3px 0 6px; }',
            '.zw-modern-root .zenzaRelatedLinksEditor h3 { display:none; }',
            '.zw-modern-root .zenzaRelatedLinksEditor button { border:1px solid #3a4f65; color:var(--zw-dark-text); background:#1b293a; border-radius:5px; cursor:pointer; }',
            '.zw-modern-root .zenzaRelatedLinksEditor button:hover { border-color:#82bfff; }',
            '.zw-modern-root .zenzaRelatedLinksEditor .rl-card { background:#1b293a; border-color:#2b394b; }',
            '.zw-modern-root .zenzaRelatedLinksEditor input[type=text] { background:#101927; color:#edf4ff; border:1px solid #445a71; border-radius:5px; }',
            '.zw-modern-root .zenzaRelatedLinksEditor input[type=checkbox] { accent-color:#82bfff; }',
            '.zw-modern-root .zenzaRelatedLinksEditor [hidden] { display:none !important; }',
            '.zw-modern-root .zw-modern-related-editor { width:100%; }',
            '.zw-modern-order-editor { width:100%; display:grid; gap:7px; }',
            '.zw-modern-order-editor .zw-order-hint { color:#a5b7cb; font-size:12px; }',
            '.zw-modern-order-list { list-style:none; padding:0; margin:0; display:grid; gap:7px; }',
            '.zw-modern-order-row { position:relative; display:flex; align-items:center; gap:8px; padding:9px; background:#152638; border:1px solid #425b74; border-radius:5px; min-width:0; }',
            '.zw-modern-order-row .zw-order-name { flex:1 1 auto; width:auto; min-width:0; overflow-wrap:break-word; white-space:normal; }',
            '.zw-modern-order-row .zw-order-visible { flex:none; display:inline-flex; gap:6px; align-items:center; white-space:nowrap; }',
            '.zw-modern-order-row .zw-order-visible input[type=checkbox] { width:18px; height:18px; flex:none; appearance:auto; accent-color:#82bfff; }',
            '.zw-modern-order-row .zw-order-visible input[type=checkbox]::after { content:none; display:none; }',
            '.zw-modern-cardhead [data-zw-shared-setting] { flex:none; color:#a5b7cb; font-size:10px; white-space:nowrap; }',
            '.zw-modern-order-row .zw-order-name small { display:block; color:#a5b7cb; }',
            '.zw-modern-order-row.is-dragging { opacity:.4; border-style:dashed; }',
            '.zw-modern-order-row.is-drop-before::before,.zw-modern-order-row.is-drop-after::before { content:""; position:absolute; left:0; right:0; height:4px; background:#82bfff; box-shadow:0 0 9px #82bfff; z-index:2; pointer-events:none; }',
            '.zw-modern-order-row.is-drop-before::before { top:-7px; }',
            '.zw-modern-order-row.is-drop-after::before { bottom:-7px; }',
            '.zw-modern-order-row.is-missing { opacity:.62; }',
            '.zw-modern-order-row .zw-order-grip { cursor:grab; }',
            '.zw-modern-order-row .zw-order-grip:active { cursor:grabbing; }',
            '.zw-modern-order-compact .zw-modern-order-row { padding:6px 8px; gap:6px; flex-wrap:wrap; }',
            '.zw-modern-order-compact .zw-order-name { flex:1 1 175px; font-size:12px; }',
            '.zw-modern-order-compact .zw-order-key-preview { min-width:75px; font-size:10px; color:#a5b7cb; }',
            '.zw-modern-order-compact .zw-order-key-preview.is-conflict { color:#ffd28a; }',
            '.zw-modern-order-compact .zw-order-grip { touch-action:none; user-select:none; }',
            '.zw-modern-order-compact .zw-order-visible { gap:4px; font-size:11px; }',
            '.zw-modern-order-compact .zw-order-details { flex:1 0 100%; display:grid; gap:10px; padding:10px 6px 5px; border-top:1px solid #465b72; min-width:0; }',
            '.zw-modern-order-compact .zw-order-details p { margin:0; color:#c3d3e4; }',
            '.zw-modern-order-compact .zw-order-details small { color:#a5b7cb; }',
            '.zw-modern-order-compact .zw-order-field { display:grid; gap:5px; min-width:0; font-size:12px; }',
            '.zw-modern-order-compact .zw-order-field input[type=text],.zw-modern-order-compact .zw-order-field select,.zw-modern-order-compact .zw-order-field input[type=number] { width:min(100%,650px); min-width:0; padding:6px; background:#101927; border:1px solid #445a71; color:#edf4ff; }',
            '.zw-modern-order-compact .zw-order-field input[type=checkbox] { appearance:auto; width:17px; height:17px; }',
            '.zw-modern-order-compact .zw-order-field input[type=checkbox]::after { content:none; }',
            '.zw-modern-order-compact .zw-order-shortcut-editor,.zw-modern-order-compact .zw-order-sizes { display:flex; flex-wrap:wrap; align-items:center; gap:9px; }',
            '.zw-modern-order-compact .zw-order-sizes .zw-order-field { flex:1 1 130px; }',
            '.zw-modern-order-compact .zw-order-variable-palette { display:flex; flex-wrap:wrap; gap:5px; }',
            '.zw-modern-order-compact .zw-order-variable-palette p,.zw-modern-order-compact .zw-order-variable-palette small { flex:1 0 100%; }',
            '.zw-modern-order-compact .zw-order-warning { color:#ffcb78; }',
            '.zw-modern-order-compact .zw-modern-order-row.is-touch-dragging { border-color:#82bfff; box-shadow:0 0 0 1px #82bfff; }',
            '.zw-modern-order-editor [data-zw-order-status] { font-size:12px; color:#a5b7cb; min-height:1.4em; }',
            '.zw-order-toolbar { display:flex; gap:8px; flex-wrap:wrap; margin:3px 0 12px; }',
            '.zw-order-workspace { display:grid; grid-template-columns:minmax(0,1.12fr) minmax(0,1fr); gap:16px; align-items:start; width:100%; min-width:0; }',
            '.zw-order-inspector { min-width:0; background:#1b2c3f; border:1px solid #425b74; border-radius:8px; padding:17px; position:sticky; top:0; max-height:calc(100vh - 220px); overflow:auto; }',
            '.zw-order-inspector .zw-order-details { border:0; padding:0; } .zw-order-details h3 { font-size:18px; margin:0 0 6px; overflow-wrap:anywhere; }',
            '.zw-modern-order-compact .zw-order-name { border:0; padding:0; text-align:left; background:transparent; color:inherit; }',
            '.zw-modern-order-row.is-selected { border-color:#82bfff; background:#253d55; box-shadow:0 0 0 1px #82bfff44; }',
            '.zw-order-workspace .zw-modern-order-row { flex-wrap:nowrap; min-height:42px; }',
            '.zw-order-workspace .zw-order-name { flex:1 1 0; min-width:0; font-weight:600; }',
            '.zw-order-workspace .zw-modern-plainbtn { flex:none; white-space:nowrap; }',
            '.zw-order-workspace .zw-order-key-preview { min-width:0; max-width:65px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }',
            '.zw-order-inspector .is-detail-only .rl-card { padding:0; margin:10px 0 0; border:0; background:transparent; }',
            '.zw-order-inspector .is-detail-only .rl-fields { grid-template-columns:minmax(0,1fr); }',
            '.zw-order-inspector .is-detail-only .rl-head .rl-summary,.zw-order-inspector .is-detail-only [data-rl-drag],.zw-order-inspector .is-detail-only [data-rl-expand],.zw-order-inspector .is-detail-only [data-rl-up],.zw-order-inspector .is-detail-only [data-rl-down] { display:none; }',
            '.zw-order-inspector .is-detail-only .rl-toolbar>button,.zw-order-inspector .is-detail-only [data-rl-count],.zw-order-inspector .is-detail-only .zenzaRelatedLinksEditor>.rl-help { display:none; }',
            '.zw-order-inspector textarea,.zw-order-inspector select,.zw-order-inspector input[type=text] { max-width:100%; min-width:0!important; width:100%; box-sizing:border-box; }',
            '.zw-order-inspector [data-rl-preview] { white-space:pre-wrap; }',
            /* SCUI-10: miniature diagrams are layout previews only: no duplicate video players. */
            '.zw-scui-picker { padding:14px; margin-bottom:13px; border:1px solid #4b6079; border-radius:12px; background:#182536; }',
            '.zw-scui-pickerhead { display:flex; gap:8px; flex-wrap:wrap; align-items:center; justify-content:space-between; margin-bottom:12px; }',
            '.zw-scui-tabs { display:flex; gap:5px; background:#101d2e; padding:4px; border-radius:9px; }',
            '.zw-scui-tabs button { border:1px solid transparent; border-radius:6px; padding:8px 10px; color:#ddd; background:transparent; cursor:pointer; }',
            '.zw-scui-tabs button[aria-pressed=true] { background:#45698b; border-color:#8bb9e7; color:#fff; }',
            '.zw-scui-layout-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(142px,1fr)); gap:8px; }',
            '.zw-scui-layout-option { display:flex; flex-direction:column; gap:5px; background:#101a2a; border:2px solid #35475f; border-radius:9px; color:#ddd; padding:8px; text-align:left; cursor:pointer; min-width:0; }',
            '.zw-scui-layout-option[aria-pressed=true] { border-color:#76c9ff; background:#1b3654; box-shadow:0 0 0 1px #76c9ff60; }',
            '.zw-scui-layout-option:focus-visible,.zw-scui-tabs button:focus-visible { outline:2px solid #e5c075; outline-offset:2px; }',
            '.zw-scui-layout-option:disabled { opacity:.48; cursor:not-allowed; }',
            '.zw-scui-layout-option strong { font-size:11px; white-space:normal; line-height:1.35; }',
            '.zw-scui-mini { position:relative; display:block; height:62px; background:linear-gradient(135deg,#4d6486,#1c2842); border:1px solid #65768d; border-radius:6px; overflow:hidden; }',
            '.zw-scui-mini > i { position:absolute; display:block; background:#0c1725; border:1px solid #8ab8de; border-radius:3px; width:38%; height:22px; bottom:8px; left:30%; }',
            '.zw-scui-mini > b { position:absolute; display:block; background:#1b3560a8; border:1px solid #a4b7d0; border-radius:3px; width:29%; height:16px; bottom:9px; left:8px; }',
            '.zw-scui-mini > em { position:absolute; display:block; background:#6faee4; height:3px; bottom:3px; width:66%; left:17%; }',
            '.zw-scui-mini[data-layout="02"] > i { left:6px; bottom:18px; } .zw-scui-mini[data-layout="02"] > b { left:auto; right:6px; bottom:18px; }',
            '.zw-scui-mini[data-layout="03"] > i { left:auto; right:6px; bottom:9px; }',
            '.zw-scui-mini[data-layout="04"] > i { left:31%; bottom:auto; top:5px; }',
            '.zw-scui-mini[data-layout="05"] > i { width:85%; left:7%; height:21px; bottom:9px; }',
            '.zw-scui-mini[data-layout="06"] > i { width:25%; left:37%; height:17px; }',
            '.zw-scui-mini[data-layout="07"] > i { width:25%; left:37%; } .zw-scui-mini[data-layout="07"] > b { width:23%; left:7%; }',
            '.zw-scui-mini[data-layout="08"] > i { left:auto; right:3px; width:27%; height:51px; bottom:5px; }',
            '.zw-scui-mini[data-layout="09"] > i { left:10%; bottom:14px; } .zw-scui-mini[data-layout="09"] > b { right:5%; left:auto; }',
            '.zw-scui-mini[data-layout="10"] > i { left:62%; bottom:24px; width:31%; } .zw-scui-mini[data-layout="10"] > b { left:13%; bottom:8px; }',
            '.zw-scui-picker.is-modified { border-color:#528db7; box-shadow:0 0 0 1px #528db733,0 0 10px #82bfff22; }',
            '.zw-scui-layout-grid { grid-template-columns:repeat(2,minmax(0,1fr)); }',
            '.zw-scui-mini[data-layout=follow]>i,.zw-scui-mini[data-layout=fixed]>i { left:12%; width:34%; height:30px; bottom:10px; }',
            '.zw-scui-mini[data-layout=follow]>b,.zw-scui-mini[data-layout=fixed]>b { left:48%; width:36%; height:30px; bottom:10px; color:white; font:9px/14px sans-serif; }',
            '.zw-scui-mini i span { display:block; color:white; font:9px/25px sans-serif; white-space:nowrap; font-style:normal; text-shadow:1px 1px black; }',
            '.zw-scui-layout-option small { font-size:11px; line-height:1.5; }',
            '[data-zw-scene-compat] { margin-top:12px; } [data-zw-scene-compat] summary { cursor:pointer; }',
            '.zw-modern-cardcontrols input[type=checkbox]:focus-visible { outline:2px solid #e5c075; outline-offset:3px; }',
            '.zw-scui-note { display:block; font-size:12px; line-height:1.5; color:#bdcfe0; padding-top:9px; }',
            '@media(max-width:760px) {.zw-scui-layout-grid { grid-template-columns:repeat(auto-fit,minmax(126px,1fr)); }}',
            '@media(max-width:1050px) { .zw-order-workspace { grid-template-columns:minmax(0,1fr); } .zw-order-inspector { position:static; max-height:none; } }',
            '@media(max-width:760px) {.zw-modern-sidebar { position:absolute; top:0; bottom:0; left:0; z-index:5; width:min(290px,88vw); flex-basis:auto; transform:translateX(-100%); box-shadow:6px 0 22px #0007; padding:12px; } .zw-modern-root.is-drawer-open .zw-modern-sidebar { transform:translateX(0); } .zw-modern-root.is-drawer-open .zw-modern-backdrop { display:block; background:#0008; position:absolute; inset:0; z-index:4; } .zw-modern-main { padding:15px 11px; } .zw-modern-card { padding:10px; } .zw-modern-footer { padding:9px; } .zw-modern-footer .zw-modern-dirty { font-size:11px; }}'
        ].join('\n');
        doc.head.append(style);
    }
    constructor({ panel, legacyRoot, model, storage, onClose, confirm, formatKeyCombo, encodeKeyCombo, relatedEditor = null, relatedOrder = null, relatedActions = null, screenshotFileName = null, playlist = null, reload = null }) {
        if (!panel || !model) {
            throw new TypeError('Panel and model are required');
        }
        this.panel = panel;
        this.legacyRoot = legacyRoot;
        this.model = model;
        this.relatedEditor = relatedEditor;
        this.relatedOrder = relatedOrder;
        this.relatedActions = relatedActions;
        this.screenshotFileName = screenshotFileName;
        this._orderDragKey = null;
        this._orderDropKey = null;
        this._orderDropAfter = false;
        this._orderAnnouncement = '';
        this._expandedRelatedOptions = new Set();
        this._touchOrder = null;
        this.playlist = playlist;
        this.reload = reload || (() => this.win.location.reload());
        if (relatedEditor) {
            relatedEditor.getDraftShortcutValue = id => this.model.get(id);
            relatedEditor.getDraftShortcutConflicts = key => [
                ...this.model.actions.filter(action => Number(this.model.get('KEY_' + action.id)) === key)
                    .map(action => action.label || action.id),
                ...relatedEditor.draft.filter(link => link && link.enabled !== false &&
                    Number(link.shortcutKey) === key).map(link => link.label || link.id)
            ];
            relatedEditor.embedded = true;
            relatedEditor.onDraftChange = value => this._onCustomMenuDraft(value);
        }
        this._relatedOrigin = relatedEditor ? { parent: relatedEditor.container.parentNode,
            next: relatedEditor.container.nextSibling } : null;
        this.doc = panel.ownerDocument;
        this.win = this.doc.defaultView;
        this.storage = storage || this.win.localStorage;
        this.onClose = onClose || (() => { });
        this.confirm = confirm || (message => this.win.confirm(message));
        this.formatKeyCombo = formatKeyCombo || (v => String(v || '(未設定)'));
        this.encodeKeyCombo = encodeKeyCombo || (e => e.keyCode);
        this.expanded = new Set();
        this._moved = new Map();
        this._seekDirections = new Map();
        // Empty custom seek slots are hidden until the user chooses Add.
        // No placeholder configuration keys are written to storage.
        this._visibleSeekSlots = new Set();
        this._sceneLayoutTab = 'normal';
        this._recordCleanup = null;
        this.searchTerm = '';
        this._setupSelection();
        ModernAdvancedSettingsUI._style(this.doc);
        this.root = this.doc.createElement('section');
        this.root.className = 'zw-modern-root';
        this.root.style.setProperty('--zw-sidebar-width', '290px');
        this.root.setAttribute('role', 'dialog');
        this.root.setAttribute('aria-label', 'ZenzaWatch 上級者設定');
        this.root.innerHTML = [
            '<div class="zw-modern-header">',
            '<button type="button" class="zw-modern-iconbtn" data-zw-sidebar aria-label="サイドバーの開閉">☰</button>',
            '<h2>ZenzaWatch 上級者設定</h2>',
            '<button type="button" class="zw-modern-iconbtn" data-zw-close aria-label="設定画面を閉じる">✕</button>',
            '</div>',
            '<div class="zw-modern-body">',
            '<div class="zw-modern-backdrop" data-zw-drawer-dismiss></div>',
            '<aside class="zw-modern-sidebar">',
            '<input class="zw-modern-search" type="search" data-zw-search placeholder="すべての設定を検索" aria-label="設定を検索">',
            '<nav class="zw-modern-nav" aria-label="設定カテゴリ"></nav>',
            '</aside>',
            '<main class="zw-modern-main"><div class="zw-modern-content-inner">',
            '<div class="zw-modern-breadcrumb" data-zw-path></div>',
            '<h3 class="zw-modern-section-title" data-zw-title></h3>',
            '<p class="zw-modern-section-subtitle" data-zw-subtitle></p>',
            '<div class="zw-modern-toolbar"><button class="zw-modern-plainbtn" type="button" data-zw-reset-category>この画面の項目だけ初期値に戻す</button></div>',
            '<div data-zw-cards></div></div></main>',
            '</div>',
            '<div class="zw-modern-footer">',
            '<span class="zw-modern-dirty" data-zw-dirty>保存済み</span>',
            '<button class="zw-modern-plainbtn" type="button" data-zw-cancel>キャンセル</button>',
            '<button class="zw-modern-primary" type="button" data-zw-save>変更を保存</button>',
            '</div>'
        ].join('');
        this.nav = this.root.querySelector('.zw-modern-nav');
        this.cards = this.root.querySelector('[data-zw-cards]');
        this.root.addEventListener('click', this._onClickBound = e => this._onClick(e), true);
        this.root.addEventListener('change', this._onValueBound = e => this._onValue(e), true);
        this.root.addEventListener('input', this._onInputBound = e => this._onInput(e), true);
        this.root.addEventListener('dragstart', this._onOrderDragStartBound = e => this._onOrderDragStart(e));
        this.root.addEventListener('dragover', this._onOrderDragOverBound = e => this._onOrderDragOver(e));
        this.root.addEventListener('drop', this._onOrderDropBound = e => this._onOrderDrop(e));
        this.root.addEventListener('dragend', this._onOrderDragEndBound = () => this._onOrderDragEnd());
        this.root.addEventListener('pointerdown', this._onTouchOrderDownBound = e => this._onTouchOrderDown(e));
        this.root.addEventListener('pointermove', this._onTouchOrderMoveBound = e => this._onTouchOrderMove(e));
        this.root.addEventListener('pointerup', this._onTouchOrderUpBound = e => this._onTouchOrderUp(e));
        this.root.addEventListener('pointercancel', this._onTouchOrderCancelBound = () => this._clearTouchOrder());
        this.root.addEventListener('click', this._onRelatedClickBound = e => this._onRelatedBubble(e));
        this.root.addEventListener('change', this._onRelatedChangeBound = e => this._onRelatedBubble(e));
        this.root.addEventListener('input', this._onRelatedInputBound = e => this._onRelatedBubble(e));
        this.doc.addEventListener('keydown', this._onKeyDownBound = e => this._onDocumentKeyDown(e), true);
        this.panel.appendChild(this.root);
        // Keep the fullscreen-comment switch in sync with the player setting
        // panel and keyboard shortcut without committing other pending edits.
        this._onBackCommentConfigUpdate = () => {
            if (!this.model.syncLiveValue('backComment')) {
                return;
            }
            const checked = !!this.model.get('backComment');
            this.cards.querySelectorAll('input[data-setting-name="backComment"]')
                .forEach(input => { input.checked = checked; });
            this._refreshCards();
        };
        this.model.config.onkey?.('backComment', this._onBackCommentConfigUpdate);
        this._unwatchRelatedActions = this.relatedActions?.onChange?.(() => this._refreshRelatedOrderList()) || null;
        this._renderNavigation();
        this._renderCards();
        this._refreshFooter();
        this.panel.classList.add('zw-modern-active');
        this._savedPageOverflow = null;
        this.setModalVisible(this.panel.classList.contains('show'));
    }
    // Only lock page scrolling while the actual settings modal is shown.
    // Preserve inline site styles so normal scrolling returns on close/dispose.
    setModalVisible(visible) {
        if (visible) {
            if (this._savedPageOverflow) {
                return;
            }
            const elements = [this.doc.documentElement, this.doc.body].filter(Boolean);
            this._savedPageOverflow = elements.map(el => ({
                element: el, value: el.style.getPropertyValue('overflow'),
                priority: el.style.getPropertyPriority('overflow')
            }));
            elements.forEach(el => el.style.setProperty('overflow', 'hidden', 'important'));
        }
        else if (this._savedPageOverflow) {
            this._savedPageOverflow.forEach(({ element, value, priority }) => {
                if (value) {
                    element.style.setProperty('overflow', value, priority);
                }
                else {
                    element.style.removeProperty('overflow');
                }
            });
            this._savedPageOverflow = null;
        }
    }
    _setupSelection() {
        const all = this.model.descriptors;
        const first = all.find(d => d.category === '再生・音声') || all[0];
        const fallback = first ? { category: first.category, subcategory: first.subcategory } :
            { category: '再生・音声', subcategory: '再生動作' };
        const previous = this._readStored('zw-advanced-modern-selection');
        const saved = previous?.category === 'コメント増量' ?
            { category: 'コメント表示', subcategory: '追加取得' } : previous;
        this.selected = (saved && (this.model.descriptors.some(d => d.category === saved.category &&
            d.subcategory === saved.subcategory) ||
            (saved.category === 'プレイリスト・検索' && saved.subcategory === 'データ管理'))) ? saved : fallback;
        const open = this._readStored('zw-advanced-modern-expanded');
        const majors = Array.isArray(open) ?
            [...new Set(open.map(name => name === 'コメント増量' ? 'コメント表示' : name))]
                .filter(name => this.model.categories.includes(name)) : [];
        this.expanded = new Set(majors.length ? majors : [this.selected.category]);
    }
    _readStored(key) {
        try {
            return JSON.parse(this.storage.getItem(key));
        }
        catch (_) {
            return null;
        }
    }
    _saveStored() {
        try {
            this.storage.setItem('zw-advanced-modern-selection', JSON.stringify(this.selected));
            this.storage.setItem('zw-advanced-modern-expanded', JSON.stringify([...this.expanded]));
        }
        catch (_) { /* UI navigation still works without persistent storage */ }
    }
    _button(text, attribute, value, cssClass = '') {
        const el = this.doc.createElement('button');
        el.type = 'button';
        el.textContent = text;
        el.setAttribute(attribute, value);
        el.className = cssClass;
        return el;
    }
    _renderNavigation() {
        this.nav.replaceChildren();
        for (const major of this.model.categories) {
            const subs = [...new Set(this.model.descriptors
                    .filter(d => d.category === major).map(d => d.subcategory))];
            if (major === 'プレイリスト・検索') {
                subs.push('データ管理');
            }
            const open = this.expanded.has(major);
            const b = this._button((open ? '⌄ ' : '› ') + major, 'data-zw-major', major);
            b.setAttribute('aria-expanded', String(open));
            if (this.selected.category === major) {
                b.classList.add('is-active');
            }
            this.nav.appendChild(b);
            if (!open) {
                continue;
            }
            for (const sub of subs) {
                const label = sub === '関連メニュー › カスタムリンク' ? '関連メニュー（全項目）' : sub;
                const item = this._button(label, 'data-zw-sub', major + '|' + sub, 'zw-modern-sub');
                if (this.selected.category === major && this.selected.subcategory === sub) {
                    item.classList.add('is-active');
                }
                this.nav.appendChild(item);
            }
        }
    }
    // The filter accepts newline-delimited IDs, but runtime settings may be an
    // array (whose implicit textarea conversion would display commas).
    static _formatNgUserIds(value) {
        const text = Array.isArray(value) ? value.join('\n') : String(value ?? '');
        return text.split(/[,\r\n]+/).map(id => id.trim()).filter(Boolean).join('\n');
    }
    static _hexColor(value) {
        const text = String(value || '').trim().toLowerCase();
        if (/^#[0-9a-f]{6}$/.test(text)) {
            return text;
        }
        if (/^#[0-9a-f]{3}$/.test(text)) {
            return '#' + [...text.slice(1)].map(ch => ch + ch).join('');
        }
        const named = { green: '#008000', red: '#ff0000', blue: '#0000ff',
            black: '#000000', white: '#ffffff', gray: '#808080', grey: '#808080',
            yellow: '#ffff00', orange: '#ffa500', purple: '#800080' };
        return named[text] || null;
    }
    // Shared color input UI: every setting with type:'color' uses these two methods.
    // A future picker redesign changes both the existing comment shadow and popup colors.
    _createColorEditor(descriptor) {
        const box = this.doc.createElement('div');
        box.className = 'zw-modern-color-editor';
        const picker = this.doc.createElement('input');
        picker.type = 'color';
        picker.dataset.zwColorPicker = descriptor.id;
        picker.setAttribute('aria-label', descriptor.label + 'をカラーピッカーで選択');
        const raw = String(this.model.get(descriptor.id) ?? '');
        picker.value = ModernAdvancedSettingsUI._hexColor(raw) ||
            ModernAdvancedSettingsUI._hexColor(this.model.config.default[descriptor.id]) || '#008800';
        picker.disabled = !this.model.isEnabled(descriptor.id);
        const code = this.doc.createElement('input');
        code.type = 'text';
        code.dataset.settingName = descriptor.id;
        code.dataset.zwColorCode = descriptor.id;
        code.value = raw;
        code.placeholder = String(this.model.config.default[descriptor.id] ?? '#008800');
        code.spellcheck = false;
        code.autocomplete = 'off';
        code.setAttribute('aria-label', descriptor.hexOnly === true ? 'カラーコード（#RRGGBB または #RGB）' : 'カラーコード（HEXまたはCSS色名）');
        code.disabled = !this.model.isEnabled(descriptor.id);
        const hint = this.doc.createElement('span');
        hint.className = 'zw-modern-color-hint';
        hint.textContent = descriptor.hexOnly === true ?
            'カラーコード #RRGGBB または #RGB（保存前に見本を確認できます）' :
            'カラーコード #RRGGBB または #RGB（CSS色名も使用可）';
        box.append(picker, code, hint);
        return box;
    }
    _refreshColorEditor(card, descriptor, active) {
        const code = card.querySelector('[data-zw-color-code]');
        const picker = card.querySelector('[data-zw-color-picker]');
        const hint = card.querySelector('.zw-modern-color-hint');
        const value = String(this.model.get(descriptor.id) ?? '');
        const hex = ModernAdvancedSettingsUI._hexColor(value);
        const valid = descriptor.hexOnly !== true || /^#(?:[a-fA-F0-9]{3}|[a-fA-F0-9]{6})$/.test(value);
        if (code && code !== this.doc.activeElement) {
            code.value = value;
        }
        if (code) {
            code.disabled = !active;
            code.setAttribute('aria-invalid', String(!valid));
        }
        if (picker) {
            picker.disabled = !active;
            if (hex && valid) {
                picker.value = hex;
            }
        }
        if (hint) {
            hint.textContent = descriptor.hexOnly === true ?
                (valid ? '色見本をクリック、または #RGB / #RRGGBB を入力できます。' : 'カラーコードを入力中です。#RGB または #RRGGBB が必要です。') :
                (hex ? '色見本をクリックして選択、またはコードを入力できます。' : 'CSS色名を使用中／入力途中です。色見本の選択でHEX値に切り替わります。');
        }
    }
    _makeVisualExample(descriptor) {
        const id = descriptor.id;
        if (![
            'screenMode', 'screenMode:ginza', 'screenMode:others',
            'fullscreenControlBarMode', 'videoHeader.position',
            'commentLayer.textShadowType', 'commentLayer.ownerCommentShadowColor',
            'cssFontWeight', 'baseFontFamily', 'baseChatScale', 'screenshot.prefix',
            'screenshot.filenameTemplate'
        ].includes(id)) {
            return null;
        }
        const area = this.doc.createElement('div');
        area.className = 'zw-modern-example';
        area.dataset.zwPreviewFor = id;
        const label = this.doc.createElement('span');
        label.className = 'zw-example-label';
        label.textContent = id === 'screenshot.prefix' || id === 'screenshot.filenameTemplate' ?
            '保存ファイル名の例' :
            '表示例（選択した設定の模式図）';
        area.append(label);
        if (id.startsWith('screenMode') || id === 'fullscreenControlBarMode' ||
            id === 'videoHeader.position') {
            const stage = this.doc.createElement('div');
            stage.className = 'zw-example-screen';
            stage.innerHTML = '<div class="zw-example-video">' +
                '<div class="zw-example-title">動画タイトル</div>' +
                '<div class="zw-example-fly">サンプルコメント　→</div>' +
                '<div class="zw-example-controlbar">▶ ━━━━━━━━━━ ◖ ))</div>' +
                '</div><div class="zw-example-sidebar">情報・タグ</div>';
            area.append(stage);
        }
        else if (id === 'screenshot.prefix' || id === 'screenshot.filenameTemplate') {
            const code = this.doc.createElement('code');
            code.className = 'zw-example-filename';
            area.append(code);
            const parts = this.doc.createElement('div');
            parts.className = 'zw-modern-prefix-breakdown';
            for (const [label, text] of [
                ['先頭に追加する文字', '自由入力'],
                ['動画タイトル', '自動で追加'], ['動画ID', '自動で追加'],
                ['再生位置', '自動で追加'], ['.png', '自動で追加']
            ]) {
                const item = this.doc.createElement('span');
                item.textContent = label + '（' + text + '）';
                parts.append(item);
            }
            area.append(parts);
        }
        else {
            const sample = this.doc.createElement('span');
            sample.className = 'zw-example-text';
            sample.textContent = id === 'commentLayer.ownerCommentShadowColor' ?
                '投稿者コメントの影色' : 'サンプルコメント 123';
            area.append(sample);
        }
        const caption = this.doc.createElement('span');
        caption.className = 'zw-example-caption';
        area.append(caption);
        this._updateVisualExample(area, id);
        return area;
    }
    _updateVisualExample(area, id) {
        const value = String(this.model.get(id) ?? '');
        area.dataset.zwExampleMode = value;
        const sample = area.querySelector('.zw-example-text');
        const caption = area.querySelector('.zw-example-caption');
        if (id.startsWith('screenMode')) {
            const hints = {
                normal: '通常サイズのウィンドウで動画を表示します。',
                big: '通常より大きなウィンドウで動画を表示します。',
                wide: '画面幅を広く使う表示です。',
                '3D': '立体的な視点を使う表示です。',
                small: '小さなポップアップ形式で表示します。',
                sideView: 'ページの横に小さく配置する表示です。'
            };
            caption.textContent = hints[value] || '動画の表示モードの例です。';
        }
        else if (id === 'fullscreenControlBarMode') {
            caption.textContent = ({
                auto: '画面サイズなどに応じて操作バーを自動調整します。',
                'always-show': '操作バーを常に表示する設定です。',
                'always-hide': '操作バーを常に隠す設定です。'
            })[value] || '操作バーの表示方法です。';
        }
        else if (id === 'videoHeader.position') {
            caption.textContent = ({
                auto: '画面幅によって外側／重ね合わせを自動で切り替えます。',
                outside: '動画の外側にタイトルなどを表示します。',
                overlay: '動画に重ね、操作時にだけ表示します。',
                'overlay-visible': '動画に重ね、常時表示します。'
            })[value] || '動画ヘッダーの配置例です。';
        }
        else if (id === 'screenshot.prefix' || id === 'screenshot.filenameTemplate') {
            const prefix = String(this.model.get('screenshot.prefix') ?? '');
            const template = String(this.model.get('screenshot.filenameTemplate') ?? '');
            area.querySelector('.zw-example-filename').textContent = this.screenshotFileName ?
                this.screenshotFileName.format({
                    prefix, template, title: '動画タイトル', watchId: 'sm9', videoId: 'sm9',
                    uploader: '投稿者', currentTime: 83, formatTime: () => '1_23',
                    now: new Date('2026-10-10T12:34:56')
                }) : prefix + '動画タイトル - sm9@1_23.png';
            caption.textContent = '拡張子はPNG固定。コメント付き画像はCを追加し、使えない文字は安全な文字に置換します。';
        }
        else if (sample) {
            sample.style.textShadow = '';
            sample.style.webkitTextStroke = '';
            sample.style.color = '#ffffff';
            if (id === 'commentLayer.textShadowType') {
                const shadows = {
                    '': '1px 1px 0 rgba(0,0,0,.9)',
                    'shadow-type2': '1px 1px 0 #000,-1px 1px 0 #000,-1px -1px 0 #000,1px -1px 0 #000',
                    'shadow-type3': '1px 1px 1px rgba(0,0,0,.8),0 0 3px rgba(0,0,0,.8),-1px -1px 1px #888',
                    'shadow-stroke': 'none',
                    'shadow-dokaben': '1px 1px 0 #963200,-1px 1px 0 #963200,-1px -1px 0 #963200,1px -1px 0 #963200'
                };
                sample.style.textShadow = shadows[value] || shadows[''];
                if (value === 'shadow-stroke') {
                    sample.style.webkitTextStroke = '1px rgba(0,0,0,.7)';
                }
                else if (value === 'shadow-dokaben') {
                    sample.style.color = 'rgb(200,80,0)';
                }
                caption.textContent = value === 'shadow-dokaben' ?
                    '専用フォントがない場合は代替文字で表示します。' : '同じ文字を使った影の比較見本です。';
            }
            else if (id === 'commentLayer.ownerCommentShadowColor') {
                const color = ModernAdvancedSettingsUI._hexColor(value) || value;
                sample.style.textShadow = [
                    '1px 1px 0 ' + color, '-1px 1px 0 ' + color,
                    '1px -1px 0 ' + color, '-1px -1px 0 ' + color
                ].join(',');
                caption.textContent = '現在の影色：' + value;
            }
            else if (id === 'cssFontWeight') {
                sample.style.fontWeight = value || 'normal';
                caption.textContent = 'CSS値 ' + value + ' の文字の太さです。';
            }
            else if (id === 'baseFontFamily') {
                if (value) {
                    sample.style.fontFamily = value;
                }
                caption.textContent = value ? '選択したフォントがない場合は代替フォントで表示します。' :
                    'プレイヤーの標準フォントで表示します。';
            }
            else if (id === 'baseChatScale') {
                sample.style.fontSize = (24 * Math.min(2, Math.max(.5, Number(value) || 1))) + 'px';
                caption.textContent = '現在の倍率：' + value + '倍（比率を示す見本です）。';
            }
        }
    }
    _createVisibilityIcon(id, descriptor = this.model.descriptor(id)) {
        // Placement aliases share the setting ID, but can add a display-only icon.
        const glyph = descriptor?.icon;
        if (!glyph) {
            return null;
        }
        const icon = this.doc.createElement('span');
        icon.className = 'zw-modern-visibility-icon';
        icon.dataset.zwVisibilityIcon = id;
        icon.setAttribute('aria-hidden', 'true');
        const paths = {
            'comments-video': 'M3 5h18v14H3z M6 9h8 M9 13h9',
            'comments-list': 'M5 3h14v18H5z M8 7h1 M11 7h5 M8 12h1 M11 12h5 M8 17h1 M11 17h5',
            'comments-preview': 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z M9 10h6 M9 14h6',
            'comment-heatmap': 'M3 18h18 M4 16v-3 M8 16V8 M12 16V4 M16 16V9 M20 16v-4',
            'seek-thumbnail': 'M4 3h16v13H4z M6 13l4-5 4 4 2-2 2 3 M3 21h18 M12 19v4',
            'scene-filmstrip': 'M2 5h20v14H2z M8 5v14 M16 5v14 M2 8h20 M2 16h20',
            'ad-crown': 'M3 7l5 4 4-7 4 7 5-4-2 12H5z M6 22h12'
        };
        if (paths[glyph]) {
            icon.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="' + paths[glyph] + '"/></svg>';
        }
        else if (glyph === 'shield-ng') {
            icon.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 2.5 19 5v5.5c0 4.6-2.8 8.4-7 10.8-4.2-2.4-7-6.2-7-10.8V5l7-2.5Z"/><path d="m8 8 8 8"/></svg>';
        }
        else if (glyph === 'filter-sparkle') {
            icon.innerHTML = '<svg viewBox="0 0 36 36"><path d="M15 10Q15 19 24 19Q15 19 15 28Q15 19 6 19Q15 19 15 10ZM26 5.5Q26 10 30.5 10Q26 10 26 14.5Q26 10 21.5 10Q26 10 26 5.5Z"/></svg>';
        }
        else {
            icon.textContent = glyph === 'related-menu' ? '関連メニュー ▾' :
                glyph === 'comment-input' ? 'コメント入力(C)' : glyph;
            // Text is a visual preview of an existing player icon, not a second row.
            // Keep the original glyphs; only scale ones too wide for the 38px tile.
            if (id === 'ui.bar.speed' || id === 'ui.bar.time') {
                icon.classList.add('is-compact-glyph');
            }
            else if (id === 'ui.bar.volume' || id === 'ui.info.credits') {
                icon.classList.add('is-pair-glyph');
            }
            if (glyph === 'related-menu') {
                icon.classList.add('is-related');
            }
            if (glyph === 'comment-input') {
                icon.classList.add('is-comment-input');
            }
            if (id === 'ui.hover.like') {
                icon.classList.add('is-like');
            }
            if (id === 'ui.hover.tweet') {
                icon.classList.add('is-tweet');
            }
            if (id === 'ui.hover.mylist') {
                icon.classList.add('is-mylist');
            }
            if (id === 'ui.hover.comments') {
                icon.classList.add('is-comment');
            }
        }
        return icon;
    }
    _createCard(descriptor) {
        const card = this.doc.createElement('article');
        card.className = 'zw-modern-card';
        card.dataset.zwId = descriptor.id;
        const seekDescriptor = descriptor.type === 'shortcut' ?
            this.model.descriptor('PARAM_' + descriptor.actionId) : null;
        if (descriptor.type === 'boolean' ||
            (descriptor.type === 'shortcut' && !seekDescriptor)) {
            card.classList.add('is-inline');
        }
        if (this.model.isDifferentFromDefault(descriptor.id) ||
            (descriptor.type === 'related-order' &&
                (this.model.isDifferentFromDefault('relatedMenu.hiddenItems') ||
                    this.model.isDifferentFromDefault('relatedMenu.builtinOptions'))) ||
            (seekDescriptor && this.model.isDifferentFromDefault(seekDescriptor.id))) {
            card.classList.add('is-modified');
        }
        if (descriptor.dependsOn) {
            card.classList.add('is-child');
        }
        if (!this.model.isEnabled(descriptor.id)) {
            card.classList.add('is-disabled');
        }
        const head = this.doc.createElement('div');
        head.className = 'zw-modern-cardhead';
        const title = this.doc.createElement('strong');
        title.textContent = descriptor.label;
        const icon = this._createVisibilityIcon(descriptor.id, descriptor);
        if (icon) {
            head.append(icon);
        }
        head.append(title);
        if (descriptor.sharedWith) {
            const shared = this.doc.createElement('small');
            shared.dataset.zwSharedSetting = descriptor.id;
            shared.textContent = '共通設定';
            shared.title = descriptor.sharedWith + ' と同じ設定値です。';
            head.append(shared);
        }
        if (descriptor.description) {
            const help = this._button('?', 'data-zw-help', descriptor.id, 'zw-modern-plainbtn');
            help.setAttribute('aria-label', descriptor.label + 'の説明を表示');
            head.append(help);
        }
        const reset = this._button('↺', 'data-zw-reset-item', descriptor.id, 'zw-modern-plainbtn');
        reset.title = 'この項目を初期値に戻す';
        head.append(reset);
        card.append(head);
        const controls = this.doc.createElement('div');
        controls.className = 'zw-modern-cardcontrols';
        if (descriptor.type === 'shortcut') {
            const key = this.doc.createElement('span');
            key.dataset.zwKeyDisplay = '';
            key.textContent = this.formatKeyCombo(this.model.get(descriptor.id));
            controls.append(key, this._button('変更', 'data-zw-record', descriptor.id, 'zw-modern-plainbtn'), this._button('解除', 'data-zw-clear-key', descriptor.id, 'zw-modern-plainbtn'));
            const seek = this.model.descriptor('PARAM_' + descriptor.actionId);
            if (seek) {
                const raw = Number(this.model.get(seek.id)) || 0;
                const sign = this._seekDirections.get(seek.id) || (raw > 0 ? 1 : -1);
                const group = this.doc.createElement('div');
                group.className = 'zw-modern-seek-editor';
                const direction = this.doc.createElement('select');
                direction.dataset.zwSeekDirection = seek.id;
                direction.setAttribute('aria-label', 'シーク方向');
                for (const [value, label] of [['-1', '戻る'], ['1', '進む']]) {
                    const option = this.doc.createElement('option');
                    option.value = value;
                    option.textContent = label;
                    direction.append(option);
                }
                direction.value = String(sign);
                const magnitude = this.doc.createElement('input');
                magnitude.type = 'number';
                magnitude.min = '0';
                magnitude.step = '0.1';
                magnitude.value = String(Math.abs(raw));
                magnitude.dataset.zwSeekMagnitude = seek.id;
                magnitude.setAttribute('aria-label', 'シーク秒数');
                group.append(direction, magnitude);
                const unit = this.doc.createElement('span');
                unit.textContent = '秒';
                group.append(unit);
                controls.append(group);
                const slot = Number((descriptor.actionId || '').match(/CUSTOM_SEEK_(\d+)/)?.[1]);
                if (Number.isInteger(slot)) {
                    const remove = this._button('削除', 'data-zw-remove-seek', String(slot), 'zw-modern-plainbtn');
                    remove.title = 'この枠のキーと秒数を初期値に戻す（保存前はキャンセル可能）';
                    controls.append(remove);
                }
            }
            const warns = this.model.keyConflicts(this.model.get(descriptor.id));
            if (warns.length > 1) {
                const warning = this.doc.createElement('span');
                warning.className = 'zw-modern-warning';
                warning.textContent = '⚠ キー重複：' + warns.join('、');
                controls.append(warning);
            }
        }
        else if (descriptor.type === 'composite-ng') {
            const host = this.doc.createElement('div');
            host.className = 'zw-composite-ng-host';
            host.style.cssText = 'width:100%;min-width:0;';
            controls.append(host);
            if (typeof NgCompositeRuleEditor !== 'undefined') {
                this._ngCompositeEditor = new NgCompositeRuleEditor(host, this.model.get(descriptor.id), draft => {
                    this.model.set(descriptor.id, draft);
                    this._refreshFooter();
                });
            }
            else {
                host.textContent = '複合NGエディターを読み込めませんでした。';
            }
        }
        else if (descriptor.type === 'related-order') {
            controls.append(this._renderRelatedOrderControls());
        }
        else if (descriptor.type === 'related-links') {
            if (this.relatedEditor) {
                this.relatedEditor.showList();
                const editor = this.relatedEditor.container;
                editor.querySelector('[data-rl-save]').hidden = true;
                editor.querySelector('[data-rl-cancel]').hidden = true;
                const toolbar = editor.querySelector('.rl-toolbar');
                if (toolbar) {
                    toolbar.setAttribute('aria-label', '変更は設定画面の下部から保存します');
                }
                controls.append(editor);
            }
            else {
                const info = this.doc.createElement('span');
                info.textContent = 'カスタムリンクの編集を利用できません。';
                controls.append(info);
            }
        }
        else if (descriptor.type === 'regex-flags') {
            const box = this.doc.createElement('div');
            box.className = 'zw-modern-regex-editor';
            const flags = String(this.model.get(descriptor.id) || '');
            const choices = [
                ['i', '大文字・小文字を区別しない（おすすめ）'],
                ['m', '^ と $ を行ごとに判定する'],
                ['s', '「.」を改行にも一致させる'],
                ['u', '日本語などのUnicode文字を正しく扱う']
            ];
            for (const [flag, label] of choices) {
                const line = this.doc.createElement('label');
                const check = this.doc.createElement('input');
                check.type = 'checkbox';
                check.dataset.zwRegexFlag = flag;
                check.dataset.zwRegexId = descriptor.id;
                check.checked = flags.includes(flag);
                check.disabled = !this.model.isEnabled(descriptor.id);
                line.append(check, this.doc.createTextNode(label));
                box.append(line);
            }
            const current = this.doc.createElement('div');
            current.className = 'zw-modern-regex-current';
            current.textContent = '現在のフラグ: ';
            const value = this.doc.createElement('code');
            value.dataset.zwRegexValue = '';
            value.textContent = flags || '（なし）';
            current.append(value);
            box.append(current);
            const toggle = this._button('詳細：フラグを直接入力', 'data-zw-regex-advanced-toggle', descriptor.id, 'zw-modern-plainbtn');
            toggle.setAttribute('aria-expanded', 'false');
            box.append(toggle);
            const advanced = this.doc.createElement('div');
            advanced.dataset.zwRegexAdvancedPanel = '';
            advanced.hidden = true;
            const raw = this.doc.createElement('input');
            raw.type = 'text';
            raw.dataset.settingName = descriptor.id;
            raw.dataset.zwRegexRaw = '';
            raw.value = flags;
            raw.setAttribute('aria-label', '正規表現のフラグを直接入力');
            raw.disabled = !this.model.isEnabled(descriptor.id);
            const caution = this.doc.createElement('small');
            caution.textContent = 'g・yなどのフラグはNG判定の結果が変化する場合があります。初心者は通常iだけで十分です。';
            advanced.append(raw, caution);
            box.append(advanced);
            controls.append(box);
        }
        else if (descriptor.type === 'font-picker') {
            const box = this.doc.createElement('div');
            box.className = 'zw-modern-font-editor';
            const preset = this.doc.createElement('select');
            preset.dataset.zwFontPreset = descriptor.id;
            preset.setAttribute('aria-label', 'フォントの候補から選択');
            for (const entry of descriptor.options) {
                const option = this.doc.createElement('option');
                option.value = entry.value;
                option.textContent = entry.label;
                preset.append(option);
            }
            const free = this.doc.createElement('option');
            free.value = '__custom__';
            free.textContent = 'その他（自由入力）';
            preset.append(free);
            const value = String(this.model.get(descriptor.id) ?? '');
            preset.value = descriptor.options.some(o => o.value === value) ? value : '__custom__';
            const custom = this.doc.createElement('input');
            custom.type = 'text';
            custom.dataset.settingName = descriptor.id;
            custom.dataset.zwFontCustom = descriptor.id;
            custom.value = value;
            custom.placeholder = "'好きなフォント名', sans-serif";
            custom.setAttribute('aria-label', 'フォント名を自由に入力');
            custom.hidden = preset.value !== '__custom__';
            custom.disabled = !this.model.isEnabled(descriptor.id);
            preset.disabled = !this.model.isEnabled(descriptor.id);
            box.append(preset, custom);
            controls.append(box);
        }
        else if (descriptor.type === 'color') {
            controls.append(this._createColorEditor(descriptor));
        }
        else if (descriptor.type === 'slider') {
            const holder = this.doc.createElement('div');
            holder.className = 'zw-modern-slider';
            const value = this.model.get(descriptor.id);
            const makeInput = (type) => {
                const input = this.doc.createElement('input');
                input.type = type;
                input.dataset.settingName = descriptor.id;
                input.min = String(descriptor.min);
                input.max = String(descriptor.max);
                input.step = String(descriptor.step || 1);
                input.value = String(value);
                input.disabled = !this.model.isEnabled(descriptor.id);
                input.setAttribute('aria-label', descriptor.label + (type === 'number' ? 'の数値入力' : 'のスライダー'));
                return input;
            };
            holder.append(makeInput('range'), makeInput('number'));
            if (descriptor.unit) {
                const unit = this.doc.createElement('span');
                unit.textContent = descriptor.unit;
                holder.append(unit);
            }
            controls.append(holder);
        }
        else if (descriptor.type === 'select' && descriptor.presentation === 'dropdown') {
            const select = this.doc.createElement('select');
            select.dataset.settingName = descriptor.id;
            select.setAttribute('aria-label', descriptor.label);
            select.disabled = !this.model.isEnabled(descriptor.id);
            for (const choice of descriptor.options || []) {
                const option = this.doc.createElement('option');
                option.value = String(choice.value);
                option.textContent = choice.label;
                select.append(option);
            }
            const value = String(this.model.get(descriptor.id));
            if (!Array.from(select.options).some(option => option.value === value)) {
                const option = this.doc.createElement('option');
                option.value = value;
                option.textContent = '従来の設定値：' + value;
                select.append(option);
            }
            select.value = value;
            controls.append(select);
        }
        else if (descriptor.type === 'select' && descriptor.options.length > 0) {
            const segments = this.doc.createElement('div');
            segments.className = 'zw-modern-segments';
            for (const option of descriptor.options) {
                const b = this._button(option.label, 'data-zw-choice', descriptor.id);
                b.dataset.zwValue = String(option.value);
                b.disabled = !this.model.isEnabled(descriptor.id);
                if (String(this.model.get(descriptor.id)) === String(option.value)) {
                    b.classList.add('is-selected');
                }
                segments.append(b);
            }
            const existingValue = String(this.model.get(descriptor.id) ?? '');
            if (!descriptor.options.some(o => String(o.value) === existingValue)) {
                const legacy = this._button('従来の設定値：' + existingValue, 'data-zw-choice', descriptor.id);
                legacy.dataset.zwValue = existingValue;
                legacy.classList.add('is-selected');
                legacy.disabled = true;
                legacy.title = '旧バージョンの値を保持しています。変更しなければそのまま保存されます。';
                segments.append(legacy);
            }
            controls.append(segments);
        }
        else {
            const original = descriptor.input;
            if (original) {
                if (!this._moved.has(original)) {
                    this._moved.set(original, { parent: original.parentNode, next: original.nextSibling });
                }
                original.disabled = !this.model.isEnabled(descriptor.id);
                original.setAttribute('aria-label', descriptor.label);
                if (original.type === 'checkbox') {
                    original.checked = !!this.model.get(descriptor.id);
                }
                else {
                    const value = this.model.get(descriptor.id);
                    original.value = descriptor.id === 'userIdFilter' ?
                        ModernAdvancedSettingsUI._formatNgUserIds(value) : (value ?? '');
                }
                controls.append(original);
            }
            else {
                const input = this.doc.createElement(descriptor.type === 'textarea' ? 'textarea' : 'input');
                if (input.tagName === 'INPUT') {
                    input.type = descriptor.type === 'boolean' ? 'checkbox' :
                        ['number', 'seconds'].includes(descriptor.type) ? 'number' : 'text';
                }
                if (input.type === 'checkbox') {
                    input.checked = !!this.model.get(descriptor.id);
                }
                else {
                    const value = this.model.get(descriptor.id);
                    input.value = descriptor.id === 'userIdFilter' ?
                        ModernAdvancedSettingsUI._formatNgUserIds(value) : String(value ?? '');
                }
                input.dataset.settingName = descriptor.id;
                input.setAttribute('aria-label', descriptor.label);
                input.disabled = !this.model.isEnabled(descriptor.id);
                controls.append(input);
            }
        }
        if (descriptor.id === 'screenshot.prefix') {
            const presets = this.doc.createElement('div');
            presets.className = 'zw-modern-prefix-presets';
            const prompt = this.doc.createElement('span');
            prompt.textContent = '先頭の文字をすぐ設定：';
            presets.append(prompt);
            for (const [label, value] of [
                ['追加しない', ''], ['スクショ_', 'スクショ_'],
                ['Zenza_', 'Zenza_'], ['clip_', 'clip_'],
                ['保存日_', '{date}_'], ['動画ID_', '{watchId}_']
            ]) {
                const button = this._button(label, 'data-zw-screenshot-prefix', value, 'zw-modern-plainbtn');
                button.disabled = !this.model.isEnabled(descriptor.id);
                if (String(this.model.get(descriptor.id) ?? '') === value) {
                    button.classList.add('is-selected');
                }
                presets.append(button);
            }
            controls.append(presets);
            const help = this.doc.createElement('p');
            help.className = 'zw-modern-prefix-hint';
            help.textContent = '先頭に付ける文字には {date}（保存日）、{watchId}（動画ID）、{time}（再生位置）が使えます。ファイル名の残りの構成は下の設定で変更できます。';
            controls.append(help);
            const text = controls.querySelector('[data-setting-name="screenshot.prefix"]');
            if (text) {
                text.setAttribute('placeholder', '例：スクショ_{date}_');
            }
        }
        if (descriptor.id === 'screenshot.filenameTemplate') {
            const presets = this.doc.createElement('div');
            presets.className = 'zw-modern-prefix-presets';
            for (const entry of (this.screenshotFileName?.PRESETS || [
                { name: '従来どおり（標準）', value: '' }
            ])) {
                const button = this._button(entry.name, 'data-zw-filename-template', entry.value, 'zw-modern-plainbtn');
                if (this.model.get(descriptor.id) === entry.value) {
                    button.classList.add('is-selected');
                }
                presets.append(button);
            }
            controls.append(presets);
            const hint = this.doc.createElement('p');
            hint.className = 'zw-modern-prefix-hint';
            hint.textContent = '下の変数を組み合わせて順番・区切りを自由に指定できます。空欄なら元の保存形式を維持します。';
            controls.append(hint);
            const tokens = this.doc.createElement('div');
            tokens.className = 'zw-modern-prefix-presets';
            const labels = { title: '動画タイトル', watchId: '視聴ID', videoId: '動画ID',
                uploader: '投稿者名', time: '再生位置', date: '保存日', datetime: '保存日時',
                suffix: 'コメント付き記号' };
            for (const key of (this.screenshotFileName?.TOKENS || Object.keys(labels))) {
                const button = this._button('＋ ' + labels[key], 'data-zw-filename-token', key, 'zw-modern-plainbtn');
                button.title = '{' + key + '} を挿入';
                tokens.append(button);
            }
            controls.append(tokens);
        }
        card.append(controls);
        if (descriptor.id === 'commandFilter') {
            const guide = this.doc.createElement('section');
            guide.className = 'zw-modern-command-assist';
            guide.dataset.zwCommandGuide = '';
            const intro = this.doc.createElement('p');
            intro.textContent = 'コマンド＝投稿時に指定された色・文字サイズ・表示位置です。下のボタンでNGコマンドを追加できます。1行に1つ記入し、1つでもコマンド欄に含まれるとそのコメントを非表示にします。';
            const warning = this.doc.createElement('p');
            warning.textContent = '注意：NGワードや別のNGコマンドとは「どれか1つで除外」です。red と big を別行に書いても「赤かつ大文字」にはなりません。本文・色・サイズの組み合わせは別途複合ルールで設定します。';
            guide.append(intro, warning);
            const entries = [
                ['文字色', [['red', '赤'], ['blue', '青'], ['green', '緑'], ['yellow', '黄'],
                        ['pink', 'ピンク'], ['cyan', '水色'], ['black', '黒']]],
                ['文字サイズ', [['big', '大きい'], ['small', '小さい']]],
                ['表示位置', [['ue', '画面上部'], ['shita', '画面下部']]]
            ];
            const activeCommands = new Set(String(this.model.get('commandFilter') ?? '')
                .split(/\r?\n/).map(c => c.trim().toLowerCase()).filter(Boolean));
            for (const [name, items] of entries) {
                const group = this.doc.createElement('div');
                group.className = 'zw-modern-command-group';
                const heading = this.doc.createElement('strong');
                heading.textContent = name;
                group.append(heading);
                for (const [token, meaning] of items) {
                    const button = this._button(token + '（' + meaning + '）', 'data-zw-command-preset', token);
                    button.title = meaning + 'のコマンドをNG一覧に追加';
                    button.setAttribute('aria-label', 'NGコマンドに' + token + '（' + meaning + '）を追加');
                    button.disabled = !this.model.isEnabled('commandFilter') || activeCommands.has(token);
                    group.append(button);
                }
                guide.append(group);
            }
            card.append(guide);
        }
        const example = this._makeVisualExample(descriptor);
        if (example) {
            card.append(example);
        }
        if (descriptor.description) {
            const note = this.doc.createElement('p');
            note.className = 'zw-modern-note';
            note.textContent = descriptor.description;
            note.hidden = true;
            card.append(note);
        }
        return card;
    }
    _renderDataPanel() {
        this.root.querySelector('[data-zw-title]').textContent = 'データ管理';
        this.root.querySelector('[data-zw-path]').textContent = 'プレイリスト・検索 / データ管理';
        this.root.querySelector('[data-zw-subtitle]').textContent = '既存の設定JSONとプレイリストの保存・復元';
        this.root.querySelector('[data-zw-reset-category]').hidden = true;
        this.cards.innerHTML = [
            '<section class="zw-modern-card zw-modern-backup">',
            '<h4>設定JSONのバックアップ</h4>',
            '<p>バックアップを取り込む操作は通常の下書き保存とは別です。確認後に即時反映し、画面を再読み込みします。</p>',
            '<textarea data-zw-backup-json spellcheck="false" aria-label="設定JSON"></textarea>',
            '<div class="zw-modern-actions">',
            '<button type="button" class="zw-modern-plainbtn" data-zw-backup-export>現在の設定JSONを表示</button>',
            '<button type="button" class="zw-modern-plainbtn" data-zw-backup-import>設定JSONを取り込む</button>',
            '</div>',
            '<h4>プレイリストデータ</h4>',
            '<textarea data-zw-playlist-json spellcheck="false" aria-label="プレイリストJSON"></textarea>',
            '<div class="zw-modern-actions">',
            '<button type="button" class="zw-modern-plainbtn" data-zw-playlist-export>プレイリストを表示</button>',
            '<button type="button" class="zw-modern-plainbtn" data-zw-playlist-import>プレイリストを取り込む</button>',
            '</div>',
            '<p data-zw-backup-status role="status" aria-live="polite"></p>',
            '</section>'
        ].join('');
        this.cards.querySelectorAll('[data-zw-playlist-export],[data-zw-playlist-import]')
            .forEach(button => { button.disabled = !this.playlist; });
    }
    _onCustomMenuDraft(value) {
        const before = (this.model.get('relatedMenu.customLinks') || []);
        this.model.set('relatedMenu.customLinks', value);
        if (!this.root) {
            return;
        }
        const structure = JSON.stringify(before.map(x => x?.id)) !== JSON.stringify(value.map(x => x?.id));
        const keysChanged = JSON.stringify(before.map(x => x?.shortcutKey)) !== JSON.stringify(value.map(x => x?.shortcutKey));
        if (structure) {
            const added = value.filter(x => x && !before.some(old => old?.id === x.id)).at(-1);
            const selected = [...this._expandedRelatedOptions][0];
            if (added) {
                this._expandedRelatedOptions = new Set(['link:' + added.id]);
            }
            else if (selected?.startsWith('link:') && !value.some(x => 'link:' + x?.id === selected)) {
                this._expandedRelatedOptions = new Set(['builtin:official']);
            }
        }
        if (structure || keysChanged) {
            this._refreshRelatedOrderList();
        }
        else {
            // Do not replace the inspector on every keystroke: keep focus and caret.
            for (const row of this.root.querySelectorAll('[data-zw-order-key]')) {
                const item = value.find(x => 'link:' + x?.id === row.dataset.zwOrderKey);
                if (item) {
                    row.querySelector('.zw-order-name').textContent = item.label || item.id;
                }
            }
            const title = this.root.querySelector('[data-zw-order-detail-title]');
            const selected = [...this._expandedRelatedOptions][0];
            const item = value.find(x => 'link:' + x?.id === selected);
            if (title && item) {
                title.textContent = item.label || item.id;
            }
        }
        this._refreshFooter();
    }
    _relatedOrderEntries() {
        if (!this.relatedOrder || !this.model.descriptor('relatedMenu.order')) {
            return [];
        }
        const links = (this.model.get('relatedMenu.customLinks') || []);
        const actions = this.relatedActions?.getActions?.({}) || [];
        return this.relatedOrder.entries(links, actions, this.model.get('relatedMenu.order'));
    }
    _renderRelatedOrderControls() {
        const holder = this.doc.createElement('div');
        holder.className = 'zw-modern-order-editor zw-modern-order-compact';
        if (!this.relatedOrder) {
            holder.textContent = '関連メニューの並び替えを利用できません。';
            return holder;
        }
        const guide = this.doc.createElement('p');
        guide.className = 'zw-order-hint';
        guide.textContent = '左の一覧を並べ替え、右側で選択した項目を編集します。⠿をドラッグ（スマホは長押し）／Alt＋↑↓／上下ボタン。変更は下部の保存で確定します。';
        holder.append(guide);
        const toolbar = this.doc.createElement('div');
        toolbar.className = 'zw-order-toolbar';
        const refresh = this._button('一覧を更新', 'data-zw-order-refresh', '', 'zw-modern-plainbtn');
        refresh.title = '追加リンクや外部登録アクションを再読み込み（保存はしません）';
        toolbar.append(refresh);
        for (const [attr, label, kind] of [['data-zw-order-add-link', '＋ リンク', 'link'], ['data-zw-order-add-copy', '＋ コピー', 'copy']]) {
            const button = this._button(label, attr, kind, 'zw-modern-plainbtn');
            button.disabled = !this.relatedEditor || this.relatedEditor.original === null || this.relatedEditor.draft.length >= 40;
            toolbar.append(button);
        }
        toolbar.append(this._button('カスタム項目を初期値に戻す', 'data-zw-reset-item', 'relatedMenu.customLinks', 'zw-modern-plainbtn'));
        holder.append(toolbar);
        const workspace = this.doc.createElement('div');
        workspace.className = 'zw-order-workspace';
        const pane = this.doc.createElement('aside');
        pane.className = 'zw-order-inspector';
        pane.dataset.zwOrderDetailPane = '';
        pane.setAttribute('aria-label', '選択項目の詳細設定');
        const list = this.doc.createElement('ol');
        list.className = 'zw-modern-order-list';
        list.setAttribute('aria-label', '関連メニューの全項目');
        const entries = this._relatedOrderEntries();
        const prefs = (this.model.get(this.relatedOrder.OPTIONS_KEY) || {});
        this._expandedRelatedOptions = this._expandedRelatedOptions || new Set();
        const selected = entries.find(item => item.present && this._expandedRelatedOptions.has(item.key)) ||
            entries.find(item => item.present);
        this._expandedRelatedOptions = new Set(selected ? [selected.key] : []);
        const descriptions = {
            official: '公式視聴ページを開きます。ZenzaWatchの横取りを防ぐ識別子は自動で付けられます。',
            ad: 'ニコニ広告の宣伝画面を開きます。既定は小さな別ウィンドウです。',
            twitter: '動画IDを含むX（Twitter）の投稿を検索します。必要ならURLテンプレートを変更できます。',
            original: 'コミュニティ動画・マイメモリーの場合だけ元の動画へ移動します。',
            tree: '親作品・コンテンツツリーを開きます。動画によっては利用できません。',
            'tree-playlist': '親作品・子作品のリストを現在のプレイリストへ追加します。',
            'copy-url': '現在の動画からURL・動画IDなどをコピーします。'
        };
        const variableNames = {
            videoId: '動画ID（例: sm9）', watchId: '視聴ID（例: sm9）',
            videoUrl: '動画URL', videoTitle: '動画タイトル',
            uploaderUserId: '投稿者のユーザーID', uploaderChannelId: '投稿者のチャンネルID',
            uploaderName: '投稿者名', currentTime: '現在の再生位置（秒）'
        };
        const addField = (parent, label, control, desc = '') => {
            const field = this.doc.createElement('label');
            field.className = 'zw-order-field';
            const name = this.doc.createElement('span');
            name.textContent = label;
            field.append(name, control);
            if (desc) {
                const note = this.doc.createElement('small');
                note.textContent = desc;
                field.append(note);
            }
            parent.append(field);
            return control;
        };
        for (const [index, item] of entries.entries()) {
            const row = this.doc.createElement('li');
            row.className = 'zw-modern-order-row';
            if (!item.present) {
                row.classList.add('is-missing');
            }
            row.dataset.zwOrderKey = item.key;
            const grip = this._button('⠿', 'data-zw-order-grip', item.key, 'zw-modern-plainbtn zw-order-grip');
            grip.draggable = true;
            grip.title = 'ドラッグ・長押し、またはAlt＋上下キーで移動';
            grip.setAttribute('aria-label', item.label + 'を並べ替え');
            row.append(grip);
            const builtinId = item.type === 'builtin' ? item.key.slice(8) : null;
            const opts = builtinId ? this.relatedOrder.getOption(prefs, builtinId) : {};
            const label = opts.label || item.label;
            const name = this._button(label, 'data-zw-order-edit', item.key, 'zw-order-name');
            name.disabled = !item.present;
            row.classList.toggle('is-selected', selected?.key === item.key);
            row.append(name);
            const shortcutId = builtinId && this.relatedOrder.SHORTCUT_ACTION_IDS[builtinId];
            const keyId = shortcutId ? 'KEY_' + shortcutId : null;
            const shortcutValue = keyId ? Number(this.model.get(keyId)) || 0 :
                item.type === 'link' ? Number((this.model.get('relatedMenu.customLinks') || [])
                    .find(link => 'link:' + link.id === item.key)?.shortcutKey) || 0 : 0;
            const keyBadge = this.doc.createElement('small');
            keyBadge.className = 'zw-order-key-preview';
            keyBadge.textContent = shortcutValue ? this.formatKeyCombo(shortcutValue) : 'キー未設定';
            keyBadge.hidden = !shortcutValue;
            if (shortcutValue) {
                const warnings = this.model.keyConflicts(shortcutValue);
                if (warnings.length > 1) {
                    keyBadge.classList.add('is-conflict');
                    keyBadge.title = '⚠ ショートカットの重複: ' + warnings.join('、');
                    keyBadge.textContent += ' ⚠重複';
                }
            }
            row.append(keyBadge);
            const visible = this.doc.createElement('label');
            visible.className = 'zw-order-visible';
            const checkbox = this.doc.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.dataset.zwOrderVisible = item.key;
            checkbox.checked = !(this.model.get('relatedMenu.hiddenItems') || []).includes(item.key);
            visible.append(checkbox, this.doc.createTextNode('表示'));
            row.append(visible);
            const edit = this._button(this._expandedRelatedOptions.has(item.key) ? '編集中' : '編集', 'data-zw-order-edit', item.key, 'zw-modern-plainbtn');
            edit.disabled = !item.present;
            edit.setAttribute('aria-expanded', String(this._expandedRelatedOptions.has(item.key)));
            row.append(edit);
            const up = this._button('↑', 'data-zw-order-up', item.key, 'zw-modern-plainbtn');
            const down = this._button('↓', 'data-zw-order-down', item.key, 'zw-modern-plainbtn');
            up.disabled = index === 0;
            down.disabled = index === entries.length - 1;
            up.title = '1つ上へ';
            down.title = '1つ下へ';
            row.append(up, down);
            if (this._expandedRelatedOptions.has(item.key)) {
                const details = this.doc.createElement('section');
                details.className = 'zw-order-details';
                details.dataset.zwOrderDetails = item.key;
                const heading = this.doc.createElement('h3');
                heading.dataset.zwOrderDetailTitle = '';
                heading.textContent = label;
                details.append(heading);
                const help = this.doc.createElement('p');
                help.textContent = builtinId ? descriptions[builtinId] :
                    item.type === 'link' ? 'この項目の動作・内容・ショートカットを編集します。変更は保存するまで下書きです。' :
                        '外部スクリプトが登録した機能です。名称・動作の変更は登録元で行います。';
                details.append(help);
                if (builtinId) {
                    const title = this.doc.createElement('input');
                    title.type = 'text';
                    title.maxLength = 80;
                    title.value = opts.label || '';
                    title.placeholder = '標準名を使用: ' + item.label;
                    title.dataset.zwBuiltinField = 'label';
                    title.dataset.zwBuiltinId = builtinId;
                    addField(details, 'メニューに表示する名前', title, '空欄に戻すと標準の名前を使用します。');
                    if (keyId && this.model.descriptor(keyId)) {
                        const line = this.doc.createElement('div');
                        line.className = 'zw-order-shortcut-editor';
                        const caption = this.doc.createElement('span');
                        caption.textContent = 'ショートカット: ' + (shortcutValue ? this.formatKeyCombo(shortcutValue) : '(未設定)');
                        line.append(caption, this._button('変更', 'data-zw-record', keyId, 'zw-modern-plainbtn'), this._button('解除', 'data-zw-clear-key', keyId, 'zw-modern-plainbtn'));
                        details.append(line);
                        const warning = this.model.keyConflicts(shortcutValue);
                        if (shortcutValue && warning.length > 1) {
                            const alert = this.doc.createElement('p');
                            alert.className = 'zw-order-warning';
                            alert.textContent = '⚠ キーが重複しています: ' + warning.join('、') + '（既存割り当ては自動解除しません）';
                            details.append(alert);
                        }
                        const sync = this.doc.createElement('small');
                        sync.textContent = '「ショートカット」欄と同じ設定値を編集します。変更は保存するまで確定しません。';
                        details.append(sync);
                    }
                    if (['official', 'ad', 'twitter', 'tree'].includes(builtinId)) {
                        const select = this.doc.createElement('select');
                        select.dataset.zwBuiltinField = 'openMode';
                        select.dataset.zwBuiltinId = builtinId;
                        for (const [val, text] of [['default', '既定の動作'], ['same-tab', '現在のタブで開く'],
                            ['new-tab', '新しいタブで開く'], ['new-window', '新しいウィンドウを要求']]) {
                            const option = this.doc.createElement('option');
                            option.value = val;
                            option.textContent = text;
                            select.append(option);
                        }
                        select.value = opts.openMode || 'default';
                        addField(details, 'リンクの開き方', select, '新規ウィンドウはブラウザの設定によってタブになる場合があります。');
                        if (select.value === 'new-window') {
                            const sizes = this.doc.createElement('div');
                            sizes.className = 'zw-order-sizes';
                            for (const [field, label, defaultSize] of [
                                ['popupWidth', '横幅', builtinId === 'ad' ? 428 : 760],
                                ['popupHeight', '高さ', builtinId === 'ad' ? 600 : 650]
                            ]) {
                                const box = this.doc.createElement('input');
                                box.type = 'number';
                                box.min = '250';
                                box.max = '1800';
                                box.step = '1';
                                box.value = String(opts[field] || defaultSize);
                                box.dataset.zwBuiltinField = field;
                                box.dataset.zwBuiltinId = builtinId;
                                addField(sizes, label + '（px）', box);
                            }
                            details.append(sizes);
                        }
                    }
                    if (builtinId === 'official') {
                        const box = this.doc.createElement('input');
                        box.type = 'checkbox';
                        box.checked = opts.includePosition !== false;
                        box.dataset.zwBuiltinField = 'includePosition';
                        box.dataset.zwBuiltinId = builtinId;
                        addField(details, '現在の再生位置を公式プレイヤーへ引き継ぐ', box);
                    }
                    if (builtinId === 'copy-url') {
                        const select = this.doc.createElement('select');
                        select.dataset.zwBuiltinField = 'copyFormat';
                        select.dataset.zwBuiltinId = builtinId;
                        for (const [val, text] of [['url', '動画URL（従来どおり）'], ['id', '動画IDのみ'],
                            ['position', '再生位置付き動画URL'], ['title-url', '動画タイトル＋URL'],
                            ['markdown', 'Markdown形式のリンク']]) {
                            const option = this.doc.createElement('option');
                            option.value = val;
                            option.textContent = text;
                            select.append(option);
                        }
                        select.value = opts.copyFormat || 'url';
                        addField(details, 'コピーする形式', select, '「動画IDのみ」では sm9 のような識別子だけをコピーします。');
                    }
                    if (['twitter', 'tree'].includes(builtinId)) {
                        const input = this.doc.createElement('input');
                        input.type = 'text';
                        input.value = opts.urlTemplate || '';
                        input.placeholder = '未入力なら既存の公式URLを使用';
                        input.maxLength = 2048;
                        input.dataset.zwBuiltinField = 'urlTemplate';
                        input.dataset.zwBuiltinId = builtinId;
                        addField(details, 'URLテンプレート（任意）', input, 'https:// から始めてください。空欄なら従来のリンクを使用します。');
                        const palette = this.doc.createElement('div');
                        palette.className = 'zw-order-variable-palette';
                        const intro = this.doc.createElement('p');
                        intro.textContent = '変数を挿入：動画ごとに自動で値を置き換えます。使える変数は8種類すべて表示しています。';
                        palette.append(intro);
                        for (const token of this.relatedActions?.VARIABLES || Object.keys(variableNames)) {
                            const button = this._button('{' + token + '}', 'data-zw-builtin-insert', token, 'zw-modern-plainbtn');
                            button.dataset.zwBuiltinId = builtinId;
                            button.title = variableNames[token] || token;
                            palette.append(button);
                        }
                        const explains = this.doc.createElement('small');
                        explains.textContent = Object.entries(variableNames).map(([v, label]) => '{' + v + '} = ' + label).join(' / ');
                        palette.append(explains);
                        details.append(palette);
                    }
                    const reset = this._button('この項目の詳細だけ初期値に戻す', 'data-zw-builtin-reset', builtinId, 'zw-modern-plainbtn');
                    details.append(reset);
                }
                pane.append(details);
            }
            list.append(row);
        }
        if (this.relatedEditor) {
            const editor = this.relatedEditor.container;
            editor.querySelector('[data-rl-save]').hidden = true;
            editor.querySelector('[data-rl-cancel]').hidden = true;
            editor.hidden = selected?.type !== 'link';
            this.relatedEditor.showDetail(selected?.type === 'link' ? selected.key.slice(5) : null);
            pane.append(editor);
        }
        workspace.append(list, pane);
        holder.append(workspace);
        const status = this.doc.createElement('p');
        status.dataset.zwOrderStatus = '';
        status.setAttribute('role', 'status');
        status.setAttribute('aria-live', 'polite');
        status.textContent = this._orderAnnouncement || '';
        holder.append(status);
        return holder;
    }
    _refreshRelatedOrderList() {
        if (!this.root) {
            return;
        }
        this._clearTouchOrder();
        const card = this.root.querySelector('[data-zw-id="relatedMenu.order"]');
        const controls = card?.querySelector('.zw-modern-cardcontrols');
        if (controls) {
            controls.replaceChildren(this._renderRelatedOrderControls());
        }
        card?.classList.toggle('is-modified', this.model.isDifferentFromDefault('relatedMenu.order') ||
            this.model.isDifferentFromDefault('relatedMenu.hiddenItems') ||
            this.model.isDifferentFromDefault('relatedMenu.builtinOptions'));
    }
    _moveRelatedOrder(fromKey, toKey, after = false) {
        const entries = this._relatedOrderEntries();
        const keys = entries.map(entry => entry.key);
        const from = keys.indexOf(fromKey), to = keys.indexOf(toKey);
        if (from < 0 || to < 0) {
            return false;
        }
        const insertion = to + (after ? 1 : 0);
        const position = from < insertion ? insertion - 1 : insertion;
        if (position === from) {
            return false;
        }
        keys.splice(position, 0, keys.splice(from, 1)[0]);
        this.model.set('relatedMenu.order', keys);
        this._orderAnnouncement = '「' + (entries[from]?.label || fromKey) + '」を' +
            (position + 1) + '番目に移動しました。保存前ならキャンセルできます。';
        this._renderCards();
        this._refreshFooter();
        return true;
    }
    _clearRelatedOrderDrag() {
        this._orderDragKey = null;
        this._orderDropKey = null;
        this._orderDropAfter = false;
        this.root.querySelectorAll('.zw-modern-order-row.is-dragging,.zw-modern-order-row.is-drop-before,.zw-modern-order-row.is-drop-after')
            .forEach(row => row.classList.remove('is-dragging', 'is-drop-before', 'is-drop-after'));
    }
    _onOrderDragStart(e) {
        const grip = e.target.closest?.('[data-zw-order-grip]');
        if (!grip || !this.root.contains(grip)) {
            return;
        }
        this._orderDragKey = grip.dataset.zwOrderGrip;
        grip.closest('.zw-modern-order-row')?.classList.add('is-dragging');
        if (e.dataTransfer) {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', this._orderDragKey);
        }
    }
    _onOrderDragOver(e) {
        if (!this._orderDragKey) {
            return;
        }
        const row = e.target.closest?.('.zw-modern-order-row');
        if (!row || !this.root.contains(row)) {
            return;
        }
        e.preventDefault();
        if (e.dataTransfer) {
            e.dataTransfer.dropEffect = 'move';
        }
        const rect = row.getBoundingClientRect();
        const keys = this._relatedOrderEntries().map(entry => entry.key);
        this._orderDropAfter = rect.height > 0 ?
            e.clientY > rect.top + rect.height / 2 :
            keys.indexOf(this._orderDragKey) < keys.indexOf(row.dataset.zwOrderKey);
        this._orderDropKey = row.dataset.zwOrderKey;
        this.root.querySelectorAll('.zw-modern-order-row.is-drop-before,.zw-modern-order-row.is-drop-after')
            .forEach(item => item.classList.remove('is-drop-before', 'is-drop-after'));
        row.classList.add(this._orderDropAfter ? 'is-drop-after' : 'is-drop-before');
    }
    _onOrderDrop(e) {
        if (!this._orderDragKey) {
            return;
        }
        e.preventDefault();
        const from = this._orderDragKey, to = this._orderDropKey, after = this._orderDropAfter;
        this._clearRelatedOrderDrag();
        if (to) {
            this._moveRelatedOrder(from, to, after);
        }
    }
    _onOrderDragEnd() { this._clearRelatedOrderDrag(); }
    _onTouchOrderDown(e) {
        if (e.pointerType !== 'touch' || this._touchOrder) {
            return;
        }
        const grip = e.target.closest?.('[data-zw-order-grip]');
        if (!grip || !this.root.contains(grip)) {
            return;
        }
        const key = grip.dataset.zwOrderGrip;
        if (!this._relatedOrderEntries().some(item => item.key === key)) {
            return;
        }
        const state = { id: e.pointerId, key, grip, active: false, dropKey: null, after: false, timer: null };
        this._touchOrder = state;
        state.timer = this.win.setTimeout(() => {
            if (this._touchOrder !== state) {
                return;
            }
            if (!this.root.contains(grip)) {
                this._clearTouchOrder();
                return;
            }
            try {
                grip.setPointerCapture?.(e.pointerId);
            }
            catch (_) {
                this._clearTouchOrder();
                return;
            }
            state.active = true;
            grip.closest('.zw-modern-order-row')?.classList.add('is-touch-dragging');
        }, 260);
    }
    _onTouchOrderMove(e) {
        const state = this._touchOrder;
        if (!state || state.id !== e.pointerId || !state.active) {
            return;
        }
        e.preventDefault();
        const hit = this.doc.elementFromPoint?.(e.clientX, e.clientY) || e.target;
        const row = hit?.closest?.('[data-zw-order-key]');
        if (!row || !this.root.contains(row)) {
            return;
        }
        state.dropKey = row.dataset.zwOrderKey;
        const bounds = row.getBoundingClientRect();
        state.after = bounds.height > 0 ? e.clientY > bounds.top + bounds.height / 2 :
            this._relatedOrderEntries().findIndex(i => i.key === state.key) <
                this._relatedOrderEntries().findIndex(i => i.key === state.dropKey);
        this.root.querySelectorAll('.zw-modern-order-row.is-drop-before,.zw-modern-order-row.is-drop-after')
            .forEach(el => el.classList.remove('is-drop-before', 'is-drop-after'));
        row.classList.add(state.after ? 'is-drop-after' : 'is-drop-before');
    }
    _onTouchOrderUp(e) {
        const state = this._touchOrder;
        if (!state || state.id !== e.pointerId) {
            return;
        }
        const shouldMove = state.active && state.dropKey && state.dropKey !== state.key;
        const from = state.key, to = state.dropKey, after = state.after;
        this._clearTouchOrder();
        if (shouldMove) {
            this._moveRelatedOrder(from, to, after);
        }
    }
    _clearTouchOrder() {
        const state = this._touchOrder;
        if (!state) {
            return;
        }
        this._touchOrder = null;
        this.win.clearTimeout(state.timer);
        // The pointer may already have ended or its old row may have been removed.
        try {
            state.grip.releasePointerCapture?.(state.id);
        }
        catch (_) { }
        state.grip.closest('.zw-modern-order-row')?.classList.remove('is-touch-dragging');
        this.root.querySelectorAll('.zw-modern-order-row.is-drop-before,.zw-modern-order-row.is-drop-after')
            .forEach(el => el.classList.remove('is-drop-before', 'is-drop-after'));
    }
    _customSeekSlots() {
        return Array.from({ length: 10 }, (_, n) => n + 1).filter(n => this.model.descriptor('KEY_CUSTOM_SEEK_' + n) &&
            this.model.descriptor('PARAM_CUSTOM_SEEK_' + n));
    }
    _usedCustomSeekSlots() {
        return this._customSeekSlots().filter(n => this._visibleSeekSlots.has(n) ||
            Number(this.model.get('KEY_CUSTOM_SEEK_' + n)) !== 0 ||
            Number(this.model.get('PARAM_CUSTOM_SEEK_' + n)) !== 0);
    }
    _createSceneLayoutPicker() {
        const wrap = this.doc.createElement('section');
        wrap.className = 'zw-scui-picker';
        wrap.dataset.zwSceneLayoutGallery = '';
        wrap.setAttribute('aria-label', 'シーンサーチの表示方式');
        const mode = this._sceneLayoutTab;
        const key = 'sceneSearch.presentation.' + mode;
        const current = String(this.model.get(key) || 'follow');
        const linked = mode === 'fullscreen' && this.model.get('sceneSearch.layout.linkFullscreen') === true;
        wrap.classList.toggle('is-modified', this.model.isDifferentFromDefault(key));
        const header = this.doc.createElement('div');
        header.className = 'zw-scui-pickerhead';
        const heading = this.doc.createElement('strong');
        heading.textContent = 'プレビューの表示方式';
        const tabs = this.doc.createElement('div');
        tabs.className = 'zw-scui-tabs';
        tabs.setAttribute('role', 'group');
        tabs.setAttribute('aria-label', '設定する画面');
        for (const [value, label] of [['normal', '通常表示'], ['fullscreen', '全画面']]) {
            const b = this._button(label, 'data-zw-scene-layout-mode', value);
            b.setAttribute('aria-pressed', String(mode === value));
            tabs.append(b);
        }
        header.append(heading, tabs);
        wrap.append(header);
        this._sceneMainLayouts = this._sceneMainLayouts || {};
        if (current !== 'legacy') {
            this._sceneMainLayouts[mode] = current;
        }
        const grid = this.doc.createElement('div');
        grid.className = 'zw-scui-layout-grid';
        grid.setAttribute('role', 'group');
        grid.setAttribute('aria-label', 'プレビューの3つの表示方式');
        for (const [value, label, description] of [
            ['follow', 'シーク位置に追従', 'シーク先の上に表示。端では画面内に収めます。'],
            ['fixed', '位置を固定', '同じ場所で確認。小画面ではシークバー付近の空き領域を使います。'],
            ['legacy', '従来表示', 'コメントボタンで画像とコメントプレビューを切り替えます。']
        ]) {
            const b = this._button('', 'data-zw-scene-layout', value, 'zw-scui-layout-option');
            b.dataset.zwSceneLayoutMode = mode;
            b.disabled = linked || !this.model.isEnabled(key);
            b.setAttribute('aria-pressed', String(current === value));
            b.setAttribute('aria-label', label);
            const mini = this.doc.createElement('span');
            mini.className = 'zw-scui-mini';
            mini.dataset.layout = value;
            mini.innerHTML = '<i><span>☁</span></i><b>☰</b><em></em>';
            const factor = Math.min(1.5, Math.max(.5, Number(this.model.get('sceneSearch.thumbnailScale') || 100) / 100));
            const imageWidth = 28 * factor, left = (100 - imageWidth - 38) / 2;
            Object.assign(mini.querySelector('i').style, { left: left + '%', width: imageWidth + '%', height: 24 * factor + 'px' });
            Object.assign(mini.querySelector('i span').style, { fontSize: 9 * factor + 'px', lineHeight: 24 * factor + 'px' });
            mini.querySelector('b').style.left = (left + imageWidth + 2) + '%';
            const master = this.model.get('sceneSearch.commentPreviewVisible') !== false;
            mini.querySelector('i span').hidden = !master || this.model.get('sceneSearch.miniCommentVisible') === false;
            mini.querySelector('b').style.opacity = master && this.model.get('sceneSearch.commentListVisible') !== false ? '1' : '.25';
            mini.querySelector('b').style.backgroundColor = 'rgba(0,0,0,' + (Number(this.model.get('sceneSearch.commentListBackgroundOpacity') ?? 90) / 100) + ')';
            const title = this.doc.createElement('strong');
            title.textContent = label;
            const detail = this.doc.createElement('small');
            detail.textContent = description;
            b.append(mini, title, detail);
            grid.append(b);
        }
        wrap.append(grid);
        const note = this.doc.createElement('small');
        note.className = 'zw-scui-note';
        note.textContent = linked ? '通常表示の方式を使用します。全画面用の選択は保持しています。' :
            '中央のコメントボタンで開閉します。変更は「変更を保存」で反映します。';
        wrap.append(note);
        const config = this.model.config;
        const migration = config.resolveSceneSearch?.()?.migration || [];
        if (migration.length && config.getValue?.('sceneSearch.presentation.migrationAcknowledged') !== true) {
            const info = this.doc.createElement('aside');
            info.dataset.zwSceneMigration = '';
            info.className = 'zw-scui-note';
            const names = { follow: 'シーク位置に追従', fixed: '位置を固定', legacy: '従来表示' };
            info.append('表示方式を整理しました。');
            for (const item of migration) {
                const old = this.model.descriptor(item.key.replace('presentation', 'layout'))?.options?.find(o => o.value === item.oldValue)?.label || item.oldValue;
                const line = this.doc.createElement('div');
                line.textContent = old + ' → ' + names[item.newValue];
                info.append(line);
            }
            info.append(this._button('確認した', 'data-zw-scene-migration-ack', ''));
            wrap.append(info);
        }
        return wrap;
    }
    _createPopupColorPanel(rows) {
        const section = this.doc.createElement('section');
        section.className = 'zw-popup-settings';
        const controls = this.doc.createElement('div');
        controls.className = 'zw-popup-settings-controls';
        controls.append(...rows);
        const preview = this.doc.createElement('aside');
        preview.className = 'zw-popup-preview';
        preview.setAttribute('aria-label', '通知の色のプレビュー');
        const title = this.doc.createElement('h4');
        title.textContent = '通知のプレビュー';
        const note = this.doc.createElement('p');
        note.textContent = '変更はこの見本にすぐ反映されます。実際のプレイヤーへの反映は「変更を保存」の後です。';
        preview.append(title, note);
        for (const [key, label, example] of [
            ['popup.notifyColor', '通常・成功通知', '✓ 保存しました'],
            ['popup.alertColor', 'エラー通知', '! コメントの取得に失敗しました']
        ]) {
            const labelNode = this.doc.createElement('p');
            labelNode.textContent = label;
            const sample = this.doc.createElement('div');
            sample.className = 'zw-popup-sample';
            sample.dataset.zwPopupColorSample = key;
            sample.textContent = example;
            preview.append(labelNode, sample);
        }
        const percent = this.doc.createElement('p');
        percent.dataset.zwPopupTransparencyLabel = '';
        preview.append(percent);
        const warning = this.doc.createElement('p');
        warning.textContent = '背景だけを透過します。通知の文字色は従来どおり白です。背景を透明にしすぎると動画によっては読みにくくなる場合があります。';
        preview.append(warning);
        section.append(controls, preview);
        return section;
    }
    _updatePopupColorPreview() {
        const rawTransparency = Number(this.model.get('popup.backgroundTransparency'));
        const transparency = Number.isFinite(rawTransparency) ? Math.max(0, Math.min(100, rawTransparency)) : 0;
        const label = this.cards.querySelector('[data-zw-popup-transparency-label]');
        if (label) {
            label.textContent = '背景の透明度 ' + transparency + '%（0% = 不透明、100% = 完全透明）';
        }
        for (const sample of this.cards.querySelectorAll('[data-zw-popup-color-sample]')) {
            const id = sample.dataset.zwPopupColorSample;
            const raw = String(this.model.get(id) ?? '');
            // Preserve the previous valid preview while a HEX code is being edited.
            if (/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(raw)) {
                sample.dataset.zwPopupLastColor = ModernAdvancedSettingsUI._hexColor(raw);
            }
            const fallback = String(this.model.config.default[id] || '#333333');
            const hex = sample.dataset.zwPopupLastColor || ModernAdvancedSettingsUI._hexColor(fallback) || '#333333';
            if (transparency === 0) {
                sample.style.backgroundColor = hex;
                continue;
            }
            const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
            sample.style.backgroundColor = 'rgba(' + r + ', ' + g + ', ' + b + ', ' + (1 - transparency / 100) + ')';
        }
    }
    _renderCards() {
        this._clearTouchOrder();
        this._ngCompositeEditor?.dispose();
        this._ngCompositeEditor = null;
        if (!this.searchTerm && this.selected.category === 'プレイリスト・検索' &&
            this.selected.subcategory === 'データ管理') {
            this._renderDataPanel();
            return;
        }
        const hits = this.searchTerm ? this.model.search(this.searchTerm) :
            this.model.sectionDescriptors(this.selected.category, this.selected.subcategory);
        const title = this.root.querySelector('[data-zw-title]');
        const sectionLabel = this.selected.subcategory === '関連メニュー › カスタムリンク' ?
            '関連メニュー（全項目）' : this.selected.subcategory;
        title.textContent = this.searchTerm ? '検索結果' : sectionLabel;
        this.root.querySelector('[data-zw-path]').textContent = this.searchTerm ?
            '全カテゴリ横断検索' : this.selected.category + ' / ' + sectionLabel;
        this.root.querySelector('[data-zw-subtitle]').textContent = this.searchTerm ?
            hits.length + '件の設定が見つかりました' : '関連する設定をまとめて表示しています。';
        this.root.querySelector('[data-zw-reset-category]').hidden = !!this.searchTerm;
        // A custom seek uses one combined card rather than two duplicate rows.
        const seen = new Set();
        const entries = [];
        for (let descriptor of hits) {
            if (descriptor.type === 'seconds') {
                descriptor = this.model.descriptor('KEY_' + descriptor.actionId) || descriptor;
            }
            if (!seen.has(descriptor.id)) {
                seen.add(descriptor.id);
                entries.push(descriptor);
            }
        }
        const seekSection = !this.searchTerm && this.selected.category === 'ショートカット' &&
            this.selected.subcategory === 'シーク';
        const used = seekSection ? this._usedCustomSeekSlots() : [];
        const visibleEntries = seekSection ? entries.filter(d => {
            const n = Number((d.actionId || '').match(/^CUSTOM_SEEK_(\d+)$/)?.[1]);
            return !n || used.includes(n);
        }) : entries.filter(d => d.type !== 'related-builtin-options' &&
            (d.type !== 'related-links' || !entries.some(item => item.type === 'related-order')));
        const rows = [];
        const visibilityMode = !this.searchTerm && this.selected.category === '画面・映像' &&
            this.selected.subcategory === '表示・非表示';
        const sceneSection = !this.searchTerm && this.selected.category === '画面・映像' &&
            this.selected.subcategory === 'シーンサーチ';
        const popupSection = !this.searchTerm && this.selected.category === '画面・映像' &&
            this.selected.subcategory === '通知・ポップアップ';
        const groupNames = {
            hover: '動画の上に重なるボタン', related: '関連メニュー', comment: 'コメント入力',
            scene: 'シーンサーチの操作ボタン', 'scene-comments': 'シーンサーチの表示',
            bar: '再生操作バー', info: '動画情報パネル', header: '動画上部のヘッダー',
            shared: 'コメント・補助表示（元の設定画面と共通）'
        };
        let lastScope = null;
        for (const d of visibleEntries.filter(item => !item.hidden && item.type !== 'related-visibility')) {
            if (sceneSection && ['sceneSearch.layout.normal', 'sceneSearch.layout.fullscreen', 'sceneSearch.presentation.normal', 'sceneSearch.presentation.fullscreen'].includes(d.id)) {
                continue; // One canonical draft; the visual gallery replaces redundant select cards.
            }
            if (visibilityMode && d.visibilityScope && d.visibilityScope !== lastScope) {
                const heading = this.doc.createElement('h4');
                heading.className = 'zw-modern-visibility-group';
                heading.dataset.zwVisibilityGroup = d.visibilityScope;
                heading.textContent = groupNames[d.visibilityScope] || 'その他';
                rows.push(heading);
                lastScope = d.visibilityScope;
            }
            rows.push(this._createCard(d));
        }
        if (sceneSection) {
            rows.splice(0, rows.length, this._createSceneSettingsPanel(rows));
        }
        if (!this.searchTerm && this.selected.category === 'プレイリスト・検索' &&
            this.selected.subcategory === '検索') {
            const guide = this.doc.createElement('section');
            guide.className = 'zw-modern-search-guide';
            guide.setAttribute('aria-label', '検索設定の違い');
            guide.innerHTML = [
                '<strong>検索で何が通信されるの？</strong>',
                '<p><b>① タグ候補・動画の予測：</b>検索欄に入力したときの候補表示。件数表示をOFFにしてもこの機能は使えます。</p>',
                '<p><b>② ヒット件数：</b>「〇件」という参考数字だけを調べる追加通信。下の設定で取得タイミングを選べます。</p>',
                '<p><b>③ プレイリストの読み込み：</b>検索を実行して動画を一覧へ追加する処理。最大件数は別の設定です。</p>'
            ].join('');
            rows.unshift(guide);
        }
        if (!this.searchTerm && this.selected.category === '画面・映像' &&
            this.selected.subcategory === '表示・非表示') {
            const guide = this.doc.createElement('section');
            guide.className = 'zw-modern-search-guide';
            guide.setAttribute('aria-label', '表示・非表示の設定');
            guide.innerHTML = [
                '<strong>プレイヤーの表示を自分好みに整理</strong>',
                '<p>動画上・操作バー・動画情報・ヘッダーごとに項目をまとめました。OFFでも再生機能やショートカットは削除されません。</p>',
                '<p>再生・停止、シークバー、閉じる、エラー復旧は残ります。歯車を隠した場合も、マイページの上級者設定から再表示できます。</p>',
                '<p>共通設定の' + ModernAdvancedSettingsModel.SHARED_VISIBILITY.length + '項目は元の場所と同じ値です。変更・キャンセル・初期値への復帰も両方に反映されます。</p>',
                '<p>変更は画面下部の「変更を保存」で確定します。いつでも表示に戻せます。</p>'
            ].join('');
            rows.unshift(guide);
        }
        if (seekSection) {
            const toolbar = this.doc.createElement('div');
            toolbar.className = 'zw-modern-seek-toolbar';
            const count = this.doc.createElement('span');
            count.dataset.zwSeekCount = '';
            count.textContent = 'カスタムシーク ' + used.length + ' / ' + this._customSeekSlots().length + ' 枠';
            const button = this._button('＋ カスタムシークを追加', 'data-zw-add-seek', '', 'zw-modern-plainbtn');
            button.disabled = used.length === this._customSeekSlots().length;
            toolbar.append(count, button);
            this.cards.replaceChildren(toolbar, ...rows);
        }
        else if (popupSection) {
            this.cards.replaceChildren(this._createPopupColorPanel(rows));
        }
        else {
            this.cards.replaceChildren(...rows);
        }
        this._updateSceneSettingsPreview();
        this._updatePopupColorPreview();
    }
    _applyRelatedDraftFromModel() {
        if (!this.relatedEditor) {
            return;
        }
        const value = this.model.get('relatedMenu.customLinks');
        this.relatedEditor.replaceDraftFromParent(value);
    }
    _syncRelatedDraft() {
        if (!this.relatedEditor) {
            return;
        }
        const editor = this.relatedEditor;
        this.model.set('relatedMenu.customLinks', editor.draft);
    }
    _relatedErrors() {
        if (!this.relatedEditor) {
            return [];
        }
        const editor = this.relatedEditor;
        const validation = editor.actions.validateLinks(editor.draft);
        const errs = editor.draft.map((link, index) => editor._rowError(link, index)).filter(Boolean);
        return validation.valid && errs.length === 0 ? [] : errs.length ? errs : ['リンクの入力に不正があります'];
    }
    _onRelatedBubble(event) {
        if (!this.relatedEditor ||
            !this.relatedEditor.container.contains(event.target)) {
            return;
        }
        // Let the existing editor update its own draft first (delegated on its root),
        // then mirror it into the global draft without calling Config.setValue.
        this._syncRelatedDraft();
        this._refreshFooter();
    }
    hasPendingEdits() {
        return this.model.isDirty() || this._visibleSeekSlots.size > 0;
    }
    discardChanges() {
        if (this._recordCleanup) {
            this._recordCleanup();
        }
        this.model.cancel();
        this._visibleSeekSlots.clear();
        this._seekDirections.clear();
        this._orderAnnouncement = '';
        if (this.relatedEditor) {
            this.relatedEditor._load();
        }
        this._renderCards();
        this._refreshFooter();
    }
    _refreshFooter() {
        const changed = this.model.changes().length;
        const pendingSeek = this._visibleSeekSlots.size;
        this.root.querySelector('[data-zw-dirty]').textContent = changed ?
            '● 未保存の変更 ' + changed + '件' :
            pendingSeek ? '● カスタムシークの追加枠 ' + pendingSeek + '件（未設定）' : '保存済み';
        this.root.querySelector('[data-zw-cancel]').disabled = !changed && !pendingSeek;
        this.root.querySelector('[data-zw-save]').disabled = !changed ||
            this.model.validate().length > 0 || this._relatedErrors().length > 0;
    }
    _refreshCards() {
        const errors = new Map(this.model.validate().map(e => [e.id, e.message]));
        for (const card of this.cards.querySelectorAll('[data-zw-id]')) {
            const id = card.dataset.zwId, d = this.model.descriptor(id);
            const seek = d.type === 'shortcut' ? this.model.descriptor('PARAM_' + d.actionId) : null;
            card.classList.toggle('is-modified', (this.model.isDifferentFromDefault(id) ||
                (d.type === 'related-order' &&
                    this.model.isDifferentFromDefault('relatedMenu.hiddenItems')) ||
                (seek && this.model.isDifferentFromDefault(seek.id))));
            const active = this.model.isEnabled(id);
            card.classList.toggle('is-disabled', !active);
            const input = card.querySelector('[data-setting-name]');
            if (input) {
                input.disabled = !active;
            }
            if (id === 'commandFilter') {
                const current = new Set(String(this.model.get(id) ?? '')
                    .split(/\r?\n/).map(value => value.trim().toLowerCase()).filter(Boolean));
                card.querySelectorAll('[data-zw-command-preset]').forEach(button => {
                    button.disabled = !active || current.has(button.dataset.zwCommandPreset);
                });
            }
            card.querySelectorAll('[data-zw-choice]').forEach(button => {
                button.disabled = !active;
            });
            if (d.type === 'regex-flags') {
                const flags = String(this.model.get(id) || '');
                card.querySelectorAll('[data-zw-regex-flag]').forEach(checkbox => {
                    checkbox.checked = flags.includes(checkbox.dataset.zwRegexFlag);
                    checkbox.disabled = !active;
                });
                const field = card.querySelector('[data-zw-regex-raw]');
                if (field) {
                    field.disabled = !active;
                    if (field !== this.doc.activeElement) {
                        field.value = flags;
                    }
                }
                const display = card.querySelector('[data-zw-regex-value]');
                if (display) {
                    display.textContent = flags || '（なし）';
                }
            }
            if (d.type === 'slider') {
                card.querySelectorAll('input[data-setting-name]').forEach(element => {
                    element.disabled = !active;
                    if (element !== this.doc.activeElement || element.type !== 'number') {
                        element.value = String(this.model.get(id));
                    }
                });
            }
            if (d.type === 'font-picker') {
                const select = card.querySelector('[data-zw-font-preset]');
                const custom = card.querySelector('[data-zw-font-custom]');
                const value = String(this.model.get(id) ?? '');
                const preset = d.options.some(item => item.value === value) ? value : '__custom__';
                const editing = custom === this.doc.activeElement && !custom.hidden;
                if (select) {
                    select.disabled = !active;
                    if (!editing) {
                        select.value = preset;
                    }
                }
                if (custom) {
                    custom.disabled = !active;
                    if (!editing) {
                        custom.value = value;
                        custom.hidden = preset !== '__custom__';
                    }
                }
            }
            if (d.type === 'color') {
                this._refreshColorEditor(card, d, active);
            }
            const example = card.querySelector('[data-zw-preview-for]');
            if (example) {
                this._updateVisualExample(example, id);
            }
            let alert = card.querySelector('.zw-modern-validation-error');
            if (errors.has(id)) {
                if (!alert) {
                    alert = this.doc.createElement('span');
                    alert.className = 'zw-modern-warning zw-modern-validation-error';
                    card.append(alert);
                }
                alert.textContent = errors.get(id);
            }
            else if (alert) {
                alert.remove();
            }
            if (seek) {
                const value = Number(this.model.get(seek.id)) || 0;
                const direction = card.querySelector('[data-zw-seek-direction]');
                const magnitude = card.querySelector('[data-zw-seek-magnitude]');
                const sign = this._seekDirections.get(seek.id) || (value > 0 ? 1 : -1);
                if (direction) {
                    direction.value = String(sign);
                }
                if (magnitude && magnitude !== this.doc.activeElement) {
                    magnitude.value = String(Math.abs(value));
                }
            }
            if (d.type === 'shortcut') {
                const text = card.querySelector('[data-zw-key-display]');
                if (text) {
                    text.textContent = this.formatKeyCombo(this.model.get(id));
                }
            }
        }
        this._updateSceneSettingsPreview();
        this._updatePopupColorPreview();
        this._refreshFooter();
    }
    _interceptValue(e) {
        const el = e.target;
        if (el?.dataset?.zwRegexFlag && this.root.contains(el)) {
            e.stopPropagation();
            e.stopImmediatePropagation?.();
            const id = el.dataset.zwRegexId;
            const flag = el.dataset.zwRegexFlag;
            const current = String(this.model.get(id) || '');
            const flags = new Set(current);
            if (el.checked) {
                flags.add(flag);
            }
            else {
                flags.delete(flag);
            }
            const order = 'dgimsuvy';
            const next = [...order].filter(f => flags.has(f)).join('') +
                [...flags].filter(f => !order.includes(f)).join('');
            this.model.set(id, next);
            this._refreshCards();
            return true;
        }
        if (el?.dataset?.zwColorPicker && this.root.contains(el)) {
            e.stopPropagation();
            e.stopImmediatePropagation?.();
            this.model.set(el.dataset.zwColorPicker, el.value);
            this._refreshCards();
            return true;
        }
        if (el?.dataset?.zwFontPreset && this.root.contains(el)) {
            e.stopPropagation();
            e.stopImmediatePropagation?.();
            const id = el.dataset.zwFontPreset;
            const custom = el.closest('.zw-modern-font-editor')
                ?.querySelector('[data-zw-font-custom]');
            if (el.value === '__custom__') {
                if (custom) {
                    custom.hidden = false;
                    custom.focus();
                }
            }
            else {
                this.model.set(id, el.value);
                if (custom) {
                    custom.hidden = true;
                }
                this._refreshCards();
            }
            return true;
        }
        if (el && el.dataset && this.root.contains(el) &&
            (el.dataset.zwSeekDirection || el.dataset.zwSeekMagnitude)) {
            e.stopPropagation();
            e.stopImmediatePropagation?.();
            const id = el.dataset.zwSeekDirection || el.dataset.zwSeekMagnitude;
            const old = Number(this.model.get(id)) || 0;
            if (el.dataset.zwSeekDirection) {
                const direction = Number(el.value) < 0 ? -1 : 1;
                this._seekDirections.set(id, direction);
                this.model.set(id, direction * Math.abs(old));
            }
            else {
                const input = el.value.trim();
                const number = input === '' ? NaN : Number(input);
                const direction = this._seekDirections.get(id) || (old > 0 ? 1 : -1);
                this.model.set(id, Number.isFinite(number) && number >= 0 ? direction * number : NaN);
            }
            this._refreshCards();
            return true;
        }
        if (!el || !el.dataset || !el.dataset.settingName || !this.root.contains(el)) {
            return false;
        }
        e.stopPropagation();
        if (typeof e.stopImmediatePropagation === 'function') {
            e.stopImmediatePropagation();
        }
        const key = el.dataset.settingName;
        const value = el.type === 'checkbox' ? el.checked : el.value;
        try {
            this.model.set(key, key === 'userIdFilter' ?
                ModernAdvancedSettingsUI._formatNgUserIds(value) : value);
        }
        catch (error) {
            this.win.console?.warn?.('Advanced settings input rejected', error);
        }
        if (key === 'sceneSearch.layout.linkFullscreen') {
            this._renderCards();
            this._refreshFooter();
        }
        else {
            this._refreshCards();
        }
        return true;
    }
    _setBuiltinOptionDraft(id, field, value) {
        if (!this.relatedOrder?.STANDARD.some(item => item.id === id)) {
            return;
        }
        const key = this.relatedOrder.OPTIONS_KEY;
        if (!this.model.descriptor(key)) {
            return;
        }
        const all = (this.model.get(key) || {});
        const options = { ...this.relatedOrder.getOption(all, id) };
        if (field === 'popupWidth' || field === 'popupHeight') {
            options[field] = value === '' ? 0 : Number(value);
        }
        else if (field === 'includePosition') {
            options[field] = !!value;
        }
        else if (value === '' || (field === 'openMode' && value === 'default') ||
            (field === 'copyFormat' && value === 'url')) {
            delete options[field];
        }
        else {
            options[field] = value;
        }
        const next = { ...all };
        if (Object.keys(options).length) {
            next[id] = options;
        }
        else {
            delete next[id];
        }
        this.model.set(key, next);
        this._refreshFooter();
    }
    _onValue(e) {
        const builtin = e.target.closest?.('[data-zw-builtin-field]');
        if (builtin && this.root.contains(builtin)) {
            e.stopPropagation();
            this._setBuiltinOptionDraft(builtin.dataset.zwBuiltinId, builtin.dataset.zwBuiltinField, builtin.type === 'checkbox' ? builtin.checked : builtin.value);
            if (['openMode', 'copyFormat'].includes(builtin.dataset.zwBuiltinField)) {
                this._refreshRelatedOrderList();
            }
            return;
        }
        const visible = e.target.closest?.('[data-zw-order-visible]');
        if (visible && this.root.contains(visible)) {
            e.stopPropagation();
            const key = visible.dataset.zwOrderVisible;
            if (!this.relatedOrder?.isValidKey(key)) {
                return;
            }
            const hidden = new Set((this.model.get('relatedMenu.hiddenItems') || []));
            if (visible.checked) {
                hidden.delete(key);
            }
            else {
                hidden.add(key);
            }
            this.model.set('relatedMenu.hiddenItems', [...hidden]);
            this._orderAnnouncement = '表示設定を変更しました。画面下部の「変更を保存」で確定します。';
            this._refreshRelatedOrderList();
            this._refreshFooter();
            return;
        }
        this._interceptValue(e);
    }
    _onInput(e) {
        const builtin = e.target.closest?.('[data-zw-builtin-field]');
        if (builtin && this.root.contains(builtin)) {
            e.stopPropagation();
            this._setBuiltinOptionDraft(builtin.dataset.zwBuiltinId, builtin.dataset.zwBuiltinField, builtin.type === 'checkbox' ? builtin.checked : builtin.value);
            if (builtin.dataset.zwBuiltinField === 'label') {
                const row = this.root.querySelector('[data-zw-order-key="builtin:' + builtin.dataset.zwBuiltinId + '"]');
                const display = row?.querySelector('.zw-order-name');
                if (display) {
                    const original = this.relatedOrder.STANDARD.find(item => item.id === builtin.dataset.zwBuiltinId)?.label || '';
                    display.textContent = builtin.value.trim() || original;
                }
            }
            return;
        }
        if (e.target.matches('[data-zw-search]')) {
            this.searchTerm = e.target.value.trim();
            this._renderCards();
            this._refreshFooter();
            return;
        }
        this._interceptValue(e);
    }
    _onClick(e) {
        if (e.target.closest?.('[data-zw-drawer-dismiss]')) {
            this.root.classList.remove('is-drawer-open');
            return;
        }
        const button = e.target.closest('button');
        if (!button || !this.root.contains(button) || button.disabled) {
            return;
        }
        if (button.hasAttribute('data-zw-scene-migration-ack')) {
            try {
                this.model.config.persistSceneSearchSelection?.({ 'sceneSearch.presentation.migrationAcknowledged': true });
                this._renderCards();
            }
            catch (error) {
                const info = button.closest('[data-zw-scene-migration]');
                if (info) {
                    const note = this.doc.createElement('span');
                    note.setAttribute('role', 'alert');
                    note.textContent = '保存できませんでした。もう一度お試しください。';
                    info.append(note);
                }
            }
            return;
        }
        if (button.hasAttribute('data-zw-scene-layout-mode') &&
            !button.hasAttribute('data-zw-scene-layout')) {
            const mode = button.dataset.zwSceneLayoutMode;
            if (['normal', 'fullscreen'].includes(mode)) {
                this._sceneLayoutTab = mode;
                this._renderCards();
                this._refreshFooter();
            }
            return;
        }
        if (button.hasAttribute('data-zw-scene-layout')) {
            const id = button.dataset.zwSceneLayout;
            const mode = button.dataset.zwSceneLayoutMode;
            if (!['follow', 'fixed', 'legacy'].includes(id) || !['normal', 'fullscreen'].includes(mode) ||
                mode !== this._sceneLayoutTab) {
                return;
            }
            if (mode === 'fullscreen' && this.model.get('sceneSearch.layout.linkFullscreen')) {
                return;
            }
            this.model.set('sceneSearch.presentation.' + mode, id);
            this._renderCards();
            this._refreshFooter();
            return;
        }
        if (button.hasAttribute('data-zw-order-add-link') || button.hasAttribute('data-zw-order-add-copy')) {
            const kind = button.hasAttribute('data-zw-order-add-copy') ? 'copy' : 'link';
            const id = this.relatedEditor?.addItem(kind);
            if (id) {
                this._expandedRelatedOptions = new Set(['link:' + id]);
                this._refreshRelatedOrderList();
            }
            this._refreshFooter();
            return;
        }
        if (button.hasAttribute('data-zw-order-edit')) {
            const key = button.dataset.zwOrderEdit;
            this._expandedRelatedOptions = new Set([key]);
            this._refreshRelatedOrderList();
            this.root.querySelector('[data-zw-order-edit="' + key + '"]')?.focus();
            return;
        }
        if (button.hasAttribute('data-zw-builtin-reset')) {
            const id = button.dataset.zwBuiltinReset;
            const key = this.relatedOrder?.OPTIONS_KEY;
            if (!key || !this.model.descriptor(key)) {
                return;
            }
            const options = { ...(this.model.get(key) || {}) };
            delete options[id];
            this.model.set(key, options);
            this._refreshRelatedOrderList();
            this._refreshFooter();
            return;
        }
        if (button.hasAttribute('data-zw-builtin-insert')) {
            const id = button.dataset.zwBuiltinId;
            const token = button.dataset.zwBuiltinInsert;
            if (!this.relatedActions?.VARIABLES?.includes(token)) {
                return;
            }
            const field = this.root.querySelector('[data-zw-builtin-field="urlTemplate"][data-zw-builtin-id="' + id + '"]');
            if (!field) {
                return;
            }
            const at = typeof field.selectionStart === 'number' ? field.selectionStart : field.value.length;
            const end = typeof field.selectionEnd === 'number' ? field.selectionEnd : at;
            field.setRangeText('{' + token + '}', at, end, 'end');
            this._setBuiltinOptionDraft(id, 'urlTemplate', field.value);
            field.focus();
            return;
        }
        if (button.hasAttribute('data-zw-open-link-editor')) {
            const id = button.dataset.zwOpenLinkEditor.slice(5);
            const links = (this.model.get('relatedMenu.customLinks') || []);
            const index = links.findIndex(item => item.id === id);
            if (index >= 0 && this.relatedEditor) {
                const card = this.relatedEditor.container.querySelector('[data-rl-row="' + index + '"]');
                const expand = card?.querySelector('[data-rl-expand]');
                if (expand?.getAttribute('aria-expanded') === 'false') {
                    expand.click();
                }
                card?.scrollIntoView?.({ block: 'nearest' });
                expand?.focus?.();
            }
            return;
        }
        if (button.hasAttribute('data-zw-order-refresh')) {
            this._refreshRelatedOrderList();
            return;
        }
        if (button.hasAttribute('data-zw-order-up') || button.hasAttribute('data-zw-order-down')) {
            const upward = button.hasAttribute('data-zw-order-up');
            const key = upward ? button.dataset.zwOrderUp : button.dataset.zwOrderDown;
            const keys = this._relatedOrderEntries().map(item => item.key);
            const index = keys.indexOf(key), target = index + (upward ? -1 : 1);
            if (index >= 0 && target >= 0 && target < keys.length) {
                this._moveRelatedOrder(key, keys[target], !upward);
            }
            return;
        }
        if (button.hasAttribute('data-zw-backup-export')) {
            try {
                this.root.querySelector('[data-zw-backup-json]').value =
                    this.model.config.exportJson();
                this.root.querySelector('[data-zw-backup-status]').textContent = '';
            }
            catch (error) {
                this.root.querySelector('[data-zw-backup-status]').textContent =
                    '設定の書き出しに失敗しました: ' + (error.message || error);
            }
            return;
        }
        if (button.hasAttribute('data-zw-backup-import')) {
            const status = this.root.querySelector('[data-zw-backup-status]');
            try {
                const data = JSON.parse(this.root.querySelector('[data-zw-backup-json]').value);
                if (!data || typeof data !== 'object' || Array.isArray(data)) {
                    throw new Error('JSONオブジェクトを指定してください');
                }
                if (this.model.isDirty() && !this.confirm('未保存の編集内容を破棄してバックアップを読み込みますか？')) {
                    return;
                }
                if (!this.confirm('バックアップを取り込んで設定を上書きしますか？')) {
                    return;
                }
                this.model.config.import(data);
                this.model.cancel();
                if (this.relatedEditor) {
                    this.relatedEditor._load();
                }
                status.textContent = '設定を取り込みました。再読み込みします。';
                this.reload();
            }
            catch (error) {
                status.textContent = '設定を読み込めませんでした: ' + (error.message || error);
            }
            return;
        }
        if (button.hasAttribute('data-zw-playlist-export')) {
            try {
                this.root.querySelector('[data-zw-playlist-json]').value =
                    JSON.stringify(this.playlist.export(), null, 2);
                this.root.querySelector('[data-zw-backup-status]').textContent = '';
            }
            catch (error) {
                this.root.querySelector('[data-zw-backup-status]').textContent =
                    'プレイリストの書き出しに失敗しました: ' + (error.message || error);
            }
            return;
        }
        if (button.hasAttribute('data-zw-playlist-import')) {
            const status = this.root.querySelector('[data-zw-backup-status]');
            try {
                const data = JSON.parse(this.root.querySelector('[data-zw-playlist-json]').value);
                if (!this.confirm('プレイリストデータを上書きしますか？')) {
                    return;
                }
                this.playlist.import(data);
                status.textContent = 'プレイリストを取り込みました。再読み込みします。';
                this.reload();
            }
            catch (error) {
                status.textContent = 'プレイリストを読み込めませんでした: ' + (error.message || error);
            }
            return;
        }
        if (button.hasAttribute('data-zw-major')) {
            const major = button.dataset.zwMajor;
            if (this.expanded.has(major)) {
                this.expanded.delete(major);
            }
            else {
                this.expanded.add(major);
            }
            this._saveStored();
            this._renderNavigation();
            return;
        }
        if (button.hasAttribute('data-zw-sub')) {
            const val = button.dataset.zwSub;
            const sep = val.indexOf('|');
            this.selected = { category: val.slice(0, sep), subcategory: val.slice(sep + 1) };
            this.searchTerm = '';
            this.root.querySelector('[data-zw-search]').value = '';
            this._saveStored();
            this.root.classList.remove('is-drawer-open');
            this._renderNavigation();
            this._renderCards();
            this._refreshFooter();
            return;
        }
        if (button.hasAttribute('data-zw-sidebar')) {
            if (this.win.innerWidth <= 760) {
                this.root.classList.toggle('is-drawer-open');
            }
            else {
                this.root.classList.toggle('is-sidebar-collapsed');
            }
            return;
        }
        if (button.hasAttribute('data-zw-close')) {
            if (this.hasPendingEdits() && !this.confirm('未保存の設定変更を破棄して閉じますか？')) {
                return;
            }
            this.discardChanges();
            this.onClose();
            return;
        }
        if (button.hasAttribute('data-zw-command-preset')) {
            if (!this.model.isEnabled('commandFilter')) {
                return;
            }
            const token = button.dataset.zwCommandPreset;
            if (!['red', 'blue', 'green', 'yellow', 'pink', 'cyan', 'black',
                'big', 'small', 'ue', 'shita'].includes(token)) {
                return;
            }
            const old = String(this.model.get('commandFilter') ?? '');
            const existing = new Set(old.split(/\r?\n/)
                .map(value => value.trim().toLowerCase()).filter(Boolean));
            if (existing.has(token)) {
                return;
            }
            this.model.set('commandFilter', old.replace(/[\r\n]+$/, '') +
                (old.trim() ? '\n' : '') + token);
            this._renderCards();
            this._refreshFooter();
            return;
        }
        if (button.hasAttribute('data-zw-regex-advanced-toggle')) {
            const holder = button.closest('.zw-modern-regex-editor');
            const panel = holder?.querySelector('[data-zw-regex-advanced-panel]');
            if (panel) {
                panel.hidden = !panel.hidden;
                button.setAttribute('aria-expanded', String(!panel.hidden));
            }
            return;
        }
        if (button.hasAttribute('data-zw-screenshot-prefix')) {
            this.model.set('screenshot.prefix', button.dataset.zwScreenshotPrefix);
            this._renderCards();
            this._refreshFooter();
            return;
        }
        if (button.hasAttribute('data-zw-filename-template')) {
            this.model.set('screenshot.filenameTemplate', button.dataset.zwFilenameTemplate);
            this._renderCards();
            this._refreshFooter();
            return;
        }
        if (button.hasAttribute('data-zw-filename-token')) {
            const token = button.dataset.zwFilenameToken;
            if (!this.screenshotFileName?.TOKENS.includes(token)) {
                return;
            }
            const id = 'screenshot.filenameTemplate';
            this.model.set(id, String(this.model.get(id) || '') + '{' + token + '}');
            this._renderCards();
            this._refreshFooter();
            return;
        }
        if (button.hasAttribute('data-zw-help')) {
            const card = button.closest('.zw-modern-card');
            const note = card?.querySelector('.zw-modern-note');
            if (note) {
                note.hidden = !note.hidden;
            }
            return;
        }
        if (button.hasAttribute('data-zw-add-seek')) {
            const available = this._customSeekSlots().find(n => !this._usedCustomSeekSlots().includes(n));
            if (available !== undefined) {
                this._visibleSeekSlots.add(available);
                this._renderCards();
                this._refreshFooter();
                this.cards.querySelector('[data-zw-id="KEY_CUSTOM_SEEK_' + available + '"]')
                    ?.scrollIntoView?.({ block: 'nearest' });
            }
            return;
        }
        if (button.hasAttribute('data-zw-remove-seek')) {
            const n = Number(button.dataset.zwRemoveSeek);
            if (!this._customSeekSlots().includes(n)) {
                return;
            }
            this.model.resetItem('KEY_CUSTOM_SEEK_' + n);
            this.model.resetItem('PARAM_CUSTOM_SEEK_' + n);
            this._visibleSeekSlots.delete(n);
            this._seekDirections.delete('PARAM_CUSTOM_SEEK_' + n);
            this._renderCards();
            this._refreshFooter();
            return;
        }
        if (button.hasAttribute('data-zw-reset-item')) {
            this.model.resetItem(button.dataset.zwResetItem);
            if (button.dataset.zwResetItem === 'relatedMenu.customLinks') {
                this._applyRelatedDraftFromModel();
            }
            this._renderCards();
            this._refreshFooter();
            return;
        }
        if (button.hasAttribute('data-zw-reset-category')) {
            // Reset only the currently displayed subcategory, never the entire
            // major group (e.g. all playback or all display preferences).
            const { category, subcategory } = this.selected;
            const count = this.model.sectionDescriptors(category, subcategory).length;
            if (this.confirm(category + ' / ' + subcategory + ' の' + count +
                '項目だけを初期値に戻しますか？（保存前ならキャンセル可能）')) {
                this.model.resetSubcategory(category, subcategory);
                if (subcategory === '関連メニュー › カスタムリンク') {
                    this._applyRelatedDraftFromModel();
                }
                this._renderCards();
                this._refreshFooter();
            }
            return;
        }
        if (button.hasAttribute('data-zw-cancel')) {
            this.discardChanges();
            return;
        }
        if (button.hasAttribute('data-zw-save')) {
            try {
                if (this._relatedErrors().length > 0) {
                    throw new Error('カスタムリンクに不正な入力があります');
                }
                this._syncRelatedDraft();
                const changedKeys = this.model.changes().map(change => change.id);
                const historyKeys = changedKeys.filter(key => key.startsWith('commentHistory.'));
                this.model.save();
                // Another Zenza instance in this document must see settings saved by
                // the separate advanced-settings userscript without a page reload.
                // Other tabs receive native storage events from the same writes.
                if (changedKeys.length && this.win.CustomEvent) {
                    this.win.dispatchEvent(new this.win.CustomEvent('ZenzaWatch-advanced-settings-saved', { detail: { keys: changedKeys } }));
                }
                this._visibleSeekSlots.clear();
                this._seekDirections.clear();
                this._orderAnnouncement = '';
                if (historyKeys.length && this.win.CustomEvent) {
                    this.win.dispatchEvent(new this.win.CustomEvent('ZenzaWatch-comment-history-settings', { detail: { keys: historyKeys } }));
                }
                if (this.relatedEditor) {
                    this.relatedEditor._load();
                }
                this._renderCards();
                this._refreshFooter();
            }
            catch (error) {
                this.win.alert?.(String(error.message || error));
            }
            return;
        }
        if (button.hasAttribute('data-zw-record')) {
            this._beginRecording(button.dataset.zwRecord, button);
            return;
        }
        if (button.hasAttribute('data-zw-clear-key')) {
            this.model.set(button.dataset.zwClearKey, 0);
            this._renderCards();
            this.relatedEditor?._refresh?.();
            this._refreshFooter();
            return;
        }
        if (button.hasAttribute('data-zw-choice')) {
            this.model.set(button.dataset.zwChoice, button.dataset.zwValue);
            this._renderCards();
            this._refreshFooter();
        }
    }
    openDrawer() { this.root.classList.add('is-drawer-open'); }
    _onDocumentKeyDown(e) {
        if (this._recordCleanup) {
            return;
        }
        const grip = e.target.closest?.('[data-zw-order-grip]');
        if (grip && e.altKey && ['ArrowUp', 'ArrowDown'].includes(e.key)) {
            const key = grip.dataset.zwOrderGrip;
            const keys = this._relatedOrderEntries().map(item => item.key);
            const index = keys.indexOf(key);
            const target = index + (e.key === 'ArrowUp' ? -1 : 1);
            if (index >= 0 && target >= 0 && target < keys.length) {
                e.preventDefault();
                this._moveRelatedOrder(key, keys[target], e.key === 'ArrowDown');
                this.root.querySelector('[data-zw-order-grip="' + key + '"]')?.focus();
            }
            return;
        }
        if (e.key === 'Escape' || e.keyCode === 27) {
            if (this.root.classList.contains('is-drawer-open')) {
                this.root.classList.remove('is-drawer-open');
                e.preventDefault();
            }
        }
    }
    _beginRecording(id, button) {
        if (this._recordCleanup) {
            this._recordCleanup();
        }
        const original = button.textContent;
        button.textContent = 'キーを押してください（Escで中止）';
        const handler = (e) => {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation?.();
            if ([16, 17, 18, 91, 92, 93, 224].includes(e.keyCode)) {
                return;
            }
            if (e.keyCode === 27 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
                cleanup();
                return;
            }
            const code = this.encodeKeyCombo(e);
            cleanup();
            if (Number.isSafeInteger(code) && code > 0 && code < 90000000) {
                this.model.set(id, code);
                this._renderCards();
                this.relatedEditor?._refresh?.();
                this._refreshFooter();
            }
        };
        const cleanup = () => {
            this.doc.removeEventListener('keydown', handler, true);
            button.textContent = original;
            this._recordCleanup = null;
        };
        this._recordCleanup = cleanup;
        this.doc.addEventListener('keydown', handler, true);
    }
    dispose() {
        this._ngCompositeEditor?.dispose();
        this._ngCompositeEditor = null;
        this.setModalVisible(false);
        if (this._recordCleanup) {
            this._recordCleanup();
        }
        this.doc.removeEventListener('keydown', this._onKeyDownBound, true);
        this.root.removeEventListener('click', this._onClickBound, true);
        this.root.removeEventListener('change', this._onValueBound, true);
        this.root.removeEventListener('input', this._onInputBound, true);
        this.root.removeEventListener('dragstart', this._onOrderDragStartBound);
        this.root.removeEventListener('dragover', this._onOrderDragOverBound);
        this.root.removeEventListener('drop', this._onOrderDropBound);
        this.root.removeEventListener('dragend', this._onOrderDragEndBound);
        this._clearTouchOrder();
        this.root.removeEventListener('pointerdown', this._onTouchOrderDownBound);
        this.root.removeEventListener('pointermove', this._onTouchOrderMoveBound);
        this.root.removeEventListener('pointerup', this._onTouchOrderUpBound);
        this.root.removeEventListener('pointercancel', this._onTouchOrderCancelBound);
        this._unwatchRelatedActions?.();
        this.model.config.offkey?.('backComment', this._onBackCommentConfigUpdate);
        this.root.removeEventListener('click', this._onRelatedClickBound);
        this.root.removeEventListener('change', this._onRelatedChangeBound);
        this.root.removeEventListener('input', this._onRelatedInputBound);
        if (this.relatedEditor && this._relatedOrigin?.parent) {
            const { parent, next } = this._relatedOrigin;
            const editor = this.relatedEditor.container;
            if (next && next.parentNode === parent) {
                parent.insertBefore(editor, next);
            }
            else {
                parent.appendChild(editor);
            }
            editor.querySelector('[data-rl-save]').hidden = false;
            editor.querySelector('[data-rl-cancel]').hidden = false;
            this.relatedEditor.embedded = false;
            this.relatedEditor.onDraftChange = null;
            this.relatedEditor.getDraftShortcutValue = null;
            this.relatedEditor.getDraftShortcutConflicts = null;
        }
        for (const [node, { parent, next }] of this._moved) {
            if (!parent) {
                continue;
            }
            if (next && next.parentNode === parent) {
                parent.insertBefore(node, next);
            }
            else {
                parent.appendChild(node);
            }
        }
        this.root.remove();
        this.panel.classList.remove('zw-modern-active');
    }
}
//===END===
export { ModernAdvancedSettingsUI };
