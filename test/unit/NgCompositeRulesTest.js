'use strict';
const assert=require('assert');
const {createContext,beginSection,run}=require('../helpers/extractSource');
function setup(){
  const ctx=createContext();
  run(beginSection('src/NgCompositeRules.js')+
    '\nthis.NgCompositeRules=NgCompositeRules;',ctx);
  return ctx.NgCompositeRules;
}
let counter=0;
function cond(field,value,cmp='equals',not=false){
  return {id:String(++counter),field,cmp,value,not};
}
function g(nodes,mode='all'){return {id:String(++counter),kind:'group',mode,nodes};}
function rule(action='hide',conditions=g([cond('text','中国','contains')]),more={}){
  return {id:String(++counter),name:'test',enabled:true,scope:'normal',
    stopOnMatch:true,phase:'after',conditions,exemptNicoru:false,
    nicoruMin:1,unknownPolicy:'evaluate',keepProtectedOnAuthorHide:true,
    action,pattern:'中国',replacement:'＊＊',regexReplace:false,
    flags:'g',strip:['red','big'],normalizeColor:'white',
    normalizeSize:'medium',dim:30,mask:'［置換済み］',...more};
}
function chat(text='中国',cmd='red big ue',nicoru=0,userId='A'){
  return {text,cmd,color:'#FF0000',size:'big',type:'ue',fork:0,
    nicoru,nicoruKnown:nicoru!==null,userId,score:-10,vpos:1500,threadLabel:'default'};
}
describe('Task402 composite NG engine',()=>{
  it('defaults to no rules; validates the B2 schema and rejects unsafe regex',()=>{
    const E=setup(),c=chat();
    assert(E.validate([]));
    assert.strictEqual(E.project([c],[],()=>true),null);
    const r=rule();
    assert(E.validate([r]));
    r.conditions=g([cond('regex','(a+)+','regex')]);
    assert.strictEqual(E.validate([r]),false);
    r.conditions=g([cond('text','中国','contains')]);r.pattern='(x+)+';
    r.action='replace';r.regexReplace=true;
    assert.strictEqual(E.validate([r]),false);
    assert.strictEqual(E.validate(new Array(51).fill(r)),false);
  });
  it('combines red AND big AND text; OR/NOT, color aliases and exact author ID',()=>{
    const E=setup(),condition=g([cond('color','red'),cond('size','big'),
      cond('text','中国','contains')]);
    const r=rule('hide',condition);
    assert.strictEqual(E.project([chat()], [r]).get(chat()),undefined);
    const list=[chat('中国'),chat('中国','blue big'),chat('日本','red big'),
      chat('中国','red small')];
    list[1].color='#0000FF';list[3].size='small';
    const result=E.project(list,[r]);
    assert.deepStrictEqual(list.map(c=>result.get(c).visible),[false,true,true,true]);
    const conditional=g([g([cond('color','red'),cond('color','blue')],'any'),
      cond('user','Z','equals',true)]);
    const r2=rule('hide',conditional);
    assert.strictEqual(E.project([list[0]],[r2]).get(list[0]).visible,false);
  });
  it('supports nicoru >=1 protection, explicit unknown values and numeric condition NOT',()=>{
    const E=setup(),r=rule('hide',g([cond('text','中国','contains')]),
      {exemptNicoru:true,nicoruMin:1,unknownPolicy:'evaluate'});
    const list=[chat('中国','red big',0),chat('中国','red big',1),
      chat('中国','red big',null)];
    let result=E.project(list,[r]);
    assert.deepStrictEqual(list.map(c=>result.get(c).visible),[false,true,false]);
    r.unknownPolicy='skip';result=E.project(list,[r]);
    assert.deepStrictEqual(list.map(c=>result.get(c).visible),[false,true,true]);
    r.exemptNicoru=false;r.conditions=g([cond('nicoru','1','gte',true)]);
    result=E.project(list,[r]);
    assert.strictEqual(result.get(list[2]).visible,true,'unknown must not become zero through NOT');
  });
  it('hides an entire uploader across top/middle/bottom without permanent user NG',()=>{
    const E=setup(),r=rule('hideAuthor',g([cond('text','中国','contains')]),
      {exemptNicoru:true,nicoruMin:10,keepProtectedOnAuthorHide:true});
    const list=[chat('中国','red big',2,'A'),chat('日本','red big',1,'A'),
      chat('日本','red big',14,'A'),chat('日本','red big',0,'B')];
    list[1].type='naka';list[2].type='shita';
    let result=E.project(list,[r]);
    assert.deepStrictEqual(list.map(c=>result.get(c).visible),[false,false,true,true]);
    r.keepProtectedOnAuthorHide=false;result=E.project(list,[r]);
    assert.deepStrictEqual(list.map(c=>result.get(c).visible),[false,false,false,true]);
    const anonymous=chat('中国','red big',1,'');
    result=E.project([anonymous],[r]);
    assert.strictEqual(result.get(anonymous).visible,true);
  });
  it('replaces text, strips decoration independently, masks and dims',()=>{
    const E=setup(),c=chat();
    let r=rule('replace');
    let result=E.project([c],[r]);
    assert.strictEqual(result.get(c).text,'＊＊');
    assert.strictEqual(c.text,'中国','projection must not mutate input data');
    r.action='strip';r.phase='before';
    result=E.project([c],[r]);
    assert.strictEqual(result.get(c).cmd,'ue');
    assert.strictEqual(result.get(c).size,'medium');
    assert.strictEqual(result.get(c).color,'#FFFFFF');
    assert.strictEqual(result.get(c).type,'ue');
    r.action='mask';result=E.project([c],[r]);assert.strictEqual(result.get(c).text,'［置換済み］');
    r.action='dim';result=E.project([c],[r]);assert.strictEqual(result.get(c).opacity,0.3);
  });
  it('respects legacy NG ordering before/after and rule stop flag',()=>{
    const E=setup(),c=chat();
    const predicate=x=>!x.text.includes('中国');
    const before=rule('replace',g([cond('text','中国','contains')]),{phase:'before'});
    assert.strictEqual(E.project([c],[before],predicate).get(c).visible,true);
    const after={...before,phase:'after'};
    assert.strictEqual(E.project([c],[after],predicate).get(c).visible,false);
    assert.strictEqual(E.project([c],[before],()=>false).get(c).visible,false);
  });
});

