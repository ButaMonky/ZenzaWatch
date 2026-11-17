// 自動生成（Task1061: scripts/gen-external-types.mjs）。手で直さない。元: comment-src/NicoChatViewModel.ts
export interface NicoChatViewModelContract {
    readonly text: string;
    readonly vpos: number;
    readonly lineCount: number;
    readonly isLayouted: boolean;
}
/**
 * 個別のコメントの表示位置・タイミング計算
 * コメントアート互換は大体こいつにかかっている
 *
 * コメントのサイズ計算まわりが意味不明なコードだらけだが、
 * 仕様書にもない本家のバグを再現しようとするとこうなるので仕方ない。
 * (しかも、これでも全然足りない)
 * 互換性にこだわらないのであれば7割くらいが不要。
 */
declare class NicoChatViewModel {
    static _parsedTextCache: WeakMap<object, any>;
    static prepareCommentArt(members: any): boolean;
    static create(nicoChat: any, offScreen: any): FlashNicoChatViewModel | HTML5NicoChatViewModel;
    constructor(nicoChat: any, offScreen: any);
    initialize(nicoChat: any, offScreen: any): void;
    setType(type: any): void;
    setVpos(vpos: any): void;
    setSize(size: any): void;
    setText(text: any, parsedHtmlText?: string): void;
    resetLayoutForSpeedChange(): void;
    recalcBeginEndTiming(speedRate?: number): void;
    _calcLineHeight({ size, scale }: {
        scale?: number | undefined;
        size: any;
    }): number;
    _calcDoubleResizedLineHeight({ lc, cssScale, size }: {
        cssScale: any;
        lc?: number | undefined;
        size?: any;
    }): number;
    /**
     * 高さ計算。
     * 改行リサイズなどが起こる場合はそれを反映した結果の高さを返す
     * Flashのほうはだんだん計算を諦めていく
     */
    _calculateHeight({ scale, lc, size, isEnder, isDoubleResized }: {
        isDoubleResized: any;
        isEnder: any;
        lc?: number | undefined;
        scale?: number | undefined;
        size: any;
    }): number;
    _setupFixedMode(): void;
    /**
     *  流れる文字のモード
     */
    _setupMarqueeMode(): void;
    _setScale(scale: any): void;
    get bulkLayoutData(): {
        id: any;
        fork: any;
        type: any;
        isOverflow: any;
        isInvisible: any;
        isFixed: any;
        ypos: any;
        slot: any;
        height: any;
        beginLeft: any;
        beginRight: any;
        endLeft: any;
        endRight: any;
        layerId: any;
    };
    set bulkLayoutData(data: {
        id: any;
        fork: any;
        type: any;
        isOverflow: any;
        isInvisible: any;
        isFixed: any;
        ypos: any;
        slot: any;
        height: any;
        beginLeft: any;
        beginRight: any;
        endLeft: any;
        endRight: any;
        layerId: any;
    });
    reset(): void;
    get lineCount(): any;
    get id(): any;
    get text(): any;
    get htmlText(): any;
    set isLayouted(v: any);
    get isInView(): boolean;
    isInViewBySecond(sec: any): boolean;
    get isOverflow(): any;
    set isOverflow(v: any);
    get isInvisible(): any;
    get width(): any;
    get height(): any;
    get duration(): number;
    get speed(): any;
    get inviewTiming(): any;
    get beginLeftTiming(): any;
    get beginRightTiming(): any;
    get endLeftTiming(): any;
    get endRightTiming(): any;
    get vpos(): any;
    get xpos(): number;
    get ypos(): any;
    set ypos(v: any);
    get slot(): any;
    set slot(v: any);
    get color(): any;
    get size(): any;
    get type(): any;
    get cssScale(): number;
    get fontSizePixel(): any;
    get lineHeight(): any;
    get isLineResized(): any;
    get isDoubleResized(): any;
    get threadId(): any;
    get no(): any;
    get uniqNo(): any;
    get layerId(): any;
    get commentArtGroup(): any;
    get fork(): any;
    get nicoru(): any;
    get nicotta(): any;
    /**
     * second時の左端座標を返す
     */
    getXposBySecond(sec: any): number;
    getXposByVpos(vpos: any): number;
    get currentTime(): any;
    get isFull(): any;
    get isFixed(): any;
    get isNicoScript(): any;
    get isMine(): any;
    get isUpdating(): any;
    get isPostFail(): any;
    get isReverse(): any;
    get isSubThread(): any;
    get fontCommand(): any;
    get commentVer(): any;
    get cssScaleY(): number;
    get meta(): string;
    /**
     * コメント同士の衝突を判定
     *
     * @param {NicoChatViewModel} target
     * @return boolean
     */
    checkCollision(target: any): boolean;
    /**
     * (衝突判定に引っかかったので)自分自身を一段ずらす.
     *
     * @param {NicoChatViewModel} others 示談相手
     */
    moveToNextLine(others: any): void;
    get time3d(): any;
    get time3dp(): any;
    get opacity(): any;
}
declare class FlashNicoChatViewModel extends NicoChatViewModel {
}
declare class HTML5NicoChatViewModel extends NicoChatViewModel {
    _calculateHeight({ scale, lc, size, isEnder }: {
        isEnder: any;
        lc?: number | undefined;
        scale?: number | undefined;
        size: any;
    }): number;
    _setScale_(scale: any): void;
    getCssScaleY(): number;
}
export { NicoChatViewModel };
