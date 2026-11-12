# External playback ownership Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** BlogPartsButton detects links and requests playback; the installed main script owns the player, authenticated networking and player preferences.

**Architecture:** Retain the Nico-origin iframe as the CSS and authentication boundary. BlogPartsButton authenticates its external launch with its existing private GM ticket, then delegates inside that same frame through a typed, source-checked local protocol. Main owns one shared player implementation with an optional external environment adapter; normal Nico click routing remains unchanged.

**Tech Stack:** TypeScript, existing CommonJS bundle generator, Node tests, jsdom, Chrome offline fixtures.

**Spec:** User-approved ownership split in this conversation. Dictionary Zen absence was confirmed normal and is excluded.

## Global Constraints
- External page overlay and existing login transport remain available without per-site cookie allowances.
- No third-party-script exceptions; no external-site-specific rules.
- No privileged fetch interface or account responses sent to external parent pages.
- Preserve settings and final playback-position saving.
- Both public and private develop releases are authorized after checks pass.
- Do not claim live logged-in verification from offline fixtures.

## Review Focus
- Either userscript may initialize first: handshake works in both orders.
- Main missing/old: bounded timeout with actionable message.
- Parent-forged messages: source/origin checks reject them.
- Close during startup/save: no late reopened player, finish pending save before removal.
- Separate GM stores: migrated preferences remain shared and updates converge.

### Task 1: Typed same-frame launch protocol
Files: packages/external-playback/src/main-player-bridge.ts, generated output, main-player-bridge.test.cjs.
Interfaces: createMainPlayerClient(window, options) supplies session open/close/stage hooks; installMainPlayerProvider(window, session, options) owns playback.
- [x] Write tests for opposite startup order, forged parent, invalid IDs, bounded missing-main timeout, close notifications.
- [x] Run failing tests, implement protocol, compile TS and pass tests.

### Task 2: Main runtime ownership
Files: packages/external-playback/build.cjs and runtime adapter module; src/_template.js metadata; build.js.
- [x] Keep one shared runtime implementation with conditional external hooks.
- [x] Main owns GM authenticated transport, settings snapshot and loader frames.
- [x] Companion contains only detection, launcher settings/preflight and host delegation.
- [x] Test distributed bundles with distinct GM stores, normal bootstrap and final save lifecycle.

### Task 3: Release verification
Files: bundle/integration tests, documentation, dist outputs and release metadata.
- [x] Run external tests, Chrome fixtures, click-routing regressions, complete main test suite and regeneration check.
- [x] Review changes and mirror product files into private repo without policy files or local logs.
- [ ] Commit and push both develop branches; report hashes, size change and user confirmation steps.

## Execution ledger
- Baseline public 0e7ecf1c; private 62e12a46. Work branch release/external-host1020.
- No dictionary-link change required (user correction).
- Fresh independent review completed. One Important lifecycle finding: closing before main registration left startup retries alive. A regression failed with PLAYER_TIMEOUT, then passed after cancellation and close-state guarding (7/7 bridge tests).
- Final build and external package suite: 79/79 passed.
- Chrome isolated-world handoff, normal page-realm bootstrap, small-mode transparency and restoration: passed.
- Follow-new routing regression: 6/6 passed; normal modifier-key behavior retained.
- Build integrity, extracted comment-submit lifetime and distribution smoke checks: 44/44 passed.
- Source regeneration: all 10 active outputs match; 3 frozen outputs unchanged.
- Complete root suite: 5,182 passing, 76 pending, zero failures (exit 0).
- Private public-update/installer checks: 8/8 passed. Private regeneration: all 10 active outputs match, frozen outputs unchanged.
- Chrome watch-click navigation and propagation-boundary fixtures passed.
- Mirrored 40 reviewed files through Git index blobs; all pre-change product files matched between public/private. Private policy files and local logs excluded.
- Release targets: public/private develop; annotated v2.7.394 tags. Remote commit verification is performed after publishing and reported in the completion message.
- No live account mutation was performed.
