// @ts-ignore Stage A location lacks product-relative Emitter; release mirror resolves it.
import {Emitter} from '../../../lib/src/Emitter';
// @ts-ignore Stage A location lacks product-relative textUtil; release mirror resolves it.
import {textUtil} from '../../../lib/src/text/textUtil';
// @ts-ignore Stage A location lacks product-relative Config; release mirror resolves it.
import {Config} from '../../../../src/Config';
// @ts-ignore Stage A location lacks product-relative NG rules; release mirror resolves it.
import {NgCompositeRules} from '../../../../src/NgCompositeRules';

// Task581: canonical TypeScript Stage A source for the legacy NG comment filter.
// This source is not yet connected to the live userscript build. Runtime is preserved.
export interface NicoChatFilterOptions {
  sharedNgLevel?: string;
  removeNgMatchedUser?: boolean;
  wordFilter?: string;
  userIdFilter?: string;
  commandFilter?: string;
  wordRegFilter?: string;
  wordRegFilterFlags?: string;
  compositeRules?: unknown;
  enableFilter?: boolean;
  fork0?: boolean;
  fork1?: boolean;
  fork2?: boolean;
  fork3?: boolean;
  defaultThread?: boolean;
  ownerThread?: boolean;
  communityThread?: boolean;
  nicosThread?: boolean;
  easyThread?: boolean;
  aiThread?: boolean;
  extraDefaultThread?: boolean;
  extraOwnerThread?: boolean;
  extraCommunityThread?: boolean;
  extraNicosThread?: boolean;
  extraEasyThread?: boolean;
}
export interface NicoFilterSourceChat {
  fork?: number;
  threadLabel?: string;
  userId?: string | number | null;
  text?: string;
  cmd?: string;
  score?: number;
  group?: NicoCompositeGroupNotifier;
  props?: Record<string, unknown> | null;
  [field: string]: unknown;
}
/** A normalized playable NicoChat row supplied to legacy filter predicates. */
export interface NicoFilterEvaluatedChat extends NicoFilterSourceChat {
  fork: number;
  score: number;
  text: string;
  cmd: string;
  type: string;
  vpos: number;
  userId: string;
  threadLabel: string;
}
export interface NicoFilterDiagnostics {
  compositeRevision: number;
  hasActiveCompositeRules: boolean;
  removeNgMatchedUser: boolean;
}
/** Composite-NG program shape retained between rule changes and re-projections. */
export interface NicoCompositeGroupNotifier {
  _onCompositeChange?: ()=>void;
  onChange?: (event:{composite:true})=>void;
}
export interface NicoCompositeProjectionOutput {
  results: Map<NicoFilterSourceChat,NicoCompositeDisplayState>;
  authorMatches: Map<string,Set<NicoCompositeAuthorKey | null | undefined>>;
}
export interface NicoCompositeProgramState {
  rules: readonly unknown[];
  active: readonly unknown[];
  hasAuthors: boolean;
}
export type NicoCompositeAuthorKey = string | number | NicoFilterSourceChat;
export interface NicoCompositeDisplayState extends Record<string,unknown> {
  text: string;
  cmd: string;
  color: string;
  size: string;
  opacity: number;
  visible?: boolean;
  hidden?: boolean;
  stopped?: boolean;
  legacyRejected?: boolean;
}
/** Compile-time contract for the existing underscore utility injection. */
interface NicoFilterDebounced {
  (): void;
  cancel?: ()=>void;
  flush?: ()=>void;
}
declare const _: {
  debounce(callback:()=>void,wait:number): NicoFilterDebounced;
  compact(values: string[]): string[];
};
//===BEGIN===
//@require NgCompositeRules
class NicoChatFilter extends Emitter {
  declare emit: (event: string,...args: unknown[]) => void;
  declare static SHARED_NG_LEVEL: Record<string, string>;
  declare static SHARED_NG_SCORE: Record<string, number>;
  declare _sharedNgLevel: string;
  declare _removeNgMatchedUser: boolean;
  declare _enable: boolean;
  declare _fork0: boolean;
  declare _fork1: boolean;
  declare _fork2: boolean;
  declare _fork3: boolean;
  declare _defaultThread: boolean;
  declare _ownerThread: boolean;
  declare _communityThread: boolean;
  declare _nicosThread: boolean;
  declare _easyThread: boolean;
  declare _aiThread: boolean;
  declare _extraDefaultThread: boolean;
  declare _extraOwnerThread: boolean;
  declare _extraCommunityThread: boolean;
  declare _extraNicosThread: boolean;
  declare _extraEasyThread: boolean;
  declare _wordFilterList: string[];
  declare _userIdFilterList: string[];
  declare _commandFilterList: string[];
  declare _wordReg: RegExp | null;
  declare _wordRegReg: RegExp | null;
  declare _userIdReg: RegExp | null;
  declare _commandReg: RegExp | null;
  declare _wordRegSource: string | undefined;
  declare _wordRegFlags: string | undefined;
  declare _compositeProgram: NicoCompositeProgramState | null;
  declare _compositeRules: readonly unknown[];
  declare _compositePool: Set<NicoFilterSourceChat>;
  declare _compositeVideoId: string;
  declare _compositeBaselines: WeakMap<NicoFilterSourceChat,NicoCompositeDisplayState>;
  declare _compositeLast: WeakMap<NicoFilterSourceChat,NicoCompositeDisplayState>;
  declare _compositeAuthors: Map<NicoCompositeAuthorKey | null | undefined, Set<NicoFilterSourceChat>>;
  declare _compositeAuthorKeys: WeakMap<NicoFilterSourceChat,NicoCompositeAuthorKey>;
  declare _compositeBans: Map<NicoCompositeAuthorKey | null | undefined, Set<string>>;
  declare _compositeProjection: Map<NicoFilterSourceChat,NicoCompositeDisplayState> | false | null;
  declare _compositeDirty: boolean;
  declare _compositeApplied: boolean;
  declare _compositeWriting: boolean;
  declare _compositeRevision: number | undefined;
  declare _compositeLegacy: ((chat:NicoFilterEvaluatedChat)=>boolean) | undefined;
  constructor(params: NicoChatFilterOptions) {
    super();
    this._sharedNgLevel = params.sharedNgLevel || NicoChatFilter.SHARED_NG_LEVEL.MID;
    this._removeNgMatchedUser = params.removeNgMatchedUser || false;

    this._wordFilterList = [];
    this._userIdFilterList = [];
    this._commandFilterList = [];
    this.wordFilterList = params.wordFilter || '';
    this.userIdFilterList = params.userIdFilter || '';
    this.commandFilterList = params.commandFilter || '';

    this._fork0 = typeof params.fork0 === 'boolean' ? params.fork0 : true;
    this._fork1 = typeof params.fork1 === 'boolean' ? params.fork1 : true;
    this._fork2 = typeof params.fork2 === 'boolean' ? params.fork2 : true;
    this._fork3 = typeof params.fork3 === 'boolean' ? params.fork3 : true;

    this._defaultThread = typeof params.defaultThread === 'boolean' ? params.defaultThread : true;
    this._ownerThread = typeof params.ownerThread === 'boolean' ? params.ownerThread : true;
    this._communityThread = typeof params.communityThread === 'boolean' ? params.communityThread : true;
    this._nicosThread = typeof params.nicosThread === 'boolean' ? params.nicosThread : true;
    this._easyThread = typeof params.easyThread === 'boolean' ? params.easyThread : true;
    this._aiThread = typeof params.aiThread === 'boolean' ? params.aiThread : true;
    this._extraDefaultThread = typeof params.extraDefaultThread === 'boolean' ? params.extraDefaultThread : true;
    this._extraOwnerThread = typeof params.extraOwnerThread === 'boolean' ? params.extraOwnerThread : true;
    this._extraCommunityThread = typeof params.extraCommunityThread === 'boolean' ? params.extraCommunityThread : true;
    this._extraNicosThread = typeof params.extraNicosThread === 'boolean' ? params.extraNicosThread : true;
    this._extraEasyThread = typeof params.extraEasyThread === 'boolean' ? params.extraEasyThread : true;

    this._enable = typeof params.enableFilter === 'boolean' ? params.enableFilter : true;

    this._wordReg = null;
    this._wordRegReg = null;
    this._userIdReg = null;
    this._commandReg = null;

    const notifyChange=_.debounce(this._onChange.bind(this),50);
    // Invalidate predicates synchronously, even if UI change is debounced.
    this._onChange=()=>{this._invalidateComposite();notifyChange();};
    // Preserve the debounced callback API used by existing lifecycle code.
    (this._onChange as NicoFilterDebounced).cancel=()=>notifyChange.cancel?.();
    (this._onChange as NicoFilterDebounced).flush=()=>notifyChange.flush?.();

    this.setWordRegFilter(params.wordRegFilter || '', params.wordRegFilterFlags);
    this._compositeProgram=typeof NgCompositeRules==='undefined'?null:NgCompositeRules.compile(params.compositeRules||[]);
    this._compositeRules=this._compositeProgram?.rules||[];
    this._compositePool=new Set();this._compositeVideoId='';
    this._compositeBaselines=new WeakMap();this._compositeLast=new WeakMap();
    this._compositeAuthors=new Map();this._compositeAuthorKeys=new WeakMap();
    this._compositeBans=new Map();this._compositeProjection=null;
    this._compositeDirty=true;this._compositeApplied=false;this._compositeWriting=false;
  }
  get hasActiveCompositeRules(){return this._enable&&!!this._compositeProgram?.active.length;}
  get compositeRevision(){return this._compositeRevision||0;}
  get compositeRules(){return JSON.parse(JSON.stringify(this._compositeRules));}
  set compositeRules(value){
    const program=NgCompositeRules.compile(value);if(!program)return;
    this._compositeProgram=program;this._compositeRules=program.rules;this.refresh();
  }
  _invalidateComposite(){
    this._compositeDirty=true;this._compositeProjection=null;
    this._compositeRevision=(this._compositeRevision||0)+1;
  }
  _compositeKey(chat: NicoFilterSourceChat): NicoCompositeAuthorKey {return chat.userId||chat;}
  _registerCompositeAuthor(chat: NicoFilterSourceChat): NicoCompositeAuthorKey {
    const key=this._compositeKey(chat);this._compositeAuthorKeys.set(chat,key);
    if(!this._compositeAuthors.has(key))this._compositeAuthors.set(key,new Set());
    this._compositeAuthors.get(key)!.add(chat);return key;
  }
  _baselineComposite(chat: NicoFilterSourceChat): void {
    if(!this._compositeBaselines.has(chat))this._compositeBaselines.set(chat,
      NgCompositeRules.initialState(chat,this._compositeVideoId));
  }
  setCompositeChatPool(chats: Iterable<NicoFilterSourceChat>,videoId=''): void {
    const next=new Set(chats),old=this._compositePool;
    if(this._compositeApplied)for(const c of old||[])if(!next.has(c))this._applyCompositeState(c,null);
    this._compositePool=next;this._compositeVideoId=videoId;
    this._compositeAuthors.clear();this._compositeBans.clear();
    this._invalidateComposite();
    if(this.hasActiveCompositeRules||this._compositeApplied)this.refresh();
  }
  recordCompositeEdit(chat: NicoFilterSourceChat,key: string,value: unknown): void {
    if(this._compositeWriting)return;
    const base=this._compositeBaselines.get(chat);if(base)base[key]=value;
  }
  _captureCompositeEdit(chat: NicoFilterSourceChat): void {
    const base=this._compositeBaselines.get(chat),last=this._compositeLast.get(chat);
    if(!base||!last)return;
    for(const key of ['text','cmd','color','size','opacity'])if(chat[key]!==last[key])base[key]=chat[key];
  }
  _applyCompositeState(chat: NicoFilterSourceChat,state: NicoCompositeDisplayState | null | undefined): void {
    state=state||this._compositeBaselines.get(chat);if(!state||!chat.props)return;
    this._compositeWriting=true;
    try{
      if(chat.text!==state.text)chat.text=state.text;
      for(const key of ['cmd','color','size','opacity'])chat.props[key]=state[key];
      this._compositeLast.set(chat,state);
    }finally{this._compositeWriting=false;}
  }
  _bansFor(key: NicoCompositeAuthorKey | null | undefined,authorMatches: Map<string,Set<NicoCompositeAuthorKey | null | undefined>>): Set<string> {
    return new Set([...authorMatches].filter(([,ids])=>ids.has(key)).map(([id])=>id));
  }
  _ensureComposite(){
    if(!this._compositeDirty)return this._compositeProjection;
    this._compositeDirty=false;
    this._compositeAuthors.clear();this._compositeBans.clear();
    if(!this.hasActiveCompositeRules){
      if(this._compositeApplied)for(const c of this._compositePool)this._applyCompositeState(c,null);
      this._compositeApplied=false;return this._compositeProjection=false;
    }
    for(const c of this._compositePool){
      this._baselineComposite(c);if(this._compositeProgram!.hasAuthors)this._registerCompositeAuthor(c);
    }
    this._compositeLegacy=this.getFilterFunc();
    const output=NgCompositeRules.projectWithMeta([...this._compositePool],this._compositeProgram!,
      this._compositeLegacy!,this._compositeVideoId,this._compositeBaselines) as NicoCompositeProjectionOutput;
    this._compositeProjection=output.results;this._compositeApplied=true;
    for(const [c,state] of output.results)this._applyCompositeState(c,state);
    for(const key of this._compositeAuthors.keys())this._compositeBans.set(key,this._bansFor(key,output.authorMatches));
    return this._compositeProjection;
  }
  _storeComposite(output: NicoCompositeProjectionOutput,changed: Set<NicoCompositeGroupNotifier>): void {
    for(const [c,state] of output.results){
      const old=(this._compositeProjection as Map<NicoFilterSourceChat,NicoCompositeDisplayState>).get(c);
      if(old&&['visible','text','cmd','color','size','opacity'].some(k=>old[k]!==state[k])){
        if(c.group)changed.add(c.group);
      }
      (this._compositeProjection as Map<NicoFilterSourceChat,NicoCompositeDisplayState>).set(c,state);this._applyCompositeState(c,state);
    }
  }
  _reprojectCompositeAuthor(key: NicoCompositeAuthorKey | null | undefined,changed: Set<NicoCompositeGroupNotifier>): void {
    const members=this._compositeAuthors.get(key);
    if(!members?.size){this._compositeAuthors.delete(key);this._compositeBans.delete(key);return;}
    const output=NgCompositeRules.projectWithMeta([...members],this._compositeProgram!,
      this._compositeLegacy!,this._compositeVideoId,this._compositeBaselines) as NicoCompositeProjectionOutput;
    this._compositeBans.set(key,this._bansFor(key,output.authorMatches));this._storeComposite(output,changed);
  }
  _notifyCompositeGroups(changed: Set<NicoCompositeGroupNotifier>): void {
    for(const group of changed){
      if(group._onCompositeChange)group._onCompositeChange();
      else group.onChange?.({composite:true});
    }
  }
  addCompositeChat(chat: NicoFilterSourceChat): Set<NicoCompositeGroupNotifier> {
    const changed=new Set<NicoCompositeGroupNotifier>();
    if(this._compositePool.has(chat)){this._ensureComposite();return changed;}
    this._compositePool.add(chat);
    if(!this.hasActiveCompositeRules){this._ensureComposite();return changed;}
    if(this._compositeDirty){this._ensureComposite();return changed;}
    this._baselineComposite(chat);
    const key=this._compositeProgram!.hasAuthors?this._registerCompositeAuthor(chat):null;
    const prior=this._compositeBans.get(key)||new Set(),seed=new Map();
    for(const id of prior)seed.set(id,new Set([key]));
    const output=NgCompositeRules.projectWithMeta([chat],this._compositeProgram!,
      this._compositeLegacy!,this._compositeVideoId,this._compositeBaselines,seed) as NicoCompositeProjectionOutput;
    const next=this._bansFor(key,output.authorMatches);
    if(this._compositeProgram!.hasAuthors&&(next.size!==prior.size||[...next].some(id=>!prior.has(id)))){
      this._reprojectCompositeAuthor(key,changed);
    }else this._storeComposite(output,changed);
    this._notifyCompositeGroups(changed);return changed;
  }
  removeCompositeChat(chat: NicoFilterSourceChat): Set<NicoCompositeGroupNotifier> {
    const changed=new Set<NicoCompositeGroupNotifier>();if(!this._compositePool.has(chat))return changed;
    this._ensureComposite();const key=this._compositeAuthorKeys.get(chat);
    this._compositePool.delete(chat);(this._compositeProjection as Map<NicoFilterSourceChat,NicoCompositeDisplayState> | null)?.delete?.(chat);
    this._compositeAuthors.get(key)?.delete(chat);
    this._applyCompositeState(chat,null);
    this._compositeBaselines.delete(chat);this._compositeLast.delete(chat);this._compositeAuthorKeys.delete(chat);
    if(this.hasActiveCompositeRules&&this._compositeProgram!.hasAuthors)this._reprojectCompositeAuthor(key,changed);
    this._notifyCompositeGroups(changed);return changed;
  }
  updateCompositeChat(chat: NicoFilterSourceChat): Set<NicoCompositeGroupNotifier> {
    const changed=new Set<NicoCompositeGroupNotifier>();if(!this._compositePool.has(chat)||this._compositeWriting)return changed;
    this._captureCompositeEdit(chat);this._ensureComposite();
    if(!this.hasActiveCompositeRules)return changed;
    if(this._compositeProgram!.hasAuthors){
      const old=this._compositeAuthorKeys.get(chat),key=this._compositeKey(chat);
      if(old!==key){this._compositeAuthors.get(old)?.delete(chat);this._registerCompositeAuthor(chat);this._reprojectCompositeAuthor(old,changed);}
      this._reprojectCompositeAuthor(key,changed);
    }else{
      const output=NgCompositeRules.projectWithMeta([chat],this._compositeProgram!,
        this._compositeLegacy!,this._compositeVideoId,this._compositeBaselines) as NicoCompositeProjectionOutput;
      this._storeComposite(output,changed);
    }
    this._notifyCompositeGroups(changed);return changed;
  }
  _getCompositeProjection(fallback: readonly NicoFilterSourceChat[]) {
    if(this.hasActiveCompositeRules)for(const c of fallback)if(!this._compositePool.has(c))this.addCompositeChat(c);
    return this._ensureComposite();
  }
  get isEnable() {
    return this._enable;
  }
  set isEnable(v) {
    if (this._enable === v) {
      return;
    }
    this._enable = !!v;
    this._compositeProjection=null;
    this._onChange();
  }
  get removeNgMatchedUser() {
    return this._removeNgMatchedUser;
  }
  set removeNgMatchedUser(v) {
    if (this._removeNgMatchedUser === v) {
      return;
    }
    this._removeNgMatchedUser = !!v;
    this.refresh();
  }
  get fork0() { return this._fork0; }
  set fork0(v) {
    v = !!v;
    if (this._fork0 === v) { return; }
    this._fork0 = v;
    this.refresh();
  }
  get fork1() { return this._fork1; }
  set fork1(v) {
    v = !!v;
    if (this._fork1 === v) { return; }
    this._fork1 = v;
    this.refresh();
  }
  get fork2() { return this._fork2; }
  set fork2(v) {
    v = !!v;
    if (this._fork2 === v) { return; }
    this._fork2 = v;
    this.refresh();
  }
  get fork3() { return this._fork3; }
  set fork3(v) {
    v = !!v;
    if (this._fork3 === v) { return; }
    this._fork3 = v;
    this.refresh();
  }
  get defaultThread() { return this._defaultThread; }
  set defaultThread(v) {
    v = !!v;
    if (this._defaultThread === v) { return; }
    this._defaultThread = v;
    this.refresh();
  }
  get ownerThread() { return this._ownerThread; }
  set ownerThread(v) {
    v = !!v;
    if (this._ownerThread === v) { return; }
    this._ownerThread = v;
    this.refresh();
  }
  get communityThread() { return this._communityThread; }
  set communityThread(v) {
    v = !!v;
    if (this._communityThread === v) { return; }
    this._communityThread = v;
    this.refresh();
  }
  get nicosThread() { return this._nicosThread; }
  set nicosThread(v) {
    v = !!v;
    if (this._nicosThread === v) { return; }
    this._nicosThread = v;
    this.refresh();
  }
  get easyThread() { return this._easyThread; }
  set easyThread(v) {
    v = !!v;
    if (this._easyThread === v) { return; }
    this._easyThread = v;
    this.refresh();
  }
  get aiThread() { return this._aiThread; }
  set aiThread(v) {
    v = !!v;
    if (this._aiThread === v) { return; }
    this._aiThread = v;
    this.refresh();
  }
  get extraDefaultThread() { return this._extraDefaultThread; }
  set extraDefaultThread(v) {
    v = !!v;
    if (this._extraDefaultThread === v) { return; }
    this._extraDefaultThread = v;
    this.refresh();
  }
  get extraOwnerThread() { return this._extraOwnerThread; }
  set extraOwnerThread(v) {
    v = !!v;
    if (this._extraOwnerThread === v) { return; }
    this._extraOwnerThread = v;
    this.refresh();
  }
  get extraCommunityThread() { return this._extraCommunityThread; }
  set extraCommunityThread(v) {
    v = !!v;
    if (this._extraCommunityThread === v) { return; }
    this._extraCommunityThread = v;
    this.refresh();
  }
  get extraNicosThread() { return this._extraNicosThread; }
  set extraNicosThread(v) {
    v = !!v;
    if (this._extraNicosThread === v) { return; }
    this._extraNicosThread = v;
    this.refresh();
  }
  get extraEasyThread() { return this._extraEasyThread; }
  set extraEasyThread(v) {
    v = !!v;
    if (this._extraEasyThread === v) { return; }
    this._extraEasyThread = v;
    this.refresh();
  }
  refresh() { this._onChange(); }
  addWordFilter(text: string) {
    let before = this._wordFilterList.join('\n');
    this._wordFilterList.push((text || '').trim());
    this._wordFilterList = [...new Set(this._wordFilterList)];
    let after = this._wordFilterList.join('\n');
    if (before === after) { return; }
    this._wordReg = null;
    this._onChange();
  }
  set wordFilterList(list: string | string[]) {
    list = [...new Set(typeof list === 'string' ? list.trim().split('\n') : list)];

    let before = this._wordFilterList.join('\n');
    let tmp: string[] = [];
    list.forEach(text => {
      if (!text) { return; }
      tmp.push(text.trim());
    });
    tmp = _.compact(tmp);
    let after = tmp.join('\n');

    if (before === after) { return; }
    this._wordReg = null;
    this._wordFilterList = tmp;
    this._onChange();
  }
  get wordFilterList() {
    return this._wordFilterList;
  }

