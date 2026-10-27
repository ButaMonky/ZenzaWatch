import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {runInNewContext} from 'node:vm';
import {MODULE_BY_ID} from '../scripts/module-registry.mjs';
import {renderLegacy} from '../scripts/generator-core.mjs';

const fixture=readFileSync(new URL('./fixtures/RequestAnimationFrame.before-task462.js',import.meta.url),'utf8');
const runtime=readFileSync(new URL('../../../packages/lib/src/infra/RequestAnimationFrame.js',import.meta.url),'utf8');
const emitted=readFileSync(new URL('../.generated/RequestAnimationFrame.js',import.meta.url),'utf8');
const sha=s=>createHash('sha256').update(s.replace(/\r\n/g,'\n')).digest('hex');
const spec=MODULE_BY_ID['raf-timing'];

function body(text,hasMarkers=true){
  if(!hasMarkers)return text.replace(/\nexport \{ RequestAnimationFrame \};\s*$/,'');
  const begin=text.indexOf('//===BEGIN===');
  const end=text.indexOf('//===END===');
  assert.ok(begin>=0&&end>begin);
  return text.slice(begin+'//===BEGIN==='.length,end);
}
function environment(source){
  const actions=[];
  const pending=new Map();
  let nextId=0;
  const globals={
    Promise,
    sleep:{resolve:Promise.resolve()},
    requestAnimationFrame(fn){
      const id=++nextId;
      actions.push('request:'+id);
      pending.set(id,fn);
      return id;
    },
    cancelAnimationFrame(id){
      actions.push('cancel:'+id);
      pending.delete(id);
    }
  };
  runInNewContext(source+'\nglobalThis.RAF = RequestAnimationFrame;',globals,{
    timeout:1000
  });
  return {
    Klass:globals.RAF,
    actions,pending,
    step(){
      const first=pending.entries().next().value;
      assert.ok(first,'scheduled frame expected');
      pending.delete(first[0]);
      first[1]();
    },
    settle:async()=>{await Promise.resolve();await Promise.resolve();}
  };
}
async function scenario(source,variant){
  const x=environment(source);
  let instance;
  let hits=0;
  const callback=()=>{
    x.actions.push('callback:'+ ++hits);
    if(variant==='restart'&&hits===1){instance.disable();instance.enable();}
    if(variant==='restart'&&hits===2){instance.disable();}
    if(variant==='throw')throw Error('callback-failed');
  };
  instance=new x.Klass(callback,variant==='skip'?2:undefined);
  if(variant==='disabled'){
    await instance.callRaf();
    instance.disable();
    x.actions.push('queued:'+x.pending.size);
  } else if(variant==='once'){
    instance.execOnce();
    x.step();
    await x.settle();
    x.actions.push('queued:'+x.pending.size);
  } else if(variant==='stale'){
    instance.enable();
    const stale=[...x.pending.values()][0];
    instance.disable();
    instance.enable();
    stale();
    x.step();
    await x.settle();
    instance.disable();
  } else if(variant==='throw'){
    instance.enable();
    assert.throws(()=>x.step(),/callback-failed/);
    await x.settle();
    instance.disable();
  } else {
    instance.enable();
    instance.enable();
    const rounds=variant==='skip'?5:variant==='restart'?2:2;
    for(let i=0;i<rounds;i++){
      x.step();
      await x.settle();
    }
    instance.disable();
  }
  return x.actions;
}
test('Task462 baseline and exact generated runtime',()=>{
  assert.equal(sha(fixture),spec.originalSha256);
  assert.equal(runtime.replace(/\r\n/g,'\n'),renderLegacy(spec,emitted));
  assert.equal((runtime.match(/\/\/===BEGIN===/g)||[]).length,1);
  assert.equal((runtime.match(/\/\/===END===/g)||[]).length,1);
});

test('reject extra exports and injected build markers',()=>{
  assert.throws(()=>renderLegacy(spec,emitted.replace(
    'export { RequestAnimationFrame };','export { Other };')),/RAF_TS_EXPORT_INVALID/);
  assert.throws(()=>renderLegacy(spec,emitted.replace(
    'class RequestAnimationFrame {','class RequestAnimationFrame {\n//===END===')),/RAF_TS_MARKER_INVALID/);
});

for(const variant of ['default','skip','once','stale','restart','throw','disabled']){
  test('Task462 parity: '+variant,async()=>{
    const original=await scenario(body(fixture),variant);
    assert.deepEqual(await scenario(body(emitted,false),variant),original);
    assert.deepEqual(await scenario(body(runtime),variant),original);
  });
}
