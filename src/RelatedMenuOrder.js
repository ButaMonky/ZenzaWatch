// Task318: one stable display order for built-in, custom and registered menu entries.
// Missing external actions remain in saved order and reactivate on registration.
//===BEGIN===
class RelatedMenuOrder {
  static get CONFIG_KEY() { return 'relatedMenu.order'; }
  static get HIDDEN_KEY() { return 'relatedMenu.hiddenItems'; }
  static get OPTIONS_KEY() { return 'relatedMenu.builtinOptions'; }
  // Standard entries reuse exactly the same persisted KEY_* as the shortcut editor.
  static get SHORTCUT_ACTION_IDS() {
    return Object.freeze({
      official:'OPEN_GINZA',ad:'OPEN_NICOAD',twitter:'OPEN_TWITTER_HASH',
      original:'OPEN_ORIGINAL_VIDEO',tree:'OPEN_PARENT_VIDEO',
      'tree-playlist':'PLAYLIST_SET_COMMONS_TREE','copy-url':'COPY_WATCH_URL'
    });
  }
  static get OPEN_MODES() { return ['default','same-tab','new-tab','new-window']; }
  static get COPY_FORMATS() { return ['url','id','position','title-url','markdown']; }
  static formatCopy(format,context={}) {
    const id=String(context.videoId||context.watchId||'');
    const watchId=String(context.watchId||id);
    const url=String(context.videoUrl||(watchId?'https://www.nicovideo.jp/watch/'+watchId:''));
    const title=String(context.videoTitle||'').trim();
    if(format==='id'){return id;}
    if(format==='position'){
      const seconds=Number(context.currentTime);
      if(!url || !Number.isFinite(seconds) || seconds<=0){return url;}
      const separator=url.includes('?')?'&':'?';
      return url+separator+'from='+Math.floor(seconds);
    }
    if(format==='title-url'){return title?title+'\n'+url:url;}
    if(format==='markdown'){
      const safeTitle=(title||id).replace(/[\[\]\\]/g,'\\$&');
      return '['+safeTitle+']('+url+')';
    }
    return url;
  }
  // The menu and the keyboard share the same browser-opening contract.
  static openUrl(id,url,option={},opener) {
    if(!url || typeof opener!=='function'){return;}
    const mode=option.openMode||'default';
    if(mode==='same-tab'){return opener(url,'_self');}
    if(mode==='new-tab'){return opener(url,'_blank','noopener,noreferrer');}
    if(mode==='new-window'){
      const dimension=(key,fallback)=>Number.isInteger(option[key]) &&
        option[key]>=250 && option[key]<=1800?option[key]:fallback;
      const width=dimension('popupWidth',id==='ad'?428:760);
      const height=dimension('popupHeight',id==='ad'?600:650);
      return opener(url,'_blank','noopener,noreferrer,width='+width+
        ',height='+height+',scrollbars=yes');
    }
    if(id==='ad'){return opener(url,'','width=428, height=600, toolbar=no, scrollbars=1');}
    if(id==='official'){return opener(url,'_blank','noopener');}
    return opener(url);
  }
  static getOption(options,id) {
    return options && typeof options==='object' && !Array.isArray(options) &&
      options[id] && typeof options[id]==='object' && !Array.isArray(options[id]) ?
      options[id] : {};
  }
  static validateOptions(value) {
    if (!value || typeof value!=='object' || Array.isArray(value)) {return false;}
    const allowedIds=new Set(this.STANDARD.map(item=>item.id));
    const allowedFields=new Set(['label','openMode','popupWidth','popupHeight',
      'copyFormat','urlTemplate','includePosition']);
    for(const [id,option] of Object.entries(value)){
      if(!allowedIds.has(id) || !option || typeof option!=='object' || Array.isArray(option) ||
        Object.keys(option).some(k=>!allowedFields.has(k))){return false;}
      if(option.label!==undefined && (typeof option.label!=='string' ||
        !option.label.trim() || option.label.trim().length>80)){return false;}
      if(option.openMode!==undefined && !this.OPEN_MODES.includes(option.openMode)){return false;}
      for(const size of ['popupWidth','popupHeight']){
        if(option[size]!==undefined && (!Number.isInteger(option[size]) ||
          option[size]<250 || option[size]>1800)){return false;}
      }
      if(option.includePosition!==undefined && typeof option.includePosition!=='boolean'){return false;}
      if(option.copyFormat!==undefined && (id!=='copy-url' ||
        !this.COPY_FORMATS.includes(option.copyFormat))){return false;}
      if(option.urlTemplate!==undefined){
        if(!['twitter','tree'].includes(id) || typeof option.urlTemplate!=='string' ||
          option.urlTemplate.length>2048){return false;}
        if(option.urlTemplate){
          if(!/^https:\/\//i.test(option.urlTemplate) || /[\r\n\t]/.test(option.urlTemplate)){return false;}
          const vars=new Set(['videoId','watchId','videoUrl','videoTitle',
            'uploaderUserId','uploaderChannelId','uploaderName','currentTime']);
          const tokens=option.urlTemplate.match(/\{([^{}]*)\}/g)||[];
          if(tokens.some(token=>!vars.has(token.slice(1,-1))) ||
            /[{}]/.test(option.urlTemplate.replace(/\{[^{}]*\}/g,''))){return false;}
          try{
            const sample=option.urlTemplate.replace(/\{[^{}]*\}/g,'sample');
            const url=new URL(sample);
            if(url.protocol!=='https:' || !url.hostname || url.username || url.password){return false;}
          }catch(_){return false;}
        }
      }
    }
    return true;
  }
  static get STANDARD() {
    return [
      {id:'official',label:'公式プレイヤーで開く'},
      {id:'ad',label:'ニコニ広告で宣伝'},
      {id:'twitter',label:'X（Twitter）の反応を見る'},
      {id:'original',label:'元動画を開く'},
      {id:'tree',label:'親作品・コンテンツツリー'},
      {id:'tree-playlist',label:'親作品・子作品をプレイリストに追加'},
      {id:'copy-url',label:'動画URLをコピー'}
    ];
  }
  static isValidKey(key) {
    if (typeof key !== 'string' || key.length > 96) { return false; }
    if (key.startsWith('builtin:')) {
      return this.STANDARD.some(item=>key==='builtin:'+item.id);
    }
    return /^(?:link|action):[a-z0-9][a-z0-9._:-]{0,63}$/i.test(key);
  }
  static validateOrder(value) {
    return Array.isArray(value) && value.length<=256 &&
      value.every(key=>this.isValidKey(key)) &&
      new Set(value).size===value.length;
  }
  static validateHiddenItems(value) { return this.validateOrder(value); }
  static isHidden(key, hiddenItems) {
    return this.validateHiddenItems(hiddenItems) && hiddenItems.includes(key);
  }
  static entries(links=[], actions=[], savedOrder=[]) {
    const items=this.STANDARD.map(item=>({
      key:'builtin:'+item.id,label:item.label,type:'builtin',present:true
    }));
    for (const link of Array.isArray(links)?links:[]) {
      if (!link || !this.isValidKey('link:'+link.id)) { continue; }
      if (items.some(item=>item.key==='link:'+link.id)) { continue; }
      items.push({key:'link:'+link.id,label:String(link.label||link.id||'無題'),
        type:'link',present:true,enabled:link.enabled!==false});
    }
    for (const action of Array.isArray(actions)?actions:[]) {
      if (!action || !this.isValidKey('action:'+action.id)) { continue; }
      if (items.some(item=>item.key==='action:'+action.id)) { continue; }
      items.push({key:'action:'+action.id,label:String(action.label||action.id),
        type:'action',present:true});
    }
    const ordered=this.validateOrder(savedOrder)?savedOrder:[];
    const known=new Map(items.map(item=>[item.key,item]));
    const missing=ordered.filter(key=>!known.has(key)).map(key=>({
      key,label:key.startsWith('action:')?'未登録アクション: '+key.slice(7):
        '存在しないリンク: '+key.slice(5),
      type:key.startsWith('action:')?'action':'link',present:false
    }));
    const all=new Map(items.concat(missing).map(item=>[item.key,item]));
    const keys=[...ordered,...items.map(item=>item.key)].filter((key,index,array)=>
      array.indexOf(key)===index && all.has(key));
    return keys.map(key=>all.get(key));
  }
  static orderedKeys(savedOrder, actualKeys) {
    const all=[...new Set(actualKeys.filter(key=>this.isValidKey(key)))];
    const present=new Set(all);
    const order=this.validateOrder(savedOrder)?savedOrder:[];
    return [...order.filter(key=>present.has(key)),
      ...all.filter(key=>!order.includes(key))];
  }
}
//===END===
export {RelatedMenuOrder};
