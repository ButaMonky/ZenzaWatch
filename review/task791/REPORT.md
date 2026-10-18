# Task791: UI02 simultaneous native previews and shared idle behavior

Status: REVIEW CANDIDATE; user live UAT pending. Do not start other UI repairs or integrate SCUI into develop until the user checks UI02.
Base: public Task729 2b711e6aa14d276b98409985137546f44c595d91.
Version: 2.7.304-scui02-twin-idle. MylistPocket is unchanged.

## Result
The UI02 comment button now opens a second native comment list while retaining the original miniature flow over the thumbnail. Both native views share CommentPreviewModel and have independent mode-scoped CSS, row DOM and cancellable lifecycle. Closing, remounting or disposing removes the secondary view and listeners. Pending updates cannot hydrate cached comments after a video reset.

The existing idle seconds apply to the scene, miniature and open list together. Hover and focus are tracked independently for each real visible surface; pin/drag retains the display. Horizontal and vertical transfer corridors retain a bounded grace period without adding an invisible hit overlay. Hidden step-menu input focus is released without clearing focus on visible controls. UI02 remains horizontal at320px, and fullscreen placement belongs to the bridge rather than competing provider rules. Shared behavior is regression-tested across the existing layouts; this task does not redesign another UI.

## Verification
- Final sandbox build: PASS, only ZenzaWatch-dev.user.js changed. All other nine canonical bundles unchanged.
- Final full root suite: **3219 passing, 78 existing pending, 0 failing; ROOT_EXIT=0**. Pending tests are not claimed as passes.
- Final native Chrome actual input/Fullscreen API: **52 PASS**, widths320/768/1536, real wheel scrolling, native time-label click, focus retention, idle hiding and disposal.
- Native CSS geometry sweep: **8960 checks, 8954 PASS and6 pre-existing UI07 failures**. Width320=2984 checks/6 failures;768=2988/0;1536=2988/0. Both modes and seek positions0/5/50/95/99/100 covered. This is not an all-layout-pass claim.
- Independently reproduced the same6 UI07 failures using all22 product modules and native classes/CSS from exact base2b711e6: normal320x900 list top723,height200,bottom923. The23px overflow is pre-existing; UI07 repair is deferred to the user checkpoint.
- Fresh review findings resolved: obsolete narrow UI02 provider placement and stale model-cache hydration after reset.
- Initial RED coverage included absent second native view, independent hover/focus holds, drag retention and horizontal panel transfer. The first full root run had3 old test fixtures missing window.clearTimeout; corrected those fixtures to browser timer APIs, then reran the full root suite above.
- QA corrections: coalescing requestAnimationFrame matches production; geometry compares against original native hover rows instead of fabricated absolute-row CSS. Actual fullscreen wheel required headless '--screen-info={1600x1000}' because the default800x600 virtual screen did not cover the900px test viewport. No product workaround was added for that harness defect.

## Review artifact
review/task791/ZenzaWatch-dev.user.js is derived by tools/qa/package-task791.cjs from the sandbox-generated canonical dist. Only its downloadURL/updateURL metadata lines are pinned to this review branch; executable content is identical. SHA256:85b9d92c14e5b119c2d7e7d52e77ef978f11ff66971205c037bf9641aa608bf4.
The canonical dist remains directly reproducible. No manual dist merge, rebase or force push.

## Limits and next step
Chrome evidence uses synthetic comment data with real native class/CSS code. Logged-in NicoNico behavior, CA fidelity and performance p50/p95 are not certified. Existing Task730 strict TS migration is independent and not duplicated here.
User checks the three points in CHECK.md first. Other UI repairs and formal SCUI integration remain gated. Unrelated private TS branch integration is managed separately.
