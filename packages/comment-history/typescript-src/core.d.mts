// Task460: typed boundary of the existing comment-history core module.
export declare class HistoryError extends Error {
  readonly code: string;
  constructor(code: string);
}
export declare function integerOption(value: unknown,min?: number,max?: number): number;
export declare function fail(code: string): never;
