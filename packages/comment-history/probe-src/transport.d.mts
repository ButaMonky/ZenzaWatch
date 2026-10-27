import type {ProbeContext,ProbeTarget,ProbeThread} from './core.mjs';
export interface ProbeRequest {
  targets: readonly ProbeTarget[];
  when?: number | null;
  resFrom?: number;
  signal?: AbortSignal;
}
export interface ProbeSafeError {
  code: string;
  httpStatus?: number;
  apiCode?: string;
  retryAfterMs?: number;
  causeCode?: string;
}
export declare function requestThreads(
  context: ProbeContext,request?: ProbeRequest
): Promise<ProbeThread[]>;
export declare function withDeadline<T>(
  operation: (signal: AbortSignal) => T | Promise<T>,
  options?: {signal?:AbortSignal;timeoutMs?:number}
): Promise<T>;
export declare function abortableDelay(
  milliseconds: number,signal?:AbortSignal
): Promise<void>;
export declare function assertNotCancelled(signal?:AbortSignal):void;
export declare function safeError(error:unknown):ProbeSafeError;
