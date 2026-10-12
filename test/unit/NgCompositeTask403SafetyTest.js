'use strict';
const assert=require('assert');
const {load,node,group,rule,chat}=require('../helpers/compositeTask403');
for(const kind of (process.env.TASK403_DIST==='1'?['source','dist']:[process.env.TASK403_SOURCE_KIND||'source']))describe('Task403 safety '+kind,()=>{
 let E;before(()=>{E=load(kind).NgCompositeRules;});
 it('accepts deterministic repetitions and rejects ambiguous/overlapping repetition',()=>{
  for(const p of ['(ab)+','^(ab)+$','(?:foo|bar)*','^(ab|ac)+$','\\d{1,4}','[a-z]+','中国.*','^(中国|台湾)$'])
   assert.strictEqual(E.isSafeRegex(p),true,'safe '+p);
  for(const p of ['(a|aa)+$','(a+)+$','(a?)*b','(a|a)+b','a+a+b','.*.*b','(a{1,3})+b','\\1','(?<=a)b'])
   assert.strictEqual(E.isSafeRegex(p),false,'risk '+p);
 });
 it('validates the same regex policy for conditions and replacements',()=>{
  const good=rule('replace',group([node('regex','(ab)+','regex')]),{pattern:'(ab)+',regexReplace:true});
  assert(E.validate([good]));
  assert(!E.validate([{...good,pattern:'(a|aa)+$'}]));
  assert(!E.validate([{...good,flags:'gg'}]));
  assert(!E.validate([{...good,conditions:group([node('regex','(a|aa)+$','regex')])}]));
 });
 it('rejects inherited colors but accepts aliases, mixed case and hexadecimal normalization',()=>{
  for(const color of ['__proto__','constructor','hasOwnProperty','toString']){
   assert.strictEqual(E.validate([rule('hide',group([node('color',color)]))]),false,color);
   assert.strictEqual(E.validate([rule('normalize',undefined,{normalizeColor:color})]),false,color);
  }
  for(const color of ['red','truered','RED','#aBc123']){
   assert(E.validate([rule('hide',group([node('color',color)]))]),color);
   assert(E.validate([rule('normalize',undefined,{normalizeColor:color})]),color);
  }
 });
 it('evaluates mixed-case color aliases and hexadecimal values without changing the intended color',()=>{
  const c=chat(1,'ordinary');c.props.cmd='red';c.props.color='#FF0000';
  for(const value of ['RED','red','#fF0000'])assert.strictEqual(E.matches(node('color',value),c),true,value);
  const r=rule('normalize',group([node('text','ordinary')]),{normalizeColor:'#abCd12',normalizeSize:'keep'});
  assert.strictEqual(E.project([c],[r]).get(c).color,'#ABCD12');
 });
 it('rejects missing and duplicate condition IDs and a non-group editor root',()=>{
  const r=rule();r.conditions.nodes.push({...r.conditions.nodes[0]});
  assert.strictEqual(E.validate([r]),false);
  const fresh=rule();delete fresh.conditions.nodes[0].id;assert.strictEqual(E.validate([fresh]),false);
  fresh.conditions=node('text','BAN');assert.strictEqual(E.validate([fresh]),false);
 });
 it('detects duplicate IDs independently for two different banned authors',()=>{
  const a=rule('hideAuthor',group([node('text','alpha','contains')]));
  const b=rule('hideAuthor',group([node('text','beta','contains')]));
  const list=[chat(1,'alpha','A'),chat(2,'normal','A'),chat(3,'beta','B'),chat(4,'normal','B')];
  assert(E.validate([a,b]));
  assert.deepStrictEqual(list.map(c=>E.project(list,[a,b]).get(c).visible),[false,false,false,false]);
  b.id=a.id;
  assert.strictEqual(E.validate([a,b]),false);
  assert.strictEqual(E.project(list,[a,b]),null,'invalid rules cannot produce a partial author result');
 });
 it('does not treat missing/nonfinite numeric metadata as a successful NOT condition',()=>{
  for(const field of ['score','nicoru','vpos'])for(const value of [undefined,null,NaN,Infinity,-Infinity,'',false]){
   const c={score:2,nicoru:2,vpos:200,nicoruKnown:true};c[field]=value;
   const n=node(field,1,'gte',true);
   assert.strictEqual(E.matches(n,c),false,field+':'+String(value));
   assert.strictEqual(E.matches(group([n]),c),false);
   assert.strictEqual(E.matches(group([n],'any'),c),false);
  }
 });
 it('rejects imported group-NOT as unsupported rather than promoting unknown into true',()=>{
  for(const mode of ['all','any']){
   const conditions={...group([node('score',10,'gte')],mode),not:true};
   assert.strictEqual(E.validate([rule('hide',conditions)]),false);
   assert.strictEqual(E.matches(conditions,{score:undefined}),false);
  }
 });
 it('compares numeric equals numerically but leaves user IDs and ordinary strings exact',()=>{
  for(const value of ['01','1.0','1.00'])assert(E.matches(node('score',value),{score:1}));
  assert(E.matches(node('vpos','15.00'),{vpos:1500}));
  assert(!E.matches(node('user','01'),{userId:'1'}));
 });
 it('does not truncate long strings to invent an end-anchor match or NOT outcome',()=>{
  const c=chat(1,'a'.repeat(256)+'b');
  assert.strictEqual(E.matches(node('regex','a$','regex'),c),false);
  assert.strictEqual(E.matches(node('regex','b$','regex'),c),true);
  const huge=chat(2,'a'.repeat(10000)+'b');
  assert.strictEqual(E.matches(node('regex','b$','regex',true),huge),false);
  const r=rule('replace',group([node('text','a','contains')]),{pattern:'a+',regexReplace:true});
  assert.strictEqual(E.project([huge],[r]).get(huge).text,huge.text);
 });
 it('keeps parsed display attributes and forbids position-command stripping',()=>{
  const c=chat(1,'BAN');c.props.color='#00FF00';c.props.size='big';c.props.cmd='ue';
  const r=rule('normalize',undefined,{normalizeColor:'keep',normalizeSize:'keep'});
  const s=E.project([c],[r]).get(c);
  assert.strictEqual(s.color,c.color);assert.strictEqual(s.size,c.size);assert.strictEqual(s.cmd,c.cmd);
  assert(E.validate([rule('strip',undefined,{strip:['red','big']})]));
  for(const p of ['ue','shita','naka'])assert(!E.validate([rule('strip',undefined,{strip:[p]})]));
 });
});
