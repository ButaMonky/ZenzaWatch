// 自動生成（Task1061: scripts/gen-external-types.mjs）。手で直さない。元: p12-src/ManualBookmarkSession.ts
/**
 * P12-03: UI-independent manual-bookmark session owner.
 * A scene switch invalidates delayed responses from the previous video.
 * It owns subscriptions only, never native seekbar or automatic resume state.
 */
import type { ManualBookmark, ManualBookmarkDraft, ManualBookmarkChanges } from './ManualBookmarkPolicy.ts';
export interface ManualBookmarkSessionRepository {
    load(videoId: string, duration: number): Promise<readonly ManualBookmark[]>;
    add(draft: ManualBookmarkDraft, duration: number): Promise<readonly ManualBookmark[]>;
    update?(videoId: string, id: string, changes: ManualBookmarkChanges, now: number, duration: number): Promise<readonly ManualBookmark[]>;
    rename(videoId: string, id: string, label: string, now: number, duration: number): Promise<readonly ManualBookmark[]>;
    remove(videoId: string, id: string, duration: number): Promise<readonly ManualBookmark[]>;
    close(): void;
}
export type BookmarkPanelStatus = 'idle' | 'loading' | 'ready' | 'error';
export type ManualBookmarkPanelSnapshot = Readonly<{
    status: BookmarkPanelStatus;
    videoId: string | null;
    bookmarks: readonly ManualBookmark[];
}>;
export type ManualBookmarkActionResult = Readonly<{
    status: 'applied' | 'stale' | 'error';
    snapshot: ManualBookmarkPanelSnapshot;
}>;
type OnSnapshot = (value: ManualBookmarkPanelSnapshot) => void;
export declare class ManualBookmarkSession {
    private readonly repository;
    private readonly listeners;
    /** Broadcast only invalidation, never video IDs or bookmark content. */
    private readonly changeChannel;
    private current;
    private generation;
    private latestAction;
    private activating;
    private failedAction;
    private readbackRevision;
    /** A background read must never overwrite an unfinished local edit. */
    private inFlightWrites;
    private refreshing;
    private peerRefreshPending;
    private disposed;
    private failedLoad;
    private state;
    constructor(repository: ManualBookmarkSessionRepository);
    /** Coalesce peer invalidations, but never lose one behind an older read/write. */
    private drainPeerRefresh;
    private notifyOtherTabs;
    /** Library writes share this invalidation path only after storage commits. */
    notifyCommittedChange(): void;
    get snapshot(): ManualBookmarkPanelSnapshot;
    /** Only initial load failures may be retried on Dock open; write failures keep drafts. */
    get needsLoadRetry(): boolean;
    subscribe(listener: OnSnapshot): () => void;
    private publishState;
    private isCurrent;
    activate(videoId: string, duration: number): Promise<ManualBookmarkActionResult>;
    private loadActivated;
    private modify;
    /**
     * A Dock reopen or visible-tab event checks the shared IndexedDB without
     * resetting the active video owner or discarding a pending local write.
     * Only changed records publish a new snapshot (and re-render the panel).
     */
    refreshIfIdle(): Promise<ManualBookmarkActionResult>;
    add(id: string, time: number, now: number, label?: string, endTime?: number): Promise<ManualBookmarkActionResult>;
    update(id: string, changes: ManualBookmarkChanges, now: number): Promise<ManualBookmarkActionResult>;
    rename(id: string, label: string, now: number): Promise<ManualBookmarkActionResult>;
    remove(id: string): Promise<ManualBookmarkActionResult>;
    deactivate(): void;
    dispose(): void;
}
export {};
