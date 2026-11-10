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

    const ticket = typeof RequestDiagnostics === 'undefined' ? null :
      RequestDiagnostics.begin('advertising', videoId, 'response', () => !signal?.aborted);
    return (async () => {
      const url = `https://api.nicoad.nicovideo.jp/v1/contents/video/${videoId}/thanks?limit=${limit}`;
      try {
        // This endpoint owns HTTP + JSON classification together: a generic 404
        // cannot distinguish an absent sponsor from a changed/missing API route.
        // Keep all 404s as diagnostic records; report once at this boundary.
        const res = await netUtil.fetch(url, {credentials: 'include', signal, diagnosticActive: () => false});
        let body;
        try { body = await res.json(); }
        catch (error) { ticket?.failure({status: res.status, errorCode: 'RESPONSE_SCHEMA'}); throw error; }
        const meta = body?.meta;
        if (res.status >= 400) { ticket?.failure({status: res.status, errorCode: meta?.errorCode}); }
        else if (typeof meta?.status === 'number' && (meta.status < 200 || meta.status >= 300)) {
          ticket?.failure({status: meta.status, errorCode: meta.errorCode});
        } else if (!Array.isArray(body?.data?.sponsors)) { ticket?.failure({kind: 'schema'}); }
        else { ticket?.success(); }
        return body;
      } catch (error) { ticket?.failure(error); throw error; }
    })();
  }
};

export {UaaLoader};
