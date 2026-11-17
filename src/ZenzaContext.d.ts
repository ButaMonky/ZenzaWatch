// Task1069: 型の検査用。src/ZenzaContext.js は空の入れ物を作るだけで、中身は起動の時に入る。
// Task1074: 中身の形は使う側の型（nico-src の shared-types/ZenzaGlobal など）で受けるので、ここでは決めない
// （src/ZenzaWatchIndex.js から借りると、strict な検査で「型の無い JS」として止まるため）。
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export declare const global: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export declare const ZenzaWatch: any;
export declare const NICORU: string;
export declare const dll: {lit?: any; directives?: any; [key: string]: any};
export declare const util: any;
export declare const PRODUCT: string;
export declare const TOKEN: string;
export interface ZenzaStartup {
  /** 部品を読み込んだ時に動かしていた処理を登録する。今の配布物ではその場ですぐ呼ぶ */
  add(name: string, fn: () => void): void;
  defer(): void;
  run(): void;
  readonly pending: string[];
}
export declare const startup: ZenzaStartup;
