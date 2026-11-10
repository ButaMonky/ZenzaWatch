import {RequestDiagnostics} from '../infra/RequestDiagnostics';
import {netUtil} from '../infra/netUtil';
// GENERATED FROM tools/typescript-stage1/nico-src/UaaLoader.ts (Task470). Edit the .ts and run npm run nico:sync.
//===BEGIN===
//@require RequestDiagnostics
const UaaLoader = {
    load: (videoId, { limit = 50, signal } = {}) => {
        const execute = async () => {
            const url = `https://api.nicoad.nicovideo.jp/v1/contents/video/${videoId}/thanks?limit=${limit}`;
            return netUtil.fetch(url, { credentials: 'include', signal }).then((res) => res.json());
        };
        return typeof RequestDiagnostics === 'undefined' ? execute() :
            RequestDiagnostics.observe('advertising', videoId, execute, value => !!value && Array.isArray(value.data?.sponsors), () => !signal?.aborted);
    }
};
//===END===
export {UaaLoader};
