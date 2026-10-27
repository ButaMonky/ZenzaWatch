// Task522 typed boundary for pre-existing runtime core.mjs (not emitted).
export declare class HistoryError extends Error {
  readonly code: string;
  readonly httpStatus?: number;
  readonly apiCode?: string;
  readonly retryAfterMs?: number;
  readonly causeCode?: string;
  constructor(code: string, details?: {
    httpStatus?: number; apiCode?: string; retryAfterMs?: number;
    causeCode?: string; rollbackComplete?: boolean;
  });
}
export declare function fail(code: string): never;
