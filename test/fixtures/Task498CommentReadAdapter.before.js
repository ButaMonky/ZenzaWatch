const CommentReadAdapter = Object.freeze({
    threadKey(data) {
      if (!data || typeof data.threadKey !== 'string' || !data.threadKey.trim()) {
        throw commentSchemaError('missing-thread-key');
      }
      return data;
    },
    threads(data, msgInfo) {
      if (!data || typeof data !== 'object' || Array.isArray(data) ||
          !Array.isArray(data.globalComments) || !Array.isArray(data.threads) ||
          !Array.isArray(msgInfo?.threads)) {
        throw commentSchemaError('invalid-thread-envelope');
      }
      if (data.globalComments.some(entry =>
        !entry || !Number.isSafeInteger(entry.count) || entry.count < 0)) {
        throw commentSchemaError('invalid-global-count');
      }
      const expected = new Set(msgInfo.threads.map(thread => {
        const fork = thread && (thread.forkLabel ||
          (typeof thread.fork === 'string' ? thread.fork : FORK_LABEL[thread.fork]));
        return thread && thread.id != null && fork ?
          `${String(thread.id)}:${fork}` : null;
      }).filter(Boolean));
      const seen = new Set();
      for (const thread of data.threads) {
        const id = thread && thread.id;
        const validId = (typeof id === 'string' && /^[0-9]+$/.test(id)) ||
          (Number.isSafeInteger(id) && id >= 0);
        const fork = thread && thread.fork;
        const key = `${String(id)}:${fork}`;
        if (!validId || !['main', 'owner', 'easy', 'ai'].includes(fork) ||
            !expected.has(key) || seen.has(key) ||
            !Number.isSafeInteger(thread.commentCount) || thread.commentCount < 0 ||
            !Array.isArray(thread.comments) ||
            thread.comments.some(comment => !comment || typeof comment !== 'object')) {
          throw commentSchemaError('invalid-thread-target');
        }
        seen.add(key);
      }
      return data;
    }
  });
