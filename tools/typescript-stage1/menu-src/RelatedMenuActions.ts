// Custom links are persistent data; callable actions are registered by trusted
// userscripts only. No string evaluation or script injection is supported.
// Task572: independent typed canonical source for trusted related-menu actions.
// Emission is subject to exact original runtime JavaScript AST parity.
export interface RelatedMenuActionContext {
  videoId?: string;
  watchId?: string;
  videoUrl?: string;
  videoTitle?: string;
  uploaderUserId?: string;
  uploaderChannelId?: string;
  uploaderName?: string;
  currentTime?: string | number;
  [key: string]: unknown;
}
export interface RelatedMenuActionLink {
  id: string;
  label: string;
  kind?: 'link' | 'copy';
  enabled?: boolean;
  url?: string;
  copyTemplate?: string;
  shortcutKey?: number;
  openInNewTab?: boolean;
  openMode?: 'default'|'same-tab'|'new-tab'|'new-window';
  popupWidth?: number;
  popupHeight?: number;
}
export interface RelatedMenuVideoInfo {
  videoId?: unknown;
  watchId?: unknown;
  title?: unknown;
  owner?: {type?: string; id?: string|number; name?: string} | null;
}
export interface RelatedMenuTrustedAction {
  id: string;
  label: string;
  action: (context: RelatedMenuActionContext)=>unknown;
  available?: (context: RelatedMenuActionContext)=>boolean;
}
//===BEGIN===
class RelatedMenuActions {
  declare static __actions: Map<string,RelatedMenuTrustedAction> | undefined;
  declare static __listeners: Set<()=>void> | undefined;
  static get CONFIG_KEY() { return 'relatedMenu.customLinks'; }
  static get VARIABLES() {
    return ['videoId', 'watchId', 'videoUrl', 'videoTitle',
      'uploaderUserId', 'uploaderChannelId', 'uploaderName', 'currentTime'];
  }
  static get _actions() {
    if (!this.__actions) { this.__actions = new Map(); }
    return this.__actions;
  }
  static get _listeners() {
    if (!this.__listeners) { this.__listeners = new Set(); }
    return this.__listeners;
  }
  static _notify() {
    for (const listener of this._listeners) {
      try { listener(); } catch (_) { /* one observer must not break the others */ }
    }
  }
  static onChange(listener: ()=>void): ()=>boolean {
    if (typeof listener !== 'function') { throw new TypeError('listener must be a function'); }
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }
  static _safeId(id: unknown): id is string {
    return typeof id === 'string' && /^[a-z0-9][a-z0-9._:-]{0,63}$/i.test(id);
  }
  static _validateUrlTemplate(template: unknown): template is string {
    if (typeof template !== 'string' || !template.startsWith('http') ||
      template.length > 2048 || /[\r\n\t]/.test(template)) { return false; }
    const tokens = template.match(/\{[^{}]*\}/g) || [];
    if (tokens.some(token => !this.VARIABLES.includes(token.slice(1, -1)))) { return false; }
    if (/[{}]/.test(template.replace(/\{[^{}]*\}/g, ''))) { return false; }
    const sample = Object.fromEntries(this.VARIABLES.map(key => [key, 'sample']));
    return !!this.resolveUrl(template, sample).url;
  }
  static isCopy(item: {kind?: unknown} | null | undefined): boolean { return item?.kind==='copy'; }
  static validateCopyTemplate(template: unknown): template is string {
    if(typeof template!=='string' || !template.trim() || template.length>4096 ||
      /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(template)){return false;}
    const tokens=template.match(/\{[^{}]*\}/g)||[];
    return tokens.every(token=>this.VARIABLES.includes(token.slice(1,-1))) &&
      !/[{}]/.test(template.replace(/\{[^{}]*\}/g,''));
  }
  static resolveCopy(template: unknown,context: Record<string,unknown>={}): {text:string|null;missing:string[];invalid?:string[]} {
    if(!this.validateCopyTemplate(template)){return {text:null,missing:[],invalid:['template']};}
    const missing: string[]=[];
    const text=template.replace(/\{([^{}]+)\}/g,(_,key)=>{
      const value=context[key];
      if(value===undefined || value===null || String(value)===''){missing.push(key);return '';}
      return String(value);
    });
    return {text:missing.length || text.length>16384?null:text,missing};
  }
  static validateLinks(input: unknown): {valid:boolean;errors:string[];links:RelatedMenuActionLink[]} {
    const errors = [];
    if (!Array.isArray(input)) {
      return {valid: false, errors: ['Expected an array of links'], links: []};
    }
    if (input.length > 40) { errors.push('Maximum 40 links'); }
    const links: RelatedMenuActionLink[] = [];
    const ids = new Set<string>();
    input.slice(0, 40).forEach((item, index) => {
      if (!item || typeof item !== 'object' || Array.isArray(item) ||
          !this._safeId(item.id) || ids.has(item.id) ||
          typeof item.label !== 'string' || !item.label.trim() ||
          item.label.length > 80 ||
          (item.kind!==undefined && !['link','copy'].includes(item.kind)) ||
          (this.isCopy(item)?!this.validateCopyTemplate(item.copyTemplate):!this._validateUrlTemplate(item.url)) ||
          (item.enabled !== undefined && typeof item.enabled !== 'boolean') ||
          (item.openInNewTab !== undefined && typeof item.openInNewTab !== 'boolean') ||
          (item.openMode !== undefined && !['default','same-tab','new-tab','new-window'].includes(item.openMode)) ||
          (item.popupWidth !== undefined && (!Number.isInteger(item.popupWidth) || item.popupWidth<250 || item.popupWidth>1800)) ||
          (item.popupHeight !== undefined && (!Number.isInteger(item.popupHeight) || item.popupHeight<250 || item.popupHeight>1800)) ||
          (item.shortcutKey !== undefined &&
            (!Number.isSafeInteger(item.shortcutKey) || item.shortcutKey < 0 ||
            item.shortcutKey >= 90000000))) {
        errors.push('Invalid custom link at index ' + index);
        return;
      }
      ids.add(item.id);
      const link: RelatedMenuActionLink = this.isCopy(item)?{
        id:item.id,label:item.label.trim(),kind:'copy',copyTemplate:item.copyTemplate,
        enabled:item.enabled!==false
      }:{
        id: item.id, label: item.label.trim(), url: item.url,
        enabled: item.enabled !== false,
        openInNewTab: item.openInNewTab !== false
      };
      if(!this.isCopy(item)){
        if(item.openMode && item.openMode!=='default'){link.openMode=item.openMode;}
        if(item.popupWidth!==undefined){link.popupWidth=item.popupWidth;}
        if(item.popupHeight!==undefined){link.popupHeight=item.popupHeight;}
      }
      if (item.shortcutKey > 0) { link.shortcutKey = item.shortcutKey; }
      links.push(link);
    });
    return {valid: errors.length === 0, errors, links};
  }
  static getLinks(input: unknown): RelatedMenuActionLink[] { return this.validateLinks(input).links; }
  static openShortcutsByIds(input: unknown, ids: unknown,
    context: Record<string,unknown>,
    opener?: (url:string,target?:string,popup?:string)=>unknown,
    copier?: (text:string)=>void|Promise<unknown>): number {
    if (!Array.isArray(ids) || typeof opener !== 'function') { return 0; }
    const selected = new Set(ids);
    const items=this.getLinks(input).filter(item=>item.enabled && selected.has(item.id));
    const copies=items.filter(item=>this.isCopy(item))
      .map(item=>this.resolveCopy(item.copyTemplate,context).text).filter(text=>text!==null);
    let copyCount=0;
    // One clipboard write avoids last-writer races for a shared shortcut.
    // Run before a same-tab navigation; rendering never invokes the copier.
    if(copies.length && typeof copier==='function'){
      try{
        const result=copier(copies.join('\n'));
        if(result && typeof result.catch==='function'){result.catch(()=>{});}
        copyCount=copies.length;
      }catch(_){ /* A denied clipboard must not prevent independent links. */ }
    }
    const resolved = items.filter(item=>!this.isCopy(item))
      .map(item => ({item, value: this.resolveUrl(item.url, context)}))
      .filter(entry => !!entry.value.url);
    // One browser tab cannot navigate to multiple URLs. Keep the final _self
    // entry in the current tab and open all remaining links separately.
    let currentTabIndex = -1;
    resolved.forEach((entry, i) => {
      if (entry.item.openMode==='same-tab' ||
        (!entry.item.openMode && !entry.item.openInNewTab)) { currentTabIndex = i; }
    });
    const safeOpen = (url: string, target: string, item: RelatedMenuActionLink) => {
      const popup=item?.openMode==='new-window' ?
        'noopener,noreferrer,width='+(item.popupWidth||760)+',height='+(item.popupHeight||650) : undefined;
      try { opener(url,target,popup); } catch (_) { /* one failed tab must not block others */ }
    };
    resolved.forEach((entry, i) => {
      if (i !== currentTabIndex) { safeOpen(entry.value.url!, '_blank',entry.item); }
    });
    if (currentTabIndex >= 0) {
      safeOpen(resolved[currentTabIndex].value.url!, '_self',resolved[currentTabIndex].item);
    }
    return resolved.length+copyCount;
  }
  static makeContext(videoInfo: RelatedMenuVideoInfo|null|undefined, currentTime: unknown = 0): Readonly<RelatedMenuActionContext> {
    if (!videoInfo || typeof videoInfo !== 'object') { return Object.freeze({}); }
    let owner;
    try { owner = videoInfo.owner || {}; } catch (_) { owner = {}; }
    const validVideoId = (value: unknown): string => {
      const text = value == null ? '' : String(value);
      return /^(?:sm|nm|so|ss)?[0-9]+$/.test(text) ? text : '';
    };
    const videoId = validVideoId(videoInfo.videoId);
    const watchId = validVideoId(videoInfo.watchId);
    const user = owner.type === 'user';
    const channel = owner.type === 'channel';
    const id = (typeof owner.id === 'number' || typeof owner.id === 'string') &&
      String(owner.id).trim() && String(owner.id) !== '0' ?
        String(owner.id).trim() : '';
    const sec = Number(currentTime);
    return Object.freeze({
      videoId, watchId,
      videoUrl: watchId ? 'https://www.nicovideo.jp/watch/' + watchId : '',
      videoTitle: typeof videoInfo.title === 'string' ? videoInfo.title : '',
      uploaderUserId: user ? id : '',
      uploaderChannelId: channel ? id : '',
      uploaderName: user || channel ? (typeof owner.name === 'string' ? owner.name : '') : '',
      currentTime: Number.isFinite(sec) && sec >= 0 ? String(Math.floor(sec)) : '0'
    });
  }
  static resolveUrl(template: unknown, context: Record<string,unknown> = {}): {url:string|null;missing:string[];invalid?:string[]} {
    if (typeof template !== 'string') { return {url: null, missing: []}; }
    const missing: string[] = [];
    const invalid: string[] = [];
    const expanded = template.replace(/\{([^{}]+)\}/g, (_, name) => {
      if (!this.VARIABLES.includes(name)) {
        invalid.push(name);
        return '';
      }
      const value = context[name];
      if (value === undefined || value === null || String(value) === '') {
        missing.push(name);
        return '';
      }
      return encodeURIComponent(String(value));
    });
    if (invalid.length || missing.length || /[{}]/.test(expanded)) {
      return {url: null, missing, invalid};
    }
    try {
      const url = new URL(expanded);
      if (!['https:', 'http:'].includes(url.protocol) || !url.hostname ||
          url.username || url.password || url.href.length > 4096) {
        return {url: null, missing, invalid: ['unsafe URL']};
      }
      return {url: url.href, missing: [], invalid: []};
    } catch (_) {
      return {url: null, missing, invalid: ['invalid URL']};
    }
  }
  static register({id, label, action, available}: Partial<RelatedMenuTrustedAction> = {}): ()=>void {
    if (!this._safeId(id) || typeof label !== 'string' ||
        !label.trim() || label.length > 80 || typeof action !== 'function' ||
        (available !== undefined && typeof available !== 'function')) {
      throw new TypeError('Invalid related-menu action registration');
    }
    if (this._actions.has(id)) { throw new Error('Action already registered: ' + id); }
    const entry = Object.freeze({id, label: label.trim(), action, available});
    this._actions.set(id, entry);
    this._notify();
    return () => {
      if (this._actions.get(id) === entry) { this.unregister(id); }
    };
  }
  static unregister(id: string): boolean {
    const removed = this._actions.delete(id);
    if (removed) { this._notify(); }
    return removed;
  }
  static getActions(context: RelatedMenuActionContext): Array<{id:string;label:string;enabled:boolean}> {
    return [...this._actions.values()].map(item => {
      let enabled = true;
      if (item.available) {
        try { enabled = !!item.available(context); } catch (_) { enabled = false; }
      }
      return {id: item.id, label: item.label, enabled};
    });
  }
  static invoke(id: string, context: RelatedMenuActionContext): boolean {
    const entry = this._actions.get(id);
    if (!entry || !this.getActions(context).some(item => item.id === id && item.enabled)) {
      return false;
    }
    try {
      const result = entry.action(context) as {catch?: (handler:()=>void)=>unknown} | null | undefined;
      if (result && typeof result.catch === 'function') {
        result.catch(() => console.warn('Related-menu custom action failed:', id));
      }
      return true;
    } catch (_) {
      console.warn('Related-menu custom action failed:', id);
      return false;
    }
  }
}
//===END===
export {RelatedMenuActions};
