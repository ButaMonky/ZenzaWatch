# Task801 — visibility cleanup 2.7.313 / settings 0.3.65

User requested removal of obsolete scene controls, adjacent visibility groups, consistent parent-off behavior, an advanced-settings audit, and a push after repair.

## Changes
- Retired pin, seek-seconds and more-menu visibility controls from the UI and search. Stored keys remain readable for compatibility.
- Retired the unused additional-controls reveal preference and duplicate preview-panel switch. The canonical parent is `sceneSearch.enabled`.
- Group order is シーンサーチの表示 followed immediately by シーンサーチの操作ボタン.
- Parent OFF disables related settings/controls while preserving their saved choices. Comment-related controls also depend on the comment-preview permission.
- An old `ui.scene.panel=false` is inherited when the canonical parent has never been saved. Explicit new-parent ON overrides it, including backup restore and separate settings-window save/storage notifications.
- The semantic preview controller owns root visibility. The legacy panel display snapshot must not overwrite its idle/parent state.
- Renamed the saved open-state setting to コメントプレビューを開いた状態にする to distinguish it from permission to show comments.

## Review
Independent scoped review found two important migration paths: import/export presence and same-value external saves. Tests reproduced three failures, then passed after fixes. Focused regression suite: 100 passing. No minor findings deferred.

## Publication scope
Push the existing `publication/task801-scui-preview-settings` branch to its current `origin` (ButaMonky/ZenzaWatch). Do not force-push or change develop as part of this follow-up. User has explicitly authorized the push.
Final test and push results are recorded below after completion.

Final verification: `npm test -- --timeout 10000` — 3296 passing, 78 pending, 0 failing. Canonical TypeScript verification and sandbox build pass. Distribution settings/browser checks: 28 passing. Review/dist executable bodies are identical. Files ready for the authorized ordinary branch push.
