import {RequestDiagnostics} from '../infra/RequestDiagnostics';
import {netUtil} from '../infra/netUtil';
import {textUtil} from '../text/textUtil';
// GENERATED FROM tools/typescript-stage1/nico-src/RecommendAPILoader.ts (Task461). Edit the .ts and run npm run nico:sync.
//===BEGIN===
//@require RequestDiagnostics
const RecommendAPILoader = (() => {
    const load = async ({ videoId, recipe, isCurrent }) => {
        const target = recipe || { id: 'video_playlist_common', videoId };
        const encoded = textUtil.encodeBase64(JSON.stringify(target));
        const url = `https://nvapi.nicovideo.jp/v1/recommend?recipe=${encodeURIComponent(encoded)}&site=nicovideo&_frontendId=6&_frontendVersion=0`;
        const ticket = typeof RequestDiagnostics === 'undefined' ? null :
            RequestDiagnostics.begin('recommend', JSON.stringify([target.id, target.seriesId, target.videoId]), 'response', isCurrent);
        let response;
        let body;
        let decoded = false;
        let missing;
        try {
            response = await netUtil.fetch(url, { credentials: 'include', ...(ticket ? { diagnosticActive: () => false } : {}) });
            body = await response.json();
            decoded = true;
            if (response.status >= 300 || !body.meta || body.meta.status !== 200 || body.meta.errorCode) {
                window.console.warn('load recommend fail', body);
                throw new Error('load recommend fail');
            }
            if (target.id === 'video_playlist_common' || target.id === 'video_watch_playlist_series') {
                const data = body.data;
                if (!Array.isArray(data?.items)) {
                    missing = 'data.items';
                    throw new Error('load recommend fail');
                }
                if (data.items.some(row => !row || typeof row !== 'object' ||
                    ((!row.contentType || row.contentType === 'video') && (typeof row.id !== 'string' || !row.id.trim())))) {
                    // Keep usable siblings and the caller's data identity. A damaged page cannot establish recovery.
                    missing = 'data.items';
                }
            }
            if (ticket && missing) {
                ticket.failure(RequestDiagnostics.responseFailure(response, body.meta, missing));
            }
            else {
                ticket?.success();
            }
            return body.data;
        }
        catch (error) {
            if (ticket) {
                ticket.failure(decoded ? RequestDiagnostics.responseFailure(response, body?.meta, missing) || error :
                    RequestDiagnostics.readFailure(response, error));
            }
            throw error;
        }
    };
    return {
        load,
        loadSeries: (seriesId, options = {}) => {
            const recipe = {
                id: 'video_watch_playlist_series',
                seriesId,
                frontendId: 6,
                seriesTitle: options.title || `series/${seriesId}`
            };
            return load({ recipe });
        }
    };
})();
//===END===
export {RecommendAPILoader};
