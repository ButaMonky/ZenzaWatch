'use strict';
const assert=require('assert');
const {beginSection,createContext,run}=require('../helpers/extractSource');
function setup(rules=[]){
 const c=createContext({console:{log(){},error(){},time(){},timeEnd(){}},
  Config:{getValue:()=>false},_: {compact:a=>a.filter(Boolean),debounce:f=>f},
  textUtil:{escapeRegs:s=>s.replace(/[.*+?^$(){}|[\]\\]/g,'\\$&')}});
 run(beginSection('src/NgCompositeRules.js'),c);
 run(beginSection('packages/lib/src/Emitter.js'),c);
 run(beginSection('packages/zenza/src/commentLayer/NicoChatFilter.js'),c);
 c.rules=JSON.parse(JSON.stringify(rules));
 run('globalThis.filter=new NicoChatFilter({compositeRules:rules,sharedNgLevel:"NONE"});',c);
 return {filter:c.filter,engine:c.NgCompositeRules,ctx:c};
}
let n=0;
const node=(field,value,cmp='equals',not=false)=>({id:'c'+(++n),field,value:String(value),cmp,not});
const group=(...nodes)=>({id:'g'+(++n),kind:'group',mode:'all',nodes});
function rule(action='hide',condition=group(node('text','blocked','contains')),more={}){
 return {id:'rule'+(++n),name:'test',enabled:true,scope:'normal',phase:'after',
  stopOnMatch:true,conditions:condition,exemptNicoru:false,nicoruMin:1,
  unknownPolicy:'evaluate',keepProtectedOnAuthorHide:true,
  action,pattern:'blocked',replacement:'clean',regexReplace:false,
  flags:'g',strip:['red','big'],normalizeColor:'white',normalizeSize:'medium',
  dim:30,mask:'***',...more};
}
function chat(id,text='blocked',cmd='red big ue',nicoru=0,userId='A'){
 const props={id,cmd,text,color:'#FF0000',size:'big',type:'ue',opacity:1,
  fork:0,threadLabel:'default',nicoru,nicoruKnown:true,score:0,userId,vpos:1200};
 return {props,get text(){return props.text},set text(v){props.text=v},
  get cmd(){return props.cmd},get color(){return props.color},
  get size(){return props.size},get type(){return props.type},
  get opacity(){return props.opacity},get userId(){return props.userId},
  get fork(){return props.fork},get nicoru(){return props.nicoru},
  get nicoruKnown(){return props.nicoruKnown},get score(){return props.score},
  get vpos(){return props.vpos},get threadLabel(){return props.threadLabel}};
}
describe('Task402 composite NG runtime integration',()=>{
 it('keeps the old fast path and original text when no new rules are enabled',()=>{
  const {filter}=setup([rule('hide',undefined,{enabled:false})]);
  const data=[chat('one'),chat('two','welcome')];
  filter.setCompositeChatPool(data,'sm9');
  assert.deepStrictEqual(filter.applyFilter(data),data);
  assert.strictEqual(data[0].text,'blocked');
  assert.strictEqual(data[0].props.cmd,'red big ue');
 });
 it('evaluates all display groups to hide an author across locations',()=>{
  const {filter}=setup([rule('hideAuthor')]);
  const top=chat('a','blocked'),mid=chat('b','safe'),bottom=chat('c','safe','red big ue',0,'B');
  top.props.type='ue';mid.props.type='naka';bottom.props.type='shita';
  filter.setCompositeChatPool([top,mid,bottom],'sm9');
  assert.deepStrictEqual(filter.applyFilter([top]),[]);
  assert.deepStrictEqual(filter.applyFilter([mid]),[]);
  assert.deepStrictEqual(filter.applyFilter([bottom]),[bottom]);
 });
 it('respects nicoru protection, 0 vs unknown and can change the saved rules live',()=>{
  const r=rule('hide',undefined,{exemptNicoru:true,nicoruMin:1});
  const {filter}=setup([r]);
  const zero=chat('zero'),one=chat('one'),unknown=chat('unknown');
  one.props.nicoru=1;unknown.props.nicoruKnown=false;
  filter.setCompositeChatPool([zero,one,unknown],'sm9');
  assert.deepStrictEqual(filter.applyFilter([zero,one,unknown]),[one]);
  r.unknownPolicy='skip';filter.compositeRules=[r];
  assert.deepStrictEqual(filter.applyFilter([zero,one,unknown]),[one,unknown]);
  filter.compositeRules=[];
  assert.deepStrictEqual(filter.applyFilter([zero,one,unknown]),[zero,one,unknown]);
 });
 it('restores the unmodified source values after disabling an active replacement rule',()=>{
  const {filter}=setup([rule('replace')]),c=chat('one');
  filter.setCompositeChatPool([c],'sm9');
  assert.deepStrictEqual(filter.applyFilter([c]),[c]);
  assert.strictEqual(c.text,'clean');
  filter.compositeRules=[];
  assert.deepStrictEqual(filter.applyFilter([c]),[c]);
  assert.strictEqual(c.text,'blocked');
 });
 it('rechecks after existing NG word settings change',()=>{
  const {filter}=setup([rule('replace',undefined,{phase:'before'})]),c=chat('one');
  filter.setCompositeChatPool([c],'sm9');
  assert.deepStrictEqual(filter.applyFilter([c]),[c]);
  filter.wordFilterList='clean';
  assert.deepStrictEqual(filter.applyFilter([c]),[],'legacy matcher should receive projected text');
  filter.wordFilterList='';
  assert.deepStrictEqual(filter.applyFilter([c]),[c]);
 });
 it('returns the correct visibility for a new comment after the pool changes',()=>{
  const {filter}=setup([rule('hide')]),first=chat('old','safe'),second=chat('new');
  filter.setCompositeChatPool([first],'sm9');assert.strictEqual(filter.isSafe(first),true);
  filter.setCompositeChatPool([first,second],'sm9');
  assert.strictEqual(filter.isSafe(second),false);
 });
});
