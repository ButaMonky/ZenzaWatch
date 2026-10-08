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

  constructor(container, {config, actions}) {
    if (!container || !config || !actions) { throw new TypeError('Related-menu settings dependencies missing'); }
    this.container = container;
    this.doc = container.ownerDocument;
    this.config = config;
    this.actions = actions;
    this.externalChanged = false;
    this.message = '';
    this.saving = false;
    this._handleClick = e => this._onClick(e);
    this._handleInput = e => this._onField(e);
    this._handleChange = e => this._onField(e);
    this._handleConfigUpdate = key => this._onConfigUpdate(key);
    this._addStyle();
    this._load();
    container.addEventListener('click', this._handleClick);
    container.addEventListener('input', this._handleInput);
    container.addEventListener('change', this._handleChange);
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
    this.original = this._read();
    this.draft = Array.isArray(this.original) ? this.original.map(item =>
      item && typeof item === 'object' ? Object.assign({}, item) : item) : [];
    this.externalChanged = false;
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

  _render() {
    const E = RelatedMenuSettings.escape;
    const rows = this.draft.map((item, index) => {
      const obj = item && typeof item === 'object' ? item : {};
      const field = (key, label, attrs='') =>
        '<label>'+label+'<input type="text" data-rl-field="'+key+'" '+attrs+
        ' value="'+E(obj[key])+'"></label>';
      const variableButtons = this.actions.VARIABLES.map(name =>
        '<button type="button" data-rl-insert="'+name+'" data-rl-index="'+index+'">{'+name+'}</button>'
      ).join('');
      return '<article class="rl-card" data-rl-row="'+index+'">' +
        '<div class="rl-head"><strong>リンク '+(index+1)+'</strong>' +
        '<button type="button" data-rl-up="'+index+'" '+(index===0?'disabled':'')+'>↑ 上へ</button>' +
        '<button type="button" data-rl-down="'+index+'" '+(index===this.draft.length-1?'disabled':'')+'>↓ 下へ</button>' +
        '<button type="button" data-rl-duplicate="'+index+'" '+(this.draft.length>=40?'disabled':'')+'>複製</button>' +
        '<button type="button" data-rl-delete="'+index+'">削除</button></div>' +
        '<div class="rl-fields">' +
        field('id','ID（リンク識別子）','maxlength="64"')+
        field('label','表示名','maxlength="80"')+
        '<label class="rl-full">URLテンプレート<input type="text" data-rl-field="url" maxlength="2048" value="'+E(obj.url)+'" placeholder="https://example.com/watch/{videoId}"></label>' +
        '</div><div class="rl-flags">' +
        '<label><input type="checkbox" data-rl-field="enabled" '+(obj.enabled!==false?'checked':'')+'> 有効にする</label>' +
        '<label><input type="checkbox" data-rl-field="openInNewTab" '+(obj.openInNewTab!==false?'checked':'')+'> 新しいタブで開く</label></div>' +
        '<div class="rl-help">変数をURLのカーソル位置に挿入:</div><div class="rl-variables">'+variableButtons+'</div>' +
        '<div class="rl-help">URLプレビュー（サンプル値）</div><code class="rl-preview" data-rl-preview></code>' +
        '<p class="rl-no-owner" data-rl-no-owner></p>' +
        '<p class="rl-error" data-rl-error role="status"></p>' +
        '</article>';
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

  _onClick(e) {
    const button=e.target.closest('button');
    if (!button || !this.container.contains(button) || button.disabled) { return; }
    if (button.dataset.rlInsert) { this._insert(button);return; }
    if (button.hasAttribute('data-rl-save')) { this._save();return; }
    if (button.hasAttribute('data-rl-cancel')) { this._load();return; }
    if (button.hasAttribute('data-rl-add')) {
      if (this.draft.length<40 && this.original!==null) {
        this.draft=this.draft.concat([{id:this._uniqueId(),label:'',url:'',
          enabled:true,openInNewTab:true}]);
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
      const id=this._uniqueId(String(old.id).slice(0,55)+'-copy');
      next.splice(index+1,0,Object.assign({},old,{id}));
    } else if (kind==='delete') {
      next.splice(index,1);
    } else {
      const other=kind==='up'?index-1:index+1;
      if (other<0 || other>=next.length) { return; }
      const swap=next[index];next[index]=next[other];next[other]=swap;
    }
    this.draft=next;this.message='';this._render();
  }

  dispose() {
    this.container.removeEventListener('click',this._handleClick);
    this.container.removeEventListener('input',this._handleInput);
    this.container.removeEventListener('change',this._handleChange);
    if (typeof this.config.off==='function') {
      this.config.off('update',this._handleConfigUpdate);
    }
    this.container.replaceChildren();
  }
}
//===END===
export {RelatedMenuSettings};
