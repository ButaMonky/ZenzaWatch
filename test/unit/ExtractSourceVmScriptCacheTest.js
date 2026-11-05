'use strict';
// Reusing compiled VM scripts may improve the stability of expensive UI
// fixtures, but MUST NOT reuse per-test VM globals or mutable source values.
const assert=require('assert');
const vm=require('vm');
const {run,createContext}=require('../helpers/extractSource');
describe('VM source extraction script compilation ownership',()=>{
 it('compiles an unchanged source once while preserving isolated contexts',()=>{
  const original=vm.Script;let compiles=0;
  const source='globalThis.zenzaVmCacheProbe=(globalThis.zenzaVmCacheProbe||0)+1;'+
   'globalThis.zenzaVmCacheProbe;';
  vm.Script=class extends original{constructor(...args){super(...args);compiles++;}};
  try{
   const a=createContext(),b=createContext();
   assert.strictEqual(run(source,a),1);
   assert.strictEqual(run(source,a),2);
   assert.strictEqual(run(source,b),1);
   assert.strictEqual(a.zenzaVmCacheProbe,2);
   assert.strictEqual(b.zenzaVmCacheProbe,1);
   assert.strictEqual(compiles,1,'same source should reuse parsed VM script');
   assert.strictEqual(run(source+' 1;',a),1);
   assert.strictEqual(compiles,2,'changed source must compile separately');
  }finally{vm.Script=original;}
 });
 it('evicts old compiled source after 64 entries and rejects malformed scripts',()=>{
  const Original=vm.Script;let compiles=0;
  vm.Script=class extends Original{constructor(...args){super(...args);compiles++;}};
  try{
   const ctx=createContext();
   const oldSource='globalThis.__vmCacheEvictedTest=101';
   assert.strictEqual(run(oldSource,ctx),101);
   for(let i=0;i<65;i++){
    run('globalThis.__vmCacheSlot'+i+'='+i,ctx);
   }
   assert.strictEqual(run(oldSource,ctx),101);
   assert.strictEqual(compiles,67,
    'bounded cache must recompile a source displaced by newer scripts');
   assert.throws(()=>run('const __invalid = ;',ctx),SyntaxError);
   assert.strictEqual(run(oldSource,createContext()),101,
    'new contexts must never inherit the old VM state');
  }finally{vm.Script=Original;}
 });
});
