# Native official links / task1019

## Behavior

A direct watch-page visit belongs to the official player. This also applies to old saved `overrideGinza=true` values and unavailable/deleted watch pages with a saved session. Explicit Zen actions, ordinary list click mode, playlists and external playback remain supported.

Official-player links use the existing `noHoverMenu` exclusion and native `_blank`/`noopener` behavior. No new URL marker, named tab, synthetic Ctrl click, session token or cross-tab handoff is introduced. `from` remains the official optional seek parameter. Old `zenza_official` and `watchGinza` inputs are accepted only for backwards compatibility.

## Follow-new navigation

The user-confirmed click1018.3 approach is promoted into `WatchClickNavigation.ts`. The normal original click is canceled with `preventDefault`, then reaches ordinary observers. Player startup occurs after dispatch. The CommonHeader public `commonHeader:linkClick` registration is guarded by original Event identity, because the captured official Layout handler navigates without checking `defaultPrevented`. See [captured route research](CLICK_ROUTING_RESEARCH_20261112.md).

The adapter hooks script load at document capture before official initialization. If CommonHeader was already mounted and its old registrations cannot be guarded, only a claimed click inside that header uses the conservative propagation stop. Other clicks and other scripts have no special-case integration. This is deliberately not a universal promise that every extension records views.

## Validation and limits

The localhost Chrome fixture reproduces the captured CommonHeader contract: early installation, script-lazy installation, already-mounted fallback, ordinary card, and unclaimed official navigation. Claimed clicks launch once with zero official routes; ordinary and guarded header clicks reach body observers; fallback stays header-local. No live logged-in Nico page was accessed in this release check. The user's prior successful click1018.3 verification remains the live evidence; retest after updating.

Generated distribution is checked against isolated regeneration. External playback uses the same player implementation. The obsolete external-trial migration toast is removed.

## Manual check / rollback

1. Open an official link from the related menu: no `zenza_official`, official playback only. If a position is requested, `from` is allowed.
2. Open a watch page by address/bookmark or Ctrl/middle click: no automatic Zenza replacement.
3. In click-to-Zenza mode, click follow-new thumbnail and title: Zenza only, no page/tab navigation or second audio.
4. Search card thumbnail/title/padding/date open Zenza; uploader/menu keep native actions.
5. Zen/MylistPocket buttons keep follow-new open while hovering. Check external playback too.

Stable previous main: `https://raw.githubusercontent.com/ButaMonky/ZenzaWatch/160aeaf/dist/ZenzaWatch-dev.user.js`. Previous companion uses the same commit and `dist/ZenzaBlogPartsButton.user.js`. Installing these older versions restores the previous behavior without deleting settings. The separate click1018.3 experiment is retained as a historical rollback artifact.

## Release verification

- `npm test -- --timeout 15000`: 5,182 passing, 76 existing pending, zero failures (NODE_ENV=test via npm script).
- Production adapter + external playback Node tests: 73 passing. Official-route TypeScript parity: 7 passing.
- Offline Chrome: 5 routing scenarios passed. Private-checkout targeted routing/update-destination tests: 59 passing.
- Nico, advanced-settings and Pocket TypeScript verification passed; new navigation module passed standalone strict type-checking.
- Isolated regeneration: all 10 active distributions matched in both checkouts; frozen distributions remained unchanged.
- Test maintenance includes the already-added advertising parent gate, eighth settings category, storage-event fixture, current installer versions and Windows line-ending normalization in the Pocket generator check. No production advertising or scene-search behavior was changed for these checks.
