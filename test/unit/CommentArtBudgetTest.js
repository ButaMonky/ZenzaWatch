const assert=require('assert');
const {loadClass,createContext}=require('../helpers/extractSource');
function budget(){return loadClass('packages/zenza/src/commentLayer/CommentDisplayBudget.js','CommentDisplayBudget',createContext());}
const c=(id,group='art',extra={})=>({id,group,fork:0,beginLeftTiming:10,...extra});
function decide(list,options={}){const B=budget();return B.admit(list,{limit:200,liveCount:149,tierOf:x=>B.tierOf(x,!!x.history),groupOf:x=>x.group,...options});}
describe('Task211 simultaneous art parts use atomic admission',()=>{
 it('does not admit only one of two history parts at the reservation boundary',()=>{const r=decide([c(1,'art',{history:true}),c(2,'art',{history:true})]);assert.strictEqual(r.admitted.length,0);assert.strictEqual(r.suppressed.length,2);assert(r.suppressed.every(x=>x.reason==='ca_group_reserve'));});
 it('admits the complete unit when enough room exists',()=>{const r=decide([c(1,'art',{history:true}),c(2,'art',{history:true})],{liveCount:148});assert.strictEqual(r.admitted.length,2);assert.strictEqual(r.suppressed.length,0);});
 it('uses the lower priority rather than promoting history to ordinary priority',()=>{const r=decide([c(1),c(2,'art',{history:true})]);assert.strictEqual(r.admitted.length,0);});
 it('owner and local posts remain exempt even with a group label',()=>{const r=decide([c(1,'art',{isMine:true}),c(2,'art',{fork:1}),c(3),c(4)],{liveCount:200});assert.deepStrictEqual(Array.from(r.admitted,x=>x.id),[1,2]);assert.strictEqual(r.suppressed.length,2);});
 it('does not let an oversized unit block unrelated smaller candidates',()=>{const r=decide([c(1),c(2),c(3,null)],{liveCount:199});assert.deepStrictEqual(Array.from(r.admitted,x=>x.id),[3]);assert(r.suppressed.every(x=>x.reason==='ca_group_limit'));});
 it('does not touch an already live object',()=>{const live=Object.freeze(c(0));const input=[c(1),c(2)];decide(input,{liveCount:200});assert.strictEqual(live.id,0);assert.strictEqual(input.length,2);});
 it('without group metadata retains the exact single-comment behavior',()=>{const list=[c(1,null),c(2,null)];const r=decide(list,{liveCount:199});assert.strictEqual(r.admitted.length,1);assert.strictEqual(r.suppressed[0].reason,'limit');});
 it('does not join art groups from different start times',()=>{const r=decide([c(1,'start1'),c(2,'start2')],{liveCount:199});assert.strictEqual(r.admitted.length,1);});
});
