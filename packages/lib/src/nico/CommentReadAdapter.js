// GENERATED FROM tools/typescript-stage1/nico-src/CommentReadAdapter.ts (Task498). Edit the .ts and run npm run nico:sync.
//===BEGIN===
const CommentReadAdapter = (() => {
    const FORK_LABEL = {
        0: 'main', 1: 'owner', 2: 'easy', 3: 'ai'
    };
    const commentSchemaError = (reason) => ({ kind: 'schema', errorCode: 'RESPONSE_SCHEMA', reason });
    const threadKey = (data) => {
        const bag = data;
        if (!data || typeof bag?.threadKey !== 'string' || !bag.threadKey.trim()) {
            throw commentSchemaError('missing-thread-key');
        }
        return data;
    };
    const threads = (data, msgInfo) => {
        const payload = data;
        const info = msgInfo;
        if (!data || typeof data !== 'object' || Array.isArray(data) ||
            !Array.isArray(payload?.globalComments) || !Array.isArray(payload.threads) ||
            !Array.isArray(info?.threads)) {
            throw commentSchemaError('invalid-thread-envelope');
        }
        const globalComments = payload.globalComments;
        if (globalComments.some(entry => {
            const value = entry;
            return !entry || !Number.isSafeInteger(value?.count) ||
                value?.count < 0;
        })) {
            throw commentSchemaError('invalid-global-count');
        }
        const expected = new Set(info.threads.map(raw => {
            const thread = raw;
            const fork = thread && (thread.forkLabel ||
                (typeof thread.fork === 'string' ? thread.fork :
                    FORK_LABEL[thread.fork]));
            return thread && thread.id != null && fork ?
                `${String(thread.id)}:${fork}` : null;
        }).filter(Boolean));
        const seen = new Set();
        for (const raw of payload.threads) {
            const thread = raw;
            const id = thread && thread.id;
            const validId = (typeof id === 'string' && /^[0-9]+$/.test(id)) ||
                (Number.isSafeInteger(id) && id >= 0);
            const fork = thread && thread.fork;
            const key = `${String(id)}:${fork}`;
            const count = thread?.commentCount;
            const comments = thread?.comments;
            if (!validId || !['main', 'owner', 'easy', 'ai'].includes(fork) ||
                !expected.has(key) || seen.has(key) ||
                !Number.isSafeInteger(count) || count < 0 ||
                !Array.isArray(comments) ||
                comments.some(comment => !comment || typeof comment !== 'object')) {
                throw commentSchemaError('invalid-thread-target');
            }
            seen.add(key);
        }
        return data;
    };
    return Object.freeze({ threadKey, threads });
})();
//===END===
export {CommentReadAdapter};
