import {RequestDiagnostics} from '../infra/RequestDiagnostics';
import {netUtil} from '../infra/netUtil';
// GENERATED FROM tools/typescript-stage1/nico-src/MatrixRankingLoader.ts (Task461). Edit the .ts and run npm run nico:sync.
//===BEGIN===
//@require RequestDiagnostics
const MatrixRankingLoader = {
    load: async () => {
        const url = 'https://www.nicovideo.jp/ranking';
        const ticket = typeof RequestDiagnostics === 'undefined' ? null :
            RequestDiagnostics.begin('ranking-page', url, 'response', undefined, undefined, { url, method: 'GET' });
        const response = await netUtil.fetch(url, { credentials: 'include' }).catch(error => { ticket?.failure(error); throw error; });
        const htmlText = await response.text().catch(error => { ticket?.failure(RequestDiagnostics.readFailure(response, error)); throw error; });
        const doc = new DOMParser().parseFromString(htmlText, 'text/html');
        try {
            const ranking = JSON.parse(doc.getElementById('MatrixRanking-app').dataset.app);
            if (response.status >= 400)
                ticket?.failure({ httpStatus: response.status });
            else
                ticket?.success();
            return ranking;
        }
        catch (error) {
            ticket?.failure(response.status >= 400 ? { httpStatus: response.status } :
                { ...RequestDiagnostics.responseEvidence(response), httpStatus: response.status, kind: 'schema', missing: 'ranking.dataApp' });
            throw error;
        }
    }
};
//===END===
export {MatrixRankingLoader};
