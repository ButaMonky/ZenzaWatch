/**
 * Task478: canonical TypeScript posting transport for ThreadLoader.
 * A single deadline covers BOTH response headers and the JSON body.
 * Never retry a POST here: unknown acceptance can cause duplicate comments.
 */
import type {NetFetchOptions} from './NicoApiTypes';

declare const netUtil: {
  fetch(url: string | URL, options: NetFetchOptions): Promise<Response>;
};

export type PostWireFailureKind = 'network' | 'header-timeout' | 'body-timeout';
export interface PostWireFailure extends Error {
  kind?: PostWireFailureKind;
  httpStatus?: number;
}

export interface AcceptedPostAcknowledgement {
  no: number;
  /** The server's optional id is not required for confirming a comment number. */
  id: unknown;
}
export interface CommentPostPacketInput {
  text: string;
  cmd?: string | null;
  vpos?: number | null;
  postKey: string;
  videoId: string;
  /** Single-use, user-completed Turnstile response; never log or persist. */
  challengeToken?: string;
}
export interface CommentPostPacket {
  packet: string;
  commandCount: number;
  hasBlankCommand: boolean;
}

const CommentPostWire = (() => {
  // Task483: do not turn booleans, arrays or blank strings into comment numbers.
  const parseAcknowledgement = (value: unknown): AcceptedPostAcknowledgement | null => {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) { return null; }
    const ack = value as Record<string, unknown>;
    const raw = ack.no;
    if (typeof raw !== 'number' && !(typeof raw === 'string' && /^[0-9]+$/.test(raw))) {
      return null;
    }
    const no = Number(raw);
    if (!Number.isSafeInteger(no) || no < 0) { return null; }
    return {no, id: ack.id};
  };
  // Task780: keep the untrusted post-key challenge shape at one typed boundary.
  // Omitted challenge remains compatible with older successful no-challenge replies.
  // Present-but-malformed challenge must never silently authorize a POST.
  const readChallenge = (value: unknown):
    {required: boolean | null; siteKey: string | null} => {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      return {required: null, siteKey: null};
    }
    const reply = value as Record<string, unknown>;
    if (!Object.prototype.hasOwnProperty.call(reply, 'challenge')) {
      return {required: false, siteKey: null};
    }
    const raw = reply.challenge;
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
      return {required: null, siteKey: null};
    }
    const challenge = raw as Record<string, unknown>;
    if (!Object.prototype.hasOwnProperty.call(challenge, 'isRequired')) {
      return {required: null, siteKey: null};
    }
    if (challenge.isRequired === false) {
      return {required: false, siteKey: null};
    }
    if (challenge.isRequired !== true ||
        !Object.prototype.hasOwnProperty.call(challenge, 'siteKey') ||
        typeof challenge.siteKey !== 'string' ||
        !/^[A-Za-z0-9_-]{8,128}$/.test(challenge.siteKey)) {
      return {required: null, siteKey: null};
    }
    return {required: true, siteKey: challenge.siteKey};
  };
  // Task487: a server payload is unknown until the key is checked.
  // Preserve the original bytes: whitespace is checked, not trimmed in the POST.
  const readPostKey = (value: unknown): string | null => {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }
    if (!Object.prototype.hasOwnProperty.call(value, 'postKey')) { return null; }
    const key = (value as {postKey?: unknown}).postKey;
    return typeof key === 'string' && !!key.trim() ? key : null;
  };
  const buildPacket = ({text, cmd, vpos, postKey, videoId, challengeToken}:
    CommentPostPacketInput): CommentPostPacket => {
    const commands = cmd?.split(/[\x20\xA0\u3000\t\u2003\s]+/).filter(Boolean) ?? [];
    return {
      packet: JSON.stringify({
        body: text,
        commands,
        vposMs: Math.floor((vpos || 0) * 10),
        postKey,
        videoId,
        ...(challengeToken ? {challengeToken} : {})
      }),
      commandCount: commands.length,
      hasBlankCommand: commands.some(command => command === '')
    };
  };
  // Task488: the comment and post-key endpoints both return {meta,data}.
  // Treat server JSON as unknown and fail closed when meta is malformed.
  // Preserve the original API error object so errorCode and status remain usable.
  const unwrapApiEnvelope = (value: unknown): unknown => {
    const invalid = (): never => {
      throw {kind: 'schema', errorCode: 'RESPONSE_SCHEMA', reason: 'invalid-api-meta'};
    };
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      return invalid();
    }
    const reply = value as Record<string, unknown>;
    const meta = reply.meta;
    if (meta === null || typeof meta !== 'object' || Array.isArray(meta)) {
      return invalid();
    }
    const status = (meta as Record<string, unknown>).status;
    if (!Number.isInteger(status) || (status as number) < 200 || (status as number) > 599) {
      return invalid();
    }
    if ((status as number) >= 300) { throw meta; }
    return reply.data;
  };
  // Task492: pure decision on the server rejection; unknown POST outcome is
  // never replayed. Only INVALID_TOKEN/EXPIRED_TOKEN can refresh once.
  const classifyPostFailure = (
    error: unknown, retrying: boolean
  ): {action: 'unknown' | 'retry-token' | 'rejected'; statusCode?: unknown; errorCode?: unknown} => {
    const wrapped = error !== null && typeof error === 'object' ?
      (error as Record<string, unknown>) : {};
    const value = wrapped.result;
    const result = value !== null && typeof value === 'object' ?
      (value as Record<string, unknown>) : {};
    const statusCode = result.status;
    const errorCode = result.errorCode;
    if (statusCode == null) { return {action: 'unknown'}; }
    const action = !retrying && (errorCode === 'INVALID_TOKEN' ||
      errorCode === 'EXPIRED_TOKEN') ? 'retry-token' : 'rejected';
    return {action, statusCode, errorCode};
  };
  const POST_TIMEOUT_MS = 30 * 1000;
  const safeStatusCode = (value: unknown): number | undefined => {
    const status = Number(value);
    return Number.isInteger(status) && status >= 100 && status <= 599 ? status : undefined;
  };
  const fetchJsonWithin = async (
    url: string | URL, options: NetFetchOptions, timeoutMs: number = POST_TIMEOUT_MS
  ): Promise<unknown> => {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    let stage: 'headers' | 'body' = 'headers';
    let timer: number | undefined;
    const deadline = new Promise<never>((resolve, reject) => {
      timer = setTimeout(() => {
        const kind: PostWireFailureKind = stage === 'headers' ? 'header-timeout' : 'body-timeout';
        const error = Object.assign(new Error(kind), {name: 'timeout', kind});
        reject(error);
        if (controller) { controller.abort(error); }
      }, timeoutMs);
    });
    deadline.catch(() => {});
    try {
      let res: Response;
      try {
        res = await Promise.race([netUtil.fetch(url, {
          ...options, timeout: timeoutMs,
          ...(controller ? {signal: controller.signal} : {})
        }), deadline]);
      } catch (e: unknown) {
        const detail = e as {kind?: PostWireFailureKind; message?: string} | null;
        throw (detail && detail.kind) ? e :
          Object.assign(e instanceof Error ? e : new Error(String((detail && detail.message) || e)),
            {kind: 'network' as const});
      }
      stage = 'body';
      try {
        return await Promise.race([res.json() as Promise<unknown>, deadline]);
      } catch (error: unknown) {
        // Preserve the HTTP status only as diagnostic metadata, never as a retry signal.
        const httpStatus = safeStatusCode(res && res.status);
        const detail = error as PostWireFailure | null | undefined;
        if (detail && httpStatus !== undefined && detail.httpStatus === undefined) {
          detail.httpStatus = httpStatus;
        }
        throw error;
      }
    } finally {
      clearTimeout(timer);
    }
  };
  // Task490: typed nvapi post-key GET; do not resolve or synthesize challenges here.
  const getPostKey = async (threadId: string | number, language = 'ja-jp'): Promise<unknown> => {
    const url = `https://nvapi.nicovideo.jp/v1/comment/keys/post?threadId=${threadId}`;
    const result = await fetchJsonWithin(url, {
      headers: {
        'X-Frontend-Id': '6',
        'X-Frontend-Version': '0',
        'X-Niconico-Language': language
      },
      credentials: 'include'
    });
    return unwrapApiEnvelope(result);
  };
  // Task491: typed nvComment POST request; transport never retries by itself.
  const postComment = async (url: string | URL, body: string): Promise<unknown> => {
    const result = await fetchJsonWithin(url, {
      method: 'POST',
      headers: {
        'X-Frontend-Id': '6',
        'X-Frontend-Version': '0',
        'Content-Type': 'text/plain; charset=UTF-8'
      },
      body
    });
    return unwrapApiEnvelope(result);
  };
  return {fetchJsonWithin, parseAcknowledgement, readPostKey, readChallenge, buildPacket, unwrapApiEnvelope, getPostKey, postComment, classifyPostFailure};
})();
export {CommentPostWire};
