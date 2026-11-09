// GENERATED FROM tools/typescript-stage1/nico-src/SceneResumeMarkerPresenter.ts
import {TimelineGeometry} from './TimelineGeometry';
//===BEGIN===
//@require TimelineGeometry
/**
 * Shared timeline presentation boundary for automatic resume, saved points/ranges
 * and transient AB drafts. Storage and seek actions remain with their owners.
 * TimelineGeometry alone converts time; this presenter converts ratios to CSS.
 */

class SceneResumeMarkerPresenter {
    static projectPoint(time, duration, policy = {}) {
        if (typeof time !== 'number' || !Number.isFinite(time) ||
            !Number.isFinite(duration) || duration <= 0)
            return null;
        if (!policy.clamp && (time < 0 || time > duration))
            return null;
        const ratio = TimelineGeometry.timeToRatio(time, duration);
        if (ratio === null || (policy.includeStart === false && ratio === 0) ||
            (policy.includeEnd === false && ratio === 1))
            return null;
        return { time: TimelineGeometry.ratioToTime(ratio, duration), ratio, left: `${ratio * 100}%` };
    }
    static projectInterval(start, end, duration, policy = {}) {
        const a = SceneResumeMarkerPresenter.projectPoint(start, duration, policy);
        const b = SceneResumeMarkerPresenter.projectPoint(end, duration, policy);
        return { start: a, end: b, band: a && b && b.ratio > a.ratio ?
                { left: a.left, width: `${(b.ratio - a.ratio) * 100}%` } : null };
    }
    static placePoint(node, point) {
        node.style.left = point.left;
    }
    static placeInterval(node, band) {
        node.style.left = band.left;
        node.style.width = band.width;
    }
    /** Every dynamic layer shares its containing track, never viewport pixels. */
    static createLayer(track, className) {
        const layer = track.ownerDocument.createElement('div');
        layer.className = `timelineMarkerLayer ${className}`;
        track.append(layer);
        return layer;
    }
    static clearNative(pointers) {
        for (const pointer of pointers || []) {
            for (const name of ['timeline-ratio', 'duration', 'time', 'text', 'data-param'])
                pointer.removeAttribute(name);
            pointer.hidden = true;
        }
    }
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
            const point = SceneResumeMarkerPresenter.projectPoint(time, length, { includeStart: false });
            if (!validDuration || !resume || !point || typeof resume.now !== 'string' || !resume.now.trim()) {
                SceneResumeMarkerPresenter.clearNative([pointer]);
                continue;
            }
            pointer.setAttribute('duration', String(length));
            pointer.setAttribute('time', String(time));
            pointer.setAttribute('text', `${resume.now} ここまで見た`);
            pointer.setAttribute('timeline-ratio', String(point.ratio));
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
