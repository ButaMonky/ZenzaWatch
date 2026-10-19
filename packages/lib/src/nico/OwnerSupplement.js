import {netUtil} from '../infra/netUtil';
// GENERATED FROM tools/typescript-stage1/nico-src/OwnerSupplement.ts (Task467). Edit the .ts and run npm run nico:sync.
//===BEGIN===
const OwnerSupplement = (() => {
    const BLANK_ICON = 'https://secure-dcdn.cdn.nimg.jp/nicoaccount/usericon/defaults/blank.jpg';
    const loadFromNicoad = async (videoId) => {
        const net = (typeof netUtil !== 'undefined') ? netUtil :
            { fetch: (u, o) => fetch(u, o) };
        const res = await net.fetch(`https://api.nicoad.nicovideo.jp/v1/contents/video/${videoId}`, { credentials: 'omit', timeout: 5000 });
        if (!res || !res.ok) {
            return null;
        }
        const json = await res.json();
        const d = json && json.data;
        const data = d;
        if (!data || String(data.id) !== String(videoId) || !data.ownerId) {
            return null;
        }
        return { id: String(data.ownerId), name: data.ownerName || '', icon: data.ownerIcon || '' };
    };
    /** Mutate the supplied thumbInfo as the original JavaScript did. */
    const supplementThumbInfo = async (thumbInfo) => {
        if (!thumbInfo || thumbInfo.status !== 'ok' || thumbInfo.owner) {
            return thumbInfo;
        }
        const videoId = thumbInfo.videoId || thumbInfo.id;
        let found = null;
        if (videoId && !thumbInfo.isChannel && /^(sm|nm)\d+$/.test(videoId)) {
            try {
                found = await loadFromNicoad(videoId);
            }
            catch (e) {
                window.console.warn('投稿者情報の補完に失敗', videoId, e);
            }
        }
        if (found) {
            thumbInfo.owner = {
                type: 'user',
                id: found.id,
                linkId: `user/${found.id}`,
                name: found.name || '(非公開ユーザー)',
                url: `https://www.nicovideo.jp/user/${found.id}`,
                icon: (found.icon || BLANK_ICON).replace(/^http:/, 'https:'),
                isSupplemented: true
            };
        }
        else {
            thumbInfo.owner = {
                type: thumbInfo.isChannel ? 'channel' : 'user',
                id: '',
                linkId: '',
                name: '(投稿者情報なし)',
                url: '#',
                icon: BLANK_ICON,
                isSupplemented: true
            };
        }
        return thumbInfo;
    };
    return { supplementThumbInfo, loadFromNicoad };
})();
//===END===
export {OwnerSupplement};
