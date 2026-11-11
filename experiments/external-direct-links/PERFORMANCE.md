# External player panel investigation — 2026-11-12

User report: version 4 plays video, records official watch history and applies likes. Slowness is in buttons/panels. Version 5 user verification is pending.

## Confirmed by code and offline reproduction

- The external launcher observes only the parent document. It cannot traverse mutations in the separate cross-origin player document. Thus version 4/5 do not rescan external links for every player comment mutation.
- The interaction guard handles discrete input events, not mousemove/pointermove. It does not make network requests.
- Version 5 removed the redundant settings bridge. This is a reduction in work, not a measured improvement in input latency.
- CommentHistoryPanel observes all body subtree child-list mutations while open. Every callback runs `_listen`, which scans all document iframes and attempts document access on them. Existing listeners are deduplicated, but the scan and cross-origin access checks still run.
- `node experiments/external-direct-links/investigate-panel-observer.cjs` executes the shipped `_listen` method under the same observer scope. Twenty unrelated mutation batches produce twenty full-document iframe scans. Only two window listeners remain attached: this reproduces redundant scanning, **not** a listener leak or a real-browser timing result.

## Candidates still requiring measurements

- Bookmark position and screen-filter geometry handlers synchronously read bounding boxes and update styles after observed ancestor changes. These paths can force layout and repeat within one frame. No runaway loop has been established. They are also present in the normal player.
- Media fragments still arrive through the GM loader. Transfer/decoding competes with UI work, but playback working does not prove or disprove an input-latency contribution. Do not change the confirmed-working authenticated transport without evidence.
- Frame composition and graphics acceleration remain possible contributors. No live performance trace has been collected.

## Separate visual finding

The version 5 display allowlist omits `videoHeader.position`. Thus header placement can still differ even after successfully importing other preferences. This is a configuration coverage issue, not evidence that a different player UI was built. Add coverage before claiming full visual equivalence.

## Next changes / validation

1. Narrow the comment-panel observer to iframe additions/removals; preserve frame listener lifecycle, outside-click and Escape behavior.
2. Measure repeated panel-position calls and coalesce them per animation frame if duplication is demonstrated. Preserve resizing, fullscreen and toolbar motion.
3. If version 5 remains slow, capture a short, user-controlled performance trace separating input dispatch, layout/paint and media/background tasks. Do not collect comment bodies, identifiers, URLs, cookies or account data.

This investigation does not claim that redundant iframe scans explain all reported slowness. No browser was opened and no account actions were performed.
