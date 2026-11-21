declare const RequestDiagnostics: typeof import('./RequestDiagnostics').RequestDiagnostics;
/**
 * Canonical TypeScript source for packages/lib/src/nico/RecommendAPILoader.js (Task461).
 * nvapi /v1/recommend for related videos and series playlists.
 */
import type {NetUtilFetcher, TextUtilEncoder} from './NicoApiTypes';

declare const netUtil: NetUtilFetcher;
declare const textUtil: TextUtilEncoder;

/** Recipe sent base64(JSON) in the `recipe` query parameter. */
export interface RecommendRecipe {
  id: string;
  videoId?: string | undefined;
  seriesId?: string | number;
  frontendId?: number;
  seriesTitle?: string;
}

export interface RecommendLoadParams {
  videoId?: string | undefined;
  recipe?: RecommendRecipe | undefined;
  isCurrent?: () => boolean;
}

export interface RecommendSeriesOptions {
  title?: string;
}

/**
 * What the loader may read from the body before validating it. A `null`
 * body throws a TypeError on `.meta`, exactly like the legacy JS (parity-tested).
 */
export interface RecommendEnvelopeProbe {
  readonly meta?: {readonly status?: unknown; readonly errorCode?: unknown} | null;
  readonly data?: unknown;
}

export interface RecommendAPILoaderClient {
  /** Keeps the returned data object, including an empty list for the video recipes. */
  load(params: RecommendLoadParams): Promise<unknown>;
  loadSeries(seriesId: string | number, options?: RecommendSeriesOptions): Promise<unknown>;
}

const RecommendAPILoader: RecommendAPILoaderClient = (() => {

  const load = async ({videoId, recipe, isCurrent}: RecommendLoadParams): Promise<unknown> => {
    const target: RecommendRecipe = recipe || {id: 'video_playlist_common', videoId};
    const encoded = textUtil.encodeBase64(JSON.stringify(target));
    const url = `https://nvapi.nicovideo.jp/v1/recommend?recipe=${encodeURIComponent(encoded)}&site=nicovideo&_frontendId=6&_frontendVersion=0`;
    const ticket = typeof RequestDiagnostics === 'undefined' ? null :
      RequestDiagnostics.begin('recommend', JSON.stringify([target.id, target.seriesId, target.videoId]), 'response',
        isCurrent, undefined, {url, method:'GET'});
    const options = {credentials: 'include' as const, ...(ticket ? {diagnosticActive: () => false} : {})};
    let response: Response | undefined;
    let body: RecommendEnvelopeProbe | undefined;
    let bodyText: string | undefined;
    let decoded = false;
    let missing: string | undefined;
    try {
      response = await netUtil.fetch(url, options);
      try {
        body = await response.json() as RecommendEnvelopeProbe;
      } catch (error) {
        if (response.status !== 200 || (error as {name?: string} | null)?.name !== 'SyntaxError' ||
            (isCurrent && !isCurrent())) throw error;
        // Retry only an unreadable HTTP 200. Discard its status before fetching the replacement.
        response = undefined;
        response = await netUtil.fetch(url, {...options, cache:'no-store'});
        bodyText = await response.text();
        body = JSON.parse(bodyText) as RecommendEnvelopeProbe;
      }
      decoded = true;
      if (response.status >= 300 || !body.meta || body.meta.status !== 200 || body.meta.errorCode) {
        window.console.warn('load recommend fail', body);
        throw new Error('load recommend fail');
      }
      if (target.id === 'video_playlist_common' || target.id === 'video_watch_playlist_series') {
        const data = body.data as {items?: unknown} | null;
        if (!Array.isArray(data?.items)) {
          missing = 'data.items';
          throw new Error('load recommend fail');
        }
        if (data.items.some(row => !row || typeof row !== 'object' ||
            ((!row.contentType || row.contentType === 'video') && (typeof row.id !== 'string' || !row.id.trim())))) {
          // Keep usable siblings and the caller's data identity. A damaged page cannot establish recovery.
          missing = 'data.items';
        }
      }
      if (ticket && missing) { ticket.failure(RequestDiagnostics.responseFailure(response, body.meta, missing)); }
      else { ticket?.success(); }
      return body.data;
    } catch (error) {
      if (ticket) {
        ticket.failure(decoded ? RequestDiagnostics.responseFailure(response, body?.meta, missing) || error :
          RequestDiagnostics.readFailure(response, error, bodyText));
      }
      throw error;
    }
  };

  return {
    load,
    loadSeries: (seriesId: string | number, options: RecommendSeriesOptions = {}): Promise<unknown> => {
      const recipe: RecommendRecipe = {
        id: 'video_watch_playlist_series',
        seriesId,
        frontendId: 6,
        seriesTitle: options.title || `series/${seriesId}`
      };
      return load({recipe});
    }
  };
})();

export {RecommendAPILoader};
