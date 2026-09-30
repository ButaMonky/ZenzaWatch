const assert=require('assert');
const {beginSection,createContext,run}=require('../helpers/extractSource');
function subject(){
 const listeners=[];
 const c=createContext({PRODUCT:'ZenzaWatch',TOKEN:'test-token',location:{href:'https://example.invalid'},
 console:{log(){},warn(){},time(){},timeEnd(){}},
 addEventListener(name,fn,options){listeners.push({name,fn,capture:!!(options&&options.capture)});},
 removeEventListener(name,fn,options){const capture=options===true||!!(options&&options.capture);const i=listeners.findIndex(x=>x.name===name&&x.fn===fn&&x.capture===capture);if(i>=0)listeners.splice(i,1);}});
 run(beginSection('packages/lib/src/Emitter.js'),c);
 const Gate=run(beginSection('packages/lib/src/infra/CrossDomainGate.js')+';CrossDomainGate;',c);
 const gate=new Gate({baseUrl:'https://example.invalid/gate',type:'test'});
 gate._initializeFrame=async()=>{};
 gate.port={postMessage(){}};
 return {c,gate,listeners};
}

const tick=()=>new Promise(resolve=>setImmediate(resolve));
describe('Gate session registration',()=>{
 it('does not retain sessions for 10000 fire-and-forget sends',async()=>{
  const {gate}=subject();let sent=0;gate.port.postMessage=()=>sent++;
  for(let i=0;i<10000;i++)await gate._postMessage({command:'saveConfig',params:{}},false);
  assert.strictEqual(sent,10000);assert.strictEqual(Object.keys(gate._sessions).length,0);
 });
 for(const usePromise of [false,true])it(`send exception rejects and leaves no session (${usePromise})`,async()=>{
  const {gate}=subject();const error=new Error('send failed');gate.port.postMessage=()=>{throw error;};
  await assert.rejects(gate._postMessage({command:'fetch',params:{}},usePromise),e=>e===error);
  assert.strictEqual(Object.keys(gate._sessions).length,0);
 });
 it('registers before sending so a synchronous reply can settle',async()=>{
  const {gate}=subject();let registered;
  gate.port.postMessage=packet=>{registered=!!gate._sessions[packet.sessionId];gate._onCommand({command:'fetch',status:'ok',params:42},packet.sessionId);};
  const pending=gate._postMessage({command:'fetch',params:{}},true,'sync');
  await tick();assert.strictEqual(registered,true);
  assert.strictEqual(await pending,42);assert.strictEqual(Object.keys(gate._sessions).length,0);
 });
 it('normal replies resolve/reject and remove their pending entries',async()=>{
  const {gate}=subject();const a=gate._postMessage({command:'fetch',params:{}},true,'a');await tick();
  assert.strictEqual(Object.keys(gate._sessions).length,1);
  gate._onCommand({command:'fetch',status:'ok',params:'result'},'a');assert.strictEqual(await a,'result');
  const b=gate._postMessage({command:'fetch',params:{}},true,'b');await tick();
  gate._onCommand({command:'fetch',status:'fail'},'b');await assert.rejects(b,e=>e.message==='fail');
  assert.strictEqual(Object.keys(gate._sessions).length,0);
 });
});
