// Test-environment stub for packages/components/src/dll.js.
//
// The real dll.js performs live network imports at module scope
// (`import * as lit from 'https://esm.run/lit';` etc.) so it can pull the
// `lit` library from a CDN when running as a Greasemonkey userscript in a
// real browser. Node's module loader refuses to resolve a bare network URL
// specifier outside that context and throws
// `TypeError: ERR_NETWORK_IMPORT_DISALLOWED is not a constructor`.
//
// This file is swapped in for the real dll.js only while running tests
// under Node (see test/setup.js), so that files which `import {dll} from
// '.../dll'` for other reasons (e.g. src/ZenzaWatchIndex.js) can still be
// loaded. It intentionally has the same shape as the real module's exported
// `dll` object, but with no `lit` populated — tests that actually exercise
// `dll.lit`/`dll.directives.*` are out of scope until dll.js's production
// wiring itself is revisited (see docs/design-pack/17_TASK_008_BUILD_DEPENDENCY_GRAPH.md
// and 18_TASK_010_FULL_BUILD_CLOSURE.md, which found dll.js is not reachable
// from the production @require bundle closure either).
const dll = {directives: {}};

module.exports = {dll};
