// Task314: custom related-menu links editor, independent of the pending settings redesign.
// Task555: staged canonical TypeScript source for RelatedMenuSettings.
export interface RelatedMenuSettingsDraft {
  id: string;
  label: string;
  enabled?: boolean;
  kind?: 'link' | 'copy';
}
export interface RelatedLinkDraft {
  id: string;
  label: string;
  url?: string;
  copyTemplate?: string;
  kind?: 'link' | 'copy';
  enabled?: boolean;
  openInNewTab?: boolean;
  openMode?: string;
  popupWidth?: number;
  popupHeight?: number;
  shortcutKey?: number;
  [field: string]: unknown;
}
interface RelatedMenuConfigPort {
  props?: Record<string, unknown>;
  getValue(key: string): unknown;
  setValue(key: string,value: unknown): unknown;
  on?(name: string,listener: (key: string)=>void): unknown;
  off?(name: string,listener: (key: string)=>void): unknown;
}
interface RelatedMenuResolution {
  url?: string;
  text?: string;
  missing?: string[];
}
interface RelatedMenuActionsPort {
  CONFIG_KEY: string;
  VARIABLES: string[];
  validateLinks(rows: RelatedLinkDraft[]): {valid: boolean; links: RelatedLinkDraft[]};
  isCopy(row: unknown): boolean;
  resolveCopy(template: string | undefined, sample: Record<string,string>): RelatedMenuResolution;
  resolveUrl(template: string | undefined, sample: Record<string,string>): RelatedMenuResolution;
}
interface RelatedMenuShortcutsPort {
  formatKeyCombo?(code: unknown): string;
  encodeKeyCombo?(event: KeyboardEvent): number;
  actions?: Array<{id:string;label:string}>;
}
interface RelatedMenuEditorOptions {
  config: RelatedMenuConfigPort;
  actions: RelatedMenuActionsPort;
  shortcuts?: RelatedMenuShortcutsPort;
  embedded?: boolean;
  onDraftChange?: ((value:RelatedLinkDraft[])=>void) | null;
}
//===BEGIN===
class RelatedMenuSettings {
  declare container: HTMLElement;
  declare doc: Document;
  declare config: RelatedMenuConfigPort;
  declare actions: RelatedMenuActionsPort;
  declare shortcuts: RelatedMenuShortcutsPort;
  declare embedded: boolean;
  declare onDraftChange: ((draft: RelatedLinkDraft[])=>void) | null;
  declare getDraftShortcutValue: ((id:string)=>unknown) | null;
  declare getDraftShortcutConflicts: ((code:number)=>string[]) | null;
  declare _recordCleanup: (()=>void) | null;
  declare externalChanged: boolean;
  declare message: string;
  declare saving: boolean;
  declare expandedIds: Set<string>;
  declare variablesOpen: Set<string>;
  declare _dragFrom: number | null;
  declare _dragAfter: boolean;
  declare original: RelatedLinkDraft[] | null;
  declare draft: RelatedLinkDraft[];
  declare _detailId: string | undefined;
  declare _handleDragStart: (e: DragEvent)=>void;
  declare _handleDragOver: (e: DragEvent)=>void;
  declare _handleDrop: (e: DragEvent)=>void;
  declare _handleDragEnd: ()=>void;
  declare _handleClick: (e: MouseEvent)=>void;
  declare _handleInput: (e: Event)=>void;
  declare _handleChange: (e: Event)=>void;
  declare _handleConfigUpdate: (key: string)=>void;
  declare _handleGripKeyDown: (e: KeyboardEvent)=>void;
  static mount(container: HTMLElement, options: RelatedMenuEditorOptions): RelatedMenuSettings {
    return new RelatedMenuSettings(container, options);
  }

