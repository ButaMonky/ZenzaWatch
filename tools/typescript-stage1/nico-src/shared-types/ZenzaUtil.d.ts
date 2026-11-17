// Task1061: src/util.js の `util`（各部品の関数を Object.assign で1つにまとめた入れ物）の型。
// `declare const util: Loose` の代わりに `declare const util: import('./shared-types/ZenzaUtil').ZenzaUtil` と書く。
// まとめ方は src/util.js と同じ順番（後から足したものが勝つ）。JS だけの部品は Loose のまま。
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = any;
type Css = typeof import('../css').css;
type TextUtil = typeof import('../textUtil').textUtil;
type NicoUtil = typeof import('../nicoUtil').nicoUtil;
type MessageUtil = typeof import('../messageUtil').messageUtil;
type Env = typeof import('../env').env;
type NetUtil = typeof import('../netUtil').netUtil;
type DomEvent = typeof import('../domEvent').domEvent;
type Later = {
  reg: Loose;
  fullscreen: typeof import('../Fullscreen').Fullscreen;
  copyToClipBoard: (typeof import('../Clipboard').Clipboard)['copyText'];
  videoCapture: (typeof import('../VideoCaptureUtil').VideoCaptureUtil)['capture'];
  capTube: (typeof import('../VideoCaptureUtil').VideoCaptureUtil)['capTube'];
  saveMymemory: typeof import('../saveMymemory').saveMymemory;
  speak: (typeof import('../speech').speech)['speak'];
  watchResize: typeof import('../watchResize').watchResize;
  sortedLastIndex(arr: ArrayLike<number | string>, value: number | string): number;
  createVideoElement: typeof import('../createVideoElement').createVideoElement;
  $: typeof import('../uQuery').uQuery;
  createDom: (typeof import('../uQuery').uQuery)['html'];
  isTL: (typeof import('../uQuery').uQuery)['isTL'];
  RequestAnimationFrame: Loose;
  /** packages/lib/src/css/StyleSwitcher.js（JS のみ） */
  StyleSwitcher: Loose;
  dimport: typeof import('../dimport').dimport;
  VideoItemObserver: typeof import('../VideoItemObserver').VideoItemObserver;
  NicoQuery: typeof import('../NicoQuery').NicoQuery;
  sleep: typeof import('../sleep').sleep;
  bounce: typeof import('../bounce').bounce;
};
/** 後から Object.assign したものが同じ名前を上書きする */
type Assign<A, B> = Omit<A, keyof B> & B;
export type ZenzaUtil =
  Assign<Assign<Assign<Assign<Assign<Assign<Assign<Css, TextUtil>, NicoUtil>, MessageUtil>, Env>, NetUtil>, DomEvent>, Later>;
