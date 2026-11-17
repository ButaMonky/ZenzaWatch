// 自動生成（Task1061: scripts/gen-external-types.mjs）。手で直さない。元: advanced-src/RelatedMenuOrder.ts
export interface RelatedMenuBuiltInOption {
    label?: string;
    openMode?: 'default' | 'same-tab' | 'new-tab' | 'new-window';
    popupWidth?: number;
    popupHeight?: number;
    includePosition?: boolean;
    copyFormat?: 'url' | 'id' | 'position' | 'title-url' | 'markdown';
    urlTemplate?: string;
}
export interface RelatedMenuItem {
    key: string;
    label: string;
    type: 'builtin' | 'link' | 'action';
    present: boolean;
    enabled?: boolean;
}
export interface RelatedMenuLink {
    id: string;
    label: string;
    enabled?: boolean;
    [key: string]: unknown;
}
export interface RelatedMenuAction {
    id: string;
    label: string;
    [key: string]: unknown;
}
export interface RelatedMenuCopyContext {
    videoId?: string | undefined;
    watchId?: string | undefined;
    videoUrl?: string | undefined;
    videoTitle?: string | undefined;
    currentTime?: number | string | undefined;
}
export type RelatedMenuOpener = (url: string, target?: string, features?: string) => unknown;
declare class RelatedMenuOrder {
    static get CONFIG_KEY(): string;
    static get HIDDEN_KEY(): string;
    static get OPTIONS_KEY(): string;
    static get SHORTCUT_ACTION_IDS(): Readonly<Record<string, string>>;
    static get OPEN_MODES(): string[];
    static get COPY_FORMATS(): string[];
    static formatCopy(format: string, context?: RelatedMenuCopyContext): string;
    static openUrl(id: string, url: string, option?: RelatedMenuBuiltInOption, opener?: RelatedMenuOpener): unknown;
    static getOption(options: Record<string, unknown> | null | undefined, id: string): RelatedMenuBuiltInOption;
    static validateOptions(value: unknown): boolean;
    static get STANDARD(): {
        id: string;
        label: string;
    }[];
    static isValidKey(key: unknown): key is string;
    static validateOrder(value: unknown): value is string[];
    static validateHiddenItems(value: unknown): value is string[];
    static isHidden(key: string, hiddenItems: unknown): boolean;
    static entries(links?: RelatedMenuLink[], actions?: RelatedMenuAction[], savedOrder?: unknown): RelatedMenuItem[];
    static orderedKeys(savedOrder: unknown, actualKeys: string[]): string[];
}
export { RelatedMenuOrder };
