// Task318: responsive Zenza Dark shell for the new advanced settings.
// Source is deliberately isolated from the older SettingPanel until parity validation.
//===BEGIN===
class ModernAdvancedSettingsUI {
  static _style(doc) {
    if(doc.querySelector('style[data-zw-modern-ui]')) { return; }
    const style=doc.createElement('style');
    style.setAttribute('data-zw-modern-ui','');
    style.textContent=[
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
      '.zw-modern-regex-editor input[type=checkbox] { flex:none; width:17px; height:17px; appearance:auto; accent-color:#82bfff; border-radius:3px; }',
      '.zw-modern-regex-editor [data-zw-regex-advanced-panel] { display:flex; flex-direction:column; gap:6px; align-items:flex-start; }',
      '.zw-modern-regex-editor [data-zw-regex-advanced-panel][hidden] { display:none!important; }',
      '.zw-modern-regex-editor input[type=text] { width:180px; min-width:0; }',
      '.zw-modern-regex-current { color:var(--zw-dark-muted); font-size:11px; }',
      '.zw-modern-regex-editor small { color:var(--zw-dark-muted); font-size:11px; }',
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
      '@media(max-width:1050px) { .zw-order-workspace { grid-template-columns:minmax(0,1fr); } .zw-order-inspector { position:static; max-height:none; } }',
      '@media(max-width:760px) {.zw-modern-sidebar { position:absolute; top:0; bottom:0; left:0; z-index:5; width:min(290px,88vw); flex-basis:auto; transform:translateX(-100%); box-shadow:6px 0 22px #0007; padding:12px; } .zw-modern-root.is-drawer-open .zw-modern-sidebar { transform:translateX(0); } .zw-modern-root.is-drawer-open .zw-modern-backdrop { display:block; background:#0008; position:absolute; inset:0; z-index:4; } .zw-modern-main { padding:15px 11px; } .zw-modern-card { padding:10px; } .zw-modern-footer { padding:9px; } .zw-modern-footer .zw-modern-dirty { font-size:11px; }}'
    ].join('\n');
    doc.head.append(style);
  }
  constructor({panel,legacyRoot,model,storage,onClose,confirm,formatKeyCombo,encodeKeyCombo,relatedEditor=null,relatedOrder=null,relatedActions=null,screenshotFileName=null,playlist=null,reload=null}) {
    if(!panel || !model) { throw new TypeError('Panel and model are required'); }
    this.panel=panel;
    this.legacyRoot=legacyRoot;
    this.model=model;
    this.relatedEditor=relatedEditor;
    this.relatedOrder=relatedOrder;
    this.relatedActions=relatedActions;
    this.screenshotFileName=screenshotFileName;
    this._orderDragKey=null;
    this._orderDropKey=null;
    this._orderDropAfter=false;
    this._orderAnnouncement='';
    this._expandedRelatedOptions=new Set();
    this._touchOrder=null;
    this.playlist=playlist;
    this.reload=reload || (()=>this.win.location.reload());
    if (relatedEditor) {
      relatedEditor.getDraftShortcutValue=id=>this.model.get(id);
      relatedEditor.getDraftShortcutConflicts=key=>[
        ...this.model.actions.filter(action=>
          Number(this.model.get('KEY_'+action.id))===key)
          .map(action=>action.label||action.id),
        ...relatedEditor.draft.filter(link=>link&&link.enabled!==false &&
          Number(link.shortcutKey)===key).map(link=>link.label||link.id)
      ];
      relatedEditor.embedded=true;
      relatedEditor.onDraftChange=value=>this._onCustomMenuDraft(value);
    }
    this._relatedOrigin=relatedEditor?{parent:relatedEditor.container.parentNode,
      next:relatedEditor.container.nextSibling}:null;
    this.doc=panel.ownerDocument;
    this.win=this.doc.defaultView;
    this.storage=storage || this.win.localStorage;
    this.onClose=onClose || (()=>{});
    this.confirm=confirm || (message=>this.win.confirm(message));
    this.formatKeyCombo=formatKeyCombo || (v=>String(v||'(未設定)'));
    this.encodeKeyCombo=encodeKeyCombo || (e=>e.keyCode);
    this.expanded=new Set();
    this._moved=new Map();
    this._seekDirections=new Map();
    // Empty custom seek slots are hidden until the user chooses Add.
    // No placeholder configuration keys are written to storage.
    this._visibleSeekSlots=new Set();
    this._recordCleanup=null;
    this.searchTerm='';
    this._setupSelection();
    ModernAdvancedSettingsUI._style(this.doc);
    this.root=this.doc.createElement('section');
    this.root.className='zw-modern-root';
    this.root.style.setProperty('--zw-sidebar-width','290px');
    this.root.setAttribute('role','dialog');
    this.root.setAttribute('aria-label','ZenzaWatch 上級者設定');
    this.root.innerHTML=[
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
    this.nav=this.root.querySelector('.zw-modern-nav');
    this.cards=this.root.querySelector('[data-zw-cards]');
    this.root.addEventListener('click',this._onClickBound=e=>this._onClick(e),true);
    this.root.addEventListener('change',this._onValueBound=e=>this._onValue(e),true);
    this.root.addEventListener('input',this._onInputBound=e=>this._onInput(e),true);
    this.root.addEventListener('dragstart',this._onOrderDragStartBound=e=>this._onOrderDragStart(e));
    this.root.addEventListener('dragover',this._onOrderDragOverBound=e=>this._onOrderDragOver(e));
    this.root.addEventListener('drop',this._onOrderDropBound=e=>this._onOrderDrop(e));
    this.root.addEventListener('dragend',this._onOrderDragEndBound=()=>this._onOrderDragEnd());
    this.root.addEventListener('pointerdown',this._onTouchOrderDownBound=e=>this._onTouchOrderDown(e));
    this.root.addEventListener('pointermove',this._onTouchOrderMoveBound=e=>this._onTouchOrderMove(e));
    this.root.addEventListener('pointerup',this._onTouchOrderUpBound=e=>this._onTouchOrderUp(e));
    this.root.addEventListener('pointercancel',this._onTouchOrderCancelBound=()=>this._clearTouchOrder());
    this.root.addEventListener('click',this._onRelatedClickBound=e=>this._onRelatedBubble(e));
    this.root.addEventListener('change',this._onRelatedChangeBound=e=>this._onRelatedBubble(e));
    this.root.addEventListener('input',this._onRelatedInputBound=e=>this._onRelatedBubble(e));
    this.doc.addEventListener('keydown',this._onKeyDownBound=e=>this._onDocumentKeyDown(e),true);
    this.panel.appendChild(this.root);
    this._unwatchRelatedActions=this.relatedActions?.onChange?.(()=>
      this._refreshRelatedOrderList()) || null;
    this._renderNavigation();
    this._renderCards();
    this._refreshFooter();
    this.panel.classList.add('zw-modern-active');
    this._savedPageOverflow=null;
    this.setModalVisible(this.panel.classList.contains('show'));
  }
  // Only lock page scrolling while the actual settings modal is shown.
  // Preserve inline site styles so normal scrolling returns on close/dispose.
  setModalVisible(visible) {
    if(visible) {
      if(this._savedPageOverflow){return;}
      const elements=[this.doc.documentElement,this.doc.body].filter(Boolean);
      this._savedPageOverflow=elements.map(el=>({
        element:el,value:el.style.getPropertyValue('overflow'),
        priority:el.style.getPropertyPriority('overflow')
      }));
      elements.forEach(el=>el.style.setProperty('overflow','hidden','important'));
    } else if(this._savedPageOverflow) {
      this._savedPageOverflow.forEach(({element,value,priority})=>{
        if(value){element.style.setProperty('overflow',value,priority);}
        else {element.style.removeProperty('overflow');}
      });
      this._savedPageOverflow=null;
    }
  }
  _setupSelection() {
    const all=this.model.descriptors;
    const first=all.find(d=>d.category==='再生・音声') || all[0];
    const fallback=first?{category:first.category,subcategory:first.subcategory}:
      {category:'再生・音声',subcategory:'再生動作'};
    const previous=this._readStored('zw-advanced-modern-selection');
    const saved=previous?.category==='コメント増量' ?
      {category:'コメント表示',subcategory:'追加取得'} : previous;
    this.selected=(saved&&(this.model.descriptors.some(d=>d.category===saved.category &&
      d.subcategory===saved.subcategory)||
      (saved.category==='プレイリスト・検索'&&saved.subcategory==='データ管理')))?saved:fallback;
    const open=this._readStored('zw-advanced-modern-expanded');
    const majors=Array.isArray(open) ?
      [...new Set(open.map(name=>name==='コメント増量'?'コメント表示':name))]
        .filter(name=>this.model.categories.includes(name)) : [];
    this.expanded=new Set(majors.length?majors:[this.selected.category]);
  }
  _readStored(key) {
    try {return JSON.parse(this.storage.getItem(key));}catch(_){return null;}
  }
  _saveStored() {
    try {
      this.storage.setItem('zw-advanced-modern-selection',JSON.stringify(this.selected));
      this.storage.setItem('zw-advanced-modern-expanded',JSON.stringify([...this.expanded]));
    } catch(_) { /* UI navigation still works without persistent storage */ }
  }
  _button(text,attribute,value,cssClass='') {
    const el=this.doc.createElement('button');
    el.type='button';
    el.textContent=text;
    el.setAttribute(attribute,value);
    el.className=cssClass;
    return el;
  }
  _renderNavigation() {
    this.nav.replaceChildren();
    for(const major of this.model.categories) {
      const subs=[...new Set(this.model.descriptors
        .filter(d=>d.category===major).map(d=>d.subcategory))];
      if(major==='プレイリスト・検索'){subs.push('データ管理');}
      const open=this.expanded.has(major);
      const b=this._button((open?'⌄ ':'› ')+major,'data-zw-major',major);
      b.setAttribute('aria-expanded',String(open));
      if(this.selected.category===major) {b.classList.add('is-active');}
      this.nav.appendChild(b);
      if(!open){continue;}
      for(const sub of subs) {
        const label=sub==='関連メニュー › カスタムリンク'?'関連メニュー（全項目）':sub;
        const item=this._button(label,'data-zw-sub',major+'|'+sub,'zw-modern-sub');
        if(this.selected.category===major&&this.selected.subcategory===sub) {
          item.classList.add('is-active');
        }
        this.nav.appendChild(item);
      }
    }
  }
  // The filter accepts newline-delimited IDs, but runtime settings may be an
  // array (whose implicit textarea conversion would display commas).
  static _formatNgUserIds(value) {
    const text=Array.isArray(value)?value.join('\n'):String(value??'');
    return text.split(/[,\r\n]+/).map(id=>id.trim()).filter(Boolean).join('\n');
  }
  static _hexColor(value) {
    const text=String(value||'').trim().toLowerCase();
    if(/^#[0-9a-f]{6}$/.test(text)){return text;}
    if(/^#[0-9a-f]{3}$/.test(text)){
      return '#'+[...text.slice(1)].map(ch=>ch+ch).join('');
    }
    const named={green:'#008000',red:'#ff0000',blue:'#0000ff',
      black:'#000000',white:'#ffffff',gray:'#808080',grey:'#808080',
      yellow:'#ffff00',orange:'#ffa500',purple:'#800080'};
    return named[text]||null;
  }
  _makeVisualExample(descriptor) {
    const id=descriptor.id;
    if(![
      'screenMode','screenMode:ginza','screenMode:others',
      'fullscreenControlBarMode','videoHeader.position',
      'commentLayer.textShadowType','commentLayer.ownerCommentShadowColor',
      'cssFontWeight','baseFontFamily','baseChatScale','screenshot.prefix',
      'screenshot.filenameTemplate'
    ].includes(id)){return null;}
    const area=this.doc.createElement('div');
    area.className='zw-modern-example';
    area.dataset.zwPreviewFor=id;
    const label=this.doc.createElement('span');
    label.className='zw-example-label';
    label.textContent=id==='screenshot.prefix' || id==='screenshot.filenameTemplate'?
      '保存ファイル名の例':
      '表示例（選択した設定の模式図）';
    area.append(label);
    if(id.startsWith('screenMode')||id==='fullscreenControlBarMode'||
      id==='videoHeader.position'){
      const stage=this.doc.createElement('div');
      stage.className='zw-example-screen';
      stage.innerHTML='<div class="zw-example-video">'+
        '<div class="zw-example-title">動画タイトル</div>'+
        '<div class="zw-example-fly">サンプルコメント　→</div>'+
        '<div class="zw-example-controlbar">▶ ━━━━━━━━━━ ◖ ))</div>'+
        '</div><div class="zw-example-sidebar">情報・タグ</div>';
      area.append(stage);
    }else if(id==='screenshot.prefix' || id==='screenshot.filenameTemplate'){
      const code=this.doc.createElement('code');
      code.className='zw-example-filename';
      area.append(code);
      const parts=this.doc.createElement('div');
      parts.className='zw-modern-prefix-breakdown';
      for(const [label,text] of [
        ['先頭に追加する文字','自由入力'],
        ['動画タイトル','自動で追加'],['動画ID','自動で追加'],
        ['再生位置','自動で追加'],['.png','自動で追加']
      ]){
        const item=this.doc.createElement('span');
        item.textContent=label+'（'+text+'）';
        parts.append(item);
      }
      area.append(parts);
    }else{
      const sample=this.doc.createElement('span');
      sample.className='zw-example-text';
      sample.textContent=id==='commentLayer.ownerCommentShadowColor' ?
        '投稿者コメントの影色' : 'サンプルコメント 123';
      area.append(sample);
    }
    const caption=this.doc.createElement('span');
    caption.className='zw-example-caption';
    area.append(caption);
    this._updateVisualExample(area,id);
    return area;
  }
  _updateVisualExample(area,id) {
    const value=String(this.model.get(id)??'');
    area.dataset.zwExampleMode=value;
    const sample=area.querySelector('.zw-example-text');
    const caption=area.querySelector('.zw-example-caption');
    if(id.startsWith('screenMode')){
      const hints={
        normal:'通常サイズのウィンドウで動画を表示します。',
        big:'通常より大きなウィンドウで動画を表示します。',
        wide:'画面幅を広く使う表示です。',
        '3D':'立体的な視点を使う表示です。',
        small:'小さなポップアップ形式で表示します。',
        sideView:'ページの横に小さく配置する表示です。'
      };
      caption.textContent=hints[value]||'動画の表示モードの例です。';
    }else if(id==='fullscreenControlBarMode'){
      caption.textContent=({
        auto:'画面サイズなどに応じて操作バーを自動調整します。',
        'always-show':'操作バーを常に表示する設定です。',
        'always-hide':'操作バーを常に隠す設定です。'
      })[value]||'操作バーの表示方法です。';
    }else if(id==='videoHeader.position'){
      caption.textContent=({
        auto:'画面幅によって外側／重ね合わせを自動で切り替えます。',
        outside:'動画の外側にタイトルなどを表示します。',
        overlay:'動画に重ね、操作時にだけ表示します。',
        'overlay-visible':'動画に重ね、常時表示します。'
      })[value]||'動画ヘッダーの配置例です。';
    }else if(id==='screenshot.prefix' || id==='screenshot.filenameTemplate'){
      const prefix=String(this.model.get('screenshot.prefix')??'');
      const template=String(this.model.get('screenshot.filenameTemplate')??'');
      area.querySelector('.zw-example-filename').textContent=this.screenshotFileName?
        this.screenshotFileName.format({
          prefix,template,title:'動画タイトル',watchId:'sm9',videoId:'sm9',
          uploader:'投稿者',currentTime:83,formatTime:()=> '1_23',
          now:new Date('2026-10-10T12:34:56')
        }):prefix+'動画タイトル - sm9@1_23.png';
      caption.textContent='拡張子はPNG固定。コメント付き画像はCを追加し、使えない文字は安全な文字に置換します。';
    }else if(sample){
      sample.style.textShadow='';
      sample.style.webkitTextStroke='';
      sample.style.color='#ffffff';
      if(id==='commentLayer.textShadowType'){
        const shadows={
          '':'1px 1px 0 rgba(0,0,0,.9)',
          'shadow-type2':'1px 1px 0 #000,-1px 1px 0 #000,-1px -1px 0 #000,1px -1px 0 #000',
          'shadow-type3':'1px 1px 1px rgba(0,0,0,.8),0 0 3px rgba(0,0,0,.8),-1px -1px 1px #888',
          'shadow-stroke':'none',
          'shadow-dokaben':'1px 1px 0 #963200,-1px 1px 0 #963200,-1px -1px 0 #963200,1px -1px 0 #963200'
        };
        sample.style.textShadow=shadows[value]||shadows[''];
        if(value==='shadow-stroke'){
          sample.style.webkitTextStroke='1px rgba(0,0,0,.7)';
        }else if(value==='shadow-dokaben'){
          sample.style.color='rgb(200,80,0)';
        }
        caption.textContent=value==='shadow-dokaben'?
          '専用フォントがない場合は代替文字で表示します。':'同じ文字を使った影の比較見本です。';
      }else if(id==='commentLayer.ownerCommentShadowColor'){
        const color=ModernAdvancedSettingsUI._hexColor(value) || value;
        sample.style.textShadow=[
          '1px 1px 0 '+color,'-1px 1px 0 '+color,
          '1px -1px 0 '+color,'-1px -1px 0 '+color
        ].join(',');
        caption.textContent='現在の影色：'+value;
      }else if(id==='cssFontWeight'){
        sample.style.fontWeight=value||'normal';
        caption.textContent='CSS値 '+value+' の文字の太さです。';
      }else if(id==='baseFontFamily'){
        if(value){sample.style.fontFamily=value;}
        caption.textContent=value?'選択したフォントがない場合は代替フォントで表示します。':
          'プレイヤーの標準フォントで表示します。';
      }else if(id==='baseChatScale'){
        sample.style.fontSize=(24*Math.min(2,Math.max(.5,Number(value)||1)))+'px';
        caption.textContent='現在の倍率：'+value+'倍（比率を示す見本です）。';
      }
    }
  }

  _createVisibilityIcon(id,descriptor=this.model.descriptor(id)) {
    // Placement aliases share the setting ID, but can add a display-only icon.
    const glyph=descriptor?.icon;
    if(!glyph){return null;}
    const icon=this.doc.createElement('span');
    icon.className='zw-modern-visibility-icon';
    icon.dataset.zwVisibilityIcon=id;
    icon.setAttribute('aria-hidden','true');
    const paths={
      'comments-video':'M3 5h18v14H3z M6 9h8 M9 13h9',
      'comments-list':'M5 3h14v18H5z M8 7h1 M11 7h5 M8 12h1 M11 12h5 M8 17h1 M11 17h5',
      'comments-preview':'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z M9 10h6 M9 14h6',
      'comment-heatmap':'M3 18h18 M4 16v-3 M8 16V8 M12 16V4 M16 16V9 M20 16v-4',
      'seek-thumbnail':'M4 3h16v13H4z M6 13l4-5 4 4 2-2 2 3 M3 21h18 M12 19v4',
      'scene-filmstrip':'M2 5h20v14H2z M8 5v14 M16 5v14 M2 8h20 M2 16h20',
      'ad-crown':'M3 7l5 4 4-7 4 7 5-4-2 12H5z M6 22h12'
    };
    if(paths[glyph]){
      icon.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="'+paths[glyph]+'"/></svg>';
    }else if(glyph==='shield-ng'){
      icon.innerHTML='<svg viewBox="0 0 24 24"><path d="M12 2.5 19 5v5.5c0 4.6-2.8 8.4-7 10.8-4.2-2.4-7-6.2-7-10.8V5l7-2.5Z"/><path d="m8 8 8 8"/></svg>';
    }else if(glyph==='filter-sparkle'){
      icon.innerHTML='<svg viewBox="0 0 36 36"><path d="M15 10Q15 19 24 19Q15 19 15 28Q15 19 6 19Q15 19 15 10ZM26 5.5Q26 10 30.5 10Q26 10 26 14.5Q26 10 21.5 10Q26 10 26 5.5Z"/></svg>';
    }else{
      icon.textContent=glyph==='related-menu'?'関連メニュー ▾':
        glyph==='comment-input'?'コメント入力(C)':glyph;
      // Text is a visual preview of an existing player icon, not a second row.
      // Keep the original glyphs; only scale ones too wide for the 38px tile.
      if(id==='ui.bar.speed' || id==='ui.bar.time'){
        icon.classList.add('is-compact-glyph');
      }else if(id==='ui.bar.volume' || id==='ui.info.credits'){
        icon.classList.add('is-pair-glyph');
      }
      if(glyph==='related-menu'){icon.classList.add('is-related');}
      if(glyph==='comment-input'){icon.classList.add('is-comment-input');}
      if(id==='ui.hover.like'){icon.classList.add('is-like');}
      if(id==='ui.hover.tweet'){icon.classList.add('is-tweet');}
      if(id==='ui.hover.mylist'){icon.classList.add('is-mylist');}
      if(id==='ui.hover.comments'){icon.classList.add('is-comment');}
    }
    return icon;
  }

  _createCard(descriptor) {
    const card=this.doc.createElement('article');
    card.className='zw-modern-card';
    card.dataset.zwId=descriptor.id;
    const seekDescriptor=descriptor.type==='shortcut' ?
      this.model.descriptor('PARAM_'+descriptor.actionId) : null;
    if(descriptor.type==='boolean' ||
      (descriptor.type==='shortcut' && !seekDescriptor)) {
      card.classList.add('is-inline');
    }
    if(this.model.isDifferentFromDefault(descriptor.id) ||
      (descriptor.type==='related-order' &&
        (this.model.isDifferentFromDefault('relatedMenu.hiddenItems') ||
         this.model.isDifferentFromDefault('relatedMenu.builtinOptions'))) ||
      (seekDescriptor && this.model.isDifferentFromDefault(seekDescriptor.id))) {
      card.classList.add('is-modified');
    }
    if(descriptor.dependsOn) {card.classList.add('is-child');}
    if(!this.model.isEnabled(descriptor.id)) {card.classList.add('is-disabled');}
    const head=this.doc.createElement('div');
    head.className='zw-modern-cardhead';
    const title=this.doc.createElement('strong');
    title.textContent=descriptor.label;
    const icon=this._createVisibilityIcon(descriptor.id,descriptor);
    if(icon){head.append(icon);}
    head.append(title);
    if(descriptor.sharedWith){
      const shared=this.doc.createElement('small');
      shared.dataset.zwSharedSetting=descriptor.id;
      shared.textContent='共通設定';
      shared.title=descriptor.sharedWith+' と同じ設定値です。';
      head.append(shared);
    }
    if(descriptor.description) {
      const help=this._button('?','data-zw-help',descriptor.id,'zw-modern-plainbtn');
      help.setAttribute('aria-label',descriptor.label+'の説明を表示');
      head.append(help);
    }
    const reset=this._button('↺','data-zw-reset-item',descriptor.id,'zw-modern-plainbtn');
    reset.title='この項目を初期値に戻す';
    head.append(reset);
    card.append(head);
    const controls=this.doc.createElement('div');
    controls.className='zw-modern-cardcontrols';
    if(descriptor.type==='shortcut') {
      const key=this.doc.createElement('span');
      key.dataset.zwKeyDisplay='';
      key.textContent=this.formatKeyCombo(this.model.get(descriptor.id));
      controls.append(key,this._button('変更','data-zw-record',descriptor.id,'zw-modern-plainbtn'),
        this._button('解除','data-zw-clear-key',descriptor.id,'zw-modern-plainbtn'));
      const seek=this.model.descriptor('PARAM_'+descriptor.actionId);
      if(seek) {
        const raw=Number(this.model.get(seek.id))||0;
        const sign=this._seekDirections.get(seek.id) || (raw>0?1:-1);
        const group=this.doc.createElement('div');
        group.className='zw-modern-seek-editor';
        const direction=this.doc.createElement('select');
        direction.dataset.zwSeekDirection=seek.id;
        direction.setAttribute('aria-label','シーク方向');
        for(const [value,label] of [['-1','戻る'],['1','進む']]){
          const option=this.doc.createElement('option');
          option.value=value;option.textContent=label;direction.append(option);
        }
        direction.value=String(sign);
        const magnitude=this.doc.createElement('input');
        magnitude.type='number';magnitude.min='0';magnitude.step='0.1';
        magnitude.value=String(Math.abs(raw));
        magnitude.dataset.zwSeekMagnitude=seek.id;
        magnitude.setAttribute('aria-label','シーク秒数');
        group.append(direction,magnitude);
        const unit=this.doc.createElement('span');unit.textContent='秒';
        group.append(unit);
        controls.append(group);
        const slot=Number((descriptor.actionId||'').match(/CUSTOM_SEEK_(\d+)/)?.[1]);
        if(Number.isInteger(slot)){
          const remove=this._button('削除','data-zw-remove-seek',String(slot),
            'zw-modern-plainbtn');
          remove.title='この枠のキーと秒数を初期値に戻す（保存前はキャンセル可能）';
          controls.append(remove);
        }
      }
      const warns=this.model.keyConflicts(this.model.get(descriptor.id));
      if(warns.length>1) {
        const warning=this.doc.createElement('span');
        warning.className='zw-modern-warning';
        warning.textContent='⚠ キー重複：'+warns.join('、');
        controls.append(warning);
      }
    } else if(descriptor.type==='related-order') {
      controls.append(this._renderRelatedOrderControls());
    } else if(descriptor.type==='related-links') {
      if(this.relatedEditor) {
        this.relatedEditor.showList();
        const editor=this.relatedEditor.container;
        editor.querySelector('[data-rl-save]').hidden=true;
        editor.querySelector('[data-rl-cancel]').hidden=true;
        const toolbar=editor.querySelector('.rl-toolbar');
        if(toolbar){toolbar.setAttribute('aria-label','変更は設定画面の下部から保存します');}
        controls.append(editor);
      } else {
        const info=this.doc.createElement('span');
        info.textContent='カスタムリンクの編集を利用できません。';
        controls.append(info);
      }
    } else if(descriptor.type==='regex-flags') {
      const box=this.doc.createElement('div');
      box.className='zw-modern-regex-editor';
      const flags=String(this.model.get(descriptor.id)||'');
      const choices=[
        ['i','大文字・小文字を区別しない（おすすめ）'],
        ['m','^ と $ を行ごとに判定する'],
        ['s','「.」を改行にも一致させる'],
        ['u','日本語などのUnicode文字を正しく扱う']
      ];
      for(const [flag,label] of choices) {
        const line=this.doc.createElement('label');
        const check=this.doc.createElement('input');
        check.type='checkbox';
        check.dataset.zwRegexFlag=flag;
        check.dataset.zwRegexId=descriptor.id;
        check.checked=flags.includes(flag);
        check.disabled=!this.model.isEnabled(descriptor.id);
        line.append(check,this.doc.createTextNode(label));
        box.append(line);
      }
      const current=this.doc.createElement('div');
      current.className='zw-modern-regex-current';
      current.textContent='現在のフラグ: ';
      const value=this.doc.createElement('code');
      value.dataset.zwRegexValue='';
      value.textContent=flags||'（なし）';
      current.append(value);
      box.append(current);
      const toggle=this._button('詳細：フラグを直接入力','data-zw-regex-advanced-toggle',
        descriptor.id,'zw-modern-plainbtn');
      toggle.setAttribute('aria-expanded','false');
      box.append(toggle);
      const advanced=this.doc.createElement('div');
      advanced.dataset.zwRegexAdvancedPanel='';
      advanced.hidden=true;
      const raw=this.doc.createElement('input');
      raw.type='text';raw.dataset.settingName=descriptor.id;
      raw.dataset.zwRegexRaw='';
      raw.value=flags;raw.setAttribute('aria-label','正規表現のフラグを直接入力');
      raw.disabled=!this.model.isEnabled(descriptor.id);
      const caution=this.doc.createElement('small');
      caution.textContent='g・yなどのフラグはNG判定の結果が変化する場合があります。初心者は通常iだけで十分です。';
      advanced.append(raw,caution);
      box.append(advanced);
      controls.append(box);
    } else if(descriptor.type==='font-picker') {
      const box=this.doc.createElement('div');
      box.className='zw-modern-font-editor';
      const preset=this.doc.createElement('select');
      preset.dataset.zwFontPreset=descriptor.id;
      preset.setAttribute('aria-label','フォントの候補から選択');
      for(const entry of descriptor.options){
        const option=this.doc.createElement('option');
        option.value=entry.value;option.textContent=entry.label;preset.append(option);
      }
      const free=this.doc.createElement('option');
      free.value='__custom__';free.textContent='その他（自由入力）';
      preset.append(free);
      const value=String(this.model.get(descriptor.id)??'');
      preset.value=descriptor.options.some(o=>o.value===value)?value:'__custom__';
      const custom=this.doc.createElement('input');
      custom.type='text';custom.dataset.settingName=descriptor.id;
      custom.dataset.zwFontCustom=descriptor.id;
      custom.value=value;custom.placeholder="'好きなフォント名', sans-serif";
      custom.setAttribute('aria-label','フォント名を自由に入力');
      custom.hidden=preset.value!=='__custom__';
      custom.disabled=!this.model.isEnabled(descriptor.id);
      preset.disabled=!this.model.isEnabled(descriptor.id);
      box.append(preset,custom);
      controls.append(box);
    } else if(descriptor.type==='color') {
      const box=this.doc.createElement('div');
      box.className='zw-modern-color-editor';
      const picker=this.doc.createElement('input');
      picker.type='color';picker.dataset.zwColorPicker=descriptor.id;
      picker.setAttribute('aria-label','カラーピッカーで色を選択');
      const raw=String(this.model.get(descriptor.id)||'');
      picker.value=ModernAdvancedSettingsUI._hexColor(raw)||'#008800';
      picker.disabled=!this.model.isEnabled(descriptor.id);
      const code=this.doc.createElement('input');
      code.type='text';code.dataset.settingName=descriptor.id;
      code.dataset.zwColorCode=descriptor.id;
      code.value=raw;code.placeholder='#008800';code.spellcheck=false;
      code.setAttribute('aria-label','カラーコード（HEXまたはCSS色名）');
      code.disabled=!this.model.isEnabled(descriptor.id);
      const hint=this.doc.createElement('span');
      hint.className='zw-modern-color-hint';
      hint.textContent='カラーコード #RRGGBB または #RGB（CSS色名も使用可）';
      box.append(picker,code,hint);
      controls.append(box);
    } else if(descriptor.type==='slider') {
      const holder=this.doc.createElement('div');
      holder.className='zw-modern-slider';
      const value=this.model.get(descriptor.id);
      const makeInput=type=>{
        const input=this.doc.createElement('input');
        input.type=type;
        input.dataset.settingName=descriptor.id;
        input.min=String(descriptor.min);
        input.max=String(descriptor.max);
        input.step=String(descriptor.step||1);
        input.value=String(value);
        input.disabled=!this.model.isEnabled(descriptor.id);
        input.setAttribute('aria-label',descriptor.label+(type==='number'?'の数値入力':'のスライダー'));
        return input;
      };
      holder.append(makeInput('range'),makeInput('number'));
      if(descriptor.unit){
        const unit=this.doc.createElement('span');
        unit.textContent=descriptor.unit;
        holder.append(unit);
      }
      controls.append(holder);
    } else if(descriptor.type==='select'&&descriptor.options.length>0) {
      const segments=this.doc.createElement('div');
      segments.className='zw-modern-segments';
      for(const option of descriptor.options) {
        const b=this._button(option.label,'data-zw-choice',descriptor.id);
        b.dataset.zwValue=String(option.value);
        b.disabled=!this.model.isEnabled(descriptor.id);
        if(String(this.model.get(descriptor.id))===String(option.value)){
          b.classList.add('is-selected');
        }
        segments.append(b);
      }
      const existingValue=String(this.model.get(descriptor.id)??'');
      if(!descriptor.options.some(o=>String(o.value)===existingValue)) {
        const legacy=this._button('従来の設定値：'+existingValue,
          'data-zw-choice',descriptor.id);
        legacy.dataset.zwValue=existingValue;
        legacy.classList.add('is-selected');
        legacy.disabled=true;
        legacy.title='旧バージョンの値を保持しています。変更しなければそのまま保存されます。';
        segments.append(legacy);
      }
      controls.append(segments);
    } else {
      const original=descriptor.input;
      if(original) {
        if(!this._moved.has(original)){
          this._moved.set(original,{parent:original.parentNode,next:original.nextSibling});
        }
        original.disabled=!this.model.isEnabled(descriptor.id);
        original.setAttribute('aria-label',descriptor.label);
        if(original.type==='checkbox'){original.checked=!!this.model.get(descriptor.id);}
        else {
          const value=this.model.get(descriptor.id);
          original.value=descriptor.id==='userIdFilter'?
            ModernAdvancedSettingsUI._formatNgUserIds(value):value??'';
        }
        controls.append(original);
      } else {
        const input=this.doc.createElement(descriptor.type==='textarea'?'textarea':'input');
        if(input.tagName==='INPUT') {
          input.type=descriptor.type==='boolean'?'checkbox':
            ['number','seconds'].includes(descriptor.type)?'number':'text';
        }
        if(input.type==='checkbox'){input.checked=!!this.model.get(descriptor.id);}
        else {
          const value=this.model.get(descriptor.id);
          input.value=descriptor.id==='userIdFilter'?
            ModernAdvancedSettingsUI._formatNgUserIds(value):String(value??'');
        }
        input.dataset.settingName=descriptor.id;
        input.setAttribute('aria-label',descriptor.label);
        input.disabled=!this.model.isEnabled(descriptor.id);
        controls.append(input);
      }
    }
    if(descriptor.id==='screenshot.prefix'){
      const presets=this.doc.createElement('div');
      presets.className='zw-modern-prefix-presets';
      const prompt=this.doc.createElement('span');
      prompt.textContent='先頭の文字をすぐ設定：';
      presets.append(prompt);
      for(const [label,value] of [
        ['追加しない',''],['スクショ_','スクショ_'],
        ['Zenza_','Zenza_'],['clip_','clip_'],
        ['保存日_','{date}_'],['動画ID_','{watchId}_']
      ]){
        const button=this._button(label,'data-zw-screenshot-prefix',value,
          'zw-modern-plainbtn');
        button.disabled=!this.model.isEnabled(descriptor.id);
        if(String(this.model.get(descriptor.id)??'')===value){
          button.classList.add('is-selected');
        }
        presets.append(button);
      }
      controls.append(presets);
      const help=this.doc.createElement('p');
      help.className='zw-modern-prefix-hint';
      help.textContent='先頭に付ける文字には {date}（保存日）、{watchId}（動画ID）、{time}（再生位置）が使えます。ファイル名の残りの構成は下の設定で変更できます。';
      controls.append(help);
      const text=controls.querySelector('[data-setting-name="screenshot.prefix"]');
      if(text){text.setAttribute('placeholder','例：スクショ_{date}_');}
    }
    if(descriptor.id==='screenshot.filenameTemplate'){
      const presets=this.doc.createElement('div');
      presets.className='zw-modern-prefix-presets';
      for(const entry of (this.screenshotFileName?.PRESETS || [
        {name:'従来どおり（標準）',value:''}
      ])){
        const button=this._button(entry.name,'data-zw-filename-template',entry.value,
          'zw-modern-plainbtn');
        if(this.model.get(descriptor.id)===entry.value){button.classList.add('is-selected');}
        presets.append(button);
      }
      controls.append(presets);
      const hint=this.doc.createElement('p');
      hint.className='zw-modern-prefix-hint';
      hint.textContent='下の変数を組み合わせて順番・区切りを自由に指定できます。空欄なら元の保存形式を維持します。';
      controls.append(hint);
      const tokens=this.doc.createElement('div');
      tokens.className='zw-modern-prefix-presets';
      const labels={title:'動画タイトル',watchId:'視聴ID',videoId:'動画ID',
        uploader:'投稿者名',time:'再生位置',date:'保存日',datetime:'保存日時',
        suffix:'コメント付き記号'};
      for(const key of (this.screenshotFileName?.TOKENS||Object.keys(labels))){
        const button=this._button('＋ '+labels[key],'data-zw-filename-token',key,'zw-modern-plainbtn');
        button.title='{'+key+'} を挿入';
        tokens.append(button);
      }
      controls.append(tokens);
    }
    card.append(controls);
    const example=this._makeVisualExample(descriptor);
    if(example){card.append(example);}
    if(descriptor.description) {
      const note=this.doc.createElement('p');
      note.className='zw-modern-note';
      note.textContent=descriptor.description;
      note.hidden=true;
      card.append(note);
    }
    return card;
  }
  _renderDataPanel() {
    this.root.querySelector('[data-zw-title]').textContent='データ管理';
    this.root.querySelector('[data-zw-path]').textContent='プレイリスト・検索 / データ管理';
    this.root.querySelector('[data-zw-subtitle]').textContent='既存の設定JSONとプレイリストの保存・復元';
    this.root.querySelector('[data-zw-reset-category]').hidden=true;
    this.cards.innerHTML=[
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
      .forEach(button=>{button.disabled=!this.playlist;});
  }
  _onCustomMenuDraft(value) {
    const before=this.model.get('relatedMenu.customLinks')||[];
    this.model.set('relatedMenu.customLinks',value);
    if(!this.root){return;}
    const structure=JSON.stringify(before.map(x=>x?.id))!==JSON.stringify(value.map(x=>x?.id));
    const keysChanged=JSON.stringify(before.map(x=>x?.shortcutKey))!==JSON.stringify(value.map(x=>x?.shortcutKey));
    if(structure){
      const added=value.filter(x=>x && !before.some(old=>old?.id===x.id)).at(-1);
      const selected=[...this._expandedRelatedOptions][0];
      if(added){this._expandedRelatedOptions=new Set(['link:'+added.id]);}
      else if(selected?.startsWith('link:')&&!value.some(x=>'link:'+x?.id===selected)){
        this._expandedRelatedOptions=new Set(['builtin:official']);
      }
    }
    if(structure||keysChanged){this._refreshRelatedOrderList();}
    else{
      // Do not replace the inspector on every keystroke: keep focus and caret.
      for(const row of this.root.querySelectorAll('[data-zw-order-key]')){
        const item=value.find(x=>'link:'+x?.id===row.dataset.zwOrderKey);
        if(item){row.querySelector('.zw-order-name').textContent=item.label||item.id;}
      }
      const title=this.root.querySelector('[data-zw-order-detail-title]');
      const selected=[...this._expandedRelatedOptions][0];
      const item=value.find(x=>'link:'+x?.id===selected);
      if(title&&item){title.textContent=item.label||item.id;}
    }
    this._refreshFooter();
  }
  _relatedOrderEntries() {
    if (!this.relatedOrder || !this.model.descriptor('relatedMenu.order')) { return []; }
    const links=this.model.get('relatedMenu.customLinks')||[];
    const actions=this.relatedActions?.getActions?.({})||[];
    return this.relatedOrder.entries(links,actions,
      this.model.get('relatedMenu.order'));
  }

  _renderRelatedOrderControls() {
    const holder=this.doc.createElement('div');
    holder.className='zw-modern-order-editor zw-modern-order-compact';
    if(!this.relatedOrder){
      holder.textContent='関連メニューの並び替えを利用できません。';
      return holder;
    }
    const guide=this.doc.createElement('p');
    guide.className='zw-order-hint';
    guide.textContent='左の一覧を並べ替え、右側で選択した項目を編集します。⠿をドラッグ（スマホは長押し）／Alt＋↑↓／上下ボタン。変更は下部の保存で確定します。';
    holder.append(guide);
    const toolbar=this.doc.createElement('div');toolbar.className='zw-order-toolbar';
    const refresh=this._button('一覧を更新','data-zw-order-refresh','','zw-modern-plainbtn');
    refresh.title='追加リンクや外部登録アクションを再読み込み（保存はしません）';
    toolbar.append(refresh);
    for(const [attr,label,kind] of [['data-zw-order-add-link','＋ リンク','link'],['data-zw-order-add-copy','＋ コピー','copy']]){
      const button=this._button(label,attr,kind,'zw-modern-plainbtn');
      button.disabled=!this.relatedEditor || this.relatedEditor.original===null || this.relatedEditor.draft.length>=40;
      toolbar.append(button);
    }
    toolbar.append(this._button('カスタム項目を初期値に戻す','data-zw-reset-item',
      'relatedMenu.customLinks','zw-modern-plainbtn'));
    holder.append(toolbar);
    const workspace=this.doc.createElement('div');workspace.className='zw-order-workspace';
    const pane=this.doc.createElement('aside');pane.className='zw-order-inspector';
    pane.dataset.zwOrderDetailPane='';pane.setAttribute('aria-label','選択項目の詳細設定');
    const list=this.doc.createElement('ol');
    list.className='zw-modern-order-list';
    list.setAttribute('aria-label','関連メニューの全項目');
    const entries=this._relatedOrderEntries();
    const prefs=this.model.get(this.relatedOrder.OPTIONS_KEY)||{};
    this._expandedRelatedOptions=this._expandedRelatedOptions||new Set();
    const selected=entries.find(item=>item.present&&this._expandedRelatedOptions.has(item.key)) ||
      entries.find(item=>item.present);
    this._expandedRelatedOptions=new Set(selected?[selected.key]:[]);
    const descriptions={
      official:'公式視聴ページを開きます。ZenzaWatchの横取りを防ぐ識別子は自動で付けられます。',
      ad:'ニコニ広告の宣伝画面を開きます。既定は小さな別ウィンドウです。',
      twitter:'動画IDを含むX（Twitter）の投稿を検索します。必要ならURLテンプレートを変更できます。',
      original:'コミュニティ動画・マイメモリーの場合だけ元の動画へ移動します。',
      tree:'親作品・コンテンツツリーを開きます。動画によっては利用できません。',
      'tree-playlist':'親作品・子作品のリストを現在のプレイリストへ追加します。',
      'copy-url':'現在の動画からURL・動画IDなどをコピーします。'
    };
    const variableNames={
      videoId:'動画ID（例: sm9）',watchId:'視聴ID（例: sm9）',
      videoUrl:'動画URL',videoTitle:'動画タイトル',
      uploaderUserId:'投稿者のユーザーID',uploaderChannelId:'投稿者のチャンネルID',
      uploaderName:'投稿者名',currentTime:'現在の再生位置（秒）'
    };
    const addField=(parent,label,control,desc='')=>{
      const field=this.doc.createElement('label');
      field.className='zw-order-field';
      const name=this.doc.createElement('span');name.textContent=label;
      field.append(name,control);
      if(desc){
        const note=this.doc.createElement('small');note.textContent=desc;field.append(note);
      }
      parent.append(field);
      return control;
    };
    for(const [index,item] of entries.entries()){
      const row=this.doc.createElement('li');
      row.className='zw-modern-order-row';
      if(!item.present){row.classList.add('is-missing');}
      row.dataset.zwOrderKey=item.key;
      const grip=this._button('⠿','data-zw-order-grip',item.key,'zw-modern-plainbtn zw-order-grip');
      grip.draggable=true;
      grip.title='ドラッグ・長押し、またはAlt＋上下キーで移動';
      grip.setAttribute('aria-label',item.label+'を並べ替え');
      row.append(grip);
      const builtinId=item.type==='builtin'?item.key.slice(8):null;
      const opts=builtinId?this.relatedOrder.getOption(prefs,builtinId):{};
      const label=opts.label||item.label;
      const name=this._button(label,'data-zw-order-edit',item.key,'zw-order-name');
      name.disabled=!item.present;
      row.classList.toggle('is-selected',selected?.key===item.key);
      row.append(name);
      const shortcutId=builtinId&&this.relatedOrder.SHORTCUT_ACTION_IDS[builtinId];
      const keyId=shortcutId?'KEY_'+shortcutId:null;
      const shortcutValue=keyId?Number(this.model.get(keyId))||0:
        item.type==='link'?Number((this.model.get('relatedMenu.customLinks')||[])
          .find(link=>'link:'+link.id===item.key)?.shortcutKey)||0:0;
      const keyBadge=this.doc.createElement('small');
      keyBadge.className='zw-order-key-preview';
      keyBadge.textContent=shortcutValue?this.formatKeyCombo(shortcutValue):'キー未設定';
      keyBadge.hidden=!shortcutValue;
      if(shortcutValue){
        const warnings=this.model.keyConflicts(shortcutValue);
        if(warnings.length>1){
          keyBadge.classList.add('is-conflict');
          keyBadge.title='⚠ ショートカットの重複: '+warnings.join('、');
          keyBadge.textContent+=' ⚠重複';
        }
      }
      row.append(keyBadge);
      const visible=this.doc.createElement('label');
      visible.className='zw-order-visible';
      const checkbox=this.doc.createElement('input');
      checkbox.type='checkbox';checkbox.dataset.zwOrderVisible=item.key;
      checkbox.checked=!(this.model.get('relatedMenu.hiddenItems')||[]).includes(item.key);
      visible.append(checkbox,this.doc.createTextNode('表示'));
      row.append(visible);
      const edit=this._button(this._expandedRelatedOptions.has(item.key)?'編集中':'編集',
        'data-zw-order-edit',item.key,'zw-modern-plainbtn');
      edit.disabled=!item.present;
      edit.setAttribute('aria-expanded',String(this._expandedRelatedOptions.has(item.key)));
      row.append(edit);
      const up=this._button('↑','data-zw-order-up',item.key,'zw-modern-plainbtn');
      const down=this._button('↓','data-zw-order-down',item.key,'zw-modern-plainbtn');
      up.disabled=index===0;down.disabled=index===entries.length-1;
      up.title='1つ上へ';down.title='1つ下へ';
      row.append(up,down);
      if(this._expandedRelatedOptions.has(item.key)){
        const details=this.doc.createElement('section');
        details.className='zw-order-details';details.dataset.zwOrderDetails=item.key;
        const heading=this.doc.createElement('h3');heading.dataset.zwOrderDetailTitle='';
        heading.textContent=label;details.append(heading);
        const help=this.doc.createElement('p');
        help.textContent=builtinId?descriptions[builtinId]:
          item.type==='link'?'この項目の動作・内容・ショートカットを編集します。変更は保存するまで下書きです。':
          '外部スクリプトが登録した機能です。名称・動作の変更は登録元で行います。';
        details.append(help);
        if(builtinId){
          const title=this.doc.createElement('input');
          title.type='text';title.maxLength=80;title.value=opts.label||'';
          title.placeholder='標準名を使用: '+item.label;
          title.dataset.zwBuiltinField='label';title.dataset.zwBuiltinId=builtinId;
          addField(details,'メニューに表示する名前',title,'空欄に戻すと標準の名前を使用します。');
          if(keyId&&this.model.descriptor(keyId)){
            const line=this.doc.createElement('div');
            line.className='zw-order-shortcut-editor';
            const caption=this.doc.createElement('span');
            caption.textContent='ショートカット: '+(shortcutValue?this.formatKeyCombo(shortcutValue):'(未設定)');
            line.append(caption,
              this._button('変更','data-zw-record',keyId,'zw-modern-plainbtn'),
              this._button('解除','data-zw-clear-key',keyId,'zw-modern-plainbtn'));
            details.append(line);
            const warning=this.model.keyConflicts(shortcutValue);
            if(shortcutValue&&warning.length>1){
              const alert=this.doc.createElement('p');
              alert.className='zw-order-warning';
              alert.textContent='⚠ キーが重複しています: '+warning.join('、')+'（既存割り当ては自動解除しません）';
              details.append(alert);
            }
            const sync=this.doc.createElement('small');
            sync.textContent='「ショートカット」欄と同じ設定値を編集します。変更は保存するまで確定しません。';
            details.append(sync);
          }
          if(['official','ad','twitter','tree'].includes(builtinId)){
            const select=this.doc.createElement('select');
            select.dataset.zwBuiltinField='openMode';select.dataset.zwBuiltinId=builtinId;
            for(const [val,text] of [['default','既定の動作'],['same-tab','現在のタブで開く'],
              ['new-tab','新しいタブで開く'],['new-window','新しいウィンドウを要求']]){
              const option=this.doc.createElement('option');
              option.value=val;option.textContent=text;select.append(option);
            }
            select.value=opts.openMode||'default';
            addField(details,'リンクの開き方',select,
              '新規ウィンドウはブラウザの設定によってタブになる場合があります。');
            if(select.value==='new-window'){
              const sizes=this.doc.createElement('div');sizes.className='zw-order-sizes';
              for(const [field,label,defaultSize] of [
                ['popupWidth','横幅',builtinId==='ad'?428:760],
                ['popupHeight','高さ',builtinId==='ad'?600:650]]){
                const box=this.doc.createElement('input');
                box.type='number';box.min='250';box.max='1800';box.step='1';
                box.value=String(opts[field]||defaultSize);
                box.dataset.zwBuiltinField=field;box.dataset.zwBuiltinId=builtinId;
                addField(sizes,label+'（px）',box);
              }
              details.append(sizes);
            }
          }
          if(builtinId==='official'){
            const box=this.doc.createElement('input');
            box.type='checkbox';box.checked=opts.includePosition!==false;
            box.dataset.zwBuiltinField='includePosition';box.dataset.zwBuiltinId=builtinId;
            addField(details,'現在の再生位置を公式プレイヤーへ引き継ぐ',box);
          }
          if(builtinId==='copy-url'){
            const select=this.doc.createElement('select');
            select.dataset.zwBuiltinField='copyFormat';select.dataset.zwBuiltinId=builtinId;
            for(const [val,text] of [['url','動画URL（従来どおり）'],['id','動画IDのみ'],
              ['position','再生位置付き動画URL'],['title-url','動画タイトル＋URL'],
              ['markdown','Markdown形式のリンク']]){
              const option=this.doc.createElement('option');
              option.value=val;option.textContent=text;select.append(option);
            }
            select.value=opts.copyFormat||'url';
            addField(details,'コピーする形式',select,'「動画IDのみ」では sm9 のような識別子だけをコピーします。');
          }
          if(['twitter','tree'].includes(builtinId)){
            const input=this.doc.createElement('input');
            input.type='text';input.value=opts.urlTemplate||'';
            input.placeholder='未入力なら既存の公式URLを使用';
            input.maxLength=2048;input.dataset.zwBuiltinField='urlTemplate';
            input.dataset.zwBuiltinId=builtinId;
            addField(details,'URLテンプレート（任意）',input,
              'https:// から始めてください。空欄なら従来のリンクを使用します。');
            const palette=this.doc.createElement('div');
            palette.className='zw-order-variable-palette';
            const intro=this.doc.createElement('p');
            intro.textContent='変数を挿入：動画ごとに自動で値を置き換えます。使える変数は8種類すべて表示しています。';
            palette.append(intro);
            for(const token of this.relatedActions?.VARIABLES||Object.keys(variableNames)){
              const button=this._button('{'+token+'}','data-zw-builtin-insert',token,'zw-modern-plainbtn');
              button.dataset.zwBuiltinId=builtinId;
              button.title=variableNames[token]||token;
              palette.append(button);
            }
            const explains=this.doc.createElement('small');
            explains.textContent=Object.entries(variableNames).map(([v,label])=>'{'+v+'} = '+label).join(' / ');
            palette.append(explains);
            details.append(palette);
          }
          const reset=this._button('この項目の詳細だけ初期値に戻す','data-zw-builtin-reset',builtinId,'zw-modern-plainbtn');
          details.append(reset);
        }
        pane.append(details);
      }
      list.append(row);
    }
    if(this.relatedEditor){
      const editor=this.relatedEditor.container;
      editor.querySelector('[data-rl-save]').hidden=true;
      editor.querySelector('[data-rl-cancel]').hidden=true;
      editor.hidden=selected?.type!=='link';
      this.relatedEditor.showDetail(selected?.type==='link'?selected.key.slice(5):null);
      pane.append(editor);
    }
    workspace.append(list,pane);holder.append(workspace);
    const status=this.doc.createElement('p');
    status.dataset.zwOrderStatus='';
    status.setAttribute('role','status');
    status.setAttribute('aria-live','polite');
    status.textContent=this._orderAnnouncement||'';
    holder.append(status);
    return holder;
  }

  _refreshRelatedOrderList() {
    if(!this.root){return;}
    this._clearTouchOrder();
    const card=this.root.querySelector('[data-zw-id="relatedMenu.order"]');
    const controls=card?.querySelector('.zw-modern-cardcontrols');
    if(controls){controls.replaceChildren(this._renderRelatedOrderControls());}
    card?.classList.toggle('is-modified',
      this.model.isDifferentFromDefault('relatedMenu.order') ||
      this.model.isDifferentFromDefault('relatedMenu.hiddenItems') ||
      this.model.isDifferentFromDefault('relatedMenu.builtinOptions'));
  }

  _moveRelatedOrder(fromKey,toKey,after=false) {
    const entries=this._relatedOrderEntries();
    const keys=entries.map(entry=>entry.key);
    const from=keys.indexOf(fromKey),to=keys.indexOf(toKey);
    if(from<0 || to<0){return false;}
    const insertion=to+(after?1:0);
    const position=from<insertion?insertion-1:insertion;
    if(position===from){return false;}
    keys.splice(position,0,keys.splice(from,1)[0]);
    this.model.set('relatedMenu.order',keys);
    this._orderAnnouncement='「'+(entries[from]?.label||fromKey)+'」を'+
      (position+1)+'番目に移動しました。保存前ならキャンセルできます。';
    this._renderCards();
    this._refreshFooter();
    return true;
  }

  _clearRelatedOrderDrag() {
    this._orderDragKey=null;
    this._orderDropKey=null;
    this._orderDropAfter=false;
    this.root.querySelectorAll('.zw-modern-order-row.is-dragging,.zw-modern-order-row.is-drop-before,.zw-modern-order-row.is-drop-after')
      .forEach(row=>row.classList.remove('is-dragging','is-drop-before','is-drop-after'));
  }

  _onOrderDragStart(e) {
    const grip=e.target.closest?.('[data-zw-order-grip]');
    if(!grip || !this.root.contains(grip)){return;}
    this._orderDragKey=grip.dataset.zwOrderGrip;
    grip.closest('.zw-modern-order-row')?.classList.add('is-dragging');
    if(e.dataTransfer){
      e.dataTransfer.effectAllowed='move';
      e.dataTransfer.setData('text/plain',this._orderDragKey);
    }
  }
  _onOrderDragOver(e) {
    if(!this._orderDragKey){return;}
    const row=e.target.closest?.('.zw-modern-order-row');
    if(!row || !this.root.contains(row)){return;}
    e.preventDefault();
    if(e.dataTransfer){e.dataTransfer.dropEffect='move';}
    const rect=row.getBoundingClientRect();
    const keys=this._relatedOrderEntries().map(entry=>entry.key);
    this._orderDropAfter=rect.height>0?
      e.clientY>rect.top+rect.height/2:
      keys.indexOf(this._orderDragKey)<keys.indexOf(row.dataset.zwOrderKey);
    this._orderDropKey=row.dataset.zwOrderKey;
    this.root.querySelectorAll('.zw-modern-order-row.is-drop-before,.zw-modern-order-row.is-drop-after')
      .forEach(item=>item.classList.remove('is-drop-before','is-drop-after'));
    row.classList.add(this._orderDropAfter?'is-drop-after':'is-drop-before');
  }
  _onOrderDrop(e) {
    if(!this._orderDragKey){return;}
    e.preventDefault();
    const from=this._orderDragKey,to=this._orderDropKey,after=this._orderDropAfter;
    this._clearRelatedOrderDrag();
    if(to){this._moveRelatedOrder(from,to,after);}
  }
  _onOrderDragEnd() {this._clearRelatedOrderDrag();}
  _onTouchOrderDown(e) {
    if(e.pointerType!=='touch' || this._touchOrder){return;}
    const grip=e.target.closest?.('[data-zw-order-grip]');
    if(!grip || !this.root.contains(grip)){return;}
    const key=grip.dataset.zwOrderGrip;
    if(!this._relatedOrderEntries().some(item=>item.key===key)){return;}
    const state={id:e.pointerId,key,grip,active:false,dropKey:null,after:false,timer:null};
    this._touchOrder=state;
    state.timer=this.win.setTimeout(()=>{
      if(this._touchOrder!==state){return;}
      if(!this.root.contains(grip)){this._clearTouchOrder();return;}
      try{grip.setPointerCapture?.(e.pointerId);}
      catch(_){this._clearTouchOrder();return;}
      state.active=true;
      grip.closest('.zw-modern-order-row')?.classList.add('is-touch-dragging');
    },260);
  }
  _onTouchOrderMove(e) {
    const state=this._touchOrder;
    if(!state || state.id!==e.pointerId || !state.active){return;}
    e.preventDefault();
    const hit=this.doc.elementFromPoint?.(e.clientX,e.clientY)||e.target;
    const row=hit?.closest?.('[data-zw-order-key]');
    if(!row || !this.root.contains(row)){return;}
    state.dropKey=row.dataset.zwOrderKey;
    const bounds=row.getBoundingClientRect();
    state.after=bounds.height>0?e.clientY>bounds.top+bounds.height/2:
      this._relatedOrderEntries().findIndex(i=>i.key===state.key) <
      this._relatedOrderEntries().findIndex(i=>i.key===state.dropKey);
    this.root.querySelectorAll('.zw-modern-order-row.is-drop-before,.zw-modern-order-row.is-drop-after')
      .forEach(el=>el.classList.remove('is-drop-before','is-drop-after'));
    row.classList.add(state.after?'is-drop-after':'is-drop-before');
  }
  _onTouchOrderUp(e) {
    const state=this._touchOrder;
    if(!state || state.id!==e.pointerId){return;}
    const shouldMove=state.active && state.dropKey && state.dropKey!==state.key;
    const from=state.key,to=state.dropKey,after=state.after;
    this._clearTouchOrder();
    if(shouldMove){this._moveRelatedOrder(from,to,after);}
  }
  _clearTouchOrder() {
    const state=this._touchOrder;
    if(!state){return;}
    this._touchOrder=null;
    this.win.clearTimeout(state.timer);
    // The pointer may already have ended or its old row may have been removed.
    try{state.grip.releasePointerCapture?.(state.id);}catch(_){}
    state.grip.closest('.zw-modern-order-row')?.classList.remove('is-touch-dragging');
    this.root.querySelectorAll('.zw-modern-order-row.is-drop-before,.zw-modern-order-row.is-drop-after')
      .forEach(el=>el.classList.remove('is-drop-before','is-drop-after'));
  }

  _customSeekSlots() {
    return Array.from({length:10},(_,n)=>n+1).filter(n=>
      this.model.descriptor('KEY_CUSTOM_SEEK_'+n) &&
      this.model.descriptor('PARAM_CUSTOM_SEEK_'+n));
  }
  _usedCustomSeekSlots() {
    return this._customSeekSlots().filter(n=>
      this._visibleSeekSlots.has(n) ||
      Number(this.model.get('KEY_CUSTOM_SEEK_'+n))!==0 ||
      Number(this.model.get('PARAM_CUSTOM_SEEK_'+n))!==0);
  }
  _renderCards() {
    this._clearTouchOrder();
    if(!this.searchTerm && this.selected.category==='プレイリスト・検索' &&
      this.selected.subcategory==='データ管理'){
      this._renderDataPanel();
      return;
    }
    const hits=this.searchTerm?this.model.search(this.searchTerm):
      this.model.sectionDescriptors(this.selected.category,this.selected.subcategory);
    const title=this.root.querySelector('[data-zw-title]');
    const sectionLabel=this.selected.subcategory==='関連メニュー › カスタムリンク'?
      '関連メニュー（全項目）':this.selected.subcategory;
    title.textContent=this.searchTerm?'検索結果':sectionLabel;
    this.root.querySelector('[data-zw-path]').textContent=this.searchTerm?
      '全カテゴリ横断検索':this.selected.category+' / '+sectionLabel;
    this.root.querySelector('[data-zw-subtitle]').textContent=this.searchTerm?
      hits.length+'件の設定が見つかりました':'関連する設定をまとめて表示しています。';
    this.root.querySelector('[data-zw-reset-category]').hidden=!!this.searchTerm;
    // A custom seek uses one combined card rather than two duplicate rows.
    const seen=new Set();
    const entries=[];
    for(let descriptor of hits){
      if(descriptor.type==='seconds'){
        descriptor=this.model.descriptor('KEY_'+descriptor.actionId)||descriptor;
      }
      if(!seen.has(descriptor.id)){
        seen.add(descriptor.id);
        entries.push(descriptor);
      }
    }
    const seekSection=!this.searchTerm && this.selected.category==='ショートカット' &&
      this.selected.subcategory==='シーク';
    const used=seekSection?this._usedCustomSeekSlots():[];
    const visibleEntries=seekSection?entries.filter(d=>{
      const n=Number((d.actionId||'').match(/^CUSTOM_SEEK_(\d+)$/)?.[1]);
      return !n || used.includes(n);
    }):entries.filter(d=>d.type!=='related-builtin-options' &&
      (d.type!=='related-links' || !entries.some(item=>item.type==='related-order')));
    const rows=[];
    const visibilityMode=!this.searchTerm && this.selected.category==='画面・映像' &&
      this.selected.subcategory==='表示・非表示';
    const groupNames={
      hover:'動画の上に重なるボタン',related:'関連メニュー',comment:'コメント入力',
      bar:'再生操作バー',info:'動画情報パネル',header:'動画上部のヘッダー',
      shared:'コメント・補助表示（元の設定画面と共通）'
    };
    let lastScope=null;
    for(const d of visibleEntries.filter(item=>item.type!=='related-visibility')){
      if(visibilityMode && d.visibilityScope && d.visibilityScope!==lastScope){
        const heading=this.doc.createElement('h4');
        heading.className='zw-modern-visibility-group';
        heading.dataset.zwVisibilityGroup=d.visibilityScope;
        heading.textContent=groupNames[d.visibilityScope]||'その他';
        rows.push(heading);
        lastScope=d.visibilityScope;
      }
      rows.push(this._createCard(d));
    }
    if(!this.searchTerm && this.selected.category==='プレイリスト・検索' &&
      this.selected.subcategory==='検索') {
      const guide=this.doc.createElement('section');
      guide.className='zw-modern-search-guide';
      guide.setAttribute('aria-label','検索設定の違い');
      guide.innerHTML=[
        '<strong>検索で何が通信されるの？</strong>',
        '<p><b>① タグ候補・動画の予測：</b>検索欄に入力したときの候補表示。件数表示をOFFにしてもこの機能は使えます。</p>',
        '<p><b>② ヒット件数：</b>「〇件」という参考数字だけを調べる追加通信。下の設定で取得タイミングを選べます。</p>',
        '<p><b>③ プレイリストの読み込み：</b>検索を実行して動画を一覧へ追加する処理。最大件数は別の設定です。</p>'
      ].join('');
      rows.unshift(guide);
    }
    if(!this.searchTerm && this.selected.category==='画面・映像' &&
      this.selected.subcategory==='表示・非表示'){
      const guide=this.doc.createElement('section');
      guide.className='zw-modern-search-guide';
      guide.setAttribute('aria-label','表示・非表示の設定');
      guide.innerHTML=[
        '<strong>プレイヤーの表示を自分好みに整理</strong>',
        '<p>動画上・操作バー・動画情報・ヘッダーごとに項目をまとめました。OFFでも再生機能やショートカットは削除されません。</p>',
        '<p>再生・停止、シークバー、閉じる、エラー復旧は残ります。歯車を隠した場合も、マイページの上級者設定から再表示できます。</p>',
        '<p>「共通設定」の7項目は元の場所と同じ値です。変更・キャンセル・初期値への復帰も両方に反映されます。</p>',
        '<p>変更は画面下部の「変更を保存」で確定します。いつでも表示に戻せます。</p>'
      ].join('');
      rows.unshift(guide);
    }
    if(seekSection){
      const toolbar=this.doc.createElement('div');
      toolbar.className='zw-modern-seek-toolbar';
      const count=this.doc.createElement('span');
      count.dataset.zwSeekCount='';
      count.textContent='カスタムシーク '+used.length+' / '+this._customSeekSlots().length+' 枠';
      const button=this._button('＋ カスタムシークを追加','data-zw-add-seek','',
        'zw-modern-plainbtn');
      button.disabled=used.length===this._customSeekSlots().length;
      toolbar.append(count,button);
      this.cards.replaceChildren(toolbar,...rows);
    }else{
      this.cards.replaceChildren(...rows);
    }
  }
  _applyRelatedDraftFromModel() {
    if(!this.relatedEditor) {return;}
    const value=this.model.get('relatedMenu.customLinks');
    this.relatedEditor.replaceDraftFromParent(value);
  }
  _syncRelatedDraft() {
    if(!this.relatedEditor) {return;}
    const editor=this.relatedEditor;
    this.model.set('relatedMenu.customLinks',editor.draft);
  }
  _relatedErrors() {
    if(!this.relatedEditor) {return [];}
    const editor=this.relatedEditor;
    const validation=editor.actions.validateLinks(editor.draft);
    const errs=editor.draft.map((link,index)=>editor._rowError(link,index)).filter(Boolean);
    return validation.valid && errs.length===0?[]:errs.length?errs:['リンクの入力に不正があります'];
  }
  _onRelatedBubble(event) {
    if(!this.relatedEditor ||
      !this.relatedEditor.container.contains(event.target)) {return;}
    // Let the existing editor update its own draft first (delegated on its root),
    // then mirror it into the global draft without calling Config.setValue.
    this._syncRelatedDraft();
    this._refreshFooter();
  }
  hasPendingEdits() {
    return this.model.isDirty() || this._visibleSeekSlots.size>0;
  }
  discardChanges() {
    if(this._recordCleanup){this._recordCleanup();}
    this.model.cancel();
    this._visibleSeekSlots.clear();
    this._seekDirections.clear();
    this._orderAnnouncement='';
    if(this.relatedEditor){this.relatedEditor._load();}
    this._renderCards();
    this._refreshFooter();
  }
  _refreshFooter() {
    const changed=this.model.changes().length;
    const pendingSeek=this._visibleSeekSlots.size;
    this.root.querySelector('[data-zw-dirty]').textContent=changed?
      '● 未保存の変更 '+changed+'件':
      pendingSeek?'● カスタムシークの追加枠 '+pendingSeek+'件（未設定）':'保存済み';
    this.root.querySelector('[data-zw-cancel]').disabled=!changed&&!pendingSeek;
    this.root.querySelector('[data-zw-save]').disabled=!changed||
      this.model.validate().length>0||this._relatedErrors().length>0;
  }
  _refreshCards() {
    const errors=new Map(this.model.validate().map(e=>[e.id,e.message]));
    for(const card of this.cards.querySelectorAll('[data-zw-id]')) {
      const id=card.dataset.zwId,d=this.model.descriptor(id);
      const seek=d.type==='shortcut'?this.model.descriptor('PARAM_'+d.actionId):null;
      card.classList.toggle('is-modified',this.model.isDifferentFromDefault(id)||
        (d.type==='related-order' &&
          this.model.isDifferentFromDefault('relatedMenu.hiddenItems')) ||
        (seek && this.model.isDifferentFromDefault(seek.id)));
      const active=this.model.isEnabled(id);
      card.classList.toggle('is-disabled',!active);
      const input=card.querySelector('[data-setting-name]');
      if(input){input.disabled=!active;}
      card.querySelectorAll('[data-zw-choice]').forEach(button=>{
        button.disabled=!active;
      });
      if(d.type==='regex-flags'){
        const flags=String(this.model.get(id)||'');
        card.querySelectorAll('[data-zw-regex-flag]').forEach(checkbox=>{
          checkbox.checked=flags.includes(checkbox.dataset.zwRegexFlag);
          checkbox.disabled=!active;
        });
        const field=card.querySelector('[data-zw-regex-raw]');
        if(field){
          field.disabled=!active;
          if(field!==this.doc.activeElement){field.value=flags;}
        }
        const display=card.querySelector('[data-zw-regex-value]');
        if(display){display.textContent=flags||'（なし）';}
      }
      if(d.type==='slider') {
        card.querySelectorAll('input[data-setting-name]').forEach(element=>{
          element.disabled=!active;
          if(element!==this.doc.activeElement || element.type!=='number') {
            element.value=String(this.model.get(id));
          }
        });
      }
      if(d.type==='font-picker'){
        const select=card.querySelector('[data-zw-font-preset]');
        const custom=card.querySelector('[data-zw-font-custom]');
        const value=String(this.model.get(id)??'');
        const preset=d.options.some(item=>item.value===value)?value:'__custom__';
        const editing=custom===this.doc.activeElement && !custom.hidden;
        if(select){select.disabled=!active;if(!editing){select.value=preset;}}
        if(custom){
          custom.disabled=!active;
          if(!editing){custom.value=value;custom.hidden=preset!=='__custom__';}
        }
      }
      if(d.type==='color'){
        const code=card.querySelector('[data-zw-color-code]');
        const picker=card.querySelector('[data-zw-color-picker]');
        const hint=card.querySelector('.zw-modern-color-hint');
        const value=String(this.model.get(id)??'');
        const hex=ModernAdvancedSettingsUI._hexColor(value);
        if(code && code!==this.doc.activeElement){code.value=value;}
        if(code){code.disabled=!active;}
        if(picker){
          picker.disabled=!active;
          if(hex){picker.value=hex;}
        }
        if(hint){hint.textContent=hex?
          '色見本をクリックして選択、またはコードを入力できます。':
          'CSS色名を使用中／入力途中です。色見本の選択でHEX値に切り替わります。';}
      }
      const example=card.querySelector('[data-zw-preview-for]');
      if(example){this._updateVisualExample(example,id);}
      let alert=card.querySelector('.zw-modern-validation-error');
      if(errors.has(id)) {
        if(!alert){alert=this.doc.createElement('span');alert.className='zw-modern-warning zw-modern-validation-error';card.append(alert);}
        alert.textContent=errors.get(id);
      } else if(alert) {alert.remove();}
      if(seek){
        const value=Number(this.model.get(seek.id))||0;
        const direction=card.querySelector('[data-zw-seek-direction]');
        const magnitude=card.querySelector('[data-zw-seek-magnitude]');
        const sign=this._seekDirections.get(seek.id)||(value>0?1:-1);
        if(direction){direction.value=String(sign);}
        if(magnitude && magnitude!==this.doc.activeElement) {
          magnitude.value=String(Math.abs(value));
        }
      }
      if(d.type==='shortcut') {
        const text=card.querySelector('[data-zw-key-display]');
        if(text){text.textContent=this.formatKeyCombo(this.model.get(id));}
      }
    }
    this._refreshFooter();
  }
  _interceptValue(e) {
    const el=e.target;
    if(el?.dataset?.zwRegexFlag && this.root.contains(el)){
      e.stopPropagation();e.stopImmediatePropagation?.();
      const id=el.dataset.zwRegexId;
      const flag=el.dataset.zwRegexFlag;
      const current=String(this.model.get(id)||'');
      const flags=new Set(current);
      if(el.checked){flags.add(flag);}else{flags.delete(flag);}
      const order='dgimsuvy';
      const next=[...order].filter(f=>flags.has(f)).join('')+
        [...flags].filter(f=>!order.includes(f)).join('');
      this.model.set(id,next);
      this._refreshCards();
      return true;
    }
    if(el?.dataset?.zwColorPicker && this.root.contains(el)){
      e.stopPropagation();e.stopImmediatePropagation?.();
      this.model.set(el.dataset.zwColorPicker,el.value);
      this._refreshCards();
      return true;
    }
    if(el?.dataset?.zwFontPreset && this.root.contains(el)){
      e.stopPropagation();e.stopImmediatePropagation?.();
      const id=el.dataset.zwFontPreset;
      const custom=el.closest('.zw-modern-font-editor')
        ?.querySelector('[data-zw-font-custom]');
      if(el.value==='__custom__'){
        if(custom){custom.hidden=false;custom.focus();}
      }else{
        this.model.set(id,el.value);
        if(custom){custom.hidden=true;}
        this._refreshCards();
      }
      return true;
    }
    if(el && el.dataset && this.root.contains(el) &&
      (el.dataset.zwSeekDirection || el.dataset.zwSeekMagnitude)){
      e.stopPropagation();
      e.stopImmediatePropagation?.();
      const id=el.dataset.zwSeekDirection||el.dataset.zwSeekMagnitude;
      const old=Number(this.model.get(id))||0;
      if(el.dataset.zwSeekDirection){
        const direction=Number(el.value)<0?-1:1;
        this._seekDirections.set(id,direction);
        this.model.set(id,direction*Math.abs(old));
      }else{
        const input=el.value.trim();
        const number=input===''?NaN:Number(input);
        const direction=this._seekDirections.get(id)||(old>0?1:-1);
        this.model.set(id,Number.isFinite(number)&&number>=0?direction*number:NaN);
      }
      this._refreshCards();
      return true;
    }
    if(!el || !el.dataset || !el.dataset.settingName || !this.root.contains(el)){return false;}
    e.stopPropagation();
    if(typeof e.stopImmediatePropagation==='function'){e.stopImmediatePropagation();}
    const key=el.dataset.settingName;
    const value=el.type==='checkbox'?el.checked:el.value;
    try {this.model.set(key,key==='userIdFilter'?
      ModernAdvancedSettingsUI._formatNgUserIds(value):value);}
    catch(error){this.win.console?.warn?.('Advanced settings input rejected',error);}
    this._refreshCards();
    return true;
  }
  _setBuiltinOptionDraft(id,field,value) {
    if(!this.relatedOrder?.STANDARD.some(item=>item.id===id)){return;}
    const key=this.relatedOrder.OPTIONS_KEY;
    if(!this.model.descriptor(key)){return;}
    const all=this.model.get(key)||{};
    const options={...this.relatedOrder.getOption(all,id)};
    if(field==='popupWidth' || field==='popupHeight'){
      options[field]=value===''?0:Number(value);
    }else if(field==='includePosition'){
      options[field]=!!value;
    }else if(value==='' || (field==='openMode'&&value==='default') ||
      (field==='copyFormat'&&value==='url')){
      delete options[field];
    }else{
      options[field]=value;
    }
    const next={...all};
    if(Object.keys(options).length){next[id]=options;}
    else{delete next[id];}
    this.model.set(key,next);
    this._refreshFooter();
  }
  _onValue(e) {
    const builtin=e.target.closest?.('[data-zw-builtin-field]');
    if(builtin && this.root.contains(builtin)){
      e.stopPropagation();
      this._setBuiltinOptionDraft(builtin.dataset.zwBuiltinId,
        builtin.dataset.zwBuiltinField,builtin.type==='checkbox'?builtin.checked:builtin.value);
      if(['openMode','copyFormat'].includes(builtin.dataset.zwBuiltinField)){
        this._refreshRelatedOrderList();
      }
      return;
    }
    const visible=e.target.closest?.('[data-zw-order-visible]');
    if(visible && this.root.contains(visible)){
      e.stopPropagation();
      const key=visible.dataset.zwOrderVisible;
      if(!this.relatedOrder?.isValidKey(key)){return;}
      const hidden=new Set(this.model.get('relatedMenu.hiddenItems')||[]);
      if(visible.checked){hidden.delete(key);}else{hidden.add(key);}
      this.model.set('relatedMenu.hiddenItems',[...hidden]);
      this._orderAnnouncement='表示設定を変更しました。画面下部の「変更を保存」で確定します。';
      this._refreshRelatedOrderList();
      this._refreshFooter();
      return;
    }
    this._interceptValue(e);
  }
  _onInput(e) {
    const builtin=e.target.closest?.('[data-zw-builtin-field]');
    if(builtin && this.root.contains(builtin)){
      e.stopPropagation();
      this._setBuiltinOptionDraft(builtin.dataset.zwBuiltinId,
        builtin.dataset.zwBuiltinField,builtin.type==='checkbox'?builtin.checked:builtin.value);
      if(builtin.dataset.zwBuiltinField==='label'){
        const row=this.root.querySelector('[data-zw-order-key="builtin:'+builtin.dataset.zwBuiltinId+'"]');
        const display=row?.querySelector('.zw-order-name');
        if(display){
          const original=this.relatedOrder.STANDARD.find(item=>item.id===builtin.dataset.zwBuiltinId)?.label||'';
          display.textContent=builtin.value.trim()||original;
        }
      }
      return;
    }
    if(e.target.matches('[data-zw-search]')) {
      this.searchTerm=e.target.value.trim();
      this._renderCards();
      this._refreshFooter();
      return;
    }
    this._interceptValue(e);
  }
  _onClick(e) {
    if(e.target.closest?.('[data-zw-drawer-dismiss]')) {
      this.root.classList.remove('is-drawer-open');
      return;
    }
    const button=e.target.closest('button');
    if(!button||!this.root.contains(button)||button.disabled){return;}
    if(button.hasAttribute('data-zw-order-add-link') || button.hasAttribute('data-zw-order-add-copy')){
      const kind=button.hasAttribute('data-zw-order-add-copy')?'copy':'link';
      const id=this.relatedEditor?.addItem(kind);
      if(id){this._expandedRelatedOptions=new Set(['link:'+id]);this._refreshRelatedOrderList();}
      this._refreshFooter();return;
    }
    if(button.hasAttribute('data-zw-order-edit')){
      const key=button.dataset.zwOrderEdit;
      this._expandedRelatedOptions=new Set([key]);
      this._refreshRelatedOrderList();
      this.root.querySelector('[data-zw-order-edit="'+key+'"]')?.focus();
      return;
    }
    if(button.hasAttribute('data-zw-builtin-reset')){
      const id=button.dataset.zwBuiltinReset;
      const key=this.relatedOrder?.OPTIONS_KEY;
      if(!key || !this.model.descriptor(key)){return;}
      const options={...(this.model.get(key)||{})};
      delete options[id];
      this.model.set(key,options);
      this._refreshRelatedOrderList();this._refreshFooter();
      return;
    }
    if(button.hasAttribute('data-zw-builtin-insert')){
      const id=button.dataset.zwBuiltinId;
      const token=button.dataset.zwBuiltinInsert;
      if(!this.relatedActions?.VARIABLES?.includes(token)){return;}
      const field=this.root.querySelector('[data-zw-builtin-field="urlTemplate"][data-zw-builtin-id="'+id+'"]');
      if(!field){return;}
      const at=typeof field.selectionStart==='number'?field.selectionStart:field.value.length;
      const end=typeof field.selectionEnd==='number'?field.selectionEnd:at;
      field.setRangeText('{'+token+'}',at,end,'end');
      this._setBuiltinOptionDraft(id,'urlTemplate',field.value);
      field.focus();return;
    }
    if(button.hasAttribute('data-zw-open-link-editor')){
      const id=button.dataset.zwOpenLinkEditor.slice(5);
      const links=this.model.get('relatedMenu.customLinks')||[];
      const index=links.findIndex(item=>item.id===id);
      if(index>=0 && this.relatedEditor){
        const card=this.relatedEditor.container.querySelector('[data-rl-row="'+index+'"]');
        const expand=card?.querySelector('[data-rl-expand]');
        if(expand?.getAttribute('aria-expanded')==='false'){expand.click();}
        card?.scrollIntoView?.({block:'nearest'});
        expand?.focus?.();
      }
      return;
    }
    if(button.hasAttribute('data-zw-order-refresh')){
      this._refreshRelatedOrderList();return;
    }
    if(button.hasAttribute('data-zw-order-up') || button.hasAttribute('data-zw-order-down')){
      const upward=button.hasAttribute('data-zw-order-up');
      const key=upward?button.dataset.zwOrderUp:button.dataset.zwOrderDown;
      const keys=this._relatedOrderEntries().map(item=>item.key);
      const index=keys.indexOf(key),target=index+(upward?-1:1);
      if(index>=0 && target>=0 && target<keys.length){
        this._moveRelatedOrder(key,keys[target],!upward);
      }
      return;
    }
    if(button.hasAttribute('data-zw-backup-export')){
      try {
        this.root.querySelector('[data-zw-backup-json]').value=
          this.model.config.exportJson();
        this.root.querySelector('[data-zw-backup-status]').textContent='';
      }catch(error){
        this.root.querySelector('[data-zw-backup-status]').textContent=
          '設定の書き出しに失敗しました: '+(error.message||error);
      }
      return;
    }
    if(button.hasAttribute('data-zw-backup-import')){
      const status=this.root.querySelector('[data-zw-backup-status]');
      try{
        const data=JSON.parse(this.root.querySelector('[data-zw-backup-json]').value);
        if(!data || typeof data!=='object' || Array.isArray(data)){
          throw new Error('JSONオブジェクトを指定してください');
        }
        if(this.model.isDirty()&&!this.confirm('未保存の編集内容を破棄してバックアップを読み込みますか？')){return;}
        if(!this.confirm('バックアップを取り込んで設定を上書きしますか？')){return;}
        this.model.config.import(data);
        this.model.cancel();
        if(this.relatedEditor){this.relatedEditor._load();}
        status.textContent='設定を取り込みました。再読み込みします。';
        this.reload();
      }catch(error){
        status.textContent='設定を読み込めませんでした: '+(error.message||error);
      }
      return;
    }
    if(button.hasAttribute('data-zw-playlist-export')){
      try{
        this.root.querySelector('[data-zw-playlist-json]').value=
          JSON.stringify(this.playlist.export(),null,2);
        this.root.querySelector('[data-zw-backup-status]').textContent='';
      }catch(error){
        this.root.querySelector('[data-zw-backup-status]').textContent=
          'プレイリストの書き出しに失敗しました: '+(error.message||error);
      }
      return;
    }
    if(button.hasAttribute('data-zw-playlist-import')){
      const status=this.root.querySelector('[data-zw-backup-status]');
      try{
        const data=JSON.parse(this.root.querySelector('[data-zw-playlist-json]').value);
        if(!this.confirm('プレイリストデータを上書きしますか？')){return;}
        this.playlist.import(data);
        status.textContent='プレイリストを取り込みました。再読み込みします。';
        this.reload();
      }catch(error){
        status.textContent='プレイリストを読み込めませんでした: '+(error.message||error);
      }
      return;
    }
    if(button.hasAttribute('data-zw-major')) {
      const major=button.dataset.zwMajor;
      if(this.expanded.has(major)){this.expanded.delete(major);}
      else {this.expanded.add(major);}
      this._saveStored();this._renderNavigation();return;
    }
    if(button.hasAttribute('data-zw-sub')) {
      const val=button.dataset.zwSub;
      const sep=val.indexOf('|');
      this.selected={category:val.slice(0,sep),subcategory:val.slice(sep+1)};
      this.searchTerm='';
      this.root.querySelector('[data-zw-search]').value='';
      this._saveStored();
      this.root.classList.remove('is-drawer-open');
      this._renderNavigation();this._renderCards();this._refreshFooter();return;
    }
    if(button.hasAttribute('data-zw-sidebar')) {
      if(this.win.innerWidth<=760) {this.root.classList.toggle('is-drawer-open');}
      else {this.root.classList.toggle('is-sidebar-collapsed');}
      return;
    }
    if(button.hasAttribute('data-zw-close')) {
      if(this.hasPendingEdits()&&!this.confirm('未保存の設定変更を破棄して閉じますか？')) {return;}
      this.discardChanges();
      this.onClose();return;
    }
    if(button.hasAttribute('data-zw-regex-advanced-toggle')){
      const holder=button.closest('.zw-modern-regex-editor');
      const panel=holder?.querySelector('[data-zw-regex-advanced-panel]');
      if(panel){
        panel.hidden=!panel.hidden;
        button.setAttribute('aria-expanded',String(!panel.hidden));
      }
      return;
    }
    if(button.hasAttribute('data-zw-screenshot-prefix')){
      this.model.set('screenshot.prefix',button.dataset.zwScreenshotPrefix);
      this._renderCards();this._refreshFooter();
      return;
    }
    if(button.hasAttribute('data-zw-filename-template')){
      this.model.set('screenshot.filenameTemplate',button.dataset.zwFilenameTemplate);
      this._renderCards();this._refreshFooter();
      return;
    }
    if(button.hasAttribute('data-zw-filename-token')){
      const token=button.dataset.zwFilenameToken;
      if(!this.screenshotFileName?.TOKENS.includes(token)){return;}
      const id='screenshot.filenameTemplate';
      this.model.set(id,String(this.model.get(id)||'')+'{'+token+'}');
      this._renderCards();this._refreshFooter();
      return;
    }
    if(button.hasAttribute('data-zw-help')) {
      const card=button.closest('.zw-modern-card');
      const note=card?.querySelector('.zw-modern-note');
      if(note){note.hidden=!note.hidden;}
      return;
    }
    if(button.hasAttribute('data-zw-add-seek')){
      const available=this._customSeekSlots().find(n=>
        !this._usedCustomSeekSlots().includes(n));
      if(available!==undefined){
        this._visibleSeekSlots.add(available);
        this._renderCards();this._refreshFooter();
        this.cards.querySelector('[data-zw-id="KEY_CUSTOM_SEEK_'+available+'"]')
          ?.scrollIntoView?.({block:'nearest'});
      }
      return;
    }
    if(button.hasAttribute('data-zw-remove-seek')){
      const n=Number(button.dataset.zwRemoveSeek);
      if(!this._customSeekSlots().includes(n)){return;}
      this.model.resetItem('KEY_CUSTOM_SEEK_'+n);
      this.model.resetItem('PARAM_CUSTOM_SEEK_'+n);
      this._visibleSeekSlots.delete(n);
      this._seekDirections.delete('PARAM_CUSTOM_SEEK_'+n);
      this._renderCards();this._refreshFooter();
      return;
    }
    if(button.hasAttribute('data-zw-reset-item')) {
      this.model.resetItem(button.dataset.zwResetItem);
      if(button.dataset.zwResetItem==='relatedMenu.customLinks') {
        this._applyRelatedDraftFromModel();
      }
      this._renderCards();this._refreshFooter();return;
    }
    if(button.hasAttribute('data-zw-reset-category')) {
      // Reset only the currently displayed subcategory, never the entire
      // major group (e.g. all playback or all display preferences).
      const {category,subcategory}=this.selected;
      const count=this.model.sectionDescriptors(category,subcategory).length;
      if(this.confirm(category+' / '+subcategory+' の'+count+
        '項目だけを初期値に戻しますか？（保存前ならキャンセル可能）')) {
        this.model.resetSubcategory(category,subcategory);
        if(subcategory==='関連メニュー › カスタムリンク') {
          this._applyRelatedDraftFromModel();
        }
        this._renderCards();this._refreshFooter();
      }
      return;
    }
    if(button.hasAttribute('data-zw-cancel')) {
      this.discardChanges();return;
    }
    if(button.hasAttribute('data-zw-save')) {
      try {
        if(this._relatedErrors().length>0){throw new Error('カスタムリンクに不正な入力があります');}
        this._syncRelatedDraft();
        const changedKeys=this.model.changes().map(change=>change.id);
        const historyKeys=changedKeys.filter(key=>key.startsWith('commentHistory.'));
        this.model.save();
        // Another Zenza instance in this document must see settings saved by
        // the separate advanced-settings userscript without a page reload.
        // Other tabs receive native storage events from the same writes.
        if(changedKeys.length && this.win.CustomEvent){
          this.win.dispatchEvent(new this.win.CustomEvent(
            'ZenzaWatch-advanced-settings-saved',{detail:{keys:changedKeys}}));
        }
        this._visibleSeekSlots.clear();
        this._seekDirections.clear();
        this._orderAnnouncement='';
        if(historyKeys.length && this.win.CustomEvent){
          this.win.dispatchEvent(new this.win.CustomEvent(
            'ZenzaWatch-comment-history-settings',{detail:{keys:historyKeys}}));
        }
        if(this.relatedEditor){this.relatedEditor._load();}
        this._renderCards();this._refreshFooter();
      }
      catch(error){this.win.alert?.(String(error.message||error));}
      return;
    }
    if(button.hasAttribute('data-zw-record')) {
      this._beginRecording(button.dataset.zwRecord,button);return;
    }
    if(button.hasAttribute('data-zw-clear-key')) {
      this.model.set(button.dataset.zwClearKey,0);
      this._renderCards();this.relatedEditor?._refresh?.();this._refreshFooter();return;
    }
    if(button.hasAttribute('data-zw-choice')) {
      this.model.set(button.dataset.zwChoice,button.dataset.zwValue);
      this._renderCards();this._refreshFooter();
    }
  }
  openDrawer() {this.root.classList.add('is-drawer-open');}
  _onDocumentKeyDown(e) {
    if(this._recordCleanup){return;}
    const grip=e.target.closest?.('[data-zw-order-grip]');
    if(grip && e.altKey && ['ArrowUp','ArrowDown'].includes(e.key)){
      const key=grip.dataset.zwOrderGrip;
      const keys=this._relatedOrderEntries().map(item=>item.key);
      const index=keys.indexOf(key);
      const target=index+(e.key==='ArrowUp'?-1:1);
      if(index>=0 && target>=0 && target<keys.length){
        e.preventDefault();
        this._moveRelatedOrder(key,keys[target],e.key==='ArrowDown');
        this.root.querySelector('[data-zw-order-grip="'+key+'"]')?.focus();
      }
      return;
    }
    if(e.key==='Escape' || e.keyCode===27) {
      if(this.root.classList.contains('is-drawer-open')){
        this.root.classList.remove('is-drawer-open');
        e.preventDefault();
      }
    }
  }
  _beginRecording(id,button) {
    if(this._recordCleanup){this._recordCleanup();}
    const original=button.textContent;
    button.textContent='キーを押してください（Escで中止）';
    const handler=e=>{
      e.preventDefault();e.stopPropagation();e.stopImmediatePropagation?.();
      if([16,17,18,91,92,93,224].includes(e.keyCode)){return;}
      if(e.keyCode===27&&!e.metaKey&&!e.ctrlKey&&!e.shiftKey&&!e.altKey) {
        cleanup();return;
      }
      const code=this.encodeKeyCombo(e);
      cleanup();
      if(Number.isSafeInteger(code)&&code>0&&code<90000000) {
        this.model.set(id,code);
        this._renderCards();
        this.relatedEditor?._refresh?.();
        this._refreshFooter();
      }
    };
    const cleanup=()=>{
      this.doc.removeEventListener('keydown',handler,true);
      button.textContent=original;
      this._recordCleanup=null;
    };
    this._recordCleanup=cleanup;
    this.doc.addEventListener('keydown',handler,true);
  }
  dispose() {
    this.setModalVisible(false);
    if(this._recordCleanup){this._recordCleanup();}
    this.doc.removeEventListener('keydown',this._onKeyDownBound,true);
    this.root.removeEventListener('click',this._onClickBound,true);
    this.root.removeEventListener('change',this._onValueBound,true);
    this.root.removeEventListener('input',this._onInputBound,true);
    this.root.removeEventListener('dragstart',this._onOrderDragStartBound);
    this.root.removeEventListener('dragover',this._onOrderDragOverBound);
    this.root.removeEventListener('drop',this._onOrderDropBound);
    this.root.removeEventListener('dragend',this._onOrderDragEndBound);
    this._clearTouchOrder();
    this.root.removeEventListener('pointerdown',this._onTouchOrderDownBound);
    this.root.removeEventListener('pointermove',this._onTouchOrderMoveBound);
    this.root.removeEventListener('pointerup',this._onTouchOrderUpBound);
    this.root.removeEventListener('pointercancel',this._onTouchOrderCancelBound);
    this._unwatchRelatedActions?.();
    this.root.removeEventListener('click',this._onRelatedClickBound);
    this.root.removeEventListener('change',this._onRelatedChangeBound);
    this.root.removeEventListener('input',this._onRelatedInputBound);
    if(this.relatedEditor && this._relatedOrigin?.parent) {
      const {parent,next}=this._relatedOrigin;
      const editor=this.relatedEditor.container;
      if(next&&next.parentNode===parent){parent.insertBefore(editor,next);}
      else{parent.appendChild(editor);}
      editor.querySelector('[data-rl-save]').hidden=false;
      editor.querySelector('[data-rl-cancel]').hidden=false;
      this.relatedEditor.embedded=false;
      this.relatedEditor.onDraftChange=null;
      this.relatedEditor.getDraftShortcutValue=null;
      this.relatedEditor.getDraftShortcutConflicts=null;
    }
    for(const [node,{parent,next}] of this._moved) {
      if(!parent){continue;}
      if(next&&next.parentNode===parent){parent.insertBefore(node,next);}
      else {parent.appendChild(node);}
    }
    this.root.remove();
    this.panel.classList.remove('zw-modern-active');
  }
}
//===END===
export {ModernAdvancedSettingsUI};