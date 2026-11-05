// GENERATED FROM tools/typescript-stage1/p12-src/AutoResumeClearCoordinator.ts
//===BEGIN===
const valid = (videoId) => typeof videoId === 'string' && videoId.length > 0 && videoId.trim().length > 0 &&
    videoId.length <= 256;
/** A coordinator instance de-duplicates concurrent deletion of the same video. */
class AutoResumeClearCoordinator {
    pending = new Map();
    deps;
    constructor(deps) { this.deps = deps; }
    delete(videoId) {
        if (!valid(videoId))
            return Promise.reject(new TypeError('Invalid automatic resume video ID'));
        let session;
        try {
            session = this.deps.activeSessionToken?.();
        }
        catch (error) {
            // The caller always attaches an async error handler to release its
            // temporary save suppression. A synchronous throw would bypass it.
            return Promise.reject(error);
        }
        const existing = this.pending.get(videoId);
        if (existing && existing.session === session)
            return existing.operation;
        const operation = this.run(videoId, session);
        this.pending.set(videoId, { session, operation });
        void operation.then(() => { if (this.pending.get(videoId)?.operation === operation)
            this.pending.delete(videoId); }, () => { if (this.pending.get(videoId)?.operation === operation)
            this.pending.delete(videoId); });
        return operation;
    }
    async run(videoId, session) {
        const ownerActive = () => (!this.deps.activeVideoId || this.deps.activeVideoId() === videoId) &&
            (!this.deps.activeSessionToken || this.deps.activeSessionToken() === session);
        // Both watch ID and playback session must still belong to the request.
        if (!ownerActive()) {
            throw new Error('Automatic resume video changed');
        }
        const raw = await this.deps.clearLocal(videoId, 'deleted');
        const local = raw;
        if (!local || local.watchId !== videoId || !Array.isArray(local.resume) ||
            local.resume.length !== 0 || local.resumeClearReason !== 'deleted' ||
            typeof local.resumeClearedAt !== 'number' ||
            !Number.isSafeInteger(local.resumeClearedAt) || local.resumeClearedAt < 0) {
            throw new Error('Automatic resume local clear not acknowledged');
        }
        const outcome = (remote) => Object.freeze({
            kind: 'auto-resume-delete', videoId, local: 'cleared', remote,
            fullyAcknowledged: remote === 'acknowledged',
            retryRemote: remote === 'failed'
        });
        if (!ownerActive()) {
            return outcome('stale-video');
        }
        let loggedIn;
        try {
            loggedIn = this.deps.isLoggedIn();
        }
        catch {
            return outcome('unavailable');
        }
        if (!loggedIn || typeof this.deps.saveRemoteZero !== 'function') {
            return outcome('unavailable');
        }
        try {
            await this.deps.saveRemoteZero(videoId, 0);
            return outcome(ownerActive() ? 'acknowledged' : 'stale-video');
        }
        catch {
            // A late failure cannot request a retry for a playback session that
            // no longer owns this video. The remote status remains unconfirmed.
            // Never log exception content (which might contain credentials).
            return outcome(ownerActive() ? 'failed' : 'stale-video');
        }
    }
}
//===END===
export {AutoResumeClearCoordinator};
