// Task966: userscript entry files (no //===BEGIN===) are generated from nico-src/*Entry.ts.
// The ==UserScript== header and imports stay JS in the runtime file; the body comes from TS
// and must keep its top-level lines and build directives (`//@require`, `//@version`, ...).
import test from 'node:test';
import assert from 'node:assert/strict';
import {NICO_API_BY_NAME} from '../scripts/nico-api-registry.mjs';
import {renderNicoLegacy,splitEntry,codeLines,entryDirectives} from '../scripts/sync-nico-api.mjs';
import {emitNico,read} from './nico-api-harness.mjs';

emitNico('tsconfig.nico-legacy.json');
const ENTRIES={UQueryEntry:'src/_uquery.js',CapTubeEntry:'src/_captube.js',MaskedWatchEntry:'src/_shape.js',
  HeatSyncEntry:'src/_heatsync.js',GamePadEntry:'src/_gamepad.js',HlsEntry:'src/_hls.js'};

test('splitEntry keeps the userscript header and the imports in the preamble',()=>{
  const {preamble,body}=splitEntry('// ==UserScript==\n// @version 1\n// ==/UserScript==\n\nimport {a} from "./a";\n// note\nimport {b} from "./b";\n\n(() => {\n//@require a\n})();\n');
  assert.deepEqual(preamble,['// ==UserScript==','// @version 1','// ==/UserScript==','','import {a} from "./a";','// note','import {b} from "./b";','']);
  assert.equal(body,'(() => {\n//@require a\n})();\n');
  assert.throws(()=>splitEntry('(() => {})();'),/ENTRY_IMPORTS_MISSING/);
});

test('codeLines skips template literal bodies and is not fooled by a backtick in a string',()=>{
  const text=["const a = 'x`y';","const s = `","import * as m from 'z';","${f({k: 1})}","`;","//@require Foo"].join('\n');
  assert.deepEqual(codeLines(text),[true,true,false,false,false,true]);
  assert.deepEqual(entryDirectives(text),['//@require Foo']);
});

for(const [name,runtime] of Object.entries(ENTRIES)){
  test(`${name}: the runtime is the JS preamble + the generated body, with every build directive`,()=>{
    const spec=NICO_API_BY_NAME[name];
    assert.equal(spec.shape,'entry');
    assert.equal(spec.runtime,runtime);
    const actual=read(runtime);
    const emitted=read(`tools/typescript-stage1/.generated/nico/${name}.js`);
    assert.equal(renderNicoLegacy(spec,emitted,actual).replace(/\r\n/g,'\n'),actual.replace(/\r\n/g,'\n'));
    const fixture=read(spec.fixture);
    // header + imports are unchanged except the bumped @version
    const strip=t=>splitEntry(t).preamble.filter(l=>!/^\/\/ @version/.test(l)).join('\n');
    assert.equal(strip(actual),strip(fixture));
    assert.deepEqual(entryDirectives(splitEntry(actual).body),entryDirectives(splitEntry(fixture).body));
    assert.ok(spec.directives.length>0);
  });
}

test('a dropped build directive or a changed top level is rejected',()=>{
  const spec=NICO_API_BY_NAME.CapTubeEntry;
  const actual=read(spec.runtime);
  const emitted=read('tools/typescript-stage1/.generated/nico/CapTubeEntry.js');
  const dropped=emitted.replace(/^\s*\/\/@require throttle\n/m,'');
  assert.notEqual(dropped,emitted);
  assert.throws(()=>renderNicoLegacy(spec,dropped,actual),/DIRECTIVES_CHANGED/);
  assert.throws(()=>renderNicoLegacy(spec,emitted.replace('\nexport {};','\nstart();\nexport {};'),actual),/UNEXPECTED_TOP_LEVEL/);
  assert.throws(()=>renderNicoLegacy(spec,emitted.replace('\nexport {};','\nexport const x = 1;\nexport {};'),actual),/UNEXPECTED_OUTPUT/);
  assert.throws(()=>renderNicoLegacy(spec,emitted.replace('\nexport {};',''),actual),/UNEXPECTED_EXPORT/);
});

test('the preamble is read from the runtime, so a hand-bumped @version is kept',()=>{
  const spec=NICO_API_BY_NAME.GamePadEntry;
  const actual=read(spec.runtime);
  const emitted=read('tools/typescript-stage1/.generated/nico/GamePadEntry.js');
  const bumped=actual.replace(/(\/\/ @version\s+)\S+/,'$19.9.9-test');
  assert.match(renderNicoLegacy(spec,emitted,bumped),/\/\/ @version\s+9\.9\.9-test/);
});
