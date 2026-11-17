// 自動生成（Task1061: scripts/gen-external-types.mjs）。手で直さない。元: comment-src/NicoChatGroup.ts
import { Emitter } from '../Emitter';
export interface NicoGroupChat {
    threadId?: string | number;
    fork?: number;
    no?: number;
    uniqNo?: string | number;
    group?: unknown;
    [field: string]: unknown;
}
export interface NicoGroupFilter {
    compositeRevision?: number;
    removeNgMatchedUser?: boolean;
    on(event: string, listener: (...args: unknown[]) => void): unknown;
    applyFilter(chats: NicoGroupChat[]): NicoGroupChat[];
    addCompositeChat?(chat: NicoGroupChat): Set<unknown> | undefined | null;
    removeCompositeChat?(chat: NicoGroupChat): Set<unknown> | undefined | null;
    updateCompositeChat?(chat: NicoGroupChat): Set<unknown> | undefined | null;
    isSafe(chat: NicoGroupChat): boolean;
}
declare class NicoChatGroup extends Emitter {
    emit: (event: string, ...args: unknown[]) => void;
    _type: unknown;
    _nicoChatFilter: NicoGroupFilter;
    _members: NicoGroupChat[];
    _filteredMembers: NicoGroupChat[];
    _filteredMembersValid: boolean;
    _filteredRevision: number;
    _currentTime: number | undefined;
    _sharedNgLevel: string | number | undefined;
    constructor(...args: [unknown, {
        nicoChatFilter: NicoGroupFilter;
    }]);
    initialize(type: unknown, params: {
        nicoChatFilter: NicoGroupFilter;
    }): void;
    reset(): void;
    addChatArray(nicoChatArray: NicoGroupChat[]): void;
    addChat(nicoChat: NicoGroupChat): void;
    _getChat(nicoChat: NicoGroupChat): (chat: NicoGroupChat) => boolean;
    removeChat(nicoChat: NicoGroupChat): void;
    get type(): unknown;
    get members(): NicoGroupChat[];
    get nonFilteredMembers(): NicoGroupChat[];
    onChange(e: {
        chat?: NicoGroupChat;
        composite?: boolean;
    } | null): void;
    _onCompositeChange(): void;
    _onFilterChange(): void;
    get currentTime(): number | undefined;
    set currentTime(sec: number | undefined);
    setSharedNgLevel(level: string | number): void;
    includes(nicoChat: NicoGroupChat): NicoGroupChat | undefined;
}
export { NicoChatGroup };
