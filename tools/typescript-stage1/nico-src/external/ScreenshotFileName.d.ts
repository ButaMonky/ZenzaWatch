// 自動生成（Task1061: scripts/gen-external-types.mjs）。手で直さない。元: advanced-src/ScreenshotFileName.ts
export interface ScreenshotFilenameOptions {
    prefix?: string;
    template?: string;
    title?: string;
    watchId?: string;
    videoId?: string;
    uploader?: string;
    currentTime?: number;
    suffix?: string;
    now?: Date;
    formatTime?: (currentTime: number) => string | null | undefined;
}
declare class ScreenshotFileName {
    static get DEFAULT_TEMPLATE(): string;
    static get TOKENS(): string[];
    static get PRESETS(): {
        name: string;
        value: string;
    }[];
    static validateTemplate(value: unknown): boolean;
    static _safe(value: unknown): string;
    static format({ prefix, template, title, watchId, videoId, uploader, currentTime, suffix, now, formatTime }?: ScreenshotFilenameOptions): string;
}
export { ScreenshotFileName };
