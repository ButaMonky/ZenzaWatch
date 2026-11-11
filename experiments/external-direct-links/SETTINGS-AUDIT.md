## Trial 11 follow-up

The contextual storage collision and history preference findings below are now repaired in public/private 2.7.388 and included in this trial. Advanced settings uses explicit stored-key access while playback retains contextual aliases; regression tests verify distinct writes and appropriate runtime notifications. Normal/advanced live synchronization is included. Duplicate screen-mode updates are skipped, with fullscreen/forced/reopen updates retained.

Remaining latency is not resolved. Added lifetime aggregate save count/time to distinguish synchronous preference persistence from event handling/presentation delays. Launcher observation is in the host document, while the player is in a separate iframe; host observation does not traverse player DOM. Input guard handlers contain no storage/network work. No new measured live-browser latency result is available.

---

# Settings integration and input-latency audit — 2026-11-12

## Scope and limits

Reviewed the shared Config/defaults, normal form bindings, advanced descriptors/drafts/save transactions/dependencies, playback consumers, generated trial and existing setting-related regression tests. Ran 393 existing settings/configuration tests successfully before this round's fixes. These include inventory coverage, saving/cancelling, import validation, feature schemas and lifecycle tests. Passing these does not demonstrate every setting's visible effect in a live authenticated browser.

No live browser or account-mutating tests were performed. The former font problems were reproduced with actual lit-html/JSDOM and actual source/generated comment style code. Settings such as legacy speech are explicitly marked unsupported by the model; a saved value alone is not evidence of implemented functionality.

## Fixed in trial 9 and 10

1. Normal form fields used HTML attributes to update already-edited input controls. Shared saved values could change while the controls retained stale values. Trial 9 corrected comment/font controls. Trial 10 extends property bindings to player toggles, selections and NG textareas. A real renderer test reproduces the stale-input behavior and checks subsequent external-value updates.
2. Comment `cssFontWeight` changes were not observed by OffscreenLayer. Trial 9 adds the missing listener; source and generated-layer tests verify updated CSS.
3. VariablesMapper compared `state.scale` against `menuScale` although the previous state stores `menuScale`. Trial 10 fixes the comparison. Changing opacity or toolbar mode no longer rewrites unchanged UI-size CSS variables. This removes confirmed extra work, not a proven explanation of all latency.

## Confirmed unresolved defects

### Context aliases collide in advanced settings

`PlayerConfig.wrapKey` mutates the shared Config's `getNativeKey`. On official watch pages `autoPlay` and `screenMode` alias to `:ginza`; the external-page mode also aliases `overrideWatchLink` to `:others`. Advanced settings exposes ordinary and contextual settings separately, but accesses both through the contextual mapper.

Run `node test/unit/AdvancedSettingsPlayerConfigAlias.audit.cjs`. It characterizes the existing defect, rather than adding a permanently failing test to the normal suite. Saving distinct ordinary/contextual drafts can report two saved settings while writing only one contextual storage key. Ordinary settings retain their previous raw value. The repair must separate raw settings-editor access from player-context access, preserving update events; removing the mapping blindly would break player behavior.

### History preference has no runtime effect

`enablePushState` exists in Config and advanced descriptors, but WatchPageHistory does not consult it. Its playback path calls history logic unconditionally and uses replaceState. A decision about the intended history/URL semantics is needed before changing this, given the separate link-compatibility investigation. No navigation behavior changed in this trial.

## Performance evidence

The user's 15-second trial-7 sample had one player, 141 imported settings, no runtime setting mismatches and no hidden-tab interval. It recorded 14 frame gaps over 50 ms, maximum gap about 100 ms, two long tasks totaling 169 ms, maximum click-handler time 42.6 ms, and up to 118.2 ms after a pointer handler before event presentation. The latter is rounded event timing, not a pure paint measurement. This proves occasional delay, not its root cause.

Read-only reproduction also found screen-mode style updates repeated by both `show()` and `_applyScreenMode()`. The latter's last-mode cache is reset to an empty string. Initial display, reopening and fullscreen forced refresh need preserving, so these paths were not changed speculatively. Their execution on ordinary unrelated clicks has not been established.

GM media transport, compositor work and geometry/observer scheduling remain unmeasured candidates. No claim of full latency resolution is made.
