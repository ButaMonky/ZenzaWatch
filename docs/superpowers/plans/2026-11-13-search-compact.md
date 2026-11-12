# Compact search layout

Approved design: keyword/tag on the left and video/short on the right of one row. Show all returned suggestions in normal flow, followed by search settings. Only the entire search panel scrolls when it exceeds the available viewport height. Preserve search behavior and saved settings.

Implementation (writing-plans / inline execution):
- [x] Extend offline browser geometry checks for 10 suggestions, short/tall viewports, large surrounding text, and settings below all suggestions.
- [x] Update canonical VideoInfoPanel.ts, regenerate runtime and provenance. Measure viewport space on focus, hover and resize, accounting for scale.
- [x] Verify search/count regression tests, build and inspect generated distribution.
- [x] Mirror verified changes to private release. Publish with an explicit file allowlist.

Validation: 45 compact browser cases including real focus/resize listener wiring, scaled ancestors and video cards; 18 existing layout/native radio cases; 49 related unit tests in each repository; TypeScript contract checks and both builds passed. A separate review found no implementation blocker; its coverage suggestions for cards, scale and event wiring were added. Live NicoNico search was not accessed.

Existing isolated release worktrees are used. Unrelated manifests and untracked logs are preserved. Version 2.7.399-task1025; prior tag v2.7.398 provides rollback. ZenzaBlogPartsButton has no functional change; only its generated runtime provenance hash changes.

User checks: normal/big/wide mode, all returned suggestions above filters, whole-panel scrolling in a short window, video/short and keyword/tag switching.
