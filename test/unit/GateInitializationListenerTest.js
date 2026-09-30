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

describe('Gate initialization listener cleanup',()=>{
 it('removes the capture listener only after a valid initialization message',()=>{
  const {c,gate,listeners}=subject();let starts=0,sends=0;
  const loader={location:{replace(){}}};
  c.document={body:{append(){}},createElement(){return {style:{},contentWindow:loader};}};
  gate.port=null;
  const port={addEventListener(){},start(){starts++;},postMessage(){sends++;}};
  const data={id:'ZenzaWatch',type:'test',token:'test-token',body:{command:'initialized',params:{command:'ready',status:'ok'}}};
  gate._initializeCrossDomainGate();assert.strictEqual(listeners.length,1);
  listeners[0].fn({source:{}});assert.strictEqual(listeners.length,1);
  for(const invalid of [Object.assign({},data,{token:'wrong'}),Object.assign({},data,{type:'wrong'}),
    Object.assign({},data,{body:{command:'ready',status:'ok'}})]){
   listeners[0].fn({source:loader,data:invalid,ports:[port]});
   assert.strictEqual(listeners.length,1);assert.strictEqual(gate._initializeStatus,'none');
   assert.strictEqual(gate.port,null);
  }
  listeners[0].fn({source:loader,data,ports:[port]});
  assert.strictEqual(gate._initializeStatus,'done');assert.strictEqual(gate.port,port);
  assert.strictEqual(starts,1);assert.strictEqual(sends,1);assert.strictEqual(listeners.length,0);
 });
});
