// 自動生成（Task1061: scripts/gen-external-types.mjs）。手で直さない。元: comment-src/NicoScripter.ts
import { Emitter } from '../Emitter';
export interface NicoScripterContract {
    currentTime: number;
    reset(): void;
    add(chat: NicoScripterSourceChat): void;
}
/** Legacy command payloads have heterogeneous shapes by command kind. */
export interface NicoScriptParsedCommand {
    id: number | string;
    type: string;
    params: any;
}
export interface NicoScripterSourceChat {
    text: string;
    vpos: number;
    no: number;
    uniqNo: string | number;
    beginTime: number;
    duration: number;
    hasDurationSet: boolean;
    color: string;
    clor?: string;
    size: string;
    type: string;
}
export interface NicoScripterTargetChat {
    beginTime: number;
    text: string;
    isNicoScript: boolean;
    fork: number;
    hasColorCommand: boolean;
    hasSizeCommand: boolean;
    hasTypeCommand: boolean;
    color: string;
    size: string;
    type: string;
    isReverse: boolean;
}
export interface NicoScriptParserContract {
    parseNiwango(lines: string[]): NicoScriptParsedCommand[];
    parseNicos(text: string): NicoScriptParsedCommand;
    splitLines(text: string): string[];
    parseNicosParams(text: string): string[];
}
declare class NicoScriptParser {
    static _count: number | undefined;
    static get parseId(): number;
    static parseNiwango(lines: string[]): NicoScriptParsedCommand[];
    static parseParams(str: string): Record<string, string> | null;
    static parseNicosParams(str: string): string[];
    static parseNicos(text: string): NicoScriptParsedCommand;
    static splitLines(str: string): string[];
    static parseReplace(str: string): {
        src: string;
        dest: string;
        fill: boolean;
        target: string;
        partial: boolean;
    } | null;
    static parseSeek(str: string): {
        time: string;
    } | null;
    static parse置換(str: string): {
        src: string;
        dest: string;
        fill: boolean;
        target: string;
        partial: boolean;
    };
    static parse逆(str: string): {
        target: string;
    };
    static parseジャンプ(str: string): {
        target: string;
        type: string;
        time: string | number;
    };
    static parseジャンプマーカー(str: string): {
        name: string;
    };
}
declare class NicoScripter extends Emitter {
    _hasSort: boolean;
    _list: NicoScripterSourceChat[];
    _eventScript: Array<{
        p: NicoScriptParsedCommand;
        nicos: NicoScripterSourceChat;
    }>;
    _assignedEvents: Set<string>;
    _nextVideo: string | null;
    _marker: Record<string, number>;
    _inviewEvents: Record<string, boolean>;
    _currentTime: number;
    _eventId: number;
    emit: (event: string, ...args: unknown[]) => void;
    constructor();
    reset(): void;
    add(nicoChat: NicoScripterSourceChat): void;
    get isEmpty(): boolean;
    getNextVideo(): string;
    getEventScript(): {
        p: NicoScriptParsedCommand;
        nicos: NicoScripterSourceChat;
    }[];
    get currentTime(): number;
    set currentTime(v: number);
    _sort(): void;
    _updateInviewEvents(): void;
    apply(group: any): void;
}
export { NicoScripter, NicoScriptParser };
