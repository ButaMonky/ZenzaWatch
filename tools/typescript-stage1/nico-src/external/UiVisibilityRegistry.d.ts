// 自動生成（Task1061: scripts/gen-external-types.mjs）。手で直さない。元: advanced-src/UiVisibilityRegistry.ts
export type UiVisibilityScope = 'hover' | 'related' | 'comment' | 'bar' | 'scene' | 'info' | 'header';
export interface UiVisibilityDescriptor {
    key: string;
    scope: UiVisibilityScope;
    label: string;
    icon: string;
    selector: string;
    description?: string;
    hidden?: boolean;
}
export interface UiVisibilityConfig {
    resolveSceneSearch?(): {
        enabled: boolean;
    } | null;
    props?: Record<string, unknown>;
    default?: Record<string, unknown>;
    storage?: Storage | Record<string, string | undefined>;
    getValue?(key: string): unknown;
    onkey?(key: string, listener: () => void): unknown;
    offkey?(key: string, listener: () => void): unknown;
    getStorageKey?(key: string): string;
    refresh?(key: string, fallback?: Record<string, string | undefined>): unknown;
    emit?(event: string, ...args: unknown[]): unknown;
    emitAsync?(event: string, ...args: unknown[]): unknown;
}
export interface UiVisibilityCallbacks {
    beforeHide?(entry: UiVisibilityDescriptor, node: HTMLElement): void;
    afterApply?(entry: UiVisibilityDescriptor, visible: boolean): void;
}
export interface UiVisibilityConnection {
    refresh(): void;
    apply(key: string): number;
    dispose(): void;
}
type SavedVisibility = {
    value: string;
    priority: string;
    hidden: boolean | 'until-found';
};
declare class UiVisibilityRegistry {
    static __items: readonly UiVisibilityDescriptor[] | undefined;
    static __byKey: Map<string, UiVisibilityDescriptor> | undefined;
    static __savedDisplay: WeakMap<HTMLElement, SavedVisibility> | undefined;
    static get SHARED_SETTINGS(): Array<[string, string]>;
    static get ITEMS(): readonly UiVisibilityDescriptor[];
    static get _byKey(): Map<string, UiVisibilityDescriptor>;
    static get(key: string): UiVisibilityDescriptor | null;
    static list(scope: string): UiVisibilityDescriptor[];
    static defaults(): {
        [k: string]: boolean;
    };
    static isVisibilityKey(key: string): boolean;
    static descriptors(): {
        id: string;
        label: string;
        category: string;
        subcategory: string;
        type: string;
        icon: string;
        visibilityScope: UiVisibilityScope;
        hidden: boolean;
        description: string;
    }[];
    static get _savedDisplay(): WeakMap<HTMLElement, SavedVisibility>;
    static apply(config: UiVisibilityConfig, root: HTMLElement, key: string, { beforeHide, afterApply }?: UiVisibilityCallbacks): number;
    /**
     * Textual shortcut hints are derived from the same KEY_* values used by
     * ShortcutKeyEmitter. Zero/unbound keys deliberately have no parentheses.
     * Also fixes the hover opacity cascade without changing button idle fade.
     */
    static connectShortcutTooltips(config: UiVisibilityConfig, root: HTMLElement, scope: string): () => void;
    static connect(config: UiVisibilityConfig, root: HTMLElement, scope: string, callbacks?: UiVisibilityCallbacks): UiVisibilityConnection;
    static assertValidManifest(): boolean;
}
export { UiVisibilityRegistry };
