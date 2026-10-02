'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const parser = require('@babel/parser');
const {REPO_ROOT} = require('../helpers/buildSandbox');
describe('Task200 generated module boundary',()=>{
 for(const name of ['ZenzaCommentHistoryCore','ZenzaCommentHistorySettings']){
  it(name+' has a real named export and a separately executable Zenza section',()=>{
   const file=path.join(REPO_ROOT,'packages/comment-history/src/generated',name+'.generated.js');
   const text=fs.readFileSync(file,'utf8');
   const ast=parser.parse(text,{sourceType:'module'});
   assert(ast.program.body.some(n=>n.type==='ExportNamedDeclaration'&&(n.specifiers||[]).some(s=>s.exported.name===name)));
   const section=text.split('//===BEGIN===')[1].split('//===END===')[0];
   const c=vm.createContext({console,URL,URLSearchParams,AbortController,setTimeout,clearTimeout,performance});
   new vm.Script(section+'\nglobalThis.result='+name+';').runInContext(c);
   assert.strictEqual(typeof c.result,'object');
   assert.strictEqual(typeof require(file)[name],'object');
  });
 }
});
