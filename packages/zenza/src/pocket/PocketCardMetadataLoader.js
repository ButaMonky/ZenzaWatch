// Task967: one independent, reusable public-video metadata lookup.
// getthumbinfo has no like count; /v1/videos includes count.like and owner.
//===BEGIN===
const PocketCardMetadataLoader = (() => {
  const API = 'https://nvapi.nicovideo.jp/v1/videos?watchIds=';
  const OK_TTL_MS = 10 * 60 * 1000;
  const FAILED_TTL_MS = 30 * 1000;
  const MAX_CACHE = 200;
  const cache = new Map();
  const inFlight = new Map();
  const safeId = id => typeof id === 'string' &&
    /^(?:(?:sm|nm|so|ss)\d{1,16}|\d{1,16})$/.test(id);
  const validLike = n =>
    typeof n === 'number' && Number.isSafeInteger(n) && n >= 0;
  const normalizeOwner = raw => {
    if (!raw || typeof raw !== 'object' || raw.visibility === 'hidden') {
      return null;
    }
    const type = raw.ownerType || raw.type;
    const rawId = String(raw.id ?? '');
    const isUser = type === 'user' && /^\d+$/.test(rawId);
    const isChannel = type === 'channel' && /^(?:ch)?\d+$/.test(rawId);
    if (!isUser && !isChannel) { return null; }
    const id = isChannel ? rawId.replace(/^ch/, '') : rawId;
    const name = typeof raw.name === 'string' && raw.name.trim() ?
      raw.name.trim() : '(投稿者情報なし)';
    const icon = typeof raw.iconUrl === 'string' &&
      /^https?:\/\//i.test(raw.iconUrl) ? raw.iconUrl.replace(/^http:/i,'https:') : '';
    const url = isUser ? `https://www.nicovideo.jp/user/${id}` :
      `https://ch.nicovideo.jp/ch${id}`;
    return {type: isUser ? 'user' : 'channel', id, name, icon, url};
  };
  // Carry only documented thumbnail URL fields from the already requested video
  // metadata. Selection belongs to ThumbnailSourcePolicy, not this transport.
  const normalizeThumbnail = raw => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) { return null; }
    const result = {};
    for (const key of ['ogp','player','large','largeUrl','middle','middleUrl','normal','url']) {
      const value = raw[key];
      if (typeof value !== 'string') { continue; }
      try {
        const url = new URL(value);
        if (/^https?:$/.test(url.protocol) && !url.username && !url.password) {
          result[key] = value;
        }
      } catch (_) { /* malformed metadata cannot become an image source */ }
    }
    return Object.keys(result).length ? result : null;
  };
  const parse = (payload, requestedId) => {
    if (!payload || payload.meta?.status !== 200 ||
        !Array.isArray(payload.data?.items)) { return null; }
    const item = payload.data.items.find(row => row && row.watchId === requestedId);
    const video = item?.video;
    if (!video || !safeId(video.id)) { return null; }
    if (/^(?:sm|nm|so|ss)/.test(requestedId) && video.id !== requestedId) { return null; }
    return {
      videoId: video.id,
      likeCount: validLike(video.count?.like) ? video.count.like : null,
      owner: normalizeOwner(video.owner),
      thumbnail: normalizeThumbnail(video.thumbnail)
    };
  };
  const query = async (watchId, fetcher) => {
    const fetchApi = fetcher || (typeof netUtil !== 'undefined' ? netUtil.fetch.bind(netUtil) : fetch);
    const response = await fetchApi(API + encodeURIComponent(watchId), {
      credentials:'omit', timeout:6000,
      headers:{'X-Frontend-Id':'6','X-Frontend-Version':'0'}
    });
    if (!response || !response.ok) { return null; }
    return parse(await response.json(), watchId);
  };
  const load = (watchId, fetcher) => {
    if (!safeId(watchId)) { return Promise.resolve(null); }
    const now = Date.now();
    const old = cache.get(watchId);
    if (old && old.expires > now) { return Promise.resolve(old.value); }
    if (inFlight.has(watchId)) { return inFlight.get(watchId); }
    const pending = Promise.resolve()
      .then(() => query(watchId, fetcher))
      .catch(() => null)
      .then(value => {
        cache.delete(watchId);
        cache.set(watchId, {value, expires:Date.now()+(value ? OK_TTL_MS : FAILED_TTL_MS)});
        if (cache.size > MAX_CACHE) { cache.delete(cache.keys().next().value); }
        return value;
      })
      .finally(() => inFlight.delete(watchId));
    inFlight.set(watchId, pending);
    return pending;
  };
  return {load, parse, normalizeOwner, validLike};
})();
//===END===
export {PocketCardMetadataLoader};
