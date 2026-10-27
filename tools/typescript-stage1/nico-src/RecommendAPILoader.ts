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
}

export interface RecommendSeriesOptions {
  title?: string;
}

/**
 * What the loader may read from the body before validating it. A `null`
 * body throws a TypeError on `.meta`, exactly like the legacy JS (parity-tested).
 */
export interface RecommendEnvelopeProbe {
  readonly meta?: {readonly status?: unknown} | null;
  readonly data?: unknown;
}

export interface RecommendAPILoaderClient {
  /** Resolves `data` as received (not schema-validated); rejects unless meta.status is 200. */
  load(params: RecommendLoadParams): Promise<unknown>;
  loadSeries(seriesId: string | number, options?: RecommendSeriesOptions): Promise<unknown>;
}

const RecommendAPILoader: RecommendAPILoaderClient = (() => {

  const load = ({videoId, recipe}: RecommendLoadParams): Promise<unknown> => {
    const target: RecommendRecipe = recipe || {id: 'video_playlist_common', videoId};
    const encoded = textUtil.encodeBase64(JSON.stringify(target));
    const url = `https://nvapi.nicovideo.jp/v1/recommend?recipe=${encodeURIComponent(encoded)}&site=nicovideo&_frontendId=6&_frontendVersion=0`;
    return netUtil
      .fetch(url, {credentials: 'include'})
      .then((res: Response): Promise<RecommendEnvelopeProbe> => res.json())
      .then((res: RecommendEnvelopeProbe): unknown => {
        if (!res.meta || res.meta.status !== 200) {
          window.console.warn('load recommend fail', res);
          throw new Error('load recommend fail');
        }
        return res.data;
      });
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
