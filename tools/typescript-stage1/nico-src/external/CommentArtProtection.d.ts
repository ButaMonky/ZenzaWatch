// 自動生成（Task1061: scripts/gen-external-types.mjs）。手で直さない。元: comment-src/CommentArtProtection.ts
export interface CommentArtCandidate {
    date: number;
    layerId: number;
    vpos: number;
    fork: number;
    userId?: string | number | null;
    threadId?: string | number;
    no?: string | number;
    type?: string;
    text?: unknown;
    cmd?: string;
    isCA?: boolean;
    isPatissier?: boolean;
    isFull?: boolean;
    isEnder?: boolean;
    isInvisible?: boolean;
    isDeleted?: boolean;
    isNicoScript?: boolean;
}
export interface CommentArtGroup {
    layerId: string;
    group: string;
}
/**
 * Probable stacked-comment art: display metadata only, never destructive deduplication.
 * Marker/multiline scoring and author/time grouping are informed by niconicomments keepCA.
 * This conservative Zenza implementation keeps existing font/scale rules and source data.
 */
declare class CommentArtProtection {
    static analyze<T extends CommentArtCandidate>(chats: readonly T[], { enabled }?: {
        enabled?: boolean;
    }): Map<T, CommentArtGroup>;
}
export { CommentArtProtection };
