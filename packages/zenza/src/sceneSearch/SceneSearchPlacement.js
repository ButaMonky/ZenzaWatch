// GENERATED FROM tools/typescript-stage1/nico-src/SceneSearchPlacement.ts
//===BEGIN===
class SceneSearchPlacement {
    static overlap(a, b) {
        return Math.max(0, Math.min(a.left + a.width, b.left + b.width) - Math.max(a.left, b.left)) *
            Math.max(0, Math.min(a.top + a.height, b.top + b.height) - Math.max(a.top, b.top));
    }
    static compute(input) {
        const { viewport: v, player, seekbar, listOpen, previous } = input;
        const gap = 8, padding = 10, minLeft = 104;
        // Task954: use the reserved top of the expanded seekbar / fullscreen
        // control row. A hovering seekbar's current top is not a stable baseline.
        const anchored = Number.isFinite(input.previewAnchorTop);
        const stableTop = anchored ? Math.min(seekbar.top, input.previewAnchorTop) : seekbar.top;
        const clearance = anchored ? 12 : gap;
        const clamp = (n, a, b) => Math.max(a, Math.min(Math.max(a, b), n));
        const availableW = Math.max(1, v.width - gap * 2), viewportH = Math.max(1, v.height - gap * 2);
        const aboveSpace = clamp(stableTop - v.top - gap * 2, 0, viewportH);
        const belowSpace = clamp(v.top + v.height - seekbar.top - seekbar.height - gap * 2, 0, viewportH);
        const protectsBar = seekbar.width > 0 && seekbar.height > 0 && seekbar.top < v.top + v.height && seekbar.top + seekbar.height > v.top;
        const availableH = protectsBar ? Math.max(1, aboveSpace, belowSpace) : viewportH;
        const iw = Math.max(1, input.imageSize.width), ih = Math.max(1, input.imageSize.height);
        const requested = clamp(Number.isFinite(input.requestedScale) ? input.requestedScale : 100, 50, 200) / 100;
        const listScale = clamp(Number.isFinite(input.listScale) ? input.listScale : 100, 100, 200) / 100;
        let listWidth = listOpen ? clamp(availableW - padding - gap - Math.max(minLeft, iw * requested), 160, 280 * listScale) : 0;
        const footer = Number.isFinite(input.footerHeight) ? Math.max(36, input.footerHeight) : 54;
        let imageScale = Math.min(requested, Math.max(.05, (availableW - padding - (listOpen ? gap + listWidth : 0)) / iw), Math.max(.05, (availableH - padding - footer) / ih));
        const leftWidth = Math.max(minLeft, iw * imageScale);
        const width = Math.min(availableW, padding + leftWidth + (listOpen ? gap + listWidth : 0));
        const height = Math.min(availableH, padding + Math.max(ih * imageScale + footer, listOpen ? 240 * listScale : 0));
        const listMaxHeight = Math.max(32, height - padding);
        // Very short viewports scroll inside the panel; no stored setting is rewritten.
        const make = (x, y) => {
            const rect = { left: clamp(x, v.left + gap, v.left + v.width - gap - width),
                top: clamp(y, v.top + gap, v.top + v.height - gap - height), width, height };
            if (protectsBar && this.overlap(rect, seekbar) > 0) {
                if (height <= aboveSpace)
                    rect.top = clamp(rect.top, v.top + gap, seekbar.top - gap - height);
                else if (height <= belowSpace)
                    rect.top = clamp(rect.top, seekbar.top + seekbar.height + gap, v.top + v.height - gap - height);
            }
            return rect;
        };
        const result = (rect) => ({ rect, imageScale, listWidth, listMaxHeight, footerHeight: footer,
            overlapsVideo: this.overlap(rect, player) > 0 });
        // Task934: fullscreen right/center/left controls can cover the preview.
        // Previous follow/fixed branches returned before checking obstacles at all.
        // Keep normal/small positioning unchanged and preserve the original geometry
        // when there is no physical collision, including while pinned or held.
        const clearFullscreenIcons = (preferred) => {
            if (input.context !== 'fullscreen')
                return preferred;
            const blockers = (input.obstacles || []).filter(r => r.width > 0 && r.height > 0);
            if (!blockers.some(r => this.overlap(preferred, r) > 0))
                return preferred;
            // Bounded O(obstacles²) scoring; do not make a Cartesian grid of all
            // x/y boundaries on every seek-mousemove (the pointer must stay responsive).
            const candidates = [
                [preferred.left, preferred.top], [v.left + gap, v.top + gap],
                [v.left + v.width - gap - width, v.top + gap]
            ];
            for (const r of blockers) {
                const left = r.left - width - gap, right = r.left + r.width + gap;
                const top = r.top - height - gap, bottom = r.top + r.height + gap;
                candidates.push([preferred.left, top], [preferred.left, bottom], [left, preferred.top], [right, preferred.top], [left, top], [right, top], [left, bottom], [right, bottom]);
            }
            // Task954: an active comment input may need horizontal clearance, but
            // shifting upward only at the center causes a distracting preview jump.
            // Prefer collision-free X alternatives at the SAME vertical level first.
            // Retain the existing fallback if a very narrow viewport has no safe X.
            if (anchored && input.layout === 'follow') {
                let horizontal = null, closest = Infinity;
                for (const [x] of candidates) {
                    const rect = make(x, preferred.top);
                    if (Math.abs(rect.top - preferred.top) > .5)
                        continue;
                    const area = blockers.reduce((sum, r) => sum + this.overlap(rect, r), 0);
                    if (area === 0 && (!protectsBar || this.overlap(rect, seekbar) === 0)) {
                        const delta = Math.abs(rect.left - preferred.left);
                        if (delta < closest) {
                            horizontal = rect;
                            closest = delta;
                        }
                    }
                }
                if (horizontal)
                    return horizontal;
            }
            let best = preferred, bestOverlap = Infinity, bestDistance = Infinity;
            for (const [x, y] of candidates) {
                const rect = make(x, y);
                const area = blockers.reduce((sum, r) => sum + this.overlap(rect, r), 0) +
                    (protectsBar ? this.overlap(rect, seekbar) : 0);
                const distance = (rect.left - preferred.left) ** 2 + (rect.top - preferred.top) ** 2;
                if (area < bestOverlap || (area === bestOverlap && distance < bestDistance)) {
                    best = rect;
                    bestOverlap = area;
                    bestDistance = distance;
                }
            }
            return best;
        };
        if (input.hold && previous) {
            const held = make(previous.rect.left, previous.rect.top);
            return result(clearFullscreenIcons(held));
        }
        const above = stableTop - clearance - height;
        if (input.layout === 'follow')
            return result(clearFullscreenIcons(make(input.anchorX - width / 2, above)));
        if (input.context === 'normal') {
            const below = Math.max(player.top + player.height, seekbar.top + seekbar.height) + gap;
            return result(make(player.left, below + height <= v.top + v.height - gap ? below : above));
        }
        if (input.context === 'fullscreen')
            return result(clearFullscreenIcons(make(player.left + gap, above)));
        const hard = [seekbar, ...input.obstacles].filter(r => r.width > 0 && r.height > 0);
        const safe = (r) => hard.every(o => this.overlap(r, o) === 0) && this.overlap(r, player) === 0;
        if (previous) {
            const kept = make(previous.rect.left, previous.rect.top);
            if (safe(kept))
                return result(kept);
        }
        const candidates = [make(v.left + gap, above), make(v.left + v.width - gap - width, above)];
        const xs = [v.left + gap, v.left + v.width - gap - width], ys = [v.top + gap, above];
        for (const r of [player, ...hard]) {
            xs.push(r.left - width - gap, r.left + r.width + gap);
            ys.push(r.top - height - gap, r.top + r.height + gap);
        }
        for (const x of xs)
            for (const y of ys)
                candidates.push(make(x, y));
        const origin = previous?.rect || candidates[0];
        const score = (r) => [hard.reduce((sum, o) => sum + this.overlap(r, o), 0),
            this.overlap(r, player), (r.left - origin.left) ** 2 + (r.top - origin.top) ** 2];
        let best = candidates[0], bestScore = score(best);
        for (const r of candidates.slice(1)) {
            const next = score(r);
            if (next[0] < bestScore[0] || next[0] === bestScore[0] && (next[1] < bestScore[1] ||
                next[1] === bestScore[1] && next[2] < bestScore[2])) {
                best = r;
                bestScore = next;
            }
        }
        return result(best);
    }
}
//===END===
export {SceneSearchPlacement};
