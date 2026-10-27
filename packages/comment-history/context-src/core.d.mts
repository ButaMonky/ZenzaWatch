// Task526: typed boundaries of the separately-owned core.mjs validator.
export type HistoryFork = 'main' | 'owner' | 'easy';
export interface HistoryTarget {
  readonly id: string;
  readonly fork: HistoryFork;
}
export interface HistoryContext {
  readonly videoId: string;
  readonly server: string;
  readonly language: string;
  readonly targets: readonly HistoryTarget[];
  readonly threadKey: string;
}
export interface HistoryComment {
  id: string;
  no: number;
  vposMs: number;
  body: string;
  userId: string;
  commands: string[];
  postedAt: string;
  [extra: string]: unknown;
}
export interface NormalizedThread extends HistoryTarget {
  commentCount: number;
  comments: HistoryComment[];
}
export declare class HistoryError extends Error {
  readonly code: string;
  constructor(code: string);
}
export declare function normalizeWatch(raw: unknown,videoId: string): HistoryContext;
export declare function validateThreads(
  raw: unknown, context: HistoryContext,
  targets?: readonly HistoryTarget[]
): NormalizedThread[];
export declare function integerOption(
  value: unknown,min: number,max: number
): number;
