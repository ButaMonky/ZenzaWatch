/**
 * Canonical TypeScript source for packages/lib/src/nico/MatrixRankingLoader.js (Task461).
 * Reads the ranking page's embedded `#MatrixRanking-app[data-app]` JSON.
 * No caller in the current tree uses it (only re-exported by nico/loader.js).
 */
import type {NetUtilFetcher} from './NicoApiTypes';

declare const netUtil: NetUtilFetcher;
declare const RequestDiagnostics: typeof import('./RequestDiagnostics').RequestDiagnostics;

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
    const url = 'https://www.nicovideo.jp/ranking';
    const ticket = typeof RequestDiagnostics === 'undefined' ? null :
      RequestDiagnostics.begin('ranking-page',url,'response',undefined,undefined,{url,method:'GET'});
    const response = await netUtil.fetch(url,{credentials:'include'}).catch(error => { ticket?.failure(error); throw error; });
    const htmlText = await response.text().catch(error => { ticket?.failure(RequestDiagnostics.readFailure(response,error)); throw error; });
    const doc = new DOMParser().parseFromString(htmlText, 'text/html');
    try {
      const ranking = JSON.parse((doc.getElementById('MatrixRanking-app') as HTMLElement).dataset.app as string) as unknown;
      if (response.status >= 400) ticket?.failure({httpStatus:response.status}); else ticket?.success();
      return ranking;
    } catch (error) {
      ticket?.failure(response.status >= 400 ? {httpStatus:response.status} :
        {...RequestDiagnostics.responseEvidence(response),httpStatus:response.status,kind:'schema',missing:'ranking.dataApp'});
      throw error;
    }
  }
};

export {MatrixRankingLoader};
