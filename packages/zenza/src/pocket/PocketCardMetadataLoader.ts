/**
 * TypeScript candidate for the MylistPocket public video metadata API.
 * This candidate is compiled and parity-checked against the existing JS runtime.
 * Runtime ownership migration is a later gate; do not hand-edit shipped JS.
 */
type DataRecord = Record<string, unknown>;
export type PocketCardOwner = Readonly<{
  type: 'user' | 'channel';
  id: string; name: string; icon: string; url: string;
}>;
type ThumbnailField = 'ogp' | 'player' | 'large' | 'largeUrl' | 'middle' |
  'middleUrl' | 'normal' | 'url';
export type PocketCardThumbnail = Partial<Record<ThumbnailField, string>>;
export type PocketCardMetadata = Readonly<{
  videoId: string;
  likeCount: number | null;
  owner: PocketCardOwner | null;
  thumbnail: PocketCardThumbnail | null;
}>;
type PocketFetchOptions = Readonly<{
  credentials: 'omit';
  timeout: number;
  headers: Readonly<Record<string, string>>;
}>;
type PocketFetchResponse = {ok: boolean; json(): Promise<unknown>};
export type PocketFetcher = (url: string, options: PocketFetchOptions) => Promise<PocketFetchResponse>;
declare const netUtil: {fetch: PocketFetcher};

const PocketCardMetadataLoader = (() => {
  const API = 'https://nvapi.nicovideo.jp/v1/videos?watchIds=';
  const OK_TTL_MS = 10 * 60 * 1000;
  const FAILED_TTL_MS = 30 * 1000;
  const MAX_CACHE = 200;
  const cache = new Map<string, {value: PocketCardMetadata | null; expires: number}>();
  const inFlight = new Map<string, Promise<PocketCardMetadata | null>>();
  const asRecord = (value: unknown): DataRecord | null =>
    value !== null && typeof value === 'object' && !Array.isArray(value) ?
      value as DataRecord : null;
  const safeId = (id: unknown): id is string => typeof id === 'string' &&
    /^(?:(?:sm|nm|so|ss)\d{1,16}|\d{1,16})$/.test(id);
  const validLike = (n: unknown): n is number =>
    typeof n === 'number' && Number.isSafeInteger(n) && n >= 0;
  const normalizeOwner = (raw: unknown): PocketCardOwner | null => {
    if (!raw || typeof raw !== 'object' || (raw as DataRecord).visibility === 'hidden') {
      return null;
    }
    const value = raw as DataRecord;
    const type = value.ownerType || value.type;
    const rawId = String(value.id ?? '');
    const isUser = type === 'user' && /^\d+$/.test(rawId);
    const isChannel = type === 'channel' && /^(?:ch)?\d+$/.test(rawId);
    if (!isUser && !isChannel) { return null; }
    const id = isChannel ? rawId.replace(/^ch/, '') : rawId;
    const name = typeof value.name === 'string' && value.name.trim() ?
      value.name.trim() : '(投稿者情報なし)';
    const icon = typeof value.iconUrl === 'string' &&
      /^https?:\/\//i.test(value.iconUrl) ? value.iconUrl.replace(/^http:/i,'https:') : '';
    const url = isUser ? `https://www.nicovideo.jp/user/${id}` :
      `https://ch.nicovideo.jp/ch${id}`;
    return {type: isUser ? 'user' : 'channel', id, name, icon, url};
  };
  // Carry only documented thumbnail URL fields from the already requested video
  // metadata. Selection belongs to ThumbnailSourcePolicy, not this transport.
  const normalizeThumbnail = (raw: unknown): PocketCardThumbnail | null => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) { return null; }
    const record = raw as DataRecord;
    const result: PocketCardThumbnail = {};
    for (const key of ['ogp','player','large','largeUrl','middle','middleUrl','normal','url'] as const) {
      const value = record[key];
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
  const parse = (payload: unknown, requestedId: string): PocketCardMetadata | null => {
    const outer = asRecord(payload);
    const meta = asRecord(outer?.meta);
    const data = asRecord(outer?.data);
    if (meta?.status !== 200 || !Array.isArray(data?.items)) { return null; }
    const item = data.items.find(row => asRecord(row)?.watchId === requestedId);
    const video = asRecord(asRecord(item)?.video);
    if (!video || !safeId(video.id)) { return null; }
    if (/^(?:sm|nm|so|ss)/.test(requestedId) && video.id !== requestedId) { return null; }
    const like = asRecord(video.count)?.like;
    return {
      videoId: video.id,
      likeCount: validLike(like) ? like : null,
      owner: normalizeOwner(video.owner),
      thumbnail: normalizeThumbnail(video.thumbnail)
    };
  };
  const query = async (watchId: string, fetcher?: PocketFetcher): Promise<PocketCardMetadata | null> => {
    const fetchApi: PocketFetcher = fetcher || (typeof netUtil !== 'undefined' ? netUtil.fetch.bind(netUtil) : fetch as unknown as PocketFetcher);
    const response = await fetchApi(API + encodeURIComponent(watchId), {
      credentials:'omit', timeout:6000,
      headers:{'X-Frontend-Id':'6','X-Frontend-Version':'0'}
    });
    if (!response || !response.ok) { return null; }
    return parse(await response.json(), watchId);
  };
  const load = (watchId: unknown, fetcher?: PocketFetcher): Promise<PocketCardMetadata | null> => {
    if (!safeId(watchId)) { return Promise.resolve(null); }
    const now = Date.now();
    const old = cache.get(watchId);
    if (old && old.expires > now) { return Promise.resolve(old.value); }
    if (inFlight.has(watchId)) { return inFlight.get(watchId)!; }
    const pending: Promise<PocketCardMetadata | null> = Promise.resolve()
      .then(() => query(watchId, fetcher))
      .catch(() => null)
      .then(value => {
        cache.delete(watchId);
        cache.set(watchId, {value, expires:Date.now()+(value ? OK_TTL_MS : FAILED_TTL_MS)});
        if (cache.size > MAX_CACHE) { cache.delete(cache.keys().next().value as string); }
        return value;
      })
      .finally(() => inFlight.delete(watchId));
    inFlight.set(watchId, pending);
    return pending;
  };
  return {load, parse, normalizeOwner, validLike};
})();
export {PocketCardMetadataLoader};
