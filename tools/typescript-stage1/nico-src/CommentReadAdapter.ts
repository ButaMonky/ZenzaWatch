/**
 * Task498 canonical TypeScript: nvComment read-response schema boundary.
 * Do not coerce unknown API data into empty comment lists after schema changes.
 */
type UnknownBag = {readonly [key: string]: unknown};
const CommentReadAdapter = (() => {
  const FORK_LABEL: {[key: number]: string} = {
    0: 'main', 1: 'owner', 2: 'easy', 3: 'ai'
  };
  const commentSchemaError = (reason: string) =>
    ({kind: 'schema', errorCode: 'RESPONSE_SCHEMA', reason});

  const threadKey = (data: unknown): unknown => {
    const bag = data as UnknownBag | null | undefined;
    if (!data || typeof bag?.threadKey !== 'string' || !bag.threadKey.trim()) {
      throw commentSchemaError('missing-thread-key');
    }
    return data;
  };

  const threads = (data: unknown, msgInfo: unknown): unknown => {
    const payload = data as UnknownBag | null | undefined;
    const info = msgInfo as UnknownBag | null | undefined;
    if (!data || typeof data !== 'object' || Array.isArray(data) ||
        !Array.isArray(payload?.globalComments) || !Array.isArray(payload.threads) ||
        !Array.isArray(info?.threads)) {
      throw commentSchemaError('invalid-thread-envelope');
    }
    const globalComments: unknown[] = payload.globalComments;
    if (globalComments.some(entry => {
      const value = entry as UnknownBag | null | undefined;
      return !entry || !Number.isSafeInteger(value?.count) ||
        (value?.count as number) < 0;
    })) {
      throw commentSchemaError('invalid-global-count');
    }
    const expected = new Set((info.threads as unknown[]).map(raw => {
      const thread = raw as UnknownBag | null | undefined;
      const fork = thread && (thread.forkLabel ||
        (typeof thread.fork === 'string' ? thread.fork :
          FORK_LABEL[thread.fork as number]));
      return thread && thread.id != null && fork ?
        `${String(thread.id)}:${fork}` : null;
    }).filter(Boolean));
    const seen = new Set<string>();
    for (const raw of payload.threads as unknown[]) {
      const thread = raw as UnknownBag | null | undefined;
      const id = thread && thread.id;
      const validId = (typeof id === 'string' && /^[0-9]+$/.test(id)) ||
        (Number.isSafeInteger(id) && (id as number) >= 0);
      const fork = thread && thread.fork;
      const key = `${String(id)}:${fork}`;
      const count = thread?.commentCount;
      const comments = thread?.comments;
      if (!validId || !['main', 'owner', 'easy', 'ai'].includes(fork as string) ||
          !expected.has(key) || seen.has(key) ||
          !Number.isSafeInteger(count) || (count as number) < 0 ||
          !Array.isArray(comments) ||
          comments.some(comment => !comment || typeof comment !== 'object')) {
        throw commentSchemaError('invalid-thread-target');
      }
      seen.add(key);
    }
    return data;
  };
  return Object.freeze({threadKey, threads});
})();
export {CommentReadAdapter};
