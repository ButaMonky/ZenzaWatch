// 自動生成（Task1061: scripts/gen-external-types.mjs）。手で直さない。元: p12-src/ManualBookmarkStore.ts
import type { ManualBookmark, ManualBookmarkDraft, ManualBookmarkChanges } from './ManualBookmarkPolicy.ts';
export type BookmarkUpdate = (raw: unknown) => readonly ManualBookmark[];
export interface BookmarkAtomicBackend {
    read(videoId: string): Promise<unknown>;
    list?(): Promise<BookmarkRow[]>;
    update(videoId: string, change: BookmarkUpdate): Promise<void>;
    close(): void;
}
export type BookmarkRow = {
    videoId: string;
    items: readonly ManualBookmark[];
};
/** Uses a distinct database: watch-history garbage collection cannot erase bookmarks. */
export declare class IndexedDbManualBookmarkBackend implements BookmarkAtomicBackend {
    private db;
    private opening;
    private cancelOpening;
    private readonly activeTransactions;
    private readonly factory;
    constructor(factory: IDBFactory);
    private open;
    read(videoId: string): Promise<unknown>;
    list(): Promise<BookmarkRow[]>;
    update(videoId: string, change: BookmarkUpdate): Promise<void>;
    close(): void;
}
/** Enforces the per-video invariant before changing a persisted record. */
export declare class ManualBookmarkRepository {
    private readonly backend;
    constructor(backend: BookmarkAtomicBackend);
    private checked;
    load(videoId: string, duration: number): Promise<readonly ManualBookmark[]>;
    list(): Promise<BookmarkRow[]>;
    update(videoId: string, id: string, changes: ManualBookmarkChanges, now: number, duration: number): Promise<readonly ManualBookmark[]>;
    add(draft: ManualBookmarkDraft, duration: number): Promise<readonly ManualBookmark[]>;
    rename(videoId: string, id: string, label: string, now: number, duration: number): Promise<readonly ManualBookmark[]>;
    remove(videoId: string, id: string, duration: number): Promise<readonly ManualBookmark[]>;
    close(): void;
}
