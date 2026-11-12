# Click intent boundary implementation plan

Goal: Separate video click classification from interception, preserving the existing double-navigation protection while correcting unrelated nested-link interception.

Architecture: HoverMenu's canonical TypeScript owns a side-effect-free click resolver. The existing handler consumes its result, then applies navigation policy and launches once. No third-party script names, APIs, or synthetic click replay. Full propagation redesign remains gated on real-site evidence.

Tasks:
- [x] Add canonical-source regression tests for ordinary nested nonvideo anchors without Nico-specific attributes, controls and editable regions, and video card regions.
- [x] Observe failures; extract `_resolveWatchClick`, treating the nearest explicit action/link as authoritative.
- [x] Regenerate legacy module and verify canonical/generated behavior, existing header double-open prevention, modifier keys and official routes.
- [x] Document remaining propagation limitation and commit to a separate investigation branch; do not replace stable distribution before live acceptance.

Ranking NG 68's body click listener records visited videos; this is a generic observer case. Its code is neither copied nor special-cased.

Validation: six failing nested-action cases reproduced before the fix. After the fix, 113 targeted tests passed, including existing double-open, official-route and preview cases. Type checks and generator verification passed. Stable distribution remains unchanged; live-site acceptance and click propagation redesign are still pending.
