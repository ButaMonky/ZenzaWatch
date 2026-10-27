/**
 * Task457: shared, type-only contracts for NicoNico API clients.
 *
 * This file emits no runtime code. Each canonical API module declares the
 * legacy globals it receives from ZenzaWatch's custom bundle with these
 * types, so the userscript build keeps its existing `//@require` layout.
 *
 * Unknown server payloads are always `unknown` until a module narrows them.
 * Never type a live NicoNico response more precisely than fixtures prove.
 */

/** Options accepted by the legacy `netUtil.fetch` wrapper (fetch + timeout). */
export interface NetFetchOptions {
  mode?: RequestMode;
  credentials?: RequestCredentials;
  /** Milliseconds; `netUtil.abortableFetch` defaults to 30 seconds. */
  timeout?: number;
  method?: string;
  /** Numbers are stringified by fetch (PlaylistApiLoader sends numeric frontend IDs; Task463). */
  headers?: Record<string, string | number>;
  /** `undefined` is accepted because callers forward optional signals as-is (Task461). */
  signal?: AbortSignal | null | undefined;
  body?: BodyInit | null;
}

/** The part of the legacy `textUtil` used by migrated API clients. */
export interface TextUtilEncoder {
  encodeBase64(text: string): string;
}

/** The part of the legacy `netUtil` object used by migrated API clients. */
export interface NetUtilFetcher {
  fetch(url: string, params?: NetFetchOptions): Promise<Response>;
}

/** HTTP verbs used by nvapi write endpoints that ZenzaWatch calls today. */
export type NvapiWriteMethod = 'POST' | 'DELETE';

/**
 * Error categories attached as `error.kind` by migrated clients.
 * - NETWORK: no HTTP response (offline, CORS, timeout, abort).
 * - API: an HTTP/nvapi status outside 2xx.
 */
export type NicoApiErrorKind = 'NETWORK' | 'API';

/** A value whose properties may be probed without asserting its shape. */
export interface UnknownPropertyBag {
  readonly [key: string]: unknown;
}
