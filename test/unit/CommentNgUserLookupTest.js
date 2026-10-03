const assert=require('assert');
const {beginSection, createContext, run}=require('../helpers/extractSource');
function subject(debug=false,users='') {
  const c=createContext({Config:{getValue:()=>debug},console:{log(){},error(){},time(){},timeEnd(){}},
    _:{compact:xs=>xs.filter(Boolean),debounce:fn=>fn},textUtil:{escapeRegs:s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}});
  run(beginSection('packages/lib/src/Emitter.js'),c);
  run(beginSection('packages/zenza/src/commentLayer/NicoChatFilter.js'),c);
  c.users=users;run('globalThis.filter=new NicoChatFilter({userIdFilter:users});',c);
  return c.filter;
}
const chat=(no,userId,extra={})=>({no,userId,score:0,fork:0,threadLabel:'default',type:'naka',text:'clean',cmd:'',...extra});
describe('Task217 NG user batch lookup',()=>{
  for (const debug of [false,true]) {
    it('does not linearly call includes for each candidate, debug='+debug,()=>{
      const f=subject(debug,Array.from({length:5000},(_,i)=>'blocked'+i));
      let includesCalls=0;const list=f.userIdFilterList,includes=list.includes;
      list.includes=function(...args){includesCalls++;return includes.apply(this,args);};
      const result=f.applyFilter(Array.from({length:20000},(_,i)=>chat(i,'blocked'+i%10000)));
      assert.strictEqual(result.length,10000);assert.strictEqual(includesCalls,0);
    });
    it('keeps exact ID matching, order, duplicates and owner exception, debug='+debug,()=>{
      const f=subject(debug,'abc\n abc \n123\nABC');
      const list=Array.from(f.userIdFilterList), input=[chat(1,'abc'),chat(2,'abcd'),chat(3,'123'),chat(4,123),chat(5,'abc',{fork:1}),chat(6,'allowed')];
      assert.deepStrictEqual(Array.from(f.applyFilter(input),c=>c.no),[2,4,5,6]);
      assert.deepStrictEqual(Array.from(f.userIdFilterList),list);
    });
    it('sees replacement/add/clear and does not retain an old derived lookup, debug='+debug,()=>{
      const f=subject(debug,'a');assert.strictEqual(f.isSafe(chat(1,'a')),false);
      f.userIdFilterList='b';assert.strictEqual(f.isSafe(chat(2,'a')),true);assert.strictEqual(f.isSafe(chat(3,'b')),false);
      f.addUserIdFilter('c');assert.strictEqual(f.isSafe(chat(4,'c')),false);
      f.userIdFilterList='';assert.strictEqual(f.isSafe(chat(5,'c')),true);
    });
    it('derives from the current list even if an external consumer mutates the array, debug='+debug,()=>{
      const f=subject(debug,'a');f.getFilterFunc();f.userIdFilterList[0]='b';
      assert.strictEqual(f.isSafe(chat(1,'a')),true);assert.strictEqual(f.isSafe(chat(2,'b')),false);
    });
    it('retains master disable and regex NG behavior, debug='+debug,()=>{
      const f=subject(debug,'a');f.setWordRegFilter('bad','gi');
      assert.deepStrictEqual(Array.from(f.applyFilter([chat(1,'x',{text:'bad'}),chat(2,'y',{text:'bad'}),chat(3,'x')]),c=>c.no),[3]);
      f.isEnable=false;assert.strictEqual(f.applyFilter([chat(4,'a'),chat(5,'x',{text:'bad'})]).length,2);
    });
    it('retains matched-user group filtering, debug='+debug,()=>{
      const f=subject(debug);f.wordFilterList='bad';f.removeNgMatchedUser=true;
      assert.deepStrictEqual(Array.from(f.applyFilter([chat(1,'x',{text:'bad'}),chat(2,'x'),chat(3,'y')]),c=>c.no),[3]);
    });
  }
});
