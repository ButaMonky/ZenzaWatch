import {netUtil} from '../infra/netUtil';
// GENERATED FROM tools/typescript-stage1/nico-src/MatrixRankingLoader.ts (Task461). Edit the .ts and run npm run nico:sync.
//===BEGIN===
const MatrixRankingLoader = {
    load: async () => {
        const htmlText = await netUtil.fetch('https://www.nicovideo.jp/ranking', { credentials: 'include' }).then((r) => r.text());
        const doc = new DOMParser().parseFromString(htmlText, 'text/html');
        return JSON.parse(doc.getElementById('MatrixRanking-app').dataset.app);
    }
};
//===END===
export {MatrixRankingLoader};
