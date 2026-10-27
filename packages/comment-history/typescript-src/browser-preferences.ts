import {SETTINGS_SCHEMA,DEFAULT_SETTINGS} from './settings.mjs';
import {ZenzaSettingsRepository} from './zenza-settings.mjs';
import {HistoryError} from './core.mjs';
import type {CommentIncreaseSettings} from './settings.mjs';

export interface BrowserHistorySnapshot {
  valid: boolean;
  enabled: boolean;
  settings: Readonly<CommentIncreaseSettings>;
  error?: 'SETTINGS_INVALID';
}
export interface BrowserHistoryConfig {
  default?: Record<string, unknown>;
  _data?: Record<string, unknown>;
  emit?: (...args: unknown[]) => unknown;
  emitAsync?: (...args: unknown[]) => unknown;
}
export interface BrowserHistoryOptions {
  window?: Window & typeof globalThis;
  config?: BrowserHistoryConfig;
  storage?: Storage;
}
export interface BrowserHistoryPreferences {
  get(): BrowserHistorySnapshot;
  patch(changes: Partial<CommentIncreaseSettings>): BrowserHistorySnapshot;
  setEnabled(enabled: boolean): BrowserHistorySnapshot;
  subscribe(fn: (snapshot: BrowserHistorySnapshot)=>void): ()=>boolean;
  dispose(): void;
}

// Fetch step ("追加する件数"). Task207 adds 7,500 and 15,000; the 20,000 total maximum is unchanged.
export const HISTORY_PRESETS=Object.freeze([1000,2500,5000,7500,10000,15000,20000]);
// Task207: applied additional count ("適用する件数"). 0 = normal comments only while ON (not OFF).
export const APPLIED_PRESETS=Object.freeze([0,...HISTORY_PRESETS]);
export const HISTORY_PREFERENCE_DEFAULTS=Object.freeze({...Object.fromEntries(SETTINGS_SCHEMA.map(d=>[d.key,d.default])),'commentHistory.enabled':false});
const EVENT='ZenzaWatch-comment-history-settings';

/** Same-page events and cross-tab StorageEvents carry keys only. No comment data or keys. */
export function createBrowserHistoryPreferences({window:win=globalThis.window,config,storage=win.localStorage}: BrowserHistoryOptions={}): BrowserHistoryPreferences{
  const prefix='ZenzaWatch_',enabledKey=prefix+'commentHistory.enabled';
  const listeners=new Set<(snapshot: BrowserHistorySnapshot)=>void>();let repository: ZenzaSettingsRepository | null | undefined,disposed=false,lastSignature='',snapshot!: BrowserHistorySnapshot;
  function checked(){if(disposed)throw new HistoryError('DISPOSED');}
  function read(): BrowserHistorySnapshot{
    checked();
    try{
      if(!repository)repository=new ZenzaSettingsRepository({storage,prefix});
      const settings=repository.get(),raw=storage.getItem(enabledKey);
      const enabled=raw===null?false:JSON.parse(raw);
      if(typeof enabled!=='boolean')throw new Error('type');
      return Object.freeze({valid:true,enabled,settings});
    }catch{return Object.freeze({valid:false,enabled:false,settings:Object.freeze({...DEFAULT_SETTINGS}),error:'SETTINGS_INVALID'});}
  }
  function refresh(): BrowserHistorySnapshot{
    snapshot=read();const signature=JSON.stringify(snapshot);
    if(signature===lastSignature)return snapshot;
    lastSignature=signature;
    // Config remains the existing export/import source of truth in memory. Only these
    // validated feature keys are adopted; incoming events must never write storage again.
    if(snapshot.valid&&config?._data){
      const values={...Object.fromEntries(SETTINGS_SCHEMA.map(d=>[d.key,snapshot.settings[d.name]])),'commentHistory.enabled':snapshot.enabled};
      for(const [key,value] of Object.entries(values)){
        if(config.default&&!Object.hasOwn(config.default,key))continue;
        if(config._data[key]===value)continue;
        config._data[key]=value;
        const emit=typeof config.emitAsync==='function'?config.emitAsync:config.emit;
        if(typeof emit==='function'){emit.call(config,'update',key,value);emit.call(config,'update-'+key,value);}
      }
    }
    for(const fn of [...listeners]){try{fn(snapshot);}catch{}}
    return snapshot;
  }
  function publish(keys: string[]){win.dispatchEvent(new win.CustomEvent(EVENT,{detail:{keys}}));}
  const onStorage=(e: StorageEvent)=>{if(!disposed&&(e.key===null||typeof e.key==='string'&&e.key.startsWith(prefix+'commentHistory.'))&&(!e.storageArea||e.storageArea===storage))refresh();};
  const onLocal=(e: CustomEvent<{keys?: string[]}> )=>{if(!disposed&&Array.isArray(e.detail?.keys)&&e.detail.keys.every(k=>Object.hasOwn(HISTORY_PREFERENCE_DEFAULTS,k)))refresh();};
  win.addEventListener('storage',onStorage);win.addEventListener(EVENT,onLocal as EventListener);refresh();
  return {
    get(){checked();return refresh();},
    patch(changes: Partial<CommentIncreaseSettings>){
      checked();if(!refresh().valid)throw new HistoryError('SETTINGS_INVALID');
      repository!.patch(changes);refresh();publish(Object.keys(changes).map(k=>'commentHistory.'+k));return snapshot;
    },
    setEnabled(enabled: boolean){
      checked();if(typeof enabled!=='boolean')throw new HistoryError('OPTION');
      if(!refresh().valid)throw new HistoryError('SETTINGS_INVALID');
      if(snapshot.enabled===enabled)return snapshot;
      const before=storage.getItem(enabledKey),serialized=JSON.stringify(enabled);
      try{storage.setItem(enabledKey,serialized);if(storage.getItem(enabledKey)!==serialized)throw new Error();}
      catch{
        try{if(storage.getItem(enabledKey)===serialized){before===null?storage.removeItem(enabledKey):storage.setItem(enabledKey,before);}}catch{}
        throw new HistoryError('SETTINGS_WRITE');
      }
      refresh();publish(['commentHistory.enabled']);return snapshot;
    },
    subscribe(fn: (snapshot: BrowserHistorySnapshot)=>void){checked();listeners.add(fn);return()=>listeners.delete(fn);},
    dispose(){if(disposed)return;disposed=true;win.removeEventListener('storage',onStorage);win.removeEventListener(EVENT,onLocal as EventListener);repository?.dispose();repository=null;listeners.clear();}
  };
}
