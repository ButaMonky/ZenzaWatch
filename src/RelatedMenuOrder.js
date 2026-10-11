// Task318: one stable display order for built-in, custom and registered menu entries.
// Missing external actions remain in saved order and reactivate on registration.
//===BEGIN===
class RelatedMenuOrder {
  static get CONFIG_KEY() { return 'relatedMenu.order'; }
  static get HIDDEN_KEY() { return 'relatedMenu.hiddenItems'; }
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
