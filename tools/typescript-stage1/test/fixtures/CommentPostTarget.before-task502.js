// Task502: select the posting thread without guessing a fallback target.
// This module intentionally preserves the watch-data JavaScript behavior.

//===BEGIN===
const CommentPostTarget = {
  select(threads, commentMetadataIssues) {
    const defaultThread = threads.find(t => t.isDefaultPostTarget) || null;
    return {
      defaultThread,
      threadId: defaultThread ? defaultThread.id : null,
      canPost: !!defaultThread,
      postUnavailableReason: defaultThread ? null :
        (commentMetadataIssues.length ? 'malformed-comment' : 'no-post-target'),
      optionalThreads: defaultThread ?
        threads.filter(t => t.id !== defaultThread.id) : threads.slice()
    };
  }
};
//===END===
export {CommentPostTarget};
