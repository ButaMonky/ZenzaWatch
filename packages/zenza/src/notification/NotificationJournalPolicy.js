// GENERATED FROM tools/typescript-stage1/nico-src/NotificationJournalPolicy.ts (Task990). Edit the .ts and run npm run nico:sync.
//===BEGIN===
const NotificationJournalPolicy = (() => {
    const MAX_TEXT = 1024;
    const levels = new Set(['info', 'success', 'warning', 'error']);
    const categories = new Set(['general', 'comment', 'like', 'network', 'player', 'system']);
    const safeKeys = new Set([
        'phase', 'event', 'reason', 'outcome', 'errorCode', 'statusCode',
        'httpStatus', 'threadId', 'attempt', 'retryScheduled', 'retryAfterMs',
        'operation', 'kind', 'errorName', 'requestId', 'postedNo', 'count', 'elapsedMs'
    ]);
    const privatePath = (path) => path
        .replace(/\/[^/]+/g, segment => /%[0-9a-f]{2}|^\/[a-z0-9._~+=-]{24,}$/i.test(segment) ? '/[REDACTED]' : segment)
        .replace(/(\/(?:token|secret|authorization|password|csrf|session)\/)[^/]+/gi, '$1[REDACTED]');
    const text = (value) => {
        if (typeof value !== 'string') {
            return '';
        }
        return value
            .replace(/(["'](?:token|(?:access|refresh)[_-]?token|secret|authorization|cookie|password|csrf|session)["']\s*:\s*)("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[^,}\s]+)/gi, '$1"[REDACTED]"')
            .replace(/(?:https?|wss?):\/\/[^\s<>"']+/gi, match => {
            try {
                const url = new URL(match);
                return url.origin + privatePath(url.pathname);
            }
            catch (_) {
                return '[URL]';
            }
        })
            .replace(/(?:\/[A-Za-z0-9_~%.+=-]+)+(?:[?#][^\s<>"']*)?/g, match => privatePath(match.split(/[?#]/)[0]))
            .replace(/\bBearer\s+[A-Za-z0-9._~+/-]+/gi, 'Bearer [REDACTED]')
            .replace(/\b(token|(?:access|refresh)[_-]?token|secret|authorization|cookie|password|csrf|session)\s*[:=]\s*[^\s,;]+/gi, '$1=[REDACTED]')
            .slice(0, MAX_TEXT);
    };
    const code = (value) => typeof value === 'string' && /^[a-z0-9_-]{1,80}$/i.test(value) ? value : undefined;
    const videoId = (value) => typeof value === 'string' && /^(?:sm|nm|so|ss)\d{1,16}$/i.test(value) ? value : '';
    const details = (data) => {
        const result = {};
        if (!data || typeof data !== 'object' || Array.isArray(data)) {
            return result;
        }
        const fields = data;
        for (const key of safeKeys) {
            const value = fields[key];
            if (typeof value === 'boolean') {
                result[key] = value;
            }
            else if (typeof value === 'number' && Number.isFinite(value) &&
                Number.isSafeInteger(value) && Math.abs(value) <= 1e12) {
                result[key] = value;
            }
            else if (typeof value === 'string') {
                const normalized = code(value);
                if (normalized !== undefined) {
                    result[key] = normalized;
                }
            }
        }
        return result;
    };
    const normalize = (entry, identity) => {
        if (!entry || typeof entry !== 'object') {
            return null;
        }
        return {
            id: identity.id,
            timestamp: identity.timestamp,
            level: levels.has(String(entry.level)) ? entry.level : 'info',
            category: categories.has(String(entry.category)) ? entry.category : 'general',
            message: text(entry.message),
            videoId: videoId(entry.videoId),
            source: code(entry.source) || '',
            details: details(entry.details),
            ...(typeof entry.version === 'string' && /^\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?$/i.test(entry.version) && entry.version.length <= 64 ? { version: entry.version } : {}),
            ...(typeof entry.build === 'string' && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}Z [a-f0-9]{7,40}$/i.test(entry.build) ? { build: entry.build } : {}),
            ...Object.fromEntries(['firstOccurredAt', 'lastOccurredAt', 'recoveredAt'].flatMap(key => {
                const value = entry[key];
                return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= 8640000000000000 ? [[key, value]] : [];
            }))
        };
    };
    return { normalize };
})();
//===END===
export {NotificationJournalPolicy};
