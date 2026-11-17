// 自動生成（Task1061: scripts/gen-external-types.mjs）。手で直さない。元: p12-src/ManualBookmarkPolicy.ts
/**
 * P12-03: user-created bookmarks are NOT automatic resume positions.
 * Pure and storage-independent; an explicit separate bookmark store will own
 * persistence. No native marker/CSS or WatchInfoCacheDb mutation here.
 */
export type ManualBookmark = Readonly<{
    id: string;
    videoId: string;
    time: number;
    endTime?: number;
    label: string;
    createdAt: number;
    updatedAt: number;
}>;
export type ManualBookmarkDraft = Readonly<{
    id: string;
    videoId: string;
    time: number;
    endTime?: number;
    label?: string;
    now: number;
}>;
export type ManualBookmarkChanges = Readonly<{
    time: number;
    endTime?: number;
    label: string;
}>;
export declare function normalizeManualBookmarks(raw: unknown, videoId: string, duration: number): readonly ManualBookmark[];
export declare function addManualBookmark(existing: readonly ManualBookmark[], draft: ManualBookmarkDraft, duration: number): readonly ManualBookmark[];
export declare function updateManualBookmark(existing: readonly ManualBookmark[], videoId: string, id: string, changes: ManualBookmarkChanges, now: number, duration: number): readonly ManualBookmark[];
export declare function renameManualBookmark(existing: readonly ManualBookmark[], videoId: string, id: string, label: string, now: number): readonly ManualBookmark[];
export declare function removeManualBookmark(existing: readonly ManualBookmark[], videoId: string, id: string): readonly ManualBookmark[];
