import {netUtil} from '../infra/netUtil';
// GENERATED FROM tools/typescript-stage1/nico-src/NVApi.ts (Task457). Edit the .ts and run npm run nico:sync.
//===BEGIN===
const NVApi = {
    FRONT_ID: '6',
    FRONT_VER: '0',
    REQUEST_WITH: 'https://www.nicovideo.jp',
    call: (url, params = {}) => {
        return netUtil
            .fetch(url, {
            mode: 'cors',
            credentials: 'include',
            timeout: 5000,
            method: params.method || 'GET',
            headers: {
                'X-Frontend-Id': NVApi.FRONT_ID,
                'X-Frontend-Version': NVApi.FRONT_VER,
                'X-Request-with': NVApi.REQUEST_WITH
            }
        })
            .catch(() => {
            // Never log a failed request's URL, params or raw error: they may
            // contain signed tokens or user-specific response details.
            console.warn('nvapi fail');
            return undefined;
        });
    }
};
//===END===
export {NVApi};
