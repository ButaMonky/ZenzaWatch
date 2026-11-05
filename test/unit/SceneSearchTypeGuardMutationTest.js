'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path'),vm=require('vm');
const project=path.resolve(__dirname,'../..');
const guardFile=path.join(__dirname,'SceneSearchTypeCoverageTest.js');
const bridgeFile=path.join(project,'tools/typescript-stage1/nico-src/SceneSearchIntegrationBridge.ts');
function runBridgeGuard(extraAliases=0){
 const tests=[];
 const fsView=Object.create(fs);
 fsView.readFileSync=(file,...args)=>{
  const data=fs.readFileSync(file,...args);
  if(path.resolve(String(file))!==bridgeFile||!extraAliases)return data;
  const additions=Array.from({length:extraAliases},(_,i)=>
   '\ntype InjectedBoundary'+i+'=BridgeLegacy;').join('');
  return typeof data==='string'?data+additions:Buffer.concat([data,Buffer.from(additions)]);
 };
 vm.runInNewContext(fs.readFileSync(guardFile,'utf8'),{
  __dirname,require:name=>name==='fs'?fsView:require(name),
  describe:(_name,body)=>body(),it:(name,body)=>tests.push({name,body})
 },{filename:'scene-type-coverage-under-mutation.js',timeout:1500});
 const guard=tests.find(t=>t.name.includes('binds the Bridge to typed'));
 assert(guard,'Bridge regression guard must remain registered');
 guard.body();
}
describe('SCUI type debt guard rejects unsafe boundary regressions',()=>{
 it('accepts the real current Bridge source without changing any file',()=>{
  const before=fs.readFileSync(bridgeFile);
  runBridgeGuard();
  assert.deepStrictEqual(fs.readFileSync(bridgeFile),before);
 });
 it('rejects even one new alias beyond the accepted Bridge boundary budget',()=>{
  assert.throws(()=>runBridgeGuard(1),/dynamic boundaries must not grow/);
 });
 it('rejects sixty injected legacy aliases through the actual coverage guard',()=>{
  // This mutation fails if word boundaries are escaped as literal backslashes.
  // The guard, not this test, must reject a growing dynamic API surface.
  assert.throws(()=>runBridgeGuard(60),/dynamic boundaries must not grow/);
 });
});
