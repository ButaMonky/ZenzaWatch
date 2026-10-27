/**
 * Canonical TypeScript source for packages/lib/src/nico/NVWatchCaller.js (Task461).
 * Watch tracking ping. Fire-and-forget: transport failures are logged and resolve undefined.
 */
import type {NetUtilFetcher} from './NicoApiTypes';

declare const netUtil: NetUtilFetcher;

export interface NVWatchCallerClient {
  /** `trackingId` comes from watch data (`dmcInfo.trackingId`) and is URL-encoded. */
  call(trackingId: string): Promise<Response | undefined>;
}

const NVWatchCaller: NVWatchCallerClient = (() => {
  const FRONT_ID = '6';
  const FRONT_VER = '0';
  const call = (trackingId: string): Promise<Response | undefined> => {
    const url = `https://nvapi.nicovideo.jp/v1/2ab0cbaa/watch?t=${encodeURIComponent(trackingId)}`;//&_frontendId=${FRONT_ID}`;
    return netUtil
      .fetch(url, {
        mode: 'cors',
        credentials: 'include',
        timeout: 5000,
        headers: {
          'X-Frontend-Id': FRONT_ID,
          'X-Frontend-Version': FRONT_VER
        }
      })
      .catch((e: unknown): undefined => {
        console.warn('nvlog fail', e);
        return undefined;
      });
  };

  return {call};
})();

export {NVWatchCaller};
