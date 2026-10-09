// Task314: custom related-menu links editor, independent of the pending settings redesign.
//===BEGIN===
class RelatedMenuSettings {
  static mount(container, options) {
    return new RelatedMenuSettings(container, options);
  }

  static escape(text) {
    return String(text == null ? '' : text).replace(/[&<>"']/g, ch =>
      ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[ch]));
  }

  constructor(container, {config, actions, shortcuts = {}}) {
    if (!container || !config || !actions) { throw new TypeError('Related-menu settings dependencies missing'); }
    this.container = container;
    this.doc = container.ownerDocument;
    this.config = config;
    this.actions = actions;
    this.shortcuts = shortcuts;
    this._recordCleanup = null;
    this.externalChanged = false;
    this.message = '';
    this.saving = false;
    this.expandedIds = new Set();
    this.variablesOpen = new Set();
    this._dragFrom = null;
    this._handleDragStart = e => this._onDragStart(e);
    this._handleDragOver = e => this._onDragOver(e);
    this._handleDrop = e => this._onDrop(e);
    this._handleDragEnd = () => {
      this._dragFrom = null;
      this.container.querySelectorAll('.rl-drop-target').forEach(node =>
        node.classList.remove('rl-drop-target'));
    };
    this._handleClick = e => this._onClick(e);
    this._handleInput = e => this._onField(e);
    this._handleChange = e => this._onField(e);
    this._handleConfigUpdate = key => this._onConfigUpdate(key);
    this._addStyle();
    this._load();
    container.addEventListener('click', this._handleClick);
    container.addEventListener('input', this._handleInput);
    container.addEventListener('change', this._handleChange);
    container.addEventListener('dragstart', this._handleDragStart);
    container.addEventListener('dragover', this._handleDragOver);
    container.addEventListener('drop', this._handleDrop);
    container.addEventListener('dragend', this._handleDragEnd);
    if (typeof config.on === 'function') {
      config.on('update', this._handleConfigUpdate);
    }
  }

