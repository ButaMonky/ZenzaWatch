// Custom links are persistent data; callable actions are registered by trusted
// userscripts only. No string evaluation or script injection is supported.
//===BEGIN===
class RelatedMenuActions {
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
  static onChange(listener) {
    if (typeof listener !== 'function') { throw new TypeError('listener must be a function'); }
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }
  static _safeId(id) {
    return typeof id === 'string' && /^[a-z0-9][a-z0-9._:-]{0,63}$/i.test(id);
  }
  static _validateUrlTemplate(template) {
    if (typeof template !== 'string' || !template.startsWith('http') ||
      template.length > 2048 || /[\r\n\t]/.test(template)) { return false; }
    const tokens = template.match(/\{[^{}]*\}/g) || [];
    if (tokens.some(token => !this.VARIABLES.includes(token.slice(1, -1)))) { return false; }
    if (/[{}]/.test(template.replace(/\{[^{}]*\}/g, ''))) { return false; }
    const sample = Object.fromEntries(this.VARIABLES.map(key => [key, 'sample']));
    return !!this.resolveUrl(template, sample).url;
  }
  static validateLinks(input) {
    const errors = [];
    if (!Array.isArray(input)) {
      return {valid: false, errors: ['Expected an array of links'], links: []};
    }
    if (input.length > 40) { errors.push('Maximum 40 links'); }
    const links = [];
    const ids = new Set();
    input.slice(0, 40).forEach((item, index) => {
      if (!item || typeof item !== 'object' || Array.isArray(item) ||
          !this._safeId(item.id) || ids.has(item.id) ||
          typeof item.label !== 'string' || !item.label.trim() ||
          item.label.length > 80 ||
          !this._validateUrlTemplate(item.url) ||
          (item.enabled !== undefined && typeof item.enabled !== 'boolean') ||
          (item.openInNewTab !== undefined && typeof item.openInNewTab !== 'boolean')) {
        errors.push('Invalid custom link at index ' + index);
        return;
      }
      ids.add(item.id);
      links.push({
        id: item.id, label: item.label.trim(), url: item.url,
        enabled: item.enabled !== false,
        openInNewTab: item.openInNewTab !== false
      });
    });
    return {valid: errors.length === 0, errors, links};
  }
  static getLinks(input) { return this.validateLinks(input).links; }
  static makeContext(videoInfo, currentTime = 0) {
    if (!videoInfo || typeof videoInfo !== 'object') { return Object.freeze({}); }
    let owner;
    try { owner = videoInfo.owner || {}; } catch (_) { owner = {}; }
    const validVideoId = value => {
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
  static resolveUrl(template, context = {}) {
    if (typeof template !== 'string') { return {url: null, missing: []}; }
    const missing = [];
    const invalid = [];
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
  static register({id, label, action, available} = {}) {
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
  static unregister(id) {
    const removed = this._actions.delete(id);
    if (removed) { this._notify(); }
    return removed;
  }
  static getActions(context) {
    return [...this._actions.values()].map(item => {
      let enabled = true;
      if (item.available) {
        try { enabled = !!item.available(context); } catch (_) { enabled = false; }
      }
      return {id: item.id, label: item.label, enabled};
    });
  }
  static invoke(id, context) {
    const entry = this._actions.get(id);
    if (!entry || !this.getActions(context).some(item => item.id === id && item.enabled)) {
      return false;
    }
    try {
      const result = entry.action(context);
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
