// 自動生成（Task1061: scripts/gen-external-types.mjs）。手で直さない。元: p12-src/ManualBookmarkPanel.ts
/**
 * P12-03 optional standalone manual bookmark panel.
 * Never takes ownership of the native seekbar or automatic resume markers.
 */
import type { ManualBookmarkPanelSnapshot } from './ManualBookmarkSession.ts';
import { ManualBookmarkSession } from './ManualBookmarkSession.ts';
import type { ManualBookmark } from './ManualBookmarkPolicy.ts';
export interface ManualBookmarkLibraryEntry {
    videoId: string;
    title: string;
    duration: number;
    updatedAt: number;
    automaticTime: number | null;
    bookmarks: readonly ManualBookmark[];
    thumbnailUrl?: string;
    viewedAt?: number;
}
export interface ManualBookmarkPanelDependencies {
    libraryAppearance?: () => {
        showVideoThumbnails: boolean;
        showScenePreviews: boolean;
        thumbnailWidth: number;
        titleFontSize: number;
        titleLines: number;
    };
    automaticViewedAt?: () => number | null;
    setRecordingEnabled?: (enabled: boolean) => void;
    createVideoThumbnail?: (host: HTMLElement, video: ManualBookmarkLibraryEntry) => () => void;
    createScenePreview?: (host: HTMLElement, videoId: string, time: number) => () => void;
    loadLibrary?: () => Promise<readonly ManualBookmarkLibraryEntry[]>;
    openLibraryPosition?: (videoId: string, time: number, endTime?: number) => void;
    editLibraryBookmark?: (videoId: string, id: string, changes: {
        time: number;
        endTime?: number;
        label: string;
    }, duration: number) => Promise<void>;
    deleteLibraryBookmark?: (videoId: string, id: string, duration: number) => Promise<void>;
    editLibraryAutomatic?: (videoId: string, time: number, duration: number) => Promise<void>;
    deleteLibraryAutomatic?: (videoId: string) => Promise<void>;
    onRepeatRangeChange?: (range: {
        a: number | null;
        b: number | null;
        active: boolean;
    } | null) => void;
    currentVideoId: () => string | null | undefined;
    currentTime: () => number;
    timestamp: () => number;
    newId: () => string;
    seek: (seconds: number) => void;
    duration?: () => number;
    automaticTime?: () => number | null;
    editAutomatic?: (seconds: number) => Promise<boolean>;
    deleteAutomatic?: () => Promise<boolean>;
    recordingEnabled?: () => boolean;
    repeatEnabled?: () => boolean;
    repeatState?: (active: boolean) => void;
    /** Read-only feed for the seekbar owner; never manipulates native seek DOM. */
    onBookmarksChange?: (snapshot: ManualBookmarkPanelSnapshot) => void;
}
export declare class ManualBookmarkPanel {
    private readonly root;
    private readonly session;
    private readonly deps;
    private readonly unsubscribe;
    private disposed;
    private last;
    private readonly clickHandler;
    private readonly keyHandler;
    private readonly inputHandler;
    private addDraftRevision;
    private pointDrafts;
    private loop;
    /** Persist an AB seek failure across dock redraws, but never across videos. */
    private loopFailureNotice;
    private awaitingLoopSeek;
    private pointGeneration;
    private pointBusyRequest;
    private automaticDraftDirty;
    private automaticDraftRevision;
    private activeTab;
    private visible;
    private previewLeases;
    private previewLeaseKeys;
    private previewCandidates;
    private previewObserver;
    private previewObserved;
    private library;
    private libraryGeneration;
    private libraryRows;
    private libraryStatus;
    private librarySearch;
    private libraryFilter;
    private libraryVirtual;
    private videoThumbnailLeases;
    private libraryResetScroll;
    private libraryDrafts;
    private expandedVideos;
    private readonly changeHandler;
    setVisible(visible: boolean): void;
    private clearPreviews;
    private preview;
    private previewEligible;
    private fillPreviewLeases;
    private refreshPreviews;
    setRepeatRange(a: number, b: number, activate?: boolean): boolean;
    private selectTab;
    get isRepeating(): boolean;
    refreshPreferences(): void;
    private static formatTime;
    static parseTime(value: string): number | null;
    private loopSeekRequestedAt;
    private loopSeekAttempts;
    private resetLoopSeek;
    private stopLoopAfterSeekFailure;
    stopUnresponsiveRepeat(): void;
    private issueLoopSeek;
    /** Called by the real media clock. No timer and no forced play on pause. */
    tick(time: number, paused: boolean, seeking: boolean): boolean;
    /** A seek event is not proof of landing: verify the current interval and clock. */
    acknowledgeLoopSeek(time: number): void;
    repeatAtEnd(): boolean;
    private pointButton;
    private pointField;
    private pointSection;
    private renderPointControls;
    private pointMessage;
    private updateLoopDisplay;
    private updatePointBusyControls;
    private pointAction;
    constructor(root: HTMLElement, session: ManualBookmarkSession, deps: ManualBookmarkPanelDependencies);
    private ownsVideo;
    private button;
    private render;
    private onClick;
    private captureLibraryDrafts;
    private libraryButton;
    private loadLibrary;
    private renderLibrary;
    private renderLibraryGroups;
    private releaseVideoThumbnails;
    private renderLibraryGroup;
    private viewedDate;
    private libraryRow;
    private libraryBusyRequest;
    private libraryAction;
    dispose(): void;
}
