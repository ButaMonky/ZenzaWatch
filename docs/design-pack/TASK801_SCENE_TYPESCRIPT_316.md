# Task801 — integrated scene runtime TypeScript, 2.7.316

## Release provenance

The 2.7.313 scene repair was published only on `publication/task801-scui-preview-settings`.
Public develop later shipped Task904 as 2.7.315 without that branch. This release merges
`a9872c21` into the scene repair branch, retaining both playback recovery and the repaired UI.
The intended integration destination is public develop; a branch-only upload does not complete this release.

## TypeScript ownership

Six additional modules now have canonical sources under `tools/typescript-stage1/nico-src`:

- SceneSearchController: lifecycle, immutable snapshots, asynchronous preview cancellation.
- SceneSearchInteraction: pointer corridors, hover/focus/drag holds and release.
- ScenePreviewIdleLimiter: idle timeout and timer cancellation.
- SceneSearchShortcutRouter: existing commands and replaceable layout controls.
- SceneCommentSearch: loaded-comment search and video-bound selection.
- SceneCommentSearchPanel: safe result rendering and keyboard handling.

The existing SceneSearchPreferences, SceneSearchPlacement, SceneSearchPreviewView and
SceneSearchLayout00 remain canonical TypeScript. Ten runtime modules are generated.
SceneRuntimeContracts contains type-only boundaries. `nico:verify` now also compiles
positive/negative integration type tests. Strictness was not relaxed; no `any`, ts-ignore,
or nocheck was added. Generated JS must be updated with `npm run nico:sync`.

The large settings application and legacy integration bridge still consume these modules
from JavaScript. This release does not claim that those entire applications have been converted.

## Review and decisions

Independent review checked migration parity and the Task904 source/distribution ASTs.
The review found three contract mismatches: DOM-element hold identifiers, mutable control
slots, and explicit null/undefined dependency inputs. Added type tests failed for each,
then passed after correcting the contracts.

A Text-node click target lost the original optional-method guard during migration. Although
graded minor in review, it was treated as a required parity fix: the regression test failed
with a TypeError, then passed after restoring the guard. No UI redesign was introduced.

The first browser run had an unexplained hit-test failure. The diagnostic rerun passed315
checks without a product-code change. Diagnostic rectangle/visibility/top-element data is
now included on failure; this observation is retained rather than represented as a proven fix.

The initial full suite passed3577 tests with78 pending and one failing distribution-baseline
test. The comparison incorrectly looked for the preserved Task791 review file in the incoming
Task904 branch. It now compares that review file with its original base, and unrelated dist
files with incoming develop. All six unrelated rebuilt addon bodies matched incoming develop
after build-ID normalization; their exact incoming distribution bytes were preserved.

## Verification

- Final sandbox build: exit0, both main and settings regenerated.
- Full suite: 3579 passing,78 pending,0 failures (exit0).
- Distribution browser matrix:956 checks passed (exit0).
- Strict type tests and generated runtime consistency:10 modules passed.
- Browser failure diagnosis: after sequential display-mode changes, the preview was hidden
  (shown:false, zero-sized button rectangle). The CSS hit-test now re-enters the same seek
  position with real pointer input before each mode sample. Idle/release assertions remain.
- Review fixes verified:12 compile-time integration failures and one Text-target runtime
  failure reproduced before fixes; type checks and20 focused tests pass afterward.
- No remaining review findings deferred. Existing78 pending tests were not changed.
- Test logs retained locally under tools/typescript-stage1/.generated/scene316/.
- Publication verification is recorded after the normal push.
