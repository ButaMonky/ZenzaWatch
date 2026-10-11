// Task318: single manifest for optional UI visibility, icons and safe selectors.
// Keep accessibility-critical recovery controls out of this registry.
//===BEGIN===
class UiVisibilityRegistry {
  static get SHARED_SETTINGS() {
    return [
      ['showComment','comments-video'],['enableCommentPanel','comments-list'],
      ['enableCommentPreview','comments-preview'],['enableHeatMap','comment-heatmap'],
      ['enableStoryboard','seek-thumbnail'],['enableStoryboardBar','scene-filmstrip'],
      ['enableAdDecoration','ad-crown']
    ];
  }
  static get ITEMS() {
    if(this.__items){return this.__items;}
    return this.__items=Object.freeze([
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
      {key:'ui.bar.filter',scope:'bar',label:'画面フィルターボタン',icon:'filter-sparkle',selector:'.screenFilterSwitch'},
      {key:'ui.bar.quality',scope:'bar',label:'画質・動画サーバー選択',icon:'画',selector:'.videoServerTypeMenu'},
      {key:'ui.bar.screenMode',scope:'bar',label:'画面サイズ・モード選択',icon:'⛶',selector:'.screenModeMenu'},
      {key:'ui.bar.pin',scope:'bar',label:'操作バーの表示モード選択',icon:'📌',selector:'.fullscreenControlBarModeMenu'},
      {key:'ui.bar.fullscreen',scope:'bar',label:'フルスクリーン切替ボタン',icon:'fullscreen-corners',selector:'.fullscreenSwitch',
        description:'画面の切替ボタンを隠します。通常のFキーで全画面を切り替えられます。上級者設定のこの画面から再表示できます。'},
      {key:'ui.bar.settings',scope:'bar',label:'プレイヤー設定（歯車）ボタン',icon:'settings-gear',selector:'.settingPanelSwitch',
        description:'プレイヤー内の歯車を隠します。再表示するにはニコニコのマイページ（/my）のZenzaWatch上級者設定から戻してください。'},
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
      {key:'ui.header.search',scope:'header',label:'動画検索ウィンドウ',icon:'search-magnifier',selector:'.zenzaVideoSearchPanel',
        description:'上部の動画検索欄・候補一覧を隠します。検索文字は削除されません。ニコニコのマイページ（/my）の上級者設定から再表示できます。'}
    ].map(item=>Object.freeze(item)));
  }
  static get _byKey() {
    if(!this.__byKey){this.__byKey=new Map(this.ITEMS.map(item=>[item.key,item]));}
    return this.__byKey;
  }
  static get(key) { return this._byKey.get(key)||null; }
  static list(scope) { return this.ITEMS.filter(item=>item.scope===scope); }
  static defaults() { return Object.fromEntries(this.ITEMS.map(item=>[item.key,true])); }
  static isVisibilityKey(key) { return !!this.get(key); }
  static descriptors() {
    return this.ITEMS.map(item=>({
      id:item.key,label:item.label+'を表示',category:'画面・映像',
      subcategory:'表示・非表示',type:'boolean',
      icon:item.icon,visibilityScope:item.scope,
      description:item.description||'画面上の表示のみ切り替えます。機能・操作コマンド自体は削除しません。'
    }));
  }
  static get _savedDisplay() {
    if(!this.__savedDisplay){this.__savedDisplay=new WeakMap();}
    return this.__savedDisplay;
  }
  static apply(config,root,key,{beforeHide,afterApply}={}) {
    const entry=this.get(key);
    if(!entry || !root || !config){return 0;}
    const visible=(typeof config.getValue==='function'?
      config.getValue(key):config.props?.[key])!==false;
    const nodes=[];
    if(root.matches?.(entry.selector)){nodes.push(root);}
    root.querySelectorAll?.(entry.selector).forEach(node=>nodes.push(node));
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
  static connect(config,root,scope,callbacks={}) {
    const items=this.list(scope);
    const api={
      refresh:()=>items.forEach(item=>
        this.apply(config,root,item.key,callbacks)),
      apply:key=>{
        if(items.some(item=>item.key===key)){
          return this.apply(config,root,key,callbacks);
        }
        return 0;
      }
    };
    const subscriptions=[];
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
    let onStorage=null,onAdvancedSave=null;
    if(scope!=='related' && win?.addEventListener &&
      typeof config.getStorageKey==='function' &&
      typeof config.refresh==='function') {
      // The single control-bar owner also refreshes the seven shared settings.
      // Their existing player consumers receive ordinary Config events, not
      // new visibility keys; no additional localStorage writes are performed.
      const sharedKeys=new Set(scope==='bar'?this.SHARED_SETTINGS.map(([key])=>key):[]);
      const ownKeys=new Set([...items.map(item=>item.key),...sharedKeys]);
      const byStorageKey=new Map([...ownKeys].map(key=>[config.getStorageKey(key),key]));
      const sync=(key,removed=false)=>{
        if(disposed || !ownKeys.has(key)){return;}
        const storageKey=config.getStorageKey(key);
        // DataStorage.refresh leaves old data untouched when a key is deleted.
        // Read the documented default from an in-memory stand-in; do not write.
        const fallback=removed && config.storage?.[storageKey]===undefined &&
          Object.prototype.hasOwnProperty.call(config.default||{},key) ?
          {[storageKey]:JSON.stringify(config.default[key])}:undefined;
        try{
          const previous=config.getValue(key);
          Promise.resolve(config.refresh(key,fallback))
            .then(()=>{
              if(disposed){return;}
              if(!sharedKeys.has(key)){api.apply(key);return;}
              const value=config.getValue(key);
              if(typeof value!=='boolean' || value===previous){return;}
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
        const key=byStorageKey.get(e.key);
        if(key){sync(key,e.newValue===null);}
      };
      onAdvancedSave=e=>{
        const keys=Array.isArray(e.detail?.keys)?e.detail.keys:[];
        keys.forEach(key=>sync(key));
      };
      win.addEventListener('storage',onStorage);
      win.addEventListener('ZenzaWatch-advanced-settings-saved',onAdvancedSave);
    }
    api.dispose=()=>{
      disposed=true;
      if(typeof config.offkey==='function'){
        for(const [key,listener] of subscriptions){config.offkey(key,listener);}
      }
      if(onStorage){win.removeEventListener('storage',onStorage);}
      if(onAdvancedSave){
        win.removeEventListener('ZenzaWatch-advanced-settings-saved',onAdvancedSave);
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