describe('Task402 advanced rule input safety and missing values',()=>{
  it('rejects ambiguous quantified groups that could freeze comment rendering',()=>{
    const E=setup();
    for(const pattern of ['(a|aa)+$','(ab)+','(foo|bar)*','(a+)+','a.*.*b']){
      assert.strictEqual(E.isSafeRegex(pattern),false,pattern);
    }
    assert.strictEqual(E.isSafeRegex('中国.*'),true);
    assert.strictEqual(E.isSafeRegex('^(?:中国|台湾)$'),true);
  });
  it('rejects Object prototype color names and duplicate rule identities',()=>{
    const E=setup();
    const one=rule();one.conditions=g([cond('color','__proto__')]);
    assert.strictEqual(E.validate([one]),false);
    one.conditions=g([cond('text','中国','contains')]);
    one.normalizeColor='__proto__';
    assert.strictEqual(E.validate([one]),false);
    one.normalizeColor='white';
    assert.strictEqual(E.validate([one,{...one}]),false);
  });
  it('never allows numeric NOT to match a missing field',()=>{
    const E=setup();
    const test=chat();
    delete test.vpos;
    delete test.score;
    assert.strictEqual(E.matches(cond('vpos','10','gte',true),test),false);
    assert.strictEqual(E.matches(cond('score','0','equals',true),test),false);
  });
  it('rejects unsupported position stripping until group rebucketing is available',()=>{
    const E=setup(),r=rule('strip');
    r.strip=['red','big'];
    assert.strictEqual(E.validate([r]),true);
    r.strip=['ue'];
    assert.strictEqual(E.validate([r]),false);
  });
});
