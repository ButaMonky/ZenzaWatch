// 自動生成（Task1061: scripts/gen-external-types.mjs）。手で直さない。元: comment-src/NicoCommentViewModel.ts
import { Emitter } from '../Emitter';
export interface NicoCommentViewModelContract {
    readonly currentTime: number;
    bulkLayoutData: {
        top: unknown;
        naka: unknown;
        bottom: unknown;
    };
}
export interface NicoCommentSlotRow {
    id: unknown;
    slot: number;
    begin: number;
    end: number;
    fork: number;
    no: number;
    invisible?: boolean;
}
export interface NicoCommentSlotReply {
    lastUpdate: number;
    top: NicoCommentSlotRow[];
    naka: NicoCommentSlotRow[];
    bottom: NicoCommentSlotRow[];
}
export interface NicoCommentGroupContract {
    _members: Array<{
        _commentArtMetadata: unknown;
        _y: number;
        _isOverflow: boolean;
        _isLayouted: boolean;
    }>;
    _execCommentLayoutWorker(): Promise<boolean>;
    reset(): void;
    bulkSlotData: NicoCommentSlotRow[];
    bulkLayoutData: unknown[];
    export(): string;
}
interface NicoCommentSourceContract {
    getGroup(type: string): unknown;
    on(event: 'currentTime', listener: (sec: number) => void): unknown;
    on(event: 'change', listener: (payload: unknown) => void): unknown;
    on(event: 'setData' | 'clear' | 'parsed', listener: () => void): unknown;
}
declare class NicoCommentViewModel extends Emitter {
    emit: (name: string, ...args: unknown[]) => void;
    _offScreen: unknown;
    _topGroup: NicoCommentGroupContract;
    _nakaGroup: NicoCommentGroupContract;
    _bottomGroup: NicoCommentGroupContract;
    _slotLayoutWorker: {
        post(message: {
            command: 'layout';
            params: {
                lastUpdate: number;
                top: NicoCommentSlotRow[];
                naka: NicoCommentSlotRow[];
                bottom: NicoCommentSlotRow[];
            };
        }): Promise<NicoCommentSlotReply>;
    } | null | undefined;
    _currentTime: number;
    _lastUpdate: number;
    _commentArtGeneration: number | undefined;
    constructor(...args: [NicoCommentSourceContract]);
    initialize(nicoComment: NicoCommentSourceContract): Promise<void>;
    _onCommentArtProtectionChange(): Promise<void>;
    _onSetData(): void;
    _onClear(): void;
    _onCurrentTime(sec: number): void;
    _onChange(e: unknown): void;
    _onCommentParsed(): void;
    _updateSlotLayout(): Promise<void>;
    get currentTime(): number;
    export(): string;
    getGroup(type: string): NicoCommentGroupContract;
    get bulkLayoutData(): {
        top: unknown[];
        naka: unknown[];
        bottom: unknown[];
    };
    set bulkLayoutData(data: {
        top: unknown[];
        naka: unknown[];
        bottom: unknown[];
    });
}
export { NicoCommentViewModel };
