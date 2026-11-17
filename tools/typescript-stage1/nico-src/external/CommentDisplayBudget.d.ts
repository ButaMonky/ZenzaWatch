// 自動生成（Task1061: scripts/gen-external-types.mjs）。手で直さない。元: comment-src/CommentDisplayBudget.ts
export interface CommentBudgetCandidate {
    beginLeftTiming: number;
    fork?: number;
    isMine?: boolean;
    isUpdating?: boolean;
    isPostFail?: boolean;
}
export interface CommentBudgetOptions<T extends CommentBudgetCandidate> {
    liveCount?: number;
    limit?: number;
    tierOf?: (chat: T) => number;
    order?: (a: T, b: T) => number;
    groupOf?: (chat: T) => unknown;
}
export interface CommentBudgetSuppressed<T> {
    chat: T;
    tier: number;
    reason: string;
}
export interface CommentBudgetResult<T> {
    admitted: T[];
    suppressed: CommentBudgetSuppressed<T>[];
    tiers: Map<T, number>;
}
declare class CommentDisplayBudget {
    static get CONFIG_KEY(): string;
    static get CHOICES(): number[];
    static get DEFAULT(): number;
    static get TIER(): {
        EXEMPT: number;
        MAIN: number;
        EASY: number;
        AI: number;
        HISTORY_MAIN: number;
        HISTORY_EASY: number;
        HISTORY_AI: number;
    };
    static get TIER_NAMES(): string[];
    static get CEILING_RATIO(): number[];
    static normalizeLimit(value: unknown): number;
    static isValidLimit(value: unknown): value is number;
    static isExempt(chat: CommentBudgetCandidate | null | undefined): boolean;
    static tierOf(chat: CommentBudgetCandidate, isHistory?: boolean): number;
    static ceilingOf(tier: number, limit: number): number;
    /**
     * 新しい候補だけを、表示開始前に採否決定する。既存の表示は一切変更しない。
     * @param {Array} candidates まだ表示も見送りもしていない候補
     * @param {{liveCount:number, limit:number, tierOf:function, order?:function}} options
     * @returns {{admitted:Array, suppressed:Array<{chat, tier:number, reason:string}>}}
     */
    static admit<T extends CommentBudgetCandidate>(candidates: readonly T[], { liveCount, limit, tierOf, order, groupOf }?: CommentBudgetOptions<T>): CommentBudgetResult<T>;
}
export { CommentDisplayBudget };
