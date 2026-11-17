// 自動生成（Task1061: scripts/gen-external-types.mjs）。手で直さない。元: comment-src/NicoChatCss3View.ts
export interface NicoChatCss3ViewContract {
    readonly chat: unknown;
    readonly cssText?: string;
    readonly renderedHtml?: string;
}
/** Normalized rendering data supplied by NicoChatViewModel. */
export interface NicoChatCssRenderInput {
    id: string;
    meta: string;
    htmlText: string;
    commentVer: string;
    size: string;
    color: string;
    fork: number;
    duration: number;
    speed: number;
    beginLeftTiming: number;
    width: number;
    height: number;
    ypos: number;
    slot: number;
    opacity: number;
    cssScale: number;
    cssScaleY: number;
    fontSizePixel: number;
    lineHeight: number;
    isDoubleResized: boolean;
    isLineResized: boolean;
    isOverflow: boolean;
    isMine: boolean;
    isUpdating: boolean;
    isInvisible: boolean;
    isSubThread: boolean;
    isPostFail: boolean;
    isReverse: boolean;
    nicotta: boolean | number;
    fontCommand: string | null | undefined;
}
export interface NicoChatCssResult {
    inline: string;
    keyframes?: string;
}
declare class NicoChatCss3View {
    /**
     *
     * @param {NicoChatViewModel}chat
     * @param {string} type
     * @param {string} size
     * @param {{inline: string, keyframes: string}} cssText
     * @return {HTMLElement}
     */
    static buildChatDom(chat: NicoChatCssRenderInput, type: string, size: string, cssText?: NicoChatCssResult, document?: Document): HTMLSpanElement;
    static buildStyleElement(cssText: string, document?: Document): HTMLStyleElement;
    static buildChatHtml(chat: NicoChatCssRenderInput, type: string, cssText: NicoChatCssResult, document?: Document): string;
    static buildChatCss(chat: NicoChatCssRenderInput, type: string, currentTime?: number, playbackRate?: number): NicoChatCssResult;
    static _buildNakaCss(chat: NicoChatCssRenderInput, type: string, currentTime: number, playbackRate: number): NicoChatCssResult;
    /**
     * @param {NicoChatViewModel} chat
     */
    static _buildFixedCss(chat: NicoChatCssRenderInput, type: string, currentTime: number, playbackRate: number): NicoChatCssResult;
}
export { NicoChatCss3View };
