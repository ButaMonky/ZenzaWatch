// Task1073: 本体の設定（src/Config.js の Config。中身は packages/lib/src/infra/DataStorage.js）のうち、nico-src の部品が使う形。
// `declare const Config: Loose` の代わりに `declare const Config: import('./shared-types/ZenzaConfig').ZenzaConfig` と書く。
// 設定の値は設定ごとに型が違うので Loose のまま（値の型は Config の DEFAULT_CONFIG を見る）。呼び方（メソッド名・引数の数）を確かめるための型。
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = any;
type KeyListener = (value: Loose, ...rest: Loose[]) => void;
export interface ZenzaConfigNamespace {
  getValue(key: string): Loose;
  setValue(key: string, value: unknown): void;
  on(key: string, func: (...args: Loose[]) => void): void;
  off(key: string, func: (...args: Loose[]) => void): void;
  onkey(key: string, func: KeyListener): void;
  offkey(key: string, func: KeyListener): void;
  props: Record<string, Loose>;
  refresh(): Promise<void> | void;
  subscribe(subscriber: Loose): Loose;
}
export interface ZenzaConfig {
  /** 設定の値（読むと getValue、書くと setValue）。値の型は設定ごとに違い、受け取る側が自分の形（契約）で読むので Loose */
  props: Loose;
  default: Record<string, Loose>;
  storage: Storage | Record<string, string | undefined>;
  getValue(key: string): Loose;
  setValue(key: string, value: unknown, stored?: boolean): void;
  setValueSilently(key: string, value: unknown): void;
  deleteValue(key: string): void;
  getStorageKey(key: string): string;
  getNativeKey(key: string): string;
  refresh(key?: string, storage?: Record<string, string>): Promise<void>;
  onkey(key: string, callback: KeyListener): void;
  offkey(key: string, callback: KeyListener): void;
  on(event: string, callback: (...args: Loose[]) => void): void;
  off(event: string, callback: (...args: Loose[]) => void): void;
  namespace(name: string): ZenzaConfigNamespace;
  promise(name: string): Promise<Loose>;
  export(isAll?: boolean): Record<string, Loose>;
  import(data: Loose): Loose;
  getKeys(): string[];
}
