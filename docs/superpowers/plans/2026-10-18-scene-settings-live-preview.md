# Scene settings live preview Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans inline. User approved implementation of the interactive first proposal.

**Goal:** Ship the approved preview-and-settings layout with three equal presentation choices, shared visibility and list viewport sizing.
**Architecture:** Reuse ModernAdvancedSettingsModel drafts/cards and existing persistence. Add a local illustrative preview to the scene settings page. Extend canonical scene preferences/placement, preserving native comment typography and virtualization.
**Tech Stack:** Existing JavaScript UI, TypeScript scene sources, Mocha/jsdom and isolated Chrome.
**Spec:** Approved conversation and advanced-settings-designs.html: follow/fixed/legacy, parent scene visibility, child comment switches, background-only opacity, list viewport scaling, normal/fullscreen/small examples. Visibility icons deferred explicitly.

## Global Constraints
- Preserve existing defaults (idle 2 seconds, seek 5 seconds, fullscreen link false); mock sample values are not a migration.
- New sceneSearch.enabled defaults true. New sceneSearch.commentListScale is an integer 100–200, default 100.
- Never alter font sizes to enlarge the comment list; preserve saved child choices when parents are off.
- Preserve existing draft/save/cancel/default highlighting and visibility aliases. No live player changes until save.
- TS originals are authoritative; nico:sync regenerates JS. Build dist via sandbox only.
- Produce a new confirmation build; no develop integration or push before user UAT.

## Review Focus
- Off/on preserves child settings and blocks both legacy and modern preview display.
- Enlarged lists fit small viewports without covering seek controls or scaling fonts.
- Keyboard focus remains intact while ranges update the preview.
- Fullscreen linking preserves its independent saved mode.
- Search/export/import/standalone settings include the new keys.

### Task 1: Preferences and real player behavior
Files: src/Config.js, src/ModernAdvancedSettingsModel.js, src/UiVisibilityRegistry.js; nico-src/SceneSearchPreferences.ts, SceneSearchPlacement.ts, SceneSearchLayout00.ts; sceneSearch/SceneSearchController.js and SceneSearchIntegrationBridge.js.
- [x] Add regression tests: enabled off suppresses shown, children persist; invalid scales rejected; larger placement viewport without font scaling.
- [x] Observe RED; implement sceneSearch.enabled and commentListScale (100–200) and shared aliases/dependencies; regenerate TS outputs.
- [x] Run scene/model/config/placement regressions and commit.

### Task 2: Approved settings interface
Files: src/ModernAdvancedSettingsUI.js; test/unit/SceneSearchAdvancedLayoutPickerTest.js and SceneSearchSettingsDesignTest.js.
- [x] Replace old picker assertions with three peer choices; add preview opacity, size, visibility and mode-change assertions; observe RED.
- [x] Group existing cards beside the interactive preview; retain native toggles and modified glow; hide obsolete extra-controls settings under optional details if still applicable. Implement ordinary preview interactions without modifying player configuration.
- [x] Verify shared visibility edits, cancellation, parent dependencies, preview resizing, linked modes and legacy image/list switching. Commit.

### Task 3: Verification and confirmation package
- [x] Inspect actual settings UI in isolated Chrome with native CSS; full suite and nico:verify.
- [x] Fresh review of final diff; fix important findings with regression tests.
- [x] Bump available versions above 2.7.311 / 0.3.63, sandbox build both outputs, package, verify executable parity and user-facing layout.
- [x] Record evidence and deliver confirmation build. Leave integration/push pending UAT.

## Progress
- Base c2934a9. Existing clean isolated publication/task801-scui-preview-settings reused. Approved inline execution; no additional approval cycle for this recorded plan.

- Final verification: 3291 passing, 78 pending, 0 failing (npm test -- --timeout 10000). Focused review regression suite 122 passing. nico:verify passes. Distribution browser checks: 315 post-fix regression + 28 new settings checks.
- Final review: independent reviewer; two important findings reproduced RED (3 failing cases), fixed GREEN. No deferred minor findings. Parent visibility masks effective pin state without deleting stored preferences; legacy list placement uses scaled, viewport-bounded width.
- Confirmation artifacts: ZenzaWatch 2.7.312-task801; settings 0.3.64-task801. No integration or push. Logs retained under tools/typescript-stage1/.generated/scene-settings/.
