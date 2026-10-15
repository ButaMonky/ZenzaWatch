'use strict';
// A Windows CRLF userscript must traverse its nested //@require dependency.
// Previously the legacy build split only on LF and its anchored directives
// kept trailing carriage returns, silently omitting entire runtime classes.
const assert=require('assert');
const fs=require('fs'),os=require('os'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'../..');
const builder=fs.readFileSync(path.join(root,'build.js'),'utf8');
const start=builder.indexOf('function requireFile(');
const end=builder.indexOf('\nfunction deploy(',start);
function parser(){
  const REQMAP={};
  const context={require,REQMAP,BUILD_INPUTS:new Set(),
    console:{warn:()=>{},log:()=>{},error:()=>{}}};
  const fn=vm.runInNewContext('('+builder.slice(start,end)+')',context);
  return {fn,REQMAP};
}
describe('Task499 Windows line endings do not hide nested userscript imports',()=>{
  it('explicitly normalizes CRLF before scanning all require and template lines',()=>{
    assert(start>=0&&end>start,'can extract the production loader');
    const matches=builder.match(/split\(\/\\r\?\\n\/\)\.some/g)||[];
    assert.strictEqual(matches.length,2,
      'both the dependency walker and top-level entry parser must normalize CRLF');
  });
  for(const ending of ['\r\n','\n']){
    it('expands a strict nested dependency with '+(ending==='\n'?'LF':'CRLF'),()=>{
      const dir=fs.mkdtempSync(path.join(os.tmpdir(),'scui499-crlf-'));
      try{
        const parent=[
          "import {Child} from './child';",
          '//===BEGIN===',
          '//@require Child',
          'const answer=Child.answer;',
          '//===END==='
        ].join(ending);
        const child=['//===BEGIN===','class Child {static answer=42;}',
          '//===END==='].join(ending);
        fs.writeFileSync(path.join(dir,'parent.js'),parent);
        fs.writeFileSync(path.join(dir,'child.js'),child);
        const {fn,REQMAP}=parser();
        const output=fn(dir,'parent.js',{dev:true},'task499-synthetic');
        assert(output.includes('class Child {static answer=42;}'));
        assert(output.includes('const answer=Child.answer;'));
        assert(!output.includes('//@require Child'),
          'an unresolved comment is NOT a successful import');
        assert.strictEqual(Object.keys(REQMAP).length,2);
      }finally{fs.rmSync(dir,{recursive:true,force:true});}
    });
  }
});
