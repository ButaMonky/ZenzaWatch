// Task965: the module-statement guard of renderNicoLegacy must not mistake an object key
// (`import: importPlaylist`) or a method (`export() {`) for an import/export statement,
// and must still reject a real one.
import test from 'node:test';
import assert from 'node:assert/strict';
import {NICO_API_BY_NAME} from '../scripts/nico-api-registry.mjs';
import {renderNicoLegacy} from '../scripts/sync-nico-api.mjs';
import {emitNico,read} from './nico-api-harness.mjs';

emitNico('tsconfig.nico-legacy.json');

for(const name of ['initializer','CommentPlayer']){
  test(`${name}: the emitted module with a key/method named import/export is accepted`,()=>{
    const spec=NICO_API_BY_NAME[name];
    const emitted=read(`tools/typescript-stage1/.generated/nico/${name}.js`);
    assert.match(emitted,/^\s+(?:import:|export\(\))/m);
    assert.doesNotThrow(()=>renderNicoLegacy(spec,emitted));
  });
}

test('a real export statement inside the body is still rejected',()=>{
  const spec=NICO_API_BY_NAME.CommentPlayer;
  const emitted=read('tools/typescript-stage1/.generated/nico/CommentPlayer.js');
  const injected=emitted.replace(/\nexport \{/,'\nexport const leaked = 1;\nexport {');
  assert.throws(()=>renderNicoLegacy(spec,injected),/UNEXPECTED_OUTPUT/);
});
