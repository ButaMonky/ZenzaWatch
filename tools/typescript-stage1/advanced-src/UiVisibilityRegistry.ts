// Task318: single manifest for optional UI visibility, icons and safe selectors.
// Keep accessibility-critical recovery controls out of this registry.
export type UiVisibilityScope = 'hover'|'related'|'comment'|'bar'|'scene'|'info'|'header';
export interface UiVisibilityDescriptor {
  key: string;
  scope: UiVisibilityScope;
  label: string;
  icon: string;
  selector: string;
  description?: string;
  hidden?: boolean;
}
export interface UiVisibilityConfig {
  resolveSceneSearch?(): {enabled:boolean}|null;
  props?: Record<string, unknown>;
  default?: Record<string, unknown>;
  storage?: Storage | Record<string, string | undefined>;
  getValue?(key: string): unknown;
  onkey?(key: string, listener: () => void): unknown;
  offkey?(key: string, listener: () => void): unknown;
  getStorageKey?(key: string): string;
  refresh?(key: string, fallback?: Record<string, string | undefined>): unknown;
  emit?(event: string, ...args: unknown[]): unknown;
  emitAsync?(event: string, ...args: unknown[]): unknown;
}
export interface UiVisibilityCallbacks {
  beforeHide?(entry: UiVisibilityDescriptor, node: HTMLElement): void;
  afterApply?(entry: UiVisibilityDescriptor, visible: boolean): void;
}
export interface UiVisibilityConnection {
  refresh(): void;
  apply(key: string): number;
  dispose(): void;
}
type SavedVisibility = {value: string;priority: string;hidden: boolean | 'until-found'};
// The shortcut registry already supplies key definitions and the formatter at runtime.
// Keep the presentation source typed without duplicating its key-code conversion.
interface TooltipShortcutAction {id: string;command: string;defaultKey: number}
declare const SHORTCUT_ACTIONS: readonly TooltipShortcutAction[];
declare const formatKeyCombo: (code: number) => string;
//===BEGIN===
class UiVisibilityRegistry {
  declare static __items: readonly UiVisibilityDescriptor[] | undefined;
  declare static __byKey: Map<string, UiVisibilityDescriptor> | undefined;
  declare static __savedDisplay: WeakMap<HTMLElement, SavedVisibility> | undefined;
  static get SHARED_SETTINGS(): Array<[string, string]> {
    return [
      ['showComment','comments-video'],['enableCommentPanel','comments-list'],
      ['enableCommentPreview','comments-preview'],['enableHeatMap','comment-heatmap'],
      ['enableStoryboard','seek-thumbnail'],['enableStoryboardBar','scene-filmstrip'],
      ['enableAdDecoration','ad-crown'],
      ['sceneSearch.enabled','seek-thumbnail'],['sceneSearch.commentPreviewVisible','comments-preview'],
      ['sceneSearch.miniCommentVisible','comments-video'],['sceneSearch.commentListVisible','comments-list']
    ];
  }
  static get ITEMS(): readonly UiVisibilityDescriptor[] {
    if(this.__items){return this.__items;}
    return this.__items=Object.freeze(([
      {key:'ui.hover.like',scope:'hover',label:'いいねボタン',icon:'♡',selector:'.toggleLikeButton'},
      {key:'ui.hover.tweet',scope:'hover',label:'ツイート（X共有）ボタン',icon:'t',selector:'.zenzaTweetButton'},
      {key:'ui.hover.mylist',scope:'hover',label:'マイリスト登録',icon:'My',selector:'.mylistButton.mylistAddMenu'},
      {key:'ui.hover.watchLater',scope:'hover',label:'あとで見る',icon:'✚',selector:'.mylistButton.deflistAdd'},
      {key:'ui.hover.comments',scope:'hover',label:'コメント表示切替',icon:'💬',selector:'.showCommentSwitch'},
      {key:'ui.hover.ngFilter',scope:'hover',label:'NGフィルター切替',icon:'shield-ng',selector:'.ngFilterSwitch'},
      {key:'ui.relatedMenu',scope:'related',label:'関連メニュー',icon:'related-menu',selector:'.RelatedInfoMenu',
        description:'動画上部と動画情報パネルの2か所を一括で切り替えます。登録したリンクは削除しません。'},
      {key:'ui.commentInput',scope:'comment',label:'コメント入力欄',icon:'comment-input',selector:'.commentInputPanel',
        description:'コメント入力・コマンド・送信ボタンをまとめて隠します。コメント表示とショートカットはそのままです。'},
      {key:'ui.bar.previous',scope:'bar',label:'前の動画ボタン',icon:'⇤',selector:'.prevVideo'},
      {key:'ui.bar.next',scope:'bar',label:'次の動画ボタン',icon:'⇥',selector:'.nextVideo'},
      {key:'ui.bar.storyboard',scope:'bar',label:'シーンサーチの切替ボタン',icon:'▤',selector:'.toggleStoryboard'},
      {key:'ui.bar.loop',scope:'bar',label:'ループボタン',icon:'↻',selector:'.loopSwitch'},
      {key:'ui.bar.seekTop',scope:'bar',label:'動画の先頭へ戻るボタン',icon:'⇤',selector:'.seekTop'},
      {key:'ui.bar.speed',scope:'bar',label:'再生速度メニュー',icon:'1.0×',selector:'.playbackRateMenu'},
      {key:'ui.bar.time',scope:'bar',label:'再生時間の表示',icon:'1:23',selector:'.videoTime'},
      {key:'ui.bar.mute',scope:'bar',label:'ミュートボタン',icon:'🔊',selector:'.muteSwitch'},
      {key:'ui.bar.volume',scope:'bar',label:'音量スライダー',icon:'━●',selector:'.volumeControl'},
      {key:'ui.bar.history',scope:'bar',label:'コメント増量ボタン',icon:'▤',selector:'.commentHistorySwitch'},
      {key:'ui.bar.notificationHistory',scope:'bar',label:'通知・エラー履歴を開くボタン',icon:'🔔',selector:'.notificationHistorySwitch',
        description:'プレイヤー左下のhls横にある通知履歴ボタンを表示・非表示にします。履歴データは消去せず、設定したショートカットは引き続き使えます。'},
      {key:'ui.bar.filter',scope:'bar',label:'画面フィルターボタン',icon:'filter-sparkle',selector:'.screenFilterSwitch'},
      {key:'ui.bar.quality',scope:'bar',label:'画質・動画サーバー選択',icon:'画',selector:'.videoServerTypeMenu'},
      {key:'ui.bar.screenMode',scope:'bar',label:'画面サイズ・モード選択',icon:'⛶',selector:'.screenModeMenu'},
      {key:'ui.bar.pin',scope:'bar',label:'操作バーの表示モード選択',icon:'📌',selector:'.fullscreenControlBarModeMenu'},
      {key:'ui.bar.fullscreen',scope:'bar',label:'フルスクリーン切替ボタン',icon:'⛶',selector:'.fullscreenSwitch',
        description:'画面の切替ボタンを隠します。通常のFキーで全画面を切り替えられます。上級者設定のこの画面から再表示できます。'},
      {key:'ui.bar.settings',scope:'bar',label:'プレイヤー設定（歯車）ボタン',icon:'⚙',selector:'.settingPanelSwitch',
        description:'プレイヤー内の歯車を隠します。再表示するにはニコニコのマイページ（/my）のZenzaWatch上級者設定から戻してください。'},
      // SCUI-07: Scene-search controls have their own visibility scope.
      // Hiding a button changes appearance only, never disables its command.
      {key:'ui.scene.panel',scope:'scene',hidden:true,label:'シーンサーチのプレビュー枠',
        icon:'▣',selector:'.zenzaSceneSearchHost'},
      {key:'ui.scene.pin',scope:'scene',hidden:true,label:'シーンサーチのピン固定ボタン',
        icon:'📌',selector:'.zenzaSceneSearchPin, .zenzaSceneSearchHost [data-scui-action="pin"]'},
      {key:'ui.scene.seekArrows',scope:'scene',label:'シーンサーチの前後矢印',
        icon:'↔',selector:'.zenzaSceneSeekStepControl [data-scui="back"], .zenzaSceneSeekStepControl [data-scui="forward"], .zenzaSceneSearchHost [data-scui-action="seek-back"], .zenzaSceneSearchHost [data-scui-action="seek-forward"]'},
      {key:'ui.scene.seekSeconds',scope:'scene',hidden:true,label:'シーンサーチの移動秒数ボタン',
        icon:'5s',selector:'.zenzaSceneSeekStepControl [data-scui="open"], .zenzaSceneSearchHost [data-scui-action="seek-step"]'},
      {key:'ui.scene.commentToggle',scope:'scene',label:'シーンサーチのコメント表示切替ボタン',
        icon:'💬',selector:'.zenzaSceneCommentToggle, .zenzaSceneSearchHost [data-scui-action="comment-toggle"]'},
      {key:'ui.scene.commentSearch',scope:'scene',label:'シーンサーチのコメント検索ボタン',
        icon:'⌕',selector:'.zenzaSceneCommentSearchToggle, .zenzaSceneSearchHost [data-scui-action="comment-search"]'},
      {key:'ui.scene.more',scope:'scene',hidden:true,label:'シーンサーチの操作メニュー展開ボタン',
        icon:'⋯',selector:'.zenzaSceneSearchMore, .zenzaSceneSearchHost [data-scui-action="more"]'},
      {key:'ui.info.owner',scope:'info',label:'投稿者情報',icon:'👤',selector:'.videoOwnerInfoContainer'},
      {key:'ui.info.description',scope:'info',label:'動画説明文',icon:'≡',selector:'.videoDescription'},
      {key:'ui.info.series',scope:'info',label:'シリーズ情報',icon:'▤',selector:'.seriesList'},
      {key:'ui.info.tags',scope:'info',label:'動画情報のタグ一覧',icon:'#',selector:'.videoTagsContainer.sideTab'},
      {key:'ui.info.credits',scope:'info',label:'ニコニ広告関連情報',icon:'広告',selector:'.uaaContainer'},
      {key:'ui.info.likeThanks',scope:'info',label:'いいねのお礼メッセージ',icon:'♥',selector:'.likeMessageContainer'},
      {key:'ui.info.metadata',scope:'info',label:'動画の再生数などの情報',icon:'ℹ',selector:'.videoMetaInfoContainer'},
      {key:'ui.info.relatedTab',scope:'info',label:'関連動画タブ',icon:'▶',selector:'.tabSelect.relatedVideoTab, .tabs.relatedVideoTab',
        description:'関連動画タブを隠した場合、開いていた内容は動画情報タブへ戻ります。'},
      {key:'ui.header.title',scope:'header',label:'動画タイトル（上部）',icon:'T',selector:'.videoTitleContainer'},
      {key:'ui.header.tags',scope:'header',label:'上部のタグ一覧',icon:'#',selector:'.videoTagsContainer.videoHeader'},
      {key:'ui.header.metadata',scope:'header',label:'上部の動画情報',icon:'ℹ',selector:'.videoMetaInfoContainer'},
      {key:'ui.header.series',scope:'header',label:'上部のシリーズ画像',icon:'▧',selector:'.series-thumbnail-cover'},
      {key:'ui.header.search',scope:'header',label:'動画検索ウィンドウ',icon:'⌕',selector:'.zenzaVideoSearchPanel',
        description:'上部の動画検索欄・候補一覧を隠します。検索文字は削除されません。ニコニコのマイページ（/my）の上級者設定から再表示できます。'}
    ] as UiVisibilityDescriptor[]).map(item=>Object.freeze(item)));
  }
  static get _byKey(): Map<string, UiVisibilityDescriptor> {
    if(!this.__byKey){this.__byKey=new Map(this.ITEMS.map(item=>[item.key,item]));}
    return this.__byKey;
  }
  static get(key: string) { return this._byKey.get(key)||null; }
  static list(scope: string) { return this.ITEMS.filter(item=>item.scope===scope); }
  static defaults() { return Object.fromEntries(this.ITEMS.map(item=>[item.key,true])); }
  static isVisibilityKey(key: string): boolean { return !!this.get(key); }
  static descriptors() {
    return this.ITEMS.map(item=>({
      id:item.key,label:item.label+'を表示',category:'画面・映像',
      subcategory:'表示・非表示',type:'boolean',
      icon:item.icon,visibilityScope:item.scope,hidden:item.hidden===true,
      description:item.description||'画面上の表示のみ切り替えます。機能・操作コマンド自体は削除しません。'
    }));
  }
  static get _savedDisplay(): WeakMap<HTMLElement, SavedVisibility> {
    if(!this.__savedDisplay){this.__savedDisplay=new WeakMap();}
    return this.__savedDisplay;
  }
  static apply(config: UiVisibilityConfig,root: HTMLElement,key: string,{beforeHide,afterApply}: UiVisibilityCallbacks={}): number {
    const entry=this.get(key);
    if(!entry || !root || !config){return 0;}
    // The semantic preview controller owns the root's hidden state (idle/pin/
    // parent visibility). Do not restore an obsolete panel snapshot over it.
    if(key==='ui.scene.panel'&&root.matches?.('.zenzaSceneSharedPreview'))return 0;
    const read=(k: string)=>typeof config.getValue==='function'?config.getValue(k):config.props?.[k];
    const sceneEnabled=entry.scope!=='scene'||(config.resolveSceneSearch?.()?.enabled??read('sceneSearch.enabled')!==false);
    const visible=(entry.scope!=='scene'||sceneEnabled)&&
      (key==='ui.scene.panel'&&(typeof config.resolveSceneSearch==='function'||read('sceneSearch.enabled')!==undefined)?sceneEnabled:read(key)!==false);
    const nodes: HTMLElement[]=[];
    if(root.matches?.(entry.selector)){nodes.push(root);}
    root.querySelectorAll?.<HTMLElement>(entry.selector).forEach(node=>nodes.push(node));
    let changed=0;
    for(const node of nodes){
      const saved=this._savedDisplay.get(node);
      if(!visible && !saved){
        beforeHide?.(entry,node);
        this._savedDisplay.set(node,{
          value:node.style.getPropertyValue('display'),
          priority:node.style.getPropertyPriority('display'),
          hidden:node.hidden
        });
        node.hidden=true;
        node.style.setProperty('display','none','important');
        changed++;
      }else if(!visible && saved && (node.hidden!==true ||
        node.style.getPropertyValue('display')!=='none' ||
        node.style.getPropertyPriority('display')!=='important')){
        // The current layout may redraw a hidden control: preserve its original
        // restoration snapshot but enforce the user's visibility setting again.
        node.hidden=true;
        node.style.setProperty('display','none','important');
        changed++;
      }else if(visible && saved){
        if(saved.value){node.style.setProperty('display',saved.value,saved.priority);}
        else{node.style.removeProperty('display');}
        node.hidden=saved.hidden;
        this._savedDisplay.delete(node);
        changed++;
      }
    }
    if(changed){afterApply?.(entry,visible);}
    return changed;
  }
  /**
   * Textual shortcut hints are derived from the same KEY_* values used by
   * ShortcutKeyEmitter. Zero/unbound keys deliberately have no parentheses.
   * Also fixes the hover opacity cascade without changing button idle fade.
   */
  static connectShortcutTooltips(config: UiVisibilityConfig,root: HTMLElement,scope: string): () => void {
    if(scope!=='hover'&&scope!=='bar'){return ()=>{};}
    const actions=typeof SHORTCUT_ACTIONS!=='undefined'?SHORTCUT_ACTIONS:[];
    const format=typeof formatKeyCombo==='function'?formatKeyCombo:()=>'' as string;
    const selector=scope==='hover'?'.menuButton[data-command]':'.controlButton[data-command]';
    const aliases: Record<string,string>={
      'toggle-showComment':'TOGGLE_COMMENT',
      'toggle-enableFilter':'TOGGLE_NG_FILTER',
      'toggle-like':'TOGGLE_LIKE',
      'deflistAdd':'DEFLIST_ADD',
      'toggle-fullscreen':'FULLSCREEN',
      'fullscreen':'FULLSCREEN', // Actual toolbar command, not toggle-fullscreen.
      'toggle-mute':'MUTE',
      // The eye button toggles enableStoryboardBar; the thumbnail master
      // (TOGGLE_STORYBOARD) is a different shortcut and must not be shown.
      'toggleStoryboard':'TOGGLE_STORYBOARD_BAR',
      'seek':'HOME', // Toolbar seek-to-beginning only (data-param=0).
      'togglePlay':'TOGGLE_PLAY'
    };
    const bindings: Array<{tooltip: HTMLElement;base: string;actions: TooltipShortcutAction[]}>=[],
      multiHints: Array<{tooltip: HTMLElement;label: string;entries: Array<{id: string;verb: string}>}>=[],
      keys=new Set<string>();
    root.querySelectorAll<HTMLElement>(selector).forEach(button=>{
      const tooltip=button.querySelector<HTMLElement>('.tooltip');
      if(!tooltip){return;}
      const command=button.dataset.command||'';
      if(command==='seek' && button.dataset.param!=='0'){return;}
      const exact=actions.filter(a=>a.command===command);
      const assigned=aliases[command]?
        actions.filter(a=>a.id===aliases[command]):exact;
      if(!assigned.length){return;}
      // Task939: strip only the four historic hard-coded key suffixes.
      // Never strip explanatory text such as 画面フィルター（明るさ・色）.
      const base=(tooltip.textContent||'').replace(/\([MFVT]\)\s*$/,'').trim();
      bindings.push({tooltip,base,actions:assigned});
      for(const a of assigned){keys.add('KEY_'+a.id);}
    });
    // Task947: some toolbar controls expose multiple related keyboard actions
    // without having an equivalent data-command. Declare those hint groups once
    // rather than giving each control its own key formatting and subscriptions.
    if(scope==='bar'){
      const groups: Record<string,{label: string;entries: Array<{id: string;verb: string}>}>={
        volume:{label:'音量調整',entries:[{id:'VOL_UP',verb:'上げる'},{id:'VOL_DOWN',verb:'下げる'}]},
        speed:{label:'再生速度',entries:[{id:'SHIFT_UP',verb:'上げる'},{id:'SHIFT_DOWN',verb:'下げる'}]}
      };
      root.querySelectorAll<HTMLElement>('[data-shortcut-hint]').forEach(control=>{
        const group=groups[control.dataset.shortcutHint||''];
        const tooltip=control.querySelector<HTMLElement>('.tooltip');
        if(!group||!tooltip){return;}
        multiHints.push({tooltip,...group});
        for(const entry of group.entries){keys.add('KEY_'+entry.id);}
      });
    }
    const hintFor=(id: string):string=>{
      const value=Number(config.getValue?.('KEY_'+id) ?? config.props?.['KEY_'+id] ?? 0);
      if(!Number.isSafeInteger(value)||value<=0||value>=90000000){return '';}
      const hint=format(value);
      return hint&&!hint.startsWith('(')?hint:'';
    };
    const update=()=>{
      for(const item of bindings){
        const hint=item.actions.map(a=>hintFor(a.id)).find(Boolean)||'';
        item.tooltip.textContent=item.base+(hint?'（'+hint+'）':'');
      }
      for(const group of multiHints){
        const parts=group.entries.map(({id,verb})=>{
          const shortcut=hintFor(id);
          return shortcut?verb+': '+shortcut:'';
        }).filter(Boolean);
        group.tooltip.textContent=group.label+(parts.length?'（'+parts.join(' / ')+'）':'');
      }
    };
    for(const key of keys){config.onkey?.(key,update);}
    if(scope==='hover'&&bindings.length){
      const doc=root.ownerDocument;
      if(!doc.getElementById('zenzaHoverTooltipOpaque')){
        const style=doc.createElement('style');
        style.id='zenzaHoverTooltipOpaque';
        style.textContent=
          // Opacity must be opaque, but preserve each button's own color.
          // In particular, .zenzaTweetButton:hover must keep its blue background.
          '.hoverMenuContainer .menuButton:hover{opacity:1!important;}' +
          '.hoverMenuContainer .menuButton:hover .tooltip{' +
          'opacity:1!important;background:#fffbd2;color:#111;}';
        (doc.head||doc.documentElement).appendChild(style);
      }
    }
    update();
    return ()=>{for(const key of keys){config.offkey?.(key,update);}};
  }
  static connect(config: UiVisibilityConfig,root: HTMLElement,scope: string,callbacks: UiVisibilityCallbacks={}): UiVisibilityConnection {
    const items=this.list(scope);
    const disposeTooltips=this.connectShortcutTooltips(config,root,scope);
    const api={
      refresh:()=>items.forEach(item=>
        this.apply(config,root,item.key,callbacks)),
      apply:(key: string)=>{
        if(items.some(item=>item.key===key)){
          return this.apply(config,root,key,callbacks);
        }
        return 0;
      }
    } as UiVisibilityConnection;
    const subscriptions: Array<[string, () => void]>=[];
    if(items.some(item=>item.scope==='scene')){
      const listener=()=>api.refresh();config.onkey?.('sceneSearch.enabled',listener);
      subscriptions.push(['sceneSearch.enabled',listener]);
    }
    for(const item of items){
      const listener=()=>api.apply(item.key);
      config.onkey?.(item.key,listener);
      subscriptions.push([item.key,listener]);
    }
    // Advanced settings is a separate userscript with its own DataStorage.
    // Local onkey only observes this instance; sync saved UI preferences from
    // other tabs (storage) and from the separate panel in this tab (custom event).
    // RelatedInfoMenu already owns the equivalent listener for its own scope.
    const win=root.ownerDocument?.defaultView;
    let disposed=false;
    let onStorage: ((e: StorageEvent)=>void)|null=null,onAdvancedSave: ((e: Event)=>void)|null=null;
    if(scope!=='related' && win?.addEventListener &&
      typeof config.getStorageKey==='function' &&
      typeof config.refresh==='function') {
      // One control-bar owner forwards the shared settings and shortcut drafts
      // saved by the separate settings userscript. Reuse ordinary Config events;
      // no extra preference keys or localStorage writes are introduced.
      const shortcutKeys=Object.keys(config.default||{}).filter(key=>
        /^KEY_|^PARAM_CUSTOM_SEEK_\d+$/.test(key));
      const sharedKeys=new Set(scope==='bar'?
        [...this.SHARED_SETTINGS.map(([key])=>key),...shortcutKeys]:[]);
      const ownKeys=new Set([...items.map(item=>item.key),...sharedKeys]);
      const byStorageKey=new Map([...ownKeys].map(key=>[config.getStorageKey!(key),key]));
      const sync=(key: string,removed=false)=>{
        if(disposed || !ownKeys.has(key)){return;}
        const storageKey=config.getStorageKey!(key);
        // DataStorage.refresh leaves old data untouched when a key is deleted.
        // Read the documented default from an in-memory stand-in; do not write.
        const fallback=removed && config.storage?.[storageKey]===undefined &&
          Object.prototype.hasOwnProperty.call(config.default||{},key) ?
          {[storageKey]:JSON.stringify((config.default as Record<string,unknown>)[key])}:undefined;
        try{
          const previous=config.getValue!(key);
          Promise.resolve(config.refresh!(key,fallback))
            .then(()=>{
              if(disposed){return;}
              if(!sharedKeys.has(key)){api.apply(key);return;}
              const value=config.getValue!(key);
              const numeric=shortcutKeys.includes(key);
              const valid=numeric?(typeof value==='number' && Number.isFinite(value) &&
                (!key.startsWith('KEY_') || (Number.isSafeInteger(value)&&value>=0))):
                typeof value==='boolean';
              if(!valid || value===previous){return;}
              config.emit?.('change',new Map([[key,value]]));
              const emit=config.emitAsync?.bind(config)||config.emit?.bind(config);
              emit?.('update',key,value);
              emit?.('update-'+key,value);
            })
            .catch(()=>{}); // A blocked storage read must not break playback.
        }catch(_){ /* Navigation must continue on denied storage access. */ }
      };
      onStorage=e=>{
        if(e.storageArea && config.storage && e.storageArea!==config.storage){return;}
        const key=byStorageKey.get(e.key!);
        if(key){sync(key,e.newValue===null);}
      };
      onAdvancedSave=e=>{
        const keys=(Array.isArray((e as CustomEvent<{keys?:string[]}>).detail?.keys)?(e as CustomEvent<{keys?:string[]}>).detail.keys:[]) as string[];
        keys.forEach((key: string)=>sync(key));
      };
      win.addEventListener('storage',onStorage);
      win.addEventListener('ZenzaWatch-advanced-settings-saved',onAdvancedSave);
    }
    api.dispose=()=>{
      disposed=true;
      disposeTooltips();
      if(typeof config.offkey==='function'){
        for(const [key,listener] of subscriptions){config.offkey(key,listener);}
      }
      if(onStorage){win!.removeEventListener('storage',onStorage);}
      if(onAdvancedSave){
        win!.removeEventListener('ZenzaWatch-advanced-settings-saved',onAdvancedSave);
      }
      subscriptions.length=0;
    };
    api.refresh();
    return api;
  }
  static assertValidManifest() {
    const items=this.ITEMS;
    const keys=new Set();
    for(const item of items){
      if(!/^ui\.[a-z][a-zA-Z.]*$/.test(item.key) ||
        keys.has(item.key) || !item.scope || !item.label ||
        !item.icon || !item.selector){
        throw new Error('Invalid visibility entry: '+item.key);
      }
      keys.add(item.key);
    }
    return true;
  }
}
//===END===
export {UiVisibilityRegistry};
