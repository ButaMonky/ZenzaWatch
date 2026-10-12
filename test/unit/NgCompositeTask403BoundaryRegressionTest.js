'use strict';
const assert=require('assert');
const {execFileSync}=require('child_process');
const {beginSection,extract,createContext,run}=require('../helpers/extractSource');
const {REPO_ROOT}=require('../helpers/buildSandbox');
const {node,group,rule,chat}=require('../helpers/compositeTask403');
const variants=process.env.TASK403_ORIGINAL==='1'?['original']:
 process.env.TASK403_DIST==='1'?['source','watch-dist','advanced-dist']:['source'];
function engine(kind){
 const c=createContext();
 if(kind==='original'){
  const text=execFileSync('git',['show','2e4e192:src/NgCompositeRules.js'],{cwd:REPO_ROOT,encoding:'utf8'});
  run(text.split('//===BEGIN===')[1].split('//===END===')[0],c);
 }else if(kind==='source')run(beginSection('src/NgCompositeRules.js'),c);
 else{
  const file=kind==='watch-dist'?'dist/ZenzaWatch-dev.user.js':'dist/ZenzaAdvancedSettings.user.js';
  run('const NG_COLOR_HEX='+extract(file,'NG_COLOR_HEX','var')+';',c);
  run(extract(file,'NgCompositeRules'),c);
 }
 run('globalThis.Engine=NgCompositeRules;',c);return c.Engine;
}
for(const kind of variants)describe('Task403 boundary outcomes '+kind,function(){
 this.timeout(15000);let E;before(()=>{E=engine(kind);});
 it('never hides comments because nested AND/OR numeric NOT encountered missing metadata',()=>{
  for(const field of ['score','nicoru','vpos'])for(const value of [undefined,null,NaN,Infinity,-Infinity,'',false]){
   for(const mode of ['all','any']){
    const c=chat(1,'ordinary');c[field]=value;
    const unknown=node(field,'1','gte',true),never=node('user','NEVER');
    const known=node('text','ordinary');
    const condition=mode==='all'?group([known,group([group([unknown]),never],'any')]):
     group([never,group([group([unknown],'any'),known])],'any');
    const r=rule('hide',condition);assert(E.validate([r]));
    assert.strictEqual(E.project([c],[r]).get(c).visible,true,field+' '+String(value)+' '+mode);
   }
  }
 });
 it('still matches an OR whose known branch matches despite a separate unknown numeric branch',()=>{
  const c=chat(1,'ordinary');c.score=null;
  const r=rule('hide',group([node('score','1','gte',true),node('text','ordinary')],'any'));
  assert.strictEqual(E.project([c],[r]).get(c).visible,false);
 });
 it('treats numeric equality numerically for nicoru, score and playback seconds',()=>{
  for(const field of ['nicoru','score','vpos'])for(const spelling of ['01','1.0','1.00','1e0']){
   const c=chat(1);c[field]=field==='vpos'?100:1;
   const r=rule('hide',group([node(field,spelling)]));
   assert.strictEqual(E.project([c],[r]).get(c).visible,false,field+' '+spelling);
  }
 });
 it('preserves leading zeros and decimal spelling in exact user ID and text conditions',()=>{
  for(const field of ['user','text'])for(const spelling of ['01','1.0','1e0']){
   const c=chat(1,'1','1');
   const mismatch=rule('hide',group([node(field,spelling)]));
   assert.strictEqual(E.project([c],[mismatch]).get(c).visible,true,field+' '+spelling);
   const exact=rule('hide',group([node(field,'1')]));
   assert.strictEqual(E.project([c],[exact]).get(c).visible,false);
  }
 });
 it('leaves three thousand raw comments intact at zero rules and fifty disabled rules',()=>{
  const rows=Array.from({length:3000},(_,i)=>chat(i,'raw-'+i));
  const source=rows.map(c=>c.text);
  assert.strictEqual(E.project(rows,[]),null);
  const disabled=Array.from({length:50},(_,i)=>rule('hide',group([node('text','raw-'+i)]),{enabled:false}));
  assert(E.validate(disabled));assert.strictEqual(E.project(rows,disabled),null);
  assert.deepStrictEqual(rows.map(c=>c.text),source);
 });
 it('applies all fifty distinct rules to three thousand comments without losing unmatched comments',()=>{
  const rows=Array.from({length:3000},(_,i)=>chat(i,'key-'+i%51,'author-'+i%7,['ue','naka','shita'][i%3]));
  const rules=Array.from({length:50},(_,i)=>rule('hide',group([node('text','key-'+i)])));
  assert(E.validate(rules));const result=E.project(rows,rules);
  assert.strictEqual(result.size,3000);
  for(let i=0;i<rows.length;i++){
   assert.strictEqual(result.get(rows[i]).visible,i%51===50,'comment '+i);
   assert.strictEqual(rows[i].text,'key-'+i%51);
  }
  assert.strictEqual(rows.filter(c=>result.get(c).visible).length,58);
 });
 it('rejects fifty-one rules as a whole and does not apply a partial transformation',()=>{
  const rows=[chat(1,'BAN'),chat(2,'ordinary')],source=JSON.stringify(rows.map(c=>c.props));
  const rules=Array.from({length:51},()=>rule('replace'));
  assert.strictEqual(E.validate(rules),false);
  assert.strictEqual(E.project(rows,rules),null);
  assert.strictEqual(JSON.stringify(rows.map(c=>c.props)),source);
 });
 it('does not hide author peers from a trigger already rejected by legacy NG',()=>{
  const rows=[chat(1,'BAN','A'),chat(2,'ordinary','A'),chat(3,'ordinary','B')];
  const result=E.project(rows,[rule('hideAuthor')],c=>c.text!=='BAN');
  assert.deepStrictEqual(rows.map(c=>result.get(c).visible),[false,true,true]);
 });
 it('does not trigger a later author rule after a same-phase replacement stopped evaluation',()=>{
  const rows=[chat(1,'BAN','A'),chat(2,'ordinary','A')];
  const replace=rule('replace',undefined,{stopOnMatch:true});
  const author=rule('hideAuthor',group([node('text','SAFE')]));
  const result=E.project(rows,[replace,author]);
  assert.strictEqual(result.get(rows[0]).text,'SAFE');
  assert.deepStrictEqual(rows.map(c=>result.get(c).visible),[true,true]);
 });
});
