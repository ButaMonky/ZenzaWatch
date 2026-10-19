import {netUtil} from '../infra/netUtil';
// GENERATED FROM tools/typescript-stage1/nico-src/PlaybackPosition.ts (Task480). Edit the .ts and run npm run nico:sync.
//===BEGIN===
const PlaybackPosition = (() => {
    const URL_V2 = 'https://nvapi.nicovideo.jp/v2/users/me/watch/history/playback-position';
    const isVideoId = (id) => typeof id === 'string' && /^[a-z]{2}\d+$/.test(id);
    const readBody = async (res) => {
        if (res.status === 204)
            return null;
        if (typeof res.text === 'function') {
            const text = await res.text();
            if (!text || !text.trim())
                return null;
            try {
                return JSON.parse(text);
            }
            catch (_) {
                throw { reason: 'invalid-body', status: res.status };
            }
        }
        if (typeof res.json === 'function') {
            try {
                return await res.json();
            }
            catch (_) {
                throw { reason: 'invalid-body', status: res.status };
            }
        }
        return null;
    };
    /** Narrow only the optional object boundary, not the untrusted status value. */
    const readMeta = (body) => {
        if (!body || typeof body !== 'object' || !('meta' in body))
            return undefined;
        const meta = body.meta;
        if (!meta || typeof meta !== 'object')
            return undefined;
        return meta;
    };
    const record = async (videoId, seconds, frontendId, frontendVersion) => {
        if (!isVideoId(videoId))
            throw { reason: 'invalid-video-id' };
        if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds < 0) {
            throw { reason: 'invalid-seconds' };
        }
        const res = await netUtil.fetch(URL_V2, {
            method: 'PUT',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                'X-Frontend-Id': String(frontendId ?? 6),
                'X-Frontend-Version': String(frontendVersion ?? 0),
                'X-Request-With': 'https://www.nicovideo.jp'
            },
            body: JSON.stringify({ videoId, seconds })
        });
        if (!res)
            throw { reason: 'no-response' };
        if (typeof res.status === 'number' && (res.status < 200 || res.status > 299)) {
            throw { reason: 'http', status: res.status };
        }
        const body = await readBody(res);
        const meta = readMeta(body);
        const metaStatus = meta ? meta.status : undefined;
        // Cast only for comparison: JS relational coercion is part of the legacy contract.
        if (metaStatus !== undefined && !(metaStatus >= 200 && metaStatus <= 299)) {
            throw { reason: 'api', status: metaStatus, errorCode: meta?.errorCode || null };
        }
        return { status: res.status, metaStatus };
    };
    return { record };
})();
//===END===
export {PlaybackPosition};
