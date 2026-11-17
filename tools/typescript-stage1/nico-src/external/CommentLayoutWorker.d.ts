// 自動生成（Task1061: scripts/gen-external-types.mjs）。手で直さない。元: comment-src/CommentLayoutWorker.ts
export interface CommentLayoutWorkerContract {
    top: readonly unknown[];
    naka: readonly unknown[];
    bottom: readonly unknown[];
    lastUpdate: number;
}
export interface CommentLayoutMember {
    id: unknown;
    layerId: unknown;
    type: string;
    isFixed: boolean;
    isOverflow: boolean;
    isInvisible: boolean;
    invisible?: boolean;
    height: number;
    ypos: number;
    beginLeft: number;
    beginRight: number;
    endLeft: number;
    endRight: number;
}
export interface CommentLayoutParams {
    type: string;
    members: CommentLayoutMember[];
    lastUpdate: number;
}
export interface CommentLayoutWorkerMessage {
    command: 'layout';
    params: CommentLayoutParams;
}
export interface CommentLayoutWorkerScope {
    onmessage?: (message: CommentLayoutWorkerMessage) => CommentLayoutParams;
}
declare const CommentLayoutWorker: {
    _func: (self: CommentLayoutWorkerScope) => void;
    create: () => any;
    getInstance(): {
        post(message: CommentLayoutWorkerMessage): Promise<CommentLayoutParams>;
    } | null;
};
export { CommentLayoutWorker };
