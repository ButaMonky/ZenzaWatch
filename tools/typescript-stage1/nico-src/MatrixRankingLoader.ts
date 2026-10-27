/**
 * Canonical TypeScript source for packages/lib/src/nico/MatrixRankingLoader.js (Task461).
 * Reads the ranking page's embedded `#MatrixRanking-app[data-app]` JSON.
 * No caller in the current tree uses it (only re-exported by nico/loader.js).
 */
import type {NetUtilFetcher} from './NicoApiTypes';

declare const netUtil: NetUtilFetcher;

export interface MatrixRankingLoaderClient {
  /**
   * Resolves the embedded JSON as received (not schema-validated).
   * Legacy behavior kept: a missing element throws TypeError and a missing
   * `data-app` attribute throws SyntaxError (page markup change signal).
   */
  load(): Promise<unknown>;
}

const MatrixRankingLoader: MatrixRankingLoaderClient = {
  load: async (): Promise<unknown> => {
    const htmlText = await netUtil.fetch(
      'https://www.nicovideo.jp/ranking', {credentials: 'include'}
      ).then((r: Response): Promise<string> => r.text());
    const doc = new DOMParser().parseFromString(htmlText, 'text/html');
    return JSON.parse((doc.getElementById('MatrixRanking-app') as HTMLElement).dataset.app as string) as unknown;
  }
};

export {MatrixRankingLoader};
