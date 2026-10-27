// Task508: canonical typed core for watch-query, thumbnail and page utilities.
interface WatchQuery extends Record<string, unknown> { playlist?: string | {type?: unknown; id?: unknown; options?: unknown}; }
interface PlaylistInput { type?: string; context?: Record<string, unknown>; }
interface CommonHeader { initConfig: { user: { isPremium?: unknown; isLogin?: unknown } }; }
interface TweetDetails { watchId: string; duration: number; isChannel: boolean; title: string; videoId: string; }
interface NicoUtil {
  parseWatchQuery(query: string): WatchQuery | Record<string, never>;
  hasLargeThumbnail(videoId: string): boolean;
  getThumbnailUrlByVideoId(videoId: string): string | null;
  getWatchId(url?: string): string | null;
  getCommonHeader(): unknown;
  isLegacyHeader(): boolean;
  isPremiumLegacy(): boolean;
  isLoginLegacy(): boolean;
  isPremium(): boolean;
  isLogin(): boolean;
  getPageLanguage(): string;
  openMylistWindow(watchId: string): void;
  openTweetWindow(input: TweetDetails): void;
  isGinzaWatchUrl(url?: string): boolean;
  readonly getNicoHistory: string;
  getMypageVer(): 'spa' | 'legacy';
}
declare const textUtil: {
  parseQuery(query: string): WatchQuery;
  decodeBase64(value: string): string;
  secToTime(seconds: number): string;
};
const nicoUtil: NicoUtil = {
  parseWatchQuery: (query: string) => {
    try {
      const result = textUtil.parseQuery(query);
      const encoded = result.playlist;
      const decoded: unknown = JSON.parse(encoded && textUtil.decodeBase64(encoded as string) || '{}');
      if (decoded === null) { throw new TypeError('playlist'); }
      const playlist = decoded as PlaylistInput;
      const context = playlist.context;
      result.playlist = {type: playlist.type};
      switch (playlist.type) {
        case 'series':
          Object.assign(result.playlist, {id: context!.seriesId});
          break;
        case 'user-uploaded': {
          const {userId, ...options} = context!;
          Object.assign(result.playlist, {id: userId, options});
          break;
        }
        case 'mylist': {
          const {mylistId, ...options} = context!;
          Object.assign(result.playlist, {id: mylistId, options});
          break;
        }
        case 'watchlater':
        case 'search':
          Object.assign(result.playlist, {options: context});
          break;
      }
      return result;
    } catch (e) {
      return {};
    }
  },
  hasLargeThumbnail: (videoId: string) => {
    // Keep the original threshold and prefix cases unchanged.
    const threthold = 16371888;
    const cid = videoId.substr(0, 2);
    const fid = Number(videoId.substr(2));
    if (cid === 'nm') { return false; }
    if (cid !== 'sm' && fid < 35000000) { return false; }
    if (fid < threthold) { return false; }
    return true;
  },
  getThumbnailUrlByVideoId: (videoId: string) => {
    const videoIdReg = /^[a-z]{2}\d+$/;
    if (!videoIdReg.test(videoId)) { return null; }
    const fileId = parseInt(videoId.substr(2), 10);
    const large = nicoUtil.hasLargeThumbnail(videoId) ? '.L' : '';
    return fileId >= 35374758 ?
      `https://nicovideo.cdn.nimg.jp/thumbnails/${fileId}/${fileId}.L` :
      `https://tn.smilevideo.jp/smile?i=${fileId}.${large}`;
  },
  getWatchId: (url?: string) => {
    try {
      const parsed = new URL(url || location.href, location.href);
      if (!/^https?:$/.test(parsed.protocol)) { return null; }
      const match = parsed.hostname === 'nico.ms' ?
        /^\/([a-z0-9]+)\/?$/.exec(parsed.pathname) :
        /^\/(?:watch|shorts)\/([a-z0-9]+)\/?$/.exec(parsed.pathname);
      return match ? match[1]! : null;
    } catch (_) { return null; }
  },
  getCommonHeader: () => {
    try {
      return JSON.parse(document.querySelector<HTMLElement>('#CommonHeader[data-common-header]')!.dataset.commonHeader || '{}') as CommonHeader;
    } catch (e) {
      return {initConfig: {}} as CommonHeader;
    }
  },
  isLegacyHeader: () => !document.querySelector('#CommonHeader[data-common-header]'),
  isPremiumLegacy: () => {
    const a = 'a[href^="https://account.nicovideo.jp/premium/register"]';
    return !document.querySelector(`#topline ${a}, #CommonHeader ${a}`);
  },
  isLoginLegacy: () => {
    const a = 'a[href^="https://account.nicovideo.jp/login"]';
    return !document.querySelector(`#topline ${a}, #CommonHeader ${a}`);
  },
  isPremium: () =>
    nicoUtil.isLegacyHeader() ? nicoUtil.isPremiumLegacy() :
      !!(nicoUtil.getCommonHeader() as CommonHeader).initConfig.user.isPremium,
  isLogin: () =>
    nicoUtil.isLegacyHeader() ? nicoUtil.isLoginLegacy() :
      !!(nicoUtil.getCommonHeader() as CommonHeader).initConfig.user.isLogin,
  getPageLanguage: () => {
    try {
      const h = document.getElementsByClassName('html')[0] as HTMLElement;
      return h.lang || 'ja-JP';
    } catch (e) { return 'ja-JP'; }
  },
  openMylistWindow: (watchId: string) => {
    window.open(
      `//www.nicovideo.jp/mylist_add/video/${watchId}`,
      'nicomylistadd',
      'width=500, height=400, menubar=no, scrollbars=no');
  },
  openTweetWindow: ({watchId, duration, isChannel, title, videoId}: TweetDetails) => {
    const nicomsUrl = `https://nico.ms/${watchId}`;
    const watchUrl = `https://www.nicovideo.jp/watch/${watchId}`;
    title = `${title}(${textUtil.secToTime(duration)})`.replace(/@/g, '@ ');
    const nicoch = isChannel ? ',+nicoch' : '';
    const url = 'https://twitter.com/intent/tweet?' +
      'url=' + encodeURIComponent(nicomsUrl) +
      '&text=' + encodeURIComponent(title) +
      '&hashtags=' + encodeURIComponent(videoId + nicoch) +
      '&original_referer=' + encodeURIComponent(watchUrl) + '';
    (window.open as (...args: [string, string, string, number]) => Window | null)(
      url, '_blank',
      'width=550, height=480, left=100, top50, personalbar=0, toolbar=0, scrollbars=1, sizable=1', 0);
  },
  isGinzaWatchUrl: (url?: string) =>
    /^https?:\/\/www\.nicovideo\.jp\/(watch|shorts)\//.test(url || location.href),
  get getNicoHistory() {
    const entry = document.cookie.split(';').map(value => value.trim())
      .find(value => value.startsWith('nicohistory='));
    if (!entry) { return ''; }
    try {
      return window.decodeURIComponent(entry.slice('nicohistory='.length));
    } catch (error) {
      if (!(error instanceof URIError)) { throw error; }
      return '';
    }
  },
  getMypageVer: () => document.querySelector('#js-initial-userpage-data') ? 'spa' : 'legacy'
};
export {nicoUtil};
