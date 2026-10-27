// Task451: allowlisted TypeScript modules. No command line paths or remote config.
const official=Object.freeze({
  id:'official-route',
  source:'tools/typescript-stage1/src/OfficialPlayerRoute.ts',
  emitted:'tools/typescript-stage1/.generated/OfficialPlayerRoute.js',
  runtime:'packages/zenza/src/menu/OfficialPlayerRoute.js',
  manifest:'tools/typescript-stage1/runtime-manifest.json',
  symbol:'OfficialPlayerRoute',
  kind:'const',
  originalSha256:'321ddbff3a4ccbe50c03be0336a4a02fce434c578e9ba988ded33395bf6f9f32',
  header:'// GENERATED FROM tools/typescript-stage1/src/OfficialPlayerRoute.ts (Task448).',
  preamble:Object.freeze([
    '// Task350: An explicit route marker for viewing a video in the official player.',
    '// The legacy watchGinza window.name bypass is retained for old links.'
  ]),
  prefix:'TYPESCRIPT_RUNTIME_SYNC',
  errors:Object.freeze({
    input:'TRANSPILE_INPUT_INVALID',
    exported:'UNEXPECTED_TS_EXPORT',
    body:'UNEXPECTED_TS_OUTPUT',
    marker:'UNEXPECTED_BUILD_MARKER',
    dirty:'RUNTIME_FILE_DIRTY_REFUSED',
    stale:'GENERATED_JS_STALE',
    manifest:'MANIFEST_STALE'
  })
});
const style=Object.freeze({
  id:'style-switcher',
  source:'tools/typescript-stage1/src/StyleSwitcher.ts',
  emitted:'tools/typescript-stage1/.generated/StyleSwitcher.js',
  runtime:'packages/lib/src/css/StyleSwitcher.js',
  manifest:'tools/typescript-stage1/style-switcher-manifest.json',
  symbol:'StyleSwitcher',
  kind:'class',
  originalSha256:'bd6dacf910e00e745642d46634b0e872a644f45a7cc7287442bd087e821e9c17',
  header:'// GENERATED FROM tools/typescript-stage1/src/StyleSwitcher.ts (Task450).',
  preamble:Object.freeze([]),
  prefix:'TYPESCRIPT_STYLE_SYNC',
  errors:Object.freeze({
    input:'STYLE_TRANSPILE_INPUT_INVALID',
    exported:'STYLE_TS_EXPORT_INVALID',
    body:'STYLE_TS_OUTPUT_INVALID',
    marker:'STYLE_TS_OUTPUT_INVALID',
    dirty:'STYLE_RUNTIME_HAS_FOREIGN_EDITS',
    stale:'STYLE_RUNTIME_STALE',
    manifest:'STYLE_MANIFEST_STALE'
  })
});
const raf=Object.freeze({
  id:'raf-timing',
  source:'tools/typescript-stage1/src/RequestAnimationFrame.ts',
  emitted:'tools/typescript-stage1/.generated/RequestAnimationFrame.js',
  runtime:'packages/lib/src/infra/RequestAnimationFrame.js',
  manifest:'tools/typescript-stage1/raf-timing-manifest.json',
  symbol:'RequestAnimationFrame',
  kind:'class',
  originalSha256:'7065507ce779d7139b3f484f1dec5b70ecde28a091bf05a5c5778aea5194458a',
  header:'// GENERATED FROM tools/typescript-stage1/src/RequestAnimationFrame.ts (Task462).',
  preamble:Object.freeze(["import {sleep} from './sleep';",'']),
  prefix:'TYPESCRIPT_RAF_SYNC',
  errors:Object.freeze({
    input:'RAF_TRANSPILE_INPUT_INVALID',
    exported:'RAF_TS_EXPORT_INVALID',
    body:'RAF_TS_OUTPUT_INVALID',
    marker:'RAF_TS_MARKER_INVALID',
    dirty:'RAF_RUNTIME_HAS_FOREIGN_EDITS',
    stale:'RAF_RUNTIME_STALE',
    manifest:'RAF_MANIFEST_STALE'
  })
});
export const MODULES=Object.freeze([official,style,raf]);
export const MODULE_BY_ID=Object.freeze(Object.fromEntries(MODULES.map(item=>[item.id,item])));
