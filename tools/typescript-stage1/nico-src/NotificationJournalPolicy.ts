export type JournalLevel = 'info' | 'success' | 'warning' | 'error';
export type JournalCategory = 'general' | 'comment' | 'like' | 'network' | 'player' | 'system';
export type JournalDetails = Record<string, string | number | boolean>;
export interface JournalInput {
  level?: JournalLevel;
  category?: JournalCategory;
  message?: unknown;
  videoId?: unknown;
  source?: unknown;
  details?: unknown;
}
export interface JournalEntry {
  id: string;
  timestamp: number;
  level: JournalLevel;
  category: JournalCategory;
  message: string;
  videoId: string;
  source: string;
  details: JournalDetails;
}

const NotificationJournalPolicy = (() => {
  const MAX_TEXT = 1024;
  const levels = new Set(['info', 'success', 'warning', 'error']);
  const categories = new Set(['general', 'comment', 'like', 'network', 'player', 'system']);
  const safeKeys = new Set([
    'phase', 'event', 'reason', 'outcome', 'errorCode', 'statusCode',
    'httpStatus', 'threadId', 'attempt', 'retryScheduled', 'retryAfterMs',
    'operation', 'kind', 'errorName', 'requestId', 'postedNo', 'count', 'elapsedMs'
  ]);
  const privatePath = (path: string): string => path
    .replace(/\/[^/]+/g, segment =>
      /%[0-9a-f]{2}|^\/[a-z0-9._~+=-]{24,}$/i.test(segment) ? '/[REDACTED]' : segment)
    .replace(/(\/(?:token|secret|authorization|password|csrf|session)\/)[^/]+/gi, '$1[REDACTED]');
  const text = (value: unknown): string => {
    if (typeof value !== 'string') { return ''; }
    return value
      .replace(/(["'](?:token|(?:access|refresh)[_-]?token|secret|authorization|cookie|password|csrf|session)["']\s*:\s*)("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[^,}\s]+)/gi,
        '$1"[REDACTED]"')
      .replace(/(?:https?|wss?):\/\/[^\s<>"']+/gi, match => {
        try {
          const url = new URL(match);
          return url.origin + privatePath(url.pathname);
        } catch (_) { return '[URL]'; }
      })
      .replace(/(?:\/[A-Za-z0-9_~%.+=-]+)+(?:[?#][^\s<>"']*)?/g,
        match => privatePath(match.split(/[?#]/)[0]!))
      .replace(/\bBearer\s+[A-Za-z0-9._~+/-]+/gi, 'Bearer [REDACTED]')
      .replace(/\b(token|(?:access|refresh)[_-]?token|secret|authorization|cookie|password|csrf|session)\s*[:=]\s*[^\s,;]+/gi, '$1=[REDACTED]')
      .slice(0, MAX_TEXT);
  };
  const code = (value: unknown): string | undefined => typeof value === 'string' && /^[a-z0-9_-]{1,80}$/i.test(value) ? value : undefined;
  const videoId = (value: unknown): string => typeof value === 'string' && /^(?:sm|nm|so|ss)\d{1,16}$/i.test(value) ? value : '';
  const details = (data: unknown): JournalDetails => {
    const result: JournalDetails = {};
    if (!data || typeof data !== 'object' || Array.isArray(data)) { return result; }
    const fields = data as Record<string, unknown>;
    for (const key of safeKeys) {
      const value = fields[key];
      if (typeof value === 'boolean') { result[key] = value; }
      else if (typeof value === 'number' && Number.isFinite(value) &&
          Number.isSafeInteger(value) && Math.abs(value) <= 1e12) { result[key] = value; }
      else if (typeof value === 'string') {
        const normalized = code(value);
        if (normalized !== undefined) { result[key] = normalized; }
      }
    }
    return result;
  };
  const normalize = (entry: JournalInput | null | undefined, identity: {id: string; timestamp: number}): JournalEntry | null => {
    if (!entry || typeof entry !== 'object') { return null; }
    return {
      id: identity.id,
      timestamp: identity.timestamp,
      level: levels.has(String(entry.level)) ? entry.level as JournalLevel : 'info',
      category: categories.has(String(entry.category)) ? entry.category as JournalCategory : 'general',
      message: text(entry.message),
      videoId: videoId(entry.videoId),
      source: code(entry.source) || '',
      details: details(entry.details)
    };
  };
  return {normalize};
})();
export { NotificationJournalPolicy };
