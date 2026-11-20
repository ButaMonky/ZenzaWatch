// 自動生成（Task1061: scripts/gen-external-types.mjs）。手で直さない。元: comment-src/NicoCommentCss3PlayerView.ts
import { Emitter } from '../Emitter';
export interface NicoCommentCss3PlayerViewContract {
    playbackRate: number;
    displayLimit: number;
    pause(): void;
    play(): void;
}
/**
 * ニコニコ動画のコメントをCSS3アニメーションだけで再現出来るよ
 * という一発ネタのつもりだったのだが意外とポテンシャルが高かった。
 *
 * DOM的に隔離されたiframeの領域内で描画する
 */
declare class NicoCommentCss3PlayerView extends Emitter {
    constructor(params: any);
    _initializeView(params: any, retryCount: any): void;
    _getIframe(): HTMLIFrameElement;
    _onCommand(command: any, param: any): void;
    _adjust(): any;
    getView(): any;
    set playbackRate(playbackRate: any);
    get playbackRate(): any;
    setAspectRatio(ratio: any): void;
    _onSetData(): void;
    _resetDisplayStats(): void;
    /**
     * 増量(過去コメント)由来かどうかの判定を外から受け取る。
     * NicoChatに永続フラグは持たせず、CommentHistoryRendererの保持情報を参照する。
     */
    setHistoryClassifier(fn: any): void;
    _isHistoryChat(nicoChat: any): boolean;
    get displayLimit(): number;
    _updateMotionFrameRate(): void;
    _setMotionEasing(element: any, fps: any): void;
    /** 診断用: 取得数ではなく「描画側」の数と、見送り・終了の理由別の累計 */
    get displayStats(): {
        limit: number;
        live: any;
        dom: any;
        suppressedNow: any;
        admitted: any;
        exempt: any;
        expired: any;
        suppressed: {
            limit: any;
            reserve: any;
        };
    };
    _onCurrentTime(sec: any): void;
    _addClass(name: any): void;
    _removeClass(name: any): void;
    _setStall(v: any): void;
    pause(): void;
    play(): void;
    clear(): void;
    refresh(): void;
    _updateInviewElements(): void;
    /**
     * 寿命の終わったコメントを全ての管理表から外し、DOMを削除予約する。
     * 見送ったコメントも寿命が終われば表から外す（同じ寿命の間は再判定しない）。
     */
    _collectExpired(currentTime: any): void;
    _updateDom(): void;
    buildHtml(currentTime: any): any;
    _buildGroupHtml(m: any, currentTime?: number): string;
    _buildGroupCss(m: any, currentTime: any): string;
    show(): void;
    hide(): void;
    appendTo(node: any): void;
    /**
     * exportで、コメントを静的なCSS3アニメーションHTMLとして出力する。
     * 生成されたHTMLを開くだけで、スクリプトもなにもないのに
     * ニコニコ動画のプレイヤーのようにコメントが流れる。 ふしぎ！
     */
    export(): any;
    getCurrentScreenHtml(): any;
    getCurrentScreenSvg(): string | null;
}
export { NicoCommentCss3PlayerView };
