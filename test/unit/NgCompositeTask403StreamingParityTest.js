'use strict';
const assert=require('assert');
const {runtime,node,group,rule,chat}=require('../helpers/compositeTask403');
for(const kind of (process.env.TASK403_DIST==='1'?['source','dist']:['source']))describe('Task403 streaming parity '+kind,()=>{
 it('agrees with a fresh whole-batch projection after every append, delete and edit',()=>{
  const rules=[rule('replace',group([node('text','BAN','contains')]),{phase:'before'}),
   rule('dim',group([node('text','STOP','contains')]),{phase:'before',stopOnMatch:true}),
   rule('hideAuthor',group([node('text','SAFE','contains')]),{exemptNicoru:true}),
   rule('hideAuthor',group([node('text','BETA','contains')])),
   rule('mask',group([node('text','MARK','contains')]))];
  const h=runtime(kind,rules),raw=new Map(),live=[];
  const check=()=>{
   const original=live.map(c=>{const x=chat(c.no);Object.assign(x.props,raw.get(c));return x;});
   const expected=h.c.NgCompositeRules.project(original,rules);
   const actualVisible=new Set(h.groups.flatMap(g=>g.members));
   for(let i=0;i<live.length;i++){
    const expectedRow=expected.get(original[i]),actual=live[i];
    assert.strictEqual(actualVisible.has(actual),expectedRow.visible,'visible '+actual.no);
    for(const key of ['text','color','size','opacity'])assert.strictEqual(actual[key],expectedRow[key],key+' '+actual.no);
   }
  };
  for(let i=0;i<70;i++){
   const c=chat(i,['ordinary','BAN','BETA','STOP','MARK','ordinary'][i%6],'author'+i%9,['ue','naka','shita'][i%3]);
   c.nicoru=i%5===0?3:0;raw.set(c,{...c.props});live.push(c);h.model.addChat(c);check();
  }
  for(let i=0;i<18;i++){const index=(i*7)%live.length,c=live[index];h.model.removeChat(c);raw.delete(c);live.splice(index,1);check();}
  for(let i=0;i<live.length;i+=5){const c=live[i];c.text=i%2?'BAN':'ordinary';raw.get(c).text=c.text;c.onChange();check();}
  assert.strictEqual(h.c.networkCount(),0);
 });
 it('creates no extra regular expressions after the validated revision has been compiled',()=>{
  let constructors=0;
  function CountedRegExp(...args){constructors++;return new RegExp(...args);}
  CountedRegExp.prototype=RegExp.prototype;
  const replacement=rule('replace',group([node('regex','a+','regex')]),{pattern:'a+',replacement:'x',regexReplace:true});
  const h=runtime(kind,[replacement],{}, {RegExp:CountedRegExp});const compiled=constructors;
  for(let i=0;i<1000;i++)h.model.addChat(chat(i,'aaa aaa','author'+i%5));
  assert.strictEqual(constructors,compiled,'the immutable rule generation owns compiled regexes');
  assert.strictEqual(h.groups[1].members[0].text,'x x');
  assert(h.filter._compositeProgram.regexCache.size<=2);
  replacement.replacement='y';h.filter.compositeRules=[replacement];
  const rebuilt=constructors;assert(rebuilt>compiled);
  assert.strictEqual(h.groups[1].members[0].text,'y y');
  assert.strictEqual(constructors,rebuilt,'setting invalidation compiles once, not per old row');
  h.filter.compositeRules=[];assert.strictEqual(h.groups[1].members[0].text,'aaa aaa');
  assert.strictEqual(h.filter._compositeProgram.regexCache.size,0);
 });
});
