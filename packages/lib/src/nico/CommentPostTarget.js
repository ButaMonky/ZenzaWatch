// GENERATED FROM tools/typescript-stage1/nico-src/CommentPostTarget.ts (Task502). Edit the .ts and run npm run nico:sync.
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