  static escape(text: unknown): string {
    return String(text == null ? '' : text).replace(/[&<>"']/g, ch =>
      ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'} as Record<string,string>)[ch]);
  }

  constructor(container: HTMLElement, {config, actions, shortcuts = {}, embedded = false, onDraftChange = null}: RelatedMenuEditorOptions) {
    if (!container || !config || !actions) { throw new TypeError('Related-menu settings dependencies missing'); }
    this.container = container;
    this.doc = container.ownerDocument;
    this.config = config;
    this.actions = actions;
    this.shortcuts = shortcuts;
    // When embedded in the modern settings shell, every edit stays in the
    // global draft. The bottom Save is the only operation that writes Config.
    this.embedded = embedded === true;
    this.onDraftChange = typeof onDraftChange === 'function' ? onDraftChange : null;
    this.getDraftShortcutValue=null;
    this.getDraftShortcutConflicts=null;
    this._recordCleanup = null;
    this.externalChanged = false;
    this.message = '';
    this.saving = false;
    this.expandedIds = new Set();
    this.variablesOpen = new Set();
    this._dragFrom = null;
    this._dragAfter = false;
    this._handleDragStart = e => this._onDragStart(e);
    this._handleDragOver = e => this._onDragOver(e);
    this._handleDrop = e => this._onDrop(e);
    this._handleDragEnd = () => this._clearDragVisuals();
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
    container.addEventListener('keydown', this._handleGripKeyDown=e=>this._onGripKeyDown(e));
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
      '.zenzaRelatedLinksEditor .rl-card { position:relative; border:1px solid #5c6c80; border-radius:5px; padding:12px; margin:9px 0; background:rgba(96,126,166,.09); }',
      '.zenzaRelatedLinksEditor .rl-head { display:flex; flex-wrap:wrap; align-items:center; gap:5px; margin-bottom:8px; }',
      '.zenzaRelatedLinksEditor .rl-head strong { margin-right:auto; min-width:80px; overflow-wrap:anywhere; }',
      '.zenzaRelatedLinksEditor .rl-head button { font-size:11px; padding:3px 8px; }',
      '.zenzaRelatedLinksEditor [hidden] { display:none !important; }',
      '.zenzaRelatedLinksEditor .rl-head .rl-summary { flex:1; min-width:100px; }',
      '.zenzaRelatedLinksEditor .rl-head .rl-summary strong { display:block; }',
      '.zenzaRelatedLinksEditor .rl-head .rl-summary small { display:block; opacity:.75; }',
      '.zenzaRelatedLinksEditor .rl-drag { cursor:grab; color:inherit; touch-action:none; }',
      '.zenzaRelatedLinksEditor .rl-card.rl-is-dragging { opacity:.4; border-style:dashed; }',
      '.zenzaRelatedLinksEditor .rl-card.rl-drop-target::before { content:""; position:absolute; left:0; right:0; height:4px; border-radius:4px; background:#82bfff; box-shadow:0 0 8px #82bfff; pointer-events:none; z-index:2; }',
      '.zenzaRelatedLinksEditor .rl-card.rl-drop-before::before { top:-8px; }',
      '.zenzaRelatedLinksEditor .rl-card.rl-drop-after::before { bottom:-8px; }',
      '.zenzaRelatedLinksEditor .rl-variables-toggle { margin-top:8px; }',
      '.zenzaRelatedLinksEditor .rl-variables { padding:6px; border:1px solid #4b5f76; border-radius:5px; }',
      '.zenzaRelatedLinksEditor .rl-shortcut-editor { display:flex; flex-wrap:wrap; gap:6px; align-items:center; margin:9px 0; }',
      '.zenzaRelatedLinksEditor .rl-shortcut-editor button { padding:5px 8px; }',
      '.zenzaRelatedLinksEditor .rl-shortcut-warning { color:#b67e24; font-size:12px; }',
      '.zenzaRelatedLinksEditor .rl-fields { display:grid; grid-template-columns:minmax(110px,1fr) minmax(160px,2fr); gap:10px; }',
      '.zenzaRelatedLinksEditor .rl-fields label { display:grid; gap:4px; min-width:0; }',
      '.zenzaRelatedLinksEditor .rl-fields label.rl-full { grid-column:1 / -1; }',
      '.zenzaRelatedLinksEditor .rl-fields input[type=text] { width:100%; box-sizing:border-box; min-width:0; padding:6px 8px; }',
      '.zenzaRelatedLinksEditor .rl-flags select,.zenzaRelatedLinksEditor .rl-flags input[type=number] { max-width:190px; padding:5px; background:#101927; color:#edf4ff; border:1px solid #445a71; }',
      '.zenzaRelatedLinksEditor .rl-variables small { flex:1 0 100%; }',
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

  _read(): RelatedLinkDraft[] | null {
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

  _rowError(item: RelatedLinkDraft,index: number): string {
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
    if(this.actions.isCopy(item)){
      return this.actions.validateLinks([item]).valid?'':
        'コピー内容を入力してください（4096文字以内・既知の変数のみ使用可能）。';
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

  replaceDraftFromParent(value: unknown) {
    if (!Array.isArray(value)) { throw new TypeError('Expected custom link array'); }
    if (this._recordCleanup) { this._recordCleanup(); }
    this.draft=value.map(entry=>
      entry && typeof entry==='object' && !Array.isArray(entry) ? {...entry} : entry);
    this.expandedIds.clear();
    this.variablesOpen.clear();
    this.message='';
    // Embedded editing mirrors back to the parent's draft via onDraftChange.
    // Neither rendering nor this operation writes the saved Config.
    this._render();
  }

  _rowKey(item: RelatedLinkDraft | undefined,index: number): string {
    return item && typeof item.id === 'string' && item.id ? item.id : '__invalid_'+index;
  }

  _formatShortcut(code: unknown): string {
    return typeof this.shortcuts.formatKeyCombo === 'function' ?
      this.shortcuts.formatKeyCombo(code) : (code ? String(code) : '(未設定)');
  }

  _render() {
    const E = RelatedMenuSettings.escape;
    const rows = this.draft.map((item, index) => {
      const obj = item && typeof item === 'object' ? item : {} as RelatedLinkDraft;
      const field = (key: string, label: string, attrs='') =>
        '<label>'+label+'<input type="text" data-rl-field="'+key+'" '+attrs+
        ' value="'+E(obj[key])+'"></label>';
      const names: Record<string,string>={videoId:'動画ID',watchId:'視聴ID',videoUrl:'動画URL',
        videoTitle:'動画タイトル',uploaderUserId:'投稿者ID',uploaderChannelId:'チャンネルID',
        uploaderName:'投稿者名',currentTime:'再生位置（秒）'};
      const variableButtons = this.actions.VARIABLES.map(name =>
        '<button type="button" data-rl-insert="'+name+'" data-rl-index="'+index+'" title="'+E(names[name]||name)+'をURLに挿入">'+
        E(names[name] || name)+' <code>{'+name+'}</code></button>'
      ).join('');
      const rowKey=this._rowKey(item,index);
      const expanded=this.expandedIds.has(rowKey);
      const variablesShown=this.variablesOpen.has(rowKey);
      return '<article class="rl-card" data-rl-row="'+index+'">' +
        '<div class="rl-head">' +
        '<button type="button" class="rl-drag" data-rl-drag="'+index+'" draggable="true" aria-label="ドラッグで移動。Alt＋上下キーでも移動できます" title="ドラッグかAlt＋↑↓で並び替え">⠿</button>' +
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
        '<label class="rl-full">項目の動作<select data-rl-field="kind"><option value="link" '+(obj.kind!=='copy'?'selected':'')+'>リンクを開く</option><option value="copy" '+(obj.kind==='copy'?'selected':'')+'>テキストをコピー</option></select></label>'+
        '<label class="rl-full" data-rl-copy-fields>コピー内容のひな形<select data-rl-copy-preset><option value="">選択して挿入</option><option value="id">動画ID</option><option value="url">動画URL</option><option value="title">動画タイトル</option><option value="title-url">タイトル＋URL</option></select></label>'+
        '<label class="rl-full" data-rl-copy-fields>コピーするテキスト<textarea data-rl-field="copyTemplate" maxlength="4096" rows="4">'+E(obj.copyTemplate||'{videoId}')+'</textarea><small>変数を組み合わせたり、改行や任意の文字を追加できます。</small></label>'+
        '<label class="rl-full" data-rl-link-fields>URLテンプレート<input type="text" data-rl-field="url" maxlength="2048" value="'+E(obj.url)+'" placeholder="https://example.com/watch/{videoId}"></label>' +
        '</div><div class="rl-flags">' +
        '<label><input type="checkbox" data-rl-field="enabled" '+(obj.enabled!==false?'checked':'')+'> 有効にする</label>' +
        '<label><input type="checkbox" data-rl-field="openInNewTab" '+(obj.openInNewTab!==false?'checked':'')+'> 旧設定：新しいタブ</label>' +
        '<label>開き方 <select data-rl-field="openMode">'+
        [['default','旧設定どおり'],['same-tab','同じタブ'],['new-tab','新しいタブ'],['new-window','新しいウィンドウを要求']]
        .map(([val,label])=>'<option value="'+val+'" '+((obj.openMode||'default')===val?'selected':'')+'>'+label+'</option>').join('')+'</select></label>' +
        '<label>ウィンドウ横幅 <input type="number" data-rl-field="popupWidth" min="250" max="1800" value="'+E(obj.popupWidth||760)+'"></label>' +
        '<label>高さ <input type="number" data-rl-field="popupHeight" min="250" max="1800" value="'+E(obj.popupHeight||650)+'"></label></div>' +
        '<div class="rl-shortcut-editor"><span>ショートカット: <strong data-rl-key-text>'+E(this._formatShortcut(obj.shortcutKey))+'</strong></span>' +
        '<button type="button" data-rl-record="'+index+'">変更</button>' +
        '<button type="button" data-rl-key-clear="'+index+'">解除</button>' +
        '<span class="rl-shortcut-warning" data-rl-shortcut-warning></span></div>' +
        '<button type="button" class="rl-variables-toggle" data-rl-variables-toggle="'+index+'" aria-expanded="'+(variablesShown?'true':'false')+'">'+
        '｛ ｝ 変数を挿入 '+(variablesShown?'▴':'▾')+'</button>' +
        '<div class="rl-variables" data-rl-variables-panel '+(variablesShown?'':'hidden')+'>'+variableButtons+
        '<small class="rl-help">使える8種類の変数は、動画ID・視聴ID・動画URL・タイトル・ユーザーID・チャンネルID・投稿者名・現在時刻（秒）です。' +
        'クリックするとURLのカーソル位置に挿入します。取得できない値が必要なリンクは無効になります。</small></div>' +
        '<div class="rl-help">URLプレビュー（サンプル値）</div><code class="rl-preview" data-rl-preview></code>' +
        '<p class="rl-no-owner" data-rl-no-owner></p>' +
        '<p class="rl-error" data-rl-error role="status"></p>' +
        '</div></article>';
    }).join('');
    this.container.innerHTML =
      '<section class="zenzaRelatedLinksEditor" aria-label="関連メニュー カスタムリンク編集">' +
      '<h3>関連メニュー › カスタムリンク</h3>' +
      '<p class="rl-help">カスタムリンクの詳細編集です。URLに {videoId} のような変数を入れると動画ごとに自動で置き換わります。' +
      '「編集」→「｛ ｝変数を挿入」で全8種類と説明を開けます。ショートカットは他のキーと共有するため、重複すると警告します。' +
      '外部Userscriptから登録したアクションの動作は変更できません。</p>' +
      '<div data-rl-rows>'+rows+'</div>' +
      '<div class="rl-toolbar"><span data-rl-count></span>' +
      '<button type="button" data-rl-add>＋ リンクを追加</button>' +
      '<button type="button" data-rl-add-copy>＋ コピー項目を追加</button>' +
      '<button type="button" data-rl-cancel '+(this.embedded?'hidden':'')+'>変更を破棄</button>' +
      '<button type="button" class="rl-save" data-rl-save '+(this.embedded?'hidden':'')+'>変更を保存</button>' +
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
      const isCopy=this.actions.isCopy(item);
      card.querySelectorAll('[data-rl-copy-fields]').forEach(el=>{el.hidden=!isCopy;});
      card.querySelectorAll('[data-rl-link-fields]').forEach(el=>{el.hidden=isCopy;});
      card.querySelectorAll('.rl-flags [data-rl-field]').forEach(el=>{
        if(el.dataset.rlField!=='enabled'){el.closest('label').hidden=isCopy;}
      });
      const popupMode=!isCopy && item.openMode==='new-window';
      card.querySelectorAll('[data-rl-field="popupWidth"],[data-rl-field="popupHeight"]')
        .forEach(control=>{control.disabled=!popupMode;});
      card.querySelector('[data-rl-summary]').textContent=item.label || 'リンク '+(index+1);
      card.querySelector('[data-rl-summary-status]').textContent=
        (item.enabled===false?'無効':'有効')+' ・ '+this._formatShortcut(item.shortcutKey);
      const label=card.querySelector('[data-rl-key-text]');
      label.textContent=this._formatShortcut(item.shortcutKey);
      const key=Number(item.shortcutKey)||0;
      const sameLinks=this.draft.filter((other,i)=>i!==index &&
        other && Number(other.shortcutKey)===key).map(other=>other.label||other.id);
      const ordinary=(this.shortcuts.actions||[]).filter(action=>
        Number(typeof this.getDraftShortcutValue==='function' ?
          this.getDraftShortcutValue('KEY_'+action.id) :
          this.config.props?.['KEY_'+action.id])===key)
        .map(action=>action.label||action.id);
      const liveConflicts=key && typeof this.getDraftShortcutConflicts==='function'?
        this.getDraftShortcutConflicts(key):null;
      const warning=key && (liveConflicts?liveConflicts.length>1:
        sameLinks.length || ordinary.length) ?
        '⚠ ショートカットが重複: '+(liveConflicts||sameLinks.concat(ordinary)).join('、')+
        '（割り当ては自動で解除しません）' : '';
      card.querySelector('[data-rl-shortcut-warning]').textContent=warning;
      card.querySelector('[data-rl-shortcut-summary-warning]').textContent=warning ? '⚠ キー重複' : '';
      const preview=card.querySelector('[data-rl-preview]');
      const noOwnerView=card.querySelector('[data-rl-no-owner]');
      const err=card.querySelector('[data-rl-error]');
      const resolved=isCopy?this.actions.resolveCopy(item.copyTemplate,sample):
        this.actions.resolveUrl(item.url,sample);
      preview.textContent=(isCopy?resolved.text:resolved.url) || 'プレビューできません（内容・変数を確認）';
      const missing=isCopy?this.actions.resolveCopy(item.copyTemplate,noOwner):
        this.actions.resolveUrl(item.url,noOwner);
      const ownerDependent=(missing.missing||[]).some(name=>
        ['uploaderUserId','uploaderChannelId','uploaderName'].includes(name));
      noOwnerView.textContent=ownerDependent ?
        '投稿者情報を取得できない動画では、このリンクは無効になります。' : '';
      err.textContent=invalid[index];
      card.querySelector('[data-rl-error-summary]').textContent=invalid[index] ? '⚠ 入力内容を確認' : '';
    });
    const count=this.container.querySelector('[data-rl-count]');
    count.textContent=this.draft.length+' / 40 件';
    this.container.querySelectorAll('[data-rl-add],[data-rl-add-copy]').forEach(button=>{
      button.disabled=this.draft.length>=40 || this.original===null;
    });
    this.container.querySelector('[data-rl-cancel]').disabled=!this._dirty() && !this.externalChanged;
    this.container.querySelector('[data-rl-save]').disabled=
      !this._dirty() || !validation.valid || invalid.some(Boolean) || this.original===null;
    const status=this.container.querySelector('[data-rl-status]');
    if (this.embedded && this.onDraftChange && this.original !== null) {
      // Clone even invalid rows: validation at the global Save must reject
      // the entire draft instead of dropping malformed rows silently.
      this.onDraftChange(this.draft.map(item =>
        item && typeof item === 'object' && !Array.isArray(item) ? {...item} : item));
    }
    if(this._detailId!==undefined){this.showDetail(this._detailId);}
    status.textContent=this.externalChanged ?
      '別の画面で設定が更新されました。変更を破棄して再読み込みしてください。' :
      this.message || (!validation.valid ? 'URL・ID・表示名などの入力エラーがあります。保存前に修正してください。' :
      this._dirty() ? '未保存の変更があります。' : '');
  }

  _onField(e) {
    if(e.target.hasAttribute('data-rl-copy-preset')){
      const presets={id:'{videoId}',url:'{videoUrl}',title:'{videoTitle}',
        'title-url':'{videoTitle}\n{videoUrl}'};
      const value=presets[e.target.value],card=e.target.closest('[data-rl-row]');
      if(value && card){
        const index=Number(card.dataset.rlRow);
        this.draft=this.draft.map((item,i)=>i===index?{...item,copyTemplate:value}:item);
        card.querySelector('[data-rl-field="copyTemplate"]').value=value;
        this._refresh();
      }
      return;
    }
    const field=e.target.dataset && e.target.dataset.rlField;
    if (!field) { return; }
    const card=e.target.closest('[data-rl-row]');
    if (!card || !this.container.contains(card)) { return; }
    const index=Number(card.dataset.rlRow);
    const item=this.draft[index];
    const value=e.target.type==='checkbox' ? e.target.checked :
      e.target.type==='number'?Number(e.target.value):e.target.value;
    if (field==='id' && item && typeof item.id==='string') {
      if (this.expandedIds.delete(item.id)) { this.expandedIds.add(value); }
      if (this.variablesOpen.delete(item.id)) { this.variablesOpen.add(value); }
    }
    this.draft=this.draft.map((entry,i)=>i===index?Object.assign({},entry,{[field]:value},
      field==='kind'&&value==='copy'&&!entry.copyTemplate?{copyTemplate:'{videoId}'}:{}):entry);
    if(field==='id' && this._detailId===item?.id){this._detailId=value;}
    this.message='';
    this._refresh();
  }

  showList() {
    this._detailId=undefined;
    this.container.hidden=false;
    this.container.classList.remove('is-detail-only');
    this.container.querySelectorAll('[data-rl-row]').forEach((card,index)=>{
      card.hidden=false;
      const key=this._rowKey(this.draft[index],index);
      card.querySelector('[data-rl-details]').hidden=!this.expandedIds.has(key);
    });
  }
  showDetail(id) {
    this._detailId=id;
    this.container.classList.add('is-detail-only');
    this.container.querySelectorAll('[data-rl-row]').forEach((card,index)=>{
      card.hidden=this.draft[index]?.id!==id;
      if(!card.hidden){card.querySelector('[data-rl-details]').hidden=false;}
    });
  }
  addItem(kind='link') {
    if(this.draft.length>=40 || this.original===null){return null;}
    const id=this._uniqueId(kind==='copy'?'copy':'link');
    const item=kind==='copy'?{id,label:'動画IDをコピー',kind:'copy',copyTemplate:'{videoId}',enabled:true}:
      {id,label:'',url:'',enabled:true,openInNewTab:true};
    this.draft=this.draft.concat([item]);this.expandedIds.add(id);
    if(this._detailId!==undefined){this._detailId=id;}
    this.message='';this._render();return id;
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
    const field=this.actions.isCopy(this.draft[index])?'copyTemplate':'url';
    const input=card.querySelector('[data-rl-field="'+field+'"]');
    const token='{'+name+'}';
    const start=typeof input.selectionStart==='number'?input.selectionStart:input.value.length;
    const end=typeof input.selectionEnd==='number'?input.selectionEnd:start;
    input.setRangeText(token,start,end,'end');
    this.draft=this.draft.map((item,i)=>i===index?
      Object.assign({},item,{[field]:input.value}):item);
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

  _onConfigUpdate(key: string) {
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
    if (button.hasAttribute('data-rl-add')) { this.addItem('link');return; }
    if (button.hasAttribute('data-rl-add-copy')) { this.addItem('copy');return; }
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

  _clearDragVisuals() {
    this._dragFrom=null;
    this._dragAfter=false;
    this.container.querySelectorAll('.rl-is-dragging,.rl-drop-target,.rl-drop-before,.rl-drop-after')
      .forEach(card=>card.classList.remove(
        'rl-is-dragging','rl-drop-target','rl-drop-before','rl-drop-after'));
  }

  _onGripKeyDown(e) {
    const grip=e.target.closest?.('[data-rl-drag]');
    if (!grip || !e.altKey || !['ArrowUp','ArrowDown'].includes(e.key)) { return; }
    const from=Number(grip.dataset.rlDrag);
    const to=from+(e.key==='ArrowUp'?-1:1);
    if (to<0 || to>=this.draft.length) { return; }
    e.preventDefault();
    const next=this.draft.slice();
    next.splice(to,0,next.splice(from,1)[0]);
    this.draft=next;
    this.message='移動しました。下部の保存で確定します。';
    this._render();
    this.container.querySelector('[data-rl-drag="'+to+'"]')?.focus();
  }

  _onDragStart(e) {
    const grip=e.target.closest && e.target.closest('[data-rl-drag]');
    if (!grip || !this.container.contains(grip)) { return; }
    const from=Number(grip.dataset.rlDrag);
    if (!Number.isInteger(from) || from<0 || from>=this.draft.length) { return; }
    this._dragFrom=from;
    this.container.querySelector('[data-rl-row="'+from+'"]')
      ?.classList.add('rl-is-dragging');
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
    const rect=card.getBoundingClientRect();
    this._dragAfter=rect.height>0 ?
      e.clientY>rect.top+rect.height/2 : this._dragFrom<Number(card.dataset.rlRow);
    this.container.querySelectorAll('.rl-drop-target,.rl-drop-before,.rl-drop-after')
      .forEach(node=>node.classList.remove('rl-drop-target','rl-drop-before','rl-drop-after'));
    card.classList.add('rl-drop-target',this._dragAfter?'rl-drop-after':'rl-drop-before');
  }

  _onDrop(e) {
    if (this._dragFrom===null) { return; }
    const card=e.target.closest && e.target.closest('[data-rl-row]');
    if (!card || !this.container.contains(card)) { return; }
    e.preventDefault();
    const from=this._dragFrom;
    const to=Number(card.dataset.rlRow);
    const after=this._dragAfter;
    this._clearDragVisuals();
    if (!Number.isInteger(to) || to<0 || to>=this.draft.length) { return; }
    const insertion=to+(after?1:0);
    const destination=from<insertion?insertion-1:insertion;
    if (from===destination) { return; }
    const next=this.draft.slice();
    next.splice(destination,0,next.splice(from,1)[0]);
    this.draft=next;
    this.message='並び順を変更しました。変更を保存すると確定します。';
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
    this.container.removeEventListener('keydown',this._handleGripKeyDown);
    if (typeof this.config.off==='function') {
      this.config.off('update',this._handleConfigUpdate);
    }
    this.container.replaceChildren();
  }
}
//===END===
export {RelatedMenuSettings};
