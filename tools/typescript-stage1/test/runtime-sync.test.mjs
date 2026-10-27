import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {createContext,runInContext} from 'node:vm';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {renderLegacy,mayReplace} from '../scripts/sync-production.mjs';
import {OfficialPlayerRoute as compiled} from '../.generated/OfficialPlayerRoute.js';
import {OfficialPlayerRoute as shipped} from
  '../../../packages/zenza/src/menu/OfficialPlayerRoute.js';

const root=resolve(fileURLToPath(new URL('../../../',import.meta.url)));
const runtimeRel='packages/zenza/src/menu/OfficialPlayerRoute.js';
const emitted=readFileSync(new URL('../.generated/OfficialPlayerRoute.js',import.meta.url),'utf8');
const runtime=readFileSync(resolve(root,runtimeRel),'utf8');
const lf=text=>text.replace(/\r\n/g,'\n');
// The original snapshot is immutable across task merges and public backports.
const snapshot=readFileSync(new URL('./fixtures/OfficialPlayerRoute.before-task448.js',import.meta.url),'utf8');
const snapshotDigest=createHash('sha256').update(lf(snapshot)).digest('hex');
assert.equal(snapshotDigest,'321ddbff3a4ccbe50c03be0336a4a02fce434c578e9ba988ded33395bf6f9f32');
function legacyObject(source){
  const marker='//===BEGIN===',end='//===END===';
  const start=source.indexOf(marker),stop=source.indexOf(end,start+marker.length);
  assert.ok(start>=0&&stop>start,'legacy marker is required');
  const section=source.slice(start+marker.length,stop);
  const context=createContext({URL,Number,Math,Object,String,encodeURIComponent});
  runInContext(section+'\nglobalThis.route = OfficialPlayerRoute;',context,
    {timeout:1000});
  return context.route;
}
test('TypeScript-generated JS is the exact tracked legacy build input',()=>{
  assert.equal(lf(runtime),renderLegacy(emitted));
  assert.equal(runtime.match(/\/\/===BEGIN===/g)?.length,1);
  assert.equal(runtime.match(/\/\/===END===/g)?.length,1);
  assert.equal(legacyObject(runtime).PARAM,'zenza_official');
});
test('generator rejects suspicious output shapes instead of guessing',()=>{
  assert.throws(()=>renderLegacy('import x from "y";\nexport { OfficialPlayerRoute };'),
    /UNEXPECTED_TS_OUTPUT/);
  assert.throws(()=>renderLegacy('const OfficialPlayerRoute = {};\nexport {Other};'),
    /UNEXPECTED_TS_EXPORT/);
  assert.throws(()=>renderLegacy(''),/UNEXPECTED_TS_EXPORT/);
});
test('compiled TS, actual runtime, and pre-migration original remain equivalent',()=>{
  const original=legacyObject(snapshot);
  const emittedRuntime=legacyObject(runtime);
  const ids=['sm9','so1','nm42','a/b c','',0,null,undefined];
  const times=[undefined,-3,0,0.01,0.999,1,1.9,3599,
    Infinity,NaN,'12','not a number',9007199254740992];
  let checked=0;
  for(const id of ids)for(const time of times){
    const want=original.makeUrl(id,time);
    for(const route of [compiled,shipped,emittedRuntime]){
      assert.equal(route.makeUrl(id,time),want,'watch route parity');
    }
    checked++;
  }
  assert.equal(checked,104);
  const cases=[null,undefined,{}, {zenza_official:'1'},
    {zenza_official:'0'},{zenza_official:1},{other:'1'}];
  for(const query of cases){
    const want=original.isOfficialRequest(query);
    for(const route of [compiled,shipped,emittedRuntime]){
      assert.equal(route.isOfficialRequest(query),want,'bypass marker parity');
    }
  }
});

test('only the committed or previously generated runtime may be replaced',()=>{
  const baseline='const original = 1;\n';
  const alreadyGenerated='const generated = 2;\n';
  const nextGenerated='const generated = 3;\n';
  const prior=createHash('sha256').update(alreadyGenerated).digest('hex');
  assert.equal(mayReplace(baseline,baseline,nextGenerated,''),true);
  assert.equal(mayReplace(nextGenerated,baseline,nextGenerated,''),true);
  assert.equal(mayReplace(alreadyGenerated,baseline,nextGenerated,prior),true);
  assert.equal(mayReplace(alreadyGenerated.replace(/\n/g,'\r\n'),baseline,
    nextGenerated,prior),true);
  assert.equal(mayReplace('manual edit',baseline,nextGenerated,prior),false);
  assert.equal(mayReplace(alreadyGenerated,baseline,nextGenerated,'wrong'),false);
});
