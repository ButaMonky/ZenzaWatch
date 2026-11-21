import {RequestDiagnostics} from '../infra/RequestDiagnostics';
import {netUtil} from '../infra/netUtil';
// GENERATED FROM tools/typescript-stage1/nico-src/UaaLoader.ts (Task470). Edit the .ts and run npm run nico:sync.
//===BEGIN===
//@require RequestDiagnostics
const UaaLoader = {
    load: (videoId, { limit = 50, signal } = {}) => {
        const url = `https://api.nicoad.nicovideo.jp/v1/contents/video/${videoId}/thanks?limit=${limit}`;
        const ticket = typeof RequestDiagnostics === 'undefined' ? null :
            RequestDiagnostics.begin('advertising', videoId, 'response', () => !signal?.aborted, undefined, { url, method: 'GET' });
        return (async () => {
            let res;
            try {
                // This endpoint owns HTTP + JSON classification together: a generic 404
                // cannot distinguish an absent sponsor from a changed/missing API route.
                // Keep all 404s as diagnostic records; report once at this boundary.
                res = await netUtil.fetch(url, { credentials: 'include', signal, diagnosticActive: () => false });
                const body = await res.json();
                ticket?.decoded(res, body?.meta, Array.isArray(body?.data?.sponsors) ? undefined : 'data.sponsors', false);
                return body;
            }
            catch (error) {
                if (ticket) {
                    const failure = RequestDiagnostics.readFailure(res, error);
                    ticket.failure(res && res.status >= 300 && error?.name === 'SyntaxError' ?
                        { ...failure, errorCode: 'RESPONSE_SCHEMA' } : failure);
                }
                throw error;
            }
        })();
    }
};
//===END===
export {UaaLoader};
