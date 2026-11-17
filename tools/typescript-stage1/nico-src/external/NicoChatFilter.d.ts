// 自動生成（Task1061: scripts/gen-external-types.mjs）。手で直さない。元: comment-src/NicoChatFilter.ts
import { Emitter } from '../Emitter';
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
    _onCompositeChange?: () => void;
    onChange?: (event: {
        composite: true;
    }) => void;
}
export interface NicoCompositeProjectionOutput {
    results: Map<NicoFilterSourceChat, NicoCompositeDisplayState>;
    authorMatches: Map<string, Set<NicoCompositeAuthorKey | null | undefined>>;
}
export interface NicoCompositeProgramState {
    rules: readonly unknown[];
    active: readonly unknown[];
    hasAuthors: boolean;
}
export type NicoCompositeAuthorKey = string | number | NicoFilterSourceChat;
export interface NicoCompositeDisplayState extends Record<string, unknown> {
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
declare class NicoChatFilter extends Emitter {
    emit: (event: string, ...args: unknown[]) => void;
    static SHARED_NG_LEVEL: Record<string, string>;
    static SHARED_NG_SCORE: Record<string, number>;
    _sharedNgLevel: string;
    _removeNgMatchedUser: boolean;
    _enable: boolean;
    _fork0: boolean;
    _fork1: boolean;
    _fork2: boolean;
    _fork3: boolean;
    _defaultThread: boolean;
    _ownerThread: boolean;
    _communityThread: boolean;
    _nicosThread: boolean;
    _easyThread: boolean;
    _aiThread: boolean;
    _extraDefaultThread: boolean;
    _extraOwnerThread: boolean;
    _extraCommunityThread: boolean;
    _extraNicosThread: boolean;
    _extraEasyThread: boolean;
    _wordFilterList: string[];
    _userIdFilterList: string[];
    _commandFilterList: string[];
    _wordReg: RegExp | null;
    _wordRegReg: RegExp | null;
    _userIdReg: RegExp | null;
    _commandReg: RegExp | null;
    _wordRegSource: string | undefined;
    _wordRegFlags: string | undefined;
    _compositeProgram: NicoCompositeProgramState | null;
    _compositeRules: readonly unknown[];
    _compositePool: Set<NicoFilterSourceChat>;
    _compositeVideoId: string;
    _compositeBaselines: WeakMap<NicoFilterSourceChat, NicoCompositeDisplayState>;
    _compositeLast: WeakMap<NicoFilterSourceChat, NicoCompositeDisplayState>;
    _compositeAuthors: Map<NicoCompositeAuthorKey | null | undefined, Set<NicoFilterSourceChat>>;
    _compositeAuthorKeys: WeakMap<NicoFilterSourceChat, NicoCompositeAuthorKey>;
    _compositeBans: Map<NicoCompositeAuthorKey | null | undefined, Set<string>>;
    _compositeProjection: Map<NicoFilterSourceChat, NicoCompositeDisplayState> | false | null;
    _compositeDirty: boolean;
    _compositeApplied: boolean;
    _compositeWriting: boolean;
    _compositeRevision: number | undefined;
    _compositeLegacy: ((chat: NicoFilterEvaluatedChat) => boolean) | undefined;
    constructor(params: NicoChatFilterOptions);
    get hasActiveCompositeRules(): boolean;
    get compositeRevision(): number;
    get compositeRules(): any;
    set compositeRules(value: any);
    _invalidateComposite(): void;
    _compositeKey(chat: NicoFilterSourceChat): NicoCompositeAuthorKey;
    _registerCompositeAuthor(chat: NicoFilterSourceChat): NicoCompositeAuthorKey;
    _baselineComposite(chat: NicoFilterSourceChat): void;
    setCompositeChatPool(chats: Iterable<NicoFilterSourceChat>, videoId?: string): void;
    recordCompositeEdit(chat: NicoFilterSourceChat, key: string, value: unknown): void;
    _captureCompositeEdit(chat: NicoFilterSourceChat): void;
    _applyCompositeState(chat: NicoFilterSourceChat, state: NicoCompositeDisplayState | null | undefined): void;
    _bansFor(key: NicoCompositeAuthorKey | null | undefined, authorMatches: Map<string, Set<NicoCompositeAuthorKey | null | undefined>>): Set<string>;
    _ensureComposite(): false | Map<NicoFilterSourceChat, NicoCompositeDisplayState> | null;
    _storeComposite(output: NicoCompositeProjectionOutput, changed: Set<NicoCompositeGroupNotifier>): void;
    _reprojectCompositeAuthor(key: NicoCompositeAuthorKey | null | undefined, changed: Set<NicoCompositeGroupNotifier>): void;
    _notifyCompositeGroups(changed: Set<NicoCompositeGroupNotifier>): void;
    addCompositeChat(chat: NicoFilterSourceChat): Set<NicoCompositeGroupNotifier>;
    removeCompositeChat(chat: NicoFilterSourceChat): Set<NicoCompositeGroupNotifier>;
    updateCompositeChat(chat: NicoFilterSourceChat): Set<NicoCompositeGroupNotifier>;
    _getCompositeProjection(fallback: readonly NicoFilterSourceChat[]): false | Map<NicoFilterSourceChat, NicoCompositeDisplayState> | null;
    get isEnable(): boolean;
    set isEnable(v: boolean);
    get removeNgMatchedUser(): boolean;
    set removeNgMatchedUser(v: boolean);
    get fork0(): boolean;
    set fork0(v: boolean);
    get fork1(): boolean;
    set fork1(v: boolean);
    get fork2(): boolean;
    set fork2(v: boolean);
    get fork3(): boolean;
    set fork3(v: boolean);
    get defaultThread(): boolean;
    set defaultThread(v: boolean);
    get ownerThread(): boolean;
    set ownerThread(v: boolean);
    get communityThread(): boolean;
    set communityThread(v: boolean);
    get nicosThread(): boolean;
    set nicosThread(v: boolean);
    get easyThread(): boolean;
    set easyThread(v: boolean);
    get aiThread(): boolean;
    set aiThread(v: boolean);
    get extraDefaultThread(): boolean;
    set extraDefaultThread(v: boolean);
    get extraOwnerThread(): boolean;
    set extraOwnerThread(v: boolean);
    get extraCommunityThread(): boolean;
    set extraCommunityThread(v: boolean);
    get extraNicosThread(): boolean;
    set extraNicosThread(v: boolean);
    get extraEasyThread(): boolean;
    set extraEasyThread(v: boolean);
    refresh(): void;
    addWordFilter(text: string): void;
    set wordFilterList(list: string | string[]);
    get wordFilterList(): string | string[];
    get wordRegFilterSource(): string;
    get wordRegFilterFlags(): string;
    setWordRegFilter(source: string | null | undefined, flags?: string): void;
    addUserIdFilter(text: string): void;
    set userIdFilterList(list: string | string[]);
    get userIdFilterList(): string | string[];
    addCommandFilter(text: string): void;
    set commandFilterList(list: string | string[]);
    get commandFilterList(): string | string[];
    set sharedNgLevel(level: string);
    get sharedNgLevel(): string;
    getFilterFunc(): (chat: NicoFilterEvaluatedChat) => boolean;
    applyFilter(nicoChatArray: NicoFilterEvaluatedChat[]): NicoFilterEvaluatedChat[];
    isSafe(nicoChat: NicoFilterEvaluatedChat): boolean;
    _buildFilterReg(filterList: string[]): RegExp | null;
    _buildFilterPerfectMatchinghReg(filterList: string[]): RegExp | null;
    _onChange(): void;
}
export { NicoChatFilter };
