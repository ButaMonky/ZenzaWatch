// Task1061: 平坦なスコープで使っている lodash（@require lodash@4）のうち、nico-src が実際に呼ぶ関数だけの型。
// `declare const _: Loose` の代わりに `declare const _: import('./shared-types/Lodash').LodashSubset` と書く。
// 使う関数を増やしたらここにも足す（無い関数を呼ぶと型エラーになる＝lodash 4 に無い関数の呼び出しを防げる）。
type AnyFunction = (...args: never[]) => unknown;
export interface Cancelable<F extends AnyFunction> {
  (...args: Parameters<F>): ReturnType<F> | undefined;
  cancel(): void;
  flush(): ReturnType<F> | undefined;
}
export interface DebounceOptions { leading?: boolean | undefined; trailing?: boolean | undefined; maxWait?: number | undefined }
export interface ThrottleOptions { leading?: boolean | undefined; trailing?: boolean | undefined }
type Iteratee<T> = ((value: T) => unknown) | string;
export interface LodashSubset {
  readonly VERSION: string;
  debounce<F extends AnyFunction>(func: F, wait?: number, options?: DebounceOptions): Cancelable<F>;
  throttle<F extends AnyFunction>(func: F, wait?: number, options?: ThrottleOptions): Cancelable<F>;
  noop(...args: unknown[]): undefined;
  isNumber(value: unknown): value is number;
  isBoolean(value: unknown): value is boolean;
  isFunction(value: unknown): value is (...args: unknown[]) => unknown;
  isArray(value: unknown): value is unknown[];
  sortBy<T>(collection: readonly T[] | null | undefined, ...iteratees: (Iteratee<T> | Iteratee<T>[])[]): T[];
  shuffle<T>(collection: readonly T[] | null | undefined): T[];
  defaults<T extends object, S extends object>(object: T, ...sources: S[]): T & S;
  sortedLastIndex<T>(array: readonly T[] | null | undefined, value: T): number;
  pull<T>(array: T[], ...values: T[]): T[];
  has(object: unknown, path: string | readonly string[]): boolean;
  each<T>(collection: readonly T[], iteratee: (value: T, index: number) => unknown): readonly T[];
}
