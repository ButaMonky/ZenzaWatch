// Task787: intentional fixes of bugs recorded during the lib TypeScript migration.
// Each test runs the pre-fix runtime (the last migration fixture) next to the current
// runtime and asserts the difference that was fixed.
import test from 'node:test';
import assert from 'node:assert/strict';
import {NICO_API_BY_NAME} from '../scripts/nico-api-registry.mjs';
import {emitNico,read,loadLegacy,legacySection} from './nico-api-harness.mjs';

emitNico();
// The pre-fix runtime is exactly what Task726/783/785 generated: their parity tests
// proved it equal to these fixtures, which are therefore the "before" side here.
const pair=name=>{const s=NICO_API_BY_NAME[name];return [read(s.fixture),read(s.runtime)];};
const flush=async(n=10)=>{for(let i=0;i<n;i++)await Promise.resolve();};
const strict=code=>'//===BEGIN===\n"use strict";\n'+legacySection(code)+'\n//===END===';

test('SLEEP-IDLE-001: await sleep.idle() now waits for an idle callback (capped at 100 ms)', async()=>{
  const [before,after]=pair('sleep');
  const world=()=>{const calls=[];const win={requestIdleCallback:(cb,opt)=>{calls.push(opt);setTimeout(cb,0);}};
    return {calls,globals:{window:win,requestIdleCallback:win.requestIdleCallback,setTimeout,Promise,Object}};};
  const a=world(),b=world();
  const old=loadLegacy(before,'sleep',a.globals),now=loadLegacy(after,'sleep',b.globals);
  const oldResult=await old.idle();
  assert.equal(typeof oldResult,'function','legacy idle() returned the waiting function without waiting');
  assert.deepEqual(a.calls,[]);
  await now.idle();
  assert.deepEqual(JSON.parse(JSON.stringify(b.calls)),[{timeout:100}]);
  // Without requestIdleCallback it falls back to a 0 ms timer and still resolves.
  const plain=loadLegacy(after,'sleep',{window:{},setTimeout,Promise,Object});
  assert.equal(await plain.idle(),undefined);
});

test('DOM-EVENT-DATASET-001: [data-command] clicks dispatch instead of throwing', ()=>{
  const [before,after]=pair('domEvent');
  const run=code=>{
    const log=[];
    class CustomEvent{constructor(type,init){this.type=type;Object.assign(this,init);}}
    const d=loadLegacy(code,'domEvent',{CustomEvent,Object,JSON,global:{emitter:{emitAsync(){}}}});
    const element={addEventListener:(t,f)=>{element.f=f;},dispatchEvent:e=>{log.push([e.type,e.detail.command,e.detail.param]);return true;}};
    d.bindCommandDispatcher(element,'click');
    const click=dataset=>element.f({target:{closest:()=>({dataset})},preventDefault(){log.push(['prevent']);}});
    return {log,click};
  };
  const a=run(before);
  assert.throws(()=>a.click({command:'play'}),{name:'TypeError'});
  const b=run(after);
  b.click({command:'seek',param:'12',type:'number'});
  b.click({command:'toggle',param:'true',type:'boolean'});
  b.click({command:'setTitle',param:'abc'});
  assert.deepEqual(b.log,[['prevent'],['command','seek',12],['prevent'],['command','toggle',true],
    ['prevent'],['command','setTitle','abc']]);
});

test('TEXT-REG-PRIMITIVE-001: exec() and the two-argument form work in strict mode', ()=>{
  const [before,after]=pair('reg');
  const g={Symbol,WeakMap,Object,Array};
  const old=loadLegacy(strict(before),'reg',g),now=loadLegacy(strict(after),'reg',g);
  assert.throws(()=>old(/a(b)/).exec('xab'),{name:'TypeError'});
  const m=now(/a(b)/).exec('xab');
  assert.equal(m[1],'b');
  assert.equal(m.$1,'b');
  assert.equal(now()[0],'ab','reg() returns the last result');
  assert.equal(now(/c(d)/,'xcd')[1],'d');
});

test('WU-JS-TOSTRING-001: workerUtil.js interpolates values, not the toString method', ()=>{
  const [before,after]=pair('workerUtil');
  const g={window:{Blob:true,Worker:true,URL:true},Object,String,JSON,Map,Promise,Error,Date};
  const oldText=loadLegacy(before,'workerUtil',g).js`a${42}b${'s'}`;
  const newText=loadLegacy(after,'workerUtil',g).js`a${42}b${'s'}`;
  assert.match(oldText,/native code/,'legacy embedded Number.prototype.toString itself');
  assert.equal(newText,'a42bs');
});

test('IDB-POST-TRANSFER-001: put(record, transfer) passes the transfer list as an option', async()=>{
  const [before,after]=pair('IndexedDbStorage');
  const run=async code=>{
    const posts=[];
    const workerUtil={createCrossMessageWorker:()=>({post:async(m,o)=>{posts.push([m.command,o]);return 'ok';}})};
    const S=loadLegacy(code,'IndexedDbStorage',{workerUtil,Map,Object,Promise,JSON,Number,Array,TypeError,Error,Date,setTimeout,clearTimeout});
    const db=await S.open({name:'cache',ver:1,stores:[{name:'items'}]});
    const buffer={bytes:1};
    await db.items.put({id:'a'},[buffer]);
    await db.items.get({key:'a'});
    return posts;
  };
  const a=await run(before),b=await run(after);
  // posts[0] is init; [1] put with a transfer list; [2] get without one.
  assert.ok(Array.isArray(a[1][1]),'legacy passed the array where options belong');
  assert.equal(a[2][1],undefined);
  assert.deepEqual(JSON.parse(JSON.stringify(b[1][1])),{transfer:[{bytes:1}]});
  assert.equal(b[2][1].transfer,undefined,'no transfer list means no transfer, as before');
});

test('CLIPBOARD-FULLSCREEN-001: the fallback input goes inside the fullscreen element', ()=>{
  const [before,after]=pair('Clipboard');
  const run=code=>{
    const where=[];
    const mk=name=>({appendChild:c=>where.push(name)});
    const fs=mk('fullscreen'),body=mk('body');
    const c=loadLegacy(code,'Clipboard',{navigator:{},Fullscreen:{get:()=>fs},
      document:{body,createElement:()=>({style:{},select(){},remove(){}}),execCommand(){}},window:{setTimeout(){}}});
    c.copyText('x');
    return where;
  };
  assert.deepEqual(run(before),['body']);
  assert.deepEqual(run(after),['fullscreen']);
});
