import {RequestDiagnostics} from '../infra/RequestDiagnostics';
import {netUtil} from '../infra/netUtil';
// GENERATED FROM tools/typescript-stage1/nico-src/UaaLoader.ts (Task470). Edit the .ts and run npm run nico:sync.
//===BEGIN===
//@require RequestDiagnostics
const UaaLoader = {
    load: (videoId, { limit = 50, signal } = {}) => {
        const ticket = typeof RequestDiagnostics === 'undefined' ? null :
            RequestDiagnostics.begin('advertising', videoId, 'response', () => !signal?.aborted);
        return (async () => {
            const url = `https://api.nicoad.nicovideo.jp/v1/contents/video/${videoId}/thanks?limit=${limit}`;
            try {
                // This endpoint owns HTTP + JSON classification together: a generic 404
                // cannot distinguish an absent sponsor from a changed/missing API route.
                // Keep all 404s as diagnostic records; report once at this boundary.
                const res = await netUtil.fetch(url, { credentials: 'include', signal, diagnosticActive: () => false });
                let body;
                try {
                    body = await res.json();
                }
                catch (error) {
                    ticket?.failure({ status: res.status, errorCode: 'RESPONSE_SCHEMA' });
                    throw error;
                }
                const meta = body?.meta;
                if (res.status >= 400) {
                    ticket?.failure({ status: res.status, errorCode: meta?.errorCode });
                }
                else if (typeof meta?.status === 'number' && (meta.status < 200 || meta.status >= 300)) {
                    ticket?.failure({ status: meta.status, errorCode: meta.errorCode });
                }
                else if (!Array.isArray(body?.data?.sponsors)) {
                    ticket?.failure({ kind: 'schema' });
                }
                else {
                    ticket?.success();
                }
                return body;
            }
            catch (error) {
                ticket?.failure(error);
                throw error;
            }
        })();
    }
};
//===END===
export {UaaLoader};
