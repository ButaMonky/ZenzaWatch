# External playback package

This package is distributed through ZenzaBlogPartsButton. It does not depend on an installed trial script. Future main integration can reuse the same module entry points.

## Boundaries

- `src/settings.ts`: canonical preference defaults and descriptors. `sync-preferences.cjs` generates main Config/model sections; normal build rejects drift. Regenerate TypeScript after changing preferences.
- `src/targets.ts`, `site-rules.ts`: pure URL/ID and target-site rules, no network.
- `src/inline-buttons.ts`, `overlay.ts`, `settings-panel.ts`: owned UI, explicit disposal.
- `src/preflight.ts`: optional bounded metadata requests.
- `src/official-settings.ts`: whitelisted public-preference bridge on Nico pages.
- `src/blog-clicks.ts`: nonce correlation across blog iframe, with a short-lived trusted-click proof only in userscript GM storage. No account data in DOM messages.
- `src/coexistence.ts`: detect old trial controls and suspend new launcher.
- `src/player-close.ts`, `player-background.ts`: player lifecycle and small-mode surface.
- Existing tested CommonJS adapters `gm-network`, `private-port`, `player-host`, `launcher`, `display-settings`, `panel-observer` retain their interfaces; these are not duplicated implementations of main playback/UI.
- `build.cjs`: guarded compilation adapter deriving isolated player from this build's main output. Changed anchors fail the build instead of silently shipping an old player. Internal `ExternalTrial` storage/frame identifiers are retained for compatibility; they do not require the trial script.
- `src/_blog.js` at repository root remains the legacy embed entry; final userscript header preserves its name/namespace and updates from the existing public URL.

## Build and checks

`node build.js --dev` builds main and companion atomically. `npm run test:external` tests package + actual distribution. `npm run test:external:browser` verifies small/normal backgrounds in an offline Chrome fixture. `node packages/external-playback/sync-preferences.cjs --write` updates main preference declarations after package settings compilation; follow with advanced:emit and sync-advanced.

## Migration and rollback

With trial22 enabled, visit Nico once to mirror public external preferences. Disable the old trial, update main + companion, then reload Nico once to import preferences and publish normal player settings. Reload external pages. Existing old storage is not deleted. To roll back, disable companion and re-enable the retained trial; avoid both active at once. A companion-only installation uses defaults until a Nico page supplies main settings.

Source provenance: external trial22 (`9c68bec`) promoted to current main source. No captured account pages or private HAR data are included. Live Nico validation is left to the user; tests use offline fixtures and mocks, never post real comments/likes.