  get wordRegFilterSource() { return this._wordRegSource || ''; }
  get wordRegFilterFlags() { return this._wordRegFlags || ''; }
  setWordRegFilter(source: string | null | undefined, flags?: string) {
    let next;
    try {
      // Validate the complete pair before replacing the accepted filter.
      next = new RegExp(source as string, flags);
    } catch (e) {
      window.console.error(e);
      return;
    }
    source = source == null ? '' : String(source);
    if (this.wordRegFilterSource === source && this.wordRegFilterFlags === next.flags) {
      return;
    }
    this._wordRegSource = source;
    this._wordRegFlags = next.flags;
    this._wordRegReg = source === '' ? null : next;
    this._onChange();
  }

  addUserIdFilter(text: string) {
    const before = this._userIdFilterList.join('\n');
    this._userIdFilterList.push(text);
    this._userIdFilterList = [...new Set(this._userIdFilterList)];
    const after = this._userIdFilterList.join('\n');
    if (before === after) { return; }
    this._userIdReg = null;
    this._onChange();
  }
  set userIdFilterList(list: string | string[]) {
    list = [...new Set(typeof list === 'string' ? list.trim().split('\n') : list)];

    let before = this._userIdFilterList.join('\n');
    let tmp: string[] = [];
    list.forEach(text => {
      if (!text) { return; }
      tmp.push(text.trim());
    });
    tmp = _.compact(tmp);
    let after = tmp.join('\n');

    if (before === after) { return; }
    this._userIdReg = null;
    this._userIdFilterList = tmp;
    this._onChange();
  }
  get userIdFilterList() {
    return this._userIdFilterList;
  }
  addCommandFilter(text: string) {
    let before = this._commandFilterList.join('\n');
    this._commandFilterList.push(text);
    this._commandFilterList = [...new Set(this._commandFilterList)];
    let after = this._commandFilterList.join('\n');
    if (before === after) { return; }
    this._commandReg = null;
    this._onChange();
  }
  set commandFilterList(list: string | string[]) {
    list = [...new Set(typeof list === 'string' ? list.trim().split('\n') : list)];

    let before = this._commandFilterList.join('\n');
    let tmp: string[] = [];
    list.forEach(text => {
      if (!text) { return; }
      tmp.push(text.trim());
    });
    tmp = _.compact(tmp);
    let after = tmp.join('\n');

    if (before === after) { return; }
    this._commandReg = null;
    this._commandFilterList = tmp;
    this._onChange();
  }
  get commandFilterList() {
    return this._commandFilterList;
  }

