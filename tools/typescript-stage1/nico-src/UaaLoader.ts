declare const RequestDiagnostics: typeof import('./RequestDiagnostics').RequestDiagnostics;
/**
 * Canonical UaaLoader source (Task470).
 * Preserve the nicoad thanks endpoint, credential mode, default limit and abort forwarding.
 * The API body remains unknown until validated at its consumer boundary.
 */
import type {NetUtilFetcher} from './NicoApiTypes';

declare const netUtil: NetUtilFetcher;

export interface UaaLoadOptions {
  limit?: number;
  signal?: AbortSignal | undefined;
}

export interface UaaLoaderClient {
  load(videoId: string, options?: UaaLoadOptions): Promise<unknown>;
}

const UaaLoader: UaaLoaderClient = {
  load: (videoId: string, {limit = 50, signal}: UaaLoadOptions = {}): Promise<unknown> => {

    const url = `https://api.nicoad.nicovideo.jp/v1/contents/video/${videoId}/thanks?limit=${limit}`;
    const ticket = typeof RequestDiagnostics === 'undefined' ? null :
      RequestDiagnostics.begin('advertising', videoId, 'response', () => !signal?.aborted, undefined, {url, method:'GET'});
    return (async () => {
      let res: Response | undefined;
      try {
        // This endpoint owns HTTP + JSON classification together: a generic 404
        // cannot distinguish an absent sponsor from a changed/missing API route.
        // Keep all 404s as diagnostic records; report once at this boundary.
        res = await netUtil.fetch(url, {credentials: 'include', signal, diagnosticActive: () => false});
        const body = await res.json();
        ticket?.decoded(res, body?.meta, Array.isArray(body?.data?.sponsors) ? undefined : 'data.sponsors', false);
        return body;
      } catch (error) {
        if (ticket) {
          const failure = RequestDiagnostics.readFailure(res, error);
          ticket.failure(res && res.status >= 300 && (error as {name?: string} | null)?.name === 'SyntaxError' ?
            {...failure, errorCode:'RESPONSE_SCHEMA'} : failure);
        }
        throw error;
      }
    })();
  }
};

export {UaaLoader};
