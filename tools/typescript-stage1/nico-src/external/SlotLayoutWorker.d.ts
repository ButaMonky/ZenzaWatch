// 自動生成（Task1061: scripts/gen-external-types.mjs）。手で直さない。元: comment-src/SlotLayoutWorker.ts
export interface SlotLayoutCommentContract {
    begin: number;
    end: number;
    no: number;
    fork: number;
    invisible?: boolean;
    slot?: number;
}
export interface SlotLayoutRequestContract {
    top: SlotLayoutCommentContract[];
    naka: SlotLayoutCommentContract[];
    bottom: SlotLayoutCommentContract[];
    lastUpdate: number;
}
export interface SlotLayoutResponseContract extends SlotLayoutRequestContract {
}
export interface SlotLayoutWorkerRequestMessage {
    command: 'layout';
    params: SlotLayoutRequestContract;
}
export interface SlotLayoutWorkerScopeContract {
    onmessage?: (message: SlotLayoutWorkerRequestMessage) => SlotLayoutResponseContract;
}
export interface SlotLayoutRpcClientContract {
    post(message: SlotLayoutWorkerRequestMessage): Promise<SlotLayoutResponseContract>;
}
export interface SlotLayoutWorkerContract {
    readonly _func: (self: SlotLayoutWorkerScopeContract) => void;
    create(): SlotLayoutRpcClientContract | null;
}
declare const SlotLayoutWorker: SlotLayoutWorkerContract;
export { SlotLayoutWorker };
