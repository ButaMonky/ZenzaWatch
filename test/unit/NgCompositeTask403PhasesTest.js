'use strict';
const assert=require('assert');
const {load,node,group,rule,chat}=require('../helpers/compositeTask403');
for(const kind of (process.env.TASK403_DIST==='1'?['source','dist']:['source']))describe('Task403 rule phases '+kind,()=>{
 let E;before(()=>{E=load(kind).NgCompositeRules;});
 it('evaluates after hideAuthor on the before-replaced text after legacy acceptance',()=>{
  const a=chat(1,'BAN','A'),peer=chat(2,'hello','A'),b=chat(3,'hello','B');
  const before=rule('replace',undefined,{phase:'before'});
  const after=rule('hideAuthor',group([node('text','SAFE','contains')]));
  const rows=[a,peer,b],result=E.project(rows,[before,after],c=>!c.text.includes('BAN'));
  assert.deepStrictEqual(rows.map(c=>result.get(c).visible),[false,false,true]);
  assert.strictEqual(a.text,'BAN','input objects stay untouched');
 });
 it('does not trigger after author NG using the old text removed by a before replacement',()=>{
  const a=chat(1,'BAN','A'),peer=chat(2,'hello','A');
  const before=rule('replace',undefined,{phase:'before'}),after=rule('hideAuthor');
  const rows=[a,peer],result=E.project(rows,[before,after]);
  assert.deepStrictEqual(rows.map(c=>result.get(c).visible),[true,true]);
 });
 it('does not use a stopped or earlier-hidden comment to trigger a later author rule',()=>{
  for(const action of ['replace','hide']){
   const a=chat(1,'BAN','A'),peer=chat(2,'hello','A');
   const before=rule(action,undefined,{phase:'before',stopOnMatch:true});
   const after=rule('hideAuthor',group([node('text',action==='replace'?'SAFE':'BAN','contains')]));
   const result=E.project([a,peer],[before,after]);
   assert.strictEqual(result.get(peer).visible,true);
  }
 });
 it('preserves nicoru-protected peers and distinct author groups with ordered transforms',()=>{
  const a=chat(1,'BAN','A'),protectedPeer=chat(2,'hello','A'),b=chat(3,'hello','B');
  protectedPeer.nicoru=1;
  const before=rule('replace',undefined,{phase:'before'});
  const after=rule('hideAuthor',group([node('text','SAFE','contains')]),{exemptNicoru:true});
  const rows=[a,protectedPeer,b],result=E.project(rows,[before,after]);
  assert.deepStrictEqual(rows.map(c=>result.get(c).visible),[false,true,true]);
 });
 it('reuses replacement regexes in a bounded compiled revision without stale lastIndex',()=>{
  assert.strictEqual(typeof E.compile,'function');
  const r=rule('replace',group([node('regex','a+','regex')]),{pattern:'a+',replacement:'x',regexReplace:true});
  const program=E.compile([r]);assert(program);
  const rows=Array.from({length:1000},(_,i)=>chat(i,'aaa aaa'));
  const first=E.project(rows,program),second=E.project(rows,program);
  for(const c of rows){assert.strictEqual(first.get(c).text,'x x');assert.strictEqual(second.get(c).text,'x x');}
  assert(program.regexCache.size<=2);
  r.replacement='y';const next=E.compile([r]);
  assert.strictEqual(E.project(rows,next).get(rows[0]).text,'y y');
  assert.strictEqual(E.project(rows,program).get(rows[0]).text,'x x');
 });
});
