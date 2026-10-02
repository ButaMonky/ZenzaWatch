import {HistoryError} from './core.mjs';
import {SETTINGS_SCHEMA, normalizeSettings} from './settings.mjs';

const ZENZA_SETTINGS_NAMES = new Set(SETTINGS_SCHEMA.map(d=>d.name));
const ZENZA_SETTINGS_KEYS = new Set(SETTINGS_SCHEMA.map(d=>d.key));
const ZENZA_SETTINGS_EVENT = 'comment-history-settings';
function settingsError(code) { return new HistoryError(code); }
function checkedSettingNames(names) {
  if (!Array.isArray(names) || names.some(n=>!ZENZA_SETTINGS_NAMES.has(n)) || new Set(names).size!==names.length) throw settingsError('OPTION');
  return names;
}

/** Validated, feature-only persistence. Never calls Config.import or resets unrelated keys.
 * Storage is a synchronous Storage-shaped adapter (getItem/setItem/removeItem).
 * Bus is injected: subscribe(handler)->unsubscribe; publish({type,keys}).
 * A browser/Config bridge is still required; this class alone is NOT cross-tab integration.
 * Multi-key localStorage writes are not atomic. Rollback is best-effort and never knowingly
 * replaces a newer value written by another context. Failure details expose machine codes only.
 */
export class ZenzaSettingsRepository {
  #storage; #prefix; #bus; #off; #last; #disposed=false; #listeners=new Set();
  constructor({storage,prefix='ZenzaWatch_',bus} = {}) {
    if (!storage || ['getItem','setItem','removeItem'].some(k=>typeof storage[k]!=='function') ||
        typeof prefix!=='string' || !prefix || bus && ['publish','subscribe'].some(k=>typeof bus[k]!=='function')) throw settingsError('OPTION');
    this.#storage=storage;this.#prefix=prefix;this.#bus=bus;
    this.#last=this.#read().values;
    if (bus) this.#off=bus.subscribe(message=>{
      if (this.#disposed || message?.type!==ZENZA_SETTINGS_EVENT || !Array.isArray(message.keys) ||
          !message.keys.length || message.keys.some(k=>!ZENZA_SETTINGS_KEYS.has(k))) return;
      // Incoming values are never trusted or re-saved. Read one complete validated snapshot.
      try { this.refresh(); } catch { /* Caller sees validation failure on next explicit get/start. */ }
    });
  }
  #assertActive() { if(this.#disposed)throw settingsError('DISPOSED'); }
  #read() {
    this.#assertActive();
    const input={},raw=new Map();
    for(const d of SETTINGS_SCHEMA) {
      let value;
      try {value=this.#storage.getItem(this.#prefix+d.key);} catch {throw settingsError('SETTINGS_READ');}
      raw.set(d.name,value);
      if(value!==null && value!==undefined) {
        try {input[d.name]=JSON.parse(value);} catch {throw settingsError('SETTINGS_INVALID');}
      }
    }
    let values;
    try {values=Object.freeze(normalizeSettings(input));} catch {throw settingsError('SETTINGS_INVALID');}
    return {values,raw};
  }
  #accept(values) {
    const changed=SETTINGS_SCHEMA.some(d=>values[d.name]!==this.#last[d.name]);
    this.#last=values;
    if(changed)for(const callback of [...this.#listeners]) {
      try {callback(values);} catch { /* A UI failure must not reinterpret successful persistence. */ }
    }
  }
  get() {return this.#read().values;}
  refresh() {const values=this.get();this.#accept(values);return values;}
  patch(changes) {
    this.#assertActive();
    if(!changes || typeof changes!=='object' || Array.isArray(changes))throw settingsError('OPTION');
    checkedSettingNames(Object.keys(changes));
    const before=this.#read();
    const next=Object.freeze(normalizeSettings({...before.values,...changes}));
    const entries=SETTINGS_SCHEMA.filter(d=>Object.hasOwn(changes,d.name)&&before.values[d.name]!==next[d.name])
      .map(d=>({name:d.name,key:this.#prefix+d.key,publicKey:d.key,value:JSON.stringify(next[d.name]),previous:before.raw.get(d.name)}));
    if(!entries.length){this.#accept(next);return next;}
    const attempted=[];
    let committed;
    try {
      for(const entry of entries) {
        if(this.#storage.getItem(entry.key)!==entry.previous)throw settingsError('SETTINGS_CONFLICT');
        attempted.push(entry);
        this.#storage.setItem(entry.key,entry.value);
      }
      for(const entry of entries)if(this.#storage.getItem(entry.key)!==entry.value)throw settingsError('SETTINGS_WRITE');
      committed=this.#read().values;
    } catch {
      let rollbackComplete=true;
      for(const entry of attempted.reverse()) {
        try {
          const current=this.#storage.getItem(entry.key);
          if(current===entry.previous)continue;
          if(current!==entry.value){rollbackComplete=false;continue;}
          if(entry.previous===null || entry.previous===undefined)this.#storage.removeItem(entry.key);
          else this.#storage.setItem(entry.key,entry.previous);
          if(this.#storage.getItem(entry.key)!==(entry.previous??null))rollbackComplete=false;
        } catch {rollbackComplete=false;}
      }
      const error=settingsError('SETTINGS_WRITE');error.rollbackComplete=rollbackComplete;throw error;
    }
    this.#accept(committed);
    try {this.#bus?.publish({type:ZENZA_SETTINGS_EVENT,keys:entries.map(e=>e.publicKey)});} catch { /* Storage succeeded; next explicit refresh reconciles. */ }
    return committed;
  }
  reset(names=SETTINGS_SCHEMA.map(d=>d.name)) {
    checkedSettingNames(names);
    return this.patch(Object.fromEntries(SETTINGS_SCHEMA.filter(d=>names.includes(d.name)).map(d=>[d.name,d.default])));
  }
  subscribe(callback) {
    this.#assertActive();if(typeof callback!=='function')throw settingsError('OPTION');
    this.#listeners.add(callback);return()=>this.#listeners.delete(callback);
  }
  dispose() {
    if(this.#disposed)return;this.#disposed=true;this.#listeners.clear();
    if(typeof this.#off==='function')this.#off();this.#off=null;
  }
}
