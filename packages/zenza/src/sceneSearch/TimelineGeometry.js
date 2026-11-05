// GENERATED FROM tools/typescript-stage1/nico-src/TimelineGeometry.ts
//===BEGIN===
/**
 * Immutable, one-dimensional timeline geometry.
 * Supports horizontal tracks with positive axis-aligned scale/translation (including
 * ancestor transforms and zoom). Rotation, skew and reversed axes require a different map.
 * Finite out-of-range inputs clamp; invalid measurements/values return null, never NaN.
 * No DOM reads, event listeners, duration state or preview-placement policy.
 */
class TimelineGeometry {
    clientLeft;
    clientWidth;
    localWidth;
    clientRight;
    constructor(measurement) {
        this.clientLeft = measurement.clientLeft;
        this.clientWidth = measurement.clientWidth;
        this.localWidth = measurement.localWidth;
        this.clientRight = this.clientLeft + this.clientWidth;
    }
    static create(measurement) {
        if (!measurement) {
            return null;
        }
        const { clientLeft, clientWidth, localWidth } = measurement;
        const clientRight = clientLeft + clientWidth;
        if (!Number.isFinite(clientLeft) || !Number.isFinite(clientWidth) || clientWidth <= 0 ||
            !Number.isFinite(localWidth) || localWidth <= 0 ||
            !Number.isFinite(clientRight) || clientRight <= clientLeft) {
            return null;
        }
        return new TimelineGeometry({ clientLeft, clientWidth, localWidth });
    }
    /** Preserve the exact native range value when it is already in bounds. */
    static clampTime(seconds, duration) {
        if (!Number.isFinite(seconds) || !Number.isFinite(duration) || duration <= 0) {
            return null;
        }
        return Math.max(0, Math.min(seconds, duration));
    }
    static timeToRatio(seconds, duration) {
        const clamped = TimelineGeometry.clampTime(seconds, duration);
        // Clamp before division, so extreme but finite inputs cannot overflow.
        return clamped === null ? null : clamped / duration;
    }
    static ratioToTime(ratio, duration) {
        if (!Number.isFinite(duration) || duration <= 0) {
            return null;
        }
        const clamped = TimelineGeometry.clampRatio(ratio);
        return clamped === null ? null : clamped * duration;
    }
    static clampRatio(ratio) {
        return Number.isFinite(ratio) ? Math.max(0, Math.min(ratio, 1)) : null;
    }
    clientXToRatio(clientX) {
        if (!Number.isFinite(clientX)) {
            return null;
        }
        // Endpoint comparisons also prevent overflow in clientX - clientLeft.
        if (clientX <= this.clientLeft) {
            return 0;
        }
        if (clientX >= this.clientRight) {
            return 1;
        }
        return (clientX - this.clientLeft) / this.clientWidth;
    }
    localXToRatio(localX) {
        if (!Number.isFinite(localX)) {
            return null;
        }
        if (localX <= 0) {
            return 0;
        }
        if (localX >= this.localWidth) {
            return 1;
        }
        return localX / this.localWidth;
    }
    ratioToClientX(ratio) {
        const clamped = TimelineGeometry.clampRatio(ratio);
        return clamped === null ? null : this.clientLeft + clamped * this.clientWidth;
    }
    ratioToLocalX(ratio) {
        const clamped = TimelineGeometry.clampRatio(ratio);
        return clamped === null ? null : clamped * this.localWidth;
    }
}
//===END===
export {TimelineGeometry};
