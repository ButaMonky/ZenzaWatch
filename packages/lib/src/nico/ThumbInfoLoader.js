import {RequestDiagnostics} from '../infra/RequestDiagnostics';
import {CrossDomainGate} from '../infra/CrossDomainGate';
import {parseThumbInfo} from './parseThumbInfo';
// GENERATED FROM tools/typescript-stage1/nico-src/ThumbInfoLoader.ts (Task469). Edit the .ts and run npm run nico:sync.
//===BEGIN===
//@require RequestDiagnostics
const ThumbInfoLoader = (() => {
    const BASE_URL = 'https://ext.nicovideo.jp/';
    const MESSAGE_ORIGIN = 'https://ext.nicovideo.jp/';
    let gate = null;
    const initGate = () => {
        if (gate) {
            return gate;
        }
        gate = new CrossDomainGate({
            baseUrl: BASE_URL,
            origin: MESSAGE_ORIGIN,
            type: 'thumbInfo'
        });
        return undefined;
    };
    const load = async (watchId) => {
        initGate();
        const url = `${BASE_URL}api/getthumbinfo/${watchId}`;
        const ticket = typeof RequestDiagnostics === 'undefined' ? null :
            RequestDiagnostics.begin('thumb-info', watchId, 'response', undefined, undefined, { url, method: 'GET' });
        const thumbInfo = await gate.fetch(url, { _format: 'text', expireTime: 24 * 60 * 60 * 1000 })
            .catch((e) => {
            ticket?.failure(e);
            throw { status: 'fail', message: e?.message || `gate.fetch('${watchId}') failed` };
        });
        if (thumbInfo?.status !== 'ok') {
            const code = thumbInfo?.code;
            ticket?.failure(code === 'DELETED' || code === 'NOT_FOUND' ? { reason: 'not found' } :
                typeof code === 'string' && code !== 'INVALID_RESPONSE' ? { kind: 'service', errorCode: code } :
                    { kind: 'schema', missing: 'thumb.status' });
            return Promise.reject(thumbInfo ?? { status: 'fail', code: 'INVALID_RESPONSE' });
        }
        ticket?.success();
        return thumbInfo;
    };
    return { initGate, load };
})();
//===END===
export {ThumbInfoLoader, parseThumbInfo};
