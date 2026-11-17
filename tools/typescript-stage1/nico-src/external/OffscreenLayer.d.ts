// 自動生成（Task1061: scripts/gen-external-types.mjs）。手で直さない。元: comment-src/OffscreenLayer.ts
export interface OffscreenTextFieldContract {
    setText(text: string): void;
    setType(type: string, size: string, fontCommand?: string, version?: string): void;
    setFontSizePixel(pixel: number): void;
    getOriginalWidth(): number;
    getWidth(): number;
    getOriginalHeight(): number;
    getHeight(): number;
    measureChat(owner: object, htmlText: string, pixel: number, type: string, size: string, fontCommand: string, version: string): {
        width: number;
        height: number;
    };
}
export interface OffscreenLayerHandleContract {
    getTextField(): OffscreenTextFieldContract;
    appendChild(element: Element): void;
    removeChild(element: Element): void;
    readonly optionCss: string;
}
export interface OffscreenLayerContract {
    get(config?: OffscreenConfigContract): Promise<OffscreenLayerHandleContract>;
    readonly optionCss: string;
}
export interface OffscreenConfigPropsContract {
    baseFontFamily: string;
    baseFontBolder: boolean;
    cssFontWeight: string;
    baseChatScale: number;
}
export interface OffscreenConfigContract {
    readonly props: OffscreenConfigPropsContract;
    onkey<K extends keyof OffscreenConfigPropsContract>(key: K, callback: (value: OffscreenConfigPropsContract[K]) => void): unknown;
}
declare const OffscreenLayer: (config: OffscreenConfigContract) => OffscreenLayerContract;
export { OffscreenLayer };
