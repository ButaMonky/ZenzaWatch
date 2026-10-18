# Task801 — scene settings confirmation 2.7.312 / 0.3.64

Approved design: settings alongside an interactive illustrative preview. This stage is **not integrated or pushed**; user verification is required before integration.

## Changes
- Three peer choices: シーク位置に追従 / 位置を固定 / 従来表示. No compatibility foldout.
- Native setting cards/toggles retain draft/save/cancel/reset behavior and modified-value highlighting.
- Local preview demonstrates normal/fullscreen/small screens, independent fullscreen selection, and legacy image/list replacement.
- `sceneSearch.enabled` defaults true and gates every scene presentation, including pinned previews. Child preferences persist while disabled.
- The scene parent and three comment visibility switches use the same model keys on 表示・非表示.
- `sceneSearch.commentListScale` defaults 100, valid integer range 100–200. It expands the viewport, with screen bounds, without scaling comment fonts. Applied to modern and legacy presentations.
- Label standardized to コメントプレビューの背景濃度; only background alpha changes.
- Existing default idle/seek/link settings remain 2 seconds / 5 seconds / false. Visibility icon redesign remains deferred at user request.

## Review and verification
- Independent reviewer identified parent visibility losing to pin, and legacy list position still assuming 350px width. Both reproduced by failing tests, then fixed; 122 focused tests pass.
- Browser settings preview: distinct geometry for three screen modes; legacy swap, viewport enlargement with unchanged fonts, transparent background, and parent visibility pass.
- Distribution browser regression: 956 checks before the two review fixes; 315 after fixes. Additional distribution settings checks: 28 pass across viewport widths 320/768/1536, covering all three layouts, enlarged list edges and disabling pinned previews.
- TypeScript canonical sync/verification passes. Both userscripts rebuilt through `tools/build_task_sandbox.js`; review executable bodies match dist.
- Full suite result is recorded in the implementation plan after completion.

## User check
Install both confirmation files from `review/task801`: ZenzaWatch 2.7.312-task801 and standalone settings 0.3.64-task801.
1. Inspect the three choices and normal/fullscreen/small preview. Check legacy swaps image/list while retaining controls.
2. Toggle scene/comment visibility from either settings page; navigate to the other page, then exercise cancel/save/reset.
3. Save background alpha 0/100 and list size 100/200; verify actual player background and visible comment area, including legacy at the right edge.
4. Confirm prior seek-button, idle hide, and mouse-leave repairs remain satisfactory.

Public/private repository histories remain separate. No remote update has been published by this stage.
