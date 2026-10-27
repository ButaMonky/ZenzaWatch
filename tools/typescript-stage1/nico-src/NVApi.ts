/**
 * Canonical TypeScript source for packages/lib/src/nico/NVApi.js (Task457).
 * Generated JS keeps the legacy object, endpoint headers, timeout and the
 * "resolve undefined on transport failure" contract that LikeApi relies on.
 */
import type {NetUtilFetcher} from './NicoApiTypes';

/** Provided by the userscript bundle (packages/lib/src/infra/netUtil.js). */
declare const netUtil: NetUtilFetcher;

export interface NVApiCallParams {
  /** HTTP method; defaults to GET. */
  method?: string;
}

export interface NVApiClient {
  FRONT_ID: string;
  FRONT_VER: string;
  REQUEST_WITH: string;
  /**
   * Calls an nvapi endpoint with the official front-end headers and cookies.
   * Resolves `undefined` with a fixed, non-sensitive warning on transport failure.
   * HTTP error statuses still resolve with their Response; callers classify them.
   */
  call(url: string, params?: NVApiCallParams): Promise<Response | undefined>;
}

const NVApi: NVApiClient = {
  FRONT_ID: '6',
  FRONT_VER:'0',
  REQUEST_WITH: 'https://www.nicovideo.jp',
  call: (url: string, params: NVApiCallParams = {}): Promise<Response | undefined> => {
    return netUtil
      .fetch(url, {
        mode: 'cors',
        credentials: 'include',
        timeout: 5000,
        method: params.method || 'GET',
        headers: {
          'X-Frontend-Id': NVApi.FRONT_ID,
          'X-Frontend-Version': NVApi.FRONT_VER,
          'X-Request-with': NVApi.REQUEST_WITH
        }
      })
      .catch((): undefined => {
        // Never log a failed request's URL, params or raw error: they may
        // contain signed tokens or user-specific response details.
        console.warn('nvapi fail');
        return undefined;
      });
  }
};

export {NVApi};
