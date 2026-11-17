// 自動生成（Task1061: scripts/gen-external-types.mjs）。手で直さない。元: p12-src/ManualBookmarkVirtualList.ts
export interface ManualBookmarkVirtualListOptions<T> {
    key: (item: T) => string;
    estimate: (item: T) => number;
    render: (item: T) => HTMLElement;
    release: (node: HTMLElement) => void;
    pinned?: (node: HTMLElement) => boolean;
    changed?: () => void;
    inset?: () => number;
}
/** One continuous scroll range; only visible/overscan groups own live DOM. */
export declare class ManualBookmarkVirtualList<T> {
    private items;
    private heights;
    private offsets;
    private mounted;
    private spacers;
    private observer;
    private frame;
    private disposed;
    private active;
    private pausedScroll;
    private placeholder;
    private readonly scroll;
    private readonly win;
    private container;
    private scroller;
    private options;
    constructor(container: HTMLElement, scroller: HTMLElement, options: ManualBookmarkVirtualListOptions<T>);
    private rebuild;
    private viewport;
    private indexAt;
    setItems(items: readonly T[], reset?: boolean): void;
    setActive(active: boolean): void;
    private cancel;
    private schedule;
    private releaseAll;
    refresh(): void;
    dispose(): void;
}