  set sharedNgLevel(level) {
    if (NicoChatFilter.SHARED_NG_LEVEL[level] && this._sharedNgLevel !== level) {
      this._sharedNgLevel = level;
      this._onChange();
    }
  }
  get sharedNgLevel() {
    return this._sharedNgLevel;
  }
  getFilterFunc(): (chat: NicoFilterEvaluatedChat)=>boolean {
    if (!this._enable) {
      return () => true;
    }
    const threthold = NicoChatFilter.SHARED_NG_SCORE[this._sharedNgLevel];

    // NG設定の数×コメント数だけループを回すのはアホらしいので、
    // 連結した一個の正規表現を生成する
    if (!this._wordReg) {
      this._wordReg = this._buildFilterReg(this._wordFilterList);
    }
    // Build once per predicate/batch, not per comment. The public list stays an array.
    // Deriving here also observes legacy callers that mutate the returned list directly.
    const umatch = this._userIdFilterList.length ? new Set(this._userIdFilterList) : null;
    if (!this._commandReg) {
      this._commandReg = this._buildFilterReg(this._commandFilterList);
    }
    const wordReg = this._wordReg;
    const wordRegReg = this._wordRegReg;
    const commandReg = this._commandReg;

    if (Config.getValue('debug')) {
      return nicoChat => {
        if (nicoChat.fork === 1) {
          return true;
        }
        const score = nicoChat.score;
        if (score <= threthold) {
          window.console.log('%cNG共有適用: %s <= %s %s %s秒 %s', 'background: yellow;',
            score,
            threthold,
            nicoChat.type,
            nicoChat.vpos / 100,
            nicoChat.text
          );
          return false;
        }
        let m;
        wordReg && (m = wordReg.exec(nicoChat.text));
        if (m) {
          window.console.log('%cNGワード: "%s" %s %s秒 %s', 'background: yellow;',
            m[1],
            nicoChat.type,
            nicoChat.vpos / 100,
            nicoChat.text
          );
          return false;
        }

        if (wordRegReg) { wordRegReg.lastIndex = 0; }
        wordRegReg && (m = wordRegReg.exec(nicoChat.text));
        if (m) {
          window.console.log(
            '%cNGワード(正規表現): "%s" %s %s秒 %s',
            'background: yellow;',
            m[1],
            nicoChat.type,
            nicoChat.vpos / 100,
            nicoChat.text
          );
          return false;
        }

        if (umatch && umatch.has(nicoChat.userId)) {
          window.console.log('%cNGID: "%s" %s %s秒 %s %s', 'background: yellow;',
            nicoChat.userId,
            nicoChat.type,
            nicoChat.vpos / 100,
            nicoChat.userId,
            nicoChat.text
          );
          return false;
        }
        commandReg && (m = commandReg.test(nicoChat.cmd));
        if (m) {
          window.console.log('%cNG command: "%s" %s %s秒 %s %s', 'background: yellow;',
            (m as unknown as {1?: string})[1],
            nicoChat.type,
            nicoChat.vpos / 100,
            nicoChat.cmd,
            nicoChat.text
          );
          return false;
        }

        return true;
      };
    }

    return nicoChat => {
      if (nicoChat.fork === 1) { //fork1 投稿者コメントはNGしない
        return true;
      }
      const text = nicoChat.text;
      if (wordRegReg) { wordRegReg.lastIndex = 0; }
      return !(
        (nicoChat.score <= threthold) ||
        (wordReg && wordReg.test(text)) ||
        (wordRegReg && wordRegReg.test(text)) ||
        (umatch && umatch.has(nicoChat.userId)) ||
        (commandReg && commandReg.test(nicoChat.cmd))
        );
    };
  }
  applyFilter(nicoChatArray: NicoFilterEvaluatedChat[]): NicoFilterEvaluatedChat[] {
    const before = nicoChatArray.length;
    if (before < 1) {
      return nicoChatArray;
    }
    const timeKey = before > 1 ? 'applyNgFilter: ' + nicoChatArray[0].type : null;
    if (timeKey) { window.console.time(timeKey); }
    const composite=this._getCompositeProjection(nicoChatArray);
    const filterFunc=composite?this._compositeLegacy!:this.getFilterFunc();
    let result=nicoChatArray.filter(chat=>composite instanceof Map?
      composite.get(chat)?.visible===true:filterFunc(chat));
    const removedUserIds = new Set();
    if (before !== result.length && this._removeNgMatchedUser) {
      const accepted = new Set(result);
      for (const chat of nicoChatArray) {
        if (composite?composite.get(chat)?.legacyRejected:!accepted.has(chat)) { removedUserIds.add(chat.userId); }
      }
    }
    const denyTypes = [
      !this.fork0 && 0,
      !this.fork1 && 1,
      !this.fork2 && 2,
      !this.fork3 && 3,
    ].filter(type => type !== false);
    const denyThreadTypes = [
      !this.defaultThread        && 'default',
      !this.ownerThread          && 'owner',
      !this.communityThread      && 'community',
      !this.nicosThread          && 'nicos',
      !this.easyThread           && 'easy',
      !this.aiThread             && 'ai',
      !this.extraDefaultThread   && 'extra-default',
      !this.extraOwnerThread     && 'extra-owner',
      !this.extraCommunityThread && 'extra-community',
      !this.extraNicosThread     && 'extra-nicos',
      !this.extraEasyThread      && 'extra-easy',
    ].filter(type => type !== false);
    result = result.filter(chat => {
      if (removedUserIds.has(chat.userId)) {
        return false;
      }
      return !denyTypes.includes(chat.fork) && !denyThreadTypes.includes(chat.threadLabel);
    });
    if (timeKey) {
      window.console.timeEnd(timeKey);
      window.console.log('NG判定結果: %s/%s', result.length, before);
    }
    return result;
  }
  isSafe(nicoChat: NicoFilterEvaluatedChat): boolean {
    const composite=this._getCompositeProjection([nicoChat]);
    return composite instanceof Map?
      composite.get(nicoChat)?.visible===true:(this.getFilterFunc())(nicoChat);
  }
  _buildFilterReg(filterList: string[]): RegExp | null {
    if (filterList.length < 1) {
      return null;
    }
    const escapeRegs = textUtil.escapeRegs;
    let r = filterList.filter(f => f).map(f => escapeRegs(f));
    return new RegExp('(' + r.join('|') + ')', 'i');
  }
  _buildFilterPerfectMatchinghReg(filterList: string[]): RegExp | null {
    if (filterList.length < 1) {
      return null;
    }
    const escapeRegs = textUtil.escapeRegs;
    let r = filterList.filter(f => f).map(f => escapeRegs(f));
    return new RegExp('^(' + r.join('|') + ')$');
  }
  _onChange() {
    console.log('NicoChatFilter.onChange');
    this.emit('change');
  }
}

NicoChatFilter.SHARED_NG_LEVEL = {
  NONE: 'NONE',
  LOW: 'LOW',
  MID: 'MID',
  HIGH: 'HIGH',
  MAX: 'MAX'
};
NicoChatFilter.SHARED_NG_SCORE = {
  NONE: -99999,//Number.MIN_VALUE,
  LOW: -10000,
  MID: -5000,
  HIGH: -1000,
  MAX: -1
};

//===END===
export {NicoChatFilter};

// return nicoChat => {
//   if (nicoChat.fork > 0) {
//     return true;
//   }

//   if (nicoChat.score <= threthold) {
//     return false;
//   }

//   if (wordReg && wordReg.test(nicoChat.text)) {
//     return false;
//   }

//   if (wordRegReg && wordRegReg.test(nicoChat.text)) {
//     return false;
//   }

//   if (userIdReg && userIdReg.test(nicoChat.text)) {
//     return false;
//   }

//   if (commandReg && commandReg.test(nicoChat.cmd)) {
//     return false;
//   }

//   return true;
// };
// }
