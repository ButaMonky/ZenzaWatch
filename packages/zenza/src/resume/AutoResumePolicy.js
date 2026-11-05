// GENERATED FROM tools/typescript-stage1/p12-src/AutoResumePolicy.ts
//===BEGIN===
const marginSeconds = 10;
const epoch = (value) => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;
const eligible = (time, duration) => typeof time === 'number' && Number.isFinite(time) &&
    time > marginSeconds && time < duration - marginSeconds;
const matches = (itemVideo, videoId) => itemVideo === undefined || itemVideo === videoId;
/**
 * Apply a clear barrier conservatively. Server updates with no trustworthy
 * timestamp remain hidden after a clear. A future local point can be selected,
 * but an old server value cannot silently supersede it again.
 * Invalid barrier timestamps fail closed to avoid resurrection.
 */
function selectAutoResume(input) {
    if (!input || typeof input.videoId !== 'string' || !input.videoId.trim())
        return null;
    const { videoId, duration, server, local, clear } = input;
    if (typeof duration !== 'number' || !Number.isFinite(duration) ||
        duration <= marginSeconds * 2)
        return null;
    if (clear && clear.videoId !== undefined && !matches(clear.videoId, videoId))
        return null;
    const barrier = clear ? epoch(clear.at) : null;
    if (clear && barrier === null)
        return null;
    const serverTime = server && matches(server.videoId, videoId) &&
        eligible(server.time, duration) ? server.time : null;
    const serverDate = server ? epoch(server.updatedAt) : null;
    if (serverTime !== null && (barrier === null ||
        serverDate !== null && serverDate > barrier)) {
        const selected = {
            kind: 'automatic', videoId, source: 'server', time: serverTime,
            ...(serverDate === null ? {} : { recordedAt: serverDate })
        };
        return Object.freeze(selected);
    }
    let latest = null;
    let latestAt = -1;
    if (Array.isArray(local)) {
        for (const candidate of local) {
            if (!candidate || !matches(candidate.videoId, videoId) ||
                !eligible(candidate.time, duration))
                continue;
            const at = epoch(candidate.now);
            if (at === null || (barrier !== null && at <= barrier))
                continue;
            // Stable tie: the first point wins when timestamps are the same.
            if (at > latestAt) {
                latest = candidate;
                latestAt = at;
            }
        }
    }
    if (!latest)
        return null;
    return Object.freeze({
        kind: 'automatic', videoId, source: 'local',
        time: latest.time, recordedAt: latestAt
    });
}
//===END===
export {selectAutoResume};