  _addStyle() {
    if (this.doc.querySelector('style[data-zenza-related-menu-settings]')) { return; }
    const style = this.doc.createElement('style');
    style.setAttribute('data-zenza-related-menu-settings', '');
    style.textContent = [
      '.zenzaRelatedLinksEditor { padding:10px 4px 14px; font-size:13px; line-height:1.5; }',
      '.zenzaRelatedLinksEditor h3 { font-size:16px; font-weight:700; margin:6px 0; }',
      '.zenzaRelatedLinksEditor p { margin:6px 0; }',
      '.zenzaRelatedLinksEditor .rl-help { opacity:.72; font-size:12px; }',
      '.zenzaRelatedLinksEditor .rl-toolbar { display:flex; flex-wrap:wrap; gap:8px; align-items:center; padding:10px 0; }',
      '.zenzaRelatedLinksEditor .rl-toolbar button { padding:7px 12px; }',
      '.zenzaRelatedLinksEditor .rl-toolbar [data-rl-count] { margin-right:auto; opacity:.76; }',
      '.zenzaRelatedLinksEditor .rl-card { border:1px solid #5c6c80; border-radius:5px; padding:12px; margin:9px 0; background:rgba(96,126,166,.09); }',
      '.zenzaRelatedLinksEditor .rl-head { display:flex; flex-wrap:wrap; align-items:center; gap:5px; margin-bottom:8px; }',
      '.zenzaRelatedLinksEditor .rl-head strong { margin-right:auto; min-width:80px; overflow-wrap:anywhere; }',
      '.zenzaRelatedLinksEditor .rl-head button { font-size:11px; padding:3px 8px; }',
      '.zenzaRelatedLinksEditor [hidden] { display:none !important; }',
      '.zenzaRelatedLinksEditor .rl-head .rl-summary { flex:1; min-width:100px; }',
      '.zenzaRelatedLinksEditor .rl-head .rl-summary strong { display:block; }',
      '.zenzaRelatedLinksEditor .rl-head .rl-summary small { display:block; opacity:.75; }',
      '.zenzaRelatedLinksEditor .rl-drag { cursor:grab; color:inherit; touch-action:none; }',
      '.zenzaRelatedLinksEditor .rl-card.rl-drop-target { outline:2px solid #82bfff; }',
      '.zenzaRelatedLinksEditor .rl-variables-toggle { margin-top:8px; }',
      '.zenzaRelatedLinksEditor .rl-variables { padding:6px; border:1px solid #4b5f76; border-radius:5px; }',
      '.zenzaRelatedLinksEditor .rl-shortcut-editor { display:flex; flex-wrap:wrap; gap:6px; align-items:center; margin:9px 0; }',
      '.zenzaRelatedLinksEditor .rl-shortcut-editor button { padding:5px 8px; }',
      '.zenzaRelatedLinksEditor .rl-shortcut-warning { color:#b67e24; font-size:12px; }',
      '.zenzaRelatedLinksEditor .rl-fields { display:grid; grid-template-columns:minmax(110px,1fr) minmax(160px,2fr); gap:10px; }',
      '.zenzaRelatedLinksEditor .rl-fields label { display:grid; gap:4px; min-width:0; }',
      '.zenzaRelatedLinksEditor .rl-fields label.rl-full { grid-column:1 / -1; }',
      '.zenzaRelatedLinksEditor .rl-fields input[type=text] { width:100%; box-sizing:border-box; min-width:0; padding:6px 8px; }',
      '.zenzaRelatedLinksEditor .rl-flags { display:flex; gap:18px; flex-wrap:wrap; margin:10px 0; }',
      '.zenzaRelatedLinksEditor .rl-flags label { display:inline-flex; align-items:center; gap:5px; }',
      '.zenzaRelatedLinksEditor .rl-variables { display:flex; flex-wrap:wrap; gap:5px; margin:5px 0; }',
      '.zenzaRelatedLinksEditor .rl-variables button { font-size:11px; padding:3px 7px; }',
      '.zenzaRelatedLinksEditor .rl-preview { display:block; overflow-wrap:anywhere; white-space:normal; padding:7px 8px; background:rgba(100,110,130,.16); border-radius:4px; }',
      '.zenzaRelatedLinksEditor .rl-error { color:#dc5f50; font-size:12px; min-height:1.4em; }',
      '.zenzaRelatedLinksEditor .rl-no-owner, .zenzaRelatedLinksEditor .rl-status { font-size:12px; opacity:.8; }',
      '.zenzaRelatedLinksEditor .rl-status { width:100%; min-height:1.4em; }',
      '.zenzaRelatedLinksEditor button:disabled { opacity:.45; cursor:not-allowed; }',
      '.zenzaRelatedLinksEditor .rl-save { font-weight:bold; }',
      '@media(max-width:650px) {.zenzaRelatedLinksEditor .rl-fields { grid-template-columns:1fr; } .zenzaRelatedLinksEditor .rl-fields label.rl-full { grid-column:auto; }}'
    ].join('\n');
    this.doc.head.append(style);
  }

  _read() {
    const raw = this.config.getValue(this.actions.CONFIG_KEY);
    if (!Array.isArray(raw)) { return null; }
    return raw.map(item => item && typeof item === 'object' && !Array.isArray(item) ?
      Object.assign({}, item) : item);
  }

  _load() {
    if (this._recordCleanup) { this._recordCleanup(); }
    this.original = this._read();
    this.draft = Array.isArray(this.original) ? this.original.map(item =>
      item && typeof item === 'object' ? Object.assign({}, item) : item) : [];
    this.externalChanged = false;
    this.expandedIds.clear();
    this.variablesOpen.clear();
    this.message = this.original === null ? '保存済みリンクの形式が不正です。JSONのバックアップを確認してください。' : '';
    this._render();
  }

  _dirty() {
    return JSON.stringify(this.draft) !== JSON.stringify(this.original);
  }

