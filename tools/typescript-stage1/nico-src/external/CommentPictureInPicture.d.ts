// 自動生成（Task1061: scripts/gen-external-types.mjs）。手で直さない。元: comment-src/CommentPictureInPicture.ts
export interface CommentPictureInPictureStartContract {
    getVideo(): HTMLVideoElement | null;
    getViewModel(): unknown;
    config: unknown;
    onPlay?(): void;
    onPause?(): void;
    onEnd?(): void;
}
export interface CommentPictureInPictureSessionContract {
    readonly isStopped: boolean;
    stop(): void;
}
export interface CommentPictureInPictureContract {
    isSupported(): boolean;
    start(params: CommentPictureInPictureStartContract): Promise<CommentPictureInPictureSessionContract | null>;
    stop(): void;
    toggle(params: CommentPictureInPictureStartContract): Promise<CommentPictureInPictureSessionContract | null>;
    readonly isActive: boolean;
    readonly CommentRenderer: unknown;
    getNakaXpos(chat: unknown, sec: number, width: number): number | null;
}
declare const CommentPictureInPicture: {
    isSupported: () => boolean;
    start: (params: any) => Promise<{
        _startRaf(): void;
        _bindVideo(video: any): void;
        _syncPip(action: any): void;
        _onVideoPlay(): void;
        _onVideoPause(): void;
        _onVideoSeeked(): void;
        _onPipPlay(): void;
        _onPipPause(): void;
        _onResize(): void;
        /** 再生中は currentTime を経過時間で補間する（currentTime の更新が粗いブラウザでも滑らかに流す） */
        _getSmoothTime(video: any, now: any): any;
        _resizeCanvas(video: any): boolean;
        draw(): void;
        _waitForStart(promise: any): Promise<unknown>;
        start(): Promise<void>;
        stop(): void;
    } | null>;
    stop: () => void;
    toggle: (params: any) => Promise<{
        _startRaf(): void;
        _bindVideo(video: any): void;
        _syncPip(action: any): void;
        _onVideoPlay(): void;
        _onVideoPause(): void;
        _onVideoSeeked(): void;
        _onPipPlay(): void;
        _onPipPause(): void;
        _onResize(): void;
        /** 再生中は currentTime を経過時間で補間する（currentTime の更新が粗いブラウザでも滑らかに流す） */
        _getSmoothTime(video: any, now: any): any;
        _resizeCanvas(video: any): boolean;
        draw(): void;
        _waitForStart(promise: any): Promise<unknown>;
        start(): Promise<void>;
        stop(): void;
    } | null>;
    readonly isActive: boolean;
    CommentRenderer: {
        new ({ config, smoothSmallText }: {
            config: any;
            smoothSmallText?: boolean | undefined;
        }): {
            clearCache(): void;
            _getLineHeight(chat: any): any;
            _getFont(chat: any): string;
            _getBitmap(chat: any, scale: any): any;
            _updateSnapshot(viewModel: any, now: any): any;
            _getInView(viewModel: any, sec: any, now: any): {
                naka: any[];
                fixed: any[];
                upcoming: any[];
            };
            draw(ctx: any, { viewModel, sec, width, height, now }: {
                height: any;
                now: any;
                sec: any;
                viewModel: any;
                width: any;
            }): void;
        };
    };
    getNakaXpos: (chat: any, sec: any, width: any) => number | null;
};
export { CommentPictureInPicture };
