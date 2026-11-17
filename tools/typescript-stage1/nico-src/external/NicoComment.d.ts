// 自動生成（Task1061: scripts/gen-external-types.mjs）。手で直さない。元: comment-src/NicoComment.ts
import { Emitter } from '../Emitter';
export interface NicoCommentContract {
    currentTime: number;
    readonly chatList: readonly unknown[];
    readonly nonFilteredChatList: readonly unknown[];
    getGroup(type: unknown): unknown;
}
declare class NicoComment extends Emitter {
    _currentTime: number | undefined;
    static getMaxCommentsByDuration(duration?: number): 100 | 250 | 500 | 1000;
    constructor(params: any);
    setXml(xml: any, options: any): Promise<void>;
    setThreads(data: any, options: any): Promise<void>;
    setData(data: any, options: any): Promise<void>;
    setChats(chatsData: any, options?: {}): Promise<void>;
    /**
     * コメント置換器となる関数を生成
     * なにがやりたかったのやら
     */
    buildWordReplacer(replacement: any): (text: any) => any;
    /**
     * 投稿者が設定したコメント置換フィルタを適用する
     */
    _preProcessWordReplacement(group: any, replacementFunc: any): void;
    get chatList(): {
        top: any;
        naka: any;
        bottom: any;
    };
    get nonFilteredChatList(): {
        top: any;
        naka: any;
        bottom: any;
    };
    addChat(nicoChat: any): void;
    removeChat(nicoChat: any): void;
    /**
     * コメントの内容が変化した通知
     * NG設定、フィルタ反映時など
     */
    _onChange(e: any): void;
    _onFilterChange(): void;
    clear(): void;
    get currentTime(): number | undefined;
    set currentTime(sec: number | undefined);
    seek(time: any): void;
    set vpos(vpos: any);
    getGroup(type: any): any;
    /**
     * @returns {NicoChatFilter}
     */
    get filter(): any;
}
export { NicoComment };
