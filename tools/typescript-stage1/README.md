# Task446 → Task451: incremental TypeScript adoption

Task446 validated the isolated TypeScript port; Task448 migrated `OfficialPlayerRoute` to canonical TypeScript. Task450 adds the independent `StyleSwitcher` module, retaining legacy JavaScript output. These branches are based on the **private development repo**, not the public release repository.

## Reproducible commands

From `tools/typescript-stage1`:

```powershell
npm ci --ignore-scripts --no-audit --no-fund
npm run generate:legacy
npm test
```

The compiler is pinned at TypeScript 7.0.2, independently from global `tsc`.
`src/OfficialPlayerRoute.ts` is now the **canonical implementation**;
`generate:legacy` transpiles into ignored `.generated/` and uses the guarded
shared generator (`scripts/sync-all.mjs`, `generator-core.mjs`) to create
`packages/zenza/src/menu/OfficialPlayerRoute.js` with its original
`//===BEGIN===`/`//===END===` markers intact. The generator rejects a manually
edited runtime file and unexpected TypeScript output. `npm test` first checks
strict types and refuses a stale generated runtime, then verifies 104 legacy
input combinations and the original baseline snapshot.

**Run `npm run generate:legacy` after editing the `.ts` source.** Never edit
the generated `.js` directly. Changes to `.ts` without a corresponding `.js`
update will fail `npm test`. The tracked `runtime-manifest.json` records both
source and runtime SHA-256 hashes, and the root ZenzaWatch Mocha suite also
verifies their agreement (without requiring TypeScript in the root project).
The generated runtime can be updated repeatedly while uncommitted only when its
last recorded digest is unchanged; manual JS edits or unrelated Git changes
are rejected. This path does not depend on global TypeScript.

## Non-goals / safety

- No mass lint/format changes or edits to the legacy `build.js`.
- The generated runtime JS has the same observed behavior as the original.
  Before merging, run focused/full tests and compare the sandbox userscript build.
- The legacy module retains its `//===BEGIN===`/`//===END===` markers, as
  required by ZenzaWatch's custom build and existing source tests.
- This PoC does **not** prove that NicoNico's live API still accepts the route.
- Task424 / VideoControlBar / SCUI sources are not touched.

Status: Task448/450 implementation integrated in private develop; Task451 consolidates
the generator without changing either runtime JS or distribution files. A passed test does **not**
mean Task424/SCUI is reviewed, the public repository is updated, or NicoNico's
live API is verified. Development integration, public backport, and release are
separate gates.

## Task450: CSS StyleSwitcher is TypeScript-canonical

- `src/StyleSwitcher.ts` is the only implementation source for the DOM style toggle methods.
- `scripts/sync-style-switcher.mjs` emits `packages/lib/src/css/StyleSwitcher.js`
  with the legacy `//===BEGIN===` section and unchanged public API.
- `style-switcher-manifest.json` records the canonical TS and runtime JS SHA-256
  hashes. The root `TypeScriptStyleSwitcherSourceSyncTest` rejects stale changes.
- `tsconfig.style-contract.json` adds strict argument checks without emitting code.
- The TypeScript package runs parity tests against the pre-migration JS snapshot,
  using a synthetic DOM with 11 scenarios: update/add/remove/toggle combinations.
- `npm run generate:legacy` now generates **both** migrated modules;
  `npm test` verifies both. No network access or live NicoNico browser is required.
- Task450's development build changes only `dist/ZenzaWatch-dev.user.js`;
  the public release remains separate from this worktree.

## Task451: common generator and collision-safe batch synchronization

- `scripts/module-registry.mjs`: an explicit allowlist of the two canonical
  TypeScript modules and their existing runtime paths, generated headers and
  SHA-256 manifests. No user-supplied path or arbitrary module can be added at CLI runtime.
- `scripts/generator-core.mjs`: common rendering, compiled output checks,
  source/runtime hash validation, Git HEAD ownership checks, preflight planning,
  collision protection, and best-effort rollback on partial filesystem failure.
- `scripts/sync-all.mjs --check|--write`: validates **both** modules before
  changing either one, creates exclusive temporary outputs and detects
  changes made by another writer before promoting them.
- `sync-production.mjs` and `sync-style-switcher.mjs`: small compatibility
  wrappers, retaining the old commands and exported render functions used
  by Task448/450 tests.
- `npm run generate:legacy` runs the pinned TypeScript compiler and a
  single shared `--write` transaction. `npm test` runs strict type checks,
  shared `--check`, and offline parity/negative-case regressions.

Adding another TypeScript feature requires a new owned task, explicit registry
entry with known `HEAD` baseline and approved input/output paths, a compiler
output-shape check, a committed manifest and isolated tests. Do not use this
tool to overwrite SCUI/Task424 files or to force any Git integration.

