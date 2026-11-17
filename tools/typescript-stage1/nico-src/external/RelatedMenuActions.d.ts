// 自動生成（Task1061: scripts/gen-external-types.mjs）。手で直さない。元: menu-src/RelatedMenuActions.ts
export interface RelatedMenuActionContext {
    videoId?: string;
    watchId?: string;
    videoUrl?: string;
    videoTitle?: string;
    uploaderUserId?: string;
    uploaderChannelId?: string;
    uploaderName?: string;
    currentTime?: string | number;
    [key: string]: unknown;
}
export interface RelatedMenuActionLink {
    id: string;
    label: string;
    kind?: 'link' | 'copy';
    enabled?: boolean;
    url?: string;
    copyTemplate?: string;
    shortcutKey?: number;
    openInNewTab?: boolean;
    openMode?: 'default' | 'same-tab' | 'new-tab' | 'new-window';
    popupWidth?: number;
    popupHeight?: number;
}
export interface RelatedMenuVideoInfo {
    videoId?: unknown;
    watchId?: unknown;
    title?: unknown;
    owner?: {
        type?: string;
        id?: string | number;
        name?: string;
    } | null;
}
export interface RelatedMenuTrustedAction {
    id: string;
    label: string;
    action: (context: RelatedMenuActionContext) => unknown;
    available?: (context: RelatedMenuActionContext) => boolean;
}
declare class RelatedMenuActions {
    static __actions: Map<string, RelatedMenuTrustedAction> | undefined;
    static __listeners: Set<() => void> | undefined;
    static get CONFIG_KEY(): string;
    static get VARIABLES(): string[];
    static get _actions(): Map<string, RelatedMenuTrustedAction>;
    static get _listeners(): Set<() => void>;
    static _notify(): void;
    static onChange(listener: () => void): () => boolean;
    static _safeId(id: unknown): id is string;
    static _validateUrlTemplate(template: unknown): template is string;
    static isCopy(item: {
        kind?: unknown;
    } | null | undefined): boolean;
    static validateCopyTemplate(template: unknown): template is string;
    static resolveCopy(template: unknown, context?: Record<string, unknown>): {
        text: string | null;
        missing: string[];
        invalid?: string[];
    };
    static validateLinks(input: unknown): {
        valid: boolean;
        errors: string[];
        links: RelatedMenuActionLink[];
    };
    static getLinks(input: unknown): RelatedMenuActionLink[];
    static openShortcutsByIds(input: unknown, ids: unknown, context: Record<string, unknown>, opener?: (url: string, target?: string, popup?: string) => unknown, copier?: (text: string) => void | Promise<unknown>): number;
    static makeContext(videoInfo: RelatedMenuVideoInfo | null | undefined, currentTime?: unknown): Readonly<RelatedMenuActionContext>;
    static resolveUrl(template: unknown, context?: Record<string, unknown>): {
        url: string | null;
        missing: string[];
        invalid?: string[];
    };
    static register({ id, label, action, available }?: Partial<RelatedMenuTrustedAction>): () => void;
    static unregister(id: string): boolean;
    static getActions(context: RelatedMenuActionContext): Array<{
        id: string;
        label: string;
        enabled: boolean;
    }>;
    static invoke(id: string, context: RelatedMenuActionContext): boolean;
}
export { RelatedMenuActions };
