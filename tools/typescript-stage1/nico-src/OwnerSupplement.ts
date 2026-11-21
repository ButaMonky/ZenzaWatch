declare const RequestDiagnostics: typeof import('./RequestDiagnostics').RequestDiagnostics;
/**
 * Task467: canonical TypeScript source for the legacy owner fallback.
 * Preserve the original API calls, mutations, and fallback behavior.
 */
import type {NetFetchOptions, NetUtilFetcher, UnknownPropertyBag} from './NicoApiTypes';
declare const netUtil: NetUtilFetcher;

export interface SupplementedOwner {
  id: string;
  name: unknown;
  icon: unknown;
}

export interface SupplementableThumbInfo {
  status?: unknown;
  owner?: unknown;
  videoId?: string;
  id?: string;
  isChannel?: unknown;
  [key: string]: unknown;
}

export interface OwnerSupplementClient {
  loadFromNicoad(videoId: string): Promise<SupplementedOwner | null>;
  supplementThumbInfo<T extends SupplementableThumbInfo | null | undefined>(thumbInfo: T): Promise<T>;
}

const OwnerSupplement: OwnerSupplementClient = (() => {
  const BLANK_ICON = 'https://secure-dcdn.cdn.nimg.jp/nicoaccount/usericon/defaults/blank.jpg';

  const loadFromNicoad = async (videoId: string): Promise<SupplementedOwner | null> => {
    const url = `https://api.nicoad.nicovideo.jp/v1/contents/video/${videoId}`;
    const ticket = typeof RequestDiagnostics === 'undefined' ? null :
      RequestDiagnostics.begin('owner', videoId, 'response', undefined, undefined, {url, method:'GET'});
    let res: Response | undefined;
    try {
      const net: NetUtilFetcher = (typeof netUtil !== 'undefined') ? netUtil :
        {fetch: (u: string, o?: NetFetchOptions) => fetch(u, o as RequestInit | undefined)};
      res = await net.fetch(url, {credentials: 'omit', timeout: 5000, ...(ticket ? {diagnosticActive: () => false} : {})});
      if (!res || !res.ok) {
        ticket?.failure(RequestDiagnostics.readFailure(res, null));
        return null;
      }
      const json = await res.json() as UnknownPropertyBag | null;
      const data = json?.data as UnknownPropertyBag | null | undefined;
      // ownerId is optional even for a successful matching video.
      const missing = !data || typeof data !== 'object' || Array.isArray(data) ? 'data' :
        String(data.id) !== String(videoId) ? 'data.id' : undefined;
      ticket?.decoded(res, json?.meta, missing, false);
      if (!data || String(data.id) !== String(videoId) || !data.ownerId) {
        return null;
      }
      return {id: String(data.ownerId), name: data.ownerName || '', icon: data.ownerIcon || ''};
    } catch (error) {
      ticket?.failure(RequestDiagnostics.readFailure(res, error));
      throw error;
    }
  };

  /** Mutate the supplied thumbInfo as the original JavaScript did. */
  const supplementThumbInfo = async <T extends SupplementableThumbInfo | null | undefined>(
    thumbInfo: T
  ): Promise<T> => {
    if (!thumbInfo || thumbInfo.status !== 'ok' || thumbInfo.owner) {
      return thumbInfo;
    }
    const videoId = thumbInfo.videoId || thumbInfo.id;
    let found: SupplementedOwner | null = null;
    if (videoId && !thumbInfo.isChannel && /^(sm|nm)\d+$/.test(videoId)) {
      try {
        found = await loadFromNicoad(videoId);
      } catch (e) {
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
        icon: ((found.icon || BLANK_ICON) as string).replace(/^http:/, 'https:'),
        isSupplemented: true
      };
    } else {
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

  return {supplementThumbInfo, loadFromNicoad};
})();

export {OwnerSupplement};