  _rowError(item, index) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) { return '設定の形式が不正です。'; }
    if (typeof item.id !== 'string' || !/^[a-z0-9][a-z0-9._:-]{0,63}$/i.test(item.id)) {
      return 'IDは英数字で始まる1～64文字（英数字・._:-）にしてください。';
    }
    if (this.draft.findIndex(link => link && link.id === item.id) !== index) {
      return '同じIDが存在します。IDを重複させないでください。';
    }
    if (typeof item.label !== 'string' || !item.label.trim() || item.label.length > 80) {
      return '表示名は1～80文字で入力してください。';
    }
    if (typeof item.url !== 'string' || !/^https?:\/\//.test(item.url) ||
      item.url.length > 2048) {
      return 'URLはHTTP(S)の絶対URL（最大2048文字）にしてください。';
    }
    const tokens = item.url.match(/\{[^{}]*\}/g) || [];
    if (tokens.some(x => !this.actions.VARIABLES.includes(x.slice(1, -1))) ||
      /[{}]/.test(item.url.replace(/\{[^{}]*\}/g, ''))) {
      return 'URLに未知の変数、または閉じていない波括弧があります。';
    }
    if (!this.actions.validateLinks([item]).valid) {
      return 'URLまたは設定が不正です。ユーザー名・パスワード入りURLも使えません。';
    }
    return '';
  }

  _rowKey(item, index) {
    return item && typeof item.id === 'string' && item.id ? item.id : '__invalid_'+index;
  }

  _formatShortcut(code) {
    return typeof this.shortcuts.formatKeyCombo === 'function' ?
      this.shortcuts.formatKeyCombo(code) : (code ? String(code) : '(未設定)');
  }

  _render() {
    const E = RelatedMenuSettings.escape;
    const rows = this.draft.map((item, index) => {
      const obj = item && typeof item === 'object' ? item : {};
      const field = (key, label, attrs='') =>
        '<label>'+label+'<input type="text" data-rl-field="'+key+'" '+attrs+
        ' value="'+E(obj[key])+'"></label>';
      const names={videoId:'動画ID',watchId:'視聴ID',videoUrl:'動画URL',
        videoTitle:'動画タイトル',uploaderUserId:'投稿者ID',uploaderChannelId:'チャンネルID',
        uploaderName:'投稿者名',currentTime:'再生位置（秒）'};
      const variableButtons = this.actions.VARIABLES.map(name =>
        '<button type="button" data-rl-insert="'+name+'" data-rl-index="'+index+'">'+
        E(names[name] || name)+' <code>{'+name+'}</code></button>'
      ).join('');
      const rowKey=this._rowKey(item,index);
      const expanded=this.expandedIds.has(rowKey);
      const variablesShown=this.variablesOpen.has(rowKey);
      return '<article class="rl-card" data-rl-row="'+index+'">' +
        '<div class="rl-head">' +
        '<button type="button" class="rl-drag" data-rl-drag="'+index+'" draggable="true" aria-label="ドラッグで並び替え" title="ドラッグで並び替え">⠿</button>' +
        '<div class="rl-summary"><strong data-rl-summary>'+E(obj.label || 'リンク '+(index+1))+'</strong>' +
        '<small data-rl-summary-status>'+(obj.enabled===false?'無効':'有効')+' ・ '+
        E(this._formatShortcut(obj.shortcutKey))+'</small>' +
        '<small data-rl-shortcut-summary-warning class="rl-shortcut-warning"></small>' +
        '<small data-rl-error-summary class="rl-error"></small></div>' +
        '<button type="button" data-rl-expand="'+index+'" aria-expanded="'+(expanded?'true':'false')+'">'+
        (expanded?'閉じる':'編集')+'</button>' +
        '<button type="button" data-rl-up="'+index+'" '+(index===0?'disabled':'')+'>↑ 上へ</button>' +
        '<button type="button" data-rl-down="'+index+'" '+(index===this.draft.length-1?'disabled':'')+'>↓ 下へ</button>' +
        '<button type="button" data-rl-duplicate="'+index+'" '+(this.draft.length>=40?'disabled':'')+'>複製</button>' +
        '<button type="button" data-rl-delete="'+index+'">削除</button></div>' +
        '<div data-rl-details '+(expanded?'':'hidden')+'>' +
        '<div class="rl-fields">' +
        field('id','ID（リンク識別子）','maxlength="64"')+
        field('label','表示名','maxlength="80"')+
        '<label class="rl-full">URLテンプレート<input type="text" data-rl-field="url" maxlength="2048" value="'+E(obj.url)+'" placeholder="https://example.com/watch/{videoId}"></label>' +
        '</div><div class="rl-flags">' +
        '<label><input type="checkbox" data-rl-field="enabled" '+(obj.enabled!==false?'checked':'')+'> 有効にする</label>' +
        '<label><input type="checkbox" data-rl-field="openInNewTab" '+(obj.openInNewTab!==false?'checked':'')+'> 新しいタブで開く</label></div>' +
        '<div class="rl-shortcut-editor"><span>ショートカット: <strong data-rl-key-text>'+E(this._formatShortcut(obj.shortcutKey))+'</strong></span>' +
        '<button type="button" data-rl-record="'+index+'">変更</button>' +
        '<button type="button" data-rl-key-clear="'+index+'">解除</button>' +
        '<span class="rl-shortcut-warning" data-rl-shortcut-warning></span></div>' +
        '<button type="button" class="rl-variables-toggle" data-rl-variables-toggle="'+index+'" aria-expanded="'+(variablesShown?'true':'false')+'">'+
        '｛ ｝ 変数を挿入 '+(variablesShown?'▴':'▾')+'</button>' +
        '<div class="rl-variables" data-rl-variables-panel '+(variablesShown?'':'hidden')+'>'+variableButtons+'</div>' +
        '<div class="rl-help">URLプレビュー（サンプル値）</div><code class="rl-preview" data-rl-preview></code>' +
        '<p class="rl-no-owner" data-rl-no-owner></p>' +
        '<p class="rl-error" data-rl-error role="status"></p>' +
        '</div></article>';
    }).join('');
    this.container.innerHTML =
      '<section class="zenzaRelatedLinksEditor" aria-label="関連メニュー カスタムリンク編集">' +
      '<h3>関連メニュー › カスタムリンク</h3>' +
      '<p class="rl-help">動画情報パネルと動画上部の関連メニューに表示するリンクです。' +
      '外部Userscriptで登録したアクションはここでは編集できません。</p>' +
      '<div data-rl-rows>'+rows+'</div>' +
      '<div class="rl-toolbar"><span data-rl-count></span>' +
      '<button type="button" data-rl-add>＋ リンクを追加</button>' +
      '<button type="button" data-rl-cancel>変更を破棄</button>' +
      '<button type="button" class="rl-save" data-rl-save>変更を保存</button>' +
      '<p class="rl-status" role="status" aria-live="polite" data-rl-status></p></div>' +
      '</section>';
    this._refresh();
  }

  _refresh() {
    const validation = this.actions.validateLinks(this.draft);
    const invalid = this.draft.map((row,i) => this._rowError(row,i));
    const sample = {videoId:'sm9',watchId:'sm9',videoUrl:'https://www.nicovideo.jp/watch/sm9',
      videoTitle:'サンプル動画',uploaderUserId:'12345',uploaderChannelId:'4567',
      uploaderName:'投稿者の例',currentTime:'85'};
    const noOwner = Object.assign({},sample,{
      uploaderUserId:'',uploaderChannelId:'',uploaderName:''
    });
    this.container.querySelectorAll('[data-rl-row]').forEach((card,index) => {
      const item=this.draft[index] || {};
      card.querySelector('[data-rl-summary]').textContent=item.label || 'リンク '+(index+1);
      card.querySelector('[data-rl-summary-status]').textContent=
        (item.enabled===false?'無効':'有効')+' ・ '+this._formatShortcut(item.shortcutKey);
      const label=card.querySelector('[data-rl-key-text]');
      label.textContent=this._formatShortcut(item.shortcutKey);
      const key=Number(item.shortcutKey)||0;
      const sameLinks=this.draft.filter((other,i)=>i!==index &&
        other && Number(other.shortcutKey)===key).map(other=>other.label||other.id);
      const ordinary=(this.shortcuts.actions||[]).filter(action=>
        this.config.props && Number(this.config.props['KEY_'+action.id])===key)
        .map(action=>action.label||action.id);
      const warning=key && (sameLinks.length || ordinary.length) ?
        '⚠ ショートカットが重複: '+sameLinks.concat(ordinary).join('、')+'（すべて実行）' : '';
      card.querySelector('[data-rl-shortcut-warning]').textContent=warning;
      card.querySelector('[data-rl-shortcut-summary-warning]').textContent=warning ? '⚠ キー重複' : '';
      const preview=card.querySelector('[data-rl-preview]');
      const noOwnerView=card.querySelector('[data-rl-no-owner]');
      const err=card.querySelector('[data-rl-error]');
      const resolved=this.actions.resolveUrl(item.url,sample);
      preview.textContent=resolved.url || 'プレビューできません（URLまたは変数を確認）';
      const missing=this.actions.resolveUrl(item.url,noOwner);
      const ownerDependent=(missing.missing||[]).some(name=>
        ['uploaderUserId','uploaderChannelId','uploaderName'].includes(name));
      noOwnerView.textContent=ownerDependent ?
        '投稿者情報を取得できない動画では、このリンクは無効になります。' : '';
      err.textContent=invalid[index];
      card.querySelector('[data-rl-error-summary]').textContent=invalid[index] ? '⚠ 入力内容を確認' : '';
    });
    const count=this.container.querySelector('[data-rl-count]');
    count.textContent=this.draft.length+' / 40 件';
    this.container.querySelector('[data-rl-add]').disabled=this.draft.length>=40 || this.original===null;
    this.container.querySelector('[data-rl-cancel]').disabled=!this._dirty() && !this.externalChanged;
    this.container.querySelector('[data-rl-save]').disabled=
      !this._dirty() || !validation.valid || invalid.some(Boolean) || this.original===null;
    const status=this.container.querySelector('[data-rl-status]');
    status.textContent=this.externalChanged ?
      '別の画面で設定が更新されました。変更を破棄して再読み込みしてください。' :
      this.message || (!validation.valid ? 'URL・ID・表示名などの入力エラーがあります。保存前に修正してください。' :
      this._dirty() ? '未保存の変更があります。' : '');
  }

  _onField(e) {
    const field=e.target.dataset && e.target.dataset.rlField;
    if (!field) { return; }
    const card=e.target.closest('[data-rl-row]');
    if (!card || !this.container.contains(card)) { return; }
    const index=Number(card.dataset.rlRow);
    const item=this.draft[index];
    const value=e.target.type==='checkbox' ? e.target.checked : e.target.value;
    if (field==='id' && item && typeof item.id==='string') {
      if (this.expandedIds.delete(item.id)) { this.expandedIds.add(value); }
      if (this.variablesOpen.delete(item.id)) { this.variablesOpen.add(value); }
    }
    this.draft=this.draft.map((entry,i)=>i===index?Object.assign({},entry,{[field]:value}):entry);
    this.message='';
    this._refresh();
  }

  _uniqueId(base='link') {
    const ids=new Set(this.draft.map(item=>item&&item.id));
    let n=1;
    let candidate;
    do { candidate=base.slice(0,Math.max(1,64-String(n).length-1))+'-'+n++; }
    while (ids.has(candidate));
    return candidate;
  }

  _insert(button) {
    const index=Number(button.dataset.rlIndex);
    const name=button.dataset.rlInsert;
    if (!this.actions.VARIABLES.includes(name)) { return; }
    const card=this.container.querySelector('[data-rl-row="'+index+'"]');
    if (!card) { return; }
    const input=card.querySelector('[data-rl-field="url"]');
    const token='{'+name+'}';
    const start=typeof input.selectionStart==='number'?input.selectionStart:input.value.length;
    const end=typeof input.selectionEnd==='number'?input.selectionEnd:start;
    input.setRangeText(token,start,end,'end');
    this.draft=this.draft.map((item,i)=>i===index?
      Object.assign({},item,{url:input.value}):item);
    input.focus();
    const rowKey=this._rowKey(this.draft[index],index);
    this.variablesOpen.delete(rowKey);
    const menu=card.querySelector('[data-rl-variables-panel]');
    if (menu) { menu.hidden=true; }
    const toggle=card.querySelector('[data-rl-variables-toggle]');
    if (toggle) { toggle.setAttribute('aria-expanded','false');toggle.textContent='｛ ｝ 変数を挿入 ▾'; }
    this.message='';
    this._refresh();
  }

  _save() {
    const valid=this.actions.validateLinks(this.draft);
    if (!valid.valid || this.draft.some((item,i)=>this._rowError(item,i))) {
      this.message='入力内容を確認してください。変更は保存されていません。';
      this._refresh();return;
    }
    if (JSON.stringify(this._read())!==JSON.stringify(this.original)) {
      this.externalChanged=true;this._refresh();return;
    }
    const next=valid.links.map(link=>Object.assign({},link));
    try {
      this.saving=true;
      this.config.setValue(this.actions.CONFIG_KEY,next);
      this.saving=false;
      this._load();
      this.message='保存しました。';
      this._refresh();
    } catch (_) {
      this.saving=false;
      this.message='設定の保存に失敗しました。内容は保持しています。';
      this._refresh();
    }
  }

  _onConfigUpdate(key) {
    if (key!==this.actions.CONFIG_KEY || this.saving) { return; }
    if (this._dirty()) { this.externalChanged=true;this._refresh(); }
    else { this._load(); }
  }

  _startRecording(index, button) {
    if (this._recordCleanup) { this._recordCleanup(); }
    const originalText=button.textContent;
    const document=this.doc;
    button.textContent='キーを押してください（Escで中止）';
    const cleanup=() => {
      document.removeEventListener('keydown',onKeyDown,true);
      button.textContent=originalText;
      this._recordCleanup=null;
    };
    const onKeyDown=evt => {
      evt.preventDefault();
      evt.stopPropagation();
      if (typeof evt.stopImmediatePropagation==='function') { evt.stopImmediatePropagation(); }
      if ([16,17,18,91,92,93,224].includes(evt.keyCode)) { return; }
      if (evt.keyCode===27 && !(evt.metaKey || evt.altKey || evt.ctrlKey || evt.shiftKey)) {
        cleanup();return;
      }
      const value=typeof this.shortcuts.encodeKeyCombo==='function' ?
        this.shortcuts.encodeKeyCombo(evt) : evt.keyCode;
      cleanup();
      if (!Number.isSafeInteger(value) || value<=0 || value>=90000000) { return; }
      this.draft=this.draft.map((entry,i)=>i===index ?
        Object.assign({},entry,{shortcutKey:value}) : entry);
      this.message='';
      this._refresh();
    };
    this._recordCleanup=cleanup;
    document.addEventListener('keydown',onKeyDown,true);
  }

  _onClick(e) {
    const button=e.target.closest('button');
    if (!button || !this.container.contains(button) || button.disabled) { return; }
    if (button.dataset.rlInsert) { this._insert(button);return; }
    if (button.hasAttribute('data-rl-record')) {
      const index=Number(button.dataset.rlRecord);
      if (Number.isInteger(index) && index>=0 && index<this.draft.length) {
        this._startRecording(index,button);
      }
      return;
    }
    if (button.hasAttribute('data-rl-key-clear')) {
      const index=Number(button.dataset.rlKeyClear);
      if (!Number.isInteger(index) || index<0 || index>=this.draft.length) { return; }
      if (this._recordCleanup) { this._recordCleanup(); }
      this.draft=this.draft.map((entry,i)=>i===index ?
        Object.assign({},entry,{shortcutKey:0}) : entry);
      this._refresh();
      return;
    }
    if (button.hasAttribute('data-rl-expand')) {
      const index=Number(button.dataset.rlExpand);
      const card=button.closest('[data-rl-row]');
      const key=this._rowKey(this.draft[index],index);
      if (this.expandedIds.has(key)) { this.expandedIds.delete(key); }
      else { this.expandedIds.add(key); }
      const expanded=this.expandedIds.has(key);
      if (!expanded && this._recordCleanup) { this._recordCleanup(); }
      card.querySelector('[data-rl-details]').hidden=!expanded;
      button.textContent=expanded?'閉じる':'編集';
      button.setAttribute('aria-expanded',String(expanded));
      return;
    }
    if (button.hasAttribute('data-rl-variables-toggle')) {
      const index=Number(button.dataset.rlVariablesToggle);
      const key=this._rowKey(this.draft[index],index);
      const panel=button.closest('[data-rl-row]').querySelector('[data-rl-variables-panel]');
      const expanded=panel.hidden;
      panel.hidden=!expanded;
      if (expanded) { this.variablesOpen.add(key); } else { this.variablesOpen.delete(key); }
      button.setAttribute('aria-expanded',String(expanded));
      button.textContent='｛ ｝ 変数を挿入 '+(expanded?'▴':'▾');
      return;
    }
    if (button.hasAttribute('data-rl-save')) { this._save();return; }
    if (button.hasAttribute('data-rl-cancel')) { this._load();return; }
    if (button.hasAttribute('data-rl-add')) {
      if (this.draft.length<40 && this.original!==null) {
        const id=this._uniqueId();
        this.draft=this.draft.concat([{id,label:'',url:'',
          enabled:true,openInNewTab:true}]);
        this.expandedIds.add(id);
        this.message='';this._render();
      }
      return;
    }
    const operations=['duplicate','delete','up','down'];
    const kind=operations.find(x=>button.hasAttribute('data-rl-'+x));
    if (!kind) { return; }
    const index=Number(button.getAttribute('data-rl-'+kind));
    if (!Number.isInteger(index) || index<0 || index>=this.draft.length) { return; }
    const next=this.draft.slice();
    if (kind==='duplicate') {
      if (next.length>=40) { return; }
      const old=next[index];
      if (!old || typeof old!=='object' || Array.isArray(old) || typeof old.id!=='string') { return; }
      const id=this._uniqueId(String(old.id).slice(0,55)+'-copy');
      next.splice(index+1,0,Object.assign({},old,{id}));
      this.expandedIds.add(id);
    } else if (kind==='delete') {
      const key=this._rowKey(next[index],index);
      this.expandedIds.delete(key);
      this.variablesOpen.delete(key);
      next.splice(index,1);
    } else {
      const other=kind==='up'?index-1:index+1;
      if (other<0 || other>=next.length) { return; }
      const entry=next.splice(index,1)[0];
      next.splice(other,0,entry);
    }
    this.draft=next;this.message='';this._render();
  }

  _onDragStart(e) {
    const grip=e.target.closest && e.target.closest('[data-rl-drag]');
    if (!grip || !this.container.contains(grip)) { return; }
    const from=Number(grip.dataset.rlDrag);
    if (!Number.isInteger(from) || from<0 || from>=this.draft.length) { return; }
    this._dragFrom=from;
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed='move';
      e.dataTransfer.setData('text/plain',String(from));
    }
  }

  _onDragOver(e) {
    if (this._dragFrom===null) { return; }
    const card=e.target.closest && e.target.closest('[data-rl-row]');
    if (!card || !this.container.contains(card)) { return; }
    e.preventDefault();
    if (e.dataTransfer) { e.dataTransfer.dropEffect='move'; }
    this.container.querySelectorAll('.rl-drop-target').forEach(node=>
      node.classList.remove('rl-drop-target'));
    card.classList.add('rl-drop-target');
  }

  _onDrop(e) {
    if (this._dragFrom===null) { return; }
    const card=e.target.closest && e.target.closest('[data-rl-row]');
    if (!card || !this.container.contains(card)) { return; }
    e.preventDefault();
    const from=this._dragFrom;
    const to=Number(card.dataset.rlRow);
    this._dragFrom=null;
    if (!Number.isInteger(to) || to<0 || to>=this.draft.length || from===to) {
      this.container.querySelectorAll('.rl-drop-target').forEach(node=>
        node.classList.remove('rl-drop-target'));
      return;
    }
    const next=this.draft.slice();
    next.splice(to,0,next.splice(from,1)[0]);
    this.draft=next;
    this.message='';
    this._render();
  }

  dispose() {
    if (this._recordCleanup) { this._recordCleanup(); }
    this.container.removeEventListener('click',this._handleClick);
    this.container.removeEventListener('input',this._handleInput);
    this.container.removeEventListener('change',this._handleChange);
    this.container.removeEventListener('dragstart',this._handleDragStart);
    this.container.removeEventListener('dragover',this._handleDragOver);
    this.container.removeEventListener('drop',this._handleDrop);
    this.container.removeEventListener('dragend',this._handleDragEnd);
    if (typeof this.config.off==='function') {
      this.config.off('update',this._handleConfigUpdate);
    }
    this.container.replaceChildren();
  }
}
//===END===
export {RelatedMenuSettings};
