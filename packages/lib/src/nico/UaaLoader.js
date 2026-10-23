import {netUtil} from '../infra/netUtil';
// GENERATED FROM tools/typescript-stage1/nico-src/UaaLoader.ts (Task470). Edit the .ts and run npm run nico:sync.
//===BEGIN===
const UaaLoader = {
    load: (videoId, { limit = 50, signal } = {}) => {
        const url = `https://api.nicoad.nicovideo.jp/v1/contents/video/${videoId}/thanks?limit=${limit}`;
        return netUtil.fetch(url, { credentials: 'include', signal }).then((res) => res.json());
    }
};
//===END===
export {UaaLoader};
