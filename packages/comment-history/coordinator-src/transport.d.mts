// Task522: no new transport or network access; only typed signatures.
export type SafeRequestError = {
  code: string; httpStatus?: number; apiCode?: string;
  retryAfterMs?: number; causeCode?: string;
};
export declare function withDeadline<T>(
  callback: (signal: AbortSignal) => T | Promise<T>,
  options?: {
    signal?: AbortSignal;
    timeoutMs?: number;
    timeoutCode?: 'TIMEOUT' | 'TIME_LIMIT';
  }
): Promise<Awaited<T>>;
export declare function abortableDelay(
  ms: number, signal?: AbortSignal
): Promise<void>;
export declare function assertNotCancelled(
  signal?: AbortSignal
): void;
export declare function safeError(error: unknown): SafeRequestError;
