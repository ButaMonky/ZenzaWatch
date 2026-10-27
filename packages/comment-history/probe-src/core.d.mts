// Task520: isolated compile-time contract for read-only nvComment probing.
// The source-of-truth implementation remains packages/comment-history/src/core.mjs.
export interface ProbeTarget {
  id: string;
  fork: 'main' | 'owner' | 'easy';
}
export interface ProbeContext {
  videoId: string;
  language: string;
  targets: readonly ProbeTarget[];
  server: string;
  threadKey?: string;
}
export interface ProbeComment {
  no: number;
  postedAt: string;
  vposMs: number;
}
export interface ProbeThread extends ProbeTarget {
  commentCount: number;
  comments: ProbeComment[];
}
export interface ProbeThreadSummary extends ProbeTarget {
  commentCountField: number;
  returnedCount: number;
  oldestUnixSeconds: number | null;
  newestUnixSeconds: number | null;
  minNo: number | null;
  maxNo: number | null;
  ascendingPostedAt: boolean;
  ascendingNo: boolean;
  ascendingVpos: boolean;
}
export declare function integerOption(
  value: unknown,min: number,max: number
): number;
export declare function validateThreads(
  body: unknown,context: ProbeContext,targets?: readonly ProbeTarget[]
): ProbeThread[];
export declare function summarizeThreads(
  threads: readonly ProbeThread[]
): ProbeThreadSummary[];
