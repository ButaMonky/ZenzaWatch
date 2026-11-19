/**
 * Task480 canonical TypeScript: nvapi playback-position writer.
 * Maintain the v2-only PUT request, cookie policy and legacy error payloads.
 * HTTP bodies are unknown; do not assume nvapi success based on JSON shape.
 */
import type {NetUtilFetcher} from './NicoApiTypes';

declare const netUtil: NetUtilFetcher;
declare const RequestDiagnostics: typeof import('./RequestDiagnostics').RequestDiagnostics;

interface PlaybackResponseBody {
  readonly meta?: {readonly status?: unknown; readonly errorCode?: unknown};
}
export interface PlaybackPositionReceipt {
  readonly status: number;
  /** Unvalidated server-provided meta.status; absent bodies yield undefined. */
  readonly metaStatus: unknown;
}
export interface PlaybackPositionClient {
  record(
    videoId: string,
    seconds: number,
    frontendId?: string | number | null,
    frontendVersion?: string | number | null
  ): Promise<PlaybackPositionReceipt>;
}

const PlaybackPosition: PlaybackPositionClient = (() => {
  const URL_V2 = 'https://nvapi.nicovideo.jp/v2/users/me/watch/history/playback-position';
  const isVideoId = (id: unknown): id is string => typeof id === 'string' && /^[a-z]{2}\d+$/.test(id);

  const readBody = async (res: Response): Promise<unknown> => {
    if (res.status === 204) return undefined;
    if (typeof res.text === 'function') {
      const text = await res.text();
      if (!text || !text.trim()) return undefined;
      try {
        return JSON.parse(text) as unknown;
      } catch (_) {
        throw {reason: 'invalid-body', status: res.status};
      }
    }
    if (typeof res.json === 'function') {
      try {
        return await res.json() as unknown;
      } catch (_) {
        throw {reason: 'invalid-body', status: res.status};
      }
    }
    return undefined;
  };

  /** Narrow only the optional object boundary, not the untrusted status value. */
  const readMeta = (body: unknown): PlaybackResponseBody['meta'] | undefined => {
    if (!body || typeof body !== 'object' || !('meta' in body)) return undefined;
    const meta: unknown = body.meta;
    if (!meta || typeof meta !== 'object') return undefined;
    return meta as NonNullable<PlaybackResponseBody['meta']>;
  };

  const record: PlaybackPositionClient['record'] = async (videoId, seconds, frontendId, frontendVersion) => {
    if (!isVideoId(videoId)) throw {reason: 'invalid-video-id'};
    if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds < 0) {
      throw {reason: 'invalid-seconds'};
    }
    const ticket = typeof RequestDiagnostics === 'undefined' ? undefined :
      RequestDiagnostics.begin('playback-position', videoId, 'response');
    let res: Response | undefined;
    try {
      res = await netUtil.fetch(URL_V2, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-Frontend-Id': String(frontendId ?? 6),
          'X-Frontend-Version': String(frontendVersion ?? 0),
          'X-Request-With': 'https://www.nicovideo.jp'
        },
        body: JSON.stringify({videoId, seconds}),
        ...(ticket ? {diagnosticActive: () => false} : {})
      });
      if (!res) throw {reason: 'no-response'};
      if (typeof res.status === 'number' && (res.status < 200 || res.status > 299)) {
        throw {reason: 'http', status: res.status};
      }
      const body = await readBody(res);
      const meta = readMeta(body);
      const metaStatus = meta?.status;
      // Older clients accept receipts without metadata and numeric status strings.
      // Only an empty acknowledgement or an explicit successful status confirms recovery.
      if (ticket && body !== undefined) {
        const status = typeof metaStatus === 'string' && /^\d{3}$/.test(metaStatus) ? Number(metaStatus) : metaStatus;
        const failure = RequestDiagnostics.responseFailure(res, {status, errorCode:meta?.errorCode});
        if (failure) ticket.failure(failure);
      }
      if (meta?.errorCode || (metaStatus !== undefined && !((metaStatus as number) >= 200 && (metaStatus as number) <= 299))) {
        throw {reason: 'api', status: metaStatus, errorCode: meta?.errorCode || null};
      }
      ticket?.success();
      return {status: res.status, metaStatus};
    } catch (error) {
      if (ticket) {
        const failure = (error as {reason?: string} | null)?.reason === 'invalid-body'
          ? {kind:'schema', httpStatus:res?.status, missing:'response.json'}
          : RequestDiagnostics.readFailure(res, error);
        ticket.failure(failure);
      }
      throw error;
    }
  };
  return {record};
})();

export {PlaybackPosition};
