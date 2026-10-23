import {CrossDomainGate} from '../infra/CrossDomainGate';
import {parseThumbInfo} from './parseThumbInfo';
// GENERATED FROM tools/typescript-stage1/nico-src/ThumbInfoLoader.ts (Task469). Edit the .ts and run npm run nico:sync.
//===BEGIN===
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
        const thumbInfo = await gate.fetch(`${BASE_URL}api/getthumbinfo/${watchId}`, { _format: 'text', expireTime: 24 * 60 * 60 * 1000 })
            .catch((e) => { return { status: 'fail', message: e.message || `gate.fetch('${watchId}') failed` }; });
        if (thumbInfo.status !== 'ok') {
            return Promise.reject(thumbInfo);
        }
        return thumbInfo;
    };
    return { initGate, load };
})();
//===END===
export {ThumbInfoLoader, parseThumbInfo};