## Task457: NicoNico API clients are TypeScript-canonical (separate registry)

- `nico-src/*.ts` are the only implementation sources for migrated API clients
  (`NVApi`, `LikeApi`). `nico-src/NicoApiTypes.ts` holds type-only contracts.
- `scripts/nico-api-registry.mjs` is a fixed allowlist, independent from the
  Task451 registry, so existing generator tests and the advanced-settings lane
  are untouched. `scripts/sync-nico-api.mjs --check|--write` reuses Task451's
  `applyPlans` rollback/concurrent-edit protection.
- The renderer accepts only one top-level `const <Name> = {...};` declaration,
  keeps the legacy `import` lines (needed by `build.js` to resolve `//@require`)
  and re-inserts `//@require` directives after `//===BEGIN===`.
- Server bodies stay `unknown`; `tsconfig.nico.contract.json` +
  `test/nico-api-contract.ts` lock that in with `@ts-expect-error` checks.
- `test/nico-api-task457.test.mjs` emits with the pinned compiler itself and
  runs pre-migration fixtures and generated runtimes against identical fakes.
- Commands: `npm run nico:sync` after editing, `npm run nico:verify` to check.
  Root Mocha `NicoApiTypeScriptSourceSyncTest` rejects stale manifests.
- Task461 adds `RecommendAPILoader`, `NVWatchCaller` (`shape:'iife'`) and
  `MatrixRankingLoader`. Registry entries may declare `shape: 'object' | 'iife'`;
  the renderer still allows exactly one top-level declaration.
  Contract files matching `test/nico-api-contract-*.ts` are type-checked too.
- Task463 adds `TagSuggestLoader` (validated `string[]`) and `PlaylistApiLoader`
  (closed `PlaylistType` union, items `unknown`). Parity tests compare whole call
  sequences, so per-instance caches and eviction are covered.
- Task471 adds `MylistApiLoader` (read/write mylist and watch-later). Its legacy
  file keeps `const emitter = new Emitter();` outside `//===BEGIN===`; the registry
  `preamble` reproduces that line verbatim. Parity scenarios clone response bodies
  per run because the loader merges pages into the first response in place.
- Task475 adds `TagEditApi` and the `shape: 'class'` registry form (a single
  top-level `class X { ... }`). Edit-key refresh retries once, as before.
- Task477 adds `NicoVideoApi` (www cross-domain gate). `CrossDomainGate` itself
  stays legacy JS and is described with a `declare class` for the parts used.
- Task479 adds `CommonsTreeLoader` (paging, full scan, retries, abort, timeouts).
  Its parity suite replaces timers with an immediate fake and pins `Date.now`.
- Task481 adds `GateAPI` (receiving side of the cross-domain gates). In-body
  `//@require` directives are written as TS comments at the same positions and
  the directive-order test verifies they survive emission.
- Task640 adds `netUtil` (shared transport). It is the only registered runtime
  outside `packages/lib/src/nico/` (`packages/lib/src/infra/netUtil.js`).
- Task642 adds `StoryboardCacheDb` (IndexedDB / bridge cache of storyboard info).
  The local `NicoVideoApi` bridge injected via `api()` shadows the import kept in
  the preamble, exactly as in the legacy file.
- Task643 adds `VideoSearch` (nvapi search, snapshot fallback, owner search,
  sort parser) and the `shape: 'declarations'` registry form: the exact ordered
  top-level open/close lines (`topLevel`) and exported names (`exportNames`) are
  allowlisted per module (VideoSearch only). Class fields that the legacy code
  assigns in methods are `declare`d so no field initializers are emitted.
- Task645 adds `parseThumbInfo` with the same `declarations` form (one top-level
  `function` declaration). MylistPocket injects `parseThumbInfo.toString()` into
  a page script, so the function must not reference module-level helpers; the
  parity suite evaluates the stringified function on its own.
- Task646 takes over the stalled lanes and adds `ThumbInfoCacheDb`,
  `WatchInfoCacheDb`, `NicoQuery` (`declarations`: an object plus a class) and
  `StoryboardInfoLoader`.
- Task648 adds `ThreadLoader` (`declarations`: `const { ThreadLoader } = (() => {...})();`).
  Its `//@require` directives are registry `beginLines`, so they stay the first
  lines of the build section (root tests strip `//@require logSafe` by regex).
  Legacy thrown values/JSON are read through one documented `Failure` alias.
- Task649 adds `VideoInfoLoader` (`declarations`: `const VideoInfoLoader = (function () {`).
  The watch v4 structure check stays the typed boundary; the legacy conversion
  reads the raw JSON through one documented `Loose` alias.
