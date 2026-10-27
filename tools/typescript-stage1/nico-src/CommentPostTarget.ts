/**
 * Task502: canonical TypeScript target selection for comment posting.
 * Watch-V4 thread data is external input; only the fields used here are probed.
 * Keep the original first-match and same-id filtering semantics.
 */
export interface PostThreadCandidate {
  readonly id?: unknown;
  readonly isDefaultPostTarget?: unknown;
}

export interface PostTargetSelection<T extends PostThreadCandidate> {
  readonly defaultThread: T | null;
  readonly threadId: unknown;
  readonly canPost: boolean;
  readonly postUnavailableReason: null | 'no-post-target' | 'malformed-comment';
  readonly optionalThreads: T[];
}

const CommentPostTarget = {
  select<T extends PostThreadCandidate>(
    threads: T[], commentMetadataIssues: readonly unknown[]
  ): PostTargetSelection<T> {
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
export {CommentPostTarget};
