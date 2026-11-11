# Settings dependency audit — 2026-11-12

## Implemented in trial 8

- `uaa.enable` → `supporterCredit.enable` → voice, gift, skipInPlaylist.
- Normal settings uses nested disabled fieldsets; advanced settings uses its existing recursive dependency model.
- Disabling either parent preserves child preferences, cancels queued/in-flight credit loading, stops active credit and releases the end-of-video wait. Re-enabling permits loading again.
- Playback eligibility and estimated credit duration use both parent switches.

## Other dependencies checked

The advanced settings model already declares dependencies for NG rules, scene-search subpanels, comment increase, touch multi-tap actions, comment-panel auto-scroll and PiP thumbnail source choice.

The normal NG panel still presents enabled and subordinate controls flatly. It is a candidate for the same tree presentation, but this change does not disable its entire section indiscriminately: that section also contains comment visibility controls that need their runtime conditions checked separately.

Do not make manual bookmarks depend on automatic resume recording, or manual comment retrieval depend on automatic increase. Screen-filter presets should remain selectable while filters are off because selecting a preset activates them.

## Verification

39 targeted source and generated-trial tests passed, including parent combinations, preserved checked values, active cancellation and suppression of credit requests. TypeScript emission passed. No live browser test performed.

The normal build generated and syntax-validated its outputs but Windows denied replacement by rename. The generated main userscript was copied to its intended target and used to build the trial; unrelated addon outputs were not published. Only the experiment branch is updated, not develop.

Operation latency remains unresolved; this change is not a performance fix.
