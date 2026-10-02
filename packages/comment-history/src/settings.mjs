import {HistoryError,integerOption,fail} from './core.mjs';

/** Stable setting identities: reused by the right-bottom panel and advanced-settings adapters.
 * No document selectors, localStorage, Zenza Config, or UI lifecycle dependencies here.
 * minIntervalMs and bounds are CLIENT safeguards, not claims about server rate limits.
 */
export const SETTINGS_SCHEMA=Object.freeze([
  {name:'maxAdditionalComments',label:'追加コメント上限',type:'integer',default:5000,min:1,max:20000},
  {name:'maxPages',label:'履歴ページ上限',type:'integer',default:100,min:1,max:100},
  {name:'maxRequests',label:'総リクエスト上限（再試行・キー更新を含む）',type:'integer',default:150,min:1,max:200},
  {name:'minIntervalMs',label:'通信の最小間隔（ミリ秒）',type:'integer',default:1500,min:1500,max:60000},
  {name:'requestTimeoutMs',label:'通信タイムアウト（ミリ秒）',type:'integer',default:10000,min:1000,max:30000},
  {name:'maxElapsedMs',label:'取得全体の時間上限（ミリ秒）',type:'integer',default:300000,min:1000,max:300000},
  {name:'maxRetries',label:'一操作ごとの再試行上限',type:'integer',default:2,min:0,max:3},
  {name:'maxKeyRefreshes',label:'キー更新の総上限',type:'integer',default:1,min:0,max:2},
  {name:'includeEasy',label:'かんたんコメントも追加取得',type:'boolean',default:false},
].map(d=>Object.freeze({...d,key:`commentHistory.${d.name}`})));
export const DEFAULT_SETTINGS=Object.freeze(Object.fromEntries(SETTINGS_SCHEMA.map(d=>[d.name,d.default])));
export function normalizeSettings(input={}){
  if(!input || typeof input!=='object' || Array.isArray(input))fail('OPTION');
  const names=new Set(SETTINGS_SCHEMA.map(d=>d.name));
  if(Object.keys(input).some(k=>!names.has(k)))fail('OPTION');
  const values={...DEFAULT_SETTINGS,...input};
  for(const d of SETTINGS_SCHEMA){
    if(d.type==='boolean'){if(typeof values[d.name]!=='boolean')fail('OPTION');}
    else integerOption(values[d.name],d.min,d.max);
  }
  return values;
}
/** Synchronous storage adapter. Invalid/future envelopes are rejected without writes.
 * Read afresh on patch so two UI views do not overwrite one another's stale snapshots.
 */
export class SettingsStore {
  #read;#write;
  constructor({read,write}){
    if(typeof read!=='function'||typeof write!=='function')fail('OPTION');
    this.#read=read;this.#write=write;
  }
  get(){
    const saved=this.#read();
    if(saved===null||saved===undefined)return normalizeSettings();
    if(saved.schema!=='nico-comment-history-settings'||saved.version!==1)throw new HistoryError('SETTINGS_VERSION');
    if(!saved.values||typeof saved.values!=='object'||Array.isArray(saved.values))fail('OPTION');
    return normalizeSettings(saved.values);
  }
  patch(changes){
    if(!changes||typeof changes!=='object'||Array.isArray(changes))fail('OPTION');
    const values=normalizeSettings({...this.get(),...changes});
    this.#write({schema:'nico-comment-history-settings',version:1,values:{...values}});
    return values;
  }
}
