// 自動生成（Task1061: scripts/gen-external-types.mjs）。手で直さない。元: comment-src/NicoChatGroupViewModel.ts
export interface NicoChatGroupViewModelContract {
    readonly type: unknown;
    readonly members: readonly unknown[];
    currentTime: number;
    bulkLayoutData: unknown;
}
export interface NicoChatGroupLayoutDatum {
    id: unknown;
    ypos: number;
    isOverflow: boolean;
    [property: string]: unknown;
}
export interface NicoChatGroupSlotDatum {
    id: unknown;
    slot: number;
    fork: number;
    no: number;
    vpos: number;
    begin: number;
    end: number;
    invisible: boolean;
}
interface NicoChatGroupMember {
    id: unknown;
    type: string;
    _commentArtMetadata: unknown;
    _y: number;
    _isOverflow: boolean;
    _isLayouted: boolean;
    isLayouted: boolean;
    isInvisible: boolean;
    isOverflow: boolean;
    beginLeftTiming: number;
    endRightTiming: number;
    inviewTiming: number;
    vpos: number;
    no: number;
    fork: number;
    slot: number;
    bulkLayoutData: NicoChatGroupLayoutDatum;
    reset(): void;
    resetLayoutForSpeedChange(): void;
    recalcBeginEndTiming(rate: number): void;
    moveToNextLine(other: NicoChatGroupMember): void;
    checkCollision(other: NicoChatGroupMember): boolean;
    isInViewBySecond(sec: number): boolean;
    export(): string;
}
interface NicoChatGroupSourceChat {
    text: string;
    [property: string]: unknown;
}
interface NicoChatGroupSource {
    on(event: 'addChatArray', listener: (chats: readonly NicoChatGroupSourceChat[]) => void): unknown;
    on(event: 'addChat', listener: (chat: NicoChatGroupSourceChat) => void): unknown;
    on(event: 'reset', listener: () => void): unknown;
    on(event: 'change', listener: (event: unknown) => void): unknown;
    readonly members: readonly NicoChatGroupSourceChat[];
    readonly currentTime: number;
    readonly type: string;
}
interface NicoChatGroupLayoutReply {
    lastUpdate: number;
    members: NicoChatGroupLayoutDatum[];
}
declare class NicoChatGroupViewModel {
    _currentTime: number | undefined;
    _nicoChatGroup: NicoChatGroupSource;
    _offScreen: unknown;
    _members: NicoChatGroupMember[];
    _vSortedMembers: NicoChatGroupMember[];
    _lastUpdate: number;
    _maxInViewDuration: number;
    _layoutWorker: {
        post(message: {
            command: 'layout';
            params: {
                type: string;
                members: NicoChatGroupLayoutDatum[];
                lastUpdate: number;
            };
        }): Promise<NicoChatGroupLayoutReply>;
    };
    _hasLayout: boolean | undefined;
    _layout: () => void;
    constructor(...args: [NicoChatGroupSource, unknown]);
    initialize(nicoChatGroup: NicoChatGroupSource, offScreen: unknown): void;
    _initWorker(): void;
    _onAddChatArray(nicoChatArray: readonly NicoChatGroupSourceChat[]): void;
    _onAddChat(nicoChat: NicoChatGroupSourceChat): void;
    _onReset(): void;
    _onChange(e: unknown): void;
    _execCommentLayoutWorker(): Promise<boolean>;
    addChatArray(nicoChatArray: readonly NicoChatGroupSourceChat[]): Promise<void>;
    _onCommentSpeedRateUpdate(): void;
    changeSpeed(speedRate?: number): void;
    _groupCollision(): void;
    addChat(nicoChat: NicoChatGroupSourceChat): void;
    reset(): void;
    get currentTime(): number;
    get type(): string;
    checkCollision(target: NicoChatGroupMember): void;
    get bulkLayoutData(): NicoChatGroupLayoutDatum[];
    set bulkLayoutData(data: NicoChatGroupLayoutDatum[]);
    get bulkSlotData(): NicoChatGroupSlotDatum[];
    set bulkSlotData(data: NicoChatGroupSlotDatum[]);
    /**
     * vposでソートされたメンバーを生成. 計算効率改善用
     */
    _createVSortedMembers(): NicoChatGroupMember[];
    _findInViewStartIndex(sec: number): number;
    get members(): NicoChatGroupMember[];
    /**
     * 現時点で表示状態のメンバーのみを返す
     */
    get inViewMembers(): NicoChatGroupMember[];
    /**
     * secの時点で表示状態のメンバーのみを返す
     */
    getInViewMembersBySecond(sec: number): NicoChatGroupMember[];
    getInViewMembersByVpos(vpos: number): NicoChatGroupMember[];
    export(): string;
    getCurrentTime(): number;
    getType(): string;
}
export { NicoChatGroupViewModel };
