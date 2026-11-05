// GENERATED FROM tools/typescript-stage1/nico-src/SceneResumeMarkerPresenter.ts
//===BEGIN===
class SceneResumeMarkerPresenter {
    static render(pointers, resumePoints, duration, setProps) {
        if (!pointers) {
            return;
        }
        const length = Number(duration);
        const validDuration = Number.isFinite(length) && length > 0;
        const points = Array.isArray(resumePoints) ? resumePoints : [];
        for (let i = 0; i < pointers.length; i++) {
            const pointer = pointers[i];
            if (!pointer) {
                continue;
            }
            const resume = points[i];
            const time = Number(resume?.time);
            if (!validDuration || !resume || !Number.isFinite(time) ||
                time <= 0 || time > length || typeof resume.now !== 'string' || !resume.now.trim()) {
                pointer.hidden = true;
                // A hidden, recycled marker must not retain the previous video's
                // seek time or tooltip label in native DOM attributes.
                pointer.removeAttribute('duration');
                pointer.removeAttribute('time');
                pointer.removeAttribute('text');
                continue;
            }
            pointer.setAttribute('duration', String(length));
            pointer.setAttribute('time', String(time));
            pointer.setAttribute('text', `${resume.now} ここまで見た`);
            // A previous video's 'missing' state must never persist onto a valid point.
            pointer.hidden = false;
            if (resume.now !== '前回') {
                setProps([pointer, '--pointer-color', 'rgba(128, 128, 255, 0.6)'], [pointer, '--color', '#aef'], [pointer, '--scale-pp', '']);
            }
            else {
                // Empty custom properties clear stale per-marker overrides from dated history.
                setProps([pointer, '--pointer-color', ''], [pointer, '--color', ''], [pointer, '--scale-pp', 1.7]);
            }
        }
    }
}
//===END===
export {SceneResumeMarkerPresenter};
