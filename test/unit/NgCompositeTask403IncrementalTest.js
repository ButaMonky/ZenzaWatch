'use strict';
const assert=require('assert');
const {runtime,rule,node,group,chat}=require('../helpers/compositeTask403');
for(const kind of (process.env.TASK403_DIST==='1'?['source','dist']:['source']))describe('Task403 real incremental '+kind,()=>{
 for(const size of [100,500,1000])it('does not re-evaluate every old comment on '+size+' ordinary additions',()=>{
  const h=runtime(kind,[rule('dim',group([node('text','never-match','contains')]))]);
  let calls=0;const original=h.c.NgCompositeRules.matches;
  h.c.NgCompositeRules.matches=function(...a){calls++;return original.apply(this,a)};
  for(let i=0;i<size;i++){
   h.model.addChat(chat(i,'ordinary','A'));
   assert.strictEqual(h.groups[1].members.length,i+1);
  }
  assert.strictEqual(h.c.networkCount(),0);
  assert(calls<=size*4,'quadratic work: '+calls+' matches for '+size+' comments');
 });
 it('does not re-evaluate an entire author bucket for each harmless new comment',()=>{
  const h=runtime(kind,[rule('hideAuthor')]);let calls=0;const original=h.c.NgCompositeRules.matches;
  h.c.NgCompositeRules.matches=function(...a){calls++;return original.apply(this,a)};
  for(let i=0;i<1000;i++)h.model.addChat(chat(i,'ordinary','A'));
  assert.strictEqual(h.groups[1].members.length,1000);
  assert(calls<=6000,'same-author non-trigger additions must remain incremental: '+calls);
 });
 it('hides and restores older comments across upper/middle/lower groups synchronously',()=>{
  const h=runtime(kind,[rule('hideAuthor')]);
  const a=chat(1,'ordinary','A','ue'),b=chat(2,'ordinary','B'),c=chat(3,'ordinary','A','shita');
  [a,b,c].forEach(x=>h.model.addChat(x));
  const visible=()=>h.groups.map(g=>g.members.length);
  assert.deepStrictEqual(visible(),[1,1,1]);
  const cause=chat(4,'BAN','A');h.model.addChat(cause);assert.deepStrictEqual(visible(),[0,1,0]);
  h.model.removeChat(cause);assert.deepStrictEqual(visible(),[1,1,1]);
 });
 it('updates author-wide bans after an edited trigger or nicoru count change',()=>{
  const h=runtime(kind,[rule('hideAuthor',undefined,{exemptNicoru:true})]);
  const a=chat(1,'ordinary','A','ue'),cause=chat(2,'BAN','A');
  h.model.addChat(a);h.model.addChat(cause);assert.strictEqual(h.groups[0].members.length,0);
  cause.text='ordinary';cause.onChange();assert.strictEqual(h.groups[0].members.length,1);
  cause.text='BAN';cause.onChange();assert.strictEqual(h.groups[0].members.length,0);
  cause.nicoru=1;cause.onChange();assert.strictEqual(h.groups[0].members.length,1);
 });
 it('preserves legacy NG updates, replacement restoration and context reset',()=>{
  const h=runtime(kind,[rule('replace',undefined,{phase:'before'})]);const a=chat(1,'BAN');h.model.addChat(a);
  assert.strictEqual(a.text,'SAFE');
  h.filter.wordFilterList='SAFE';assert.strictEqual(h.groups[1].members.length,0);
  h.filter.wordFilterList='';h.filter.compositeRules=[];
  assert.strictEqual(h.groups[1].members.length,1);assert.strictEqual(a.text,'BAN');
  h.model.clear();assert.deepStrictEqual(h.groups.map(g=>g.members.length),[0,0,0]);
  const pool=h.filter._compositePool;
  assert.strictEqual(pool?.size??pool?.length??0,0);
  const projection=h.filter._compositeProjection;
  assert(!projection||projection.size===0);
  h.model.addChat(chat(2,'ordinary','B'));assert.strictEqual(h.groups[1].members.length,1);
 });
 it('adds no regex/condition work when complex rules are not being used',()=>{
  const h=runtime(kind,[]);let calls=0;const original=h.c.NgCompositeRules.matches;
  h.c.NgCompositeRules.matches=function(...a){calls++;return original.apply(this,a)};
  for(let i=0;i<1000;i++)h.model.addChat(chat(i,'ordinary','A'));
  assert.strictEqual(h.groups[1].members.length,1000);assert.strictEqual(calls,0);
  assert.strictEqual(h.c.networkCount(),0);
 });
});
