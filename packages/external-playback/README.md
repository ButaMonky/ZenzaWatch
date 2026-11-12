# External playback package

Main ZenzaWatch owns playback. ZenzaBlogPartsButton detects links, displays Zen controls, optionally checks public metadata and requests playback. Install/update both scripts. No separate trial is required.

## Boundaries

- `src/settings.ts`, `targets.ts`, `site-rules.ts`: common settings and pure link/site rules.
- `inline-buttons.ts`, `overlay.ts`, `settings-panel.ts`, `preflight.ts`: launcher UI, explicit disposal and optional bounded metadata checks.
- `official-settings.ts`: allowlisted launch preferences shared with the main settings UI.
- `blog-clicks.ts`, `coexistence.ts`: trusted blog clicks and old-trial coexistence.
- `main-player-bridge.ts`: typed local launch protocol **inside the Nico-origin player frame**, with exact source/origin, video ID, sequence and lifecycle validation. No API method, account response or authentication capability is exposed to the external parent.
- `player-host.cjs`: companion-owned outer iframe and private GM trusted-click ticket. Main never accepts the external parent's window messages as launch proof.
- `launcher.cjs`, `gm-network.cjs`, `private-port.cjs`: main-owned player session, authenticated transport and private loader-frame RPC. The launcher also uses the network utility only for optional availability checks.
- `display-settings.cjs`: main-owned player preferences; sanitized migration from the old companion snapshot, subsequent local-change merging.
- `src/player-close.ts`, `player-background.ts`: bounded final save and small-mode transparent surface.
- `runtime-adapter.cjs`: checked build-time hooks around **one** canonical main runtime, selecting external capabilities only inside the isolated host. It does not contain a second player/UI implementation.
- `build-shells.cjs`: separate main/launcher entries. Main remains scoped to Nico and its existing supported hosts; it does not run directly on every external site. Main uses a DOM sandbox; ordinary Nico playback is injected into the page realm with only lexical lodash and no GM APIs. External playback runs in the main userscript realm.
- `build.cjs`: compiles TypeScript, validates settings/source anchors and emits both products atomically. Internal ExternalTrial storage/frame identifiers are retained for compatibility.

## Checks

`node build.js --dev`, `npm run test:external`, `node packages/external-playback/main-bridge-browser.cjs`, `npm run test:external:browser`, and `node tools/check_regeneration.js .`.

Ownership tests use distinct GM stores and script closures; browser fixtures use distinct Chrome isolated worlds and real same-frame postMessage. API transport is mocked: these checks do not claim live account/playback verification.

## Upgrade and rollback

Update main and companion together, reload Nico once to publish the current player preferences, then reload external pages. Existing companion preferences migrate on the first successful handoff; no old data is deleted. External launch options continue to synchronize in both directions.

A new companion with an old/missing main reports that the main needs updating/enabling. A new main with the previous companion leaves the previous companion's host alone until both are updated.

Rollback: reinstall main and companion from public commit `0e7ecf1cba07137a004807732301848705539c03`, then reload pages. Keep existing stored settings. Do not run the old trial and the new companion simultaneously.
