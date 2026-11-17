// Task1061: src/_template.js の `const global = {...}`（平坦なスコープで全部品が共有する入れ物）の型。
// `declare const global: Loose` の代わりに `declare const global: import('./shared-types/ZenzaGlobal').ZenzaGlobal` と書く。
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = any;
type Command = (command: string, param?: unknown) => unknown;
export interface ZenzaGlobal {
  /** 部品の間の通知（ready・dialog の開閉・設定変更など） */
  emitter: import('../Emitter').EmitterInstance;
  /** 調査用にコンソールから触れる物置き。中身は部品ごとに自由に足している */
  debug: Record<string, Loose>;
  external: {
    execCommand: Command; sendOrExecCommand: Command; sendOrOpen(watchId: string, params?: unknown): unknown;
    [name: string]: Loose;
  };
  PRODUCT: string;
  TOKEN: string;
  CONSTANT: Record<string, Loose>;
  notify(message: string): unknown;
  alert(message: string): unknown;
  /** advanced-src/Config.ts（DataStorage）。値は設定ごとに型が違う */
  config: Loose;
  api: Record<string, Loose>;
  /** WindowResizeObserver が更新する画面の大きさ */
  innerWidth: number;
  innerHeight: number;
  NICORU: Loose;
  dll: Record<string, Loose>;
}
