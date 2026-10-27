export declare class HistoryError extends Error {
  code: string;
  rollbackComplete?: boolean;
  constructor(code: string, details?: Record<string, unknown>);
}
