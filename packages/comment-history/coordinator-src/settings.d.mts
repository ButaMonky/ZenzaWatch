// Task522: existing strict settings object from Task460.
export interface RequestBudgetSettings {
  maxElapsedMs: number;
  maxRequests: number;
  requestTimeoutMs: number;
  minIntervalMs: number;
  maxRetries: number;
  maxKeyRefreshes: number;
}
export declare function normalizeSettings(
  options?: Partial<RequestBudgetSettings>
): Readonly<RequestBudgetSettings>;
