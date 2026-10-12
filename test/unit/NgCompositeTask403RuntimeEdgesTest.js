'use strict';
const assert=require('assert');
const {load,runtime,rule,node,group,chat}=require('../helpers/compositeTask403');
for(const kind of (process.env.TASK403_DIST==='1'?['source','dist']:['source']))describe('Task403 runtime input consistency '+kind,()=>{
 it('matches accepted color names case-insensitively, including aliases and hex',()=>{
  const E=load(kind).NgCompositeRules;
  for(const [name,hex] of [['RED','#FF0000'],['Blue2','#3399FF'],['NicoNicoWhite','#CCCC99'],['#aBcDeF','#ABCDEF']]){
   const r=rule('hide',group([node('color',name)]));
   assert.strictEqual(E.validate([r]),true,name);
   const c=chat(1);c.color=hex;
   assert.strictEqual(E.project([c],[r],()=>true).get(c).visible,false,name);
  }
 });
 it('fails closed for invalid direct color predicates, including NOT',()=>{
  const E=load(kind).NgCompositeRules;
  for(const value of ['__proto__','constructor','toString','unknown-color'])for(const not of [false,true]){
   assert.strictEqual(E.matches(node('color',value,'equals',not),chat(1)),false,value+' NOT='+not);
  }
 });
 it('validates numerical operands using the same decimal grammar as evaluation',()=>{
  const E=load(kind).NgCompositeRules;
  for(const field of ['score','nicoru','vpos']){
   for(const value of ['0x10','0b10','0o10']){
    assert.strictEqual(E.validate([rule('hide',group([node(field,value)]))]),false,field+' '+value);
   }
   for(const value of ['01','1.0','1e0','+1']){
    const r=rule('hide',group([node(field,value)])),c=chat(1);c[field]=field==='vpos'?100:1;
    assert.strictEqual(E.validate([r]),true,field+' '+value);
    assert.strictEqual(E.project([c],[r],()=>true).get(c).visible,false,field+' '+value);
   }
  }
 });
 it('rejects ambiguous ignore-case Unicode repetition on condition and import/replace paths',()=>{
  const E=load(kind).NgCompositeRules;
  for(const pattern of ['^(\u03a3|\u03c2)+$','^(\\u03a3|\\u03c2)+$']){
   assert.strictEqual(E.isSafeRegex(pattern,'i'),false,pattern+' i');
   assert.strictEqual(E.validate([rule('hide',group([node('regex',pattern)]))]),false,'condition '+pattern);
   for(const flags of ['i','iu'])assert.strictEqual(E.validate([rule('replace',undefined,{regexReplace:true,pattern,flags})]),false,'replace '+pattern+' '+flags);
  }
 });
 it('does not prove supplementary or escaped-surrogate alternatives disjoint under iu',()=>{
  const E=load(kind).NgCompositeRules;
  const upper=String.fromCodePoint(0x10400),lower=String.fromCodePoint(0x10428);
  for(const pattern of ['^('+upper+'|'+lower+')+$','^(\\uD801\\uDC00|\\uD801\\uDC28)+$']){
   assert.strictEqual(E.isSafeRegex(pattern,'iu'),false,pattern);
   assert.strictEqual(E.validate([rule('replace',undefined,{regexReplace:true,pattern,flags:'iu'})]),false);
  }
  assert.strictEqual(E.isSafeRegex('('+String.fromCodePoint(0x1f600)+')+','u'),true);
 });
 it('preserves ordinary case-sensitive and Japanese regexes when safety is provable',()=>{
  const E=load(kind).NgCompositeRules;
  for(const [pattern,flags] of [['(ab)+',''],['(?:foo|bar)*','i'],['^(?:\u4e2d\u56fd|\u53f0\u6e7e)+$','i'],['(?:A|a)+','']]){
   assert.strictEqual(E.isSafeRegex(pattern,flags),true,pattern+' '+flags);
  }
 });
 it('preserves legacy author-wide NG when a before rule also hides its cause',()=>{
  for(const action of [null,'hide','replace']){
   const h=runtime(kind,action?[rule(action,undefined,{phase:'before'})]:[],{wordFilter:'BAN',removeNgMatchedUser:true});
   h.model.addChat(chat(1,'BAN','A'));h.model.addChat(chat(2,'ordinary','A'));h.model.addChat(chat(3,'ordinary','B'));
   assert.deepStrictEqual(Array.from(h.groups[1].members,c=>c.userId),action==='replace'?['A','A','B']:['B'],String(action));
  }
 });
 it('bounds expanded literal proofs instead of expanding multi-megabyte alternatives',()=>{
  const E=load(kind).NgCompositeRules;let arm='a';
  for(let i=0;i<11;i++)arm='('+arm+'){4}';
  assert.strictEqual(E.isSafeRegex('^('+arm+'b|'+arm+'c)+$'),false);
  assert.strictEqual(E.isSafeRegex(arm,''),true,'fixed repetition alone needs no alternative proof');
 });
 it('rejects child containers on leaf predicates at shared validation',()=>{
  const E=load(kind).NgCompositeRules;
  for(const children of [{},'unexpected',[],[node('text','EXTRA')]]){
   const r=rule();r.conditions.nodes[0].nodes=children;
   assert.strictEqual(E.validate([r]),false,'leaf nodes must not carry child containers');
  }
 });
 it('rejects malformed leaf children before editor ID traversal while preserving ordinary drafts',()=>{
  const {beginSection,extract,createContext,run}=require('../helpers/extractSource');
  const c=createContext({NgCompositeRules:load(kind).NgCompositeRules});
  run((kind==='source'?beginSection('src/NgCompositeRuleEditor.js'):
   extract('dist/ZenzaAdvancedSettings.user.js','NgCompositeRuleEditor'))+'\nglobalThis.Editor=NgCompositeRuleEditor;',c);
  const saved=[rule()];assert.deepStrictEqual(JSON.parse(JSON.stringify(c.Editor.prepareDraft(saved))),saved);
  for(const children of [{},'unexpected',[],[node('text','EXTRA')]]){
   const r=rule();r.conditions.nodes[0].nodes=children;
   assert.throws(()=>c.Editor.prepareDraft([r]));
  }
  const incomplete=c.Editor.newRule();assert.doesNotThrow(()=>c.Editor.prepareDraft([incomplete]));
 });
 it('restores display state before removing and reinserting the same comment object',()=>{
  for(const action of ['dim','replace']){
   const h=runtime(kind,[rule(action)]),c=chat(1,'BAN','A');h.model.addChat(c);
   assert.strictEqual(action==='dim'?c.opacity:c.text,action==='dim'?0.5:'SAFE');
   h.model.removeChat(c);
   assert.strictEqual(c.opacity,1);assert.strictEqual(c.text,'BAN');
   h.model.addChat(c);
   assert.strictEqual(action==='dim'?c.opacity:c.text,action==='dim'?0.5:'SAFE');
   h.filter.compositeRules=[];assert.strictEqual(h.groups[1].members.length,1);
   assert.strictEqual(c.opacity,1);assert.strictEqual(c.text,'BAN');
  }
 });
 it('reuses condition and global replacement regexes, then refreshes them with edited rules',()=>{
  let constructed=0;
  class CountedRegExp extends RegExp {constructor(...args){super(...args);constructed++;}}
  const E=load(kind,{RegExp:CountedRegExp}).NgCompositeRules;
  const r=rule('replace',group([node('regex','BAN')]),{regexReplace:true,flags:'g'});
  const program=E.compile([r]);assert(program);constructed=0;
  for(let i=0;i<100;i++){
   const c=chat(i,'BAN BAN');assert.strictEqual(E.project([c],program,()=>true).get(c).text,'SAFE SAFE');
  }
  assert.strictEqual(constructed,0,'validated programs must not compile regexes while matching');
  r.pattern='SAFE';r.replacement='EDITED';r.conditions=group([node('regex','SAFE')]);
  const edited=E.compile([r]);assert(constructed>0,'edited rule creates a fresh program');constructed=0;
  const c=chat(101,'SAFE SAFE');assert.strictEqual(E.project([c],edited,()=>true).get(c).text,'EDITED EDITED');
  assert.strictEqual(constructed,0);
  const original=chat(102,'BAN BAN');assert.strictEqual(E.project([original],program,()=>true).get(original).text,'SAFE SAFE');
 });
});
