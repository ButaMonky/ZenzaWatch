# Scene runtime TypeScript integration

> Execute inline with executing-plans; preserve the user's approved UI and integration request.

**Goal:** Combine Task904 playback recovery with Task801 scene fixes and make the scene interaction runtime TypeScript-owned.

**Architecture:** Preserve the four existing strict TS modules. Add strict state, timer, pointer, shortcut and comment-search contracts without changing UI behavior. Generate legacy JS from TS through the existing guarded sync pipeline.

**Spec:** TASK801_SCENE_VISIBILITY_313.md, TASK801_SCENE_SETTINGS_312.md and the user's 2026-10-23 request.

## Constraints
- Merge latest public develop, no rebase or force push. Rebuild userscripts.
- Preserve three presentations, focus release, mini clipping, parent visibility and settings synchronization.
- No any, ts-ignore or disabled strict checking in new modules.
- Integrate playback recovery; do not replace Task904 with an older userscript.

## Tasks
- [x] Merge develop and rebuild conflicting distributions; preserve both source changes.
- [x] Add compile-time contracts and synchronization regression coverage for Controller, Interaction, IdleLimiter, ShortcutRouter, CommentSearch and CommentSearchPanel.
- [x] Port those modules without runtime algorithm changes; reuse existing rendering/preferences/placement TS.
- [x] Run type/sync checks, scene regression tests, whole suite and distribution browser checks.
- [ ] Review combined change, rebuild/package at a version above 2.7.315 and publish normally after successful verification.

## Review focus
Pointer focus must release without an outside click; stale async previews must not render after video changes; disposal must cancel timers; master-off must preserve children; empty/malformed comment inputs must not execute HTML or seek stale video results.

## Scope boundary
The large advanced settings application and legacy integration bridge remain JS consumers of the typed scene contracts in this phase. They are not represented as fully migrated. This phase covers the repaired scene interaction and its immediate runtime dependencies; the four repaired rendering modules already have strict TS sources.

## Execution record
Pre-flight: contracts supply typed dependencies to six generated modules. Existing four modules retain their interfaces.
Review: fresh independent review; DOM hold sources, mutable slots, null/undefined dependencies fixed after failing type tests. Optional click method guard restored after failing runtime test (parity requirement).
Verification:3579 passing,78 pending,0 failing;956 browser checks;10 module strict sync.
Ruling: integration bridge and large settings application remain JS consumers, not claimed fully TS. Upstream unrelated source changes retained.
