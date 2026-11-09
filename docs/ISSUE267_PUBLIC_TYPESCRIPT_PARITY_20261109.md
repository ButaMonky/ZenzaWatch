# Issue #267 — public TypeScript parity test repair (2026-11-09)

## Provenance and scope
- Public repository: `ButaMonky/ZenzaWatch`.
- Parent PR #46 (`fa1ed4c6ce8ee20abf8a9c4da7444b3ad1513f4a`): generate P12 prerequisites on clean runners.
- Parent PR #47 (`99631851cf3f7251f0788142b9c88de5719de8f3`): load actual scene-search ownership dependencies for Task956 Chromium test.
- This branch `fix/issue267-public-ts-fixtures-20261109` is stacked on PR #47, without altering either parent branch, any product runtime source, release artifacts or public/private `develop`.

## Failures identified in original GitHub run
[Run 42418929616](https://github.com/ButaMonky/ZenzaWatch/actions/runs/42418929616) on PR #46 showed P12 prerequisites emitted successfully but twelve TypeScript tests failed:
- 1 WatchInfoCacheDb fixture-vs-runtime parity assertion.
- 8 automatic-resume delete/switch/serial-write tests using an artificial Config fixture that disabled recording.
- 1 shortcut/closure test using a Config fixture without the real `getValue` method.
- 2 manual-bookmark Dock/Panel label assertions that expected older wording.

These failures were reproduced by the unmodified local target files (12/25 failing). They are test-contract drift, **not permission to bypass production invariants or change product behavior to match a stale fixture**.

## Test-only correction
- `nico-dialog-delete-switch-save.test.mjs`: enable `resume.recordEnabled` explicitly for tests of ordinary saves, and add a negative test proving OFF blocks saving on both direct and video-switch paths.
- `nonvisual-input-issues.test.mjs`: provide Config.getValue backed by fixture props so Dialog.close exercises its actual dependency contract.
- `p12-manual-bookmark-dock.test.mjs`: expect the current `しおり・ABリピート` summary.
- `p12-manual-bookmark-panel.test.mjs`: expect `＋ 現在位置にしおり` without weakening the existing Add/storage/native keyboard assertions.
- `nico-api-task646.test.mjs`: retain byte-exact comparisons on all other fields and side effects, explicitly assert the intentional `resumeOverride=null` cleanup and `limits.resume=1` policy, add a negative boundary asserting that an explicit manual 0-second position remains `resumeOverride=0`.

No product TypeScript/JavaScript or distribution files are modified in this PR.

## Local regression
- The five directly affected TypeScript test files: **86 tests passed, 0 failed** after correction.
- Full TypeScript suite: see PR comment for the actual exit status and summary.
- Full public JavaScript, Chromium, secret scanning and GitHub Actions: separate required gates.
- No real user data, cookies, HAR, tokens, online NicoNico/YouTube requests were collected.

## Integration safety
- Keep this as a stacked Draft PR until GitHub Actions confirm all jobs and public `develop` is still a compatible base.
- No amend, reset, rebase, force-push, or direct `develop` modification.
- If parent PRs change, use a fresh integration branch on their accepted SHA and preserve this commit as provenance.
